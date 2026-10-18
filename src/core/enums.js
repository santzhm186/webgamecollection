/**
 * 闭合枚举字典（机器值）—— 宿主需要在代码里判断的所有取值，唯一来源。
 * ============================================================================
 * 分层规则（详见 docs/NAMING-CONVENTIONS.md）：
 *
 *   本文件        闭合枚举：谁能加成员 = 只有宿主，且属于契约变更
 *   labels.js     共用显示文案：多个游戏共享的玩家可见文本
 *   i18n.js       多语言文本：所有面向玩家的字符串
 *   games/*\/dictionary.js   游戏私有词汇：宿主不认识，各游戏自管
 *
 * 判断某个新名字该放哪里，问一句：**宿主需要在代码里 if 它吗？**
 *   需要 → 本文件（或 labels.js）；不需要 → 游戏自己的 dictionary.js
 *
 * 注意两个曾经撞车的 kind：
 *   RENDERER_KIND  渲染技术（canvas / dom / webgl）
 *   STORAGE_KIND   存储实现（local / memory / sqlite）
 * 它们语义无关，必须分开命名，禁止再统一叫 kind。
 *
 * 每个成员都必须附中文注释，说明"什么时候会用到它"。
 * 加成员前先确认没有等价成员 —— 重复的枚举比缺少的枚举危害更大。
 */

/** 引擎状态。宿主据此显隐开始/暂停/提示/撤销按钮，并在 WON 时结算与入库。 */
export const ENGINE_STATUS = Object.freeze({
  LOADING: 'loading',   // 引擎构造中（需要异步预处理的玩法，可选状态）
  READY: 'ready',       // 已就绪但未开始，宿主显示"开始"
  PLAYING: 'playing',   // 进行中
  WON: 'won',           // 通关，宿主结算星级与分数
  LOST: 'lost',         // 失败，允许重试或撤销
});

/** 渲染技术。决定宿主提供 canvas 还是普通容器、是否由宿主托管 rAF。 */
export const RENDERER_KIND = Object.freeze({
  CANVAS: 'canvas',     // 宿主给 <canvas>，并托管逐帧循环
  DOM: 'dom',           // 宿主给容器，渲染器返回 HTML/SVG 字符串
  WEBGL: 'webgl',       // 宿主给 canvas 与 WebGL2 上下文（3D 游戏）
});

/** 存储实现。**与 RENDERER_KIND 无关**，不要共用 kind 命名。 */
export const STORAGE_KIND = Object.freeze({
  LOCAL: 'local',       // localStorage，浏览器默认
  MEMORY: 'memory',     // 内存，测试与隐私模式降级
  SQLITE: 'sqlite',     // 预留：Node + SQLite 后端
});

/** 玩法模式。决定宿主是否显示玩家位、是否禁用暂停、如何分配输入。 */
/* 玩法模式。当前宿主只走 SOLO —— 多人接口已预留但未实现，见 core/multiplayer.js。
   枚举成员先定义好，避免将来加多人时改动持久化与契约字段。 */
export const PLAY_MODE = Object.freeze({
  SOLO: 'solo',             // 单人（当前唯一在用的模式）
  LOCAL_MULTI: 'local-multi', // 【预留】同设备多人：轮流或分屏
  ONLINE_MULTI: 'online-multi', // 【预留】联机多人：需远端 MatchTransport 实现
});

/** 玩家位的控制来源。宿主据此显示"你 / 电脑 / 远程"。 */
export const CONTROLLER_KIND = Object.freeze({
  HUMAN: 'human',       // 本机人类，同设备多人时可能有多个
  BOT: 'bot',           // 【预留】电脑对手，与真人共用同一套玩家位
  REMOTE: 'remote',     // 【预留】联机玩家
});

