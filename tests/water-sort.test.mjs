import test from 'node:test';
import assert from 'node:assert/strict';
import WaterSortEngine from '../games/water-sort/engine.js';
import LEVELS from '../games/water-sort/levels.js';
import { solve, pourAmount } from '../games/water-sort/rules.js';
import createRenderer from '../games/water-sort/render.js';
import manifest from '../games/water-sort/manifest.js';

const translate = (key, params = {}) => `${key}:${JSON.stringify(params)}`;
const createGame = level => new WaterSortEngine(level, { t: translate });
const snapshot = game => JSON.stringify(game);

function play(level, path, hints = 0) {
  const game = createGame(level);
  game.start();
  for (let i = 0; i < hints; i++) game.hint();
  for (const [from, to] of path) assert.equal(game.pour(from, to), true);
  return game;
}

test('彩液分装：六个手工设计关卡颜色守恒，搜索证明最短解与三星可达', () => {
  assert.equal(LEVELS.length, 6);
  const minimums = [];
  LEVELS.forEach((config, level) => {
    const counts = new Map();
    for (const color of config.tubes.flat()) counts.set(color, (counts.get(color) ?? 0) + 1);
    for (const count of counts.values()) assert.equal(count, config.capacity);
    const path = solve(config.tubes, config.capacity);
    assert.ok(path, `Level ${level + 1} has no solution`);
    assert.equal(path.length, config.par);
    minimums.push(path.length);
    assert.ok(path.length <= config.steps);
    const game = play(level, path);
    assert.equal(game.status, 'won');
    assert.equal(game.stars, 3);
    assert.ok(game.score > 0);
    assert.ok(game.tubes.every(tube => tube.length === 0 || (tube.length === 4 && new Set(tube).size === 1)));
    assert.deepEqual([...game.tubes.flat()].sort(), [...config.tubes.flat()].sort());
  });
  assert.deepEqual(minimums, [3, 7, 7, 13, 14, 16]);
});

test('彩液分装：连续顶层会一起倒出，容量限制只转移能容纳的部分', () => {
  assert.equal(pourAmount([[0, 1, 1], [1, 1, 1]], 0, 1), 1);
  assert.equal(pourAmount([[0, 1, 1], []], 0, 1), 2);
  assert.equal(pourAmount([[1, 0, 1], []], 0, 1), 1);
  const game = createGame(0);
  game.start();
  game.pour(0, 2);
  assert.deepEqual(game.tubes, [[0, 0], [1, 1, 0, 0], [1, 1]]);
  assert.equal(game.moves, 1);
});

test('彩液分装：未开始、非法索引、异色、满管与空源操作均无副作用', () => {
  const game = createGame(0);
  const ready = snapshot(game);
  assert.equal(game.pour(0, 2), false);
  assert.equal(game.pick(0), false);
  assert.equal(game.hint(), null);
  assert.equal(game.undo(), false);
  assert.equal(snapshot(game), ready);
  game.start();
  for (const index of [-1, 99, 1.5, undefined, '0', NaN]) {
    const before = snapshot(game);
    assert.equal(game.pick(index), false);
    assert.equal(game.pour(index, 2), false);
    assert.equal(game.pour(0, index), false);
    assert.equal(snapshot(game), before);
  }
  for (const [from, to] of [[0, 0], [0, 1], [2, 0]]) {
    const before = snapshot(game);
    assert.equal(game.pour(from, to), false);
    assert.equal(snapshot(game), before);
  }
  game.pour(0, 2);
  const before = snapshot(game);
  assert.equal(game.pour(1, 2), false);
  assert.equal(snapshot(game), before);
});

test('彩液分装：选中、取消和两次点击倾倒都只通过引擎状态完成', () => {
  const game = createGame(0);
  game.start();
  assert.equal(game.pick(2), false);
  assert.equal(game.pick(0), true);
  assert.equal(game.selected, 0);
  const before = snapshot(game);
  assert.equal(game.pick(1), false);
  assert.equal(snapshot(game), before, 'A mismatched target keeps the chosen source intact');
  assert.equal(game.pick(0), true);
  assert.equal(game.selected, null);
  game.pick(0);
  assert.equal(game.pick(2), true);
  assert.equal(game.moves, 1);
  assert.equal(game.selected, null);
});

test('彩液分装：所有关卡可依靠实时搜索提示通关，提示不改变棋盘且会降星', () => {
  LEVELS.forEach((config, level) => {
    const game = createGame(level);
    game.start();
    for (let step = 0; game.status === 'playing' && step < 40; step++) {
      const before = JSON.stringify(game.tubes), moves = game.moves;
      const pair = game.hint();
      assert.ok(pair);
      assert.equal(JSON.stringify(game.tubes), before);
      assert.equal(game.moves, moves);
      assert.deepEqual(game.highlight, pair);
      assert.equal(game.pour(...pair), true);
    }
    assert.equal(game.status, 'won');
    assert.equal(game.stars, 2);
  });
});

test('彩液分装：撤销从完成状态恢复，支持多次撤销并保留提示使用记录', () => {
  const path = solve(LEVELS[2].tubes);
  const game = play(2, path, 1);
  assert.equal(game.canUndo(), true);
  assert.equal(game.undo(), true);
  assert.equal(game.status, 'playing');
  assert.equal(game.stars, 0);
  assert.equal(game.score, 0);
  assert.equal(game.hints, 1);
  assert.equal(game.moves, path.length - 1);
  assert.equal(game.pour(...path.at(-1)), true);
  assert.equal(game.status, 'won');
  for (let index = 0; index < path.length; index++) assert.equal(game.undo(), true);
  assert.deepEqual(game.tubes, LEVELS[2].tubes);
  assert.equal(game.moves, 0);
  assert.equal(game.metrics().pours, '');
  assert.equal(game.canUndo(), false);
  assert.equal(game.undo(), false);
});

