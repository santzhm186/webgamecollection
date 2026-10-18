/**
 * 拧螺丝 · 渲染器（DOM，kind: 'dom'）
 * ============================================================================
 * 纯点击驱动：由宿主派发动作，无内部可变状态。
 */
import { screwPosition, screwEndLabel } from './dictionary.js';
import { t } from '../../src/core/host-surface.js';

export const metallic = ['#93b5d2', '#e8b76d', '#88b2a1', '#d98f7a', '#b29bcf', '#a6c4c5', '#e5a4af', '#c1cf82'];

export function defs(prefix) {
  return `<defs>
    <radialGradient id="${prefix}-screw" cx=".3" cy=".2"><stop stop-color="#f8f7e8"/><stop offset=".45" stop-color="#c3ced0"/><stop offset=".85" stop-color="#7c8f9c"/><stop offset="1" stop-color="#ced9d5"/></radialGradient>
    <linearGradient id="${prefix}-wood" x2=".8" y2="1"><stop stop-color="#e0b67e"/><stop offset=".55" stop-color="#bd8d5e"/><stop offset="1" stop-color="#9c7050"/></linearGradient>
    <linearGradient id="${prefix}-rubber" x2=".6" y2="1"><stop stop-color="#354c55"/><stop offset="1" stop-color="#24333e"/></linearGradient>
    <pattern id="${prefix}-grain" width="90" height="45" patternUnits="userSpaceOnUse"><path d="M0 10q22-8 46-2t44-2M0 34q28-11 51-3t39-2M15 20h45" fill="none" stroke="#6c472520" stroke-width="1.4"/></pattern>
    <pattern id="${prefix}-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0v25" fill="none" stroke="#93b0b511" stroke-width="1"/></pattern>
    <filter id="${prefix}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0c1d22" flood-opacity=".4"/></filter>
    ${metallic.map((color, i) => `<linearGradient id="${prefix}-plate-${i}" x2="0" y2="1"><stop stop-color="${color}"/><stop offset=".13" stop-color="${color}"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="${['#567c9d', '#b07d3f', '#4d7f6d', '#a95e51', '#7e639c', '#638c90', '#a5667c', '#839c51'][i]}"/></linearGradient>`).join('')}
  </defs>`;
}

export function screwHead(x, y, prefix, radius = 12) {
  return `<g transform="translate(${x} ${y})"><circle cy="3" r="${radius}" fill="#23374499"/><circle r="${radius}" fill="url(#${prefix}-screw)" stroke="#e3e7d3" stroke-width="1.3"/><circle r="${radius - 3}" fill="none" stroke="#51667488" stroke-width=".8"/><path d="M-6 0H6M0-6V6" stroke="#52616a" stroke-width="3.8" stroke-linecap="round"/><path d="M-6-1H-1V-6" fill="none" stroke="#263e4c88" stroke-width="1.3"/><circle cx="-5" cy="-7" r="1.2" fill="#fff"/></g>`;
}

