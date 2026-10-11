/**
 * 宿主框架测试 —— 注册表与会话（P3 新增）。
 * ============================================================================
 * 这两块是"多人协作 + 多游戏"的地基，出问题的形式都很隐蔽：
 *   · 注册表：id 冲突 → 两个游戏的成绩串台；坏模块 → 整站白屏
 *   · 会话：结算重复 → 分数翻倍、音效重播；暂停后仍在推进 → 玩家切后台回来发现死局
 *
 * 所以这里全部用**真实 manifest**（games/index.js 提供的三个）加**真实引擎**来测，
 * 而不是造 mock —— mock 测不出"manifest 与引擎对不上"这类真实故障。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { createRegistry, validateManifest, hostApiStatus } from '../src/core/registry.js';
import { createSession } from '../src/core/lifecycle.js';
import { MODULES } from '../games/index.js';
import { BUNDLES } from '../src/locales/index.js';
import { DEFAULT_LOCALE } from '../src/core/locales.js';
import { ENGINE_STATUS } from '../src/core/enums.js';
import Runner from '../games/runner/engine.js';
import { Pins, Screws, solveScrews } from '../engine.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

/* ============================================================ 注册表 */

test('注册表：三个游戏全部加载成功且 id/顺序正确', async () => {
  const registry = createRegistry();
  const result = await registry.load(MODULES);
  assert.deepEqual(result, { loaded: 3, failed: 0 }, '内置游戏必须全部加载成功');
  assert.deepEqual(registry.list().map(m => m.id), ['runner', 'pins', 'screws'], '卡片顺序由 order 决定');
  assert.deepEqual(registry.list().map(m => m.order), ['01', '02', '03']);
  for (const manifest of registry.list()) {
    assert.equal(hostApiStatus(manifest.hostApi), 'compatible', `${manifest.id} 声明了不兼容的 hostApi`);
  }
});

test('注册表：每个 manifest 的文案键在**所有语言**里都存在', async () => {
  const registry = createRegistry();
  await registry.load(MODULES);
  for (const manifest of registry.list()) {
    for (const field of ['titleKey', 'taglineKey', 'controlsKey', 'cardMetaKey', 'artLabelKey']) {
      const key = manifest[field];
      if (key === undefined) continue;
      for (const [code, bundle] of Object.entries(BUNDLES)) {
        assert.ok(bundle[key] !== undefined,
          `${manifest.id}.${field} 在 ${code} 里缺少文案键 ${key} —— 该语言下卡片会露出键名`);
      }
    }
    // 分类显示名（nav.<category>）也要存在，否则分类标签会露出键名
    for (const [code, bundle] of Object.entries(BUNDLES)) {
      assert.ok(bundle[`nav.${manifest.category}`] !== undefined,
        `${manifest.id} 的 category '${manifest.category}' 在 ${code} 里缺少 nav.${manifest.category}`);
    }
  }
  // 默认语言仍要单独确认（避免上面循环因 BUNDLES 为空而静默通过）
  assert.ok(BUNDLES[DEFAULT_LOCALE], '默认语言包必须存在');
  assert.ok(Object.keys(BUNDLES).length >= 2, '至少应有两种语言，否则多语言路径从未被检验');
});

test('注册表：解析后能拿到关卡、引擎与渲染器工厂，且引擎能被构造', async () => {
  const registry = createRegistry();
  await registry.load(MODULES);
  for (const manifest of registry.list()) {
    const loaders = await registry.resolve(manifest.id);
    assert.ok(Array.isArray(loaders.levels) && loaders.levels.length > 0, `${manifest.id} 关卡数据为空`);
    assert.equal(typeof loaders.Engine, 'function', `${manifest.id} 的引擎必须可 new`);
    assert.equal(typeof loaders.createRenderer, 'function', `${manifest.id} 的渲染器工厂必须是函数`);

    const engine = new loaders.Engine(0, { t: key => key });
    assert.equal(engine.level, 0);
    assert.ok(['ready', 'playing'].includes(engine.status), '新引擎必须处于 ready 或 playing');
    assert.equal(typeof engine.hud, 'function', `${manifest.id} 的引擎必须实现 hud()`);
    assert.equal(typeof engine.metrics, 'function', `${manifest.id} 的引擎必须实现 metrics()`);
  }
});

