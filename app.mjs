/**
 * 宿主外壳 —— 首页、游戏容器、进度与语言。
 * ============================================================================
 * P3 之后本文件的定位发生了根本变化：
 *
 *   之前：硬编码三个游戏的注册表 + 每个游戏的专属分支（if id === 'runner' …）
 *   现在：只认 manifest 与 GameEngine 契约，**不认识任何具体游戏**
 *
 * 具体删掉的游戏专属逻辑：
 *   · `games` 对象（title/category/instruction 硬编码）→ 改为注册表读 manifest
 *   · `if (active.id === 'runner') mountRunner()` 三条分支 → 改为按 renderer.kind 分派
 *   · `if (active.id !== 'runner') return`（rAF 只服务冲关）→ 改为 session.timeDriven
 *   · `hud()` 里的三个 if 分支 → 改为 engine.hud()
 *   · 结算/星级/分数的手写判定 → 改为 session.poll()（保证只结算一次）
 *
 * 本文件现在只负责**DOM 与平台能力**：挂载渲染器、读 HUD、显示结果、播声音、
 * 持久化、语言切换。所有玩法判断都在引擎与会话里。
 *
 * 底线：任何"某个游戏才有的东西"都不应出现在本文件。出现即说明该能力
 * 应该进契约（或进游戏自己的目录）。
 */
import { createRegistry } from './src/core/registry.js';
import { createSession } from './src/core/lifecycle.js';
import { MODULES } from './games/index.js';
import {
  t, initLocale, setLocale, localeOptions, getLocaleMeta,
} from './src/core/i18n.js';
import { ENGINE_STATUS } from './src/core/enums.js';
import { DIFFICULTY, STAR, starRow } from './src/core/labels.js';
import { mountHome } from './src/ui/home.js';
import { createGameHud } from './src/ui/game-hud.js';

const $ = selector => document.querySelector(selector);

// 语言必须在渲染任何界面文案之前初始化：先读 ?lang=，再读持久化设置，最后读浏览器语言。
initLocale();

const dialog = $('#game-dialog'), area = $('#play-area'), status = $('#game-status');
const startButton = $('#start-game'), nextButton = $('#next-level');
const hintButton = $('#hint-button'), undoButton = $('#undo-button');
const updateHud = createGameHud(document, $('#game-hud'));
const motion = matchMedia('(prefers-reduced-motion: reduce)');

let sound = false;
let audio = null;
let frame = null;
let previousTime = null;

/* ============================================================ 注册表 */

const registry = createRegistry();
const { loaded, failed } = await registry.load(MODULES);
if (failed) console.warn(`[app] ${loaded} 个游戏加载成功，${failed} 个被跳过（详见上方 registry 错误）`);

const manifests = registry.list();

/* ============================================================ 注入上下文 */

/**
 * 游戏唯一的外部能力通道（契约里的 GameContext）。
 * 游戏**不允许**直接 import 宿主服务，只能从构造参数拿到这个对象。
 */
const gameContext = {
  t,
  sfx: name => playTone(name),
  toast: message => { status.textContent = message; },
  viewport: { width: 0, height: 0, dpr: 1 },
  report: () => {},            // 埋点预留
  use: async () => null,       // 资源加载预留（ResourceManager 尚未实现）
};

/* ============================================================ 进度持久化 */

/**
 * 进度形状：{ [gameId]: [{stars, score}, …] }
 * 仍然写在 localStorage（StorageAdapter 尚未实现），但**键位完全由注册表驱动** ——
 * 新增游戏自动获得进度槽位，不必改本文件。
 */
const progress = {};
for (const manifest of manifests) {
  progress[manifest.id] = Array.from({ length: manifest.levelCount }, () => ({ stars: 0, score: 0 }));
}

