/**
 * 模板关卡数据。数据与逻辑分离：宿主、平衡脚本、测试都直接读这个文件。
 * @typedef {Object} MyGameLevel
 * @property {string} titleKey
 * @property {'入门'|'进阶'|'挑战'} difficulty
 * @property {number} target     通关所需累计值（每次操作 +1/+2/+3/+4）
 * @property {number} steps      三星所需步数上限
 * @property {number} budget     二星所需步数上限
 */
import { DIFFICULTY } from '../../src/core/host-surface.js';

/**
 * 起步数值由「最少步数」反推，不是拍脑袋填的：
 *   target=10 → 最少 3 步（3+3+4）→ 三星上限 3
 *   target=24 → 最少 6 步（6×4）  → 三星上限 6
 *   target=45 → 最少 12 步（11×4+1）→ 三星上限 12，二星留 3 步余量
 * 关卡数值改动后必须重跑测试（模板测试第 4 条会证明三星可达），
 * 并提升 manifest.engineVersion。
 *
 * @type {MyGameLevel[]}
 */
export const LEVELS = [
  { titleKey: 'game.my-game.level1', difficulty: DIFFICULTY.ENTRY, target: 10, steps: 3, budget: 5 },
  { titleKey: 'game.my-game.level2', difficulty: DIFFICULTY.ADVANCED, target: 24, steps: 6, budget: 8 },
  { titleKey: 'game.my-game.level3', difficulty: DIFFICULTY.CHALLENGE, target: 45, steps: 12, budget: 15 },
];

export default LEVELS;