test('注册表：坏模块与 id 冲突被隔离，不影响其他游戏（韧性）', async () => {
  const base = (await import('../games/runner/manifest.js')).default;
  const good = async () => ({ default: { ...base, id: 'first-game', order: '01' } });
  const broken = async () => { throw new SyntaxError('模拟贡献者的语法错误'); };
  const conflicting = async () => ({ default: { ...base, id: 'first-game', order: '02' } });

  const messages = [];
  const registry = createRegistry();
  const result = await registry.load([good, broken, conflicting], { onError: m => messages.push(m) });
  assert.equal(result.loaded, 1, '只有合法的那个游戏应被加载');
  assert.equal(result.failed, 2, '坏模块与冲突项都应被计数');
  assert.equal(registry.size, 1, '整站不能因为一个游戏出错而不可用');
  assert.ok(messages.some(m => /加载失败/.test(m)), '应报告模块加载失败');
  assert.ok(messages.some(m => /id 冲突/.test(m)), '应报告 id 冲突');

  // 与真实列表对照：真实游戏之间不应有任何冲突
  const real = createRegistry();
  const realMessages = [];
  await real.load(MODULES, { onError: m => realMessages.push(m) });
  assert.deepEqual(realMessages, [], `内置游戏不应产生任何注册表告警：\n${realMessages.join('\n')}`);
});

test('注册表：manifest 校验能抓出常见错误，且一次性报全', () => {
  const base = {
    id: 'ok-game', titleKey: 'game.runner.title', taglineKey: 'game.runner.tagline',
    controlsKey: 'game.runner.controls', category: 'action', hostApi: '^1.0.0',
    engineVersion: '1.0.0', levelCount: 1, levels: () => {}, engine: () => {}, renderer: () => {},
    scoring: { order: 'desc', primary: 'score' },
  };
  assert.deepEqual(validateManifest(base), [], '合法 manifest 不应报错');

  const cases = [
    [{ id: 'Bad_ID' }, /kebab-case/],
    [{ titleKey: '加减门冲关' }, /文案键/],
    [{ category: 'arcade' }, /category/],
    [{ hostApi: '1.x' }, /hostApi/],
    [{ engineVersion: 'v1' }, /engineVersion/],
    [{ levelCount: 0 }, /levelCount/],
    [{ levelCount: 1.2 }, /levelCount/],
    [{ levels: {} }, /动态 import/],
    [{ assets: [] }, /assets/],
    [{ scoring: undefined }, /scoring/],
    [{ scoring: { order: 'up', primary: 'score' } }, /scoring.order/],
    [{ players: { min: 1, max: 4, defaultMode: 'solo' } }, /players/],
  ];
  for (const [patch, pattern] of cases) {
    const errors = validateManifest({ ...base, ...patch });
    assert.ok(errors.length > 0, `应被拒绝: ${JSON.stringify(patch)}`);
    assert.ok(errors.some(e => pattern.test(e)), `错误信息应说明原因（${pattern}）: ${errors.join(' | ')}`);
  }

  // 一次报全：三个字段都错时应给出三条错误，而不是只报第一条
  const many = validateManifest({ ...base, id: 'Bad_ID', category: 'x', engineVersion: 'nope' });
  assert.ok(many.length >= 3, `应一次性报全所有问题，实际只报了 ${many.length} 条`);
});

test('注册表：hostApi 只比较主版本', () => {
  assert.equal(hostApiStatus('^1.0.0', '1.4.2'), 'compatible', '同主版本视为兼容');
  assert.equal(hostApiStatus('1.0.0', '1.0.0'), 'compatible');
  assert.equal(hostApiStatus('^2.0.0', '1.0.0'), 'outdated', '主版本不同必须判为不兼容');
});

/* ============================================================ 会话 */

test('会话：只有 timeDriven 的游戏会推进，且 delta 被夹紧', () => {
  const timed = createSession({ gameId: 'x', level: 0, Engine: Runner, createRenderer: () => stubRenderer(), timeDriven: true });
  assert.equal(timed.timeDriven, true);
  assert.equal(timed.advance(1), false, '未开始时不应推进');
  timed.start();
  assert.equal(timed.advance(10), true, '超长 delta 应被夹紧而不是丢弃');
  assert.equal(timed.elapsed, 0.1, '单帧最多推进 0.1 秒（与引擎内部夹紧一致）');
  assert.equal(timed.advance(NaN), false, '非法 delta 不应推进');
  assert.equal(timed.elapsed, 0.1);

  // 纯点击玩法：即使声明了 timeDriven 也不推进（引擎没有 tick）
  const clicky = createSession({ gameId: 'y', level: 0, Engine: Pins, createRenderer: () => stubRenderer() });
  assert.equal(clicky.timeDriven, false, '未声明时应按是否实现 tick 推断');
  assert.equal(clicky.advance(1), false);
  assert.equal(clicky.elapsed, 0, '点击类玩法的逻辑时间不应增长（静止即零 CPU）');
});