try {
  const saved = JSON.parse(localStorage.getItem('wande-dao-progress-v2') || 'null');
  if (saved && typeof saved === 'object') {
    for (const id of registry.ids()) progress[id].forEach((record, i) => {
      const value = saved[id]?.[i];
      if (value && Number.isFinite(value.stars) && Number.isFinite(value.score)) {
        record.stars = Math.min(STAR.MAX, Math.max(0, Math.floor(value.stars)));
        record.score = Math.max(0, Math.floor(value.score));
      }
    });
  } else {
    // 更早版本只记录"通关了哪些游戏"，没有分关星级
    const legacy = JSON.parse(localStorage.getItem('wande-dao-completed') || '[]');
    if (Array.isArray(legacy)) legacy.forEach(id => {
      if (!progress[id]) return;
      for (let i = 0; i < Math.min(id === 'runner' ? 1 : 3, progress[id].length); i++) progress[id][i].stars = 1;
    });
  }
  sound = localStorage.getItem('wande-dao-sound') === 'true';
} catch { /* 隐私模式：进度只在本次会话内有效，不影响游玩 */ }

const home = mountHome(document, manifests, progress);

function persist() {
  try { localStorage.setItem('wande-dao-progress-v2', JSON.stringify(progress)); }
  catch { /* 配额超限或隐私模式：静默降级，绝不阻塞游玩 */ }
}

/* ============================================================ 合成音效 */

/**
 * 合成音：零字节资源、零加载延迟，是本项目的默认音效通道。
 * 将来加入真实音频文件时，AudioManager 应优先取文件、缺失时回落到这里。
 * @param {string} type 对应 enums.js 的 SFX 枚举（'click' | 'win' | 'lose' | 'fall'）
 */
function playTone(type = 'click') {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const now = audio.currentTime;

    if (type === 'shoot') {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(now); osc.stop(now + 0.08);
      return;
    }

    if (type === 'hit') {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(now); osc.stop(now + 0.09);
      return;
    }

    if (type === 'powerup') {
      const notes = [440, 554, 659, 880];
      notes.forEach((hz, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), at = now + i * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.035, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(at); osc.stop(at + 0.13);
      });
      return;
    }

    if (type === 'pour') {
      const notes = [380, 440, 520];
      notes.forEach((hz, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(), at = now + i * 0.04;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, at);
        osc.frequency.linearRampToValueAtTime(hz + 60, at + 0.04);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.03, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(at); osc.stop(at + 0.07);
      });
      return;
    }

    const notes = type === 'win' ? [523, 659, 784, 1047]
      : type === 'fall' ? [440, 660]
        : type === 'lose' ? [220, 164] : [620];
    notes.forEach((hz, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = now + i * .085;
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.035, at + .01);
      gain.gain.exponentialRampToValueAtTime(.001, at + .17);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(at); oscillator.stop(at + .18);
    });
  } catch { /* 音频是可选增强，失败不影响游戏 */ }
}

