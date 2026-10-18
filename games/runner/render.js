/**
 * 加减门冲关 · 渲染器（Canvas，kind: 'canvas'）
 * ============================================================================
 * 硬规则：**渲染器无状态**。所有可变状态在 engine 上，draw() 每次从参数取。
 * 本文件由宿主以 GameRenderer 契约调用：
 *   mount(host, engine, ctx)   → 建画布、绑定输入并画第一帧
 *   draw(engine)               → 状态变化或每帧重画
 *   destroy()                  → 解绑监听器、清空 host（宿主在关闭游戏时调用）
 *
 * 坐标约定：所有绘制使用 480×420 的**逻辑坐标**，由 setTransform 缩放到实际
 * 画布尺寸（×2 以适配高分屏）。这样关卡数值与绘制几何互不干扰：
 * 改画布分辨率不需要动任何一处绘制代码。
 *
 * 共享原语（rounded / label / polygon）来自 src/ui/scene/primitives.js，
 * 与神庙 SVG 渲染器共用同一实现，避免圆角语义在两处漂移。
 *
 * 预览模式：首页卡片与英雄区复用同一套绘制（drawScene + preview: true），
 * 因此缩略图与真实画面不可能不一致。
 */
import { t, starRow } from '../../src/core/host-surface.js';
import { rounded, label, polygon, verticalGradient } from '../../src/ui/scene/primitives.js';
import { getSoldierSprite } from '../../src/ui/scene/three-models.js';
import RUNNER_LEVELS from './levels.js';

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 420;

/** Five distinct campaign biomes share the same geometry and visual language. */
const PALETTE = [
  { sky: ['#183e54', '#285c65'], ground: '#315c62' },
  { sky: ['#503c55', '#865b5f'], ground: '#77515b' },
  { sky: ['#282b51', '#4d4260'], ground: '#4a4460' },
  { sky: ['#613e3a', '#ad7757'], ground: '#b2805d' },
  { sky: ['#102c43', '#326b72'], ground: '#5f9195' },
];

// 全局缓存 3D Sprite
let playerSprite = null;
let enemySprite = null;

/**
 * 一个小兵。索引参与相位计算，使整队不同步摆动（避免机械感）。
 * @param {CanvasRenderingContext2D} ctx
 */
function soldier(ctx, x, y, size, enemy, time, index) {
  ctx.save();
  ctx.translate(x, y + Math.sin(time * 11 + index * 1.4) * (enemy ? .4 : 1.4));
  ctx.scale(size, size);
  ctx.fillStyle = '#07132266';
  ctx.beginPath(); ctx.ellipse(1, 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  const swing = Math.sin(time * 11 + index) * 2;

  const sprite = enemy ? enemySprite : playerSprite;
  if (sprite) {
    // 渲染 3D 贴图
    ctx.rotate(swing * 0.05); // 根据摆动稍微旋转
    ctx.drawImage(sprite, -15, -25, 30, 30);
  } else {
    ctx.strokeStyle = enemy ? '#8d3a4c' : '#174b84'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, 3); ctx.lineTo(-4 + swing, 8);
    ctx.moveTo(3, 3); ctx.lineTo(4 - swing, 8);
    ctx.stroke();
    const body = ctx.createLinearGradient(-5, -6, 5, 6);
    body.addColorStop(0, enemy ? '#ff9d96' : '#76e3ff');
    body.addColorStop(1, enemy ? '#d54f61' : '#2e8bdf');
    rounded(ctx, -5, -6, 10, 12, 4, body);
    rounded(ctx, -5.5, -15, 11, 10, 4, enemy ? '#ef6973' : '#54bcf2', enemy ? '#9e3d51' : '#2977ae');
    rounded(ctx, -4, -11, 8, 3, 1, '#1b334b');
    ctx.strokeStyle = '#ccecff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(7, -12); ctx.stroke();
  }
  ctx.restore();
}

