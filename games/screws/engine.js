/**
 * 拧螺丝 · 玩法引擎（纯逻辑，无 DOM）
 * ============================================================================
 * 硬规则：
 *   1. 本文件不得出现 document / window / localStorage / requestAnimationFrame
 *   2. 状态全在实例上
 *   3. 宿主能力只从 host-surface.js 取
 *   4. stars / score 由本引擎判定，宿主只存不猜
 */
import { t as hostT } from '../../src/core/host-surface.js';
import { screwPosition, containsPlate } from './dictionary.js';
import { SCREW_LEVELS, SCREW_LEVEL_META } from './levels.js';

export { screwPosition, containsPlate, SCREW_LEVELS, SCREW_LEVEL_META };

export const GAME_ID = 'screws';

/** 取翻译函数：优先用宿主注入的 ctx.t，否则用 i18n 当前语言 */
const pickT = ctx => (typeof ctx?.t === 'function' ? ctx.t : hostT);

export class Screws {
  constructor(level = 0, ctx = {}) {
    this.gameId = GAME_ID;
    this.t = pickT(ctx);
    this.level = level;
    this.config = SCREW_LEVEL_META[level] ?? SCREW_LEVEL_META[0];
    const layouts = SCREW_LEVELS[level] ?? SCREW_LEVELS[0];
    this.plates = layouts.map((p, id) => ({
      ...p,
      id,
      removed: Array(p.bolts || 2).fill(false),
      fallen: false,
    }));
    this.slots = [];
    this.status = 'playing';
    this.moves = 0;
    this.hints = 0;
    this.undos = 0;
    this.history = [];
    this.stars = 0;
    this.score = 0;
    this.event = null;
    this.message = this.t('game.screws.intro', { capacity: this.config.capacity });
  }

  /** 这颗螺丝现在能不能拆：未被拆过、片未脱落，且没有被 id 更大的片遮住 */
  available(id, end) {
    const plate = this.plates[id];
    if (!plate || !Number.isInteger(end) || end < 0 || end >= plate.removed.length || plate.fallen || plate.removed[end] || this.status !== 'playing') {
      return false;
    }
    return !this.plates.some(other => other.id > id && !other.fallen && containsPlate(other, screwPosition(plate, end)));
  }

  remove(id, end) {
    if (!this.available(id, end)) return false;
    this.history.push({
      removed: this.plates.map(p => [...p.removed]),
      slots: [...this.slots],
      moves: this.moves,
    });
    const plate = this.plates[id];
    plate.removed[end] = true;
    this.slots.push(id);
    this.moves++;
    this.event = { id, end, fallen: false };

    if (plate.removed.every(Boolean)) {
      // 整片脱落 → 先归还槽位，再判断是否满槽失败
      plate.fallen = true;
      this.event.fallen = true;
      this.slots = this.slots.filter(slot => slot !== id);
      this.message = this.t('game.screws.fallen', { n: id + 1, slots: plate.removed.length });
    } else {
      this.message = this.t('game.screws.remaining', {
        n: plate.removed.filter(value => !value).length,
        used: this.slots.length,
        capacity: this.config.capacity,
      });
    }

    if (this.plates.every(p => p.fallen)) {
      this.status = 'won';
      const penalties = this.hints + this.undos;
      this.stars = penalties === 0 ? 3 : penalties <= 2 ? 2 : 1;
      this.score = this.moves * 100 + this.stars * 300;
      this.message = this.t('game.screws.win', { moves: this.moves, stars: this.stars });
    } else if (this.slots.length >= this.config.capacity) {
      this.status = 'lost';
      this.message = this.t(this.undos === 0 ? 'game.screws.fullCanUndo' : 'game.screws.fullNoUndo');
    }
    return true;
  }

  /** 每关一次撤销。用于从"槽满失败"中恢复，也是本玩法唯一的容错手段。 */
  undo() {
    if (this.undos >= 1 || !this.history.length || this.status === 'won') return false;
    const state = this.history.pop();
    this.undos++;
    this.plates.forEach((p, i) => {
      p.removed = state.removed[i];
      p.fallen = p.removed.every(Boolean);
    });
    this.slots = state.slots;
    this.moves = state.moves;
    this.status = 'playing';
    this.event = null;
    this.message = this.t('game.screws.undone');
    return true;
  }

  /** 提示：用 DFS 找一条能走到底的拆卸顺序，返回第一步 */
  hint() {
    if (this.status !== 'playing') return null;
    const path = solveScrews(this);
    if (!path?.length) {
      this.message = this.t('game.screws.noSolution');
      return null;
    }
    this.hints++;
    this.message = this.t('game.screws.hint', { n: path[0][0] + 1 });
    return path[0];
  }

  hud() {
    return [
      { label: this.t('game.screws.hudPlates'), value: `${this.plates.filter(p => p.fallen).length} / ${this.plates.length}` },
      { label: this.t('game.screws.hudSlots'), value: `${this.slots.length} / ${this.config.capacity}`, tone: this.slots.length >= this.config.capacity - 1 ? 'warn' : 'normal' },
      { label: this.t('game.screws.hudUndo'), value: 1 - this.undos },
    ];
  }

  metrics() {
    return {
      plates: this.plates.map(p => p.removed.map(Number).join('')).join('|'),
      moves: this.moves,
      hints: this.hints,
      undos: this.undos,
    };
  }
}

/**
 * 求解器：深度优先 + 位掩码状态记忆化，寻找一条完整的拆卸顺序。
 * @returns {Array<[number, number]>|null} [[片 id, 孔位], …]，无解返回 null
 */
export function solveScrews(game) {
  const initial = game.plates.map(p => p.removed.reduce((mask, v, i) => mask | (v ? 1 << i : 0), 0));
  const full = game.plates.map(p => (1 << p.removed.length) - 1), seen = new Set();

  function search(masks) {
    if (masks.every((m, i) => m === full[i])) return [];
    const key = masks.join(',');
    if (seen.has(key)) return null;
    seen.add(key);
    const used = masks.reduce((n, mask, i) => n + (mask === full[i] ? 0 : mask.toString(2).split('1').length - 1), 0);
    if (used >= game.config.capacity) return null;
    for (let id = masks.length - 1; id >= 0; id--) {
      if (masks[id] === full[id]) continue;
      const plate = game.plates[id];
      for (let end = 0; end < plate.removed.length; end++) {
        if (masks[id] & (1 << end)) continue;
        const point = screwPosition(plate, end);
        if (game.plates.some((p, i) => i > id && masks[i] !== full[i] && containsPlate(p, point))) continue;
        const next = [...masks];
        next[id] |= 1 << end;
        const tail = search(next);
        if (tail) return [[id, end], ...tail];
      }
    }
    return null;
  }
  return search(initial);
}

export default Screws;