function triggerConfetti() {
  if (motion.matches || typeof document === 'undefined' || !dialog?.appendChild) return;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:99;border-radius:inherit;';
    const rect = dialog.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    canvas.width = rect.width;
    canvas.height = rect.height;
    dialog.appendChild(canvas);
    const ctx = canvas.getContext?.('2d');
    if (!ctx) { canvas.remove(); return; }
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'];
    const particles = Array.from({ length: 40 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 60,
      y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 10,
      vy: -(Math.random() * 8 + 4),
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    }));
    let startTime = performance.now();
    function step(time) {
      const elapsed = (time - startTime) / 1000;
      if (elapsed > 1.2 || !canvas.parentNode) {
        canvas.remove();
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.rotation += p.vRot;
        p.alpha = Math.max(0, 1 - elapsed / 1.2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  } catch { /* 动效可选 */ }
}

function soundLabel() {
  $('#sound-toggle').textContent = t(sound ? 'dialog.soundOn' : 'dialog.soundOff');
  $('#sound-toggle').setAttribute('aria-pressed', String(sound));
}
soundLabel();
$('#sound-toggle').addEventListener('click', () => {
  sound = !sound; soundLabel();
  try { localStorage.setItem('wande-dao-sound', String(sound)); } catch { /* 同上 */ }
  playTone();
});

/* ============================================================ 命名与难度 */

const gameTitle = manifest => t(manifest.titleKey);

/** 难度显示名。关卡数据里的 difficulty 是稳定机器值，必须经字典转换后显示。 */
const DIFFICULTY_KEYS = {
  [DIFFICULTY.ENTRY]: 'common.difficultyEntry',
  [DIFFICULTY.ADVANCED]: 'common.difficultyAdvanced',
  [DIFFICULTY.CHALLENGE]: 'common.difficultyChallenge',
};
const difficultyLabel = difficulty => (DIFFICULTY_KEYS[difficulty] ? t(DIFFICULTY_KEYS[difficulty]) : difficulty);

function levelTitle(config) {
  return config?.titleKey ? t(config.titleKey) : (config?.title ?? '');
}

/* ============================================================ 游戏会话 */

let active = null;
let loadRequest = 0;

/** 未解锁关卡判定：第一个没有星级的关卡就是可玩到的最远关卡 */
function unlockedLevel(id) {
  const index = progress[id].findIndex(record => record.stars === 0);
  return index < 0 ? progress[id].length - 1 : index;
}

/**
 * 打开游戏。**没有任何游戏专属分支** —— 全部由 manifest 驱动。
 * @param {string} id
 */
async function openGame(id) {
  const manifest = registry.get(id);
  if (!manifest) { console.error(`[app] 未注册的游戏: ${id}`); return; }
  if (!dialog.open) dialog.showModal();
  try {
    await startLevel(manifest, unlockedLevel(id));
  } catch (error) {
    // 开局失败必须可见：静默失败会表现成"点了没反应"，极难排查
    console.error(`[app] 打开游戏 '${id}' 失败`, error);
    status.textContent = t('status.gameUnavailable');
    status.classList.add('fail');
    dialog.dataset.game = id;
    $('#game-title').textContent = gameTitle(manifest);
  }
}

/** 创建/重建当前关卡的对局 */
async function startLevel(manifest, level) {
  try {
    await mountLevel(manifest, level);
  } catch (error) {
    console.error(`[app] 开局失败: ${manifest.id}`, error);
    active?.session?.destroy();
    active = null;
    status.textContent = t('status.gameUnavailable');
    status.classList.add('fail');
  }
}

async function mountLevel(manifest, level) {
  const request = ++loadRequest;
  stopAnimation();
  active?.session?.destroy();
  active = null;
  area.innerHTML = '';
  area.inert = false;
  $('#pause-overlay').hidden = true;
  dialog.dataset.game = manifest.id;
  $('#game-title').textContent = gameTitle(manifest);
  updateHud([]);
  $('#level-picker').innerHTML = '';
  $('#result-panel').hidden = true;
  nextButton.hidden = startButton.hidden = true;
  hintButton.hidden = undoButton.hidden = true;
  status.textContent = t('status.loadingGame');
  status.classList.remove('fail');

  let loaders;
  try {
    loaders = await registry.resolve(manifest.id);
  } catch (error) {
    if (request !== loadRequest || !dialog.open) return;
    console.error(`[app] 游戏加载失败: ${manifest.id}`, error);
    status.textContent = t('status.gameUnavailable');
    status.classList.add('fail');
    return;
  }
  if (request !== loadRequest || !dialog.open) return;
  if (!Array.isArray(loaders.levels) || loaders.levels.length !== manifest.levelCount) {
    throw new Error(`[app] ${manifest.id}: levelCount does not match loaded levels`);
  }
  const session = createSession({
    gameId: manifest.id,
    level,
    Engine: loaders.Engine,
    createRenderer: loaders.createRenderer,
    ctx: sessionContext(manifest.theme),
    timeDriven: manifest.timeDriven,
  });

  active = { manifest, session, level, levels: loaders.levels, highlight: null };
  dialog.dataset.game = manifest.id;
  $('#game-title').textContent = gameTitle(manifest);
  $('#game-category').textContent = `${manifest.order ?? '—'} / ${t(`nav.${manifest.category}`)}`;
  $('#game-instruction').textContent = t(manifest.controlsKey);
  $('#level-label').textContent = t('dialog.levelLabel', {
    title: levelTitle(active.levels[level]),
    difficulty: difficultyLabel(session.engine.config?.difficulty),
  });
  $('#result-panel').hidden = true;
  nextButton.hidden = true;
  // 需要"开始"的游戏才显示开始按钮（引擎实现了 start）
  const needsStart = typeof session.engine.start === 'function';
  startButton.hidden = !needsStart;
  startButton.classList.add('primary');
  startButton.classList.remove('secondary');
  startButton.innerHTML = `${t('dialog.start')} <span>→</span>`;
  hintButton.hidden = typeof session.engine.hint !== 'function';
  undoButton.hidden = typeof session.engine.undo !== 'function';
  $('.helper-tools > span').textContent = assistGoal(session.engine);

  // 必须传 session.ctx：渲染器通过 ctx.dispatch 回报玩家操作。
  // 传错对象的表现是"点了完全没反应"且无任何报错 —— 这里做一次显式检查。
  if (typeof session.ctx.dispatch !== 'function') {
    console.error('[app] 注入上下文缺少 dispatch，玩家操作将无法上报');
  }
  session.renderer.setReducedMotion?.(motion.matches);
  session.renderer.mount(area, session.engine, session.ctx);
  renderPicker();
  dialog.scrollTop = 0;
  updateStatus(true);
  (needsStart ? startButton : area).focus?.({ preventScroll: true });
}

/** 辅助目标说明：按引擎能力拼装，不写死游戏名 */
function assistGoal(engine) {
  if (typeof engine.assistGoal === 'function') return engine.assistGoal();
  if (engine.config?.stars) return t('dialog.assistGoalRunner', { n: engine.config.stars[2] });
  if (typeof engine.undo === 'function') return t('dialog.assistGoalScrews');
  if (typeof engine.hint === 'function') return t('dialog.assistGoalPins');
  return t('dialog.assistQuote');
}

/** 关卡选择器 */
function renderPicker() {
  const { manifest, level: current, levels } = active;
  const picker = $('#level-picker');
  const max = unlockedLevel(manifest.id);
  picker.innerHTML = Array.from(levels, (config, i) => {
    const stars = progress[manifest.id][i].stars;
    const locked = i > max;
    return `<button class="level-chip ${i === current ? 'selected' : ''} ${stars ? 'cleared' : ''}" data-level="${i}" ${locked ? 'disabled' : ''} aria-label="${t('dialog.levelChipLabel', { n: i + 1, title: levelTitle(config) })}${locked ? t('dialog.levelLocked') : ''}" aria-pressed="${i === current}"><span>${locked ? '·' : i + 1}</span><small>${stars ? starRow(stars).filled.join('') : locked ? t('dialog.levelPending') : t('dialog.levelChallenge')}</small></button>`;
  }).join('');
  picker.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
    startLevel(manifest, Number(button.dataset.level));
  }));
}

