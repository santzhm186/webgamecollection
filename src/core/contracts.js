/**
 * 玩得到 · 契约层（唯一契约来源）
 * ============================================================================
 * 这个文件只有类型定义，没有运行时代码。它是宿主（host）与游戏模块（games/*）
 * 之间的法律条文：宿主承诺提供什么，游戏必须实现什么。
 *
 * 为什么单独一个文件：本项目要开源、要接受外部贡献者。贡献者只要读这一个文件
 * 就知道怎么写一个新游戏，不需要读宿主实现；宿主改内部实现也不会破坏契约。
 *
 * 版本策略：
 *   - 契约破坏性变更 → 提升 HOST_API_VERSION 主版本号，并保留上一版适配层。
 *   - 游戏在 manifest 里声明 hostApi，宿主加载时做兼容判断（见 resolveModule）。
 *
 * 重要边界：games/** 只允许依赖本文件的类型与注入的 ctx，
 * 不得 import src/services/**、src/ui/**、src/storage/**。
 */

/** 宿主 API 版本。游戏 manifest 须声明兼容范围。 */
export const HOST_API_VERSION = '1.0.0';

/* ============================================================================
 * 1. 游戏模块（manifest）—— 注册表的输入，也是对外唯一入口
 * ==========================================================================*/

/**
 * 一个游戏模块的静态声明。**必须可被静态分析**：不能有副作用、不能在此文件里
 * 创建引擎实例或触碰 DOM，因为首页会 import 全部 manifest（几百字节）来做卡片列表。
 *
 * 文案一律用**键**而不是字面量（规则 R1，见 docs/NAMING-CONVENTIONS.md）：
 * 这样加语言不需要改任何 manifest，只加文案文件即可。
 *
 * @typedef {Object} GameManifest
 * @property {string} id            全局唯一、kebab-case，也是成绩库 gameId。一经发布不可更改。
 * @property {number} levelCount    正整数：首页进度槽位数量，须与 levels() 返回数据长度一致
 * @property {string} [preview]     相对站点根目录的静态预览图片路径，首页不加载渲染器
 * @property {string} titleKey      显示名文案键，如 'game.runner.title'
 * @property {string} category      'action' | 'puzzle' | 'casual' | 自定义（对应 CATEGORY 枚举）
 * @property {string} order         卡片序号（'01'），**与 category 分离** —— 序号是展示，分类是数据
 * @property {string} taglineKey    卡片一句话简介的文案键
 * @property {string} controlsKey   操作说明的文案键（渲染到游戏容器）
 * @property {string} [cardMetaKey] 卡片底部的补充信息（时长/关数）文案键
 * @property {string} [artLabelKey] 卡片插画按钮的无障碍标签文案键
 * @property {string[]} [tags]      搜索用关键词
 * @property {string} hostApi       兼容的宿主版本范围，如 '^1.0.0'
 * @property {string} engineVersion 玩法/数值版本。数值改动必须提升 —— 成绩库据此区分榜单口径，不可省略。
 * @property {boolean} [timeDriven] 引擎是否需要逐帧推进（实现 tick 的游戏应为 true）。
 *                                  宿主据此决定是否托管 rAF；为 false 时游戏静止即零 CPU。
 * @property {() => Promise<{default: any}>} levels    动态 import
 * @property {() => Promise<{default: EngineFactory}>} engine
 * @property {() => Promise<{default: RendererFactory}>} renderer
 * @property {() => Promise<{default: ResourceItem[]}>} [assets]
 * @property {ScoringSpec} scoring  排行榜口径
 * @property {MultiplayerSpec} [players] 多人声明；**不声明即单人**（见 multiplayer.js）
 * @property {ThemeOverride} [theme]
 */

/**
 * 排行榜口径。宿主与排行榜模块据此决定"什么算更好"。
 *
 * @typedef {Object} ScoringSpec
 * @property {'desc'|'asc'} order      desc=分数越高越好；asc=用时/步数越少越好
 * @property {'score'|'stars'|'time'} primary
 * @property {boolean} [allowTotal]    是否允许参与跨关卡总分榜（默认 true）
 */

/* ============================================================================
 * 2. 引擎（玩法逻辑）—— 游戏的"核心不同"就在这里
 * ==========================================================================*/

/**
 * 引擎工厂。宿主用 new 调用（保持与现有 Runner/Pins/Screws 一致的类形态，
 * 迁移成本最低；内部想用闭包实现也可以，只要返回对象满足 GameEngine）。
 *
 * @typedef {new (level: number, ctx: GameContext) => GameEngine} EngineFactory
 */

