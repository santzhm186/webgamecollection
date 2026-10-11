/**
 * 共享绘制原语 —— Canvas 渲染器与 SVG 渲染器共用的最小几何工具。
 * ============================================================================
 * 为什么需要它：`art.mjs`（冲关 Canvas）与 `boards.mjs`（神庙/工坊 SVG）里
 * 各写了一份 rounded / 多边形 / 文字绘制。同一个圆角矩形的半径语义在两处
 * 一旦漂移，视觉就会不一致，而这类差异极难在 code review 中被发现。
 *
 * 归属：宿主共享层（src/ui/scene/），不属于任何游戏。
 *   游戏自己的绘制件（如士兵、能量门、宝石）留在 games/<id>/render.js。
 *
 * 约定：所有函数都接收一个"已经设好变换的" 2D 上下文，坐标使用**场景坐标系**
 * （现有两个 Canvas 场景都是 480×420 逻辑像素，由调用方 setTransform 缩放）。
 */

/**
 * 圆角矩形。宽高会被钳制到非负，避免负数导致 roundRect 抛错（掉帧时很常见）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {number|number[]} radius
 * @param {string|CanvasGradient} [fill]
 * @param {string} [stroke]  传入时描边，线宽固定 1.5（与既有视觉一致）
 */
export function rounded(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}

/**
 * 居中文字。字体固定用 system-ui：跨平台的字形与字重差异最小，
 * 且不需要加载字体文件（零依赖、零首屏成本）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string|number} value
 * @param {number} x @param {number} y
 * @param {number} [size=16] @param {string} [color='#fff'] @param {number} [weight=750]
 */
export function label(ctx, value, x, y, size = 16, color = '#fff', weight = 750) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(value, x, y);
}

/**
 * 多边形。点集为 [[x, y], …]；自动闭合。
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[number, number]>} points
 * @param {string|CanvasGradient} fill
 * @param {string} [stroke]
 */
export function polygon(ctx, points, fill, stroke) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

/**
 * 纵向线性渐变。几乎所有场景背景与面板都用这一种，抽出来避免每次写三行。
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} y0 @param {number} y1
 * @param {Array<[number, string]>} stops  [偏移 0..1, 颜色]
 * @returns {CanvasGradient}
 */
export function verticalGradient(ctx, y0, y1, stops) {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

export default { rounded, label, polygon, verticalGradient };