/* ============================================================ 交互分派 */

/**
 * 注入给游戏的上下文。**每次开局都新建**，并把 dispatch 一起放进去 ——
 * 渲染器通过它把"玩家点了什么"回报给宿主。
 */
function sessionContext(theme = null) {
  return { ...gameContext, theme, dispatch, togglePause };
}

/**
 * 渲染器不判定规则，只把"玩家点了什么"回报到这里。
 * 本函数把它转成引擎调用，并统一处理副作用（音效、重绘、结算）。
 * @param {import('./src/core/contracts.js').GameAction} action
 */
function dispatch(action) {
  if (!active || !action || typeof action.type !== 'string' || !Array.isArray(action.args)) return;
  const { session } = active;
  if (session.paused) return;
  const engine = session.engine;
  if (typeof engine[action.type] !== 'function') {
    console.warn(`[app] 引擎不认识的动作: ${action.type}`);
    return;
  }
  const args = action.args;
  const previousMoves = engine.moves;
  if (!engine[action.type](...args)) {
    session.renderer.draw(engine);
    updateStatus(true);
    return;
  }

  active.highlight = null;
  session.renderer.draw(engine, { falling: engine.event?.fallen ? engine.event.id : null });
  if (engine.status === ENGINE_STATUS.PLAYING) {
    if (engine.event?.type === 'pour' && engine.moves !== previousMoves) {
      playTone('pour');
    } else {
      playTone(engine.event?.fallen ? 'fall' : 'click');
    }
  }
  const outcome = session.poll();
  settle(outcome);
  updateStatus(true);
}

