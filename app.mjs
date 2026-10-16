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
  t, initLocale, setLocale, onLocaleChange, localeOptions, getLocaleMeta, applyToDocument,
} from './src/core/i18n.js';
import { BUNDLES } from './src/locales/index.js';
import { ENGINE_STATUS, HUD_TONE } from './src/core/enums.js';
import { DIFFICULTY, STAR, starRow, TONE_CLASS } from './src/core/labels.js';

const $ = selector => document.querySelector(selector);

// 语言必须在渲染任何界面文案之前初始化：先读 ?lang=，再读持久化设置，最后读浏览器语言。
initLocale();

const dialog = $('#game-dialog'), area = $('#play-area'), status = $('#game-status');
const startButton = $('#start-game'), nextButton = $('#next-level');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

let filter = 'all';
let sound = false;
let audio = null;
let frame = 0;
let previousTime = 0;

/* ============================================================ 注册表 */

const registry = createRegistry();
const { loaded, failed } = await registry.load(MODULES);
if (failed) console.warn(`[app] ${loaded} 个游戏加载成功，${failed} 个被跳过（详见上方 registry 错误）`);

/** 只缓存玩家已经打开的游戏；首页不加载关卡、引擎或渲染器。 */
const resolved = new Map();

/* ============================================================ 注入上下文 */

/**
 * 游戏唯一的外部能力通道（契约里的 GameContext）。
 * 游戏**不允许**直接 import 宿主服务，只能从构造参数拿到这个对象。
 */
const gameContext = {
  t,
  sfx: name => playTone(name),
  toast: message => { status.textContent = message; },
  theme: null,                 // 每次开局按 manifest.theme 填入
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
const levelCounts = {};
for (const manifest of registry.list()) {
  levelCounts[manifest.id] = manifest.levelCount;
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
    const notes = type === 'win' ? [523, 659, 784, 1047]
      : type === 'fall' ? [440, 660]
        : type === 'lose' ? [220, 164] : [620];
    notes.forEach((hz, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .085;
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.035, at + .01);
      gain.gain.exponentialRampToValueAtTime(.001, at + .17);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(at); oscillator.stop(at + .18);
    });
  } catch { /* 音频是可选增强，失败不影响游戏 */ }
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

/**
 * 某个文案键在**所有已支持语言**下的取值。
 * 用于搜索索引：只索引当前语言的名称会让"换个语言就搜不到"。
 */
function allTitles(key) {
  return Object.values(BUNDLES).map(bundle => bundle[key]).filter(Boolean);
}

/** 关卡显示名。新实现给 titleKey，旧实现（pins/screws 待迁移）给 title —— 两种都支持。 */
function manifestTitles(id) {
  return (resolved.get(id)?.levels ?? []).map(config =>
    (config.titleKey ? t(config.titleKey) : (config.title ?? '')));
}

/* ============================================================ 首页渲染 */

/**
 * 卡片由注册表 + HTML `<template>` 生成。
 * 模板留在 index.html 的原因：文案键仍能被 T4 扫描器检查到 ——
 * 如果整段卡片写在 JS 模板字符串里，键写错要到运行时才发现。
 */
