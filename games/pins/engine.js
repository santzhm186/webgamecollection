/**
 * 拉针救人 · 玩法引擎（纯逻辑，无 DOM）
 * ============================================================================
 * 硬规则：
 *   1. 本文件不得出现 document / window / localStorage / requestAnimationFrame
 *   2. 宿主能力只从 host-surface.js 取
 *   3. stars / score 由本引擎判定，宿主只存不猜
 */
import { t as hostT } from '../../src/core/host-surface.js';
import PIN_LEVELS from './levels.js';
import { pinLabel } from './dictionary.js';

export { PIN_LEVELS };
export const GAME_ID = 'pins';

/** 取翻译函数：优先用宿主注入的 ctx.t，否则用 i18n 当前语言 */
const pickT = ctx => (typeof ctx?.t === 'function' ? ctx.t : hostT);

export class Pins {
  constructor(level = 0, ctx = {}) {
    this.gameId = GAME_ID;
    this.t = pickT(ctx);
    this.level = level;
    this.config = PIN_LEVELS[level] ?? PIN_LEVELS[0];
    this.hot = true;
    this.drained = false;
    this.spider = !!this.config.spider;
    this.gas = !!this.config.gas;
    this.bridge = !this.config.bridge;
    this.removed = new Set();
    this.status = 'playing';
    this.hints = 0;
    this.undos = 0;
    this.moves = 0;
    this.stars = 0;
    this.score = 0;
    this.lastPin = null;
    this.history = [];
    this.message = this.t(this.config.introKey ?? 'game.pins.intro');
  }

  /**
   * 当前所有安全的机关。这是整套拉针规则唯一的真值来源：
   * hint() 直接取它，测试也用穷举验证"每一种安全顺序都能通关"。
   */
  safePins() {
    if (this.status !== 'playing') return [];
    return this.config.pins.filter(pin => !this.removed.has(pin) && (
      (pin === 'vent' && (!this.config.ventBlockedBySpider || !this.spider)) || (pin === 'spider' && this.hot) ||
      (pin === 'water' && !this.gas && !this.spider) ||
      (pin === 'drain' && !this.hot && !this.spider && (!this.config.bridgeBeforeDrain || this.bridge)) ||
      (pin === 'bridge' && (this.config.bridgeBeforeDrain ? !this.hot && !this.spider && !this.gas : this.drained)) ||
      (pin === 'treasure' && this.drained && this.bridge && !this.spider && !this.gas)
    ));
  }

  hint() {
    const pin = this.safePins()[0];
    if (!pin) return null;
    this.hints++;
    this.message = this.t('game.pins.hint', { pin: pinLabel(pin) });
    return pin;
  }

  /** 拉一根针。非法操作返回 false 且不产生任何副作用。 */
  pull(pin) {
    if (this.status !== 'playing' || this.removed.has(pin) || !this.config.pins.includes(pin)) return false;

    // 记录历史供撤销
    this.history.push({
      removed: new Set(this.removed),
      hot: this.hot,
      drained: this.drained,
      spider: this.spider,
      gas: this.gas,
      bridge: this.bridge,
      moves: this.moves,
      lastPin: this.lastPin,
      message: this.message,
    });

    this.removed.add(pin);
    this.moves++;
    this.lastPin = pin;

    const fail = key => {
      this.status = 'lost';
      this.message = this.t(key);
    };

    if (pin === 'vent') {
      if (this.config.ventBlockedBySpider && this.spider) fail('game.pins.ventFailWeb');
      else { this.gas = false; this.message = this.t('game.pins.vent'); }
    }
    if (pin === 'spider') {
      if (!this.hot) fail('game.pins.spiderFail');
      else { this.spider = false; this.message = this.t('game.pins.spiderOk'); }
    }
    if (pin === 'water') {
      if (this.gas) fail('game.pins.waterFail');
      else { this.hot = false; this.message = this.t(this.config.bridgeBeforeDrain ? 'game.pins.waterOkSupport' : 'game.pins.waterOk'); }
    }
    if (pin === 'drain') {
      if (this.hot) fail('game.pins.drainFailHot');
      else if (this.spider) fail('game.pins.drainFailSpider');
      else if (this.config.bridgeBeforeDrain && !this.bridge) fail('game.pins.drainFailSupport');
      else { this.drained = true; this.message = this.t(this.config.bridge && !this.bridge ? 'game.pins.drainOkBridge' : 'game.pins.drainOk'); }
    }
    if (pin === 'bridge') {
      if (this.config.bridgeBeforeDrain && (this.hot || this.spider || this.gas)) fail('game.pins.bridgeFailSupport');
      else if (!this.config.bridgeBeforeDrain && !this.drained) fail('game.pins.bridgeFail');
      else { this.bridge = true; this.message = this.t(this.config.bridgeBeforeDrain ? 'game.pins.bridgeOkSupport' : 'game.pins.bridgeOk'); }
    }
    if (pin === 'treasure') {
      if (!this.drained || this.spider || this.gas) fail('game.pins.treasureDanger');
      else if (!this.bridge) fail('game.pins.treasureNoBridge');
      else {
        this.status = 'won';
        const penalties = this.hints + this.undos;
        this.stars = penalties === 0 ? 3 : penalties <= 2 ? 2 : 1;
        this.score = this.config.pins.length * 200 + this.stars * 300;
        this.message = this.t('game.pins.win', { moves: this.moves, stars: this.stars });
      }
    }
    return true;
  }

  /** 每关提供一次撤销容错。 */
  undo() {
    if (this.undos >= 1 || !this.history.length || this.status === 'won') return false;
    const prev = this.history.pop();
    this.undos++;
    this.removed = prev.removed;
    this.hot = prev.hot;
    this.drained = prev.drained;
    this.spider = prev.spider;
    this.gas = prev.gas;
    this.bridge = prev.bridge;
    this.moves = prev.moves;
    this.lastPin = prev.lastPin;
    this.status = 'playing';
    this.message = this.t('game.pins.undone');
    return true;
  }

  hud() {
    return [
      { label: this.t('game.pins.hudPins'), value: `${this.removed.size} / ${this.config.pins.length}` },
      { label: this.t('game.pins.hudHints'), value: this.hints, tone: this.hints > 0 ? 'warn' : 'normal' },
    ];
  }

  metrics() {
    return { order: [...this.removed].join(','), moves: this.moves, hints: this.hints, undos: this.undos };
  }
}

export default Pins;
