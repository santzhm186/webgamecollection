/**
 * 语言包注册表 —— i18n 的唯一数据入口。
 * ============================================================================
 * 加一门语言：① locales.js 加一条 ② 新建 <code>.js 并默认导出同结构对象 ③ 在此注册。
 * tests/i18n.test.mjs 会断言"每个 locale 的键集与 zh-CN 完全一致"，
 * 漏键或多余的键都会失败 —— 这是多语言不腐烂的唯一保障。
 *
 * 静态 import 而非动态：语言包是首屏必需文本，体积只有几 KB，
 * 动态加载会让首屏出现一次文案闪烁。
 */
import { zhCN } from './zh-CN.js';
import { en } from './en.js';
import { DEFAULT_LOCALE } from '../core/locales.js';

/** locale code → 文案对象 */
export const BUNDLES = Object.freeze({ 'zh-CN': zhCN, en });

/** 取语言包；未知语言回落到默认语言，绝不返回 undefined。 */
export function bundleFor(code) {
  return BUNDLES[code] ?? BUNDLES[DEFAULT_LOCALE];
}

export default BUNDLES;
