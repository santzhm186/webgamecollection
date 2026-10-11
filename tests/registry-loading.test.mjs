import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createRegistry, validateManifest } from '../src/core/registry.js';
import { MODULES } from '../games/index.js';
import runnerManifest from '../games/runner/manifest.js';

test('注册表加载：首页只加载 manifest，不提前调用玩法或资源加载器', async () => {
  const calls = { levels: 0, engine: 0, renderer: 0, assets: 0 };
  const manifest = { ...runnerManifest };
  for (const field of Object.keys(calls)) {
    manifest[field] = () => {
      calls[field]++;
      return runnerManifest[field]();
    };
  }
  const registry = createRegistry();
  assert.deepEqual(await registry.load([async () => ({ default: manifest })]), { loaded: 1, failed: 0 });
  assert.equal(registry.get('runner'), manifest);
  assert.deepEqual(registry.ids(), ['runner']);
  assert.deepEqual(registry.list(), [manifest]);
  assert.deepEqual(calls, { levels: 0, engine: 0, renderer: 0, assets: 0 });
});

test('注册表加载：同一游戏并发 resolve 与后续缓存只调用一次各加载器', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = { levels: 0, engine: 0, renderer: 0, assets: 0 };
  const manifest = { ...runnerManifest };
  for (const field of Object.keys(calls)) {
    manifest[field] = async () => {
      calls[field]++;
      await gate;
      return runnerManifest[field]();
    };
  }
  const registry = createRegistry();
  await registry.load([async () => ({ default: manifest })]);
  const first = registry.resolve('runner');
  const second = registry.resolve('runner');
  const third = registry.resolve('runner');
  assert.deepEqual(calls, { levels: 1, engine: 1, renderer: 1, assets: 1 });
  release();
  const results = await Promise.all([first, second, third]);
  assert.equal(results[0], results[1]);
  assert.equal(results[0], results[2]);
  assert.equal(await registry.resolve('runner'), results[0]);
  assert.equal(results[0].levels.length, runnerManifest.levelCount);
  assert.equal(typeof results[0].Engine, 'function');
  assert.equal(typeof results[0].createRenderer, 'function');
  assert.deepEqual(calls, { levels: 1, engine: 1, renderer: 1, assets: 1 });
});

test('注册表加载：玩法加载失败被记录并隔离，其他游戏仍可解析', async () => {
  let attempts = 0;
  const broken = {
    ...runnerManifest, id: 'broken-game',
    engine: async () => { attempts++; throw new Error('unavailable-engine'); },
  };
  const registry = createRegistry();
  await registry.load([
    async () => ({ default: broken }),
    async () => ({ default: runnerManifest }),
  ], { onError() {} });
  const failed = await Promise.allSettled([
    registry.resolve('broken-game'), registry.resolve('broken-game'),
  ]);
  for (const result of failed) {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /broken-game.*unavailable-engine/);
  }
  await assert.rejects(registry.resolve('broken-game'), /unavailable-engine/);
  assert.equal(attempts, 1, '失败结果应缓存，不能每次点击都重做加载');
  const good = await registry.resolve('runner');
  assert.equal(good.levels.length, runnerManifest.levelCount);
  assert.equal(new good.Engine(0).status, 'ready');
  assert.equal(registry.size, 2, '失败的玩法不应删除其他已注册条目');
});

test('注册表加载：首页元数据有正整数关卡数与独立可读取预览', async () => {
  for (const levelCount of [undefined, 0, -1, 1.2, '3', NaN, Infinity]) {
    assert.ok(validateManifest({ ...runnerManifest, levelCount }).some(error => /levelCount/.test(error)));
  }
  assert.ok(validateManifest({ ...runnerManifest, preview: {} }).some(error => /preview/.test(error)));
  const registry = createRegistry();
  await registry.load(MODULES);
  const previews = new Set();
  for (const manifest of registry.list()) {
    assert.ok(Number.isInteger(manifest.levelCount) && manifest.levelCount > 0);
    assert.equal(typeof manifest.preview, 'string', `${manifest.id} 首页必须有静态预览`);
    assert.match(manifest.preview, /^\.\/public\/assets\/art\/[a-z0-9-]+\.svg$/);
    const source = await readFile(new URL(`../${manifest.preview}`, import.meta.url), 'utf8');
    assert.match(source, /<svg\b/);
    assert.ok(!previews.has(source), `${manifest.id} 不得重复使用其他游戏的预览`);
    previews.add(source);
    const { levels } = await registry.resolve(manifest.id);
    assert.equal(levels.length, manifest.levelCount, `${manifest.id} 首页关卡数必须与真实关卡一致`);
  }
});
