/**
 * 模板玩法测试 —— 贡献者提交 PR 前的**最低验证要求**。
 *
 * 现有三个游戏的测试做到了穷举（224 条冲关路线、918 种拉针顺序、6 个棋盘全解），
 * 你的游戏不必到这个程度，但下面四件事必须被证明：
 *   1. 每一关都存在通关路径 —— 否则玩家会卡死在无解关卡上
 *   2. 非法操作无副作用 —— 否则状态被污染，撤销/重试语义崩坏
 *   3. 三星门槛可达 —— 否则三星是永远拿不到的空头承诺（**模板自己踩过这个坑**：
 *      最初填的 target=24/上限5 步、target=45/上限7 步，数学上不可能达到）
 *   4. 分数可由 metrics 里的操作序列重放复现 —— 这是将来服务端反作弊的基础
 *
 * 用法：与模板目录一起复制，修改类名与断言，并登记到 package.json 的测试脚本。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import MyGameEngine from './engine.js';
import LEVELS from './levels.js';
import createRenderer from './render.js';
import manifest from './manifest.js';
import { MESSAGES, dictionaryKeys, t } from './dictionary.js';

/** 每次操作的取值，必须与 engine.js 内的 STEPS 一致 */
const STEPS = [1, 2, 3, 4];

/**
 * 广度优先求「达到 target 的最少步数」及其路径。
 * 用搜索而不是硬编码期望值：贡献者改了关卡数值后，测试会自动适应，
 * 但"是否可达"这件事仍然被严格证明。
 */
function solve(level) {
  const { target } = LEVELS[level];
  const queue = [{ total: 0, path: [] }];
  const seen = new Set([0]);
  while (queue.length) {
    const { total, path } = queue.shift();
    if (total >= target) return path;
    for (let index = 0; index < STEPS.length; index++) {
      const next = total + STEPS[index];
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ total: next, path: [...path, index] });
    }
  }
  return null;
}

function play(level, path) {
  const game = new MyGameEngine(level);
  game.start();
  for (const index of path) {
    assert.equal(game.pick(index), true, `第 ${level + 1} 关的解法中出现了非法操作`);
    if (game.status !== 'playing') break;
  }
  return game;
}

test('模板：每一关都存在通关路径', () => {
  LEVELS.forEach((config, level) => {
    const path = solve(level);
    assert.ok(path, `第 ${level + 1} 关无解`);
    const game = play(level, path);
    assert.equal(game.status, 'won');
    assert.ok(game.total >= config.target);
    assert.ok(game.score > 0);
  });
});

test('模板：非法操作无副作用', () => {
  const game = new MyGameEngine(0);
  assert.equal(game.pick(0), false, '未开始时不可操作');

  game.start();
  const before = { total: game.total, moves: game.moves, picks: game.picks.length };
  assert.equal(game.pick(-1), false);
  assert.equal(game.pick(99), false);
  assert.equal(game.pick(1.5), false);
  assert.equal(game.pick(undefined), false);
  assert.deepEqual({ total: game.total, moves: game.moves, picks: game.picks.length }, before, '非法操作不得改变任何状态');

  game.pick(0);
  game.pick(0);
  assert.equal(game.moves, 2, '合法操作正常计数');
});

test('模板：终局后操作与提示均无效', () => {
  const game = play(0, solve(0));
  assert.equal(game.status, 'won');
  assert.equal(game.pick(3), false);
  const hints = game.hints;
  assert.equal(game.hint(), null);
  assert.equal(game.hints, hints);
});

test('模板：三星门槛可达', () => {
  LEVELS.forEach((config, level) => {
    const path = solve(level);
    assert.ok(path.length <= config.steps, `第 ${level + 1} 关的最优解 ${path.length} 步，超过三星上限 ${config.steps} 步 —— 三星不可达`);
    const game = play(level, path);
    assert.equal(game.stars, 3);
    assert.equal(game.metrics().hints, 0);
  });
});

test('模板：提示降星但不影响通关', () => {
  const game = new MyGameEngine(0);
  game.start();
  game.hint();
  while (game.status === 'playing') game.pick(3);   // 全 +4，3 步内达成 10
  assert.equal(game.status, 'won', '用了提示也必须能通关（解锁不受星级影响）');
  assert.ok(game.stars < 3, '提示应当降星');
});

test('模板：分数可由 metrics 的操作序列重放复现', () => {
  const original = play(1, solve(1));
  const metrics = original.metrics();
  assert.equal(typeof metrics.picks, 'string');
  assert.ok(metrics.picks.length > 0, '操作序列是服务端重放校验的依据，不可缺省');

  const replay = play(1, metrics.picks.split(',').map(Number));
  assert.equal(replay.status, original.status);
  assert.equal(replay.score, original.score);
  assert.equal(replay.stars, original.stars);
  assert.equal(replay.metrics().total, metrics.total);
});

/** 最小 DOM 事件面：保留真实的容器委托、disabled 与节点归属语义，无运行时依赖。 */
class TestHost {
  constructor() {
    this.listeners = new Set();
    this.style = { setProperty() {} };
    this.innerHTML = '';
  }