test('会话：暂停后不再推进，恢复后继续', () => {
  const session = createSession({ gameId: 'x', level: 0, Engine: Runner, createRenderer: () => stubRenderer(), timeDriven: true });
  session.start();
  assert.equal(session.pause(), true);
  assert.equal(session.pause(), false, '重复暂停应返回 false（幂等）');
  assert.equal(session.advance(0.1), false, '暂停期间不得推进');
  assert.equal(session.elapsed, 0);
  assert.equal(session.resume(), true);
  assert.equal(session.advance(0.1), true);
  assert.equal(session.elapsed, 0.1);
  assert.equal(session.togglePause(), true, 'togglePause 应先暂停');
  assert.equal(session.paused, true);
});

test('会话：结算只发生一次（防分数翻倍与音效重播）', () => {
  const session = createSession({ gameId: 'x', level: 0, Engine: Runner, createRenderer: () => stubRenderer(), timeDriven: true });
  session.start();
  let tick = 0;
  while (session.status === ENGINE_STATUS.PLAYING && tick++ < 4000) {
    session.engine.side = 1;          // 固定选右门，走一条确定路线
    session.advance(0.1);
    session.poll();                   // 宿主每帧都会调用
  }
  assert.notEqual(session.status, ENGINE_STATUS.PLAYING, '长时间推进后应已结束');

  const first = session.poll();
  assert.equal(first, null, '结束后第一次 poll 应已被前面的调用消费掉，或返回 null —— 绝不能重复返回结果');

  // 重新构造一次，精确验证"恰好一次"
  const fresh = createSession({ gameId: 'x', level: 0, Engine: Runner, createRenderer: () => stubRenderer(), timeDriven: true });
  fresh.start();
  let outcome = null, outcomes = 0;
  for (let i = 0; i < 4000 && !outcome; i++) {
    fresh.engine.side = 1;
    fresh.advance(0.1);
    outcome = fresh.poll();
    if (outcome) outcomes++;
  }
  assert.ok(outcome, '应能走到结算');
  assert.equal(outcomes, 1);
  assert.equal(fresh.poll(), null, '结算之后必须永远返回 null');
  assert.ok(['win', 'lose'].includes(outcome.event));
  assert.ok(Number.isFinite(outcome.score) && outcome.score > 0, '结算应带有效分数');
  assert.ok(Number.isFinite(outcome.durationMs) && outcome.durationMs >= 0, '结算应带时长');
  assert.equal(typeof outcome.metrics, 'object', '结算应带上引擎的 metrics');
});

test('会话：hint / undo 只在引擎实现时才可用，且 undo 会同步状态', () => {
  const runner = createSession({ gameId: 'runner', level: 0, Engine: Runner, createRenderer: () => stubRenderer() });
  assert.equal(runner.hint(), null, 'runner 没有提示能力，应返回 null 而不是抛错');
  assert.equal(runner.undo(), false, 'runner 没有撤销能力，应返回 false');

  const screws = createSession({ gameId: 'screws', level: 0, Engine: Screws, createRenderer: () => stubRenderer() });
  assert.equal(screws.undo(), false, '还没操作时撤销应无效');

  const first = screws.hint();
  assert.ok(Array.isArray(first) && first.length === 2, '螺丝应给出可解的第一步 [片, 孔]');
  assert.ok(screws.engine.available(...first), '提示给出的螺丝必须是当前可拆的，否则提示会误导玩家');
  assert.equal(screws.engine.remove(...first), true, '提示给出的螺丝必须真的能拆下来');
  assert.equal(screws.undo(), true, '操作后应可撤销一次');
  assert.equal(screws.undo(), false, '每关只能撤销一次');
  assert.equal(screws.engine.moves, 0, '撤销后步数应回到操作前');
});

