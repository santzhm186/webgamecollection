/** Shared reusable models; audio remains synthesized by the host. */
export const ASSETS = [
  { id: 'model.runner.bridge-tile', type: 'model', src: 'public/assets/models/bridge-tile.glb', load: 'lazy' },
  { id: 'model.runner.hazard-tile', type: 'model', src: 'public/assets/models/hazard-tile.glb', load: 'lazy' },
  { id: 'model.runner.shield-cell', type: 'model', src: 'public/assets/models/shield-cell.glb', load: 'lazy' },
  { id: 'model.runner.repair-kit', type: 'model', src: 'public/assets/models/repair-kit.glb', load: 'lazy' },
  { id: 'model.runner.sentry-turret', type: 'model', src: 'public/assets/models/sentry-turret.glb', load: 'lazy' },
  { id: 'model.runner.star-token', type: 'model', src: 'public/assets/models/star-token.glb', load: 'lazy' },

  { id: 'model.runner.scout', type: 'model', src: './public/assets/models/scout-bot.glb', load: 'lazy' },
  { id: 'model.runner.gate', type: 'model', src: './public/assets/models/energy-gate.glb', load: 'lazy' },
  { id: 'sfx.click', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.win', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.lose', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.fall', type: 'audio', src: '', load: 'lazy' },
];
export default ASSETS;