/** 存储命名空间。除 src/storage/** 外禁止直接访问持久化，一律经此隔离。 */
export const NAMESPACE = Object.freeze({
  SCORES: 'scores',       // 成绩记录，排行榜数据源
  PROGRESS: 'progress',   // 星级/解锁，可由成绩派生
  SETTINGS: 'settings',   // 语言/音效/主题等本机设置
  IDENTITY: 'identity',   // 设备 ID 与昵称
  META: 'meta',           // 适配器版本、迁移标记
});

/** 排行榜聚合口径。 */
export const LEADERBOARD_MODE = Object.freeze({
  BEST: 'best',         // 单关最高分（默认）
  TOTAL: 'total',       // 跨关卡总分
  STARS: 'stars',       // 星数榜
});

/** 排行榜可见范围。local 时 UI 必须诚实标注"仅本机成绩"。 */
export const RANK_SCOPE = Object.freeze({
  LOCAL: 'local',
  GLOBAL: 'global',     // 需要 capabilities.remote 的适配器
});

/** 成绩排序方向。决定"什么算更好"，由 manifest.scoring 声明。 */
export const SCORING_ORDER = Object.freeze({
  DESC: 'desc',         // 分数越高越好（绝大多数玩法）
  ASC: 'asc',           // 越小越好（用时、步数）
});

/** 主指标类型，与 SCORING_ORDER 配合决定榜单排序键。 */
export const SCORING_PRIMARY = Object.freeze({
  SCORE: 'score',   // 主指标就是分数
  STARS: 'stars',   // 主指标是星数（星级榜）
  TIME: 'time',     // 主指标是耗时，需与 SCORING_ORDER.ASC 配合
});

/** HUD 字段的语气，宿主据此上色。 */
export const HUD_TONE = Object.freeze({
  NORMAL: 'normal',     // 常规数值，默认语气
  WARN: 'warn',         // 需要玩家注意（如提示次数已用、槽位将满）
  GOOD: 'good',         // 正向（如已达三星门槛）
});

/** 轻提示语气。 */
export const TOAST_TONE = Object.freeze({
  INFO: 'info',         // 中性提示（已保存、语言已切换等）
  WARN: 'warn',         // 需要玩家处理的提示（如存储不可用）
});

/** 游戏分类。同时用于首页筛选与卡片分组。 */
export const CATEGORY = Object.freeze({
  ACTION: 'action',     // 动作冲关：考验反应与节奏
  PUZZLE: 'puzzle',     // 脑力解谜：考验推理与规划
  CASUAL: 'casual',     // 休闲解压：无压力、可随时停下
});

/**
 * 音效名。**这是一份注册表而非普通枚举**：游戏只能在 manifest.uses.sfx 里
 * 引用这里已存在的名字，引用未注册的名字会让契约测试失败。
 * 新增音效 = 在 src/services/audio-manager.js 登记（合成音或音频文件）后加到这里。
 */
export const SFX = Object.freeze({
  CLICK: 'click',       // 常规点击/有效操作
  WIN: 'win',           // 通关
  LOSE: 'lose',         // 失败
  FALL: 'fall',         // 物件脱落/门通过等阶段性事件
  SHOOT: 'shoot',       // 战机射击或发射投射物
  HIT: 'hit',           // 击中敌人或障碍物受击反馈
  POWERUP: 'powerup',   // 获得升级强化或奖励拾取
  POUR: 'pour',         // 液体倾倒转移
});

/** 集合视图，供契约测试与校验脚本枚举使用（避免各处 Object.values 手写）。 */
export const ALL_ENUMS = Object.freeze({
  ENGINE_STATUS,
  RENDERER_KIND,
  STORAGE_KIND,
  PLAY_MODE,
  CONTROLLER_KIND,
  NAMESPACE,
  LEADERBOARD_MODE,
  RANK_SCOPE,
  SCORING_ORDER,
  SCORING_PRIMARY,
  HUD_TONE,
  TOAST_TONE,
  CATEGORY,
  SFX,
});

export default ALL_ENUMS;
