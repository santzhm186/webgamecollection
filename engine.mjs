const gates = (choices, enemies, interval) => choices.map((choice, i) => ({ at: 3.5 + i * interval, choices: choice, enemy: enemies[i] }));
export const RUNNER_LEVELS = [
  { title: '海岸训练营', difficulty: '入门', initial: 16, boss: 110, stars: [110, 130, 145], bossAt: 25,
    gates: gates([[['+', 14], ['×', 2]], [['×', 2], ['+', 26]], [['+', 32], ['×', 2]], [['×', 2], ['+', 48]], [['+', 64], ['×', 2]]], [6, 12, 18, 26, 40], 4.2) },
  { title: '峡谷突围', difficulty: '进阶', initial: 14, boss: 110, stars: [110, 135, 165], bossAt: 27,
    gates: gates([[['×', 2], ['+', 22]], [['+', 30], ['×', 2]], [['×', 3], ['+', 55]], [['+', 80], ['×', 2]], [['×', 2], ['+', 100]], [['+', 120], ['×', 2]]], [9, 18, 36, 54, 72, 110], 3.8) },
  { title: '暮色要塞', difficulty: '挑战', initial: 12, boss: 250, stars: [250, 380, 560], bossAt: 28,
    gates: gates([[['+', 18], ['×', 2]], [['×', 2], ['+', 30]], [['+', 36], ['×', 3]], [['×', 2], ['+', 75]], [['+', 90], ['×', 2]], [['×', 3], ['+', 120]], [['+', 160], ['×', 2]]], [8, 16, 26, 45, 65, 100, 145], 3.4) },
];
export const RUNNER_GATES = RUNNER_LEVELS[0].gates;
export function applyGate(count, [operator, value]) {
  if (operator === '+') return count + value;
  if (operator === '×') return count * value;
  return Math.max(0, count - value);
}
export class Runner {
  constructor(level = 0) {
    this.level = level; this.config = RUNNER_LEVELS[level]; this.time = 0;
    this.army = this.config.initial; this.peak = this.army; this.side = 0; this.position = .25;
    this.gate = 0; this.status = 'ready'; this.phase = 'run'; this.stars = 0; this.score = 0;
    this.bossHealth = this.config.boss; this.battleInitial = 0; this.trace = []; this.event = null;
    this.message = `带至少 ${this.config.boss} 人抵达要塞。蓝色门增加人数，绿色门翻倍，每波守卫会消耗兵力。`;
  }
  start() { if (this.status === 'ready') this.status = 'playing'; }
  tick(delta) {
    if (this.status !== 'playing') return;
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .1)) : 0;
    this.time += dt;
    this.position += ((this.side === 0 ? .25 : .75) - this.position) * (1 - Math.exp(-dt * 18));
    const gate = this.config.gates[this.gate];
    if (gate && this.time >= gate.at) {
      const before = this.army, choice = gate.choices[this.side];
      const gained = applyGate(this.army, choice);
      this.peak = Math.max(this.peak, gained); this.army = Math.max(0, gained - gate.enemy);
      this.trace.push({ before, side: this.side, gained, after: this.army, enemy: gate.enemy });
      this.event = { at: this.time, type: 'gate', gain: gained - before, loss: gate.enemy, side: this.side };
      this.message = `${choice.join('')} → ${gained} 人，击退 ${gate.enemy} 名守卫，剩余 ${this.army} 人。`;
      this.gate++;
      if (!this.army) { this.status = 'lost'; this.message = '队伍耗尽了。观察下一波守卫人数，再选择增益门。'; }
    }
    if (this.time >= this.config.bossAt && this.phase === 'run' && this.status === 'playing') {
      this.phase = 'boss'; this.battleInitial = this.army;
      this.event = { at: this.time, type: 'boss' };
      this.message = `要塞交战中：${this.battleInitial} 人对抗 ${this.config.boss} 名守卫。`;
    }
    if (this.phase === 'boss' && this.status === 'playing') {
      const damage = Math.min(this.config.boss, (this.time - this.config.bossAt) / 2.8 * this.config.boss);
      this.army = Math.max(0, Math.ceil(this.battleInitial - damage));
      this.bossHealth = Math.max(0, Math.ceil(this.config.boss - damage));
      if (damage >= Math.min(this.config.boss, this.battleInitial)) {
        this.status = this.battleInitial >= this.config.boss ? 'won' : 'lost';
        if (this.status === 'won') {
          this.bossHealth = 0; this.army = this.battleInitial - this.config.boss;
          this.stars = this.config.stars.filter(n => this.battleInitial >= n).length;
          this.score = this.battleInitial * 10 + this.stars * 250;
          this.message = `要塞突破！抵达 ${this.battleInitial} 人，战后剩余 ${this.army} 人，获得 ${this.stars} 星。`;
        } else this.message = `距离突破还差 ${this.config.boss - this.battleInitial} 人。试着比较「加人数」与「翻倍」的收益。`;
      }
    }
  }
}
export const PIN_LEVELS = [
  { title: '水与火', difficulty: '入门', pins: ['water', 'drain', 'treasure'] },
  { title: '不速之客', difficulty: '入门', pins: ['water', 'treasure', 'spider', 'drain'], spider: true },
  { title: '蒸汽密室', difficulty: '进阶', pins: ['treasure', 'vent', 'drain', 'water'], gas: true },
  { title: '双重危机', difficulty: '进阶', pins: ['water', 'spider', 'treasure', 'vent', 'drain'], spider: true, gas: true },
  { title: '断桥寻宝', difficulty: '挑战', pins: ['bridge', 'water', 'treasure', 'drain'], bridge: true },
  { title: '神庙逃生', difficulty: '挑战', pins: ['treasure', 'bridge', 'vent', 'water', 'spider', 'drain'], spider: true, gas: true, bridge: true },
];
export const PIN_LABELS = { water: '引水', drain: '排空', treasure: '宝藏', spider: '蜘蛛', vent: '排气', bridge: '落桥' };
export class Pins {
  constructor(level = 0) {
    this.level = level; this.config = PIN_LEVELS[level]; this.hot = true; this.drained = false;
    this.spider = !!this.config.spider; this.gas = !!this.config.gas; this.bridge = !this.config.bridge;
    this.removed = new Set(); this.status = 'playing'; this.hints = 0; this.moves = 0; this.stars = 0; this.score = 0; this.lastPin = null;
    this.message = '观察水流与机关的连接，清理危险后再放下宝藏。';
  }
  safePins() {
    if (this.status !== 'playing') return [];
    return this.config.pins.filter(pin => !this.removed.has(pin) && (
      pin === 'vent' || (pin === 'spider' && this.hot) ||
      (pin === 'water' && !this.gas && !this.spider) ||
      (pin === 'drain' && !this.hot && !this.spider) ||
      (pin === 'bridge' && this.drained) ||
      (pin === 'treasure' && this.drained && this.bridge && !this.spider && !this.gas)
    ));
  }
  hint() {
    const pin = this.safePins()[0]; if (!pin) return null;
    this.hints++; this.message = `提示：现在可以安全操作「${PIN_LABELS[pin]}」机关。`; return pin;
  }
  pull(pin) {
    if (this.status !== 'playing' || this.removed.has(pin) || !this.config.pins.includes(pin)) return false;
    this.removed.add(pin); this.moves++; this.lastPin = pin;
    const fail = message => { this.status = 'lost'; this.message = message; };
    if (pin === 'vent') { this.gas = false; this.message = '气体散去了。现在引水不会引发爆燃。'; }
    if (pin === 'spider') {
      if (!this.hot) fail('岩浆已经冷却，蜘蛛沿通道逃向了探险家。先用热岩浆处理蜘蛛。');
      else { this.spider = false; this.message = '蜘蛛落入热岩浆，危险解除。'; }
    }
    if (pin === 'water') {
      if (this.gas) fail('水蒸气引燃了可燃气体！先从顶部排气口排出气体。');
      else { this.hot = false; this.message = '水流让岩浆凝固成岩石。现在可以安全排空。'; }
    }
    if (pin === 'drain') {
      if (this.hot) fail('热岩浆冲入下方通道！先引水冷却。');
      else if (this.spider) fail('蜘蛛还在密室里，随着通道打开跑了出来。');
      else { this.drained = true; this.message = this.config.bridge ? '岩石已排出，通道安全了。落下石桥，就能连接宝藏与出口。' : '岩石滑入废料槽，通道安全了。'; }
    }
    if (pin === 'bridge') {
      if (!this.drained) fail('石桥撞上了未清理的岩浆槽，通道坍塌了！先排空槽内岩石。');
      else { this.bridge = true; this.message = '石桥落下，宝藏与出口连通了。'; }
    }
    if (pin === 'treasure') {
      if (!this.drained || this.spider || this.gas) fail('危险还没处理完，宝藏掉入了危险通道。');
      else if (!this.bridge) fail('石桥还没放下，宝藏掉进了沟壑！');
      else {
        this.status = 'won'; this.stars = this.hints === 0 ? 3 : this.hints <= 2 ? 2 : 1;
        this.score = this.config.pins.length * 200 + this.stars * 300;
        this.message = `探险家安全拿到了宝藏！${this.moves} 步完成，获得 ${this.stars} 星。`;
      }
    }
    return true;
  }
}
export const SCREW_LEVELS = [
  [{ x: 240, y: 273, angle: 0, width: 270 }, { x: 240, y: 228, angle: -36, width: 245 }, { x: 240, y: 190, angle: 34, width: 245 }],
  [{ x: 240, y: 280, angle: 0, width: 280 }, { x: 198, y: 226, angle: 55, width: 225 }, { x: 282, y: 222, angle: -55, width: 225 }, { x: 240, y: 170, angle: 0, width: 280 }],
  [{ x: 240, y: 282, angle: 0, width: 285 }, { x: 190, y: 230, angle: 65, width: 245 }, { x: 290, y: 230, angle: -65, width: 245 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }],
  [{ x: 240, y: 278, angle: 0, width: 280, bolts: 3 }, { x: 193, y: 235, angle: 65, width: 240 }, { x: 287, y: 235, angle: -65, width: 240 }, { x: 240, y: 204, angle: 30, width: 265 }, { x: 240, y: 168, angle: -30, width: 265 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 194, y: 238, angle: 62, width: 255 }, { x: 286, y: 238, angle: -62, width: 255 }, { x: 240, y: 185, angle: 0, width: 275, bolts: 3 }, { x: 240, y: 210, angle: -28, width: 275 }],
  [{ x: 240, y: 290, angle: 0, width: 295, bolts: 3 }, { x: 185, y: 244, angle: 65, width: 250, bolts: 3 }, { x: 295, y: 244, angle: -65, width: 250, bolts: 3 }, { x: 240, y: 215, angle: 30, width: 275 }, { x: 240, y: 181, angle: -30, width: 275 }, { x: 240, y: 155, angle: 0, width: 230, bolts: 3 }],
];
export const SCREW_RULES = [
  { title: '热身拆卸', capacity: 4, difficulty: '入门' }, { title: '交错金属', capacity: 4, difficulty: '入门' },
  { title: '第三颗螺丝', capacity: 4, difficulty: '进阶' }, { title: '空间紧张', capacity: 3, difficulty: '进阶' },
  { title: '层层解锁', capacity: 3, difficulty: '挑战' }, { title: '精密拆解', capacity: 3, difficulty: '挑战' },
];
export function screwPosition(plate, end) {
  const d = [-.37, .37, 0][end] * plate.width, a = plate.angle * Math.PI / 180;
  return { x: plate.x + d * Math.cos(a), y: plate.y + d * Math.sin(a) };
}
function contains(plate, point) {
  const a = -plate.angle * Math.PI / 180, dx = point.x - plate.x, dy = point.y - plate.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) < plate.width / 2 + 9 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) < 36;
}
export class Screws {
  constructor(level = 0) {
    this.level = level; this.config = SCREW_RULES[level];
    this.plates = SCREW_LEVELS[level].map((p, id) => ({ ...p, id, removed: Array(p.bolts || 2).fill(false), fallen: false }));
    this.slots = []; this.status = 'playing'; this.moves = 0; this.hints = 0; this.undos = 0; this.history = []; this.stars = 0; this.score = 0; this.event = null;
    this.message = `暂存槽有 ${this.config.capacity} 格。拆完一整片金属，其螺丝会自动收走。每关可撤销一次。`;
  }
  available(id, end) {
    const plate = this.plates[id];
    if (!plate || !Number.isInteger(end) || end < 0 || end >= plate.removed.length || plate.fallen || plate.removed[end] || this.status !== 'playing') return false;
    return !this.plates.some(other => other.id > id && !other.fallen && contains(other, screwPosition(plate, end)));
  }
  remove(id, end) {
    if (!this.available(id, end)) return false;
    this.history.push({ removed: this.plates.map(p => [...p.removed]), slots: [...this.slots], moves: this.moves });
    const plate = this.plates[id]; plate.removed[end] = true; this.slots.push(id); this.moves++;
    this.event = { id, end, fallen: false };
    if (plate.removed.every(Boolean)) {
      plate.fallen = true; this.event.fallen = true; this.slots = this.slots.filter(slot => slot !== id);
      this.message = `第 ${id + 1} 片金属脱落，归还 ${plate.removed.length} 个暂存位置。`;
    } else this.message = `这片还剩 ${plate.removed.filter(value => !value).length} 颗螺丝。槽位：${this.slots.length} / ${this.config.capacity}。`;
    if (this.plates.every(p => p.fallen)) {
      this.status = 'won'; this.stars = this.hints + this.undos === 0 ? 3 : this.hints + this.undos <= 2 ? 2 : 1;
      this.score = this.moves * 100 + this.stars * 300;
      this.message = `全部拆完！${this.moves} 颗螺丝，获得 ${this.stars} 星。`;
    } else if (this.slots.length >= this.config.capacity) {
      this.status = 'lost'; this.message = this.undos === 0 ? '暂存槽已满。可以撤销一步，调整拆卸顺序。' : '暂存槽已满，撤销机会已用完。重试时优先拆完同一片金属。';
    }
    return true;
  }
  undo() {
    if (this.undos >= 1 || !this.history.length || this.status === 'won') return false;
    const state = this.history.pop(); this.undos++;
    this.plates.forEach((p, i) => { p.removed = state.removed[i]; p.fallen = p.removed.every(Boolean); });
    this.slots = state.slots; this.moves = state.moves; this.status = 'playing'; this.event = null;
    this.message = '已撤销上一步。现在可以选择另一颗螺丝。'; return true;
  }
  hint() {
    if (this.status !== 'playing') return null;
    const path = solveScrews(this);
    if (!path?.length) { this.message = '当前槽位无法完成拆卸，试试撤销一步。'; return null; }
    this.hints++; this.message = `提示：先拆第 ${path[0][0] + 1} 片上高亮的螺丝。`; return path[0];
  }
}
export function solveScrews(game) {
  const initial = game.plates.map(p => p.removed.reduce((mask, v, i) => mask | (v ? 1 << i : 0), 0));
  const full = game.plates.map(p => (1 << p.removed.length) - 1), seen = new Set();
  function search(masks) {
    if (masks.every((m, i) => m === full[i])) return [];
    const key = masks.join(','); if (seen.has(key)) return null; seen.add(key);
    const used = masks.reduce((n, mask, i) => n + (mask === full[i] ? 0 : mask.toString(2).split('1').length - 1), 0);
    if (used >= game.config.capacity) return null;
    for (let id = masks.length - 1; id >= 0; id--) {
      if (masks[id] === full[id]) continue;
      const plate = game.plates[id];
      for (let end = 0; end < plate.removed.length; end++) {
        if (masks[id] & (1 << end)) continue;
        const point = screwPosition(plate, end);
        if (game.plates.some((p, i) => i > id && masks[i] !== full[i] && contains(p, point))) continue;
        const next = [...masks]; next[id] |= 1 << end;
        const tail = search(next); if (tail) return [[id, end], ...tail];
      }
    }
    return null;
  }
  return search(initial);
}
export function runnerBalance(level) {
  const config = RUNNER_LEVELS[level], outcomes = [];
  for (let bits = 0; bits < 2 ** config.gates.length; bits++) {
    let army = config.initial;
    for (let i = 0; i < config.gates.length; i++) {
      const gate = config.gates[i]; army = Math.max(0, applyGate(army, gate.choices[(bits >> i) & 1]) - gate.enemy);
      if (!army) break;
    }
    outcomes.push(army);
  }
  return { routes: outcomes.length, winning: outcomes.filter(n => n >= config.boss).length, max: Math.max(...outcomes), threeStars: outcomes.filter(n => n >= config.stars[2]).length };
}