export function screwBoard(engine, { prefix = 'screw-main', decorative = false, highlight = null, falling = null } = {}) {
  const capacity = engine.config.capacity, left = 240 - capacity * 24;
  return `<div class="scene workshop-scene"><svg viewBox="0 0 480 420" aria-hidden="true">${defs(prefix)}
    <rect width="480" height="420" fill="url(#${prefix}-wood)"/><rect width="480" height="420" fill="url(#${prefix}-grain)"/>
    <path d="M0 125H480M0 277H480" stroke="#77543444" stroke-width="3"/><path d="M0 128H480M0 280H480" stroke="#efd0a255" stroke-width="2"/>
    <g transform="translate(445 292) rotate(20)"><rect x="-6" y="-81" width="12" height="106" rx="4" fill="#778d9b"/><rect x="-11" y="-5" width="22" height="67" rx="9" fill="#455a66" stroke="#293e48"/><path d="M-4 3v50m8-50v50" stroke="#7b9190" stroke-width="2"/></g>
    <g transform="translate(23 109) rotate(-23)"><path d="M0 0v83" stroke="#899ca1" stroke-width="7"/><path d="M-9-4l-3-14 5-11 4 15 7-1 2-16 6 9-2 16-8 7z" fill="#a4b5b5" stroke="#71838c"/></g>
    <rect x="39" y="83" width="402" height="311" rx="22" fill="#634d3d44"/><rect x="39" y="77" width="402" height="311" rx="22" fill="url(#${prefix}-rubber)" stroke="#8baba7" stroke-width="2"/>
    <rect x="46" y="84" width="388" height="297" rx="18" fill="url(#${prefix}-grid)"/>
    <path d="M61 98h14m-14 0v14m358-14h-14m14 0v14M61 367h14m-14 0v-14m358 14h-14m14 0v-14" fill="none" stroke="#809b9944" stroke-width="2"/>
    <text x="240" y="372" text-anchor="middle" font-family="system-ui" font-size="8" letter-spacing="3" fill="#99b6af55">${t('game.screws.canvasMotto')}</text>
    <rect x="${left - 14}" y="12" width="${capacity * 48 + 28}" height="62" rx="13" fill="#735e45" opacity=".7"/>
    <rect x="${left - 14}" y="8" width="${capacity * 48 + 28}" height="62" rx="13" fill="#2c3c43" stroke="#b4b19a" stroke-width="1.3"/>
    <text x="240" y="22" text-anchor="middle" font-size="7" letter-spacing="2.5" fill="#b9c8bf" font-family="system-ui">${t('game.screws.canvasStorage')}</text>
    ${Array.from({ length: capacity }, (_, i) => { const x = left + i * 48 + 24; return `<rect x="${x - 18}" y="28" width="36" height="32" rx="8" fill="#152b34" stroke="${i < engine.slots.length ? '#cfcbb1' : '#6b817c'}" stroke-width="1.2"/>${i < engine.slots.length ? screwHead(x, 43, prefix, 10) : `<circle cx="${x}" cy="44" r="5" fill="none" stroke="#65817a77" stroke-dasharray="2 3"/>`}`; }).join('')}
    ${engine.plates.filter(p => !p.fallen || p.id === falling).map(p => `<g class="${p.id === falling ? 'falling-plate' : ''}" style="--angle:${p.angle}deg" transform="translate(${p.x} ${p.y}) rotate(${p.angle})" filter="url(#${prefix}-shadow)">
      <rect x="${-p.width / 2}" y="-22" width="${p.width}" height="60" rx="13" fill="${['#3f627e', '#926b36', '#3f6c5d', '#905145', '#695381', '#486d72'][p.id]}"/>
      <rect x="${-p.width / 2}" y="-30" width="${p.width}" height="60" rx="13" fill="url(#${prefix}-plate-${p.id % metallic.length})" stroke="#e5e7cb55" stroke-width="1.5"/>
      <path d="M${-p.width / 2 + 13}-25h${p.width - 26}" stroke="#ffffe866" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M${-p.width / 2 + 17} 21h${p.width - 34}" stroke="#233e4744" stroke-width="1.4"/>
      <g stroke="#f7f3d514" stroke-width=".6">${Array.from({ length: 6 }, (_, i) => `<path d="M${-p.width / 2 + 15} ${i * 6 - 17}h${p.width - 30}"/>`).join('')}</g>
      <text x="0" y="${p.removed.length === 3 ? 22 : 5}" text-anchor="middle" font-family="system-ui" font-size="${p.removed.length === 3 ? 9 : 13}" font-weight="800" letter-spacing="3" fill="#213c4b55">${String(p.id + 1).padStart(2, '0')}</text>
      ${p.removed.map((removed, end) => { const x = [-.37, .37, 0][end] * p.width; return `<circle cx="${x}" cy="1" r="12" fill="#183241" stroke="#122631" stroke-width="2"/>${removed ? `<circle cx="${x}" r="8" fill="#1c3541" stroke="#718c8b88"/>` : screwHead(x, 0, prefix)}`; }).join('')}
    </g>`).join('')}
    ${engine.status === 'won' ? `<g fill="#e4e6a1"><path d="M216 202l16 16 35-39" fill="none" stroke="#d1e894" stroke-width="7" stroke-linecap="round"/><text x="240" y="252" text-anchor="middle" font-family="system-ui" font-size="18" letter-spacing="2">${t('game.screws.sceneWin')}</text></g>` : ''}
    </svg>${decorative ? '' : engine.plates.filter(p => !p.fallen).map(p => p.removed.map((removed, end) => { if (removed) return ''; const pos = screwPosition(p, end), available = engine.available(p.id, end); return `<button class="screw-target ${highlight?.[0] === p.id && highlight?.[1] === end ? 'hint-glow' : ''}" data-plate="${p.id}" data-end="${end}" style="left:${pos.x / 480 * 100}%;top:${pos.y / 420 * 100}%;z-index:${p.id + 4}" ${available ? '' : 'disabled'} aria-label="${t('game.screws.plateLabel', { n: p.id + 1, end: screwEndLabel(end) })}"></button>`; }).join('')).join('')}
    ${engine.status === 'lost' ? `<div class="scene-result failed-result"><span>${t('game.screws.sceneFail')}</span><small>${t('game.screws.sceneFailHint')}</small></div>` : ''}
  </div>`;
}

export function createRenderer() {
  let host = null;
  let onClick = null;
  let generation = 0, latestEngine = null, latestOptions = {};

  return {
    kind: 'dom',

    mount(nextHost, engine, ctx) {
      this.destroy();
      host = nextHost;
      latestEngine = engine;
      this._prefix = `screw-${Math.random().toString(36).slice(2, 8)}`;
      host.innerHTML = screwBoard(engine, { prefix: this._prefix });
      onClick = event => {
        const button = event.target.closest?.('[data-plate]');
        if (!button || button.disabled) return;
        ctx?.dispatch?.({
          type: 'remove',
          args: [Number(button.dataset.plate), Number(button.dataset.end)],
        });
      };
      host.addEventListener('click', onClick);
    },

    draw(engine, options = {}) {
      latestEngine = engine;
      latestOptions = options;
      if (!host) return;
      const focused = host.ownerDocument?.activeElement;
      const selector = '[data-plate]';
      const buttons = [...host.querySelectorAll(selector)];
      const index = buttons.indexOf(focused);
      host.innerHTML = screwBoard(engine, { prefix: this._prefix, ...options });
      if (index >= 0) {
        const next = [...host.querySelectorAll(selector)];
        const candidate = next[index];
        (candidate && !candidate.disabled ? candidate : next.find((button, i) => i >= index && !button.disabled) ?? next.find(button => !button.disabled))?.focus?.({ preventScroll: true });
      }
    },

    destroy() {
      generation++;
      latestEngine = null;
      latestOptions = {};
      if (host && onClick) host.removeEventListener('click', onClick);
      if (host) host.innerHTML = '';
      host = null;
      onClick = null;
    },
  };
}

export const screwRenderer = createRenderer;
export default createRenderer;
