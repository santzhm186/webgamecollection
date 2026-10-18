/**
 * 拉针救人 · manifest
 * ============================================================================
 * @typedef {import('../../src/core/contracts.js').GameManifest} GameManifest
 */

/** @type {GameManifest} */
export default {
  id: 'pins',
  titleKey: 'game.pins.title',
  category: 'puzzle',
  order: '02',
  levelCount: 8,
  preview: './public/assets/art/pins-preview.svg',
  taglineKey: 'game.pins.tagline',
  controlsKey: 'game.pins.instruction',
  cardMetaKey: 'game.pins.cardMeta',
  artLabelKey: 'game.pins.artLabel',
  hostApi: '^1.0.0',
  engineVersion: '1.2.0',
  timeDriven: false,

  levels: () => import('./levels.js'),
  engine: () => import('./engine.js'),
  renderer: () => import('./render.js'),

  assets: () => import('./assets.js'),
  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#e7b94f' },
};
