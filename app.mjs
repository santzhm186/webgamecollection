import { Runner, Pins, Screws, RUNNER_LEVELS, PIN_LEVELS, SCREW_RULES, PIN_LABELS } from './engine.mjs';
import { drawRunner } from './art.mjs';
import { pinBoard, screwBoard, PIN_POINTS } from './boards.mjs';

const $ = selector => document.querySelector(selector);
const dialog = $('#game-dialog'), area = $('#play-area'), status = $('#game-status');
const startButton = $('#start-game'), nextButton = $('#next-level');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const games = {
  runner: { title: '加减门冲关', category: '01 / ACTION', levels: RUNNER_LEVELS, create: level => new Runner(level), instruction: '← → / A D 选门，也可点击或拖动赛道。每波守卫消耗兵力，空格暂停。' },
  pins: { title: '拉针救人', category: '02 / PUZZLE', levels: PIN_LEVELS, create: level => new Pins(level), instruction: '点击金色拉环。水能冷却岩浆，岩浆能处理蜘蛛；气体需要提前排出。' },
  screws: { title: '拧螺丝', category: '03 / CHILL', levels: SCREW_RULES, create: level => new Screws(level), instruction: '拆完一整片金属才归还槽位。三孔金属片要拆 3 颗，每关可撤销一次。' },
};
let active = null, frame = 0, previousTime = 0, filter = 'all', audio = null, sound = false;
const progress = Object.fromEntries(Object.entries(games).map(([id, game]) => [id, game.levels.map(() => ({ stars: 0, score: 0 }))]));
try {
  const saved = JSON.parse(localStorage.getItem('wande-dao-progress-v2') || 'null');
  if (saved && typeof saved === 'object') {
    for (const id of Object.keys(games)) progress[id].forEach((record, i) => {
      const value = saved[id]?.[i];
      if (value && Number.isFinite(value.stars) && Number.isFinite(value.score)) {
        record.stars = Math.min(3, Math.max(0, Math.floor(value.stars))); record.score = Math.max(0, Math.floor(value.score));
      }
    });
  } else {
    const legacy = JSON.parse(localStorage.getItem('wande-dao-completed') || '[]');
    if (Array.isArray(legacy)) legacy.forEach(id => {
      if (!games[id]) return;
      for (let i = 0; i < (id === 'runner' ? 1 : 3); i++) progress[id][i].stars = 1;
    });
  }
  sound = localStorage.getItem('wande-dao-sound') === 'true';
} catch { /* Local persistence is optional. */ }
function persist() { try { localStorage.setItem('wande-dao-progress-v2', JSON.stringify(progress)); } catch { /* Keep playing when storage is unavailable. */ } }
function homeProgress() {
  $('#completed-count').textContent = Object.values(progress).filter(records => records.every(record => record.stars > 0)).length;
  const stars = Object.values(progress).flat().reduce((sum, record) => sum + record.stars, 0);
  $('#star-count').textContent = `${stars} / 45`;
  for (const [id, game] of Object.entries(games)) {
    const node = document.querySelector(`[data-progress="${id}"]`);
    if (node) node.textContent = `${progress[id].filter(record => record.stars > 0).length} / ${game.levels.length} 关`;
  }
}
homeProgress(); $('#year').textContent = new Date().getFullYear();
function playTone(type = 'click') {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const notes = type === 'win' ? [523, 659, 784, 1047] : type === 'fall' ? [440, 660] : type === 'lose' ? [220, 164] : [620];
    notes.forEach((hz, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime + i * .085;
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.035, at + .01); gain.gain.exponentialRampToValueAtTime(.001, at + .17);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + .18);
    });
  } catch { /* Audio is an optional enhancement. */ }
}
function soundLabel() { $('#sound-toggle').textContent = sound ? '♪ 音效开' : '♪ 音效关'; $('#sound-toggle').setAttribute('aria-pressed', String(sound)); }
soundLabel();
$('#sound-toggle').addEventListener('click', () => { sound = !sound; soundLabel(); try { localStorage.setItem('wande-dao-sound', String(sound)); } catch {} playTone(); });