function renderCards() {
  const grid = $('#game-grid'), template = $('#game-card-template');
  if (!grid || !template) return;
  grid.innerHTML = '';

  for (const manifest of registry.list()) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.game = manifest.id;
    node.dataset.category = manifest.category;
    node.querySelector('.new-badge').hidden = !manifest.isNew;
    const clearedLevels = progress[manifest.id].filter(record => record.stars > 0).length;
    node.querySelector('.card-progress i').style.width = `${clearedLevels / manifest.levelCount * 100}%`;
    // 搜索索引包含**所有语言**的名称 + id + 标签：
    // 中文界面下搜 "unscrew"、英文界面下搜 "螺丝" 都应该能找到 ——
    // 玩家不记得当前界面用的是哪种语言。
    node.dataset.name = [
      ...allTitles(manifest.titleKey),
      manifest.id,
      manifest.category,
      ...(manifest.tags ?? []),
    ].join(' ').toLowerCase();
    node.querySelector('.card-number').textContent = `${manifest.order ?? '—'} / ${t(`nav.${manifest.category}`)}`;
    node.querySelector('h3').textContent = t(manifest.titleKey);
    const badge = node.querySelector('.badge');
    badge.dataset.i18nParams = `n:${progress[manifest.id].filter(record => record.stars > 0).length},total:${levelCounts[manifest.id]}`;
    node.querySelector('.card-body p').dataset.i18n = manifest.taglineKey;
    node.querySelector('.card-footer > span').textContent = manifest.cardMetaKey ? t(manifest.cardMetaKey) : '';
    for (const button of node.querySelectorAll('[data-open]')) {
      button.dataset.open = manifest.id;
      button.setAttribute('aria-label', t(manifest.artLabelKey ?? 'home.cardArtLabel', { title: t(manifest.titleKey) }));
    }
    node.querySelector('.card-art').style.setProperty('--accent', manifest.theme?.accent ?? '#88898c');
    const preview = node.querySelector('.card-preview');
    if (manifest.preview) preview.setAttribute('src', manifest.preview);
    else preview.hidden = true;
    grid.append(node);
  }
  applyToDocument(grid);
  filterGames();
}

function homeProgress() {
  const cleared = Object.values(progress).filter(records => records.every(record => record.stars > 0)).length;
  $('#completed-label').dataset.i18nParams = `n:${cleared},total:${registry.size}`;
  $('#completed-label').innerHTML = t('progress.completed', {
    n: `<strong id="completed-count">${cleared}</strong>`,
    total: registry.size,
  });
  $('#nav-game-count').textContent = String(registry.size).padStart(2, '0');
  $('#library-game-count').textContent = String(registry.size).padStart(2, '0');
  $('#library-level-count').textContent = Object.values(levelCounts).reduce((sum, n) => sum + n, 0);
  $('#library-star-count').textContent = Object.values(progress).flat().length * STAR.MAX;
  const stars = Object.values(progress).flat().reduce((sum, record) => sum + record.stars, 0);
  $('#star-count').textContent = t('progress.stars', { n: stars, total: Object.values(progress).flat().length * STAR.MAX });
}

function renderFooterYear() {
  const node = $('#footer-year');
  if (node) {
    const year = new Date().getFullYear();
    node.dataset.i18nParams = `year:${year}`;
    node.textContent = t('app.footerCopyright', { year });
  }
}

/* ============================================================ 筛选与搜索 */

function filterGames() {
  const query = $('#search').value.trim().toLowerCase();
  let count = 0;
  document.querySelectorAll('.game-card').forEach(card => {
    card.hidden = (filter !== 'all' && card.dataset.category !== filter) || !card.dataset.name.includes(query);
    if (!card.hidden) count++;
  });
  $('#game-count').textContent = String(count).padStart(2, '0');
  $('#empty-state').hidden = count > 0;
}

document.querySelectorAll('[data-filter]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => {
      other.classList.toggle('active', other === button);
      other.setAttribute('aria-pressed', String(other === button));
    });
    filterGames();
  });
});
$('#search').addEventListener('input', filterGames);

/* ============================================================ 游戏会话 */

