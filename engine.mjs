export const RUNNER_GATES = [
  { at: 4, choices: [['+', 20], ['×', 3]], enemy: 8 },
  { at: 8.2, choices: [['×', 2], ['+', 30]], enemy: 20 },
  { at: 12.4, choices: [['×', 3], ['−', 15]], enemy: 35 },
  { at: 16.6, choices: [['+', 65], ['×', 2]], enemy: 55 },
  { at: 20.8, choices: [['×', 3], ['+', 90]], enemy: 75 },
];
export function applyGate(count, [operator, value]) {
  if (operator === '+') return count + value;
  if (operator === '×') return count * value;
  return Math.max(0, count - value);
}
export class Runner {
  constructor() { this.time = 0; this.army = 12; this.side = 0; this.gate = 0; this.status = 'ready'; this.message = '选择增益门，带足兵力突破最后的守卫。'; }
  start() { if (this.status === 'ready') this.status = 'playing'; }
  tick(dt) {
    if (this.status !== 'playing') return;
    this.time += Math.max(0, Math.min(dt, .1));
    const gate = RUNNER_GATES[this.gate];
    if (gate && this.time >= gate.at) {
      const before = this.army;
      this.army = Math.max(0, applyGate(this.army, gate.choices[this.side]) - gate.enemy);
      this.message = `${before} 人通过 ${gate.choices[this.side].join('')} 门，击退 ${gate.enemy} 名守卫后剩 ${this.army} 人。`;
      this.gate++;
      if (!this.army) { this.status = 'lost'; this.message = '队伍耗尽了。重来一次，选一条更好的路线！'; }
    }
    if (this.time >= 26 && this.status === 'playing') {
      this.status = this.army >= 160 ? 'won' : 'lost';
      this.message = this.status === 'won' ? `成功突破！${this.army} 人的队伍战胜了 160 人守卫。` : `还差 ${160 - this.army} 人！最后的守卫需要至少 160 人。`;
    }
  }
}
export const PIN_LEVELS = [
  { title: '让岩浆冷静一下', pins: ['water', 'drain', 'treasure'], spider: false, gas: false },
  { title: '先处理不速之客', pins: ['spider', 'water', 'drain', 'treasure'], spider: true, gas: false },
  { title: '小心密室里的气体', pins: ['vent', 'water', 'drain', 'treasure'], spider: false, gas: true },
];
export const PIN_LABELS = { water: '引水冷却', drain: '排空岩浆槽', treasure: '放下宝藏', spider: '放下蜘蛛', vent: '打开排气口' };
export class Pins {
  constructor(level = 0) { this.level = level; this.config = PIN_LEVELS[level]; this.hot = true; this.drained = false; this.spider = this.config.spider; this.gas = this.config.gas; this.removed = new Set(); this.status = 'playing'; this.message = '观察机关，按顺序拔针，让宝藏安全落到探险家身边。'; }
  pull(pin) {
    if (this.status !== 'playing' || this.removed.has(pin) || !this.config.pins.includes(pin)) return;
    this.removed.add(pin);
    const fail = message => { this.status = 'lost'; this.message = message; };
    if (pin === 'vent') { this.gas = false; this.message = '气体已经排出，可以安全引水了。'; }
    if (pin === 'spider') {
      if (!this.hot) fail('岩浆已经冷却，蜘蛛跑到了探险家身边！');
      else { this.spider = false; this.message = '蜘蛛掉入岩浆，危险解除。接下来让岩浆冷却。'; }
    }
    if (pin === 'water') {
      if (this.gas) fail('水蒸气点燃了密室里的气体！先打开排气口。');
      else { this.hot = false; this.message = '水流让岩浆冷却成石块。现在可以排空岩浆槽。'; }
    }
    if (pin === 'drain') {
      if (this.hot) fail('滚烫的岩浆流向了探险家！先用水冷却。');
      else if (this.spider) fail('蜘蛛还躲在密室里，跟着石块掉下来了！');
      else { this.drained = true; this.message = '石块落入侧面的废料槽，宝藏的通道清空了。'; }
    }
    if (pin === 'treasure') {
      if (!this.drained || this.spider || this.gas) fail('通道还没安全，宝藏被困住了！先清理上面的危险。');
      else { this.status = 'won'; this.message = '救援成功！探险家拿到了全部宝藏。'; }
    }
  }
}
export const SCREW_LEVELS = [
  [{ x: 215, y: 235, angle: 0, width: 265 }, { x: 215, y: 195, angle: -36, width: 235 }, { x: 215, y: 165, angle: 34, width: 235 }],
  [{ x: 215, y: 245, angle: 0, width: 270 }, { x: 180, y: 195, angle: 55, width: 220 }, { x: 260, y: 190, angle: -55, width: 220 }, { x: 215, y: 145, angle: 0, width: 270 }],
  [{ x: 215, y: 245, angle: 0, width: 270 }, { x: 175, y: 205, angle: 65, width: 235 }, { x: 255, y: 205, angle: -65, width: 235 }, { x: 215, y: 175, angle: 30, width: 250 }, { x: 215, y: 135, angle: -30, width: 250 }],
];
export function screwPosition(plate, end) {
  const d = (end === 0 ? -1 : 1) * plate.width * .37, a = plate.angle * Math.PI / 180;
  return { x: plate.x + d * Math.cos(a), y: plate.y + d * Math.sin(a) };
}
function contains(plate, point) {
  const a = -plate.angle * Math.PI / 180, dx = point.x - plate.x, dy = point.y - plate.y;
  return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) < plate.width / 2 + 10 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) < 34;
}
export class Screws {
  constructor(level = 0) { this.level = level; this.plates = SCREW_LEVELS[level].map((p, id) => ({ ...p, id, removed: [false, false], fallen: false })); this.slots = []; this.status = 'playing'; this.message = '先拆最上面的金属片。暂存槽只有 3 格，整片脱落后归还螺丝。'; }
  available(id, end) {
    const plate = this.plates[id];
    if (!plate || plate.fallen || plate.removed[end] || this.status !== 'playing') return false;
    return !this.plates.some(other => other.id > id && !other.fallen && contains(other, screwPosition(plate, end)));
  }
  remove(id, end) {
    if (!this.available(id, end)) return;
    const plate = this.plates[id];
    plate.removed[end] = true;
    this.slots.push(id);
    if (plate.removed.every(Boolean)) {
      plate.fallen = true;
      this.slots = this.slots.filter(slot => slot !== id);
      this.message = '金属片脱落了！暂存槽腾出了空间。';
    } else this.message = '一颗到手。拆完同一块金属片，才能腾出暂存槽。';
    if (this.plates.every(p => p.fallen)) { this.status = 'won'; this.message = '全部拆完！最后一片金属落下的感觉真好。'; }
    else if (this.slots.length >= 3) { this.status = 'lost'; this.message = '暂存槽满了！重试时尽量先拆完同一块金属片。'; }
  }
}
