import { t } from '../../src/core/host-surface.js';
import { rounded, label, polygon, verticalGradient } from '../../src/ui/scene/primitives.js';
import { getAssetSprite } from '../../src/ui/scene/three-models.js';
import { SHOT_PATTERNS } from './weapons.js';

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

function crate(ctx, entity, point, sprite = null, aligned = false) {
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
  if (entity.upgrade === 'spread') { for (const x of [-8, 0, 8]) { ctx.moveTo(x, 7); ctx.lineTo(x, -9); } }
  else if (entity.upgrade === 'rate') { ctx.moveTo(3, -12); ctx.lineTo(-7, 1); ctx.lineTo(3, 1); ctx.lineTo(-3, 12); }
  else { ctx.moveTo(-10, -8); ctx.lineTo(0, -12); ctx.lineTo(10, -8); ctx.lineTo(8, 5); ctx.lineTo(0, 12); ctx.lineTo(-8, 5); ctx.closePath(); }
  ctx.stroke();
  rounded(ctx, -39, size + 4, 78, 32, 6, '#102e49ee', aligned ? '#bdecae77' : '#e4bc7644');
  label(ctx, `${t(`game.shooter.${entity.upgrade}`)} · ${entity.hp}`, 0, size + 17, 9, color);
  label(ctx, t(aligned ? 'game.shooter.lockAligned' : 'game.shooter.lockRule'), 0, size + 29, 8, aligned ? '#d6f5b9' : '#f2d4a2');
  ctx.restore();
}

