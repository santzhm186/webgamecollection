import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, Pins, Screws, applyGate, PIN_LEVELS, SCREW_LEVELS } from '../engine.mjs';

test('gate arithmetic never produces negative troops', () => {
  assert.equal(applyGate(12, ['+', 20]), 32);
  assert.equal(applyGate(12, ['×', 3]), 36);
  assert.equal(applyGate(12, ['−', 15]), 0);
});
function runRoute(choices) {
  const game = new Runner(); game.start();
  for (let i = 0; i < 400 && game.status === 'playing'; i++) { game.side = choices[game.gate] || 0; game.tick(.1); }
  return game;
}
test('runner has winning and losing routes and stops after a result', () => {
  const winner = runRoute([1, 1, 0, 1, 0]);
  assert.equal(winner.status, 'won');
  assert.equal(winner.army, 234);
  const time = winner.time; winner.tick(.1); assert.equal(winner.time, time);
  assert.equal(runRoute([0, 0, 1, 0, 1]).status, 'lost');
});
test('runner waits for start and clamps a delayed frame', () => {
  const game = new Runner(); game.tick(10); assert.equal(game.time, 0);
  game.start(); game.tick(10); assert.equal(game.time, .1);
});
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations(items.filter((_, index) => index !== i)).map(rest => [item, ...rest]));
}
test('each pin puzzle has exactly one safe order; wrong orders fail', () => {
  PIN_LEVELS.forEach((config, level) => {
    let wins = 0;
    for (const order of permutations(config.pins)) {
      const game = new Pins(level); order.forEach(pin => game.pull(pin));
      assert.notEqual(game.status, 'playing');
      if (game.status === 'won') wins++;
    }
    assert.equal(wins, 1, `level ${level + 1} should have one safe solution`);
  });
});
test('pins cannot be pulled twice or after a failure', () => {
  const game = new Pins(); game.pull('water'); game.pull('water'); assert.equal(game.removed.size, 1);
  game.pull('treasure'); assert.equal(game.status, 'lost'); game.pull('drain'); assert.equal(game.drained, false);
});
test('every screw board can be cleared, returning slots as plates fall', () => {
  SCREW_LEVELS.forEach((_, level) => {
    const game = new Screws(level);
    for (let id = game.plates.length - 1; id >= 0; id--) {
      assert.ok(game.available(id, 0)); game.remove(id, 0); assert.equal(game.slots.length, 1);
      assert.ok(game.available(id, 1)); game.remove(id, 1); assert.equal(game.slots.length, 0);
    }
    assert.equal(game.status, 'won');
  });
});
test('covered screws stay in place until the covering plate falls', () => {
  let checked = 0;
  SCREW_LEVELS.forEach((_, level) => {
    const game = new Screws(level);
    for (const plate of game.plates) for (const end of [0, 1]) if (!game.available(plate.id, end)) {
      game.remove(plate.id, end); assert.equal(plate.removed[end], false); checked++;
    }
  });
  assert.ok(checked > 0);
});
test('screw boards allow a full-slot failure and stop accepting moves', () => {
  const visit = (level, history = []) => {
    const game = new Screws(level); history.forEach(([id, end]) => game.remove(id, end));
    if (game.status === 'lost') { const before = JSON.stringify(game); game.remove(0, 1); assert.equal(JSON.stringify(game), before); return true; }
    if (game.status !== 'playing' || history.length >= 4) return false;
    return game.plates.some(plate => [0, 1].some(end => game.available(plate.id, end) && visit(level, [...history, [plate.id, end]])));
  };
  assert.ok(SCREW_LEVELS.some((_, level) => visit(level)), 'at least one puzzle should punish filling the buffer');
});
