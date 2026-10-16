import test from 'node:test';
import assert from 'node:assert/strict';
import Warehouse from '../games/warehouse/engine.js';
import LEVELS from '../games/warehouse/levels.js';
import manifest from '../games/warehouse/manifest.js';
import { parseBoard, solveBoard } from '../games/warehouse/board.js';
import createRenderer from '../games/warehouse/render.js';
import { createDocument } from './helpers/dom.mjs';

/** Independent BFS, without the production transition/dead-square code. */
function solve(map) {
  const width = map[0].length, flat = map.join('');
  const goals = [...flat].flatMap((cell, i) => cell === '.' ? [i] : []);
  const boxes = [...flat].flatMap((cell, i) => cell === '$' ? [i] : []);
  const player = flat.indexOf('@');
  const queue = [{ player, boxes, path: [] }], seen = new Set();
  const directions = { up: -width, right: 1, down: width, left: -1 };
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (node.boxes.every(box => goals.includes(box))) return node.path;
    for (const [direction, offset] of Object.entries(directions)) {
      const next = node.player + offset;
      if (flat[next] === '#' || flat[next] === undefined) continue;
      const cargo = node.boxes.slice();
      const slot = cargo.indexOf(next);
      if (slot !== -1) {
        const beyond = next + offset;
        if (flat[beyond] === '#' || flat[beyond] === undefined || cargo.includes(beyond)) continue;
        cargo[slot] = beyond;
        cargo.sort((a, b) => a - b);
      }
      const id = `${next}:${cargo.join(',')}`;
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push({ player: next, boxes: cargo, path: [...node.path, direction] });
    }
  }
  return null;
}

const solutions = LEVELS.map(level => solve(level.map));
function play(level, path = solutions[level]) {
  const engine = new Warehouse(level, { t: (key, params = {}) => `${key}:${JSON.stringify(params)}` });
  engine.start();
  for (const direction of path) assert.equal(engine.move(direction), true);
  return engine;
}
function state(engine) {
  return JSON.stringify({ player: engine.player, boxes: engine.boxes, status: engine.status, message: engine.message,
    moves: engine.moves, pushes: engine.pushes, hints: engine.hints, stars: engine.stars, score: engine.score,
    route: engine.route, history: engine.history, direction: engine.direction, hintDirection: engine.hintDirection, event: engine.event });
}

test('warehouse: all six authored levels have an independently proven three-star solution', () => {
  assert.equal(LEVELS.length, 6);
  assert.deepEqual(solutions.map(path => path.length), [2, 5, 7, 15, 17, 23]);
  LEVELS.forEach((level, index) => {
    assert.ok(solutions[index].length <= level.steps);
    const game = play(index);
    assert.equal(game.status, 'won');
    assert.equal(game.stars, 3);
    assert.ok(game.score > 0);
    assert.equal(game.docked, game.boxes.length);
    assert.equal(solveBoard(parseBoard(level.map)).length, solutions[index].length);
  });
});

test('warehouse: invalid, blocked, ready and terminal actions have no side effects', () => {
  const game = new Warehouse();
  let before = state(game);
  assert.equal(game.move('right'), false);
  assert.equal(game.undo(), false);
  assert.equal(game.hint(), null);
  assert.equal(state(game), before);
  game.start();
  for (const value of ['diagonal', '__proto__', null, undefined, 1, {}, []]) {
    before = state(game);
    assert.equal(game.move(value), false);
    assert.equal(state(game), before);
  }
  game.move('up');
  before = state(game);
  assert.equal(game.move('up'), false);
  assert.equal(state(game), before);
  const won = play(0);
  before = state(won);
  assert.equal(won.move('left'), false);
  assert.equal(won.hint(), null);
  assert.equal(won.start(), false);
  assert.equal(state(won), before);
});

