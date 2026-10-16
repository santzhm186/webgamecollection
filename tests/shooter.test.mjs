import test from 'node:test';
import assert from 'node:assert/strict';
import Shooter from '../games/shooter/engine.js';
import LEVELS from '../games/shooter/levels.js';
import manifest from '../games/shooter/manifest.js';
import createRenderer from '../games/shooter/render.js';
import { createDocument } from './helpers/dom.mjs';
import { t } from '../src/core/i18n.js';

const context = { t: key => key };

/** A public-state strategy: shoot the oldest side crate, otherwise hold center. */
function play(level, framesPerSecond = 60) {
  const game = new Shooter(level, context); game.start();
  for (let block = 0; block < 140 && game.status === 'playing'; block++) {
    const crate = game.entities.filter(entity => entity.kind === 'crate').sort((a, b) => b.z - a.z)[0];
    game.chooseLane(crate?.lane ?? 1);
    for (let frame = 0; frame < framesPerSecond / 2; frame++) game.tick(1 / framesPerSecond);
  }
  return game;
}

test('shooter: all five campaigns have attainable three-star victories with side upgrades', () => {
  assert.equal(LEVELS.length, manifest.levelCount);
  LEVELS.forEach((config, level) => {
    const game = play(level);
    assert.equal(game.gameId, manifest.id);
    assert.equal(game.status, 'won', `level ${level + 1}`);
    assert.equal(game.stars, 3);
    assert.equal(game.health, 3);
    assert.ok(game.upgrades >= config.starUpgrades);
    assert.ok(game.bossDefeated && game.score > 0);
    assert.equal(game.kills, config.waves.filter(wave => wave.kind !== 'crate').length);
    assert.ok(config.waves.filter(wave => wave.kind === 'crate').every(wave => wave.lane !== 1));
    assert.ok(config.waves.filter(wave => wave.kind !== 'crate').every(wave => wave.lane === 1));
  });
});

test('shooter: fixed steps produce identical routes, health, score and win timing at 10–120 fps', () => {
  for (let level = 0; level < LEVELS.length; level++) {
    const reference = play(level, 60);
    for (const fps of [10, 30, 120]) {
      const game = play(level, fps);
      assert.deepEqual(game.metrics(), reference.metrics(), `level ${level + 1}, ${fps} fps`);
      assert.equal(game.score, reference.score);
      assert.equal(game.stars, reference.stars);
    }
  }
});

test('shooter: stationary basic fire cannot beat the final flagship', () => {
  const game = new Shooter(4, context); game.start();
  for (let i = 0; i < 4200 && game.status === 'playing'; i++) game.tick(1 / 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.upgrades, 0);
  assert.equal(game.bossDefeated, false);
  assert.equal(game.stars, 0);
});

test('shooter: input validation, boundaries, frame clamping and terminal state are inert', () => {
  const game = new Shooter(0, context);
  assert.equal(game.chooseSide(0), false); game.tick(.1); assert.equal(game.frame, 0);
  game.start();
  for (const lane of [-1, 3, 1.2, NaN, '1', null]) assert.equal(game.chooseLane(lane), false);
  for (const side of [-1, 2, '0', null]) assert.equal(game.chooseSide(side), false);
  assert.equal(game.lane, 1); assert.deepEqual(game.trace, []);
  game.chooseSide(0); game.chooseSide(0); assert.equal(game.lane, 0);
  game.chooseSide(1); assert.equal(game.lane, 1);
  for (const dt of [NaN, -1, 0, Infinity]) game.tick(dt);
  assert.equal(game.frame, 0); game.tick(8); assert.equal(game.frame, 6);
  assert.ok(game.pause()); assert.equal(game.pause(), false);
  const paused = game.metrics();
  game.tick(.1); assert.equal(game.chooseLane(2), false); assert.deepEqual(game.metrics(), paused);
  assert.ok(game.resume()); assert.equal(game.resume(), false); game.tick(1 / 60); assert.equal(game.frame, 7);
  const won = play(0), saved = JSON.stringify(won.metrics());
  won.tick(.1); assert.equal(won.chooseLane(2), false); assert.equal(won.start(), false);
  assert.equal(JSON.stringify(won.metrics()), saved);
});