/**
 * 游戏引擎实例。**必须与渲染完全解耦且无 DOM 依赖**，这是本项目能在 Node 里
 * 穷举 224 条路线 / 918 种拉针顺序的前提，也是对贡献者的硬性要求。
 *
 * 只有 status / message / stars / score / hud / metrics 是必需的；
 * 其余按玩法需要实现，宿主用 typeof 探测后决定是否显示暂停、提示、撤销按钮。
 *
 * @typedef {Object} GameEngine
 * @property {string} gameId
 * @property {number} level
 * @property {object} config            关卡配置，须含 title；建议含 difficulty
 * @property {'loading'|'ready'|'playing'|'won'|'lost'} status
 * @property {string} message           状态栏文案，宿主直接渲染（含无障碍 live region）
 * @property {number} stars             0..3，由引擎按自己的规则判定
 * @property {number} score             主分值
 *
 * @property {() => HudField[]} hud
 * @property {() => MetricBag} metrics  结构化指标，将写入成绩库并用于服务端重放校验
 *
 * // --- 生命周期（可选，宿主用 typeof 探测）---
 * @property {() => void} [start]
 * @property {(dtSeconds: number) => void} [tick]   仅需要连续帧的游戏实现
 * @property {() => void} [pause]                   宿主切后台/切标签时调用
 * @property {() => void} [resume]
 *
 * // --- 辅助能力（可选，宿主据此显隐按钮并影响星级）---
 * @property {() => unknown} [hint]
 * @property {() => boolean} [undo]
 */

/** 引擎向宿主自述的 HUD 字段。宿主不猜任何玩法相关的数字。 */
/**
 * @typedef {Object} HudField
 * @property {string} label
 * @property {string|number} value
 * @property {'normal'|'warn'|'good'} [tone]
 */

/**
 * 结构化指标。用于：① 结果面板展示 ② 成绩库记录 ③ 将来服务端重放校验。
 *
 * 本项目三个引擎都是确定性纯函数，因此建议在这里记录 **操作序列**，
 * 例如 runner: { route: '0,1,0,1,0', arrived: 156 }，
 * 服务端可只凭 (gameId, level, 操作序列) 重放验证分数，无需信任客户端上报的 score。
 *
 * @typedef {Record<string, string|number|boolean|number[]>} MetricBag
 */

/* ============================================================================
 * 3. 渲染器 —— 用数据契约而非继承，容纳完全不同的技术栈
 * ==========================================================================*/

/**
 * 渲染器工厂。
 * @typedef {() => GameRenderer} RendererFactory
 */

/**
 * 渲染器。**必须无状态**：所有状态在 engine 里；渲染器只是 (engine, theme) => 画面。
 * 现有 drawRunner(canvas, state) 与 pinBoard(engine, opts) 已经是这个模式，属机械搬运。
 *
 * 三种 kind 覆盖完全不同的引擎技术栈：
 *   - 'canvas'  宿主提供 <canvas> 并管理 rAF（现有冲关）
 *   - 'dom'     宿主提供容器，渲染器返回 HTML 字符串（现有拉针/螺丝 SVG）
 *   - 'webgl'   宿主提供 <canvas> + WebGL2 上下文（将来的 3D 游戏）
 *
 * @typedef {Object} GameRenderer
 * @property {'canvas'|'dom'|'webgl'} kind
 * @property {(host: HTMLElement, engine: GameEngine, ctx: GameContext) => void} mount
 * @property {(engine: GameEngine) => void} draw        状态变更或每帧调用
 * @property {() => void} [resize]
 * @property {() => void} destroy                       必须解绑全部监听器，否则内存泄漏
 * @property {(input: NormalizedInput) => void} [onInput]
 */

/**
 * 宿主归一化后的输入事件。存在的意义：键盘、鼠标、触摸由宿主统一成一套，
 * 游戏不必自己处理 pointer/touch/keydown 的差异与冲突（如滑动 vs 页面滚动）。
 *
 * @typedef {Object} NormalizedInput
 * @property {'press'|'release'|'move'|'drag'|'swipe'|'wheel'} type
 * @property {number} [x]        0..1 归一化坐标，与画布尺寸解耦
 * @property {number} [y]
 * @property {string} [key]      归一化键名，如 'Left' / 'Space'
 * @property {'left'|'right'|'up'|'down'} [direction]
 */

/* ============================================================================
 * 4. 注入上下文 —— 游戏唯一的对外通道（依赖注入，禁止 import 单例）
 * ==========================================================================*/

/**
 * 渲染器向宿主上报的操作。宿主调用引擎后统一重绘、检测结算与保存成绩。
 *
 * @typedef {Object} GameAction
 * @property {string} type            引擎公开操作名（如 'pick'），由宿主调用并统一重绘、结算
 * @property {unknown[]} args         按顺序传给该操作的参数，无参动作使用空数组
 */

/**
 * 宿主注入给引擎与渲染器的能力集合。游戏**不 import 任何服务**，只从这里拿。
 * 这样游戏才能被单测、被复用、将来被远程加载。
 *
 * @typedef {Object} GameContext
 * @property {(key: string, params?: Record<string, unknown>) => string} t  当前语言的翻译函数
 * @property {(action: GameAction) => void} dispatch                      上报输入，宿主负责推进会话与结算
 * @property {() => void} togglePause                                    切换宿主管理的暂停状态
 * @property {(item: ResourceRef|string) => Promise<unknown>} use          取资源，自动缓存+引用计数
 * @property {(name: string, opts?: object) => void} sfx                   播放共享音效
 * @property {(name: string|null) => void} music                           标签页级 BGM（切游戏不重启）
 * @property {(message: string, tone?: 'info'|'warn') => void} toast
 * @property {Theme} theme
 * @property {(event: string, payload?: object) => void} report            埋点/成就
 * @property {{ width: number, height: number, dpr: number }} viewport
 * @property {(fn: () => void) => () => void} onFrame                      需要自管帧循环时用
 */

