/** Shared reusable models; audio remains synthesized by the host. */
export const ASSETS = [
  { id: 'model.runner.scout', type: 'model', src: './public/assets/models/scout-bot.glb', load: 'lazy' },
  { id: 'model.runner.gate', type: 'model', src: './public/assets/models/energy-gate.glb', load: 'lazy' },
  { id: 'sfx.click', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.win', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.lose', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.fall', type: 'audio', src: '', load: 'lazy' },
];
export default ASSETS;
