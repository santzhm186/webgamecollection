import { RUNNER_LEVELS } from './engine.mjs';

function rounded(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
}
function label(ctx, value, x, y, size = 16, color = '#fff', weight = 750) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(value, x, y);
}
function polygon(ctx, points, fill, stroke) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function soldier(ctx, x, y, size, enemy, time, index) {
  ctx.save(); ctx.translate(x, y + Math.sin(time * 11 + index * 1.4) * (enemy ? .4 : 1.4)); ctx.scale(size, size);
  ctx.fillStyle = '#07132266'; ctx.beginPath(); ctx.ellipse(1, 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  const a = Math.sin(time * 11 + index) * 2;
  ctx.strokeStyle = enemy ? '#8d3a4c' : '#174b84'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 3); ctx.lineTo(-4 + a, 8); ctx.moveTo(3, 3); ctx.lineTo(4 - a, 8); ctx.stroke();
  const body = ctx.createLinearGradient(-5, -6, 5, 6); body.addColorStop(0, enemy ? '#ff9d96' : '#76e3ff'); body.addColorStop(1, enemy ? '#d54f61' : '#2e8bdf');
  rounded(ctx, -5, -6, 10, 12, 4, body);
  rounded(ctx, -5.5, -15, 11, 10, 4, enemy ? '#ef6973' : '#54bcf2', enemy ? '#9e3d51' : '#2977ae');
  rounded(ctx, -4, -11, 8, 3, 1, '#1b334b');
  ctx.strokeStyle = '#ccecff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(7, -12); ctx.stroke();
  ctx.restore();
}
function gateArt(ctx, choice, x, y, width, height, time, selected) {
  const multiply = choice[0] === '×', bad = choice[0] === '−';
  const tint = bad ? '#ff857d' : multiply ? '#b9f582' : '#64d9ff';
  const gradient = ctx.createLinearGradient(x, y - height, x + width, y);
  gradient.addColorStop(0, bad ? '#ae425966' : multiply ? '#4baf6b55' : '#2585b677'); gradient.addColorStop(1, bad ? '#ff756b33' : multiply ? '#bcf58b99' : '#a1ecff99');
  polygon(ctx, [[x + 6, y + 5], [x + width + 15, y + 5], [x + width, y + 15], [x - 2, y + 15]], '#0b1b2d44');
  rounded(ctx, x, y - height, width, height, 6, gradient, tint);
  ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y - height + 3, width - 6, height - 6); ctx.clip();
  for (let i = 0; i < 6; i++) { const yy = y - height + ((time * 12 + i * 17) % height); ctx.fillStyle = '#ffffff16'; ctx.fillRect(x, yy, width, 2); }
  ctx.restore();
  for (const xx of [x - 2, x + width - 4]) {
    rounded(ctx, xx + 3, y - height + 5, 7, height + 8, 2, multiply ? '#427657' : '#325d7f');
    rounded(ctx, xx, y - height, 7, height + 9, 2, tint); rounded(ctx, xx + 1, y - height + 2, 2, height, 1, '#fff8');
  }
  rounded(ctx, x - 2, y - height - 3, width + 5, 7, 2, tint);
  label(ctx, choice.join(''), x + width / 2, y - height / 2 + 10, Math.min(34, height * .43), '#113b42', 850);
  label(ctx, multiply ? 'MULTIPLY' : 'RECRUIT', x + width / 2, y - 9, Math.max(6, height * .1), '#204d51aa', 650);
  if (selected) { ctx.shadowColor = tint; ctx.shadowBlur = 13; ctx.strokeStyle = tint; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y + 15); ctx.lineTo(x + width - 10, y + 15); ctx.stroke(); ctx.shadowBlur = 0; }
}
export function drawRunner(canvas, state, { preview = false, clock = state.time || 0, reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d'), width = 480, height = 420;
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0); ctx.clearRect(0, 0, width, height);
  const config = state.config || RUNNER_LEVELS[0], level = state.level || 0;
  const time = reducedMotion ? 0 : clock;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, ['#183e54', '#503c55', '#282b51'][level]); sky.addColorStop(1, ['#285c65', '#865b5f', '#4d4260'][level]); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffdf9b'; ctx.shadowColor = '#ffeaaa'; ctx.shadowBlur = 28; ctx.beginPath(); ctx.arc(347, 55, 23, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  polygon(ctx, [[0, 120], [0, 75], [55, 53], [91, 82], [137, 46], [177, 100], [230, 71], [288, 111], [370, 76], [430, 95], [480, 62], [480, 180]], '#203b4b');
  polygon(ctx, [[0, 163], [40, 108], [95, 127], [133, 104], [178, 141], [243, 121], [322, 151], [391, 114], [480, 152], [480, 420], [0, 420]], ['#315c62', '#77515b', '#4a4460'][level]);
  for (let i = 0; i < 15; i++) { const xx = ((i * 139 + 23) % 480), yy = 165 + (i * 29) % 235; ctx.fillStyle = '#f1d7ab12'; ctx.beginPath(); ctx.ellipse(xx, yy, 12 + i % 3 * 8, 3, -.2, 0, 6.3); ctx.fill(); }
  polygon(ctx, [[164, 83], [316, 83], [458, 420], [22, 420]], '#152c3c');
  polygon(ctx, [[173, 83], [307, 83], [429, 420], [51, 420]], '#6e8991');
  polygon(ctx, [[177, 83], [303, 83], [418, 420], [62, 420]], '#a8bdba');
  polygon(ctx, [[177, 83], [192, 83], [106, 420], [62, 420]], '#c7d8c8');
  polygon(ctx, [[288, 83], [303, 83], [418, 420], [374, 420]], '#829f9e');
  ctx.strokeStyle = '#557b7d88'; ctx.lineWidth = 1;
  for (let i = 0; i < 15; i++) { const depth = (i / 15 + state.time * .075) % 1, y = 83 + depth * depth * 337, half = 63 + depth * depth * 115; ctx.beginPath(); ctx.moveTo(240 - half, y); ctx.lineTo(240 + half, y); ctx.stroke(); }
  ctx.setLineDash([7, 12]); ctx.strokeStyle = '#e3edd699'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(240, 85); ctx.lineTo(240, 420); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 0; i < 6; i++) { const t = (i / 6 + state.time * .07) % 1, y = 100 + t * t * 320, half = 72 + t * t * 130; for (const side of [-1, 1]) { rounded(ctx, 240 + side * half - 2, y, 4, 10 + t * 10, 1, '#c5fbeb'); } }
  const index = state.gate || 0;
  for (let i = Math.min(index + 2, config.gates.length - 1); i >= index; i--) {
    const gate = config.gates[i], distance = (gate.at - state.time) / 7.5;
    if (distance < 0 || distance > 1.1) continue;
    const depth = Math.max(.06, 1 - distance), y = 95 + depth * 195, w = 44 + depth * 87, h = 27 + depth * 63;
    for (let side = 0; side < 2; side++) gateArt(ctx, gate.choices[side], 240 + (side === 0 ? -1 : 1) * (w / 2 + 5) - w / 2, y, w, h, time, i === index && side === state.side);
    if (!preview && depth > .35) {
      rounded(ctx, 207, y + 19, 66, 18, 8, '#743f4a'); label(ctx, `守卫 ${gate.enemy}`, 240, y + 31, 9, '#ffd9c9');
      if (depth > .7) for (let j = 0; j < 4; j++) soldier(ctx, 215 + j * 17, y + 49, .65, true, time, j);
    }
  }
  if (index >= config.gates.length) {
    const y = 135 + Math.min(1, Math.max(0, (state.time - config.gates.at(-1).at) / 4)) * 65;
    polygon(ctx, [[135, y - 68], [145, y - 78], [338, y - 78], [347, y - 68], [347, y + 23], [135, y + 23]], '#3a354c');
    for (const x of [125, 315]) { rounded(ctx, x, y - 91, 40, 120, 5, '#6a667c', '#928398'); for (let i = 0; i < 3; i++) rounded(ctx, x + i * 14, y - 101, 10, 19, 1, '#94879a'); }
    rounded(ctx, 199, y - 31, 82, 62, [35, 35, 0, 0], '#172b37');
    label(ctx, 'FINAL DEFENSE', 240, y - 45, 9, '#e9d3c8');
    rounded(ctx, 174, y - 18, 132, 7, 3, '#272130'); rounded(ctx, 174, y - 18, 132 * (state.bossHealth ?? config.boss) / config.boss, 7, 3, '#ef8a78');
    label(ctx, `${state.bossHealth ?? config.boss}`, 240, y + 13, 19, '#ffb19f');
    for (let i = 0; i < 10; i++) soldier(ctx, 166 + i % 5 * 36, y + 48 + Math.floor(i / 5) * 19, .85, true, time, i);
  }
  const position = state.position ?? (state.side === 0 ? .25 : .75);
  const center = 126 + position * 228, count = Math.min(state.army, 54), columns = Math.min(8, Math.ceil(Math.sqrt(count)));
  ctx.fillStyle = '#42c8eb16'; ctx.beginPath(); ctx.ellipse(center, 354, 52, 31, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < count; i++) soldier(ctx, center + (i % columns - (columns - 1) / 2) * 12 + Math.floor(i / columns) % 2 * 4, 326 + Math.floor(i / columns) * 10, .85, false, time, i);
  rounded(ctx, center - 33, 288, 66, 27, 12, '#124764', '#70d7ef'); label(ctx, `${state.army}`, center, 307, 16, '#e4fcff');
  if (!preview && state.status === 'playing' && !reducedMotion) {
    for (let i = 0; i < 4; i++) { const t = (time * 2.9 + i / 4) % 1, x = center + Math.sin(i * 3) * 24; const y = 310 - t * (state.phase === 'boss' ? 97 : 68); ctx.strokeStyle = '#fff2b5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke(); }
  }
  if (!preview) {
    rounded(ctx, 15, 14, 108, 43, 11, '#0e2436d9', '#5c9ba855'); label(ctx, 'SQUAD', 69, 29, 8, '#a3c6cb', 650); label(ctx, `${state.army} 人`, 69, 47, 17);
    label(ctx, `${Math.min(config.gates.length, state.gate)} / ${config.gates.length} 道门`, 240, 30, 10, '#c0dbdb', 600);
    rounded(ctx, 175, 40, 130, 4, 2, '#122b3d'); rounded(ctx, 175, 40, Math.max(1, Math.min(130, state.time / (config.bossAt + 2.8) * 130)), 4, 2, '#c9ee91');
    if (state.event?.type === 'gate' && state.time - state.event.at < 1.3) {
      const elapsed = state.time - state.event.at; ctx.globalAlpha = 1 - elapsed / 1.3;
      label(ctx, `+${state.event.gain}`, center, 273 - elapsed * 27, 27, '#d8ff9a'); label(ctx, `−${state.event.loss} 守卫`, center, 292 - elapsed * 18, 11, '#ffbaaa'); ctx.globalAlpha = 1;
    }
  }
  if (state.status === 'won' || state.status === 'lost') {
    ctx.fillStyle = '#10233388'; ctx.fillRect(0, 0, width, height);
    rounded(ctx, 100, 138, 280, 127, 20, '#122b3eef', '#9ebfac55');
    label(ctx, state.status === 'won' ? '要塞已突破' : '队伍需要增援', 240, 180, 27, '#f4f3dc');
    label(ctx, state.status === 'won' ? '★'.repeat(state.stars) + '☆'.repeat(3 - state.stars) : '再试一条路线', 240, 216, 25, state.status === 'won' ? '#dfed95' : '#d4b4ae');
    label(ctx, state.status === 'won' ? `${state.score.toLocaleString()} 分` : '每一次选择，都会改变结局', 240, 244, 12, '#a2bec3', 550);
    if (state.status === 'won' && !reducedMotion) for (let i = 0; i < 34; i++) { const x = (i * 83 + Math.sin(i) * 31) % width, y = (time * 35 + i * 39) % height; ctx.fillStyle = ['#dcf78d', '#6ddcf5', '#ffc68a'][i % 3]; ctx.save(); ctx.translate(x, y); ctx.rotate(i + time); ctx.fillRect(-2, -2, 4, 7); ctx.restore(); }
  }
}
