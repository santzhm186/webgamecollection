import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createDocument } from './helpers/dom.mjs';
import { createRegistry } from '../src/core/registry.js';
import { createSession } from '../src/core/lifecycle.js';
import * as i18n from '../src/core/i18n.js';
import { BUNDLES } from '../src/locales/index.js';
import * as enums from '../src/core/enums.js';
import * as labels from '../src/core/labels.js';
import { MODULES } from '../games/index.js';
import { screwRenderer, pinRenderer } from '../boards.mjs';
import { solveScrews } from '../engine.mjs';
import templateManifest from '../games/_template/manifest.js';
import { MESSAGES as TEMPLATE_MESSAGES } from '../games/_template/dictionary.js';

/** Execute the actual host, with browser imports injected rather than rewritten
 * behavior. This keeps the test dependency-free and exercises its real event
 * handlers, i18n bindings, registry, session, board renderer and persistence. */
async function boot({ extra = [], saved = null, beforeLoad = async () => {} } = {}) {
  const [html, source, manifests] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.mjs', import.meta.url), 'utf8'),
    Promise.all(MODULES.map(async load => (await load()).default)),
  ]);
  const document = createDocument(html);
  const storage = new Map(saved ? [['wande-dao-progress-v2', JSON.stringify(saved)]] : []);
  const loadCalls = [];
  const pendingLoads = [];
  const errors = [];
  const moduleLoaders = [...manifests, ...extra].map(manifest => async () => ({
    default: Object.fromEntries(Object.entries(manifest).map(([field, value]) => {
      if (!['levels', 'engine', 'renderer', 'assets'].includes(field)) return [field, value];
      return [field, () => {
        const operation = (async () => {
          loadCalls.push(`${manifest.id}.${field}`);
          await beforeLoad(manifest.id, field);
          if (field === 'renderer') {
            if (manifest.id === 'runner') return { default: () => ({ kind: 'canvas', mount() {}, draw() {}, destroy() {} }) };
            if (manifest.id === 'pins') return { default: () => pinRenderer() };
            if (manifest.id === 'screws') return { default: () => screwRenderer() };
          }
          return value();
        })();
        pendingLoads.push(operation);
        return operation;
      }];
    })),
  }));
  const browserI18n = {
    ...i18n,
    initLocale() {
      i18n.setLocale('zh-CN', { persist: false });
      i18n.applyToDocument(document);
      return 'zh-CN';
    },
    setLocale(code) {
      const changed = i18n.setLocale(code, { persist: false });
      i18n.applyToDocument(document);
      return changed;
    },
    applyToDocument: (root = document) => i18n.applyToDocument(root),
    onLocaleChange: () => () => {},
  };
  const imports = {
    './src/core/registry.js': { createRegistry },
    './src/core/lifecycle.js': { createSession },
    './games/index.js': { MODULES: moduleLoaders },
    './src/core/i18n.js': browserI18n,
    './src/locales/index.js': { BUNDLES },
    './src/core/enums.js': enums,
    './src/core/labels.js': labels,
  };
  const window = { devicePixelRatio: 1 };
  const dynamicImports = [];
  const context = vm.createContext({
    __deps: imports,
    __import: async path => {
      dynamicImports.push(path);
      throw new Error(`首页不应动态加载游戏代码: ${path}`);
    },
    document, window,
    console: { warn: () => {}, error: (...args) => errors.push(args), table: () => {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    setTimeout, clearTimeout,
  });
  const executable = source
    .replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm,
      (_, bindings, path) => `const ${bindings.trim()} = __deps[${JSON.stringify(path)}];`)
    .replace(/\bimport\s*\(/g, '__import(');
  await vm.runInContext(`(async () => {\n${executable}\n})()`, context, { filename: 'app.mjs' });
  const waitFor = async predicate => {
    for (let i = 0; i < 1000; i++) {
      if (predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.fail(`宿主异步操作未完成: ${JSON.stringify(errors)}`);
  };
  return {
    document, window, storage, loadCalls, dynamicImports, errors, manifests,
    async open(id) {
      document.querySelector(`#game-grid [data-open="${id}"]`).click();
      await waitFor(() => window.__dsh.state?.gameId === id);
      assert.deepEqual(errors, [], '开局不应产生宿主错误');
      return window.__dsh.session;
    },
    waitFor,
    async settleLoads() {
      await Promise.allSettled(pendingLoads);
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test('宿主：首页只加载 manifest，主 CTA 点击可打开 runner', async () => {
  const host = await boot();
  assert.deepEqual(host.loadCalls, [], '首页不应预加载 levels/engine/renderer/assets');
  assert.deepEqual(host.dynamicImports, [], '首页插画不应 import 游戏渲染器');
  const button = host.document.querySelector('.hero-copy [data-open]');
  // Clicking its nested text tests actual event delegation rather than calling openGame.
  button.querySelector('span').click();
  await host.waitFor(() => host.window.__dsh.state?.gameId === 'runner');
  assert.equal(host.document.querySelector('#game-dialog').open, true);
  assert.equal(host.window.__dsh.state.status, 'ready');
  assert.ok(host.loadCalls.includes('runner.engine'));
  assert.ok(host.loadCalls.every(call => call.startsWith('runner.')), '开局只解析选中的游戏');
  assert.deepEqual(host.errors, []);
});

test('宿主：三款卡片与总进度由各自 manifest 驱动，切换语言不会覆盖它们', async () => {
  const host = await boot({ saved: { pins: [{ stars: 3, score: 100 }] } });
  const assertCards = locale => {
    for (const manifest of host.manifests) {
      const card = host.document.querySelector(`.game-card[data-game="${manifest.id}"]`);
      assert.ok(card, `${manifest.id} 卡片必须存在`);
      const cleared = manifest.id === 'pins' ? 1 : 0;
      assert.equal(card.querySelector('h3').textContent, BUNDLES[locale][manifest.titleKey]);
      assert.equal(card.querySelector('.badge').textContent,
        i18n.t('progress.levels', { n: cleared, total: manifest.levelCount }));
      assert.equal(card.querySelector('.card-body p').textContent, BUNDLES[locale][manifest.taglineKey]);
      if (manifest.preview) {
        const image = card.querySelector('img');
        assert.ok(image, '静态预览应使用图片元素');
        assert.equal(image.getAttribute('src'), manifest.preview);
      }
    }
    assert.equal(host.document.querySelector('#completed-label').textContent,
      i18n.t('progress.completed', { n: 0, total: 3 }).replace(/<[^>]*>/g, ''));
  };
  assertCards('zh-CN');
  const select = host.document.querySelector('#language-select');
  select.value = 'en';
  select.dispatchEvent({ type: 'change', bubbles: true });
  assertCards('en');
  assert.deepEqual(host.loadCalls, [], '换语言也不应加载游戏代码');
});

test('宿主：螺丝失败可撤销，收起失败结果后继续通关并保存新结算', async () => {
  // A real solvable board whose wrong final click fills the buffer. The first
  // two records unlock it through the same saved-progress path used by players.
  const host = await boot({ saved: { screws: [{ stars: 1, score: 1 }, { stars: 1, score: 1 }] } });
  const session = await host.open('screws');
  assert.equal(session.level, 2);
  const clickScrew = ([plate, end]) => {
    const button = host.document.querySelector(`#play-area [data-plate="${plate}"][data-end="${end}"]`);
    assert.ok(button, `螺丝 ${plate}/${end} 按钮必须存在`);
    assert.equal(button.disabled, false, `螺丝 ${plate}/${end} 应可点击`);
    button.click();
  };
  for (const move of [[0, 0], [0, 1], [1, 0], [2, 0], [3, 0], [3, 1]]) clickScrew(move);
  assert.equal(session.status, 'lost');
  assert.equal(host.document.querySelector('#result-panel').hidden, false);
  assert.equal(host.document.querySelector('#undo-button').disabled, false, '失败后仍须保留一次撤销');
  host.document.querySelector('#undo-button').click();
  assert.equal(session.status, 'playing');
  assert.equal(session.outcome, null, '撤销必须清除失败结算，否则后续胜利不会再次结算');
  assert.equal(host.document.querySelector('#result-panel').hidden, true);
  assert.equal(host.document.querySelector('#next-level').hidden, true);
  const solution = solveScrews(session.engine);
  assert.ok(solution?.length, '撤销后仍存在通关路径');
  for (const move of solution) clickScrew(move);
  assert.equal(session.status, 'won');
  assert.equal(session.outcome.status, 'won');
  assert.equal(host.document.querySelector('#result-panel').hidden, false);
  assert.equal(host.document.querySelector('#next-level').hidden, false);
  const saved = JSON.parse(host.storage.get('wande-dao-progress-v2'));
  assert.equal(saved.screws[2].stars, session.engine.stars);
  assert.equal(saved.screws[2].score, session.engine.score);
  assert.ok(saved.screws[2].stars > 0, '失败恢复后的胜利必须解锁下一关');
  assert.equal(host.document.querySelector('#undo-button').disabled, true);
});

test('宿主：模板开始后立即重绘；args 动作通过统一结算与存档', async context => {
  // Mimic the scaffold README's locale-merge step without adding an unreleased
  // example game or its strings to the production index/global language packs.
  const restore = [];
  for (const [locale, messages] of Object.entries(TEMPLATE_MESSAGES)) {
    for (const [key, value] of Object.entries(messages)) {
      const before = BUNDLES[locale][key];
      restore.push(() => {
        if (before === undefined) delete BUNDLES[locale][key];
        else BUNDLES[locale][key] = before;
      });
      BUNDLES[locale][key] = value;
    }
  }
  context.after(() => restore.forEach(callback => callback()));
  const host = await boot({ extra: [templateManifest] });
  const session = await host.open(templateManifest.id);
  const pick = () => host.document.querySelector('#play-area [data-pick="3"]');
  assert.equal(session.status, 'ready');
  assert.equal(pick().disabled, true);
  host.document.querySelector('#start-game').click();
  assert.equal(session.status, 'playing');
  assert.equal(pick().disabled, false, '开始后必须重绘 DOM，解除按钮禁用');
  pick().click();
  assert.equal(session.engine.total, 4, '通用 action.args 应准确传给 pick(index)');
  assert.equal(session.engine.moves, 1, '一次点击只能执行一次，重绘不得累积监听器');
  pick().click();
  assert.equal(session.engine.total, 8);
  assert.equal(session.engine.moves, 2);
  pick().click();
  assert.equal(session.status, 'won');
  assert.equal(session.engine.moves, 3);
  assert.equal(host.document.querySelector('#result-panel').hidden, false);
  const saved = JSON.parse(host.storage.get('wande-dao-progress-v2'));
  assert.equal(saved[templateManifest.id][0].stars, session.engine.stars);
  assert.equal(saved[templateManifest.id][0].score, session.engine.score);
  assert.deepEqual(host.errors, []);
});

test('宿主：异步加载期间关闭窗口，迟到的游戏不得重新挂载', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const host = await boot({ beforeLoad: (id, field) => id === 'runner' && field === 'engine' ? gate : undefined });
  host.document.querySelector('.hero-copy [data-open]').click();
  assert.equal(host.document.querySelector('#game-dialog').open, true);
  assert.equal(host.window.__dsh.session, null, '加载期间不应有旧会话');
  host.document.querySelector('#close-game').click();
  release();
  await host.settleLoads();
  assert.equal(host.document.querySelector('#game-dialog').open, false);
  assert.equal(host.window.__dsh.session, null, '关闭后完成的 loader 不应创建会话');
  assert.equal(host.document.querySelector('#play-area').children.length, 0);
  assert.deepEqual(host.errors, []);
});

test('宿主：较早开局的慢游戏不得覆盖后来已打开的游戏', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const host = await boot({ beforeLoad: (id, field) => id === 'runner' && field === 'engine' ? gate : undefined });
  host.document.querySelector('.hero-copy [data-open]').click();
  const pins = await host.open('pins');
  release();
  await host.settleLoads();
  assert.equal(host.window.__dsh.session, pins);
  assert.equal(host.window.__dsh.state.gameId, 'pins');
  assert.equal(host.document.querySelector('#game-dialog').dataset.game, 'pins');
  assert.deepEqual(host.errors, []);
});