  set innerHTML(html) {
    this.html = html;
    this.buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => ({
      dataset: { pick: attrs.match(/data-pick="([^"]+)"/)?.[1] },
      disabled: /\bdisabled\b/.test(attrs),
      closest(selector) { return selector === '[data-pick]' ? this : null; },
    }));
  }

  get innerHTML() { return this.html; }
  contains(button) { return this.buttons.includes(button); }
  addEventListener(type, listener) { if (type === 'click') this.listeners.add(listener); }
  removeEventListener(type, listener) { if (type === 'click') this.listeners.delete(listener); }
  click(button) { for (const listener of [...this.listeners]) listener({ target: button }); }
}

test('模板渲染：开局重绘启用按钮，多次重绘仍只向宿主派发一次输入', () => {
  const host = new TestHost(), engine = new MyGameEngine(), renderer = createRenderer();
  const actions = [];
  renderer.mount(host, engine, { dispatch: action => actions.push(action) });
  assert.ok(host.buttons.every(button => button.disabled));
  host.click(host.buttons[3]);
  assert.equal(actions.length, 0, '未开局的按钮不得上报输入');

  engine.start();
  for (let frame = 0; frame < 4; frame++) renderer.draw(engine);
  assert.ok(host.buttons.every(button => !button.disabled));
  assert.equal(host.listeners.size, 1, 'draw 不能重复绑定监听器');
  host.click(host.buttons[3]);
  assert.deepEqual(actions, [{ type: 'pick', args: [3] }]);
  assert.equal(engine.total, 0, '渲染器不能绕过宿主直接操作引擎');
  assert.equal(engine.moves, 0);

  // 模拟宿主推进后重绘，渲染器只读取本次传入的公开状态。
  engine.pick(actions[0].args[0]);
  renderer.draw(engine);
  assert.match(host.innerHTML, /4 \/ 10/);
  assert.match(host.innerHTML, /aria-label="(?:加 4|Add 4)"/);
  while (engine.status === 'playing') engine.pick(3);
  renderer.draw(engine);
  assert.ok(host.buttons.every(button => button.disabled));
  host.click(host.buttons[3]);
  assert.equal(actions.length, 1, '结算后的按钮不得上报输入');
  renderer.destroy();
});

test('模板渲染：重新挂载和销毁完整解绑，不遗留旧宿主回调', () => {
  const firstHost = new TestHost(), secondHost = new TestHost();
  const engine = new MyGameEngine(), renderer = createRenderer(), actions = [];
  engine.start();
  renderer.mount(firstHost, engine, { dispatch: () => actions.push('old') });
  const oldButton = firstHost.buttons[0];
  renderer.mount(secondHost, engine, { dispatch: action => actions.push(action) });
  assert.equal(firstHost.listeners.size, 0);
  assert.equal(firstHost.innerHTML, '');
  firstHost.click(oldButton);
  secondHost.click(secondHost.buttons[1]);
  assert.deepEqual(actions, [{ type: 'pick', args: [1] }]);

  const lastButton = secondHost.buttons[1];
  renderer.destroy();
  renderer.destroy();
  assert.equal(secondHost.listeners.size, 0);
  assert.equal(secondHost.innerHTML, '');
  secondHost.click(lastButton);
  assert.equal(actions.length, 1);
  renderer.draw(engine);
  assert.equal(secondHost.innerHTML, '', '销毁后 draw 不再修改容器');
});

test('模板渲染：忽略其他容器和非法控件的输入', () => {
  const host = new TestHost(), foreignHost = new TestHost();
  const engine = new MyGameEngine(), renderer = createRenderer(), actions = [];
  engine.start();
  const ctx = { dispatch: action => actions.push(action) };
  renderer.mount(host, engine, ctx);
  const foreignRenderer = createRenderer();
  foreignRenderer.mount(foreignHost, engine, ctx);
  host.click(foreignHost.buttons[0]);
  host.click({ closest() { return null; } });
  for (const invalid of ['-1', '4', '1.5', 'abc']) {
    host.buttons[0].dataset.pick = invalid;
    host.click(host.buttons[0]);
  }
  assert.deepEqual(actions, []);
  renderer.destroy();
  foreignRenderer.destroy();
});

test('模板文案：独立语言包键集与占位符一致，正式会话优先用宿主翻译', () => {
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), [...dictionaryKeys].sort());
  for (const key of dictionaryKeys) {
    const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(MESSAGES.en[key]), placeholders(MESSAGES['zh-CN'][key]), key);
  }
  assert.equal(t('game.my-game.intro', { target: 10 }, 'en'), 'Reach a total of 10 to win.');
  assert.equal(t('game.my-game.intro', { target: 10 }, 'unsupported'), '累计达到 10 即可通关。');
  const translate = (key, params) => `${key}:${JSON.stringify(params ?? {})}`;
  const engine = new MyGameEngine(0, { t: translate });
  assert.equal(engine.message, 'game.my-game.intro:{"target":10}');
  const host = new TestHost(), renderer = createRenderer();
  renderer.mount(host, engine, { t: translate });
  assert.ok(host.innerHTML.includes('game.my-game.sceneLabel:{}'));
  renderer.destroy();
});

test('模板 manifest：使用当前宿主契约，关卡数量与文案声明完整', () => {
  assert.equal(manifest.id, new MyGameEngine().gameId);
  assert.equal(manifest.timeDriven, false);
  assert.equal(manifest.levelCount, LEVELS.length);
  for (const key of [manifest.titleKey, manifest.taglineKey, manifest.controlsKey,
    manifest.cardMetaKey, manifest.artLabelKey, ...LEVELS.map(level => level.titleKey)]) {
    assert.ok(dictionaryKeys.includes(key), `模板字典缺少 ${key}`);
  }
});
