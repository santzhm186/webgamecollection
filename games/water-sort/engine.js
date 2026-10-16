import { t, ENGINE_STATUS, SFX } from '../../src/core/host-surface.js';
import LEVELS from './levels.js';
import { pourAmount, poured, isComplete, isSolved, solve } from './rules.js';

export default class WaterSortEngine {
  constructor(level = 0, ctx = {}) {
    this.gameId = 'water-sort';
    this.level = Number.isInteger(level) && LEVELS[level] ? level : 0;
    this.config = LEVELS[this.level];
    this.ctx = ctx;
    this.t = ctx.t ?? t;
    this.status = ENGINE_STATUS.READY;
    this.tubes = this.config.tubes.map(tube => [...tube]);
    this.selected = null;
    this.highlight = null;
    this.moves = 0;
    this.hints = 0;
    this.stars = 0;
    this.score = 0;
    this.history = [];
    this.trace = [];
    this.event = null;
    this.message = this.t('game.water-sort.intro');
  }

  start() {
    if (this.status !== ENGINE_STATUS.READY) return false;
    this.status = ENGINE_STATUS.PLAYING;
    this.message = this.t(this.config.lessonKey);
    return true;
  }

  pick(index) {
    if (this.status !== ENGINE_STATUS.PLAYING || !Number.isInteger(index) || !this.tubes[index]) return false;
    if (this.selected === index) {
      this.selected = null;
      this.highlight = null;
      this.message = this.t('game.water-sort.chooseSource');
      return true;
    }
    if (this.selected !== null) return this.pour(this.selected, index);
    if (!this.tubes[index].length) return false;
    this.selected = index;
    this.highlight = null;
    this.message = this.t('game.water-sort.chooseTarget', { n: index + 1 });
    return true;
  }

  pour(from, to) {
    if (this.status !== ENGINE_STATUS.PLAYING) return false;
    const amount = pourAmount(this.tubes, from, to, this.config.capacity);
    if (!amount) return false;
    this.history.push({ tubes: this.tubes.map(tube => [...tube]), moves: this.moves, trace: [...this.trace] });
    this.tubes = poured(this.tubes, from, to, amount);
    this.moves++;
    this.trace.push(`${from}>${to}`);
    this.selected = null;
    this.highlight = null;
    this.event = { from, to, amount };
    if (isSolved(this.tubes, this.config.capacity)) {
      this.status = ENGINE_STATUS.WON;
      this.stars = this.hints === 0 && this.moves <= this.config.steps ? 3 : this.moves <= this.config.steps + 5 ? 2 : 1;
      this.score = Math.max(100, this.stars * 400 + this.config.par * 30 - this.moves * 10 - this.hints * 40);
      this.message = this.t('game.water-sort.win', { moves: this.moves, stars: this.stars });
      this.ctx.sfx?.(SFX.WIN);
    } else {
      this.message = this.t('game.water-sort.poured', { from: from + 1, to: to + 1, n: amount });
      this.ctx.sfx?.(SFX.CLICK);
    }
    return true;
  }

  hint() {
    if (this.status !== ENGINE_STATUS.PLAYING) return null;
    const path = solve(this.tubes, this.config.capacity);
    if (!path?.length) {
      this.message = this.t('game.water-sort.noRoute');
      this.highlight = null;
      return null;
    }
    this.hints++;
    this.highlight = [...path[0]];
    this.selected = null;
    this.message = this.t('game.water-sort.hint', { from: path[0][0] + 1, to: path[0][1] + 1 });
    return [...this.highlight];
  }

  undo() {
    if (!this.history.length) return false;
    const previous = this.history.pop();
    this.tubes = previous.tubes;
    this.moves = previous.moves;
    this.trace = previous.trace;
    this.selected = null;
    this.highlight = null;
    this.event = null;
    this.stars = 0;
    this.score = 0;
    this.status = ENGINE_STATUS.PLAYING;
    this.message = this.t('game.water-sort.undone');
    return true;
  }

  canUndo() { return this.history.length > 0; }

  assistGoal() { return this.t('game.water-sort.target', { n: this.config.steps }); }

  hud() {
    const completed = this.tubes.filter(tube => isComplete(tube, this.config.capacity)).length;
    const colors = new Set(this.config.tubes.flat()).size;
    return [
      { label: this.t('game.water-sort.hudSorted'), value: `${completed} / ${colors}` },
      { label: this.t('game.water-sort.hudPours'), value: this.moves },
      { label: this.t('game.water-sort.hudTarget'), value: this.config.steps, tone: this.moves > this.config.steps ? 'warn' : 'normal' },
    ];
  }

  metrics() {
    return { pours: this.trace.join(','), moves: this.moves, hints: this.hints, colors: new Set(this.config.tubes.flat()).size };
  }
}
