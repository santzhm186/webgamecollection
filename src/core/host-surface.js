/**
 * 共享入口（host surface）—— 游戏模块**唯一**允许 import 的宿主路径。
 * ============================================================================
 * 为什么需要这个文件：
 *   契约规定「游戏不得 import 宿主服务」。但游戏确实需要 t()、枚举值、文案标签
 *   这些东西。如果允许它们各自 import 具体模块，边界就会一点点烂掉
 *   （今天 import i18n，明天 import score-store，后天直接读 localStorage）。
 *
 *   所以开放**一个**文件作为门面：games/** 只允许 import 本文件。
 *   tests/boundaries.test.mjs 会机械校验这条规则 —— 违规会在 CI 阶段失败，
 *   而不是在半年后靠人工 review 发现。
 *
 * 怎么加新能力（给贡献者）：
 *   不要从自己的游戏里绕开。在宿主侧实现后从这里 re-export，
 *   并按 docs/SCALING-AND-CONTRIBUTING.md 的契约版本策略处理兼容性。
 *
 * 本文件只做转出与转发，不承载逻辑。
 */

/* 契约类型（仅 JSDoc，无运行时代码），供游戏写类型注解 */
export { HOST_API_VERSION } from './contracts.js';

/* 枚举：机器值的一切判断依据 */
export * from './enums.js';

/* 共用显示文案：难度、分类、星级图形 */
export * from './labels.js';

/* 多语言：t() 与语言状态 */
export { t, getLocale, getLocaleMeta, onLocaleChange } from './i18n.js';

/* 语言清单：游戏若需要按语言调整内容，从这里读支持的 locale */
export { LOCALES, DEFAULT_LOCALE, isSupportedLocale } from './locales.js';

/* 多人契约：校验与玩家位生成 */
export {
  validateMultiplayerSpec,
  createPlayerSlots,
} from './multiplayer.js';

export default {};
