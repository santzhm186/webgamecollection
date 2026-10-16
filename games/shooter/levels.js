import { DIFFICULTY } from '../../src/core/host-surface.js';

const crate = (at, lane, upgrade, hp = 3) => ({ at, kind: 'crate', lane, upgrade, hp, speed: .073 });
const enemy = (at, hp, speed = .09) => ({ at, kind: 'enemy', lane: 1, hp, speed });

// Boxes lead each danger spike, giving players time to choose a side and invest.
const campaign = (level, bossAt, bossHp) => {
  const waves = [
    crate(.5, 0, 'spread'), crate(3, 2, 'rate'),
    crate(8, 0, 'shield'), crate(12, 2, 'spread', 4),
    crate(17, 0, 'rate', 4), crate(22, 2, 'shield', 4),
    crate(26, 2, 'rate', 4),
  ].filter(wave => wave.at < bossAt);
  for (let at = 5, index = 0; at < bossAt - 1; at += 3.4 - level * .25, index++) {
    waves.push(enemy(at, 3 + level + (index % 3 === 2 ? 2 : 0), .078 + level * .007));
  }
  waves.push({ at: bossAt, kind: 'boss', lane: 1, hp: bossHp, speed: .052 + level * .002 });
  return waves.sort((a, b) => a.at - b.at);
};

export const SHOOTER_LEVELS = [
  { titleKey: 'game.shooter.level1', difficulty: DIFFICULTY.ENTRY, starUpgrades: 3, waves: campaign(0, 23, 26), sky: ['#153a50', '#32898b'] },
  { titleKey: 'game.shooter.level2', difficulty: DIFFICULTY.ENTRY, starUpgrades: 4, waves: campaign(1, 27, 42), sky: ['#323b63', '#bc8174'] },
  { titleKey: 'game.shooter.level3', difficulty: DIFFICULTY.ADVANCED, starUpgrades: 5, waves: campaign(2, 31, 60), sky: ['#26304c', '#65859b'] },
  { titleKey: 'game.shooter.level4', difficulty: DIFFICULTY.CHALLENGE, starUpgrades: 6, waves: campaign(3, 35, 82), sky: ['#312b48', '#a45f6f'] },
  { titleKey: 'game.shooter.level5', difficulty: DIFFICULTY.CHALLENGE, starUpgrades: 7, waves: campaign(4, 39, 110), sky: ['#192d49', '#4b9f9c'] },
];

export default SHOOTER_LEVELS;