/* ============================================================ HUD 与状态 */

function updateStatus(force = false) {
  if (!active) return;
  const { engine, paused } = active.session;
  const stage = paused ? 'paused' : engine.status;
  if (dialog.dataset.stage !== stage) dialog.dataset.stage = stage;
  const text = paused ? t('status.paused') : engine.message;
  if (force || status.textContent !== text) status.textContent = text;
  const failed = engine.status === ENGINE_STATUS.LOST;
  if (status.classList.contains('fail') !== failed) status.classList.toggle('fail', failed);

  const playing = engine.status === ENGINE_STATUS.PLAYING;
  const hintDisabled = paused || !playing;
  const undoDisabled = paused || (!playing && !failed)
    || (typeof engine.canUndo === 'function' ? !engine.canUndo()
      : (typeof engine.undos === 'number' && engine.undos >= 1)
        || (Array.isArray(engine.history) && !engine.history.length));
  if (hintButton.disabled !== hintDisabled) hintButton.disabled = hintDisabled;
  if (undoButton.disabled !== undoDisabled) undoButton.disabled = undoDisabled;

  updateHud(typeof engine.hud === 'function' ? engine.hud() : []);
}

/**
 * 结算。**只在这里写进度**，且 session.poll() 保证每次结束只返回一次结果 ——
 * 重复结算会让分数翻倍、重复播放音效（旧实现用 lastStatus 手工防重，容易漏）。
 */
function settle(outcome) {
  if (!outcome || !active) return;
  stopAnimation();
  const record = progress[active.manifest.id][active.level];
  active.isBest = outcome.event === 'win' && outcome.score > record.score;
  const stars = Math.max(record.stars, outcome.stars);
  const starsChanged = stars !== record.stars;
  record.stars = stars;
  record.score = Math.max(record.score, outcome.score);
  persist();
  if (starsChanged) {
    home.updateProgress(active.manifest.id);
    renderPicker();
  }
  playTone(outcome.event === 'win' ? 'win' : 'lose');
  if (outcome.event === 'win') triggerConfetti();

  dialog.dataset.stage = active.session.status;
  renderResult(outcome);
  const nextAction = nextButton.hidden ? startButton : nextButton;
  nextAction.focus?.({ preventScroll: true });
  $('#result-panel').scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
}