test('会话：螺丝失败结算后撤销，可重新通关且新结算恰好一次', () => {
  let nowMs = 1000;
  const session = createSession({
    gameId: 'screws', level: 2, Engine: Screws,
    createRenderer: () => stubRenderer(), now: () => nowMs,
  });
  // 第三关：分散拆孔会占满槽位，撤回最后一步仍有完整解。
  const failurePath = [[0, 0], [0, 1], [1, 0], [2, 0], [3, 0], [3, 1]];
  for (const move of failurePath) assert.equal(session.engine.remove(...move), true);
  assert.equal(session.status, ENGINE_STATUS.LOST);
  assert.equal(session.engine.slots.length, session.engine.config.capacity);

  nowMs = 2000;
  const failure = session.poll();
  assert.equal(failure.event, 'lose');
  assert.equal(failure.stars, 0);
  assert.equal(failure.durationMs, 1000);
  assert.equal(session.poll(), null, '重复检测不得重复失败结算');

  assert.equal(session.undo(), true);
  assert.equal(session.status, ENGINE_STATUS.PLAYING);
  assert.equal(session.outcome, null, '恢复进行中必须清空已消费的失败结算');
  assert.equal(session.poll(), null, '撤销本身不得产生新结算');
  assert.equal(session.undo(), false, '失败后的撤销也只能使用一次');

  const solution = solveScrews(session.engine);
  assert.ok(solution?.length, '撤回最后一步后必须仍有通关路径');
  for (const move of solution) assert.equal(session.engine.remove(...move), true);
  assert.equal(session.status, ENGINE_STATUS.WON);

  nowMs = 4000;
  const success = session.poll();
  assert.equal(success.event, 'win', '新通关不得被旧的失败结算挡住');
  assert.equal(success.status, ENGINE_STATUS.WON);
  assert.equal(success.stars, 2, '星级应取引擎结果，保留撤销惩罚');
  assert.equal(success.score, session.engine.score);
  assert.equal(success.durationMs, 3000, '撤销不应重置整局时长');
  assert.deepEqual(success.metrics, session.engine.metrics());
  assert.equal(success.metrics.undos, 1);
  assert.equal(session.poll(), null, '重复检测不得重复通关结算');
  const outcome = session.outcome;
  assert.equal(session.undo(), false, '通关之后不得撤销');
  assert.equal(session.outcome, outcome, '无效撤销不得清空有效结算');
  assert.equal(session.poll(), null);
});

test('会话：destroy 调用渲染器清理，且渲染器抛错不影响宿主', () => {
  let destroyed = 0;
  const session = createSession({
    gameId: 'x', level: 0, Engine: Runner,
    createRenderer: () => ({ kind: 'canvas', mount() {}, draw() {}, destroy() { destroyed++; } }),
  });
  session.destroy();
  assert.equal(destroyed, 1);

  const throwing = createSession({
    gameId: 'x', level: 0, Engine: Runner,
    createRenderer: () => ({ kind: 'canvas', mount() {}, draw() {}, destroy() { throw new Error('boom'); } }),
  });
  assert.doesNotThrow(() => throwing.destroy(), '渲染器清理失败不应把宿主一起拖垮');
});

test('会话：缺少必要参数时立刻报错，而不是留下半初始化对象', () => {
  assert.throws(() => createSession({ gameId: 'x', level: 0, Engine: null, createRenderer: () => {} }), /Engine/);
  assert.throws(() => createSession({ gameId: 'x', level: 0, Engine: Runner, createRenderer: null }), /createRenderer/);
});

/** 会话测试用的空渲染器 */
function stubRenderer() {
  return { kind: 'dom', mount() {}, draw() {}, destroy() {} };
}

/* ============================================================ 迁移完整性 */

test('迁移完整性：runner 已完全离开根目录，pins/screws 仍标注为待迁移', async () => {
  const rootEngine = await readFile(join(root, 'engine.mjs'), 'utf8');
  assert.ok(!/class Runner/.test(rootEngine), 'engine.mjs 不应再包含 Runner（已迁至 games/runner/）');
  assert.ok(!/RUNNER_LEVELS/.test(rootEngine), 'engine.mjs 不应再包含 runner 关卡数据');
  assert.ok(/P4/.test(rootEngine), 'engine.mjs 必须写明它只是过渡文件、P4 会删除');

  // art.mjs 已删除
  await assert.rejects(() => readFile(join(root, 'art.mjs'), 'utf8'), /ENOENT/, 'art.mjs 应已删除');

  // 游戏目录结构完整
  for (const file of ['manifest.js', 'engine.js', 'render.js', 'levels.js', 'assets.js']) {
    await readFile(join(root, 'games/runner', file), 'utf8');
  }
});
