/**
 * 过渡文件：pins 与 screws 的规则层。
 * ============================================================================
 * ⚠️ P3 之后本文件**只剩两个游戏**，且是临时状态：
 *   `games/runner/` 已完成迁移（引擎、渲染、关卡、manifest 全部在游戏目录内）。
 *   P4 会把这里的 pins 与 screws 分别搬到 `games/pins/` 与 `games/screws/`，
 *   届时本文件删除，仓库根目录不再有游戏逻辑。
 *
 * 现在保留它的原因：两个游戏的 manifest 已经通过动态 import 指向这里
 * （见 games/pins/manifest.js 与 games/screws/manifest.js），
 * 所以它们**已经走同一套注册表与入口**，P4 只需搬实现，manifest 不用改。
 *
 * 迁移状态总览（避免后来者误以为这里还是三合一）：
 *   runner  ✅ 在 games/runner/
 *   pins    ⏳ 引擎与渲染在本文件 + boards.mjs
 *   screws  ⏳ 引擎与渲染在本文件 + boards.mjs
 *
 * 未变化的约束（tests/games.test.mjs 是规则与关卡扩展的安全网）：
 *   · 本文件不得触碰 DOM —— 所有拉针顺序与螺丝棋盘都在 Node 里验证
 *   · 星级与分数由引擎判定，宿主只存不猜
 */

import { DIFFICULTY } from './src/core/labels.js';
import { t as hostT } from './src/core/i18n.js';
import { pinLabel } from './games/pins/dictionary.js';
import { screwPosition, containsPlate } from './games/screws/dictionary.js';

export { screwPosition, containsPlate };

/** 取翻译函数：优先用宿主注入的 t，否则用 i18n 的当前语言（便于测试与 balance 脚本） */
const pickT = (ctx) => (typeof ctx?.t === 'function' ? ctx.t : hostT);

export const PIN_LEVELS = [
  { titleKey: 'game.pins.level1', difficulty: DIFFICULTY.ENTRY, pins: ['water', 'drain', 'treasure'] },
  { titleKey: 'game.pins.level2', difficulty: DIFFICULTY.ENTRY, pins: ['water', 'treasure', 'spider', 'drain'], spider: true },
  { titleKey: 'game.pins.level3', difficulty: DIFFICULTY.ADVANCED, pins: ['treasure', 'vent', 'drain', 'water'], gas: true },
  { titleKey: 'game.pins.level4', difficulty: DIFFICULTY.ADVANCED, pins: ['water', 'spider', 'treasure', 'vent', 'drain'], spider: true, gas: true },
  { titleKey: 'game.pins.level5', difficulty: DIFFICULTY.CHALLENGE, pins: ['bridge', 'water', 'treasure', 'drain'], bridge: true },
  { titleKey: 'game.pins.level6', difficulty: DIFFICULTY.CHALLENGE, pins: ['treasure', 'bridge', 'vent', 'water', 'spider', 'drain'], spider: true, gas: true, bridge: true },
  // 蛛网封住通风口：原先独立的蜘蛛、气体现在有先后依赖。
  { titleKey: 'game.pins.level7', introKey: 'game.pins.introWeb', difficulty: DIFFICULTY.CHALLENGE, pins: ['vent', 'water', 'treasure', 'bridge', 'drain', 'spider'], spider: true, gas: true, bridge: true, ventBlockedBySpider: true },
  // 终局将两条依赖串联：先清蛛排气；水冷却后先架支撑桥，再排石。
  { titleKey: 'game.pins.level8', introKey: 'game.pins.introSupport', difficulty: DIFFICULTY.CHALLENGE, pins: ['drain', 'bridge', 'treasure', 'water', 'vent', 'spider'], spider: true, gas: true, bridge: true, ventBlockedBySpider: true, bridgeBeforeDrain: true },
];

/**
 * 机关名 → 当前语言文案。**注意这是相对早期版本的一处破坏性改名**：
 * 原来是 `PIN_LABELS` 常量对象（中文值），现在是函数。
 * 改名理由：机关名是游戏私有词汇，且必须随语言变化，常量会在切换语言后过期。
 * 键与坐标定义见 games/pins/dictionary.js。
 */
