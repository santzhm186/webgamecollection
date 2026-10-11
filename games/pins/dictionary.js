/**
 * 游戏私有字典 —— pins 专有词汇。宿主永远不认识这里的内容。
 * ============================================================================
 * 归属规则（docs/NAMING-CONVENTIONS.md）：
 *   「引水 / 排空 / 排气」是 pins 的机关名，别的游戏不会用，宿主也不该判断它们。
 *   → 归游戏自己。宿主若认识这些词，第二个游戏就无法定义自己的机关名了。
 *
 * 与 i18n 的关系：本文件的 key 是**稳定的机器标识**（water/drain/…），
 * 值是从 i18n 取的玩家可见文案。所以加语言不需要改这里，只需补文案键。
 * 覆盖文案键的入口见下面的 `dictionaryKeys` —— 契约测试据此断言键存在。
 *
 * import 规则：只允许从 host-surface.js 取宿主能力（见该文件说明与
 * tests/boundaries.test.mjs 的机械校验）。
 */

import { t } from '../../src/core/host-surface.js';

/** 机关名 → 文案键。key 必须与 PIN_LEVELS 里 pins 数组的取值一致。 */
export const PIN_LABEL_KEYS = Object.freeze({
  water: 'game.pins.pinWater',
  drain: 'game.pins.pinDrain',
  treasure: 'game.pins.pinTreasure',
  spider: 'game.pins.pinSpider',
  vent: 'game.pins.pinVent',
  bridge: 'game.pins.pinBridge',
});

/**
 * 机关名 → 显示文案（当前语言）。
 * 用 getter 每次求值而不是缓存常量：语言切换后无需重新加载游戏模块。
 * @param {string} pin
 * @returns {string}
 */
export function pinLabel(pin) {
  const key = PIN_LABEL_KEYS[pin];
  return key ? t(key) : pin;
}

/**
 * 机关命中区（渲染层私有布局，单位与场景 viewBox 一致：480×420）。
 * width 是拉环可点击宽度；位置在场景坐标系里，由渲染层换算成百分比。
 * 之所以放在这里而不是渲染层：它同时被**无障碍标签排序**与**提示高亮**使用，
 * 属于"这个游戏的机关在哪"这一领域知识。
 */
export const PIN_POINTS = Object.freeze({
  water: Object.freeze({ x: 57, y: 144, width: 176 }),
  drain: Object.freeze({ x: 57, y: 264, width: 176 }),
  treasure: Object.freeze({ x: 263, y: 264, width: 174 }),
  spider: Object.freeze({ x: 263, y: 144, width: 174 }),
  vent: Object.freeze({ x: 263, y: 39, width: 174 }),
  bridge: Object.freeze({ x: 57, y: 325, width: 176 }),
});

/** 本游戏用到的全部文案键，供契约测试校验存在性。 */
export const dictionaryKeys = Object.freeze([
  ...Object.values(PIN_LABEL_KEYS),
]);

export default { PIN_LABEL_KEYS, PIN_POINTS, pinLabel, dictionaryKeys };
