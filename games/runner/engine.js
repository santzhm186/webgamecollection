/**
 * 加减门冲关 · 玩法引擎（纯逻辑，无 DOM）
 * ============================================================================
 * 硬规则（由 tests/dictionary.test.mjs 的 T5/T6 强制）：
 *   1. 本文件不得出现 document / window / localStorage / requestAnimationFrame
 *   2. 状态全在实例上；render.js 只是 (engine, theme) => 画面
 *   3. 宿主能力只从 host-surface.js 取
 *   4. stars / score 由本引擎判定，宿主只存不猜
 *
 * 玩法模型（确定性，不依赖帧率）：时间驱动推进 → 到点结算增益门与守卫消耗 →
 * 抵达要塞后按"一对一交换兵力"结算胜负 → 星级与分数只由**抵达兵力**决定。
 *
 * @typedef {import('../../src/core/contracts.js').GameEngine} GameEngine
 * @typedef {import('../../src/core/contracts.js').GameContext} GameContext
 */
import { t as hostT } from '../../src/core/host-surface.js';
import RUNNER_LEVELS from './levels.js';

/** 必须与 manifest.id 一致（契约测试会校验） */
export const GAME_ID = 'runner';

/** 取翻译函数：优先用宿主注入的 ctx.t，否则用 i18n 的当前语言（便于测试） */
const pickT = ctx => (typeof ctx?.t === 'function' ? ctx.t : hostT);

/**
 * 应用一个增益门。运算符语义：
 *   '+' 加入   '×' 翻倍   '−' 减员（当前关卡数据未使用，保留以支持"陷阱门"设计）
 * @param {number} count
 * @param {[string, number]} choice
 * @returns {number}
 */
export function applyGate(count, [operator, value]) {
  if (operator === '+') return count + value;
  if (operator === '×') return count * value;
  return Math.max(0, count - value);
}

export default class Runner {
  /**
   * @param {number} [level]
   * @param {GameContext} [ctx]
   */
  constructor(level = 0, ctx = {}) {
    this.gameId = GAME_ID;
    this.t = pickT(ctx);
    this.level = level;
    this.config = RUNNER_LEVELS[level] ?? RUNNER_LEVELS[0];
    this.time = 0;

    this.army = this.config.initial;
    this.peak = this.army;
    this.side = 0;              // 0 = 左门，1 = 右门
    this.position = .25;        // 队伍横向位置（0..1），渲染层只读

    this.gate = 0;              // 已通过的门数
    this.status = 'ready';      // ready → playing → won | lost
    this.phase = 'run';         // run → boss
    this.stars = 0;
    this.score = 0;

    this.bossHealth = this.config.boss;
    this.battleInitial = 0;     // 抵达要塞时的兵力（星级判定依据）
    this.trace = [];            // 每个门的完整结算记录，供回放/调试
    this.event = null;          // 最近一次事件，渲染层用于播放浮字动画
    this.message = this.t('game.runner.intro', { boss: this.config.boss });
  }

  start() { if (this.status === 'ready') this.status = 'playing'; }

  /** 统一的选门操作：规则层拒绝非法输入和不能再选门的状态。 */
  chooseSide(side) {
    if (this.status !== 'playing' || this.phase !== 'run' || (side !== 0 && side !== 1)) return false;
    this.side = side;
    return true;
  }