test('warehouse: undo restores every move including victory and preserves hint penalties', () => {
  const game = play(3);
  while (game.canUndo()) assert.equal(game.undo(), true);
  assert.equal(game.moves, 0);
  assert.equal(game.pushes, 0);
  assert.equal(game.player, game.board.player);
  assert.deepEqual(game.boxes, game.board.boxes);
  assert.deepEqual(game.route, []);
  assert.equal(game.status, 'playing');
  assert.equal(game.undo(), false);
  const hint = game.hint();
  assert.equal(hint, solutions[3][0]);
  game.move(hint);
  game.undo();
  assert.equal(game.hints, 1);
  for (const direction of solutions[3]) game.move(direction);
  assert.equal(game.stars, 2);
});

test('warehouse: corner warnings remain recoverable; hints solve the current position', () => {
  const game = play(0, ['down', 'right', 'up']);
  assert.equal(game.deadlocked, true);
  assert.match(game.message, /deadlock/);
  assert.equal(game.hint(), null);
  assert.equal(game.hints, 0);
  assert.equal(game.undo(), true);
  assert.equal(game.deadlocked, false);
  const hint = game.hint();
  assert.ok(hint);
  assert.equal(game.move(hint), true);
  let guard = 30;
  while (game.status === 'playing' && guard-- > 0) assert.equal(game.move(game.hint()), true);
  assert.equal(game.status, 'won');
});

test('warehouse: recorded routes reproduce board, score, and star rating', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    const original = play(level);
    const replay = play(level, original.metrics().route.split(','));
    assert.deepEqual(replay.metrics(), original.metrics());
    assert.equal(replay.score, original.score);
    assert.equal(replay.stars, original.stars);
  }
  assert.equal(manifest.id, new Warehouse().gameId);
  assert.equal(manifest.levelCount, LEVELS.length);
  assert.equal(manifest.timeDriven, false);
});

function withDom(run) {
  const old = globalThis.document;
  const document = createDocument('<html><body><div id="host"></div><input id="input"></body></html>');
  globalThis.document = document;
  try { run({ document, host: document.querySelector('#host') }); }
  finally { if (old === undefined) delete globalThis.document; else globalThis.document = old; }
}

test('warehouse renderer: direction buttons and arrow/WASD keys dispatch through host only', () => withDom(({ document, host }) => {
  const game = new Warehouse(), renderer = createRenderer(), actions = [];
  renderer.mount(host, game, { dispatch: action => actions.push(action) });
  assert.match(host.innerHTML, /<svg/);
  assert.equal(host.querySelector('[data-warehouse-move="right"]').disabled, true);
  host.querySelector('[data-warehouse-move="right"]').click();
  document.dispatchEvent({ type: 'keydown', key: 'ArrowRight' });
  assert.deepEqual(actions, []);
  game.start();
  for (let i = 0; i < 5; i++) renderer.draw(game);
  host.querySelector('[data-warehouse-move="right"]').click();
  document.dispatchEvent({ type: 'keydown', key: 'W' });
  document.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
  document.dispatchEvent({ type: 'keydown', key: 'a' });
  assert.deepEqual(actions.map(action => action.args[0]), ['right', 'up', 'down', 'left']);
  assert.ok(actions.every(action => action.type === 'move'));
  assert.equal(game.moves, 0);
  document.dispatchEvent({ type: 'keydown', key: 'w', target: document.querySelector('#input') });
  document.dispatchEvent({ type: 'keydown', key: 'w', ctrlKey: true });
  document.dispatchEvent({ type: 'keydown', key: 'Enter' });
  assert.equal(actions.length, 4);
  renderer.destroy();
}));

