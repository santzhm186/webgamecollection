import { Runner, Pins, Screws, RUNNER_GATES, PIN_LEVELS, PIN_LABELS, screwPosition } from './engine.mjs';

const $ = selector => document.querySelector(selector);
const dialog = $('#game-dialog');
const area = $('#play-area');
const status = $('#game-status');
const startButton = $('#start-game');
const nextButton = $('#next-level');
const games = {
  runner: { title: '加减门冲关', category: '01 / ACTION', instruction: '按 ← → 或 A / D 选择左右门，也可以点击、拖动赛道。空格暂停。' },
  pins: { title: '拉针救人', category: '02 / PUZZLE', instruction: '点击金色拉环拔针。先观察水、岩浆和其他危险的位置。' },
  screws: { title: '拧螺丝', category: '03 / CHILL', instruction: '点击可见螺丝拆卸。暗色螺丝被上层金属片挡住，暂存槽只有 3 格。' },
};
let active = null, frame = 0, previousTime = 0, filter = 'all';
let completed;
try { completed = new Set(JSON.parse(localStorage.getItem('wande-dao-completed') || '[]').filter(id => games[id])); } catch { completed = new Set(); }
$('#completed-count').textContent = completed.size;
$('#year').textContent = new Date().getFullYear();

function round(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function text(ctx, value, x, y, size = 16, fill = '#273345', weight = 700) {
  ctx.fillStyle = fill; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(value, x, y);
}
function pawn(ctx, x, y, size = 1, color = '#417ae6') {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
  ctx.fillStyle = '#20364d28'; ctx.beginPath(); ctx.ellipse(2, 9, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  round(ctx, -5, -4, 10, 13, 4, color);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -10, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(-1.5, -12, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawRunner(canvas, runner, preview = false) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / 430, 0, 0, canvas.height / 400, 0, 0);
  ctx.clearRect(0, 0, 430, 400);
  if (!preview) { ctx.fillStyle = '#dce9fb'; ctx.fillRect(0, 0, 430, 400); }
  ctx.fillStyle = preview ? '#c5d8ab' : '#c1d6f0';
  ctx.beginPath(); ctx.moveTo(135, 45); ctx.lineTo(295, 45); ctx.lineTo(410, 400); ctx.lineTo(20, 400); ctx.closePath(); ctx.fill();
  ctx.fillStyle = preview ? '#f3f6e8' : '#f3f6fc';
  ctx.beginPath(); ctx.moveTo(143, 45); ctx.lineTo(287, 45); ctx.lineTo(390, 400); ctx.lineTo(40, 400); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = preview ? '#d5dfc6' : '#d7e2f0'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const progress = ((i / 12 + runner.time * .08) % 1);
    const y = 45 + progress * progress * 355, half = 72 + progress * progress * 104;
    ctx.beginPath(); ctx.moveTo(215 - half, y); ctx.lineTo(215 + half, y); ctx.stroke();
  }
  ctx.setLineDash([8, 10]); ctx.strokeStyle = '#c0cddd'; ctx.beginPath(); ctx.moveTo(215, 45); ctx.lineTo(215, 400); ctx.stroke(); ctx.setLineDash([]);
  for (let i = Math.min(runner.gate + 1, 4); i >= runner.gate; i--) {
    const gate = RUNNER_GATES[i];
    if (!gate) continue;
    const distance = (gate.at - runner.time) / 7;
    if (distance < 0 || distance > 1.3) continue;
    const z = Math.max(.08, 1 - distance), y = 65 + z * 215, width = 57 + z * 68, height = 42 + z * 42;
    for (let side = 0; side < 2; side++) {
      const x = 215 + (side === 0 ? -1 : 1) * (width / 2 + 4) - width / 2;
      const operation = gate.choices[side];
      const bad = operation[0] === '−';
      round(ctx, x + 4, y - height + 5, width, height, 5, '#20364d19');
      round(ctx, x, y - height, width, height, 5, bad ? '#ffc6ba' : side === 0 ? '#b1d6ff' : '#b2e4c6', bad ? '#d77765' : side === 0 ? '#5d98e3' : '#57a678');
      round(ctx, x + 5, y - height + 4, width - 10, height - 7, 3, '#ffffff36');
      text(ctx, operation.join(''), x + width / 2, y - height / 2 + 8, 17 + z * 13, bad ? '#a14634' : side === 0 ? '#2f6cb7' : '#287f4a');
      ctx.fillStyle = bad ? '#e39584' : side === 0 ? '#78a9e7' : '#7bbc8b'; ctx.fillRect(x - 1, y - height, 5, height + 10); ctx.fillRect(x + width - 3, y - height, 5, height + 10);
    }
    if (!preview && z > .6) text(ctx, `守卫 −${gate.enemy}`, 215, y + 27, 10, '#b86b60');
  }
  if (runner.gate >= 5) {
    const y = 90 + Math.min(1, (runner.time - 20.8) / 5.2) * 150;
    round(ctx, 130, y - 50, 170, 55, 8, '#e98475', '#b55249');
    text(ctx, '最后的守卫 · 160', 215, y - 17, 16, '#fff');
    for (let i = 0; i < 7; i++) pawn(ctx, 158 + i * 19, y + 20, .9, '#ca6054');
  }
  const center = runner.side === 0 ? 140 : 290;
  const count = Math.min(runner.army, 40), columns = Math.min(7, Math.ceil(Math.sqrt(count)));
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns), col = i % columns;
    pawn(ctx, center + (col - (columns - 1) / 2) * 15 + (row % 2) * 3, 333 + row * 11, .9, '#4684e7');
  }
  round(ctx, center - 30, 290, 60, 25, 12, '#2d65b6'); text(ctx, `${runner.army}`, center, 308, 15, 'white');
  if (!preview) {
    round(ctx, 12, 12, 94, 38, 8, '#fffefeeb'); text(ctx, `兵力 ${runner.army}`, 59, 37, 14);
    text(ctx, `${Math.min(100, Math.round(runner.time / 26 * 100))}%`, 215, 34, 12, '#596f89');
    round(ctx, 120, 43, 190, 4, 2, '#b8cbe2'); round(ctx, 120, 43, Math.max(1, Math.min(190, runner.time / 26 * 190)), 4, 2, '#5a87cf');
  }
  if (runner.status === 'won' || runner.status === 'lost') {
    ctx.fillStyle = '#1f2d4c33'; ctx.fillRect(0, 0, 430, 400);
    round(ctx, 95, 155, 240, 80, 15, '#fffdf4'); text(ctx, runner.status === 'won' ? '突破成功！' : '再试一次？', 215, 203, 27);
  }
}
function drawPinsPreview(canvas) {
  const ctx = canvas.getContext('2d'); ctx.setTransform(canvas.width / 430, 0, 0, canvas.height / 280, 0, 0); ctx.clearRect(0, 0, 430, 280);
  ctx.save(); ctx.translate(215, 160); ctx.rotate(-.07); ctx.translate(-215, -160);
  round(ctx, 132, 48, 174, 207, 15, '#c89456', '#a7733c'); round(ctx, 144, 61, 150, 182, 8, '#fff1d9');
  round(ctx, 147, 64, 144, 48, 6, '#7ecfe7'); round(ctx, 147, 118, 144, 49, 6, '#f18d59');
  ctx.strokeStyle = '#e3f9ff'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 151; x < 290; x++) { const y = 78 + Math.sin(x / 8) * 3; if (x === 151) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
  for (let i = 0; i < 3; i++) { const y = 113 + i * 55; round(ctx, 136, y, 174, 7, 3, '#ffc95b', '#b78631'); ctx.beginPath(); ctx.arc(315, y + 3, 9, 0, Math.PI * 2); ctx.fillStyle = '#ffce67'; ctx.fill(); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { text(ctx, '◆', 170 + i % 3 * 25, 191 + Math.floor(i / 3) * 15, 17, '#e7ae2c'); }
  pawn(ctx, 262, 226, 1.8, '#629270'); ctx.restore();
  text(ctx, '?', 107, 159, 34, '#d19a57'); text(ctx, '✦', 334, 202, 24, '#d19a57');
}
const plateColors = ['#9c8cc9', '#f6c878', '#a8c8a6', '#e59182', '#94b8d6'];
function drawScrewsPreview(canvas) {
  const ctx = canvas.getContext('2d'); ctx.setTransform(canvas.width / 430, 0, 0, canvas.height / 280, 0, 0); ctx.clearRect(0, 0, 430, 280);
  const plates = [{ x: 215, y: 170, angle: -8, width: 215 }, { x: 215, y: 162, angle: 53, width: 190 }, { x: 215, y: 135, angle: -40, width: 215 }];
  plates.forEach((p, id) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle * Math.PI / 180);
    round(ctx, -p.width / 2 + 4, -25 + 7, p.width, 50, 12, '#54447233'); round(ctx, -p.width / 2, -25, p.width, 50, 12, plateColors[id], '#776c8d44');
    for (const x of [-p.width * .37, p.width * .37]) { ctx.fillStyle = '#ede8f8'; ctx.beginPath(); ctx.arc(x, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#8f83a4'; ctx.stroke(); text(ctx, '+', x, 6, 19, '#8a7e9e'); }
    ctx.restore();
  });
  text(ctx, '✦', 85, 105, 24, '#b8a6d0'); text(ctx, '✦', 341, 215, 17, '#b8a6d0');
}
drawRunner($('#hero-canvas'), { time: 2.2, gate: 0, army: 32, side: 1 }, true);
drawRunner($('#runner-preview'), { time: 2.7, gate: 0, army: 24, side: 0 }, true);
drawPinsPreview($('#pins-preview')); drawScrewsPreview($('#screws-preview'));

function filterGames() {
  const query = $('#search').value.trim().toLowerCase(); let count = 0;
  document.querySelectorAll('.game-card').forEach(card => {
    const visible = (filter === 'all' || card.dataset.category === filter) && card.dataset.name.toLowerCase().includes(query);
    card.hidden = !visible; if (visible) count++;
  });
  $('#game-count').textContent = String(count).padStart(2, '0'); $('#empty-state').hidden = count > 0;
}
document.querySelectorAll('[data-filter]').forEach(button => {
  button.setAttribute('aria-pressed', button.classList.contains('active'));
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', other === button); });
    filterGames();
  });
});
$('#search').addEventListener('input', filterGames);
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.open)));

