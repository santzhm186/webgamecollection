/**
 * 多人游玩契约 —— 同一游戏、同一局、同时多人。
 * ============================================================================
 * ⚠️ 当前状态：**仅预留接口，尚未实现任何传输适配器。**
 *    宿主还没有"选择玩家人数"的入口，也没有对局编排（matchmaking）。
 *    本文件的作用是**把设计钉死**，使将来加入多人时：
 *      · 引擎的多人逻辑只写一遍（人类 / 电脑 / 联机真人共用）
 *      · 现有单人玩法代码零改动（不声明 players 即为单人）
 *      · 不需要重新讨论架构（新增传输适配器即可，见文末接入步骤）
 *
 * 关键设计（先读这三条，否则很容易做错）：
 *
 *   1. **一个引擎实例 = 一整局，局内有 N 个玩家位。**
 *      不是"每个玩家一个引擎实例"。所以 GameEngine 的契约不变，
 *      多人游戏只是多了若干可被寻址的玩家位。
 *
 *   2. **补丁里只允许有动作，绝不允许有状态。**
 *      传输层复制的是"谁做了什么"，不是"现在场上是什么样"。
 *      因为引擎是确定性纯函数，各端拿着相同动作序列重放必然得到相同状态 ——
 *      这也是本项目能做服务端反作弊的同一个性质。
 *      一旦允许同步状态，确定性就没了，重放校验也没了。
 *
 *   3. **回合同步交给引擎，不交给传输层。**
 *      引擎通过 activePlayers() 报告"现在轮到谁"。传输层只负责分发与校验来源，
 *      不理解任何玩法规则。这样传输层对所有游戏通用，包括将来联机。
 *
 * @typedef {import('./contracts.js').GameEngine} GameEngine
 * @typedef {import('./contracts.js').GameManifest} GameManifest
 */

import { PLAY_MODE, CONTROLLER_KIND } from './enums.js';

/**
 * 一局里的玩家位。
 * @typedef {Object} PlayerSlot
 * @property {number} index                    0-based，动作里用它寻址
 * @property {string} label                    显示名（游戏提供，宿主也可覆盖为昵称）
 * @property {'human'|'bot'|'remote'} controller
 * @property {string} [avatar]                 头像/颜色标识，进 UI
 * @property {boolean} [isSelf]                对本地玩家而言是否"我"
 * @property {boolean} [ready]                 联机准备状态；本地多人恒为 true
 */

/**
 * 对局描述。由宿主创建并注入引擎，引擎依据它决定玩家位数量与顺序。
 * @typedef {Object} MatchConfig
 * @property {'solo'|'local-multi'|'online-multi'} mode
 * @property {number} maxPlayers
 * @property {number} [minPlayers]
 * @property {boolean} [turnBased]             是否回合制（影响宿主是否显示"轮到谁"）
 * @property {string} [matchId]                联机时用于重连；本地局可为空
 * @property {number} [seed]                   随机种子。**多人必须显式传入**，
 *                                             否则各端随机数不同，重放立刻发散
 */

/**
 * 一个动作。传输层与引擎之间唯一的交流单位。
 * @typedef {Object} PlayerAction
 * @property {number} slot          哪个玩家位发起
 * @property {string} type          动作类型，由游戏定义（'pick' / 'pull' / 'remove' …）
 * @property {unknown} [payload]    动作参数，必须**可 JSON 序列化**（联机要过网络）
 * @property {number} [at]          发起时间戳（毫秒）。仅用于展示延迟，
 *                                  **禁止用它参与玩法判定**，否则各端结果不一致
 */

/**
 * 对局补丁。宿主/传输层向引擎提交的唯一形式。
 * 注意 patch.actions 是数组：一次提交可以包含多个玩家的动作（同一帧内并发的输入）。
 *
 * @typedef {Object} MatchPatch
 * @property {PlayerAction[]} actions
 * @property {number} [tick]        期望应用到的逻辑帧号，联机时用于对齐；本地可省
 */

/**
 * 对局传输端口。**只分发动作，不理解规则。**
 *
 * 三种实现共用这一个接口：
 *   localHotseat()  同设备轮流
 *   localBot()      单人 + 电脑对手
 *   （将来）remote() WebSocket / WebRTC
 *
 * @typedef {Object} MatchTransport
 * @property {'local'|'remote'} kind
 * @property {MatchConfig} config
 * @property {PlayerSlot[]} players
 *
 * // --- 生命周期 ---
 * @property {(engine: GameEngine) => Promise<void>} [connect]   联机时建立连接
 * @property {() => void} [disconnect]
 *
 * // --- 动作流 ---
 * // 提交本地动作。实现方**必须**校验 slot 是否属于本端，
 * // 否则本地多人可以伪造对方的操作（联机时就是作弊）。
 * @property {(action: PlayerAction) => boolean} submit
 *
 * // 订阅引擎可应用的动作批次。返回取消订阅函数。
 * @property {(fn: (patch: MatchPatch) => void) => () => void} onPatch
 *
 * // --- 状态 ---
 * // 现在轮到哪些玩家位可以操作。宿主据此禁用其他人的输入控件。
 * // 单人游戏返回 [0]；同设备轮流返回当且仅当当前玩家位。
 * @property {() => number[]} activeSlots
 * @property {() => boolean} isFinished
 */

