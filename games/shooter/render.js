import { t } from '../../src/core/host-surface.js';
import { rounded, label, polygon, verticalGradient } from '../../src/ui/scene/primitives.js';
import { getAssetSprite } from '../../src/ui/scene/three-models.js';

const WIDTH = 480, HEIGHT = 420;
const UPGRADE_COLORS = { spread: '#b9f48c', rate: '#ffd073', shield: '#80dcef' };
const project = (x, z) => ({ x: 240 + (x - 1) * (56 + z * 105), y: 102 + z * 282, scale: .48 + z * .72 });

function craft(ctx, x, y, scale, enemy = false, boss = false, sprite = null) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = '#071c3666'; ctx.beginPath(); ctx.ellipse(0, 10, boss ? 47 : 25, 9, 0, 0, Math.PI * 2); ctx.fill();
  if (sprite) {
    const size = boss ? 145 : enemy ? 92 : 99;
    ctx.drawImage(sprite, -size / 2, -size * .62, size, size);
    ctx.restore(); return;
  }
  const color = enemy ? '#df667f' : '#8fe6e5';
  const wing = boss ? 55 : 30;
  polygon(ctx, [[0, -27], [12, -4], [wing, 9], [wing - 4, 19], [10, 12], [0, 21], [-10, 12], [-wing + 4, 19], [-wing, 9], [-12, -4]], color, enemy ? '#a43960' : '#3d9eb8');
  polygon(ctx, [[0, -17], [7, 1], [0, 10], [-7, 1]], '#153b58', '#d1fcf1');
  rounded(ctx, -4, 17, 8, 12, 3, enemy ? '#ffb278' : '#6aaaff');
  if (boss) { rounded(ctx, -39, -5, 11, 20, 3, '#873b60'); rounded(ctx, 28, -5, 11, 20, 3, '#873b60'); }
  ctx.restore();
}

function crate(ctx, entity, point, sprite = null) {
  const color = UPGRADE_COLORS[entity.upgrade];
  const size = 22 * point.scale;
  ctx.save(); ctx.translate(point.x, point.y);
  if (sprite) ctx.drawImage(sprite, -size * 1.7, -size * 1.8, size * 3.4, size * 3.4);
  else {
  polygon(ctx, [[-size, -size], [size, -size], [size + 7, -size - 7], [-size + 7, -size - 7]], '#d9edce');
  polygon(ctx, [[size, -size], [size + 7, -size - 7], [size + 7, size - 7], [size, size]], '#456974');
  rounded(ctx, -size, -size, size * 2, size * 2, 4, '#193c51', color);
  }
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
  if (entity.upgrade === 'spread') { ctx.moveTo(-11, 7); ctx.lineTo(-6, -8); ctx.moveTo(0, 7); ctx.lineTo(0, -9); ctx.moveTo(11, 7); ctx.lineTo(6, -8); }
  else if (entity.upgrade === 'rate') { ctx.moveTo(3, -12); ctx.lineTo(-7, 1); ctx.lineTo(3, 1); ctx.lineTo(-3, 12); }
  else { ctx.moveTo(-10, -8); ctx.lineTo(0, -12); ctx.lineTo(10, -8); ctx.lineTo(8, 5); ctx.lineTo(0, 12); ctx.lineTo(-8, 5); ctx.closePath(); }
  ctx.stroke();
  rounded(ctx, -35, size + 4, 70, 18, 6, '#102e49e6');
  label(ctx, `${t(`game.shooter.${entity.upgrade}`)} · ${entity.hp}`, 0, size + 17, 9, color);
  ctx.restore();
}