function renderResult(outcome) {
  if (!active || !outcome) return;
  const isWin = outcome.status === ENGINE_STATUS.WON || outcome.event === 'win';
  const isFinal = isWin && progress[active.manifest.id].every(record => record.stars > 0);
  const row = starRow(outcome.stars);
  const metrics = resultDetail(active.session.engine);
  // 失败时也要给出可用的信息（如"抵达 26 人 / 需要 110"），而不是一句空话 ——
  // 玩家需要知道差多少，否则只会觉得"这游戏没法赢"。
  const detail = isWin
    ? metrics
    : [metrics, t('status.tryAnotherRoute')].filter(Boolean).join(' · ');
  // 失败局分数为 0，不显示"0 分"以免看起来像结算出错
  const score = outcome.score > 0
    ? `<strong>${outcome.score.toLocaleString()}<small> ${t('result.score')}</small></strong>`
    : '';
  $('#result-panel').hidden = false;
  $('#result-panel').innerHTML = `<h3 class="result-title">${t(isFinal ? 'result.campaignComplete' : isWin ? 'result.cleared' : 'result.retryTitle')}</h3><div class="result-stars" aria-label="${t('dialog.starsLabel', { n: outcome.stars })}">${row.filled.join('')}<span>${row.empty.join('')}</span></div><div>${score}<p>${detail}</p>${active.isBest ? `<span class="record-badge">${t('result.newBest')}</span>` : ''}</div>`;
  nextButton.hidden = !isWin || active.level >= active.manifest.levelCount - 1;
  startButton.hidden = false;
  startButton.innerHTML = `${t(isWin ? 'dialog.replay' : 'dialog.retry')} <span aria-hidden="true">↻</span>`;
  startButton.classList.toggle('primary', nextButton.hidden);
  startButton.classList.toggle('secondary', !nextButton.hidden);
  nextButton.classList.toggle('primary', true);
  nextButton.classList.toggle('secondary', false);
}

/** 结果明细：由引擎的 metrics() 驱动，宿主不做游戏专属判断 */
function resultDetail(engine) {
  const metrics = typeof engine.metrics === 'function' ? engine.metrics() : {};
  const parts = [];
  if (metrics.arrived !== undefined) parts.push(t('result.runnerDetail', { arrived: metrics.arrived, peak: metrics.peak ?? metrics.arrived }));
  if (metrics.kills !== undefined) parts.push(t('result.kills', { n: metrics.kills }));
  if (metrics.upgrades !== undefined) parts.push(t('result.upgrades', { n: metrics.upgrades }));
  if (metrics.moves !== undefined) parts.push(t('result.moves', { n: metrics.moves }));
  if (metrics.hints) parts.push(t('result.hints', { n: metrics.hints }));
  if (metrics.undos) parts.push(t('result.undos', { n: metrics.undos }));
  return parts.join(' · ');
}

/* ============================================================ 主循环 */

function stopAnimation() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousTime = null;
}

function scheduleFrame() {
  if (frame === null && active?.session.isPlaying && active.session.timeDriven) {
    frame = requestAnimationFrame(animate);
  }
}

function advanceFrame(delta) {
  const { session } = active;
  session.advance(delta);
  session.renderer.draw(session.engine);
  updateStatus();

  const evt = session.engine.event;
  if (evt && evt.at !== active.lastHandledAt) {
    active.lastHandledAt = evt.at;
    if (evt.type === 'upgrade') playTone('powerup');
    else if (evt.type === 'hit') playTone('hit');
    else if (evt.type === 'damage') playTone('fall');
  }

  const outcome = session.poll();
  settle(outcome);
  return Boolean(outcome);
}

function animate(timestamp) {
  frame = null;
  if (!active?.session.isPlaying || !active.session.timeDriven) return;
  const delta = previousTime === null ? 0 : (timestamp - previousTime) / 1000;
  previousTime = timestamp;
  if (!advanceFrame(delta)) scheduleFrame();
}

function togglePause() {
  if (!active) return;
  if (!active.session.togglePause()) return;
  const { paused } = active.session;
  area.inert = paused;
  $('#pause-overlay').hidden = !paused;
  active.session.renderer.draw(active.session.engine);
  const button = area.querySelector('.runner-pause');
  if (button) {
    button.textContent = t(paused ? 'dialog.resume' : 'dialog.pause');
    button.setAttribute('aria-label', t(paused ? 'dialog.resumeLabel' : 'dialog.pauseLabel'));
  }
  stopAnimation();
  updateStatus(true);
  (paused ? $('#resume-game') : area).focus?.({ preventScroll: true });
  scheduleFrame();
}

