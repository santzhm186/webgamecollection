/**
 * 根目录过渡兼容导出：转发至 games/pins/ 与 games/screws/ 的渲染器。
 * ============================================================================
 * P4 迁移已完成：渲染器已迁入各自目录。
 */
export { PIN_POINTS } from './games/pins/dictionary.js';
export { pinRenderer, pinBoard } from './games/pins/render.js';
export { screwRenderer, screwBoard, metallic } from './games/screws/render.js';
