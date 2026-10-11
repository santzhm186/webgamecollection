/**
 * 游戏会话（lifecycle）—— 一局游戏的宿主侧状态机，**纯逻辑、无 DOM**。
 * ============================================================================
 * 职责边界（这条边界是本次重构最重要的产物）：
 *
 *   引擎（games/<id>/engine.js）  玩法规则：状态、星级、分数、message
 *   会话（本文件）                宿主侧编排：创建、推进、暂停、结算判定
 *   UI（app.mjs / ui 组件）       DOM：挂载渲染器、读 HUD、显示结果面板、播声音
 *
 * 本文件之所以不碰 DOM，是为了让"何时结算、星级如何取、切后台如何暂停"
 * 这类**跨游戏通用**的逻辑能被自动化测试覆盖 —— 这些正是最容易出回归、
 * 又最难手工测的部分（本项目靠它保障 224 条路线的判定不被改错）。
 *
 * @typedef {import('./contracts.js').GameEngine} GameEngine
 * @typedef {import('./contracts.js').RendererFactory} RendererFactory
 */
import { ENGINE_STATUS } from './enums.js';

/** 单帧允许的最大推进步长（秒）。与引擎内部夹紧保持一致，双保险。 */
const MAX_FRAME_DELTA = 0.1;

/**
 * 创建一个会话。
 *
 * @param {object} options
 * @param {string} options.gameId
 * @param {number} options.level
 * @param {new (level: number, ctx: object) => GameEngine} options.Engine
 * @param {RendererFactory} options.createRenderer
 * @param {object} [options.ctx]          注入给引擎的上下文（t / sfx / theme …）
 * @param {() => number} [options.now]    时钟注入点，测试可替换为确定性时钟
 * @param {boolean} [options.timeDriven]  是否逐帧推进（缺省时按引擎是否实现 tick 判断）
 * @param {number} [options.startTimeMs]  会话创建时刻
 */
export function createSession({
  gameId, level, Engine, createRenderer, ctx = {},
  now = () => Date.now(),
  timeDriven,
  startTimeMs = now(),
}) {
  if (typeof Engine !== 'function') throw new TypeError('createSession 需要 Engine 构造函数');
  if (typeof createRenderer !== 'function') throw new TypeError('createSession 需要 createRenderer 工厂');

  const engine = new Engine(level, ctx);
  const renderer = createRenderer();
  const startedAt = startTimeMs;

  /** @type {{status: string, stars: number, score: number, durationMs: number, metrics: object}|null} */
  let outcome = null;

  const session = {
    gameId,
    level,
    engine,
    renderer,
    /**
     * 注入上下文。宿主必须把它（而不是别的对象）传给 renderer.mount ——
     * 渲染器正是通过 ctx.dispatch 把玩家操作回报给宿主的。
     * 曾经因为传了另一个对象导致"点了没反应"，这类错误没有任何报错，极难排查。
     */
    ctx,
    /** 引擎是否需要逐帧推进。显式声明优先，否则按是否实现 tick 推断。 */
    timeDriven: timeDriven ?? typeof engine.tick === 'function',
    paused: false,
    /** 已推进的逻辑时间（秒），暂停期间不增长 */
    elapsed: 0,
    /** 最近一次观察到的状态，用于判定"刚刚发生了什么" */
    lastStatus: engine.status,
    /** 状态栏文案（宿主直接渲染，含无障碍 live region） */
    get message() { return session.paused ? null : engine.message; },
    get status() { return engine.status; },
    get isPlaying() { return engine.status === ENGINE_STATUS.PLAYING && !session.paused; },
    get isOver() { return engine.status === ENGINE_STATUS.WON || engine.status === ENGINE_STATUS.LOST; },
    get outcome() { return outcome; },

    /** 开始（对 ready 状态生效；对已在进行的游戏是空操作） */
    start() {
      engine.start?.();
      session.lastStatus = engine.status;
      return engine.status;
    },

    /**
     * 推进一帧。只有 timeDriven 且进行中才会真正推进 ——
     * 这替代了旧实现里 `if (active.id !== 'runner') return` 的硬编码游戏判断。
     * @param {number} deltaSeconds
     * @returns {boolean} 是否推进了
     */
    advance(deltaSeconds) {
      if (!session.timeDriven || !session.isPlaying) return false;
      const delta = Number.isFinite(deltaSeconds)
        ? Math.max(0, Math.min(deltaSeconds, MAX_FRAME_DELTA))
        : 0;
      if (delta === 0) return false;
      session.elapsed += delta;
      engine.tick(delta);
      return true;
    },

    /** 暂停。返回是否发生了状态变化（幂等，便于重复调用）。 */
    pause() {
      if (session.paused || !session.isPlaying) return false;
      session.paused = true;
      engine.pause?.();
      return true;
    },

    resume() {
      if (!session.paused) return false;
      session.paused = false;
      engine.resume?.();
      return true;
    },

    togglePause() {
      return session.paused ? session.resume() : session.pause();
    },

    /**
     * 结算检测。宿主每帧（或每次交互后）调用一次。
     *
     * 之所以由会话而不是 UI 判断"是否刚刚结束"：每次进入结束状态，结算必须
     * **恰好发生一次**（重复结算会让分数翻倍、重复播放音效）。撤销恢复进行中
     * 时清空 outcome，让后续通关或失败可以重新结算；UI 只负责展示。
     *
     * @returns {null|{event: 'win'|'lose', stars: number, score: number, durationMs: number, metrics: object}}
     */
    poll() {
      const status = engine.status;
      const changed = status !== session.lastStatus;
      session.lastStatus = status;

      if (outcome || !session.isOver) return null;
      if (!changed && outcome) return null;

      outcome = {
        status,
        stars: Number(engine.stars) || 0,
        score: Number(engine.score) || 0,
        durationMs: Math.max(0, now() - startedAt),
        metrics: typeof engine.metrics === 'function' ? engine.metrics() : {},
      };
      return { event: status === ENGINE_STATUS.WON ? 'win' : 'lose', ...outcome };
    },

    /** 提示（引擎实现了才有）。返回引擎原样返回的高亮目标。 */
    hint() {
      if (session.isOver || typeof engine.hint !== 'function') return null;
      return engine.hint();
    },

    /** 撤销（引擎实现了才有） */
    undo() {
      if (typeof engine.undo !== 'function') return false;
      const done = engine.undo();
      if (done) {
        session.lastStatus = engine.status;
        // 恢复进行中后，旧失败不再是当前结果；无效撤销和结束状态保留原结算。
        if (!session.isOver) outcome = null;
      }
      return done;
    },

    /** 释放渲染器资源。宿主在关闭游戏/切换关卡时**必须**调用。 */
    destroy() {
      try { renderer.destroy?.(); }
      catch (error) { console.error('[session] renderer.destroy 抛错，已忽略', error); }
    },
  };

  return session;
}

export default createSession;