function openGame(id) {
  active = { id, level: 0, paused: false, lastStatus: '' };
  $('#game-title').textContent = games[id].title; $('#game-category').textContent = games[id].category; $('#game-instruction').textContent = games[id].instruction;
  dialog.showModal(); resetGame();
}
function resetGame() {
  cancelAnimationFrame(frame); previousTime = 0; active.paused = false; active.lastStatus = '';
  active.engine = active.id === 'runner' ? new Runner() : active.id === 'pins' ? new Pins(active.level) : new Screws(active.level);
  $('#level-label').textContent = active.id === 'runner' ? '5 道门 · 最终守卫 160 人' : `第 ${active.level + 1} / 3 关${active.id === 'pins' ? ' · ' + PIN_LEVELS[active.level].title : ''}`;
  nextButton.hidden = true; startButton.hidden = active.id !== 'runner'; startButton.innerHTML = '开始游戏 <span>→</span>';
  if (active.id === 'runner') {
    area.innerHTML = '<div class="runner-board"><canvas class="game-canvas" width="430" height="400" aria-label="加减门赛道，使用左右方向键选择增益门"></canvas><button class="runner-pause" aria-label="暂停游戏">暂停 Ⅱ</button><div class="touch-controls"><button data-side="0" aria-label="选择左门">←</button><button data-side="1" aria-label="选择右门">→</button></div></div>';
    const canvas = area.querySelector('canvas');
    const choose = event => { if (active?.id !== 'runner') return; const rect = canvas.getBoundingClientRect(); active.engine.side = event.clientX - rect.left < rect.width / 2 ? 0 : 1; if (active.engine.status !== 'playing' || active.paused) drawRunner(canvas, active.engine); };
    canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); choose(event); });
    canvas.addEventListener('pointermove', event => { if (event.buttons) choose(event); });
    area.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => { active.engine.side = Number(button.dataset.side); drawRunner(canvas, active.engine); }));
    area.querySelector('.runner-pause').addEventListener('click', togglePause);
    drawRunner(canvas, active.engine);
  } else if (active.id === 'pins') renderPins();
  else renderScrews();
  updateStatus();
}
function updateStatus() {
  if (!active) return;
  const engine = active.engine;
  status.textContent = active.paused ? '已暂停。点击继续或按空格键恢复。' : engine.message;
  status.classList.toggle('fail', engine.status === 'lost');
  if (engine.status === 'won' && active.lastStatus !== 'won') {
    if (active.id === 'runner' || active.level === 2) {
      completed.add(active.id); $('#completed-count').textContent = completed.size;
      try { localStorage.setItem('wande-dao-completed', JSON.stringify([...completed])); } catch { /* Gameplay also works with storage disabled. */ }
    }
    nextButton.hidden = active.id === 'runner' || active.level >= 2;
  }
  active.lastStatus = engine.status;
}
function animate(timestamp) {
  if (!active || active.id !== 'runner' || active.paused || active.engine.status !== 'playing') return;
  const dt = previousTime ? Math.min((timestamp - previousTime) / 1000, .1) : 0; previousTime = timestamp;
  active.engine.tick(dt); drawRunner(area.querySelector('canvas'), active.engine); updateStatus();
  if (active.engine.status === 'playing') frame = requestAnimationFrame(animate);
  else { startButton.hidden = false; startButton.innerHTML = '再玩一局 <span>↻</span>'; }
}
function togglePause() {
  if (active?.id !== 'runner' || active.engine.status !== 'playing') return;
  active.paused = !active.paused;
  area.querySelector('.runner-pause').textContent = active.paused ? '继续 ▶' : '暂停 Ⅱ';
  area.querySelector('.runner-pause').setAttribute('aria-label', active.paused ? '继续游戏' : '暂停游戏');
  cancelAnimationFrame(frame); previousTime = 0; updateStatus();
  if (!active.paused) frame = requestAnimationFrame(animate);
}
startButton.addEventListener('click', () => {
  if (active?.id !== 'runner') return;
  if (active.engine.status !== 'ready') resetGame();
  active.engine.start(); startButton.hidden = true; previousTime = 0; frame = requestAnimationFrame(animate);
});
$('#restart').addEventListener('click', resetGame);
nextButton.addEventListener('click', () => { if (active && active.engine.status === 'won' && active.level < 2) { active.level++; resetGame(); } });
$('#close-game').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => { cancelAnimationFrame(frame); active = null; });
document.addEventListener('keydown', event => {
  if (!dialog.open || active?.id !== 'runner') return;
  if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D', ' '].includes(event.key)) event.preventDefault();
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) active.engine.side = 0;
  if (['ArrowRight', 'd', 'D'].includes(event.key)) active.engine.side = 1;
  if (event.key === ' ' && !event.repeat) togglePause();
  if (active && (active.engine.status !== 'playing' || active.paused)) drawRunner(area.querySelector('canvas'), active.engine);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && active?.id === 'runner' && !active.paused) togglePause(); });

