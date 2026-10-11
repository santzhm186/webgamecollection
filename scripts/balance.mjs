import { RUNNER_LEVELS, runnerBalance, PIN_LEVELS, Screws, SCREW_RULES, solveScrews } from '../engine.mjs';
console.log('冲关：所有二选一路线的穷举结果（不是玩家实测通关率）');
console.table(RUNNER_LEVELS.map((config, level) => {
  const stats = runnerBalance(level);
  return { 关卡: config.title, 初始兵力: config.initial, 守卫: config.boss, 二星: config.stars[1], 三星: config.stars[2], 全部路线: stats.routes, 可通关: stats.winning, 三星路线: stats.threeStars, 最优兵力: stats.max };
}));
console.log('螺丝：初始棋盘可解性');
console.table(SCREW_RULES.map((rule, level) => {
  const game = new Screws(level), solution = solveScrews(game);
  return { 关卡: rule.title, 金属片: game.plates.length, 螺丝: game.plates.reduce((n, p) => n + p.removed.length, 0), 槽位: rule.capacity, 有解: solution !== null };
}));
console.log(`拉针：${PIN_LEVELS.length} 关，完整操作顺序由 npm test 穷举验证。`);