test('彩液分装：结算后点击与提示无效，操作序列可重放分数', () => {
  const game = play(5, solve(LEVELS[5].tubes), 1);
  const before = snapshot(game);
  assert.equal(game.pick(0), false);
  assert.equal(game.pour(0, 1), false);
  assert.equal(game.hint(), null);
  assert.equal(snapshot(game), before);
  const metrics = game.metrics();
  const replay = play(5, metrics.pours.split(',').map(move => move.split('>').map(Number)), metrics.hints);
  assert.equal(replay.status, 'won');
  assert.equal(replay.score, game.score);
  assert.equal(replay.stars, game.stars);
  assert.deepEqual(replay.metrics(), metrics);
});

test('彩液分装：无解状态的提示不计费、不移动液体且可撤销恢复', () => {
  const game = createGame(0);
  game.start();
  game.pour(0, 2);
  // A full mixed arrangement has no legal move, so search must terminate honestly.
  game.tubes = [[0, 1, 0, 1], [1, 0, 1, 0]];
  const before = JSON.stringify(game.tubes);
  assert.equal(game.hint(), null);
  assert.equal(game.hints, 0);
  assert.equal(JSON.stringify(game.tubes), before);
  assert.ok(game.message.includes('game.water-sort.noRoute'));
  assert.equal(game.undo(), true);
  assert.deepEqual(game.tubes, LEVELS[0].tubes);
});

class TestHost {
  constructor() { this.listeners = new Set(); this.innerHTML = ''; }
  set innerHTML(html) {
    this.html = html;
    this.buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(([, attrs]) => ({
      dataset: { waterTube: attrs.match(/data-water-tube="([^"]+)"/)?.[1], tubeCount: attrs.match(/data-tube-count="([^"]+)"/)?.[1] },
      disabled: /\bdisabled\b/.test(attrs),
      closest(selector) { return selector === '[data-water-tube]' ? this : null; },
    }));
  }
  get innerHTML() { return this.html; }
  contains(button) { return this.buttons.includes(button); }
  addEventListener(type, fn) { if (type === 'click') this.listeners.add(fn); }
  removeEventListener(type, fn) { if (type === 'click') this.listeners.delete(fn); }
  click(button) { this.listeners.forEach(fn => fn({ target: button })); }
}

test('彩液分装渲染：可访问原生按钮、唯一委托、只向宿主派发、完整解绑', () => {
  const host = new TestHost(), nextHost = new TestHost(), engine = createGame(5), renderer = createRenderer(), actions = [];
  const ctx = { t: translate, dispatch: action => actions.push(action) };
  renderer.mount(host, engine, ctx);
  assert.equal(host.buttons.length, 7);
  assert.ok(host.buttons.every(button => button.disabled));
  host.click(host.buttons[0]);
  assert.equal(actions.length, 0);
  engine.start();
  for (let i = 0; i < 5; i++) renderer.draw(engine);
  assert.equal(host.listeners.size, 1);
  assert.ok(host.buttons.every(button => !button.disabled));
  assert.match(host.innerHTML, /aria-pressed="false"/);
  assert.match(host.innerHTML, /aria-label="game.water-sort.tubeLabel/);
  host.click(host.buttons[0]);
  assert.deepEqual(actions, [{ type: 'pick', args: [0] }]);
  assert.equal(engine.selected, null);
  assert.equal(engine.moves, 0);
  engine.pick(0);
  renderer.draw(engine);
  assert.match(host.innerHTML, /is-selected/);
  renderer.mount(nextHost, engine, ctx);
  assert.equal(host.listeners.size, 0);
  assert.equal(host.innerHTML, '');
  const lastButton = nextHost.buttons[0];
  renderer.destroy();
  renderer.destroy();
  nextHost.click(lastButton);
  assert.equal(nextHost.listeners.size, 0);
  assert.equal(nextHost.innerHTML, '');
  assert.equal(actions.length, 1);
});

test('彩液分装渲染：外国容器和非法试管索引不派发动作', () => {
  const host = new TestHost(), foreign = new TestHost(), engine = createGame(0), renderer = createRenderer(), other = createRenderer(), actions = [];
  const ctx = { t: translate, dispatch: action => actions.push(action) };
  engine.start();
  renderer.mount(host, engine, ctx);
  other.mount(foreign, engine, ctx);
  host.click(foreign.buttons[0]);
  for (const index of ['-1', '3', 'NaN', '0.1']) {
    host.buttons[0].dataset.waterTube = index;
    host.click(host.buttons[0]);
  }
  assert.deepEqual(actions, []);
  renderer.destroy();
  other.destroy();
});

test('彩液分装：懒加载入口数量正确、无需逐帧计时、辅助目标由引擎提供', async () => {
  assert.equal(manifest.id, createGame(0).gameId);
  assert.equal(manifest.levelCount, LEVELS.length);
  assert.equal(manifest.timeDriven, false);
  assert.equal((await manifest.engine()).default, WaterSortEngine);
  assert.equal((await manifest.renderer()).default, createRenderer);
  assert.equal((await manifest.levels()).default, LEVELS);
  assert.equal(createGame(5).assistGoal(), 'game.water-sort.target:{"n":18}');
});