  /**
   * 推进一帧。dt 会被钳制在 [0, 0.1]：
   * 切后台回来、掉帧、或标签页被节流时，dt 可能极大甚至非法，
   * 直接用会让队伍瞬移并跳过增益门，所以这里统一夹紧。
   * @param {number} delta 秒
   */
  tick(delta) {
    if (this.status !== 'playing') return;
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .1)) : 0;
    this.time += dt;
    // 指数趋近目标侧门：帧率无关（不用线性插值，否则不同刷新率手感不同）
    this.position += ((this.side === 0 ? .25 : .75) - this.position) * (1 - Math.exp(-dt * 18));

    const gate = this.config.gates[this.gate];
    if (gate && this.time >= gate.at) {
      const before = this.army, choice = gate.choices[this.side];
      const gained = applyGate(this.army, choice);
      this.peak = Math.max(this.peak, gained);
      this.army = Math.max(0, gained - gate.enemy);   // 先应用门，再扣守卫（README 数值规则）
      this.trace.push({ before, side: this.side, gained, after: this.army, enemy: gate.enemy });
      this.event = { at: this.time, type: 'gate', gain: gained - before, loss: gate.enemy, side: this.side };
      this.message = this.t('game.runner.gateResult', { gate: choice.join(''), gained, loss: gate.enemy, army: this.army });
      this.gate++;
      if (!this.army) { this.status = 'lost'; this.message = this.t('game.runner.exhausted'); }
    }

    if (this.time >= this.config.bossAt && this.phase === 'run' && this.status === 'playing') {
      this.phase = 'boss';
      this.battleInitial = this.army;
      this.event = { at: this.time, type: 'boss' };
      this.message = this.t('game.runner.bossStart', { army: this.battleInitial, boss: this.config.boss });
    }

    if (this.phase === 'boss' && this.status === 'playing') {
      // 要塞交战是纯展示动画；胜负只取决于 battleInitial，与动画进度无关
      const damage = Math.min(this.config.boss, (this.time - this.config.bossAt) / 2.8 * this.config.boss);
      this.army = Math.max(0, Math.ceil(this.battleInitial - damage));
      this.bossHealth = Math.max(0, Math.ceil(this.config.boss - damage));
      if (damage >= Math.min(this.config.boss, this.battleInitial)) {
        this.status = this.battleInitial >= this.config.boss ? 'won' : 'lost';
        if (this.status === 'won') {
          this.bossHealth = 0;
          this.army = this.battleInitial - this.config.boss;
          this.stars = this.config.stars.filter(n => this.battleInitial >= n).length;
          this.score = this.battleInitial * 10 + this.stars * 250;
          this.message = this.t('game.runner.win', { arrived: this.battleInitial, left: this.army, stars: this.stars });
        } else {
          this.message = this.t('game.runner.short', { gap: this.config.boss - this.battleInitial });
        }
      }
    }
  }

  /** 宿主 HUD 字段（宿主不猜任何玩法数字） */
  hud() {
    return [
      { label: this.t('game.runner.hudArmy'), value: this.army },
      { label: this.t('game.runner.hudBoss'), value: this.config.boss },
      { label: this.t('game.runner.hudNext'), value: this.config.gates[this.gate]?.enemy ?? this.t('game.runner.boss') },
    ];
  }

  /**
   * 结构化指标，进成绩库。
   * route 记录每个门的选择序列（'0,1,0'），服务端可只凭
   * (gameId, level, route) 重放本局并验证分数 —— 无需信任客户端上报的 score。
   */
  metrics() {
    return {
      route: this.trace.map(step => step.side).join(','),
      arrived: this.battleInitial,
      peak: this.peak,
      gates: this.gate,
    };
  }
}

/**
 * 穷举一个关卡的**全部**二选一路线，输出可审查的平衡数据。
 * 这是 `npm run balance` 与测试的共同数据源：同一份规则同时服务游戏、测试与报告。
 * @param {number} level
 * @returns {{routes: number, winning: number, max: number, threeStars: number}}
 */
export function runnerBalance(level) {
  const config = RUNNER_LEVELS[level], outcomes = [];
  for (let bits = 0; bits < 2 ** config.gates.length; bits++) {
    let army = config.initial;
    for (let i = 0; i < config.gates.length; i++) {
      const gate = config.gates[i];
      army = Math.max(0, applyGate(army, gate.choices[(bits >> i) & 1]) - gate.enemy);
      if (!army) break;
    }
    outcomes.push(army);
  }
  return {
    routes: outcomes.length,
    winning: outcomes.filter(n => n >= config.boss).length,
    max: Math.max(...outcomes),
    threeStars: outcomes.filter(n => n >= config.stars[2]).length,
  };
}
