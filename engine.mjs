/**
 * 根目录过渡兼容导出：转发至 games/pins/ 与 games/screws/。
 * ============================================================================
 * P4 迁移已完成：Pins 与 Screws 的规则与关卡已彻底迁入 games/pins/ 与 games/screws/。
 * 本文件作为向前兼容桥梁，避免旧导入与外置脚本失效。
 */
export { PIN_LEVELS, Pins } from './games/pins/engine.js';
export { pinLabel } from './games/pins/dictionary.js';
export {
  SCREW_LEVELS,
  SCREW_LEVEL_META,
  Screws,
  solveScrews,
  screwPosition,
  containsPlate,
} from './games/screws/engine.js';