/** @type {{manifest: object, session: object, level: number, paused: boolean, highlight: unknown}|null} */
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
  cancelAnimationFrame(frame);
  previousTime = 0;
  active?.session?.destroy();
  active = null;
  area.innerHTML = '';
  dialog.dataset.game = manifest.id;
  $('#game-title').textContent = gameTitle(manifest);
  $('#game-hud').innerHTML = '';
  $('#level-picker').innerHTML = '';
  $('#result-panel').hidden = true;
  nextButton.hidden = startButton.hidden = true;
  $('#hint-button').hidden = $('#undo-button').hidden = true;
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
  resolved.set(manifest.id, loaders);

  gameContext.theme = manifest.theme ?? null;
  const session = createSession({
    gameId: manifest.id,
    level,
    Engine: loaders.Engine,
    createRenderer: loaders.createRenderer,
    ctx: sessionContext(),
    timeDriven: manifest.timeDriven,
  });

  active = { manifest, session, level, paused: false, highlight: null };
  dialog.dataset.game = manifest.id;
  $('#game-title').textContent = gameTitle(manifest);
  $('#game-category').textContent = `${manifest.order ?? '—'} / ${t(`nav.${manifest.category}`)}`;
  $('#game-instruction').textContent = t(manifest.controlsKey);
  $('#level-label').textContent = t('dialog.levelLabel', {
    title: manifestTitles(manifest.id)[level] ?? '',
    difficulty: difficultyLabel(session.engine.config?.difficulty),
  });
  $('#result-panel').hidden = true;
  nextButton.hidden = true;
  // 需要"开始"的游戏才显示开始按钮（引擎实现了 start）
  const needsStart = typeof session.engine.start === 'function';
  startButton.hidden = !needsStart;
  startButton.innerHTML = `${t('dialog.start')} <span>→</span>`;
  $('#hint-button').hidden = typeof session.engine.hint !== 'function';
  $('#undo-button').hidden = typeof session.engine.undo !== 'function';
  $('.helper-tools > span').textContent = assistGoal(session.engine);

  // 必须传 session.ctx：渲染器通过 ctx.dispatch 回报玩家操作。
  // 传错对象的表现是"点了完全没反应"且无任何报错 —— 这里做一次显式检查。
  if (typeof session.ctx.dispatch !== 'function') {
    console.error('[app] 注入上下文缺少 dispatch，玩家操作将无法上报');
  }
  session.renderer.mount(area, session.engine, session.ctx);
  session.renderer.setReducedMotion?.(motion.matches);
  renderPicker(manifest, level);
  dialog.scrollTop = 0;
  updateStatus(true);
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
function renderPicker(manifest, current) {
  const picker = $('#level-picker');
  const max = unlockedLevel(manifest.id);
  const titles = manifestTitles(manifest.id);
  picker.innerHTML = Array.from({ length: levelCounts[manifest.id] }, (_, i) => {
    const stars = progress[manifest.id][i].stars;
    const locked = i > max;
    return `<button class="level-chip ${i === current ? 'selected' : ''} ${stars ? 'cleared' : ''}" data-level="${i}" ${locked ? 'disabled' : ''} aria-label="${t('dialog.levelChipLabel', { n: i + 1, title: titles[i] ?? '' })}${locked ? t('dialog.levelLocked') : ''}" aria-pressed="${i === current}"><span>${locked ? '·' : i + 1}</span><small>${stars ? starRow(stars).filled.join('') : locked ? t('dialog.levelPending') : t('dialog.levelChallenge')}</small></button>`;
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
function sessionContext() {
  return { ...gameContext, dispatch, togglePause };
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
  if (!engine[action.type](...args)) return;

  active.highlight = null;
  session.renderer.draw(engine, { falling: engine.event?.fallen ? engine.event.id : null });
  if (engine.status === ENGINE_STATUS.PLAYING) playTone(engine.event?.fallen ? 'fall' : 'click');
  const outcome = session.poll();
  settle(outcome);
  updateStatus(true);
}

/* ============================================================ HUD 与状态 */

function updateStatus(force = false) {
  if (!active) return;
  const engine = active.session.engine;

  const text = active.paused ? t('status.paused') : engine.message;
  if (force || status.textContent !== text) status.textContent = text;
  status.classList.toggle('fail', engine.status === ENGINE_STATUS.LOST);

  $('#hint-button').disabled = active.paused || engine.status !== ENGINE_STATUS.PLAYING;
  $('#undo-button').disabled = active.paused || ![ENGINE_STATUS.PLAYING, ENGINE_STATUS.LOST].includes(engine.status)
    || (typeof engine.canUndo === 'function' ? !engine.canUndo()
      : (typeof engine.undos === 'number' && engine.undos >= 1)
        || (Array.isArray(engine.history) && !engine.history.length));

  const fields = typeof engine.hud === 'function' ? engine.hud() : [];
  const markup = fields.map(({ label, value, tone }) =>
    `<div class="${tone && tone !== HUD_TONE.NORMAL ? `hud-${TONE_CLASS[tone]}` : ''}"><small>${label}</small><strong>${value}</strong></div>`).join('');
  if (active.hudMarkup !== markup) {
    $('#game-hud').style.setProperty('--hud-columns', Math.min(4, Math.max(1, fields.length)));
    $('#game-hud').innerHTML = markup;
    active.hudMarkup = markup;
  }
}

/**
 * 结算。**只在这里写进度**，且 session.poll() 保证每次结束只返回一次结果 ——
 * 重复结算会让分数翻倍、重复播放音效（旧实现用 lastStatus 手工防重，容易漏）。
 */
function settle(outcome) {
  if (!outcome || !active) return;
  const record = progress[active.manifest.id][active.level];
  record.stars = Math.max(record.stars, outcome.stars);   // 星级只升不降
  record.score = Math.max(record.score, outcome.score);
  persist();
  homeProgress();
  renderCards();
  renderPicker(active.manifest, active.level);
  playTone(outcome.event === 'win' ? 'win' : 'lose');

  const row = starRow(outcome.stars);
  const metrics = resultDetail(active.session.engine);
  // 失败时也要给出可用的信息（如"抵达 26 人 / 需要 110"），而不是一句空话 ——
  // 玩家需要知道差多少，否则只会觉得"这游戏没法赢"。
  const detail = outcome.event === 'win'
    ? metrics
    : [metrics, t('status.tryAnotherRoute')].filter(Boolean).join(' · ');
  // 失败局分数为 0，不显示"0 分"以免看起来像结算出错
  const score = outcome.score > 0
    ? `<strong>${outcome.score.toLocaleString()}<small> ${t('result.score')}</small></strong>`
    : '';
  $('#result-panel').hidden = false;
  $('#result-panel').innerHTML = `<div class="result-stars" aria-label="${t('dialog.starsLabel', { n: outcome.stars })}">${row.filled.join('')}<span>${row.empty.join('')}</span></div><div>${score}<p>${detail}</p></div>`;
  nextButton.hidden = outcome.event !== 'win' || active.level >= levelCounts[active.manifest.id] - 1;
}

/** 结果明细：由引擎的 metrics() 驱动，宿主不做游戏专属判断 */
function resultDetail(engine) {
  const metrics = typeof engine.metrics === 'function' ? engine.metrics() : {};
  const parts = [];
  if (metrics.arrived !== undefined) parts.push(t('result.runnerDetail', { arrived: metrics.arrived, peak: metrics.peak ?? metrics.arrived }));
  if (metrics.moves !== undefined) parts.push(t('result.moves', { n: metrics.moves }));
  if (metrics.hints) parts.push(t('result.hints', { n: metrics.hints }));
  if (metrics.undos) parts.push(t('result.undos', { n: metrics.undos }));
  return parts.join(' · ');
}

/* ============================================================ 主循环 */

/**
 * 只有引擎声明 timeDriven 的游戏才跑 rAF ——
 * 这是旧实现里 `if (active.id !== 'runner') return` 的契约化替代。
 */
function animate(timestamp) {
  if (!active || !active.session.isPlaying || !active.session.timeDriven) return;
  const session = active.session;
  const delta = previousTime ? (timestamp - previousTime) / 1000 : 0;
  previousTime = timestamp;

  session.advance(delta);
  session.renderer.draw(session.engine);
  updateStatus();             // 文案未变化时内部不会触碰 DOM（含 live region）

  const outcome = session.poll();
  if (outcome) {
    settle(outcome);
    startButton.hidden = false;
    startButton.innerHTML = `${t('dialog.again')} <span>↻</span>`;
    return;                   // 结束即停止 rAF；渲染器保留最后一帧
  }
  frame = requestAnimationFrame(animate);
}

function togglePause() {
  if (!active) return;
  if (!active.session.togglePause()) return;
  active.paused = active.session.paused;
  active.session.renderer.draw(active.session.engine);
  const button = area.querySelector('.runner-pause');
  if (button) {
    button.textContent = t(active.paused ? 'dialog.resume' : 'dialog.pause');
    button.setAttribute('aria-label', t(active.paused ? 'dialog.resumeLabel' : 'dialog.pauseLabel'));
  }
  cancelAnimationFrame(frame);
  previousTime = 0;
  updateStatus(true);
  if (!active.paused && active.session.timeDriven) frame = requestAnimationFrame(animate);
}

/* ============================================================ 顶部按钮 */

$('#hint-button').addEventListener('click', () => {
  if (!active || active.paused) return;
  active.highlight = active.session.hint();
  active.session.renderer.draw(active.session.engine, { highlight: active.highlight });
  updateStatus(true);
});
$('#undo-button').addEventListener('click', () => {
  if (!active || active.paused || !active.session.undo()) return;
  active.highlight = null;
  $('#result-panel').hidden = true;
  nextButton.hidden = true;
  active.session.renderer.draw(active.session.engine);
  updateStatus(true);
  playTone();
});
startButton.addEventListener('click', () => {
  if (!active) return;
  if (active.session.status !== ENGINE_STATUS.READY) { startLevel(active.manifest, active.level); return; }
  active.session.start();
  startButton.hidden = true;
  previousTime = 0;
  active.session.renderer.draw(active.session.engine);
  updateStatus(true);
  settle(active.session.poll());
  dialog.scrollTop = 0;
  // 调试出口：排查"点了开始但画面不动"这类问题时会用到
  // （浏览器控制台执行 __dsh.debug() 可看到当前会话状态）
  if (active.session.timeDriven) frame = requestAnimationFrame(animate);
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
      frameScheduled: frame !== 0, message: s.engine.message,
    };
  },
  debug() { console.table(this.state); return this.state; },
  /** 推进一帧（秒）。复用 animate 的核心步骤，不含 rAF 调度。 */
  step(delta = 0.1) {
    if (!active || !active.session.isPlaying) return false;
    const session = active.session;
    session.advance(delta);
    session.renderer.draw(session.engine);
    updateStatus();
    const outcome = session.poll();
    if (outcome) { settle(outcome); updateStatus(true); return true; }
    return false;
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
  if (active.level < levelCounts[active.manifest.id] - 1) startLevel(active.manifest, active.level + 1);
});
$('#close-game').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  loadRequest++;
  cancelAnimationFrame(frame);
  active?.session?.destroy();       // 必须解绑渲染器监听器，否则多次开关会持续累积
  active = null;
});

