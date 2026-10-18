/**
 * 拉针救人 · 关卡数据
 * ============================================================================
 * 数据与逻辑分离：平衡脚本、测试、宿主均可直接导入。
 */
import { DIFFICULTY } from '../../src/core/host-surface.js';

export const PIN_LEVELS = [
  { titleKey: 'game.pins.level1', difficulty: DIFFICULTY.ENTRY, pins: ['water', 'drain', 'treasure'] },
  { titleKey: 'game.pins.level2', difficulty: DIFFICULTY.ENTRY, pins: ['water', 'treasure', 'spider', 'drain'], spider: true },
  { titleKey: 'game.pins.level3', difficulty: DIFFICULTY.ADVANCED, pins: ['treasure', 'vent', 'drain', 'water'], gas: true },
  { titleKey: 'game.pins.level4', difficulty: DIFFICULTY.ADVANCED, pins: ['water', 'spider', 'treasure', 'vent', 'drain'], spider: true, gas: true },
  { titleKey: 'game.pins.level5', difficulty: DIFFICULTY.CHALLENGE, pins: ['bridge', 'water', 'treasure', 'drain'], bridge: true },
  { titleKey: 'game.pins.level6', difficulty: DIFFICULTY.CHALLENGE, pins: ['treasure', 'bridge', 'vent', 'water', 'spider', 'drain'], spider: true, gas: true, bridge: true },
  // 蛛网封住通风口：原先独立的蜘蛛、气体现在有先后依赖。
  { titleKey: 'game.pins.level7', introKey: 'game.pins.introWeb', difficulty: DIFFICULTY.CHALLENGE, pins: ['vent', 'water', 'treasure', 'bridge', 'drain', 'spider'], spider: true, gas: true, bridge: true, ventBlockedBySpider: true },
  // 终局将两条依赖串联：先清蛛排气；水冷却后先架支撑桥，再排石。
  { titleKey: 'game.pins.level8', introKey: 'game.pins.introSupport', difficulty: DIFFICULTY.CHALLENGE, pins: ['drain', 'bridge', 'treasure', 'water', 'vent', 'spider'], spider: true, gas: true, bridge: true, ventBlockedBySpider: true, bridgeBeforeDrain: true },
];

export default PIN_LEVELS;
