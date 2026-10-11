import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, Pins, Screws, applyGate, RUNNER_LEVELS, PIN_LEVELS, SCREW_LEVELS, runnerBalance, solveScrews } from '../engine.mjs';

function runRoute(level, bits) {
  const game = new Runner(level); game.start();
  for (let i = 0; i < 600 && game.status === 'playing'; i++) { game.side = (bits >> game.gate) & 1; game.tick(.1); }
  return game;
}
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations(items.filter((_, index) => index !== i)).map(rest => [item, ...rest]));
}
function failurePath(level) {
  const seen = new Set();
  const visit = (history = []) => {
    const game = new Screws(level); history.forEach(([id, end]) => game.remove(id, end));
    if (game.status === 'lost') return history;
    const key = game.plates.map(p => p.removed.map(Number).join('')).join(',');
    if (game.status !== 'playing' || history.length >= 8 || seen.has(key)) return null;
    seen.add(key);
    for (const plate of game.plates) for (let end = 0; end < plate.removed.length; end++) {
      if (!game.available(plate.id, end)) continue;
      const result = visit([...history, [plate.id, end]]); if (result) return result;
    }
    return null;
  };
  return visit();
}

test('gate arithmetic supports addition, multiplication and nonnegative subtraction', () => {
  assert.equal(applyGate(12, ['+', 20]), 32);
  assert.equal(applyGate(12, ['×', 3]), 36);
  assert.equal(applyGate(12, ['−', 15]), 0);
});
test('all 224 runner routes match their balance calculation and terminate', () => {
  RUNNER_LEVELS.forEach((config, level) => {
    let wins = 0, max = 0, threeStars = 0;
    for (let bits = 0; bits < 2 ** config.gates.length; bits++) {
      let expected = config.initial;
      for (let i = 0; i < config.gates.length; i++) {
        const gate = config.gates[i]; expected = Math.max(0, applyGate(expected, gate.choices[(bits >> i) & 1]) - gate.enemy);
        if (!expected) break;
      }
      const game = runRoute(level, bits);
      assert.equal(game.status, expected >= config.boss ? 'won' : 'lost', `level ${level}, route ${bits}`);
      assert.ok(Number.isFinite(game.army) && game.army >= 0);
      if (game.status === 'won') {
        wins++; max = Math.max(max, game.battleInitial); if (game.stars === 3) threeStars++;
        assert.equal(game.army, expected - config.boss); assert.equal(game.bossHealth, 0);
        assert.equal(game.stars, config.stars.filter(value => expected >= value).length);
        assert.ok(game.score > 0);
      }
      const before = game.time; game.tick(.1); assert.equal(game.time, before);
    }
    assert.deepEqual(runnerBalance(level), { routes: 2 ** config.gates.length, winning: wins, max, threeStars });
  });
});
test('runner difficulty tightens progressively, with attainable three-star routes', () => {
  const stats = RUNNER_LEVELS.map((_, i) => runnerBalance(i));
  assert.ok(stats[0].winning / stats[0].routes >= .45);
  assert.ok(stats[1].winning / stats[1].routes < stats[0].winning / stats[0].routes);
  assert.ok(stats[2].winning / stats[2].routes < stats[1].winning / stats[1].routes);
  assert.ok(stats[2].winning / stats[2].routes >= .1);
  stats.forEach((value, i) => { assert.ok(value.threeStars > 0); assert.equal(RUNNER_LEVELS[i].stars[0], RUNNER_LEVELS[i].boss); });
});
test('runner waits for start, clamps delayed frames and ignores invalid time deltas', () => {
  const game = new Runner(); game.tick(10); assert.equal(game.time, 0);
  game.start(); game.tick(10); assert.equal(game.time, .1);
  game.tick(NaN); game.tick(-1); game.tick(Infinity); assert.equal(game.time, .1);
});
test('all pin permutations resolve, and independent hazards allow either safe order', () => {
  PIN_LEVELS.forEach((config, level) => {
    let wins = 0;
    for (const order of permutations(config.pins)) {
      const game = new Pins(level); order.forEach(pin => game.pull(pin));
      assert.notEqual(game.status, 'playing');
      if (game.status === 'won') { wins++; assert.equal(game.stars, 3); assert.equal(game.moves, config.pins.length); }
    }
    assert.equal(wins, config.spider && config.gas ? 2 : 1, `pin level ${level + 1}`);
  });
});
test('pin hints always lead to a safe solution and affect stars without blocking progression', () => {
  PIN_LEVELS.forEach((config, level) => {
    const game = new Pins(level);
    for (let i = 0; i < config.pins.length; i++) { const pin = game.hint(); assert.ok(pin); game.pull(pin); }
    assert.equal(game.status, 'won'); assert.equal(game.stars, 1); assert.equal(game.hints, config.pins.length);
    const hints = game.hints; assert.equal(game.hint(), null); assert.equal(game.hints, hints);
  });
});
test('duplicate, unknown and post-failure pin moves have no effect', () => {
  const game = new Pins(); assert.equal(game.pull('unknown'), false); game.pull('water'); game.pull('water'); assert.equal(game.moves, 1);
  game.pull('treasure'); assert.equal(game.status, 'lost'); game.pull('drain'); assert.equal(game.drained, false);
});
test('all six screw boards have a valid solution, including every three-hole plate', () => {
  SCREW_LEVELS.forEach((_, level) => {
    const game = new Screws(level), solution = solveScrews(game);
    assert.ok(solution?.length);
    assert.equal(solution.length, game.plates.reduce((sum, p) => sum + p.removed.length, 0));
    for (const [id, end] of solution) {
      assert.ok(game.available(id, end)); assert.ok(game.remove(id, end));
      assert.ok(game.slots.length < game.config.capacity || game.status === 'won');
    }
    assert.equal(game.status, 'won'); assert.equal(game.stars, 3); assert.equal(game.slots.length, 0);
  });
});
test('covered and invalid screws cannot be removed', () => {
  let checked = 0;
  SCREW_LEVELS.forEach((_, level) => {
    const game = new Screws(level);
    assert.equal(game.remove(-1, 0), false); assert.equal(game.remove(0, -1), false); assert.equal(game.remove(0, 99), false);
    for (const plate of game.plates) for (let end = 0; end < plate.removed.length; end++) if (!game.available(plate.id, end)) {
      assert.equal(game.remove(plate.id, end), false); assert.equal(plate.removed[end], false); checked++;
    }
  });
  assert.ok(checked > 0);
});
test('clearing a three-hole plate releases slots before the full-buffer failure check', () => {
  const game = new Screws(5), id = game.plates.length - 1;
  assert.equal(game.config.capacity, 3);
  game.remove(id, 0); game.remove(id, 1); assert.equal(game.slots.length, 2);
  game.remove(id, 2); assert.equal(game.status, 'playing'); assert.equal(game.plates[id].fallen, true); assert.equal(game.slots.length, 0);
});
test('undo recovers a full-buffer failure exactly once, without erasing hint penalties', () => {
  let recovered = 0;
  SCREW_LEVELS.forEach((_, level) => {
    const history = failurePath(level); if (!history) return;
    const game = new Screws(level); game.hint();
    history.forEach(([id, end]) => game.remove(id, end)); assert.equal(game.status, 'lost');
    assert.ok(game.undo()); assert.equal(game.status, 'playing'); assert.equal(game.moves, history.length - 1); assert.equal(game.hints, 1);
    assert.equal(game.undos, 1); assert.equal(game.undo(), false); recovered++;
  });
  assert.ok(recovered > 0);
});
test('screw hints select a solvable continuation and terminal wins reject undo', () => {
  SCREW_LEVELS.forEach((_, level) => {
    const game = new Screws(level);
    for (let i = 0; i < 25 && game.status === 'playing'; i++) { const move = game.hint(); assert.ok(move); game.remove(...move); }
    assert.equal(game.status, 'won'); assert.equal(game.stars, 1); assert.equal(game.undo(), false);
  });
});
