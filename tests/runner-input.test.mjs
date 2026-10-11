import test from 'node:test';
import assert from 'node:assert/strict';
import Runner from '../games/runner/engine.js';
import createRenderer from '../games/runner/render.js';
import { createDocument } from './helpers/dom.mjs';

/** Exercise the real renderer against DOM events; Canvas drawing is a no-op. */
function withBrowser(run) {
  const previous = Object.fromEntries(['document', 'window', 'ResizeObserver'].map(key => [key, globalThis[key]]));
  const document = createDocument('<html><body><div id="host"></div></body></html>');
  const createElement = document.createElement;
  const observers = [];
  document.createElement = tag => {
    const element = createElement(tag);
    if (tag === 'canvas') {
      const context = new Proxy({}, {
        get(target, key) {
          if (key in target) return target[key];
          if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
          return () => {};
        },
      });
      element.getContext = () => context;
      element.getBoundingClientRect = () => ({ left: 100, width: 240, top: 0, height: 210 });
      element.captured = new Set();
      element.setPointerCapture = id => element.captured.add(id);
      element.releasePointerCapture = id => element.captured.delete(id);
    }
    return element;
  };
  globalThis.document = document;
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  try { run({ document, host: document.querySelector('#host'), observers }); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('runner 选门：只接受进行中跑道阶段的合法左右输入', () => {
  const engine = new Runner();
  assert.equal(engine.chooseSide(1), false);
  assert.equal(engine.side, 0);
  engine.start();
  for (const side of [-1, 2, 0.5, '1', null, undefined]) assert.equal(engine.chooseSide(side), false);
  assert.equal(engine.side, 0);
  assert.equal(engine.chooseSide(1), true);
  assert.equal(engine.side, 1);
  engine.phase = 'boss';
  assert.equal(engine.chooseSide(0), false);
  engine.phase = 'run';
  engine.status = 'won';
  assert.equal(engine.chooseSide(0), false);
  assert.equal(engine.side, 1);
});

test('runner 渲染输入：原生左右按钮经宿主派发，重复重绘不重复监听', () => {
  withBrowser(({ host }) => {
    const engine = new Runner(), renderer = createRenderer(), actions = [];
    renderer.mount(host, engine, { dispatch: action => actions.push(action) });
    const left = host.querySelector('[data-runner-side="0"]');
    const right = host.querySelector('[data-runner-side="1"]');
    assert.equal(left.tagName, 'BUTTON', '原生按钮提供 Enter/Space 激活');
    assert.equal(right.getAttribute('type'), 'button');
    assert.ok(left.getAttribute('aria-label'));
    assert.ok(right.getAttribute('aria-label'));
    assert.equal(right.disabled, true);
    right.click();
    assert.deepEqual(actions, []);
    engine.start();
    for (let i = 0; i < 4; i++) renderer.draw(engine);
    right.click();
    assert.deepEqual(actions, [{ type: 'chooseSide', args: [1] }]);
    assert.equal(engine.side, 0, '渲染器不得绕过宿主直接改变引擎');
    engine.chooseSide(actions[0].args[0]);
    renderer.draw(engine);
    assert.equal(right.getAttribute('aria-pressed'), 'true');
    assert.equal(left.getAttribute('aria-pressed'), 'false');
    left.click();
    assert.equal(actions.length, 2);
    assert.deepEqual(actions[1], { type: 'chooseSide', args: [0] });
    engine.phase = 'boss';
    renderer.draw(engine);
    left.click();
    assert.equal(actions.length, 2);
    renderer.destroy();
  });
});

test('runner 渲染输入：点击与触摸拖动按画布实际尺寸选择左右，忽略悬停和其他指针', () => {
  withBrowser(({ host }) => {
    const engine = new Runner(), renderer = createRenderer(), actions = [];
    engine.start();
    engine.chooseSide(1);
    renderer.mount(host, engine, { dispatch: action => actions.push(action) });
    const canvas = host.querySelector('canvas');
    const pointer = (type, values = {}) => canvas.dispatchEvent({
      type, clientX: 150, pointerId: 7, isPrimary: true, button: 0, pointerType: 'mouse', ...values,
    });
    assert.equal(canvas.style.touchAction, 'none');
    pointer('pointermove');
    pointer('pointerdown', { button: 2 });
    pointer('pointerdown', { isPrimary: false });
    assert.deepEqual(actions, []);
    pointer('pointerdown');
    assert.deepEqual(actions, [{ type: 'chooseSide', args: [0] }]);
    assert.equal(engine.side, 1, '指针输入也必须经过宿主');
    assert.ok(canvas.captured.has(7));
    pointer('pointermove', { clientX: 300, pointerId: 8 });
    assert.equal(actions.length, 1);
    pointer('pointermove', { clientX: 300 });
    assert.deepEqual(actions[1], { type: 'chooseSide', args: [1] });
    pointer('pointerup');
    assert.equal(canvas.captured.size, 0);
    pointer('pointermove');
    assert.equal(actions.length, 2);
    pointer('pointerdown', { pointerType: 'touch', clientX: 300, pointerId: 9 });
    assert.deepEqual(actions[2], { type: 'chooseSide', args: [1] });
    pointer('pointercancel', { pointerId: 9 });
    assert.equal(canvas.captured.size, 0);
    pointer('pointermove', { pointerId: 9 });
    assert.equal(actions.length, 3);
    renderer.destroy();
  });
});

test('runner 渲染输入：暂停按钮调用宿主，重挂载与销毁释放全部输入和观察器', () => {
  withBrowser(({ document, host, observers }) => {
    const engine = new Runner(), renderer = createRenderer();
    const actions = [];
    let pauses = 0;
    const ctx = { dispatch: action => actions.push(action), togglePause: () => pauses++ };
    renderer.mount(host, engine, ctx);
    let pause = host.querySelector('.runner-pause');
    assert.equal(pause.disabled, true);
    pause.click();
    assert.equal(pauses, 0);
    engine.start();
    renderer.draw(engine);
    pause.click();
    assert.equal(pauses, 1);
    const oldCanvas = host.querySelector('canvas');
    const oldRight = host.querySelector('[data-runner-side="1"]');
    oldCanvas.dispatchEvent({ type: 'pointerdown', pointerId: 5, clientX: 150, button: 0 });
    assert.ok(oldCanvas.captured.has(5));
    const nextHost = document.createElement('div');
    renderer.mount(nextHost, engine, ctx);
    assert.equal(oldCanvas.captured.size, 0);
    assert.ok(observers[0].disconnected);
    const count = actions.length;
    oldRight.click();
    pause.click();
    oldCanvas.dispatchEvent({ type: 'pointerdown', pointerId: 5, clientX: 150, button: 0 });
    assert.equal(actions.length, count);
    assert.equal(pauses, 1);
    pause = nextHost.querySelector('.runner-pause');
    const right = nextHost.querySelector('[data-runner-side="1"]');
    pause.click();
    right.click();
    assert.equal(pauses, 2);
    assert.equal(actions.length, count + 1);
    renderer.destroy();
    renderer.destroy();
    pause.click();
    right.click();
    assert.equal(pauses, 2);
    assert.equal(actions.length, count + 1);
    assert.ok(observers.every(observer => observer.disconnected));
    assert.equal(nextHost.children.length, 0);
  });
});
