export default {
  id: 'light-path', isNew: true, titleKey: 'game.light-path.title', category: 'puzzle', order: '07', levelCount: 7,
  preview: './public/assets/art/light-path-preview.svg', taglineKey: 'game.light-path.tagline', controlsKey: 'game.light-path.instruction',
  cardMetaKey: 'game.light-path.cardMeta', artLabelKey: 'game.light-path.artLabel', hostApi: '^1.0.0', engineVersion: '1.0.0', timeDriven: false,
  levels: () => import('./levels.js'), engine: () => import('./engine.js'), renderer: () => import('./render.js'), assets: () => import('./assets.js'),
  scoring: { order: 'desc', primary: 'score', allowTotal: true }, theme: { accent: '#d9f77c' },
};
