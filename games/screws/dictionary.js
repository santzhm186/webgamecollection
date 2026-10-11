/**
 * 游戏私有字典 —— screws 专有词汇与几何。
 * ============================================================================
 * 这是"字典包"的第二个用途：**不只放名词，也放这个游戏独有的领域常量**。
 * `screwPosition` 与遮挡判定 `containsPlate` 既是引擎的规则依据，
 * 也是渲染层的命中区依据 —— 两边必须用同一份实现，否则玩家会点到
 * "看起来能拆、实际不可拆"的螺丝（这是本类玩法最经典的 bug）。
 * 所以它归游戏侧共享，而不是复制到渲染层。
 *
 * import 规则：只允许从 host-surface.js 取宿主能力。
 */

import { t } from '../../src/core/host-surface.js';

/** 螺丝位（一颗金属片最多三孔）→ 文案键 */
export const SCREW_END_KEYS = Object.freeze({
  0: 'game.screws.endLeft',
  1: 'game.screws.endRight',
  2: 'game.screws.endCenter',
});

/** @param {number} end @returns {string} */
export function screwEndLabel(end) {
  const key = SCREW_END_KEYS[end];
  return key ? t(key) : String(end);
}

/**
 * 计算某颗螺丝在场景坐标系中的位置。
 * 三孔金属片的孔位沿片身方向分布：左端 -0.37、右端 +0.37、中央 0。
 * @param {{x:number,y:number,angle:number,width:number}} plate
 * @param {number} end
 * @returns {{x:number,y:number}}
 */
export function screwPosition(plate, end) {
  const d = [-.37, .37, 0][end] * plate.width, a = plate.angle * Math.PI / 180;
  return { x: plate.x + d * Math.cos(a), y: plate.y + d * Math.sin(a) };
}

/**
 * 点位是否落在金属片内（含螺丝头的容差）。
 * 约定：**id 更大的片覆盖 id 更小的片**，与渲染层的 z-index 必须保持一致
 * （渲染层用 `z-index: p.id + 4`）。这两个约定必须同步修改。
 * @param {{x:number,y:number,angle:number,width:number}} plate
 * @param {{x:number,y:number}} point
 * @returns {boolean}
 */
export function containsPlate(plate, point) {
  const a = -plate.angle * Math.PI / 180, dx = point.x - plate.x, dy = point.y - plate.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) < plate.width / 2 + 9
    && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) < 36;
}

/** 本游戏用到的全部文案键，供契约测试校验存在性。 */
export const dictionaryKeys = Object.freeze([
  ...Object.values(SCREW_END_KEYS),
]);

export default { SCREW_END_KEYS, screwEndLabel, screwPosition, containsPlate, dictionaryKeys };