// Homepage art uses the same renderers as the actual games.
drawRunner($('#hero-canvas'), { time: 2.3, gate: 0, army: 32, side: 1, position: .7 }, { preview: true, reducedMotion: true });
drawRunner($('#runner-preview'), { time: 2.4, gate: 0, army: 24, side: 0, position: .25 }, { preview: true, reducedMotion: true });
for (const [selector, markup] of [['#pins-preview', pinBoard(new Pins(3), { prefix: 'pin-card', decorative: true })], ['#screws-preview', screwBoard(new Screws(4), { prefix: 'screw-card', decorative: true })]]) {
  const holder = document.createElement('div'); holder.className = 'mini-scene'; holder.setAttribute('aria-hidden', 'true'); holder.innerHTML = markup; $(selector).replaceWith(holder);
}
function filterGames() {
  const query = $('#search').value.trim().toLowerCase(); let count = 0;
  document.querySelectorAll('.game-card').forEach(card => {
    card.hidden = (filter !== 'all' && card.dataset.category !== filter) || !card.dataset.name.toLowerCase().includes(query);
    if (!card.hidden) count++;
  });
  $('#game-count').textContent = String(count).padStart(2, '0'); $('#empty-state').hidden = count > 0;
}
document.querySelectorAll('[data-filter]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => { other.classList.toggle('active', other === button); other.setAttribute('aria-pressed', String(other === button)); });
    filterGames();
  });
});
$('#search').addEventListener('input', filterGames);
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openGame(button.dataset.open)));
function unlocked(id) { const index = progress[id].findIndex(record => record.stars === 0); return index < 0 ? progress[id].length - 1 : index; }
function openGame(id) {
  active = { id, level: unlocked(id), paused: false, lastStatus: '', highlight: null };
  $('#game-title').textContent = games[id].title; $('#game-category').textContent = games[id].category; $('#game-instruction').textContent = games[id].instruction;
  dialog.showModal(); resetGame();
}
function renderPicker() {
  const max = unlocked(active.id);
  $('#level-picker').innerHTML = games[active.id].levels.map((config, i) => `<button class="level-chip ${i === active.level ? 'selected' : ''} ${progress[active.id][i].stars ? 'cleared' : ''}" data-level="${i}" ${i > max ? 'disabled' : ''} aria-label="第 ${i + 1} 关 ${config.title}${i > max ? '，未解锁' : ''}" aria-pressed="${i === active.level}"><span>${i > max ? '·' : i + 1}</span><small>${progress[active.id][i].stars ? '★'.repeat(progress[active.id][i].stars) : i > max ? '待解锁' : '挑战'}</small></button>`).join('');
  $('#level-picker').querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => { active.level = Number(button.dataset.level); resetGame(); }));
}
function resetGame() {
  cancelAnimationFrame(frame); previousTime = 0; active.paused = false; active.lastStatus = ''; active.highlight = null;
  active.engine = games[active.id].create(active.level);
  const config = active.engine.config;
  $('#level-label').textContent = `${config.title} · ${config.difficulty}`;
  $('#result-panel').hidden = true;
  nextButton.hidden = true; startButton.hidden = active.id !== 'runner'; startButton.innerHTML = '开始冲关 <span>→</span>';
  $('.helper-tools > span').textContent = active.id === 'runner' ? `三星：至少 ${config.stars[2]} 人抵达要塞` : active.id === 'pins' ? '三星：不使用提示。提示不超过 2 次为两星。' : '三星：不用提示或撤销。合计不超过 2 次为两星。';
  $('#hint-button').hidden = active.id === 'runner'; $('#undo-button').hidden = active.id !== 'screws';
  renderPicker();
  if (active.id === 'runner') mountRunner();
  else if (active.id === 'pins') renderPins(); else renderScrews();
  updateStatus();
}
function mountRunner() {
  area.innerHTML = '<div class="runner-board"><canvas class="game-canvas" width="960" height="840" role="img" aria-label="冲关赛道，使用左右方向键选择增益门"></canvas><button class="runner-pause" aria-label="暂停游戏">暂停 Ⅱ</button><div class="touch-controls"><button data-side="0" aria-label="选择左门">← 左门</button><button data-side="1" aria-label="选择右门">右门 →</button></div></div>';
  const canvas = area.querySelector('canvas');
  const choose = event => {
    if (active?.id !== 'runner' || active.engine.phase === 'boss') return;
    const rect = canvas.getBoundingClientRect(); active.engine.side = event.clientX - rect.left < rect.width / 2 ? 0 : 1;
    if (active.engine.status !== 'playing' || active.paused) { active.engine.position = active.engine.side === 0 ? .25 : .75; drawActiveRunner(); }
  };
  canvas.addEventListener('pointerdown', event => { canvas.setPointerCapture(event.pointerId); choose(event); });
  canvas.addEventListener('pointermove', event => { if (event.buttons) choose(event); });
  area.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => {
    if (active.engine.phase === 'boss') return;
    active.engine.side = Number(button.dataset.side);
    if (active.engine.status !== 'playing' || active.paused) { active.engine.position = active.engine.side === 0 ? .25 : .75; drawActiveRunner(); }
  }));
  area.querySelector('.runner-pause').addEventListener('click', togglePause); drawActiveRunner();
}
function drawActiveRunner() { drawRunner(area.querySelector('canvas'), active.engine, { reducedMotion: motion.matches }); }
function hud() {
  const engine = active.engine, config = engine.config;
  let values;
  if (active.id === 'runner') values = [['兵力', engine.army], ['要塞守卫', config.boss], ['下一波', config.gates[engine.gate]?.enemy ?? 'BOSS']];
  else if (active.id === 'pins') values = [['机关', `${engine.removed.size} / ${config.pins.length}`], ['提示', engine.hints], ['本关最佳', '★'.repeat(progress.pins[active.level].stars) || '—']];
  else values = [['金属片', `${engine.plates.filter(p => p.fallen).length} / ${engine.plates.length}`], ['暂存槽', `${engine.slots.length} / ${config.capacity}`], ['剩余撤销', 1 - engine.undos]];
  $('#game-hud').innerHTML = values.map(([title, value]) => `<div><small>${title}</small><strong>${value}</strong></div>`).join('');
}
function updateStatus() {
  if (!active) return;
  const engine = active.engine;
  status.textContent = active.paused ? '已暂停。点击继续或按空格恢复。' : engine.message;
  status.classList.toggle('fail', engine.status === 'lost');
  $('#hint-button').disabled = engine.status !== 'playing';
  $('#undo-button').disabled = active.id !== 'screws' || engine.undos >= 1 || !engine.history?.length || engine.status === 'won';
  if (engine.status === 'won' && active.lastStatus !== 'won') {
    const record = progress[active.id][active.level]; record.stars = Math.max(record.stars, engine.stars); record.score = Math.max(record.score, engine.score);
    persist(); homeProgress(); renderPicker(); playTone('win');
    nextButton.hidden = active.level >= games[active.id].levels.length - 1;
    $('#result-panel').hidden = false;
    $('#result-panel').innerHTML = `<div class="result-stars" aria-label="${engine.stars} 星">${'★'.repeat(engine.stars)}<span>${'☆'.repeat(3 - engine.stars)}</span></div><div><strong>${engine.score.toLocaleString()}<small> 分</small></strong><p>${active.id === 'runner' ? `抵达 ${engine.battleInitial} 人 · 峰值 ${engine.peak} 人` : `${engine.moves} 次操作 · ${engine.hints} 次提示${active.id === 'screws' ? ` · ${engine.undos} 次撤销` : ''}`}</p></div>`;
  } else if (engine.status === 'lost' && active.lastStatus !== 'lost') playTone('lose');
  active.lastStatus = engine.status; hud();
}
function animate(timestamp) {
  if (!active || active.id !== 'runner' || active.paused || active.engine.status !== 'playing') return;
  const delta = previousTime ? Math.min((timestamp - previousTime) / 1000, .1) : 0; previousTime = timestamp;
  const before = active.engine.gate; active.engine.tick(delta);
  if (active.engine.gate !== before) playTone('fall');
  drawActiveRunner();
  if (active.engine.army !== active.lastArmy) { hud(); active.lastArmy = active.engine.army; }
  // Update text only when it changes, so assistive technology isn't interrupted every frame.
  if (active.engine.message !== status.textContent || active.engine.status !== active.lastStatus) updateStatus();
  if (active.engine.status === 'playing') frame = requestAnimationFrame(animate);
  else { startButton.hidden = false; startButton.innerHTML = '再来一局 <span>↻</span>'; }
}
function togglePause() {
  if (active?.id !== 'runner' || active.engine.status !== 'playing') return;
  active.paused = !active.paused;
  const button = area.querySelector('.runner-pause'); button.textContent = active.paused ? '继续 ▶' : '暂停 Ⅱ'; button.setAttribute('aria-label', active.paused ? '继续游戏' : '暂停游戏');
  cancelAnimationFrame(frame); previousTime = 0; updateStatus();
  if (!active.paused) frame = requestAnimationFrame(animate);
}
function burst(x, y, color = '#e8cb7a') {
  if (motion.matches) return;
  const scene = area.querySelector('.scene'); if (!scene) return;
  const effect = document.createElement('span'); effect.className = 'burst'; effect.style.left = `${x / 480 * 100}%`; effect.style.top = `${y / 420 * 100}%`;
  effect.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--dx:${Math.cos(i * Math.PI / 4) * 28}px;--dy:${Math.sin(i * Math.PI / 4) * 28}px;background:${color}"></i>`).join(''); scene.append(effect);
  effect.addEventListener('animationend', () => effect.remove(), { once: true });
}
function renderPins() {
  const engine = active.engine; area.innerHTML = pinBoard(engine, { highlight: active.highlight });
  area.querySelectorAll('[data-pin]').forEach(button => button.addEventListener('click', event => {
    const pin = button.dataset.pin, p = PIN_POINTS[pin]; active.highlight = null;
    if (!engine.pull(pin)) return;
    renderPins(); burst(p.x + p.width - 14, p.y); updateStatus();
    if (engine.status === 'playing') playTone('click');
    if (event.detail === 0) focusBoard();
  }));
}
function renderScrews(falling = null) {
  const engine = active.engine; area.innerHTML = screwBoard(engine, { highlight: active.highlight, falling });
  area.querySelectorAll('[data-plate]').forEach(button => button.addEventListener('click', event => {
    const id = Number(button.dataset.plate), end = Number(button.dataset.end); active.highlight = null;
    if (!engine.remove(id, end)) return;
    renderScrews(engine.event.fallen ? id : null); burst(240, 43, '#d7e6dc'); updateStatus();
    if (engine.status === 'playing') playTone(engine.event.fallen ? 'fall' : 'click');
    if (event.detail === 0) focusBoard(id);
  }));
}
function focusBoard(preferredPlate = null) {
  const available = (preferredPlate !== null && area.querySelector(`[data-plate="${preferredPlate}"]:not(:disabled)`)) || area.querySelector('button:not(:disabled)');
  if (available) available.focus({ preventScroll: true });
  else if (!nextButton.hidden) nextButton.focus({ preventScroll: true });
  else $('#restart').focus({ preventScroll: true });
}
$('#hint-button').addEventListener('click', () => {
  if (!active || active.id === 'runner') return;
  active.highlight = active.engine.hint();
  if (active.id === 'pins') renderPins(); else renderScrews();
  updateStatus();
});
$('#undo-button').addEventListener('click', () => {
  if (active?.id === 'screws' && active.engine.undo()) { active.highlight = null; renderScrews(); updateStatus(); playTone(); }
});
startButton.addEventListener('click', () => {
  if (active?.id !== 'runner') return;
  if (active.engine.status !== 'ready') resetGame();
  active.engine.start(); startButton.hidden = true; previousTime = 0; updateStatus(); frame = requestAnimationFrame(animate);
});
$('#restart').addEventListener('click', resetGame);
nextButton.addEventListener('click', () => { if (active?.engine.status === 'won' && active.level < games[active.id].levels.length - 1) { active.level++; resetGame(); } });
$('#close-game').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener('close', () => { cancelAnimationFrame(frame); active = null; });
document.addEventListener('keydown', event => {
  if (!dialog.open || active?.id !== 'runner') return;
  // Preserve Enter/Space activation on focused controls; use Space to pause from the scene.
  if (event.key === ' ' && event.target.closest('button')) return;
  if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D', ' '].includes(event.key)) event.preventDefault();
  if (active.engine.phase !== 'boss') {
    if (['ArrowLeft', 'a', 'A'].includes(event.key)) active.engine.side = 0;
    if (['ArrowRight', 'd', 'D'].includes(event.key)) active.engine.side = 1;
  }
  if (event.key === ' ' && !event.repeat) togglePause();
  if (active && (active.engine.status !== 'playing' || active.paused)) { active.engine.position = active.engine.side === 0 ? .25 : .75; drawActiveRunner(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && active?.id === 'runner' && !active.paused) togglePause(); });
