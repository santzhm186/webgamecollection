/**
 * 加减门冲关 · 关卡数据
 * ============================================================================
 * 数据与逻辑分离：平衡脚本、测试、宿主都直接读这个文件，不需要实例化引擎。
 *
 * 关卡改动的硬性要求（三条，缺一不可）：
 *   1. 提升 manifest.engineVersion —— 否则新旧成绩会混进同一个排行榜口径
 *   2. 重跑 `npm test`：224 条路线全部会被穷举，星级门槛必须仍然可达
 *   3. 重跑 `npm run balance` 并更新 README 的数值表
 *
 * 字段说明：
 *   initial    初始兵力
 *   boss       要塞守卫数（同时是一星门槛）
 *   stars      [一星, 二星, 三星] 抵达兵力门槛；一星必须等于 boss
 *   bossAt     进入要塞交战的时间点（秒）
 *   gates      [{ at, choices: [[左门], [右门]], enemy }]
 *              choices 里每项是 [运算符, 数值]，运算符见 applyGate
 *   enemy      该波守卫消耗的兵力
 */
import { DIFFICULTY } from '../../src/core/host-surface.js';

/** 把门列表展开成带时间点的结构，避免手写重复的 at 字段 */
const gates = (choices, enemies, interval) =>
  choices.map((choice, i) => ({ at: 3.5 + i * interval, choices: choice, enemy: enemies[i] }));

export const RUNNER_LEVELS = [
  {
    titleKey: 'game.runner.level1', difficulty: DIFFICULTY.ENTRY,
    initial: 16, boss: 110, stars: [110, 130, 145], bossAt: 25,
    gates: gates([
      [['+', 14], ['×', 2]], [['×', 2], ['+', 26]], [['+', 32], ['×', 2]],
      [['×', 2], ['+', 48]], [['+', 64], ['×', 2]],
    ], [6, 12, 18, 26, 40], 4.2),
  },
  {
    titleKey: 'game.runner.level2', difficulty: DIFFICULTY.ADVANCED,
    initial: 14, boss: 110, stars: [110, 135, 165], bossAt: 27,
    gates: gates([
      [['×', 2], ['+', 22]], [['+', 30], ['×', 2]], [['×', 3], ['+', 55]],
      [['+', 80], ['×', 2]], [['×', 2], ['+', 100]], [['+', 120], ['×', 2]],
    ], [9, 18, 36, 54, 72, 110], 3.8),
  },
  {
    titleKey: 'game.runner.level3', difficulty: DIFFICULTY.CHALLENGE,
    initial: 12, boss: 250, stars: [250, 380, 560], bossAt: 28,
    gates: gates([
      [['+', 18], ['×', 2]], [['×', 2], ['+', 30]], [['+', 36], ['×', 3]],
      [['×', 2], ['+', 75]], [['+', 90], ['×', 2]], [['×', 3], ['+', 120]],
      [['+', 160], ['×', 2]],
    ], [8, 16, 26, 45, 65, 100, 145], 3.4),
  },
];

export default RUNNER_LEVELS;