/* ============================================================ 顶部按钮 */

$('#resume-game').addEventListener('click', () => { if (active?.session.paused) togglePause(); });

hintButton.addEventListener('click', () => {
  if (!active || active.session.paused) return;
  active.highlight = active.session.hint();
  active.session.renderer.draw(active.session.engine, { highlight: active.highlight });
  updateStatus(true);
});
undoButton.addEventListener('click', () => {
  if (!active || active.session.paused || !active.session.undo()) return;
  active.highlight = null;
  $('#result-panel').hidden = true;
  nextButton.hidden = true;
  startButton.hidden = active.session.status !== ENGINE_STATUS.READY;
  active.session.renderer.draw(active.session.engine);
  updateStatus(true);
  playTone();
});
startButton.addEventListener('click', async () => {
  if (!active) return;
  if (active.session.status !== ENGINE_STATUS.READY) {
    const { manifest, level } = active;
    await startLevel(manifest, level);
    if (!active || active.manifest !== manifest || active.level !== level) return;
  }
  active.session.start();
  startButton.hidden = true;
  area.focus?.({ preventScroll: true });
  active.session.renderer.draw(active.session.engine);
  updateStatus(true);
  settle(active.session.poll());
  dialog.scrollTop = 0;
  scheduleFrame();
});

/**
 * 调试出口。**不参与任何玩法逻辑**，只用于排查与自动化验证。
 * 在浏览器控制台可用：
 *   __dsh.debug()        查看当前会话状态
 *   __dsh.step(0.1)      手动推进一帧（等价于 rAF 回调，用于无头环境验证）
 *   __dsh.pump(3)        连续推进约 3 秒
 *
 * 之所以需要 step/pump：无头浏览器里 requestAnimationFrame 只回调一次，
 * 无法用 --dump-dom 验证"逐帧推进 → HUD 变化 → 结算"这条链路。
 * step/pump 复用与 animate 完全相同的代码路径，因此验证结论对真实环境同样成立。
 */
window.__dsh = {
  get session() { return active?.session ?? null; },
  get state() {
    if (!active) return null;
    const s = active.session;
    return {
      gameId: s.gameId, level: s.level, status: s.engine.status, timeDriven: s.timeDriven,
      paused: s.paused, isPlaying: s.isPlaying, isOver: s.isOver, elapsed: s.elapsed,
      frameScheduled: frame !== null, message: s.engine.message,
    };
  },
  debug() { console.table(this.state); return this.state; },
  /** 推进一帧（秒）。复用 animate 的核心步骤，不含 rAF 调度。 */
  step(delta = 0.1) {
    return active?.session.isPlaying ? advanceFrame(delta) : false;
  },
  /** 连续推进 seconds 秒（按 0.1 秒一帧），返回是否在过程中结算 */
  pump(seconds = 1) {
    let settled = false;
    for (let t = 0; t < seconds; t += 0.1) { if (this.step(0.1)) { settled = true; break; } }
    return settled;
  },
};
$('#restart').addEventListener('click', () => { if (active) startLevel(active.manifest, active.level); });
nextButton.addEventListener('click', () => {
  if (!active || active.session.status !== ENGINE_STATUS.WON) return;
  if (active.level < active.manifest.levelCount - 1) startLevel(active.manifest, active.level + 1);
});
$('#close-game').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  loadRequest++;
  stopAnimation();
  active?.session?.destroy();       // 必须解绑渲染器监听器，否则多次开关会持续累积
  active = null;
});

/* ============================================================ 键盘与后台 */

