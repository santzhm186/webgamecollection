/**
 * 拧螺丝 · manifest
 * ============================================================================
 * 说明：本轮（P3）只迁移了 runner 的引擎代码；screws 的规则与渲染**暂时仍由
 * 仓库根目录的 engine.mjs / boards.mjs 提供**，通过下面的动态 import 适配。
 * P4 会把实现搬到本目录，manifest 本身不用改。
 *
 * @typedef {import('../../src/core/contracts.js').GameManifest} GameManifest
 */

/** @type {GameManifest} */
export default {
  id: 'screws',
  titleKey: 'game.screws.title',
  category: 'casual',
  order: '03',
  levelCount: 8,
  preview: './public/assets/art/screws-preview.svg',
  taglineKey: 'game.screws.tagline',
  controlsKey: 'game.screws.instruction',
  cardMetaKey: 'game.screws.cardMeta',
  artLabelKey: 'game.screws.artLabel',
  hostApi: '^1.0.0',
  engineVersion: '1.1.0',
  timeDriven: false,          // 纯点击驱动：静止时零 CPU

  // P4 会改成本目录内的 ./levels.js 与 ./engine.js
  levels: () => import('../../engine.mjs').then(module => ({ default: module.SCREW_LEVEL_META })),
  engine: () => import('../../engine.mjs').then(module => ({ default: module.Screws })),
  // P4 会改成本目录内的 ./render.js
  renderer: () => import('../../boards.mjs').then(module => ({ default: () => module.screwRenderer() })),

  assets: () => import('./assets.js'),
  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#88b2a1' },
};