/**
 * manifest 里的多人声明。**不声明即单人**，保持向后兼容。
 *
 * @typedef {Object} MultiplayerSpec
 * @property {number} min                    最少玩家数（1 = 支持单人开局）
 * @property {number} max                    最多玩家数
 * @property {'solo'|'local-multi'|'online-multi'} defaultMode
 * @property {'simultaneous'|'turn'} [order] 同时操作还是轮流
 * @property {boolean} [requiresSeed]        是否要求宿主提供随机种子（有随机性的玩法必须为 true）
 */

/**
 * 校验多人声明是否合法。契约测试会调用它，避免贡献者写出
 * max < min、或缺 defaultMode 这类会让宿主取到 undefined 的声明。
 *
 * @param {MultiplayerSpec|undefined} spec
 * @returns {string[]} 错误列表，空数组表示通过
 */
export function validateMultiplayerSpec(spec) {
  if (spec === undefined) return [];   // 不声明 = 单人，合法
  const errors = [];
  if (!Number.isInteger(spec.min) || spec.min < 1) errors.push('players.min 必须是 >= 1 的整数');
  if (!Number.isInteger(spec.max) || spec.max < 1) errors.push('players.max 必须是 >= 1 的整数');
  if (Number.isInteger(spec.min) && Number.isInteger(spec.max) && spec.max < spec.min) {
    errors.push('players.max 不能小于 players.min');
  }
  if (!Object.values(PLAY_MODE).includes(spec.defaultMode)) {
    errors.push(`players.defaultMode 必须是 ${Object.values(PLAY_MODE).join(' / ')} 之一`);
  }
  if (spec.defaultMode === PLAY_MODE.SOLO && spec.max > 1) {
    errors.push('defaultMode 为 solo 时 players.max 应为 1；多人默认请用 local-multi');
  }
  if (spec.defaultMode !== PLAY_MODE.SOLO && spec.max < 2) {
    errors.push('多人默认模式要求 players.max >= 2');
  }
  if (spec.order !== undefined && !['simultaneous', 'turn'].includes(spec.order)) {
    errors.push("players.order 必须是 'simultaneous' 或 'turn'");
  }
  if (spec.requiresSeed !== undefined && typeof spec.requiresSeed !== 'boolean') {
    errors.push('players.requiresSeed 必须是布尔值');
  }
  return errors;
}

/**
 * 为一个多人声明生成默认玩家位。宿主在创建对局时调用，
 * 避免每个游戏都自己写一遍"造 N 个玩家位"的样板代码。
 *
 * @param {MultiplayerSpec} spec
 * @param {number} count
 * @param {string} [selfLabel]
 * @returns {PlayerSlot[]}
 */
export function createPlayerSlots(spec, count, selfLabel = '你') {
  const total = Math.max(spec.min, Math.min(spec.max, count));
  return Array.from({ length: total }, (_, index) => ({
    index,
    label: index === 0 ? selfLabel : `${index + 1}P`,
    // 单人局的 1 号位恒为人类；座位 2..N 在本地多人下也是人类（同设备），
    // 若宿主决定用电脑补位，只需把 controller 改成 BOT 即可，引擎无需改动。
    controller: CONTROLLER_KIND.HUMAN,
    isSelf: index === 0,
    ready: true,
  }));
}

/* ============================================================================
 * 接入路线（将来实现多人时照此进行，不需要重新讨论架构）
 * ============================================================================
 *
 * 本文件只定义契约。下面这些**都还没做**，属于预留：
 *
 *   [ ] src/multiplayer/hotseat-transport.js   同设备轮流：submit() 校验 slot 属于本端；
 *                                              轮流局拒绝非当前回合的输入（返回 false，
 *                                              而不是排队 —— 排队会让"提前输入"在轮到时
 *                                              突然生效，玩家会觉得游戏乱动）
 *   [ ] src/multiplayer/bot-transport.js       电脑对手：决策函数必须只依赖
 *                                              (engine, slot, step)，禁止 Date.now()/Math.random()，
 *                                              否则各端重放发散
 *   [ ] src/multiplayer/remote-transport.js    联机：WebSocket / WebRTC / 轮询
 *   [ ] GameEngine 增加可选 activePlayers(): number[]    ← **第一步就该做这个**
 *   [ ] 宿主侧：玩家人数选择入口、对局编排、分屏或回合提示 UI
 *   [ ] GameRenderer 支持多玩家位布局（分屏时每个玩家一段视口）
 *   [ ] ScoreRecord 增加 slots/playerCount 字段（成绩口径要区分几人局）
 *
 * 推荐实现顺序：
 *   ① 先给一个现有游戏加 activePlayers() 与 players 声明（仍只支持 1 人）
 *   ② 实现 hotseat 适配器 + 人数选择入口（同设备双人，最容易验证）
 *   ③ 实现 bot 适配器（复用同一接口，验证"引擎不区分人与电脑"）
 *   ④ 最后才做 remote —— 此时玩法代码已经不需要任何改动
 *
 * 每一步都必须补测试：多人玩法的主要风险不是"连不上"，而是
 * **非确定性导致各端状态发散**，而这类 bug 只在联机时才暴露。
 * 因此从第 ② 步起就要有"同一动作序列重放得到同一结果"的测试。
 */

export default { validateMultiplayerSpec, createPlayerSlots };