document.addEventListener('keydown', event => {
  if (!dialog.open || !active) return;
  if (event.target?.closest?.('input, textarea, select, [contenteditable]')) return;
  const engine = active.session.engine;
  // 保留按钮上的 Enter/Space 激活；空格只在场景上用于暂停
  if (event.key === ' ' && event.target.closest('button')) return;
  if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D', ' '].includes(event.key)) event.preventDefault();
  if (typeof engine.chooseSide === 'function') {
    if (['ArrowLeft', 'a', 'A'].includes(event.key)) dispatch({ type: 'chooseSide', args: [0] });
    if (['ArrowRight', 'd', 'D'].includes(event.key)) dispatch({ type: 'chooseSide', args: [1] });
  }
  if (event.key === ' ' && !event.repeat) togglePause();
  if (!active.session.isPlaying) active.session.renderer.draw(engine);
});

document.addEventListener('visibilitychange', () => {
  // 切后台自动暂停：只对需要连续帧的游戏有意义（纯点击玩法本来就静止）
  if (document.hidden && active?.session.timeDriven && !active.session.paused) togglePause();
});

/* ============================================================ 语言 */

function renderTopbarLanguage() {
  const select = $('#language-select');
  if (!select) return;
  select.innerHTML = localeOptions().map(option =>
    `<option value="${option.code}" ${option.selected ? 'selected' : ''}>${option.label}</option>`).join('');
  select.setAttribute('aria-label', t('nav.language'));
  const meta = getLocaleMeta();
  select.title = meta.status === 'beta' ? `${meta.label} (${meta.status})` : meta.label;
}

/**
 * 切换语言后必须重渲染**动态文案**：卡片、关卡选择器、状态栏、HUD、结果面板
 * 里的文字是 JS 生成的，data-i18n 管不到它们。
 * 正在进行的对局不重建（会丢进度）：引擎的渐进式文案保留原文，下次操作自然更新。
 */
function onLanguageChanged() {
  soundLabel();
  renderTopbarLanguage();
  home.translate();
  if (!active) return;
  $('#game-title').textContent = gameTitle(active.manifest);
  $('#game-category').textContent = `${active.manifest.order ?? '—'} / ${t(`nav.${active.manifest.category}`)}`;
  $('#game-instruction').textContent = t(active.manifest.controlsKey);
  $('#level-label').textContent = t('dialog.levelLabel', {
    title: levelTitle(active.levels[active.level]),
    difficulty: difficultyLabel(active.session.engine.config?.difficulty),
  });
  $('.helper-tools > span').textContent = assistGoal(active.session.engine);
  startButton.innerHTML = `${t(active.session.status === ENGINE_STATUS.READY ? 'dialog.start' : 'dialog.again')} <span>${active.session.status === ENGINE_STATUS.READY ? '→' : '↻'}</span>`;
  renderPicker();
  active.session.renderer.draw(active.session.engine, { highlight: active.highlight });
  if (active.session.outcome) renderResult(active.session.outcome);
  const pauseButton = area.querySelector('.runner-pause');
  if (pauseButton) pauseButton.textContent = t(active.session.paused ? 'dialog.resume' : 'dialog.pause');
  updateStatus(true);
}

$('#language-select')?.addEventListener('change', event => {
  if (!setLocale(event.target.value)) return;
  onLanguageChanged();
});

motion.addEventListener?.('change', () => {
  active?.session.renderer.setReducedMotion?.(motion.matches);
  if (active) active.session.renderer.draw(active.session.engine);
});

/* ============================================================ 启动 */

/**
 * 打开游戏的入口用**事件委托**，而不是给每个按钮单独绑定。
 *
 * 首页卡片和主视觉入口共用同一个监听器。
 */
function delegateOpen(container) {
  if (!container) return;
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-open]');
    if (!button || !container.contains(button)) return;
    const id = button.dataset.open;
    if (id) openGame(id);
  });
}
delegateOpen(document);

renderTopbarLanguage();
