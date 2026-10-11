/**
 * 数值平衡报告 —— 输出可审查的表格，供改数值前后对照。
 * ============================================================================
 * 本脚本与游戏、测试**共用同一份规则实现**（games/runner/engine.js 等），
 * 所以报告不会与真实玩法漂移 —— 这是"同一套规则同时服务游戏、测试与报告"的落地。
 *
 * 重要：下面的统计来自对**全部二选一路线**的穷举，**不是玩家实测通关率**。
 * 报告口径不得对外表述为"通关率"（README 里也有同样的声明）。
 *
 * 迁移状态：runner 已从 games/runner/ 读取；pins 与 screws 暂时仍来自根目录
 * engine.mjs（P4 迁移后改路径即可）。
 */
import { RUNNER_LEVELS } from '../games/runner/levels.js';
import { runnerBalance } from '../games/runner/engine.js';
import { PIN_LEVELS, Screws, SCREW_LEVEL_META, solveScrews } from '../engine.mjs';
import { t } from '../src/core/i18n.js';

/**
 * 关卡显示名。新实现给 titleKey，旧实现（pins/screws 待迁移）给 title —— 两种都支持。
 * 报告要给人看，所以必须解析成文案而不是打印键名。
 */
const name = config => (config.titleKey ? t(config.titleKey) : (config.title ?? '—'));

console.log('冲关：所有二选一路线的穷举结果（不是玩家实测通关率）');
console.table(RUNNER_LEVELS.map((config, level) => {
  const stats = runnerBalance(level);
  return {
    关卡: name(config),
    初始兵力: config.initial,
    守卫: config.boss,
    二星: config.stars[1],
    三星: config.stars[2],
    全部路线: stats.routes,
    可通关: stats.winning,
    三星路线: stats.threeStars,
    最优兵力: stats.max,
  };
}));

console.log('螺丝：初始棋盘可解性');
console.table(SCREW_LEVEL_META.map((rule, level) => {
  const game = new Screws(level), solution = solveScrews(game);
  return {
    关卡: name(rule),
    金属片: game.plates.length,
    螺丝: game.plates.reduce((n, p) => n + p.removed.length, 0),
    槽位: rule.capacity,
    有解: solution !== null,
    最少步数: solution?.length ?? '—',
  };
}));

console.log(`拉针：${PIN_LEVELS.length} 关，完整操作顺序由 npm test 穷举验证。`);