export { pinLabel };

export class Pins {
  constructor(level = 0, ctx = {}) {
    this.t = pickT(ctx);
    this.level = level; this.config = PIN_LEVELS[level]; this.hot = true; this.drained = false;
    this.spider = !!this.config.spider; this.gas = !!this.config.gas; this.bridge = !this.config.bridge;
    this.removed = new Set(); this.status = 'playing'; this.hints = 0; this.moves = 0; this.stars = 0; this.score = 0; this.lastPin = null;
    this.message = this.t(this.config.introKey ?? 'game.pins.intro');
  }

  /**
   * 当前所有**安全**的机关。这是整套拉针规则唯一的真值来源：
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
    const pin = this.safePins()[0]; if (!pin) return null;
    this.hints++; this.message = this.t('game.pins.hint', { pin: pinLabel(pin) }); return pin;
  }

  /** 拉一根针。非法操作返回 false 且**不产生任何副作用**。 */
  pull(pin) {
    if (this.status !== 'playing' || this.removed.has(pin) || !this.config.pins.includes(pin)) return false;
    this.removed.add(pin); this.moves++; this.lastPin = pin;
    const fail = key => { this.status = 'lost'; this.message = this.t(key); };
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
        this.status = 'won'; this.stars = this.hints === 0 ? 3 : this.hints <= 2 ? 2 : 1;
        this.score = this.config.pins.length * 200 + this.stars * 300;
        this.message = this.t('game.pins.win', { moves: this.moves, stars: this.stars });
      }
    }
    return true;
  }

  hud() {
    return [
      { label: this.t('game.pins.hudPins'), value: `${this.removed.size} / ${this.config.pins.length}` },
      { label: this.t('game.pins.hudHints'), value: this.hints, tone: this.hints > 0 ? 'warn' : 'normal' },
    ];
  }

  metrics() {
    return { order: [...this.removed].join(','), moves: this.moves, hints: this.hints };
  }
}

/** 螺丝关卡布局（每片的几何数据） */
export const SCREW_LEVELS = [
  [{ x: 240, y: 273, angle: 0, width: 270 }, { x: 240, y: 228, angle: -36, width: 245 }, { x: 240, y: 190, angle: 34, width: 245 }],
  [{ x: 240, y: 280, angle: 0, width: 280 }, { x: 198, y: 226, angle: 55, width: 225 }, { x: 282, y: 222, angle: -55, width: 225 }, { x: 240, y: 170, angle: 0, width: 280 }],
  [{ x: 240, y: 282, angle: 0, width: 285 }, { x: 190, y: 230, angle: 65, width: 245 }, { x: 290, y: 230, angle: -65, width: 245 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }],
  [{ x: 240, y: 278, angle: 0, width: 280, bolts: 3 }, { x: 193, y: 235, angle: 65, width: 240 }, { x: 287, y: 235, angle: -65, width: 240 }, { x: 240, y: 204, angle: 30, width: 265 }, { x: 240, y: 168, angle: -30, width: 265 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 194, y: 238, angle: 62, width: 255 }, { x: 286, y: 238, angle: -62, width: 255 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }, { x: 240, y: 210, angle: -28, width: 275 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 185, y: 244, angle: 65, width: 250, bolts: 3 }, { x: 295, y: 244, angle: -65, width: 250, bolts: 3 }, { x: 240, y: 215, angle: 30, width: 275 }, { x: 240, y: 181, angle: -30, width: 275 }, { x: 240, y: 155, angle: 0, width: 230, bolts: 3 }],
  // 七片钟楼：中梁盖住两侧立柱，最上方短锁片打开交叉拆卸路线。
  [{ x: 240, y: 300, angle: 0, width: 300, bolts: 3 }, { x: 180, y: 242, angle: 70, width: 220, bolts: 3 }, { x: 300, y: 242, angle: -70, width: 220, bolts: 3 }, { x: 240, y: 248, angle: 0, width: 290, bolts: 3 }, { x: 215, y: 190, angle: 30, width: 260 }, { x: 265, y: 190, angle: -30, width: 260 }, { x: 240, y: 140, angle: 0, width: 190, bolts: 3 }],
  // 八片双塔：三孔立柱与两层横梁交织；先拆完整片，避免同时占用多片槽位。
  [{ x: 240, y: 310, angle: 0, width: 310, bolts: 3 }, { x: 155, y: 250, angle: 90, width: 170, bolts: 3 }, { x: 325, y: 250, angle: 90, width: 170, bolts: 3 }, { x: 240, y: 260, angle: 0, width: 280, bolts: 3 }, { x: 186, y: 209, angle: 50, width: 245 }, { x: 294, y: 209, angle: -50, width: 245 }, { x: 240, y: 160, angle: 0, width: 275, bolts: 3 }, { x: 240, y: 119, angle: 0, width: 170, bolts: 3 }],
];