test('shooter: crates grant upgrades only after shooting, and shields absorb a breach', () => {
  const game = new Shooter(0, context); game.start();
  game.entities.push({ kind: 'crate', upgrade: 'rate', lane: 1, z: .86, speed: 0, hp: 2, maxHp: 2, id: 100 });
  game.tick(1 / 60);
  assert.equal(game.entities.find(entity => entity.id === 100).hp, 1);
  assert.equal(game.rate, 0); assert.equal(game.upgrades, 0);
  for (let i = 0; i < 24; i++) game.tick(1 / 60);
  assert.equal(game.rate, 1); assert.equal(game.upgrades, 1);
  game.shield = 1;
  game.entities.push({ kind: 'enemy', lane: 1, z: .9599, speed: .12, hp: 8, id: 101 });
  game.tick(1 / 60);
  assert.equal(game.shield, 0); assert.equal(game.health, 3); assert.equal(game.leaked, 1);
  game.entities.push({ kind: 'enemy', lane: 1, z: .9599, speed: .12, hp: 8, id: 102 });
  game.tick(1 / 60);
  assert.equal(game.health, 2); assert.equal(game.leaked, 2);
});

function withBrowser(run) {
  const previous = Object.fromEntries(['document', 'window', 'ResizeObserver'].map(key => [key, globalThis[key]]));
  const document = createDocument('<html><body><div id="host"></div></body></html>');
  const createElement = document.createElement, observers = [];
  document.createElement = tag => {
    const element = createElement(tag);
    if (tag === 'canvas') {
      const ctx = new Proxy({}, { get(target, key) { if (key in target) return target[key]; if (key === 'createLinearGradient') return () => ({ addColorStop() {} }); return () => {}; } });
      element.getContext = () => ctx;
      element.getBoundingClientRect = () => ({ left: 100, width: 300 });
      element.captured = new Set(); element.setPointerCapture = id => element.captured.add(id); element.releasePointerCapture = id => element.captured.delete(id);
    }
    return element;
  };
  globalThis.document = document; globalThis.window = { devicePixelRatio: 1 };
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } };
  try { run({ host: document.querySelector('#host'), observers }); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
}

test('shooter: accessible buttons and touch dragging dispatch inputs; remount/destroy release listeners', () => {
  withBrowser(({ host, observers }) => {
    const game = new Shooter(0, context), renderer = createRenderer(), actions = [];
    let pauses = 0;
    const ctx = { ...context, dispatch: action => actions.push(action), togglePause: () => pauses++ };
    renderer.mount(host, game, ctx);
    const oldCanvas = host.querySelector('canvas');
    const left = host.querySelector('[data-shooter-side="0"]'), right = host.querySelector('[data-shooter-side="1"]');
    assert.equal(left.tagName, 'BUTTON'); assert.ok(left.getAttribute('aria-label')); assert.ok(left.disabled);
    game.start(); renderer.draw(game); renderer.draw(game);
    left.click(); right.click();
    assert.deepEqual(actions, [{ type: 'chooseSide', args: [0] }, { type: 'chooseSide', args: [1] }]);
    const pointer = (type, props = {}) => oldCanvas.dispatchEvent({ type, pointerId: 8, clientX: 120, button: 0, isPrimary: true, ...props });
    pointer('pointermove'); assert.equal(actions.length, 2);
    pointer('pointerdown'); pointer('pointermove', { clientX: 260 }); pointer('pointermove', { clientX: 380 });
    assert.deepEqual(actions.slice(2), [{ type: 'chooseLane', args: [0] }, { type: 'chooseLane', args: [1] }, { type: 'chooseLane', args: [2] }]);
    assert.equal(game.lane, 1, 'renderer must not mutate the engine');
    assert.ok(oldCanvas.captured.has(8));
    host.querySelector('.runner-pause').click(); assert.equal(pauses, 1);
    game.pause(); renderer.draw(game); renderer.draw(game);
    assert.ok(left.disabled && right.disabled);
    assert.equal(host.querySelector('.runner-pause').disabled, false);
    assert.equal(host.querySelector('.runner-pause').textContent, t('dialog.resume'));
    assert.equal(host.querySelector('.runner-pause').getAttribute('aria-label'), t('dialog.resumeLabel'));
    game.resume(); renderer.draw(game);
    assert.equal(host.querySelector('.runner-pause').textContent, t('dialog.pause'));
    renderer.mount(host, game, ctx);
    assert.equal(oldCanvas.captured.size, 0); assert.ok(observers[0].disconnected);
    const count = actions.length; left.click(); pointer('pointerdown'); assert.equal(actions.length, count);
    renderer.destroy(); assert.ok(observers[1].disconnected); assert.equal(host.innerHTML, '');
  });
});