test('warehouse renderer: remount and destroy clean document and delegated listeners', () => withDom(({ document, host }) => {
  const game = new Warehouse(), renderer = createRenderer(), actions = [];
  game.start();
  renderer.mount(host, game, { dispatch: action => actions.push(action) });
  const old = host.querySelector('[data-warehouse-move="up"]');
  const nextHost = document.createElement('div');
  renderer.mount(nextHost, game, { dispatch: action => actions.push(action) });
  old.click();
  assert.equal(actions.length, 0);
  assert.equal(host.innerHTML, '');
  document.dispatchEvent({ type: 'keydown', key: 'w' });
  assert.equal(actions.length, 1);
  const next = nextHost.querySelector('[data-warehouse-move="up"]');
  renderer.destroy();
  renderer.destroy();
  document.dispatchEvent({ type: 'keydown', key: 'w' });
  next.click();
  renderer.draw(game);
  assert.equal(actions.length, 1);
  assert.equal(nextHost.innerHTML, '');
}));

const flushSprites = () => new Promise(resolve => setImmediate(resolve));
function spriteHost() {
  const document = createDocument('<html><body><div id="host"></div></body></html>');
  const host = document.querySelector('#host');
  host.ownerDocument = document;
  return host;
}

test('warehouse 3D: asynchronous sprites redraw the latest board and preserve cardinal facing', async () => {
  const requests = [], host = spriteHost();
  const renderer = createRenderer({ loadSprite: (id, color, size, yaw) => new Promise(resolve => requests.push({ id, color, size, yaw, resolve })) });
  renderer.mount(host, new Warehouse(0));
  await flushSprites();
  assert.equal(requests.length, 5);
  assert.deepEqual(requests.filter(request => request.id === 'cargo-bot').map(request => request.yaw), [Math.PI, -Math.PI / 2, 0, Math.PI / 2]);
  const latest = new Warehouse(5);
  latest.start();
  latest.move('left');
  const before = state(latest);
  renderer.draw(latest);
  for (const request of requests) request.resolve({ src: `sprite:${request.id}:${request.yaw}` });
  await flushSprites();
  assert.equal(state(latest), before, 'Asset loading must never advance game logic');
  assert.match(host.innerHTML, /sprite:cargo-crate:0/);
  const yaw = { up: Math.PI, left: -Math.PI / 2, down: 0, right: Math.PI / 2 }[latest.direction];
  assert.ok(host.innerHTML.includes(`sprite:cargo-bot:${yaw}`));
  assert.equal(host.querySelectorAll('[data-warehouse-move]').length, 4);
  renderer.destroy();
});

test('warehouse 3D: late work from previous mounts or destroyed boards cannot overwrite the scene', async () => {
  const requests = [], first = spriteHost(), second = spriteHost();
  const renderer = createRenderer({ loadSprite: () => new Promise(resolve => requests.push(resolve)) });
  renderer.mount(first, new Warehouse(0));
  await flushSprites();
  renderer.mount(second, new Warehouse(2));
  await flushSprites();
  assert.equal(requests.length, 10);
  const before = second.innerHTML;
  requests.slice(0, 5).forEach(resolve => resolve({ src: 'sprite:old-mount' }));
  await flushSprites();
  assert.equal(first.innerHTML, '');
  assert.equal(second.innerHTML, before);
  renderer.destroy();
  requests.slice(5).forEach(resolve => resolve({ src: 'sprite:destroyed-mount' }));
  await flushSprites();
  assert.equal(second.innerHTML, '');
});

test('warehouse 3D: explicit art overrides take priority, failures keep working vector graphics', async () => {
  const host = spriteHost(), art = Object.freeze({ bot: 'sprite:custom-bot', crate: 'sprite:custom-crate' });
  let requests = 0;
  const renderer = createRenderer({ loadSprite: () => { requests++; return Promise.reject(new Error('GPU unavailable')); } });
  renderer.mount(host, new Warehouse(0), { art: { warehouse: art } });
  await flushSprites();
  assert.equal(requests, 0);
  assert.match(host.innerHTML, /sprite:custom-bot/);
  assert.match(host.innerHTML, /sprite:custom-crate/);
  renderer.mount(host, new Warehouse(0));
  await flushSprites();
  assert.equal(requests, 5);
  assert.match(host.innerHTML, /<svg/);
  assert.doesNotMatch(host.innerHTML, /<image/);
  renderer.destroy();
});