function svgPawn(x, y, happy = false) {
  return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="32" rx="18" ry="5" fill="#61472722"/><path d="M-9 13v17m18-17v17" stroke="#526952" stroke-width="7" stroke-linecap="round"/><rect x="-13" y="-5" width="26" height="26" rx="9" fill="#76a37c"/><circle cy="-15" r="12" fill="#e3b58a"/><path d="M-13-19q0-18 24-6l4 7" fill="#bc955f"/><path d="M-7-13h2m7 0h2" stroke="#65503f" stroke-width="3"/><path d="M-3-6q3 ${happy ? 5 : 0} 6 0" fill="none" stroke="#65503f" stroke-width="2"/></g>`;
}
function renderPins() {
  const engine = active.engine, pins = engine.config.pins, count = pins.length, top = 43, step = count === 4 ? 50 : 64;
  const waters = engine.removed.has('water');
  const extra = count === 4 ? (engine.config.spider ? `<text x="214" y="${top + 37}" text-anchor="middle" font-size="30">${engine.spider ? '🕷' : '·'}</text>` : `<g fill="${engine.gas ? '#ba9ab6' : '#ecd9bb'}"><ellipse cx="200" cy="${top + 25}" rx="35" ry="17"/><ellipse cx="236" cy="${top + 32}" rx="25" ry="13"/></g>`) : '';
  const waterY = count === 4 ? top + step : top;
  const lavaY = waterY + step;
  const rewardY = lavaY + step;
  const last = pins[pins.length - 1];
  area.innerHTML = `<div class="board pin-board"><svg viewBox="0 0 430 350" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="stones" width="30" height="20" patternUnits="userSpaceOnUse"><path d="M0 0h30v20H0z" fill="#aaa093"/><path d="M2 2h26v16H2z" fill="#bbb1a4"/></pattern></defs><rect x="70" y="22" width="290" height="304" rx="16" fill="#c09562"/><rect x="82" y="33" width="266" height="280" rx="10" fill="#fff1d9"/>${extra}${!waters ? `<rect x="86" y="${waterY}" width="258" height="${step - 8}" rx="4" fill="#7dcde7"/><path d="M88 ${waterY + 14}q20-10 40 0t40 0t40 0t40 0t40 0t40 0" fill="none" stroke="#daf6ff" stroke-width="3"/>` : ''}${!engine.drained ? `<rect x="86" y="${lavaY}" width="258" height="${step - 8}" rx="4" fill="${engine.hot ? '#ef925e' : 'url(#stones)'}"/>${engine.hot ? `<path d="M90 ${lavaY + step - 15}l16-28 14 18 15-31 17 23 15-19 18 27 15-30 18 23 16-17 18 28 15-21 18 20 19-26 20 35z" fill="#f5c563"/>` : ''}` : ''}${!engine.removed.has(last) ? `<g fill="#e4ae34" stroke="#be8b23">${Array.from({ length: 8 }, (_, i) => `<path d="M${132 + i * 24} ${rewardY + 10}l8 10-8 10-8-10z"/>`).join('')}</g>` : ''}<path d="M82 ${lavaY + step - 4}h-25v84h25" fill="none" stroke="#ad7c42" stroke-width="8"/>${svgPawn(215, 280, engine.status === 'won')}${engine.status === 'won' ? '<text x="165" y="285" font-size="27" fill="#dfb43c">✦</text><text x="255" y="288" font-size="23" fill="#dfb43c">✦</text>' : ''}</svg>${pins.map((pin, i) => { const y = top + (i + 1) * step - 20; return `<button class="pin-control ${engine.removed.has(pin) ? 'removed' : ''}" data-pin="${pin}" style="top:${y / 350 * 100}%" aria-label="${PIN_LABELS[pin]}" ${engine.status !== 'playing' || engine.removed.has(pin) ? 'disabled' : ''}><span>${i + 1}</span></button><span class="pin-label" style="top:${(y - 13) / 350 * 100}%">${PIN_LABELS[pin]}</span>`; }).join('')}</div>`;
  area.querySelectorAll('[data-pin]').forEach(button => button.addEventListener('click', () => { const pin = button.dataset.pin; engine.pull(pin); renderPins(); updateStatus(); const next = area.querySelector('[data-pin]:not(:disabled)'); if (next) next.focus({ preventScroll: true }); }));
}
function renderScrews() {
  const engine = active.engine;
  area.innerHTML = `<div class="board screw-board"><div class="slot-bar" aria-label="暂存槽 ${engine.slots.length} / 3">${[0, 1, 2].map(i => `<span class="slot ${i < engine.slots.length ? 'filled' : ''}">${i < engine.slots.length ? '+' : ''}</span>`).join('')}</div><svg viewBox="0 0 430 350" preserveAspectRatio="none" aria-hidden="true"><rect x="52" y="80" width="326" height="240" rx="20" fill="#e0d7eb" stroke="#d6c8e2"/><circle cx="72" cy="100" r="4" fill="#c5b8d5"/><circle cx="358" cy="100" r="4" fill="#c5b8d5"/><circle cx="72" cy="300" r="4" fill="#c5b8d5"/><circle cx="358" cy="300" r="4" fill="#c5b8d5"/>${engine.plates.filter(p => !p.fallen).map(p => `<g transform="translate(${p.x} ${p.y}) rotate(${p.angle})"><rect x="${-p.width / 2 + 3}" y="-21" width="${p.width}" height="54" rx="11" fill="#5d48672c"/><rect x="${-p.width / 2}" y="-27" width="${p.width}" height="54" rx="11" fill="${plateColors[p.id]}" stroke="#75668244" stroke-width="2"/><path d="M${-p.width / 2 + 12} -22h${p.width - 24}" stroke="#ffffff55" stroke-width="3"/>${[0, 1].map(end => `<circle cx="${(end === 0 ? -1 : 1) * p.width * .37}" cy="0" r="11" fill="#655972"/>`).join('')}</g>`).join('')}${engine.status === 'won' ? '<text x="215" y="205" text-anchor="middle" font-size="38" fill="#9a85ae">全部拆完 ✦</text>' : ''}</svg>${engine.plates.filter(p => !p.fallen).map(p => [0, 1].filter(end => !p.removed[end]).map(end => { const pos = screwPosition(p, end); return `<button class="screw" data-plate="${p.id}" data-end="${end}" style="left:${pos.x / 430 * 100}%;top:${pos.y / 350 * 100}%;z-index:${p.id + 4}" ${!engine.available(p.id, end) ? 'disabled' : ''} aria-label="${p.id + 1} 号金属片${end === 0 ? '左' : '右'}侧螺丝">+</button>`; }).join('')).join('')}</div>`;
  area.querySelectorAll('[data-plate]').forEach(button => button.addEventListener('click', () => { const id = Number(button.dataset.plate); engine.remove(id, Number(button.dataset.end)); renderScrews(); updateStatus(); const next = area.querySelector(`[data-plate="${id}"]:not(:disabled)`) || area.querySelector('[data-plate]:not(:disabled)'); if (next) next.focus({ preventScroll: true }); }));
}
