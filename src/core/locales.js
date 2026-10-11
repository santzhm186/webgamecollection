/**
 * 支持的语言清单 —— 语言相关的一切从这里读，禁止在别处硬编码 locale 字符串。
 * ============================================================================
 * 约定：
 *   - code 用 BCP 47 标准（'zh-CN' 而非 'zh'，便于将来区分 zh-TW）。
 *   - label 用**该语言自己的写法**（endonym），这样用户在任何语言下都能认出自己的语言。
 *   - status 标记翻译完成度：'stable' 已完成，'beta' 可用但可能缺键。
 *     新增语言时先标 'beta'，缺键会由 i18n 回落到默认语言，不会显示成空白。
 *   - dir 预留 RTL 支持（阿拉伯语等），现在全部 'ltr'。
 *
 * 加一门语言需要动的地方（三步，缺一不可）：
 *   1. 本文件加一条
 *   2. src/locales/<code>.js 新建文案文件
 *   3. src/locales/index.js 注册
 *   tests/i18n.test.mjs 会断言"每个 locale 的键集完全一致"，漏键会失败。
 */

/** 默认语言。任何缺键都回落到它，所以它必须是最完整的一份。 */
export const DEFAULT_LOCALE = 'zh-CN';

/** 语言清单。数组顺序 = 语言选择器里的显示顺序。 */
export const LOCALES = Object.freeze([
  Object.freeze({ code: 'zh-CN', label: '简体中文', short: '中', status: 'stable', dir: 'ltr' }),
  Object.freeze({ code: 'en', label: 'English', short: 'EN', status: 'beta', dir: 'ltr' }),
]);

/** 是否为受支持的语言。用于校验持久化的语言设置是否仍然有效。 */
export function isSupportedLocale(code) {
  return LOCALES.some(locale => locale.code === code);
}

/** 取语言元数据；未知语言返回默认语言。 */
export function localeMeta(code) {
  return LOCALES.find(locale => locale.code === code)
    ?? LOCALES.find(locale => locale.code === DEFAULT_LOCALE);
}

export default LOCALES;
