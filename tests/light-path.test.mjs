import test from 'node:test';
import assert from 'node:assert/strict';
import LightPath from '../games/light-path/engine.js';
import LEVELS from '../games/light-path/levels.js';
import manifest from '../games/light-path/manifest.js';
import { ports, neighbor, portCount, traceLight, isSolved, solve } from '../games/light-path/rules.js';
import createRenderer from '../games/light-path/render.js';
import { createDocument } from './helpers/dom.mjs';

const t = (key, values = {}) => `${key}:${JSON.stringify(values)}`;
const make = level => new LightPath(level, { t });

test('光路：七道关卡均可解，所有中继连通，重放达到三星目标', () => {
  assert.equal(LEVELS.length, manifest.levelCount);
  const costs = [];
  for (let level = 0; level < LEVELS.length; level++) {
    const game = make(level), before = JSON.stringify(game.config);
    assert.equal(game.status, 'ready');
    assert.equal(game.rotate(1), false);
    game.start();
    const solution = solve(game.config, game.cells);
    assert.ok(solution?.moves.length, `level ${level + 1} starts unsolved and has a route`);
    costs.push(solution.cost);
    for (const index of solution.moves) assert.equal(game.rotate(index), true);
    assert.equal(game.status, 'won'); assert.equal(game.stars, 3);
    assert.ok(game.score > 0); assert.equal(isSolved(game.config, game.cells), true);
    assert.equal(JSON.stringify(game.config), before, 'config is not mutated');
    assert.equal(game.rotate(solution.moves[0]), false);
  }
  assert.deepEqual(costs, [1, 4, 10, 14, 13, 24, 24]);
});

test('光路：路线求解器与入门关卡全部朝向穷举结果一致', () => {
  for (const config of LEVELS.slice(0, 2)) {
    const cells = config.cells.map(cell => ({ ...cell }));
    const mutable = cells.flatMap((cell, index) => !cell.locked && cell.type !== 'block' ? [index] : []);
    let best = Infinity;
    function enumerate(position, cost) {
      if (position === mutable.length) { if (isSolved(config, cells)) best = Math.min(best, cost); return; }
      const index = mutable[position], original = config.cells[index].rotation;
      for (let turns = 0; turns < portCount(cells[index]); turns++) {
        cells[index].rotation = (original + turns) % portCount(cells[index]);
        enumerate(position + 1, cost + turns);
      }
    }
    enumerate(0, 0);
    assert.equal(solve(config).cost, best);
  }
});

test('光路：提示根据当前旋转重新求解，撤销保留提示次数且允许恢复通关', () => {
  const game = make(3); game.start();
  const initial = JSON.stringify(game.cells);
  const index = game.cells.findIndex(cell => !cell.locked && cell.type === 'corner');
  game.rotate(index); game.rotate(index);
  game.hint(); const hints = game.hints;
  assert.ok(Number.isInteger(game.highlight));
  game.undo(); game.undo(); assert.equal(JSON.stringify(game.cells), initial);
  assert.equal(game.hints, hints); assert.equal(game.canUndo(), false);
  const route = solve(game.config, game.cells);
  route.moves.forEach(i => game.rotate(i));
  assert.equal(game.status, 'won'); assert.equal(game.stars, 2, 'hint use caps stars');
  assert.equal(game.undo(), true); assert.equal(game.status, 'playing'); assert.equal(game.stars, 0);
  assert.equal(game.rotate(route.moves.at(-1)), true); assert.equal(game.status, 'won');
});

test('光路：多次无效输入不改变状态，超三星预算仍能通关', () => {
  const game = make(0); game.start();
  for (const invalid of [-1, 1000, NaN, 1.5, '4', null]) {
    const before = JSON.stringify(game);
    assert.equal(game.rotate(invalid), false);
    assert.equal(JSON.stringify(game), before);
  }
  for (const cell of [game.config.source, game.config.beacon, 0]) assert.equal(game.rotate(cell), false);
  const long = make(2); long.start();
  const decoy = 3;
  for (let i = 0; i < 20; i++) long.rotate(decoy);
  solve(long.config, long.cells).moves.forEach(i => long.rotate(i));
  assert.equal(long.status, 'won'); assert.equal(long.stars, 1);
});

test('光路：边界不跨行，孤立中继不能赢，回环终止', () => {
  assert.equal(neighbor(2, 1, 3), -1); assert.equal(neighbor(3, 3, 3), -1);
  assert.deepEqual(ports({ type: 'straight', rotation: 1 }), [1, 3]);
  const config = { width: 3, source: 3, beacon: 5 };
  const cells = Array.from({ length: 9 }, () => ({ type: 'block', rotation: 0 }));
  cells[3] = { type: 'source', rotation: 1 }; cells[4] = { type: 'straight', rotation: 1 }; cells[5] = { type: 'beacon', rotation: 3 };
  cells[1] = { type: 'corner', rotation: 0, checkpoint: true };
  assert.equal(traceLight(config, cells).connected, true); assert.equal(isSolved(config, cells), false); assert.equal(solve(config, cells), null);
});

test('光路：真实渲染按钮派发一次动作，禁用状态明确，销毁释放监听', () => {
  const document = createDocument('<html><body><div id="host"></div><button data-light-cell="4"></button></body></html>');
  const host = document.querySelector('#host'), game = make(0), calls = [];
  const renderer = createRenderer();
  renderer.mount(host, game, { t, dispatch: action => { calls.push(action); game.rotate(...action.args); renderer.draw(game); } });
  assert.equal(host.querySelector('[data-light-cell="4"]').disabled, true);
  game.start(); renderer.draw(game);
  const button = host.querySelector('[data-light-cell="4"]');
  button.click();
  assert.deepEqual(calls, [{ type: 'rotate', args: [4] }]);
  assert.equal(game.status, 'won');
  renderer.destroy(); assert.equal(host.children.length, 0); assert.equal(host.listeners.get('click').size, 0); assert.equal(host.listeners.get('keydown').size, 0);
});

test('光路：方向键跳过锁定格且不冒泡至宿主，不旋转线路', () => {
  const document = createDocument('<html><body><div id="host"></div></body></html>');
  const host = document.querySelector('#host'), game = make(2), calls = [];
  const renderer = createRenderer(); game.start(); renderer.mount(host, game, { t, dispatch: action => calls.push(action) });
  let focused = null, hostKeys = 0;
  document.addEventListener('keydown', () => hostKeys++);
  host.querySelector('[data-light-cell="10"]').focus = () => { focused = 10; };
  const event = { type: 'keydown', key: 'ArrowDown', bubbles: true };
  host.querySelector('[data-light-cell="2"]').dispatchEvent(event);
  assert.equal(focused, 10, 'skip locked straight at index 6');
  assert.equal(hostKeys, 0); assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, []); assert.equal(game.moves, 0);
  renderer.destroy();
});
