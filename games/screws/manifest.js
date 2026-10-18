/**
 * 拧螺丝 · manifest
 * ============================================================================
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
  engineVersion: '1.2.0',
  timeDriven: false,

  levels: () => import('./levels.js'),
  engine: () => import('./engine.js'),
  renderer: () => import('./render.js'),

  assets: () => import('./assets.js'),
  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#88b2a1' },
};
