import { t } from '../../src/core/host-surface.js';
import LEVELS from './levels.js';
import { DIRECTIONS, parseBoard, transition, deadSquares, isSolved, solveBoard } from './board.js';

/** Turn-based Sokoban: all replayable state lives here; rendering has no rules. */
export default class WarehouseEngine {
  constructor(level = 0, ctx = {}) {
    this.gameId = 'warehouse';
    this.level = Number.isInteger(level) && LEVELS[level] ? level : 0;
    this.config = LEVELS[this.level];
    this.ctx = ctx;
    this.t = typeof ctx.t === 'function' ? ctx.t : t;
    this.board = parseBoard(this.config.map);
    this.player = this.board.player;
    this.boxes = this.board.boxes.slice();
    this.deadSquares = deadSquares(this.board);
    this.status = 'ready';
    this.moves = 0;
    this.pushes = 0;
    this.hints = 0;
    this.stars = 0;
    this.score = 0;
    this.direction = 'up';
    this.history = [];
    this.route = [];
    this.deadlocked = false;
    this.hintDirection = null;
    this.event = null;
    this.message = this.t('game.warehouse.intro', { count: this.boxes.length });
  }

  start() {
    if (this.status !== 'ready') return false;
    this.status = 'playing';
    this.message = this.t(this.config.lessonKey);
    return true;
  }

  move(direction) {
    if (this.status !== 'playing' || !Object.hasOwn(DIRECTIONS, direction)) return false;
    const next = transition(this.board, this.player, this.boxes, direction);
    if (!next) return false;
    this.history.push({ player: this.player, boxes: this.boxes.slice(), direction: this.direction, pushes: this.pushes });
    this.player = next.player;
    this.boxes = next.boxes;
    this.direction = direction;
    this.moves++;
    this.pushes += Number(next.pushed);
    this.route.push(direction);
    this.hintDirection = null;
    this.deadlocked = this.boxes.some(box => this.deadSquares.has(box));
    this.event = { type: next.pushed ? 'push' : 'walk' };
    if (isSolved(this.board, this.boxes)) {
      this.status = 'won';
      this.stars = this.moves <= this.config.steps && this.hints === 0 ? 3 : this.moves <= this.config.budget ? 2 : 1;
      this.score = Math.max(100, 1800 + this.stars * 300 - this.moves * 12 - this.hints * 40);
      this.message = this.t('game.warehouse.win', { moves: this.moves, stars: this.stars });
    } else {
      this.message = this.t(this.deadlocked ? 'game.warehouse.deadlock' : next.pushed ? 'game.warehouse.delivered' : this.config.lessonKey,
        { count: this.docked, total: this.boxes.length });
    }
    return true;
  }

  get docked() { return this.boxes.filter(box => this.board.goals.includes(box)).length; }
  canUndo() { return this.history.length > 0; }

  undo() {
    if (!this.canUndo()) return false;
    const previous = this.history.pop();
    this.player = previous.player;
    this.boxes = previous.boxes;
    this.direction = previous.direction;
    this.pushes = previous.pushes;
    this.route.pop();
    this.moves--;
    this.stars = 0;
    this.score = 0;
    this.status = 'playing';
    this.hintDirection = null;
    this.deadlocked = this.boxes.some(box => this.deadSquares.has(box));
    this.event = null;
    this.message = this.t(this.deadlocked ? 'game.warehouse.deadlock' : 'game.warehouse.undone');
    return true;
  }

  hint() {
    if (this.status !== 'playing') return null;
    const path = solveBoard(this.board, this.player, this.boxes);
    if (!path?.length) {
      this.message = this.t('game.warehouse.noRoute');
      this.hintDirection = null;
      return null;
    }
    this.hints++;
    this.hintDirection = path[0];
    this.message = this.t('game.warehouse.hint', { direction: this.t(`game.warehouse.${path[0]}`) });
    return path[0];
  }

  assistGoal() { return this.t('game.warehouse.goal', { steps: this.config.steps }); }

  hud() {
    return [
      { label: this.t('game.warehouse.hudDocked'), value: `${this.docked} / ${this.boxes.length}`, tone: this.docked ? 'good' : 'normal' },
      { label: this.t('game.warehouse.hudMoves'), value: this.moves, tone: this.moves > this.config.steps ? 'warn' : 'normal' },
      { label: this.t('game.warehouse.hudTarget'), value: this.config.steps },
    ];
  }

  metrics() { return { route: this.route.join(','), moves: this.moves, pushes: this.pushes, hints: this.hints, docked: this.docked }; }
}
