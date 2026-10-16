/** Only metadata is eager; all game modules are loaded on first play. */
export default {
  id: 'warehouse', titleKey: 'game.warehouse.title',
  category: 'puzzle', order: '05', isNew: true,
  tags: ['sokoban', 'strategy', 'robot'],
  levelCount: 6, preview: './public/assets/art/warehouse-preview.svg',
  taglineKey: 'game.warehouse.tagline', controlsKey: 'game.warehouse.instruction',
  cardMetaKey: 'game.warehouse.cardMeta', artLabelKey: 'game.warehouse.artLabel',
  hostApi: '^1.0.0', engineVersion: '1.0.0', timeDriven: false,
  levels: () => import('./levels.js'), engine: () => import('./engine.js'),
  renderer: () => import('./render.js'), assets: () => import('./assets.js'),
  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#77e1c5' },
};
