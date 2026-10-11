/**
 * i18n 运行时 —— 语言状态、翻译函数、DOM 应用、持久化。
 * ============================================================================
 * 约定（详见 docs/NAMING-CONVENTIONS.md）：
 *   R1 面向玩家的字符串必须有键，禁止在 .js/.html 里直接写文案字面量。
 *   R3 变量用 {name} 占位，禁止字符串拼接。
 *   R5 新增键必须补全所有 locale（tests/i18n.test.mjs 强制）。
 *
 * 两种用法：
 *   声明式（HTML 静态文案）：<h1 data-i18n="home.title1"></h1>
 *                             <input data-i18n-attr="aria-label:home.searchLabel">
 *   命令式（JS 动态文案）：  t('game.runner.win', { arrived, left, stars })
 *
 * 缺键行为：回落到默认语言；仍缺失则返回键名本身并在控制台告警一次。
 * **绝不返回空字符串** —— 空白文案比看得见的键名更难排查。
 */
import { DEFAULT_LOCALE, LOCALES, isSupportedLocale, localeMeta } from './locales.js';
import { bundleFor } from '../locales/index.js';

/** 语言设置的持久化键。经 StorageAdapter 之前先用 localStorage，与现有代码一致。 */
const SETTINGS_KEY = 'wande-dao-locale';

/** @type {string} */
let current = DEFAULT_LOCALE;
/** @type {Set<(code: string) => void>} */
const listeners = new Set();
/** 已告警过的缺键，避免每帧刷屏 */
const warned = new Set();

/* ------------------------------------------------------------------ 检测 */

/**
 * 从 navigator.language 推断初始语言。
 * 规则：精确匹配优先；`zh` 开头的任何变体（zh、zh-Hans、zh-TW）都先归到 zh-CN，
 * 其余未匹配的走英文 —— 中文站点的默认受众比英文更集中。
 */
function detectLocale() {
  try {
    const candidates = [navigator.language, ...(navigator.languages || [])];
    for (const raw of candidates) {
      if (!raw) continue;
      if (isSupportedLocale(raw)) return raw;
      const base = String(raw).toLowerCase();
      if (base.startsWith('zh')) return 'zh-CN';
      if (base.startsWith('en')) return 'en';
    }
  } catch { /* 非浏览器环境（测试/SSR）：用默认语言 */ }
  return DEFAULT_LOCALE;
}

/** 读取持久化语言；无效值一律忽略（用户可能手改过 localStorage）。 */
function readSaved() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved && isSupportedLocale(saved) ? saved : null;
  } catch { return null; }
}

/* ------------------------------------------------------------------ 核心 */

/**
 * 翻译。@param {string} key @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const bundle = bundleFor(current);
  let text = bundle[key];
  if (text === undefined) {
    text = bundleFor(DEFAULT_LOCALE)[key];
    if (text === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`[i18n] 缺少文案键: ${key}（语言 ${current}）—— 请补进 src/locales/*.js`);
      }
      return key;   // 返回键名而非空串：让问题在界面上可见
    }
  }
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    (params[name] === undefined ? match : String(params[name])));
}

/** @returns {string} 当前语言 code */
export function getLocale() { return current; }

/** @returns {object} 当前语言元数据（label / short / dir / status） */
export function getLocaleMeta() { return localeMeta(current); }

/**
 * 切换语言。幂等：传入当前语言不会重复通知。
 * @param {string} code
 * @param {{ persist?: boolean }} [opts] persist=false 用于测试
 * @returns {boolean} 是否发生了切换
 */
export function setLocale(code, opts = {}) {
  const next = isSupportedLocale(code) ? code : DEFAULT_LOCALE;
  if (next === current) return false;
  current = next;
  if (opts.persist !== false) {
    try { localStorage.setItem(SETTINGS_KEY, next); } catch { /* 隐私模式：只在本次会话生效 */ }
  }
  applyToDocument();
  listeners.forEach(listener => listener(next));
  return true;
}

/**
 * 订阅语言变更。返回取消订阅函数 —— 组件卸载时**必须**调用，
 * 否则宿主重构后会残留回调（与 renderer.destroy 同理）。
 * @param {(code: string) => void} listener
 * @returns {() => void}
 */
export function onLocaleChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------ DOM */

/**
 * 把语言应用到文档：
 *   1. <html lang> —— 影响屏幕阅读器发音与浏览器断词，必须同步
 *   2. <html dir>  —— 为将来的 RTL 语言预留
 *   3. [data-i18n] 的 textContent；可选 data-i18n-params="n:3,total:45" 提供插值参数
 *   4. [data-i18n-attr="attr:key,..."] 的属性文案（aria-label / placeholder / title）
 *
 * 注意：带参数的 data-i18n 会**覆盖元素内容**，所以元素里只能放文案，
 * 不能再嵌套需要保留的 DOM（如 <strong id="x">）。含动态子节点的位置请改用
 * 命令式 t() 自行渲染，或让子节点自己带 data-i18n。
 *
 * 找不到 document 时静默返回，便于在 Node 测试里调用。
 */
export function applyToDocument(root = typeof document === 'undefined' ? null : document) {
  if (!root) return;
  const meta = localeMeta(current);
  if (root.documentElement) {
    root.documentElement.lang = current;
    root.documentElement.dir = meta.dir;
  }
  root.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n, parseParams(node.dataset.i18nParams));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(node => {
    for (const pair of node.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map(part => part.trim());
      if (attr && key) node.setAttribute(attr, t(key));
    }
  });
}

/**
 * 解析 data-i18n-params="n:3,total:45" 为对象。
 * 数值自动转成 number，便于 t() 直接使用；引号可选。
 * @param {string|undefined} raw
 * @returns {Record<string, string|number>|undefined}
 */
export function parseParams(raw) {
  if (!raw) return undefined;
  /** @type {Record<string, string|number>} */
  const params = {};
  for (const pair of raw.split(',')) {
    const index = pair.indexOf(':');
    if (index < 0) continue;
    const name = pair.slice(0, index).trim();
    const rawValue = pair.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!name) continue;
    params[name] = rawValue !== '' && Number.isFinite(Number(rawValue)) ? Number(rawValue) : rawValue;
  }
  return Object.keys(params).length ? params : undefined;
}

/* ------------------------------------------------------------------ 初始化 */

/**
 * 必须在渲染界面前调用一次。优先级：
 *   1. URL 的 ?lang=xx（可分享链接 / 端到端测试用，且不写入持久化设置）
 *   2. 持久化设置
 *   3. 浏览器语言
 *   4. 默认语言
 * @returns {string} 生效的语言
 */
export function initLocale() {
  const fromUrl = urlLocale();
  if (fromUrl) {
    current = fromUrl;
    applyToDocument();
    // 刻意不写入 localStorage：临时用 ?lang= 看一眼不应改掉用户的长期选择
    return current;
  }
  current = readSaved() || detectLocale();
  applyToDocument();
  return current;
}

/** 读取 ?lang= 参数；非法值视为未提供。 */
function urlLocale() {
  try {
    const value = new URLSearchParams(location.search).get('lang');
    return value && isSupportedLocale(value) ? value : null;
  } catch { return null; }
}

/** 语言选择器的选项数据（供 UI 渲染，避免 UI 自己读 LOCALES 结构）。 */
export function localeOptions() {
  return LOCALES.map(meta => ({ ...meta, selected: meta.code === current }));
}

export default { t, getLocale, setLocale, onLocaleChange, initLocale, applyToDocument, localeOptions, parseParams };
