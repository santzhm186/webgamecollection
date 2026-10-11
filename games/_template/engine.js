/**
 * 模板引擎 —— 展示契约要求的最小实现。
 *
 * 硬规则回顾（详见 games/README.md）：
 *   1. 本文件不得出现 document / window / localStorage / requestAnimationFrame
 *   2. 状态全在实例上，renderer 只是 (engine, theme) => 画面
 *   3. 外部能力只从构造参数 ctx 拿，禁止 import 宿主服务
 *   4. stars / score 由本引擎判定，宿主只存不猜
 *
 * @typedef {import('../../src/core/contracts.js').GameEngine} GameEngine
 * @typedef {import('../../src/core/contracts.js').GameContext} GameContext
 *
 * 宿主能力只从 `../../src/core/host-surface.js` 取（tests/dictionary.test.mjs 的 T5
 * 会强制这条边界）。正式接入时优先使用 ctx.t；未注册模板使用自己的预览字典。
 */

import LEVELS from './levels.js';
import { t as templateT } from './dictionary.js';

/**
 * 必须与 manifest.id 一致（"my-game" → 你改名时记得同步）。
 * 契约测试会校验 engine.gameId === manifest.id，不一致会直接失败。
 * 单独提出来是为了让改名只发生在一处。
 */
const MY_GAME_ID = 'my-game';

/** 每次操作的取值，属于玩法数值，改动时必须提升 manifest.engineVersion */
const STEPS = [1, 2, 3, 4];

export default class MyGameEngine {
  /**
   * @param {number} level
   * @param {GameContext} ctx
   */
  constructor(level = 0, ctx = /** @type {any} */ ({})) {
    this.gameId = MY_GAME_ID;
    this.level = level;
    this.ctx = ctx;                       // 只用它做 sfx/toast，绝不 import 宿主
    this.t = typeof ctx.t === 'function' ? ctx.t : templateT;
    this.config = LEVELS[level] ?? LEVELS[0];

    this.status = 'ready';                // ready → playing → won | lost
    this.message = this.t('game.my-game.intro', { target: this.config.target });
    this.stars = 0;
    this.score = 0;

    this.total = 0;
    this.moves = 0;
    this.picks = [];                      // 操作序列，用于服务端重放校验
    this.hints = 0;
    this.event = null;
  }

  start() {
    if (this.status === 'ready') {
      this.status = 'playing';
      this.message = this.t('game.my-game.start');
      this.ctx?.sfx?.('click');
    }
  }

  /**
   * 模板玩法不需要连续帧，因此**不实现 tick**。
   * 宿主用 typeof 探测后会跳过 rAF —— 这是"静止时零 CPU"的来源。
   * 如果你的游戏需要逐帧推进（如跑酷），实现 tick(dt) 即可，dt 已由宿主夹在 [0, 0.1]。
   */

  /**
   * 唯一操作入口。非法操作必须返回 false 且**不产生任何副作用**。
   * @param {number} index
   * @returns {boolean}
   */
  pick(index) {
    if (this.status !== 'playing') return false;
    if (!Number.isInteger(index) || index < 0 || index >= STEPS.length) return false;

    this.picks.push(index);
    this.total += STEPS[index];
    this.moves++;
    this.event = { index, gain: STEPS[index] };

    if (this.total >= this.config.target) {
      // 星级只由玩法决定；提示会降星，但**不影响解锁**（进度与星级解耦）
      this.stars = this.hints === 0 && this.moves <= this.config.steps ? 3
        : this.moves <= this.config.budget ? 2 : 1;
      this.score = this.total * 10 - this.moves * 5 + this.stars * 100;
      this.status = 'won';
      this.message = this.t('game.my-game.win', { total: this.total, moves: this.moves, stars: this.stars });
      this.ctx?.sfx?.('win');
    } else {
      this.message = this.t('game.my-game.current', { total: this.total, target: this.config.target });
      this.ctx?.sfx?.('click');
    }
    return true;
  }

  /** 可选能力：实现了宿主的"给点提示"按钮才会出现 */
  hint() {
    if (this.status !== 'playing') return null;
    this.hints++;
    const best = this.total + 4 >= this.config.target ? STEPS.length - 1 : 0;
    this.message = this.t('game.my-game.hint', { n: best + 1 });
    return best;
  }

  /** 必需：宿主不猜任何玩法相关的数字 */
  hud() {
    return [
      { label: this.t('game.my-game.hudTotal'), value: `${this.total} / ${this.config.target}` },
      { label: this.t('game.my-game.hudMoves'), value: this.moves },
      { label: this.t('game.my-game.hudHints'), value: this.hints, tone: this.hints ? 'warn' : 'normal' },
    ];
  }

  /**
   * 必需：进成绩库的结构化指标。
   * 请**尽量记录操作序列** —— 本项目引擎是确定性的，服务端可以只凭
   * (gameId, level, picks) 重放验证分数，无需信任客户端上报的 score。
   */
  metrics() {
    return { picks: this.picks.join(','), moves: this.moves, total: this.total, hints: this.hints };
  }
}