export function drawScene(ctx, engine, reducedMotion = false, sprites = {}) {
  const sky = engine.config.sky;
  ctx.fillStyle = verticalGradient(ctx, 0, HEIGHT, [[0, sky[0]], [.6, sky[1]], [1, '#102e44']]); ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#ffffff0d';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(35 + i * 76, 80 + i % 3 * 36, 54, 12, 0, 0, Math.PI * 2); ctx.fill(); }
  polygon(ctx, [[157, 96], [323, 96], [478, 420], [2, 420]], '#163346aa');
  // Selected lane and firing corridors use exactly the same projection as collisions.
  if (engine.status === 'playing') {
    const a = project(engine.lane - .48, 0), b = project(engine.lane + .48, 0);
    const c = project(engine.lane + .48, 1), d = project(engine.lane - .48, 1);
    polygon(ctx, [[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]], '#a5f5cb12');
  }
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

  const firingLane = Math.round(engine.x);
  const barrels = SHOT_PATTERNS[engine.spread].map(offset => Math.max(firingLane - .24, Math.min(firingLane + .24, engine.x + offset)));
  if (engine.status === 'playing') for (const x of barrels) {
    const muzzle = project(x, .88), far = project(x, .08);
    ctx.strokeStyle = '#b4f5d620'; ctx.lineWidth = 1; ctx.setLineDash([3, 8]);
    ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y); ctx.lineTo(far.x, far.y); ctx.stroke(); ctx.setLineDash([]);
  }
  const defenseLeft = project(-.5, .96), defenseRight = project(2.5, .96);
  ctx.strokeStyle = '#efac8266'; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.moveTo(defenseLeft.x, defenseLeft.y); ctx.lineTo(defenseRight.x, defenseRight.y); ctx.stroke(); ctx.setLineDash([]);
  for (const bullet of engine.bullets) {
    const p = project(bullet.x, bullet.z), tail = project(bullet.x, bullet.z + .045);
    ctx.strokeStyle = '#ffe5a5'; ctx.lineWidth = 2 + p.scale; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tail.x, tail.y); ctx.stroke();
  }
  const entities = engine.status === 'ready' ? [
    { kind: 'crate', upgrade: 'spread', lane: 0, z: .48, hp: 3 },
    { kind: 'crate', upgrade: 'rate', lane: 2, z: .28, hp: 3 },
    { kind: 'enemy', lane: 1, z: .2, hp: 4, maxHp: 4 },
    { kind: 'enemy', lane: 1, z: .5, hp: 3, maxHp: 3 },
  ] : engine.entities;
  for (const entity of [...entities].sort((a, b) => a.z - b.z)) {
    const p = project(entity.lane, entity.z);
    if (engine.frame - entity.hitAt < 5) {
      ctx.fillStyle = '#fff4c644'; ctx.beginPath(); ctx.arc(p.x, p.y - 8, 26 * p.scale, 0, Math.PI * 2); ctx.fill();
    }
    if (entity.kind !== 'crate' && entity.z > .7) {
      label(ctx, '!', p.x + 25 * p.scale, p.y - 28 * p.scale, 20, '#ffbd91', 900);
    }
    if (entity.kind === 'crate') {
      crate(ctx, entity, p, sprites[entity.upgrade], Math.abs(entity.lane - engine.x) < .27);
    }
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
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 12 + age * 30, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 6; k++) {
      const angle = (k / 6) * Math.PI * 2 + effect.at;
      const dist = 8 + age * 36;
      ctx.fillStyle = effect.kind === 'crate' ? '#a5f782' : '#ff9955';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, Math.max(1, 3 * (1 - age)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const player = project(engine.x, .9);
  if (engine.shield) { ctx.strokeStyle = '#82ebecaa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(player.x, player.y, 42, 39, 0, 0, Math.PI * 2); ctx.stroke(); }
  craft(ctx, player.x, player.y, 1.06, false, false, sprites.player);
  // Extra barrels attach to the player's craft; no weapons appear in other lanes.
  if (engine.spread) for (const x of barrels) {
    const barrel = project(x, .88);
    rounded(ctx, barrel.x - 3, barrel.y - 14, 6, 14, 2, '#dfffaf', '#397a78');
  }
  if (engine.status === 'playing' && !reducedMotion && engine.frame - engine.lastShot < 3) for (const x of barrels) {
    const muzzle = project(x, .88); ctx.fillStyle = '#e8ffc8';
    ctx.beginPath(); ctx.arc(muzzle.x, muzzle.y - 6, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (engine.lastDamage && engine.frame - engine.lastDamage.at < 36) {
    ctx.strokeStyle = engine.lastDamage.shield ? '#8deaf2' : '#ff9c80'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, WIDTH - 6, HEIGHT - 6);
    label(ctx, t(engine.lastDamage.shield ? 'game.shooter.shieldBlocked' : 'game.shooter.defenseHit'), 240, 144, 15, engine.lastDamage.shield ? '#b6f6ff' : '#ffd2bd');
  }
  if (engine.lastUpgrade && engine.frame - engine.lastUpgrade.at < 100) {
    rounded(ctx, 105, 104, 270, 25, 8, '#113f42ee', '#c4ef9344');
    label(ctx, t('game.shooter.upgraded', { upgrade: t(`game.shooter.${engine.lastUpgrade.upgrade}`) }), 240, 121, 12, '#dfffbd');
  }
  label(ctx, `${t('game.shooter.spread')} ${engine.spread + 1}  ·  ${t('game.shooter.rate')} ${engine.rate + 1}`, 240, 410, 10, '#b7dfe2');
  if (engine.status === 'ready' || engine.status === 'won' || engine.status === 'lost') {
    rounded(ctx, 32, 204, 416, 74, 14, '#0a233dea', '#96d9da55');
    const key = engine.status === 'ready' ? 'readyTitle' : engine.status === 'won' ? 'victory' : 'defeat';
    label(ctx, t(`game.shooter.${key}`), 240, 234, 17, '#e5f7e9');
    label(ctx, engine.status === 'ready' ? t('game.shooter.readyHint') : '★'.repeat(engine.stars), 240, 257, 11, '#b7d5d8');
  }
}

const updateText = (element, value) => { if (element.textContent !== String(value)) element.textContent = value; };
const updateAttribute = (element, key, value) => { if (element.getAttribute(key) !== String(value)) element.setAttribute(key, value); };
const updateDisabled = (element, value) => { if (element.disabled !== value) element.disabled = value; };

export default function createRenderer() {
  let host = null, canvas = null, board = null, observer = null, pointerId = null;
  let left = null, right = null, center = null, pause = null;
  let brief = null, phaseLabel = null, goalLabel = null, progressBar = null;
  let reducedMotion = false;
  let latestEngine = null, generation = 0;
  let sprites = {};
  const listeners = [];
  const listen = (target, type, handler) => { target.addEventListener(type, handler); listeners.push([target, type, handler]); };
  const release = () => { if (pointerId !== null) { try { canvas?.releasePointerCapture?.(pointerId); } catch { /* Already released. */ } } pointerId = null; };
  const resize = () => {
    if (!canvas) return;
    const width = board.clientWidth || host.clientWidth || WIDTH, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelsWide = Math.round(width * dpr), pixelsHigh = Math.round(width * HEIGHT / WIDTH * dpr);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
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
      center = button('game.shooter.center', () => ctx.dispatch?.({ type: 'chooseLane', args: [1] }));
      center.setAttribute('data-shooter-center', '');
      controls.append(left, center, right);
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
      board.append(canvas, controls, pause);
      brief = document.createElement('div'); brief.className = 'action-brief';
      phaseLabel = document.createElement('strong'); phaseLabel.className = 'action-phase';
      goalLabel = document.createElement('span'); goalLabel.className = 'action-goal';
      progressBar = document.createElement('div'); progressBar.className = 'action-progress';
      progressBar.setAttribute('role', 'progressbar'); progressBar.setAttribute('aria-valuemin', '0'); progressBar.setAttribute('aria-valuemax', '100');
      brief.append(phaseLabel, goalLabel, progressBar);
      host.append(board, brief); resize();
      if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => { resize(); if (latestEngine) this.draw(latestEngine); }); observer.observe(host); }
      this.draw(engine);
      const requests = [
        ['player', 'scout-bot', '#8fe6e5'], ['enemy', 'enemy-drone', '#df667f'],
        ['boss', 'boss-sentry', '#d7798c'],
        ...Object.entries(UPGRADE_COLORS).map(([key, color]) => [key, key === 'shield' ? 'shield-cell' : 'upgrade-crate', color]),
      ];
      Promise.allSettled(requests.map(async ([key, id, color]) => [key, await getAssetSprite(id, color, 256, key === 'player' ? Math.PI : 0)]))
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
      const disabled = engine.status !== 'playing' || engine.paused;
      for (const button of [left, right, center]) updateDisabled(button, disabled);
      if (left.disabled) release();
      updateDisabled(pause, engine.status !== 'playing');
      updateText(left, t('game.shooter.left')); updateText(right, t('game.shooter.right'));
      updateText(center, t('game.shooter.center')); updateAttribute(center, 'aria-label', t('game.shooter.center'));
      updateAttribute(center, 'aria-pressed', engine.lane === 1);
      const boss = engine.entities.find(entity => entity.kind === 'boss');
      const bossAt = engine.config.waves.find(wave => wave.kind === 'boss')?.at ?? 1;
      const phase = engine.status === 'won' ? t('game.shooter.victory') : engine.status === 'lost' ? t('game.shooter.defeat')
        : boss ? t('game.shooter.bossHealth', { n: boss.hp, total: boss.maxHp })
        : t('game.shooter.bossCountdown', { seconds: Math.max(0, Math.ceil(bossAt - engine.time)) });
      const goal = t('game.shooter.killProgress', { n: engine.kills, total: engine.config.waves.filter(wave => wave.kind !== 'crate').length });
      if (phaseLabel.textContent !== phase) phaseLabel.textContent = phase;
      if (goalLabel.textContent !== goal) goalLabel.textContent = goal;
      const danger = Boolean(boss || engine.entities.some(entity => entity.kind !== 'crate' && entity.z > .7));
      if (brief.classList.contains('is-danger') !== danger) brief.classList.toggle('is-danger', danger);
      const progress = engine.status === 'won' ? 100 : Math.min(99, Math.floor(engine.kills / engine.config.waves.filter(wave => wave.kind !== 'crate').length * 100));
      if (progressBar.getAttribute('aria-valuenow') !== String(progress)) {
        progressBar.style.setProperty('--progress', `${progress}%`);
        progressBar.setAttribute('aria-valuenow', progress);
      }
      updateAttribute(progressBar, 'aria-label', t('game.shooter.campaignProgress'));

      updateText(pause, t(engine.paused ? 'dialog.resume' : 'dialog.pause'));
      updateAttribute(left, 'aria-label', t('game.shooter.left')); updateAttribute(right, 'aria-label', t('game.shooter.right'));
      updateAttribute(pause, 'aria-label', t(engine.paused ? 'dialog.resumeLabel' : 'dialog.pauseLabel')); updateAttribute(canvas, 'aria-label', t('game.shooter.canvasLabel'));
    },
    setReducedMotion(value) { reducedMotion = value === true; },
    destroy() {
      generation++; latestEngine = null; sprites = {};
      release(); observer?.disconnect(); observer = null;
      listeners.splice(0).forEach(([target, type, handler]) => target.removeEventListener(type, handler));
      if (host) host.innerHTML = '';
      host = canvas = board = left = right = center = pause = brief = phaseLabel = goalLabel = progressBar = null;
    },
  };
}
