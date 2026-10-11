/**
 * 共用显示字典 —— 多个游戏共享的**玩家可见文本**。
 * ============================================================================
 * 与 enums.js 的分工：
 *   enums.js   是机器值，宿主用 if / switch 判断它
 *   labels.js  是文案，只用于渲染，宿主不判断
 *
 * 与 i18n.js 的分工：
 *   labels.js  本文件内的文案是**领域词汇**（难度分级、分类名），随游戏与框架共享
 *   i18n.js    界面文案（按钮、提示、状态栏）按语言分文件
 *
 * 为什么不把本文件合并进 i18n：
 *   难度与分类是**领域概念**，它们的取值集合由框架定义，与语言无关。
 *   语言只决定怎么念它。合并会让"加一个难度"变成"要改两个语言文件"。
 *
 * ⚠️ 已知取舍：DIFFICULTY 的**索引是中文**（'入门'），因为它同时被当作
 *    engine.mjs 关卡数据里的 difficulty 值使用，改成英文键需要同步改三套关卡数据。
 *    详见 docs/NAMING-CONVENTIONS.md「已知偏离」一节。
 *    若将来引入 i18n 化的关卡文案，这里会迁移为英文键 + 文案查 i18n。
 */

/**
 * 难度分级。**顺序即难度递增顺序**（对象字面量的字符串键保持插入顺序），
 * 契约测试会断言这个顺序，因为它同时用于关卡排序与星级门槛展示。
 */
export const DIFFICULTY = Object.freeze({
  ENTRY: '入门',
  ADVANCED: '进阶',
  CHALLENGE: '挑战',
});

/** 难度 → 颜色语气。宿主渲染难度标签时用，避免各游戏自己挑颜色。 */
export const DIFFICULTY_TONE = Object.freeze({
  [DIFFICULTY.ENTRY]: 'good',
  [DIFFICULTY.ADVANCED]: 'normal',
  [DIFFICULTY.CHALLENGE]: 'warn',
});

/** 分类 → 显示名。 */
export const CATEGORY_LABEL = Object.freeze({
  action: '动作冲关',
  puzzle: '脑力解谜',
  casual: '休闲解压',
});

/** 语气 → CSS 类后缀，供 .hud-<tone> / .tone-<tone> 等样式使用。 */
export const TONE_CLASS = Object.freeze({
  normal: 'normal',
  warn: 'warn',
  good: 'good',
  info: 'info',
});

/** 星级上限与图形。宿主渲染星级时统一使用，禁止各游戏自己拼星星字符串。 */
export const STAR = Object.freeze({
  MAX: 3,
  FULL: '★',
  EMPTY: '☆',
});

/** 星级 → 数组形式，便于渲染。 */
export function starRow(stars) {
  const filled = Math.max(0, Math.min(STAR.MAX, Math.floor(stars || 0)));
  return { filled: Array(filled).fill(STAR.FULL), empty: Array(STAR.MAX - filled).fill(STAR.EMPTY) };
}

export default { DIFFICULTY, DIFFICULTY_TONE, CATEGORY_LABEL, TONE_CLASS, STAR, starRow };
