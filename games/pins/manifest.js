/**
 * 拉针救人 · manifest
 * ============================================================================
 * 说明：本轮（P3）只迁移了 runner 的引擎代码；pins 的规则与渲染**暂时仍由
 * 仓库根目录的 engine.mjs / boards.mjs 提供**，通过下面的动态 import 适配。
 * 这样三个游戏立刻就能走同一套注册表与入口，而 P4 只需把实现搬到本目录，
 * manifest 本身不用改（`id` / 文案键 / 评分口径都已就位）。
 *
 * @typedef {import('../../src/core/contracts.js').GameManifest} GameManifest
 */

/** @type {GameManifest} */
export default {
  id: 'pins',
  titleKey: 'game.pins.title',
  category: 'puzzle',
  order: '02',
  levelCount: 6,
  preview: './public/assets/art/pins-preview.svg',
  taglineKey: 'game.pins.tagline',
  controlsKey: 'game.pins.instruction',
  cardMetaKey: 'game.pins.cardMeta',
  artLabelKey: 'game.pins.artLabel',
  hostApi: '^1.0.0',
  engineVersion: '1.0.0',
  timeDriven: false,          // 纯点击驱动：静止时零 CPU（宿主不托管 rAF）

  // P4 会改成本目录内的 ./levels.js 与 ./engine.js
  levels: () => import('../../engine.mjs').then(module => ({ default: module.PIN_LEVELS })),
  engine: () => import('../../engine.mjs').then(module => ({ default: module.Pins })),
  // P4 会改成本目录内的 ./render.js
  renderer: () => import('../../boards.mjs').then(module => ({ default: () => module.pinRenderer() })),

  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#e7b94f' },
};