/** 一扇增益门：渐变玻璃 + 内部扫描线 + 立柱 + 运算符 */
function gateArt(ctx, choice, x, y, width, height, time, selected) {
  const multiply = choice[0] === '×', bad = choice[0] === '−';
  const tint = bad ? '#ff857d' : multiply ? '#b9f582' : '#64d9ff';
  const gradient = ctx.createLinearGradient(x, y - height, x + width, y);
  gradient.addColorStop(0, bad ? '#ae425966' : multiply ? '#4baf6b55' : '#2585b677');
  gradient.addColorStop(1, bad ? '#ff756b33' : multiply ? '#bcf58b99' : '#a1ecff99');
  polygon(ctx, [[x + 6, y + 5], [x + width + 15, y + 5], [x + width, y + 15], [x - 2, y + 15]], '#0b1b2d44');
  rounded(ctx, x, y - height, width, height, 6, gradient, tint);

  ctx.save();
  ctx.beginPath(); ctx.rect(x + 3, y - height + 3, width - 6, height - 6); ctx.clip();
  for (let i = 0; i < 6; i++) {
    const yy = y - height + ((time * 12 + i * 17) % height);
    ctx.fillStyle = '#ffffff16'; ctx.fillRect(x, yy, width, 2);
  }
  ctx.restore();

  for (const xx of [x - 2, x + width - 4]) {
    rounded(ctx, xx + 3, y - height + 5, 7, height + 8, 2, multiply ? '#427657' : '#325d7f');
    rounded(ctx, xx, y - height, 7, height + 9, 2, tint);
    rounded(ctx, xx + 1, y - height + 2, 2, height, 1, '#fff8');
  }
  rounded(ctx, x - 2, y - height - 3, width + 5, 7, 2, tint);
  label(ctx, choice.join(''), x + width / 2, y - height / 2 + 10, Math.min(34, height * .43), '#113b42', 850);
  label(ctx, t(bad ? 'game.runner.gateTrap' : multiply ? 'game.runner.gateMultiply' : 'game.runner.gateRecruit'), x + width / 2, y - 9, Math.max(6, height * .1), '#204d51aa', 650);
  if (selected) {
    ctx.shadowColor = tint; ctx.shadowBlur = 13; ctx.strokeStyle = tint; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 10, y + 15); ctx.lineTo(x + width - 10, y + 15); ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

/**
 * 绘制整个场景。**这是唯一的绘制入口**，首页预览也走它（用 preview 模式）。
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state           引擎实例或兼容对象（{config, time, gate, army, …}）
 * @param {object} [options]
 * @param {boolean} [options.preview=false]       预览模式：不画 HUD、浮字、结算遮罩
 * @param {number} [options.clock]                覆盖动画时钟（预览用固定值）
 * @param {boolean} [options.reducedMotion=false] 尊重系统"减少动态效果"
 */
export function drawScene(ctx, state, { preview = false, clock = state.time || 0, reducedMotion = false } = {}) {
  const width = LOGICAL_WIDTH, height = LOGICAL_HEIGHT;
  const config = state.config || RUNNER_LEVELS[0];
  const level = Math.min(state.level || 0, PALETTE.length - 1);
  const palette = PALETTE[level];
  const time = reducedMotion ? 0 : clock;

  ctx.clearRect(0, 0, width, height);

  // 天空与太阳
  ctx.fillStyle = verticalGradient(ctx, 0, height, [[0, palette.sky[0]], [1, palette.sky[1]]]);
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffdf9b'; ctx.shadowColor = '#ffeaaa'; ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(347, 55, 23, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

  if (level === 4) {
    ctx.save(); ctx.globalAlpha = .25;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = ['#91f6c8', '#88d2e9', '#b9a9ef', '#97dfc1'][i]; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(0, 42 + i * 13);
      ctx.bezierCurveTo(145, -15 + i * 16, 210, 117 - i * 10, 480, 30 + i * 15); ctx.stroke();
    }
    ctx.restore();
  }

  // 远山与地面
  polygon(ctx, [[0, 120], [0, 75], [55, 53], [91, 82], [137, 46], [177, 100], [230, 71], [288, 111], [370, 76], [430, 95], [480, 62], [480, 180]], '#203b4b');
  polygon(ctx, [[0, 163], [40, 108], [95, 127], [133, 104], [178, 141], [243, 121], [322, 151], [391, 114], [480, 152], [480, 420], [0, 420]], palette.ground);
  for (let i = 0; i < 15; i++) {
    const xx = ((i * 139 + 23) % 480), yy = 165 + (i * 29) % 235;
    ctx.fillStyle = '#f1d7ab12';
    ctx.beginPath(); ctx.ellipse(xx, yy, 12 + i % 3 * 8, 3, -.2, 0, 6.3); ctx.fill();
  }

  // 透视赛道
  polygon(ctx, [[164, 83], [316, 83], [458, 420], [22, 420]], '#152c3c');
  polygon(ctx, [[173, 83], [307, 83], [429, 420], [51, 420]], '#6e8991');
  polygon(ctx, [[177, 83], [303, 83], [418, 420], [62, 420]], '#a8bdba');
  polygon(ctx, [[177, 83], [192, 83], [106, 420], [62, 420]], '#c7d8c8');
  polygon(ctx, [[288, 83], [303, 83], [418, 420], [374, 420]], '#829f9e');

  // 横向路面线：按 depth² 分布，产生俯视透视感
  ctx.strokeStyle = '#557b7d88'; ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) {
    const depth = (i / 15 + state.time * .075) % 1;
    const y = 83 + depth * depth * 337, half = 63 + depth * depth * 115;
    ctx.beginPath(); ctx.moveTo(240 - half, y); ctx.lineTo(240 + half, y); ctx.stroke();
  }
  ctx.setLineDash([7, 12]); ctx.strokeStyle = '#e3edd699'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(240, 85); ctx.lineTo(240, 420); ctx.stroke(); ctx.setLineDash([]);

  // 路缘灯
  for (let i = 0; i < 6; i++) {
    const ratio = (i / 6 + state.time * .07) % 1;
    const y = 100 + ratio * ratio * 320, half = 72 + ratio * ratio * 130;
    for (const side of [-1, 1]) rounded(ctx, 240 + side * half - 2, y, 4, 10 + ratio * 10, 1, '#c5fbeb');
  }

  // 增益门：从远到近绘制，近处的覆盖远处的
  const index = state.gate || 0;
  for (let i = Math.min(index + 2, config.gates.length - 1); i >= index; i--) {
    const gate = config.gates[i], distance = (gate.at - state.time) / 7.5;
    if (distance < 0 || distance > 1.1) continue;
    const depth = Math.max(.06, 1 - distance);
    const y = 95 + depth * 195, w = 44 + depth * 87, h = 27 + depth * 63;
    for (let side = 0; side < 2; side++) {
      gateArt(ctx, gate.choices[side], 240 + (side === 0 ? -1 : 1) * (w / 2 + 5) - w / 2, y, w, h, time, i === index && side === state.side);
    }
    if (!preview && depth > .35) {
      rounded(ctx, 207, y + 19, 66, 18, 8, '#743f4a');
      label(ctx, t('game.runner.canvasGuards', { n: gate.enemy }), 240, y + 31, 9, '#ffd9c9');
      if (depth > .7) for (let j = 0; j < 4; j++) soldier(ctx, 215 + j * 17, y + 49, .65, true, time, j);
    }
  }

  // 要塞（所有门通过后出现）
  if (index >= config.gates.length) {
    const rise = Math.min(1, Math.max(0, (state.time - config.gates.at(-1).at) / 4));
    const y = 135 + rise * 65;
    polygon(ctx, [[135, y - 68], [145, y - 78], [338, y - 78], [347, y - 68], [347, y + 23], [135, y + 23]], '#3a354c');
    for (const x of [125, 315]) {
      rounded(ctx, x, y - 91, 40, 120, 5, '#6a667c', '#928398');
      for (let i = 0; i < 3; i++) rounded(ctx, x + i * 14, y - 101, 10, 19, 1, '#94879a');
    }
    rounded(ctx, 199, y - 31, 82, 62, [35, 35, 0, 0], '#172b37');
    label(ctx, t('game.runner.canvasFinal'), 240, y - 45, 9, '#e9d3c8');
    const boss = state.bossHealth ?? config.boss;
    rounded(ctx, 174, y - 18, 132, 7, 3, '#272130');
    rounded(ctx, 174, y - 18, 132 * boss / config.boss, 7, 3, '#ef8a78');
    label(ctx, `${boss}`, 240, y + 13, 19, '#ffb19f');
    for (let i = 0; i < 10; i++) soldier(ctx, 166 + i % 5 * 36, y + 48 + Math.floor(i / 5) * 19, .85, true, time, i);
  }

  // 队伍
  const position = state.position ?? (state.side === 0 ? .25 : .75);
  const center = 126 + position * 228;
  const count = Math.min(state.army, 54);            // 显示上限：54 人，避免密集时糊成一团
  const columns = Math.min(8, Math.ceil(Math.sqrt(count)));
  ctx.fillStyle = '#42c8eb16';
  ctx.beginPath(); ctx.ellipse(center, 354, 52, 31, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < count; i++) {
    soldier(ctx, center + (i % columns - (columns - 1) / 2) * 12 + Math.floor(i / columns) % 2 * 4, 326 + Math.floor(i / columns) * 10, .85, false, time, i);
  }
  rounded(ctx, center - 33, 288, 66, 27, 12, '#124764', '#70d7ef');
  label(ctx, `${state.army}`, center, 307, 16, '#e4fcff');

  // 前进火星（仅进行中、且未开启减少动效）
  if (!preview && state.status === 'playing' && !reducedMotion) {
    for (let i = 0; i < 4; i++) {
      const ratio = (time * 2.9 + i / 4) % 1, x = center + Math.sin(i * 3) * 24;
      const y = 310 - ratio * (state.phase === 'boss' ? 97 : 68);
      ctx.strokeStyle = '#fff2b5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke();
    }
    if (state.phase === 'boss') {
      for (let i = 0; i < 6; i++) {
        const pRatio = (time * 5 + i * 0.16) % 1;
        const sx = center + Math.sin(i * 2.1) * 28;
        const px = sx + (240 + Math.sin(i * 1.8) * 55 - sx) * pRatio;
        const py = 295 - pRatio * 105;
        ctx.fillStyle = i % 2 === 0 ? '#ffea78' : '#70e5ff';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // HUD 与浮字（预览模式不画）
  if (!preview) {
    rounded(ctx, 15, 14, 108, 43, 11, '#0e2436d9', '#5c9ba855');
    label(ctx, t('game.runner.canvasSquad'), 69, 29, 8, '#a3c6cb', 650);
    label(ctx, t('game.runner.canvasArmy', { n: state.army }), 69, 47, 17);
    label(ctx, t('game.runner.canvasGates', { done: Math.min(config.gates.length, state.gate), total: config.gates.length }), 240, 30, 10, '#c0dbdb', 600);
    rounded(ctx, 175, 40, 130, 4, 2, '#122b3d');
    rounded(ctx, 175, 40, Math.max(1, Math.min(130, state.time / (config.bossAt + 2.8) * 130)), 4, 2, '#c9ee91');

    if (state.event?.type === 'gate' && state.time - state.event.at < 1.3) {
      const elapsed = state.time - state.event.at;
      ctx.globalAlpha = 1 - elapsed / 1.3;
      label(ctx, `${state.event.gain >= 0 ? '+' : ''}${state.event.gain}`, center, 273 - elapsed * 27, 27, '#d8ff9a');
      label(ctx, t('game.runner.canvasLoss', { n: state.event.loss }), center, 292 - elapsed * 18, 11, '#ffbaaa');
      ctx.globalAlpha = 1;
    }
  }

  // 结算遮罩
  if (state.status === 'won' || state.status === 'lost') {
    ctx.fillStyle = '#10233388'; ctx.fillRect(0, 0, width, height);
    rounded(ctx, 100, 138, 280, 127, 20, '#122b3eef', '#9ebfac55');
    label(ctx, t(state.status === 'won' ? 'game.runner.canvasWin' : 'game.runner.canvasLose'), 240, 180, 27, '#f4f3dc');
    const row = starRow(state.stars || 0);
    label(ctx, state.status === 'won'
      ? row.filled.join('') + row.empty.join('')
      : t('game.runner.canvasRetry'), 240, 216, 25, state.status === 'won' ? '#dfed95' : '#d4b4ae');
    label(ctx, state.status === 'won'
      ? t('game.runner.canvasScore', { score: state.score.toLocaleString() })
      : t('game.runner.canvasHint'), 240, 244, 12, '#a2bec3', 550);
    if (state.status === 'won' && !reducedMotion) {
      for (let i = 0; i < 34; i++) {
        const x = (i * 83 + Math.sin(i) * 31) % width, y = (time * 35 + i * 39) % height;
        ctx.fillStyle = ['#dcf78d', '#6ddcf5', '#ffc68a'][i % 3];
        ctx.save(); ctx.translate(x, y); ctx.rotate(i + time); ctx.fillRect(-2, -2, 4, 7); ctx.restore();
      }
    }
  }
}

/**
 * 首页预览用：直接画到一个已有画布上（不需要 engine 实例）。
 * @param {HTMLCanvasElement} canvas
 * @param {object} state
 * @param {object} [options]
 */
export function drawPreview(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / LOGICAL_WIDTH, 0, 0, canvas.height / LOGICAL_HEIGHT, 0, 0);
  drawScene(ctx, state, { preview: true, reducedMotion: true, ...options });
}

/**
 * 创建渲染器实例（GameRenderer 契约）。
 * @returns {import('../../src/core/contracts.js').GameRenderer}
 */
export default function createRenderer() {
  /** @type {HTMLCanvasElement|null} */
  let canvas = null;
  /** @type {HTMLDivElement|null} */
  let host = null;
  let translate = t;
  let board = null;
  let leftButton = null;
  let rightButton = null;
  let pauseButton = null;
  let pointerId = null;
  let latestEngine = null;
  let generation = 0;
  const listeners = [];

  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    listeners.push([target, type, callback]);
  }

  function releasePointer() {
    if (pointerId !== null) {
      try { canvas?.releasePointerCapture?.(pointerId); } catch { /* 指针已被浏览器释放 */ }
    }
    pointerId = null;
  }

  /** 按设备像素比分配合适的画布尺寸：高分屏不糊，低端设备不浪费像素 */
  function resize() {
    if (!canvas || !host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = board?.clientWidth || host.clientWidth || LOGICAL_WIDTH;
    const height = Math.round(width * LOGICAL_HEIGHT / LOGICAL_WIDTH);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  return {
    kind: 'canvas',

    mount(nextHost, engine, ctx = {}) {
      this.destroy();
      host = nextHost;
      translate = typeof ctx.t === 'function' ? ctx.t : t;

      const token = ++generation;
      Promise.all([getSoldierSprite('#58c9ec'), getSoldierSprite('#f58a79')]).then(([player, enemy]) => {
        if (token !== generation || !host) return;
        playerSprite = player; enemySprite = enemy;
        if (latestEngine) this.draw(latestEngine);
      }).catch(() => {});
      board = document.createElement('div');
      board.className = 'runner-board';
      canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      canvas.style.touchAction = 'none';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', translate('game.runner.canvasLabel'));
      if (ctx.theme?.accent) host.style.setProperty('--accent', ctx.theme.accent);

      const controls = document.createElement('div');
      controls.className = 'touch-controls';
      const makeButton = (key, side) => {
        const button = document.createElement('button');
        button.setAttribute('type', 'button');
        button.setAttribute('data-runner-side', side);
        button.setAttribute('aria-label', translate(key));
        button.textContent = translate(key);
        listen(button, 'click', () => {
          if (!button.disabled) ctx.dispatch?.({ type: 'chooseSide', args: [side] });
        });
        return button;
      };
      leftButton = makeButton('game.runner.leftGate', 0);
      rightButton = makeButton('game.runner.rightGate', 1);
      controls.append(leftButton, rightButton);
      pauseButton = document.createElement('button');
      pauseButton.className = 'runner-pause';
      pauseButton.setAttribute('type', 'button');
      pauseButton.setAttribute('aria-label', translate('dialog.pauseLabel'));
      pauseButton.textContent = translate('dialog.pause');
      listen(pauseButton, 'click', () => { if (!pauseButton.disabled) ctx.togglePause?.(); });

      const chooseAt = event => {
        const rect = canvas.getBoundingClientRect();
        if (!(rect.width > 0) || !Number.isFinite(event.clientX)) return;
        const side = event.clientX - rect.left < rect.width / 2 ? 0 : 1;
        ctx.dispatch?.({ type: 'chooseSide', args: [side] });
      };
      listen(canvas, 'pointerdown', event => {
        if (event.isPrimary === false || event.button > 0 || pointerId !== null || leftButton.disabled) return;
        event.preventDefault();
        pointerId = event.pointerId;
        try { canvas.setPointerCapture?.(pointerId); } catch { /* 宿主不支持指针捕获时仍可点击 */ }
        chooseAt(event);
      });
      listen(canvas, 'pointermove', event => {
        if (pointerId === null || event.pointerId !== pointerId || leftButton.disabled) return;
        event.preventDefault();
        chooseAt(event);
      });
      listen(canvas, 'pointerup', event => { if (event.pointerId === pointerId) releasePointer(); });
      listen(canvas, 'pointercancel', event => { if (event.pointerId === pointerId) releasePointer(); });
      listen(canvas, 'lostpointercapture', event => { if (event.pointerId === pointerId) pointerId = null; });
      board.append(canvas, controls, pauseButton);
      host.append(board);
      resize();
      // 用 ResizeObserver 而非 window.resize：宿主容器尺寸变化（如切换关卡重排）也能感知
      this._observer = new ResizeObserver(() => { resize(); if (latestEngine) this.draw(latestEngine); });
      this._observer.observe(host);
      this.draw(engine);
    },

    draw(engine) {
      latestEngine = engine;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / LOGICAL_WIDTH, 0, 0, canvas.height / LOGICAL_HEIGHT, 0, 0);
      drawScene(ctx, engine, { reducedMotion: this._reducedMotion === true });
      const canChoose = engine.status === 'playing' && engine.phase === 'run';
      leftButton.disabled = !canChoose;
      rightButton.disabled = !canChoose;
      leftButton.setAttribute('aria-pressed', String(engine.side === 0));
      rightButton.setAttribute('aria-pressed', String(engine.side === 1));
      leftButton.textContent = translate('game.runner.leftGate');
      rightButton.textContent = translate('game.runner.rightGate');
      leftButton.setAttribute('aria-label', translate('game.runner.leftGate'));
      rightButton.setAttribute('aria-label', translate('game.runner.rightGate'));
      pauseButton.disabled = engine.status !== 'playing';
    },

    /** 宿主可注入"减少动态效果"偏好；未注入时按 false 处理 */
    setReducedMotion(value) { this._reducedMotion = value === true; },

    /**
     * 必须解绑并清理。漏掉 ResizeObserver 会在多次开关游戏后累积，
     * 表现为内存与 CPU 占用持续上涨（本项目 T6 测试会 import 本文件，防止语法类回归）。
     */
    destroy() {
      generation++; latestEngine = null;
      this._observer?.disconnect();
      this._observer = null;
      for (const [target, type, callback] of listeners.splice(0)) target.removeEventListener(type, callback);
      releasePointer();
      if (host) host.innerHTML = '';
      canvas = null;
      host = null;
      board = null;
      leftButton = null;
      rightButton = null;
      pauseButton = null;
    },
  };
}