/**
 * 螺丝关卡元数据（标题、槽位容量、难度）。
 * 命名说明：早期叫 SCREW_RULES，语义含糊 —— 它描述的是关卡元信息而非"规则"，
 * 与 SCREW_LEVELS（布局）成对，改名后不易误用。
 */
export const SCREW_LEVEL_META = [
  { titleKey: 'game.screws.level1', capacity: 4, difficulty: DIFFICULTY.ENTRY },
  { titleKey: 'game.screws.level2', capacity: 4, difficulty: DIFFICULTY.ENTRY },
  { titleKey: 'game.screws.level3', capacity: 4, difficulty: DIFFICULTY.ADVANCED },
  { titleKey: 'game.screws.level4', capacity: 3, difficulty: DIFFICULTY.ADVANCED },
  { titleKey: 'game.screws.level5', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level6', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level7', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
  { titleKey: 'game.screws.level8', capacity: 3, difficulty: DIFFICULTY.CHALLENGE },
];

export class Screws {
  constructor(level = 0, ctx = {}) {
    this.t = pickT(ctx);
    this.level = level; this.config = SCREW_LEVEL_META[level];
    this.plates = SCREW_LEVELS[level].map((p, id) => ({ ...p, id, removed: Array(p.bolts || 2).fill(false), fallen: false }));
    this.slots = []; this.status = 'playing'; this.moves = 0; this.hints = 0; this.undos = 0; this.history = []; this.stars = 0; this.score = 0; this.event = null;
    this.message = this.t('game.screws.intro', { capacity: this.config.capacity });
  }

  /** 这颗螺丝现在能不能拆：未被拆过、片未脱落，且没有被 id 更大的片遮住 */
  available(id, end) {
    const plate = this.plates[id];
    if (!plate || !Number.isInteger(end) || end < 0 || end >= plate.removed.length || plate.fallen || plate.removed[end] || this.status !== 'playing') return false;
    // 遮挡判定与渲染层的 z-index 约定共用同一实现（games/screws/dictionary.js）
    return !this.plates.some(other => other.id > id && !other.fallen && containsPlate(other, screwPosition(plate, end)));
  }

  remove(id, end) {
    if (!this.available(id, end)) return false;
    this.history.push({ removed: this.plates.map(p => [...p.removed]), slots: [...this.slots], moves: this.moves });
    const plate = this.plates[id]; plate.removed[end] = true; this.slots.push(id); this.moves++;
    this.event = { id, end, fallen: false };
    if (plate.removed.every(Boolean)) {
      // 整片脱落 → 先归还槽位，再判断是否满槽失败。顺序错了会把"刚好拆完"误判为失败。
      plate.fallen = true; this.event.fallen = true; this.slots = this.slots.filter(slot => slot !== id);
      this.message = this.t('game.screws.fallen', { n: id + 1, slots: plate.removed.length });
    } else this.message = this.t('game.screws.remaining', { n: plate.removed.filter(value => !value).length, used: this.slots.length, capacity: this.config.capacity });

    if (this.plates.every(p => p.fallen)) {
      this.status = 'won'; this.stars = this.hints + this.undos === 0 ? 3 : this.hints + this.undos <= 2 ? 2 : 1;
      this.score = this.moves * 100 + this.stars * 300;
      this.message = this.t('game.screws.win', { moves: this.moves, stars: this.stars });
    } else if (this.slots.length >= this.config.capacity) {
      this.status = 'lost'; this.message = this.t(this.undos === 0 ? 'game.screws.fullCanUndo' : 'game.screws.fullNoUndo');
    }
    return true;
  }

  /** 每关一次撤销。用于从"槽满失败"中恢复，也是本玩法唯一的容错手段。 */
  undo() {
    if (this.undos >= 1 || !this.history.length || this.status === 'won') return false;
    const state = this.history.pop(); this.undos++;
    this.plates.forEach((p, i) => { p.removed = state.removed[i]; p.fallen = p.removed.every(Boolean); });
    this.slots = state.slots; this.moves = state.moves; this.status = 'playing'; this.event = null;
    this.message = this.t('game.screws.undone'); return true;
  }

  /** 提示：用 DFS 找一条能走到底的拆卸顺序，返回第一步 */
  hint() {
    if (this.status !== 'playing') return null;
    const path = solveScrews(this);
    if (!path?.length) { this.message = this.t('game.screws.noSolution'); return null; }
    this.hints++; this.message = this.t('game.screws.hint', { n: path[0][0] + 1 }); return path[0];
  }

  hud() {
    return [
      { label: this.t('game.screws.hudPlates'), value: `${this.plates.filter(p => p.fallen).length} / ${this.plates.length}` },
      { label: this.t('game.screws.hudSlots'), value: `${this.slots.length} / ${this.config.capacity}`, tone: this.slots.length >= this.config.capacity - 1 ? 'warn' : 'normal' },
      { label: this.t('game.screws.hudUndo'), value: 1 - this.undos },
    ];
  }

  metrics() {
    // 导出**当前局面**而不是操作序列：撤销会重写历史，局面才是可重放的事实来源。
    // plates：每片金属的螺丝状态位（'11' / '101' …），服务端可据此重放校验。
    return {
      plates: this.plates.map(p => p.removed.map(Number).join('')).join('|'),
      moves: this.moves, hints: this.hints, undos: this.undos,
    };
  }
}

/**
 * 求解器：深度优先 + 位掩码状态记忆化，寻找一条完整的拆卸顺序。
 *
 * 状态空间很小（最多 8 片 × 3 孔），所以朴素搜到底即可，不需要启发式。
 * 两个用途：① 提示功能 ② 测试证明每个棋盘都可解（否则玩家会卡死在无解关卡）。
 * @returns {Array<[number, number]>|null} [[片 id, 孔位], …]，无解返回 null
 */
export function solveScrews(game) {
  const initial = game.plates.map(p => p.removed.reduce((mask, v, i) => mask | (v ? 1 << i : 0), 0));
  const full = game.plates.map(p => (1 << p.removed.length) - 1), seen = new Set();

  function search(masks) {
    if (masks.every((m, i) => m === full[i])) return [];
    const key = masks.join(','); if (seen.has(key)) return null; seen.add(key);
    const used = masks.reduce((n, mask, i) => n + (mask === full[i] ? 0 : mask.toString(2).split('1').length - 1), 0);
    if (used >= game.config.capacity) return null;   // 槽位已满且未拆完 → 这条路走不通
    for (let id = masks.length - 1; id >= 0; id--) {
      if (masks[id] === full[id]) continue;
      const plate = game.plates[id];
      for (let end = 0; end < plate.removed.length; end++) {
        if (masks[id] & (1 << end)) continue;
        const point = screwPosition(plate, end);
        if (game.plates.some((p, i) => i > id && masks[i] !== full[i] && containsPlate(p, point))) continue;
        const next = [...masks]; next[id] |= 1 << end;
        const tail = search(next); if (tail) return [[id, end], ...tail];
      }
    }
    return null;
  }
  return search(initial);
}
