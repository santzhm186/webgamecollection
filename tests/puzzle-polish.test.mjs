import test from 'node:test';
import assert from 'node:assert/strict';
import Pins from '../games/pins/engine.js';
import { pinBoard, createRenderer as pinRenderer } from '../games/pins/render.js';
import Screws from '../games/screws/engine.js';
import { screwBoard, createRenderer as screwRenderer } from '../games/screws/render.js';
import WaterSort from '../games/water-sort/engine.js';
import waterRenderer from '../games/water-sort/render.js';
import Warehouse from '../games/warehouse/engine.js';
import warehouseRenderer from '../games/warehouse/render.js';
import { createDocument, Element } from './helpers/dom.mjs';

const t = (key, params = {}) => `${key}:${JSON.stringify(params)}`;
function surface() {
  const document = createDocument('<html><body><div id="host"></div></body></html>');
  const host = document.querySelector('#host');
  host.ownerDocument = document;
  return { document, host };
}

test('puzzle polish: water targets explain legal pours and transfer feedback plays only once', () => {
  const { host } = surface(), game = new WaterSort(0, { t }), renderer = waterRenderer();
  renderer.mount(host, game, { t }); game.start(); game.pick(0); renderer.draw(game);
  assert.ok(host.querySelector('[data-water-tube="2"]').classList.contains('is-available'));
  assert.ok(host.querySelector('[data-water-tube="1"]').classList.contains('is-unavailable'));
  assert.match(host.querySelector('[data-water-tube="1"]').textContent, /tubeFull/);
  game.pick(2); renderer.draw(game);
  assert.ok(host.querySelector('[data-water-tube="0"]').classList.contains('is-pouring'));
  assert.ok(host.querySelector('[data-water-tube="2"]').classList.contains('is-receiving'));
  renderer.draw(game);
  assert.equal(host.querySelector('.is-pouring'), null);
  game.undo(); renderer.draw(game);
  assert.equal(host.querySelector('.is-receiving'), null);
  renderer.destroy();
});

test('puzzle polish: warehouse records displacement, legal directions and immediate deadlock recovery', () => {
  const { host } = surface(), game = new Warehouse(0, { t });
  const renderer = warehouseRenderer({ loadSprite: async () => null });
  const actions = [];
  renderer.mount(host, game, { t, dispatch(action) { actions.push(action); game[action.type](...action.args); renderer.draw(game); } });
  game.start();
  for (const direction of ['down', 'right', 'up']) game.move(direction);
  assert.equal(game.deadlocked, true);
  assert.equal(game.event.type, 'push');
  assert.equal(game.event.from - game.event.to, game.board.width);
  assert.ok(game.boxes.includes(game.event.boxTo));
  renderer.draw(game);
  assert.ok(host.querySelector('.warehouse-recovery'));
  assert.ok(host.querySelector('.warehouse-trapped'));
  assert.equal(host.querySelector('[data-warehouse-move="up"]').disabled, true);
  host.querySelector('[data-warehouse-undo]').click();
  assert.deepEqual(actions, [{ type: 'undo', args: [] }]);
  assert.equal(game.deadlocked, false);
  assert.equal(host.querySelector('.warehouse-recovery'), null);
  renderer.destroy();
});

test('puzzle polish: advanced screw palette stays defined and last bolts have a release marker', () => {
  for (let level = 0; level < 8; level++) assert.doesNotMatch(screwBoard(new Screws(level)), /undefined|NaN/);
  const game = new Screws(0);
  const plate = game.plates.at(-1);
  const end = plate.removed.findIndex((_, index) => game.available(plate.id, index));
  assert.equal(game.remove(plate.id, end), true);
  assert.match(screwBoard(game), /screw-release/);
  assert.match(pinBoard(new Pins(0)), /pin-readout/);
});

test('puzzle polish: redraw preserves screw identity and advances within the same plate after removal', context => {
  const { document, host } = surface();
  const previousFocus = Element.prototype.focus;
  Element.prototype.focus = function () { document.activeElement = this; };
  context.after(() => { if (previousFocus) Element.prototype.focus = previousFocus; else delete Element.prototype.focus; });
  const game = new Screws(0), renderer = screwRenderer();
  renderer.mount(host, game, {});
  const plate = game.plates.at(-1);
  const focus = host.querySelector(`[data-plate="${plate.id}"][data-end="0"]`);
  focus.focus(); renderer.draw(game);
  assert.equal(document.activeElement.dataset.plate, String(plate.id));
  assert.equal(document.activeElement.dataset.end, '0');
  game.remove(plate.id, 0); renderer.draw(game);
  assert.equal(document.activeElement.dataset.plate, String(plate.id));
  assert.equal(document.activeElement.dataset.end, '1');
  renderer.destroy();
});

test('puzzle polish: pin redraw keeps focus on the next available physical pin', context => {
  const { document, host } = surface();
  const previousFocus = Element.prototype.focus;
  Element.prototype.focus = function () { document.activeElement = this; };
  context.after(() => { if (previousFocus) Element.prototype.focus = previousFocus; else delete Element.prototype.focus; });
  const game = new Pins(0), renderer = pinRenderer();
  renderer.mount(host, game, {});
  host.querySelector('[data-pin="water"]').focus();
  game.pull('water'); renderer.draw(game);
  assert.notEqual(document.activeElement.dataset.pin, 'water');
  assert.equal(document.activeElement.disabled, false);
  renderer.destroy();
});

test('puzzle polish: every pin chapter explains its mechanisms before the first move', () => {
  for (let level = 0; level < 8; level++) {
    const game = new Pins(level, { t });
    assert.ok(game.config.introKey);
    assert.match(game.message, new RegExp(game.config.introKey));
    assert.equal(game.moves, 0);
    assert.equal(game.hints, 0, 'Reading the lesson must not cost a star');
  }
});
