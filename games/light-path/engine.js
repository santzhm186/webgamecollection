import { t as hostT } from '../../src/core/host-surface.js';
import LEVELS from './levels.js';
import { portCount, traceLight, isSolved, solve } from './rules.js';

export default class LightPath {
  constructor(level = 0, ctx = {}) {
    this.gameId = 'light-path';
    this.level = Number.isInteger(level) && LEVELS[level] ? level : 0;
    this.config = LEVELS[this.level];
    this.t = ctx.t ?? hostT;
    this.cells = this.config.cells.map(cell => ({ ...cell }));
    this.status = 'ready'; this.moves = 0; this.hints = 0; this.stars = 0; this.score = 0;
    this.history = []; this.trace = []; this.highlight = null; this.event = null;
    this.par = solve(this.config).cost;
    this.target = this.par + this.config.allowance;
    this.message = this.t('game.light-path.intro');
  }
  start() {
    if (this.status !== 'ready') return false;
    this.status = 'playing'; this.message = this.t(this.config.lessonKey); return true;
  }
  rotate(index) {
    const cell = this.cells[index];
    if (this.status !== 'playing' || !Number.isInteger(index) || !cell || cell.locked || !['straight', 'corner'].includes(cell.type)) return false;
    this.history.push({ index, rotation: cell.rotation });
    cell.rotation = (cell.rotation + 1) % portCount(cell);
    this.moves++; this.trace.push(index); this.highlight = null;
    this.event = { type: 'rotate', index, move: this.moves };
    if (isSolved(this.config, this.cells)) {
      this.status = 'won';
      this.stars = this.moves <= this.target && !this.hints ? 3 : this.moves <= this.target + 8 ? 2 : 1;
      this.score = Math.max(100, this.stars * 500 + this.par * 30 - this.moves * 10 - this.hints * 40);
      this.message = this.t('game.light-path.won', { moves: this.moves, stars: this.stars });
    } else {
      const light = traceLight(this.config, this.cells);
      this.message = this.t(light.connected ? 'game.light-path.missingRelay' : 'game.light-path.rotated', { n: index + 1 });
    }
    return true;
  }
  hint() {
    if (this.status !== 'playing') return null;
    const solution = solve(this.config, this.cells);
    if (!solution?.moves.length) return null;
    this.hints++; this.highlight = solution.moves[0]; this.event = null;
    this.message = this.t('game.light-path.hint', { row: Math.floor(this.highlight / this.config.width) + 1, col: this.highlight % this.config.width + 1 });
    return this.highlight;
  }
  undo() {
    if (!this.history.length || this.status === 'ready') return false;
    const last = this.history.pop(); this.cells[last.index].rotation = last.rotation;
    this.moves--; this.trace.pop(); this.highlight = null; this.event = null;
    this.status = 'playing'; this.stars = 0; this.score = 0;
    this.message = this.t('game.light-path.undone'); return true;
  }
  canUndo() { return this.history.length > 0; }
  assistGoal() { return this.t('game.light-path.goal', { n: this.target }); }
  hud() {
    const light = traceLight(this.config, this.cells), relays = this.cells.flatMap((cell, index) => cell.checkpoint ? [index] : []);
    return [
      relays.length ? { label: this.t('game.light-path.hudRelays'), value: `${relays.filter(index => light.lit.includes(index)).length} / ${relays.length}` } : { label: this.t('game.light-path.hudCircuit'), value: this.t(light.connected ? 'game.light-path.circuitClosed' : 'game.light-path.circuitOpen') },
      { label: this.t('game.light-path.hudTurns'), value: this.moves, tone: this.moves > this.target ? 'warn' : 'normal' },
      { label: this.t('game.light-path.hudTarget'), value: this.target },
    ];
  }
  metrics() { return { moves: this.moves, hints: this.hints, route: this.trace.join(','), par: this.par }; }
}