export function drawScene(ctx, engine, reducedMotion = false, sprites = {}) {
  const sky = engine.config.sky;
  ctx.fillStyle = verticalGradient(ctx, 0, HEIGHT, [[0, sky[0]], [.6, sky[1]], [1, '#102e44']]); ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#ffffff0d';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(35 + i * 76, 80 + i % 3 * 36, 54, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  polygon(ctx, [[157, 96], [323, 96], [478, 420], [2, 420]], '#163346aa');
  for (const lane of [-.5, .5, 1.5, 2.5]) {
    const far = project(lane, 0), near = project(lane, 1.15);
    ctx.strokeStyle = lane === -.5 || lane === 2.5 ? '#73d6d888' : '#a5e0e833'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(far.x, far.y); ctx.lineTo(near.x, near.y); ctx.stroke();
  }
  const shift = reducedMotion ? 0 : engine.time * .11;
  for (let i = 0; i < 10; i++) {
    const z = (i / 10 + shift) % 1, left = project(-.5, z), right = project(2.5, z);
    ctx.strokeStyle = '#bbf9f212'; ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.stroke();
  }
  label(ctx, t('game.shooter.supplyLane'), 121, 89, 10, '#b9e8d6');
  label(ctx, t('game.shooter.enemyLane'), 240, 89, 10, '#ffc0b6');
  label(ctx, t('game.shooter.supplyLane'), 359, 89, 10, '#b9e8d6');
  rounded(ctx, 16, 14, 448, 49, 13, '#102b46d9', '#97bfc331');
  label(ctx, t('game.shooter.airspace', { n: String(engine.level + 1).padStart(2, '0') }), 86, 43, 12, '#b2d8dc');
  label(ctx, '♥'.repeat(engine.health) + '♡'.repeat(3 - engine.health), 240, 43, 19, '#ffc09b');
  label(ctx, `${t('game.shooter.shield')} ${engine.shield}`, 344, 43, 12, '#8de0ef');

  for (const bullet of engine.bullets) {
    const p = project(bullet.x, bullet.z), tail = project(bullet.x, bullet.z + .045);
    ctx.strokeStyle = '#dbffd5'; ctx.lineWidth = 2 + p.scale; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
  }
  const entities = engine.status === 'ready' ? [
    { kind: 'crate', upgrade: 'spread', lane: 0, z: .48, hp: 3 },
    { kind: 'crate', upgrade: 'rate', lane: 2, z: .28, hp: 3 },
    { kind: 'enemy', lane: 1, z: .2, hp: 4, maxHp: 4 },
    { kind: 'enemy', lane: 1, z: .5, hp: 3, maxHp: 3 },
  ] : engine.entities;
  for (const entity of [...entities].sort((a, b) => a.z - b.z)) {
    const p = project(entity.lane, entity.z);
    if (entity.kind === 'crate') crate(ctx, entity, p, sprites[entity.upgrade]);
    else {
      craft(ctx, p.x, p.y, p.scale, true, entity.kind === 'boss', sprites[entity.kind]);
      const width = entity.kind === 'boss' ? 82 : 38;
      rounded(ctx, p.x - width / 2, p.y - 38 * p.scale, width, 5, 2, '#143047');
      rounded(ctx, p.x - width / 2, p.y - 38 * p.scale, width * Math.max(0, entity.hp / entity.maxHp), 5, 2, '#ffb583');
      if (entity.kind === 'boss') label(ctx, t('game.shooter.boss'), p.x, p.y - 45 * p.scale, 10, '#ffd0b0');
    }
  }
  if (!reducedMotion) for (const effect of engine.effects) {
    const p = project(effect.x, effect.z), age = (engine.frame - effect.at) / 24;
    ctx.strokeStyle = effect.kind === 'crate' ? '#d4ffbf' : '#ffd097'; ctx.globalAlpha = 1 - age;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + age * 30, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const player = project(engine.x, .9);
  if (engine.shield) { ctx.strokeStyle = '#82ebecaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(player.x, player.y, 42, 39, 0, 0, Math.PI * 2); ctx.stroke(); }
  craft(ctx, player.x, player.y, 1.06, false, false, sprites.player);
  label(ctx, `${t('game.shooter.spread')} ${engine.spread + 1}  ·  ${t('game.shooter.rate')} ${engine.rate + 1}`, 240, 410, 10, '#b7dfe2');
  if (engine.status === 'ready' || engine.status === 'won' || engine.status === 'lost') {
    rounded(ctx, 32, 204, 416, 74, 14, '#0a233dea', '#96d9da55');
    const key = engine.status === 'ready' ? 'readyTitle' : engine.status === 'won' ? 'victory' : 'defeat';
    label(ctx, t(`game.shooter.${key}`), 240, 234, 17, '#e5f7e9');
    label(ctx, engine.status === 'ready' ? t('game.shooter.readyHint') : '★'.repeat(engine.stars), 240, 257, 11, '#b7d5d8');
  }
}

export default function createRenderer() {
  let host = null, canvas = null, board = null, observer = null, pointerId = null;
  let left = null, right = null, pause = null;
  let reducedMotion = false;
  let latestEngine = null, generation = 0;
  let sprites = {};
  const listeners = [];
  const listen = (target, type, handler) => { target.addEventListener(type, handler); listeners.push([target, type, handler]); };
  const release = () => { if (pointerId !== null) { try { canvas?.releasePointerCapture?.(pointerId); } catch { /* Already released. */ } } pointerId = null; };
  const resize = () => {
    if (!canvas) return;
    const width = board.clientWidth || host.clientWidth || WIDTH, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(width * HEIGHT / WIDTH * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${width * HEIGHT / WIDTH}px`;
  };
  return {
    kind: 'canvas',
    mount(nextHost, engine, ctx = {}) {
      this.destroy(); host = nextHost;
      const mountedGeneration = generation;
      board = document.createElement('div'); board.className = 'runner-board shooter-board';
      canvas = document.createElement('canvas'); canvas.className = 'game-canvas'; canvas.style.touchAction = 'none';
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', t('game.shooter.canvasLabel'));
      const controls = document.createElement('div'); controls.className = 'touch-controls';
      const button = (key, callback) => { const item = document.createElement('button'); item.type = 'button'; item.setAttribute('type', 'button'); item.textContent = t(key); item.setAttribute('aria-label', t(key)); listen(item, 'click', () => { if (!item.disabled) callback(); }); return item; };
      left = button('game.shooter.left', () => ctx.dispatch?.({ type: 'chooseSide', args: [0] }));
      right = button('game.shooter.right', () => ctx.dispatch?.({ type: 'chooseSide', args: [1] }));
      left.setAttribute('data-shooter-side', '0'); right.setAttribute('data-shooter-side', '1');
      controls.append(left, right);
      pause = button('dialog.pause', () => ctx.togglePause?.()); pause.className = 'runner-pause';
      const choose = event => {
        const rect = canvas.getBoundingClientRect();
        if (!Number.isFinite(event.clientX) || rect.width <= 0) return;
        const lane = Math.max(0, Math.min(2, Math.floor((event.clientX - rect.left) / rect.width * 3)));
        ctx.dispatch?.({ type: 'chooseLane', args: [lane] });
      };
      listen(canvas, 'pointerdown', event => {
        if (event.isPrimary === false || event.button > 0 || pointerId !== null || left.disabled) return;
        event.preventDefault(); pointerId = event.pointerId;
        try { canvas.setPointerCapture?.(pointerId); } catch { /* Capture is optional. */ }
        choose(event);
      });
      listen(canvas, 'pointermove', event => { if (pointerId === null || event.pointerId !== pointerId || left.disabled) return; event.preventDefault(); choose(event); });
      listen(canvas, 'pointerup', event => { if (event.pointerId === pointerId) release(); });
      listen(canvas, 'pointercancel', event => { if (event.pointerId === pointerId) release(); });
      listen(canvas, 'lostpointercapture', event => { if (event.pointerId === pointerId) pointerId = null; });
      board.append(canvas, controls, pause); host.append(board); resize();
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => { resize(); if (latestEngine) this.draw(latestEngine); }); observer.observe(host); }
      this.draw(engine);
      const requests = [
        ['player', 'scout-bot', '#8fe6e5'], ['enemy', 'enemy-drone', '#df667f'],
        ['boss', 'boss-sentry', '#d7798c'],
        ...Object.entries(UPGRADE_COLORS).map(([key, color]) => [key, key === 'shield' ? 'shield-cell' : 'upgrade-crate', color]),
      ];
      Promise.allSettled(requests.map(async ([key, id, color]) => [key, await getAssetSprite(id, color)]))
        .then(results => {
          if (!host || generation !== mountedGeneration) return;
          sprites = Object.fromEntries(results.filter(result => result.status === 'fulfilled' && result.value[1]).map(result => result.value));
          if (latestEngine) this.draw(latestEngine);
        });
    },
    draw(engine) {
      if (!canvas) return;
      latestEngine = engine;
      const ctx = canvas.getContext('2d'); ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
      drawScene(ctx, engine, reducedMotion, sprites);
      left.disabled = right.disabled = engine.status !== 'playing' || engine.paused;
      pause.disabled = engine.status !== 'playing';
      left.textContent = t('game.shooter.left'); right.textContent = t('game.shooter.right');
      pause.textContent = t(engine.paused ? 'dialog.resume' : 'dialog.pause');
      left.setAttribute('aria-label', t('game.shooter.left')); right.setAttribute('aria-label', t('game.shooter.right'));
      pause.setAttribute('aria-label', t(engine.paused ? 'dialog.resumeLabel' : 'dialog.pauseLabel')); canvas.setAttribute('aria-label', t('game.shooter.canvasLabel'));
    },
    setReducedMotion(value) { reducedMotion = value === true; },
    destroy() {
      generation++; latestEngine = null; sprites = {};
      release(); observer?.disconnect(); observer = null;
      listeners.splice(0).forEach(([target, type, handler]) => target.removeEventListener(type, handler));
      if (host) host.innerHTML = '';
      host = canvas = board = left = right = pause = null;
    },
  };
}
