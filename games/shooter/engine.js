import { t as hostT } from '../../src/core/host-surface.js';
import LEVELS from './levels.js';

export const STEP = 1 / 60;
const SHOT_INTERVALS = [24, 18, 12, 8];

/** Fixed simulation steps keep spawns, shots, impacts and scores replayable. */
export default class Shooter {
  constructor(level = 0, ctx = {}) {
    this.gameId = 'shooter';
    this.level = level;
    this.config = LEVELS[level] ?? LEVELS[0];
    this.t = typeof ctx.t === 'function' ? ctx.t : hostT;
    this.status = 'ready'; this.paused = false; this.stars = 0; this.score = 0;
    this.frame = 0; this.time = 0; this.accumulator = 0;
    this.lane = 1; this.x = 1; this.health = 3; this.shield = 0;
    this.spread = 0; this.rate = 0; this.upgrades = 0; this.kills = 0; this.leaked = 0;
    this.wave = 0; this.nextId = 1; this.nextShot = 0;
    this.entities = []; this.bullets = []; this.effects = []; this.trace = [];
    this.bossDefeated = false; this.event = null;
    this.message = this.t('game.shooter.intro', { n: this.config.starUpgrades });
  }

  start() {
    if (this.status !== 'ready') return false;
    this.status = 'playing';
    this.message = this.t('game.shooter.started');
    return true;
  }

  pause() {
    if (this.status !== 'playing' || this.paused) return false;
    this.paused = true; return true;
  }

  resume() {
    if (!this.paused) return false;
    this.paused = false; return true;
  }

  chooseLane(lane) {
    if (this.status !== 'playing' || this.paused || !Number.isInteger(lane) || lane < 0 || lane > 2) return false;
    if (lane !== this.lane) { this.lane = lane; this.trace.push(`${this.frame}:${lane}`); }
    return true;
  }

  // The host already maps left/right and A/D onto chooseSide(0/1).
  chooseSide(side) {
    if (side !== 0 && side !== 1) return false;
    return this.chooseLane(Math.max(0, Math.min(2, this.lane + (side === 0 ? -1 : 1))));
  }

  tick(delta) {
    if (this.status !== 'playing' || this.paused || !Number.isFinite(delta) || delta <= 0) return;
    this.accumulator += Math.min(.1, delta);
    while (this.accumulator + 1e-9 >= STEP && this.status === 'playing') {
      this.accumulator = Math.max(0, this.accumulator - STEP);
      this.step();
    }
  }

  step() {
    this.frame++; this.time = this.frame * STEP;
    this.x += Math.max(-.12, Math.min(.12, this.lane - this.x));
    while (this.wave < this.config.waves.length && this.config.waves[this.wave].at <= this.time + 1e-9) {
      const wave = this.config.waves[this.wave++];
      this.entities.push({ ...wave, id: this.nextId++, z: .03, maxHp: wave.hp, hitAt: -100 });
      if (wave.kind === 'boss') this.message = this.t('game.shooter.bossIncoming');
    }
    if (this.frame >= this.nextShot) {
      const offsets = this.spread ? [-1, 0, 1] : [0];
      for (const offset of offsets) {
        const x = this.x + offset;
        if (x >= -.15 && x <= 2.15) this.bullets.push({ x, z: .88, damage: this.spread >= 2 ? 2 : 1 });
      }
      this.nextShot = this.frame + SHOT_INTERVALS[this.rate];
    }
    this.entities.forEach(entity => { entity.z += entity.speed * STEP; });
    for (const bullet of this.bullets) {
      const before = bullet.z; bullet.z -= 1.5 * STEP;
      const target = this.entities.filter(entity => entity.hp > 0 && Math.abs(entity.lane - bullet.x) < .27 && entity.z >= bullet.z - .035 && entity.z <= before + .035)
        .sort((a, b) => b.z - a.z)[0];
      if (!target) continue;
      target.hp -= bullet.damage; target.hitAt = this.frame; bullet.z = -1;
      if (target.hp <= 0) this.destroyTarget(target);
    }
    this.bullets = this.bullets.filter(bullet => bullet.z > 0);
    for (const entity of this.entities) {
      if (entity.hp <= 0 || entity.z < .96) continue;
      entity.hp = 0;
      if (entity.kind === 'crate') continue;
      this.leaked++;
      if (entity.kind === 'boss') { this.health = 0; }
      else if (this.shield) { this.shield--; }
      else { this.health--; }
      this.event = { type: 'damage', at: this.frame };
      this.message = this.t('game.shooter.breach');
      if (this.health <= 0) {
        this.health = 0; this.status = 'lost'; this.message = this.t('game.shooter.lost'); break;
      }
    }
    this.entities = this.entities.filter(entity => entity.hp > 0);
    this.effects = this.effects.filter(effect => this.frame - effect.at < 24);
    if (this.status === 'playing' && this.wave === this.config.waves.length && !this.entities.some(entity => entity.kind !== 'crate')) {
      this.status = 'won';
      this.stars = this.health === 3 && this.upgrades >= this.config.starUpgrades ? 3 : this.health >= 2 ? 2 : 1;
      this.score = this.kills * 120 + this.upgrades * 90 + this.health * 150 + this.stars * 300;
      this.message = this.t('game.shooter.won', { kills: this.kills, upgrades: this.upgrades, stars: this.stars });
    }
  }

  destroyTarget(target) {
    this.effects.push({ x: target.lane, z: target.z, at: this.frame, kind: target.kind });
    if (target.kind === 'crate') {
      this.upgrades++;
      if (target.upgrade === 'spread') this.spread = Math.min(2, this.spread + 1);
      if (target.upgrade === 'rate') this.rate = Math.min(3, this.rate + 1);
      if (target.upgrade === 'shield') this.shield = Math.min(3, this.shield + 1);
      this.event = { type: 'upgrade', upgrade: target.upgrade, at: this.frame };
      this.message = this.t('game.shooter.upgraded', { upgrade: this.t(`game.shooter.${target.upgrade}`) });
    } else {
      this.kills++;
      if (target.kind === 'boss') this.bossDefeated = true;
      this.event = { type: 'hit', at: this.frame };
    }
  }

  assistGoal() { return this.t('game.shooter.goal', { n: this.config.starUpgrades }); }

  hud() {
    return [
      { label: this.t('game.shooter.health'), value: `${this.health} / 3`, tone: this.health < 2 ? 'warn' : 'normal' },
      { label: this.t('game.shooter.firepower'), value: `${this.spread + 1} · ${this.rate + 1}` },
      { label: this.t('game.shooter.upgrades'), value: `${this.upgrades} / ${this.config.starUpgrades}`, tone: this.upgrades >= this.config.starUpgrades ? 'good' : 'normal' },
      { label: this.t('game.shooter.shield'), value: this.shield },
    ];
  }

  metrics() {
    return { route: this.trace.join(','), frames: this.frame, kills: this.kills, upgrades: this.upgrades, health: this.health, shield: this.shield, spread: this.spread, rate: this.rate, leaked: this.leaked, bossDefeated: this.bossDefeated };
  }
}
