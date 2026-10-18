/**
 * 拧螺丝 · 关卡数据与元数据
 * ============================================================================
 */
import { DIFFICULTY } from '../../src/core/host-surface.js';

export const SCREW_LEVELS = [
  [{ x: 240, y: 273, angle: 0, width: 270 }, { x: 240, y: 228, angle: -36, width: 245 }, { x: 240, y: 190, angle: 34, width: 245 }],
  [{ x: 240, y: 280, angle: 0, width: 280 }, { x: 198, y: 226, angle: 55, width: 225 }, { x: 282, y: 222, angle: -55, width: 225 }, { x: 240, y: 170, angle: 0, width: 280 }],
  [{ x: 240, y: 282, angle: 0, width: 285 }, { x: 190, y: 230, angle: 65, width: 245 }, { x: 290, y: 230, angle: -65, width: 245 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }],
  [{ x: 240, y: 278, angle: 0, width: 280, bolts: 3 }, { x: 193, y: 235, angle: 65, width: 240 }, { x: 287, y: 235, angle: -65, width: 240 }, { x: 240, y: 204, angle: 30, width: 265 }, { x: 240, y: 168, angle: -30, width: 265 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 194, y: 238, angle: 62, width: 255 }, { x: 286, y: 238, angle: -62, width: 255 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }, { x: 240, y: 210, angle: -28, width: 275 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 185, y: 244, angle: 65, width: 250, bolts: 3 }, { x: 295, y: 244, angle: -65, width: 250, bolts: 3 }, { x: 240, y: 215, angle: 30, width: 275 }, { x: 240, y: 181, angle: -30, width: 275 }, { x: 240, y: 155, angle: 0, width: 230, bolts: 3 }],
  // 七片钟楼：中梁盖住两侧立柱，最上方短锁片打开交叉拆卸路线。
  [{ x: 240, y: 300, angle: 0, width: 300, bolts: 3 }, { x: 180, y: 242, angle: 70, width: 220, bolts: 3 }, { x: 300, y: 242, angle: -70, width: 220, bolts: 3 }, { x: 240, y: 248, angle: 0, width: 290, bolts: 3 }, { x: 215, y: 190, angle: 30, width: 260 }, { x: 265, y: 190, angle: -30, width: 260 }, { x: 240, y: 140, angle: 0, width: 190, bolts: 3 }],
  // 八片双塔：三孔立柱与两层横梁交织；先拆完整片，避免同时占用多片槽位。
  [{ x: 240, y: 310, angle: 0, width: 310, bolts: 3 }, { x: 155, y: 250, angle: 90, width: 170, bolts: 3 }, { x: 325, y: 250, angle: 90, width: 170, bolts: 3 }, { x: 240, y: 260, angle: 0, width: 280, bolts: 3 }, { x: 186, y: 209, angle: 50, width: 245 }, { x: 294, y: 209, angle: -50, width: 245 }, { x: 240, y: 160, angle: 0, width: 275, bolts: 3 }, { x: 240, y: 119, angle: 0, width: 170, bolts: 3 }],
];

export const SCREW_LEVEL_META = [
  { titleKey: 'game.screws.level1', capacity: 4, difficulty: DIFFICULTY.ENTRY },
  { titleKey: 'game.screws.level2', capacity: 4, difficulty: DIFFICULTY.ENTRY },
  { titleKey: 'game.screws.level3', capacity: 4, difficulty: DIFFICULTY.ADVANCED },
  { titleKey: 'game.screws.level4', capacity: 3, difficulty: DIFFICULTY.ADVANCED },
  { titleKey: 'game.screws.level5', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level6', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level7', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level8', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
];

export default SCREW_LEVEL_META;