/* ============================================================ 键盘与后台 */

document.addEventListener('keydown', event => {
  if (!dialog.open || !active) return;
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
  renderTopbarLanguage();
  renderCards();
  homeProgress();
  renderFooterYear();
  if (!active) return;
  $('#game-title').textContent = gameTitle(active.manifest);
  $('#game-category').textContent = `${active.manifest.order ?? '—'} / ${t(`nav.${active.manifest.category}`)}`;
  $('#game-instruction').textContent = t(active.manifest.controlsKey);
  $('#level-label').textContent = t('dialog.levelLabel', {
    title: manifestTitles(active.manifest.id)[active.level] ?? '',
    difficulty: difficultyLabel(active.session.engine.config?.difficulty),
  });
  $('.helper-tools > span').textContent = assistGoal(active.session.engine);
  startButton.innerHTML = `${t(active.session.status === ENGINE_STATUS.READY ? 'dialog.start' : 'dialog.again')} <span>${active.session.status === ENGINE_STATUS.READY ? '→' : '↻'}</span>`;
  renderPicker(active.manifest, active.level);
  updateStatus(true);
}

$('#language-select')?.addEventListener('change', event => {
  if (!setLocale(event.target.value)) return;
  onLanguageChanged();
});

/* ============================================================ 启动 */

/**
 * 打开游戏的入口用**事件委托**，而不是给每个按钮单独绑定。
 *
 * 原因（真实踩过的坑）：卡片是 renderCards() 动态生成的，而卡片会在
 * 结算、切换语言、切换筛选时被重建。如果逐个 addEventListener，
 * 要么绑定时元素还不存在（点了没反应），要么重建后监听器丢失。
 * 委托一次绑定在稳定的祖先节点上，重建多少次都不会失效。
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
renderCards();
renderFooterYear();
homeProgress();
onLocaleChange(() => { /* 语言变更已在 change 处理里完成重渲染 */ });