/* ============================================================================
 * 5. 资源与模型 —— 共享资源库的条目描述
 * ==========================================================================*/

/**
 * @typedef {Object} ResourceRef
 * @property {string} id        全局唯一，如 'sfx.click' / 'art.temple.wall' / 'model.door'
 * @property {string} type
 * @property {string} src
 */

/**
 * 资源清单条目。声明式，由 ResourceManager 统一加载、缓存、失效。
 *
 * @typedef {Object} ResourceItem
 * @property {string} id
 * @property {'image'|'audio'|'json'|'svg'|'module'|'model'} type
 * @property {string} src                 相对路径，构建期会带 hash
 * @property {number} [bytes]             用于首屏加载预算
 * @property {number} [version]           变更即失效缓存
 * @property {'eager'|'lazy'} [load]      默认 lazy
 * @property {string[]} [fallback]        降级链（资源 404 时游戏仍可玩）
 * @property {'none'|'anonymous'} [crossOrigin]
 */

/**
 * 3D 模型资源（glTF/GLB）。模型由美术/外部贡献者提供，与代码解耦。
 *
 * @typedef {Object} ModelAsset
 * @property {string} id
 * @property {string} src                  .glb / .gltf
 * @property {number} [version]
 * @property {number} [bytes]
 * @property {string[]} [animations]       期望包含的动画名，加载后校验
 * @property {string[]} [fallback]
 */

/**
 * 共享实体模板（数据层，非渲染层）。这是"模型"的第二种含义：
 * 可被多个游戏复用的角色 / 道具 / 敌人 / 关卡构件定义。
 *
 * 设计意图：贡献者写第二个跑酷游戏时，不该重新定义一遍士兵的移动速度与碰撞半径；
 * 也不该重新画一遍。实体模板 = 数据 + 默认模型引用，引擎只管驱动，渲染层只管播放。
 *
 * @typedef {Object} EntityTemplate
 * @property {string} id                  如 'entity.soldier.guard'
 * @property {'character'|'prop'|'enemy'|'hazard'|'pickup'} kind
 * @property {string} [model]             ModelAsset.id
 * @property {Record<string, number|string|boolean>} stats   速度/血量/半径等玩法参数
 * @property {string[]} [traits]          语义标签，便于跨游戏检索复用
 * @property {string} [source]            出处（游戏 id 或贡献者），便于溯源
 */

/* ============================================================================
 * 6. 窗口与 UI 主题
 * ==========================================================================*/

/**
 * 可换肤的设计令牌。宿主把 tokens.css 的变量值与之合并。
 *
 * @typedef {Object} Theme
 * @property {'dark'|'light'} scheme
 * @property {string} accent
 * @property {Record<string, string>} [tokens]   覆盖 CSS 变量
 */

/** @typedef {{ accent?: string, tokens?: Record<string,string>, scheme?: 'dark'|'light' }} ThemeOverride */

/* ============================================================================
 * 7. 数据保存库 —— 成绩与进度
 * ==========================================================================*/

/**
 * 一条成绩记录。id 为复合键 `${userId}:${gameId}:${level}`，
 * 天然幂等：同一人同一关重复提交是更新而非插入。
 *
 * 昵称存快照而非引用：纯静态下没有用户表可供 join，且改名不应让历史榜单集体改名。
 *
 * @typedef {Object} ScoreRecord
 * @property {string} id
 * @property {string} userId
 * @property {string} nickname
 * @property {string} gameId
 * @property {number} level
 * @property {number} score
 * @property {number} stars
 * @property {MetricBag} metrics
 * @property {number} plays
 * @property {number} durationMs
 * @property {string} engineVersion
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * 进度记录。与成绩分离：进度可由成绩派生，成绩是原始事实。
 * @typedef {Object} ProgressRecord
 * @property {number} stars        该关历史最高星级（只升不降）
 * @property {number} bestScore
 * @property {boolean} unlocked
 * @property {number} attempts
 */

/* ============================================================================
 * 8. 排行榜
 * ==========================================================================*/

/**
 * @typedef {Object} LeaderboardQuery
 * @property {string} gameId
 * @property {number} [level]               省略 = 跨关卡聚合
 * @property {'best'|'total'|'stars'} [mode='best']
 * @property {'local'|'global'} [scope]
 * @property {number} [limit=50]
 * @property {string} [aroundUserId]        以某人为中心取 ±N，用于"我的名次"
 */

/**
 * @typedef {Object} LeaderboardRow
 * @property {number} rank          竞技排名（并列后跳号：1,2,2,4）
 * @property {string} userId
 * @property {string} nickname
 * @property {number} value
 * @property {number} stars
 * @property {number} durationMs
 * @property {boolean} isSelf
 */

export default {};
