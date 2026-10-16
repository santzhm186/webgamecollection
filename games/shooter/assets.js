/** Portable GLBs share their geometry definitions with the live sprite factory. */
export const ASSETS = [
  { id: 'model.shooter.hazard-tile', type: 'model', src: 'public/assets/models/hazard-tile.glb', load: 'lazy' },
  { id: 'model.shooter.shield-cell', type: 'model', src: 'public/assets/models/shield-cell.glb', load: 'lazy' },
  { id: 'model.shooter.repair-kit', type: 'model', src: 'public/assets/models/repair-kit.glb', load: 'lazy' },
  { id: 'model.shooter.sentry-turret', type: 'model', src: 'public/assets/models/sentry-turret.glb', load: 'lazy' },
  { id: 'model.shooter.star-token', type: 'model', src: 'public/assets/models/star-token.glb', load: 'lazy' },

  { id: 'model.scout-bot', type: 'model', src: 'public/assets/models/scout-bot.glb', bytes: 39_756, version: 1, load: 'lazy' },
  { id: 'model.enemy-drone', type: 'model', src: 'public/assets/models/enemy-drone.glb', bytes: 35_588, version: 1, load: 'lazy' },
  { id: 'model.boss-sentry', type: 'model', src: 'public/assets/models/boss-sentry.glb', bytes: 19_480, version: 1, load: 'lazy' },
  { id: 'model.upgrade-crate', type: 'model', src: 'public/assets/models/upgrade-crate.glb', bytes: 17_356, version: 1, load: 'lazy' },
];

export default ASSETS;
