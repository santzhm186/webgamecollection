import { t as hostT } from '../../src/core/host-surface.js';
import { traceLight, ports, neighbor } from './rules.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const DIRECTIONS = ['north', 'east', 'south', 'west'];
function fitting(cell, lit) {
  const color = lit ? '#dcff9c' : '#6b9c96';
  if (cell.type === 'block') return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M27 32h10m-5-5v10" stroke="#51776c" stroke-width="1.2" opacity=".4"/><circle cx="10" cy="10" r="1.5" fill="#56796b"/><circle cx="54" cy="54" r="1.5" fill="#56796b"/></svg>';
  if (cell.type === 'source' || cell.type === 'beacon') {
    const symbol = cell.type === 'source'
      ? '<rect x="22" y="19" width="20" height="28" rx="5" fill="#d9f77c"/><path d="m35 23-8 12h7l-4 9 10-13h-8z" fill="#214737"/>'
      : '<path d="M24 32a10 10 0 1 1 16 8l-2 5H26l-2-5a10 10 0 0 1 0-8Z" fill="currentColor"/><path d="M28 49h8m-7 4h6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 64 64" aria-hidden="true" style="color:${color}"><path d="M32 32V0" transform="rotate(${cell.rotation * 90} 32 32)" stroke="${color}" stroke-width="7"/><circle cx="32" cy="32" r="23" fill="#193f34" stroke="${color}" stroke-width="1.5"/>${symbol}</svg>`;
  }
  const pipe = cell.type === 'straight' ? 'M32 0V64' : 'M32 0V20Q32 32 44 32H64';
  const cap = cell.type === 'straight' ? '<path d="M26 4h12m-12 56h12"/>' : '<path d="M26 4h12m22 22v12"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><g class="light-path-fitting" style="--turn:${cell.rotation * 90}deg" transform="rotate(${cell.rotation * 90} 32 32)"><path d="${pipe}" fill="none" stroke="#092d29" stroke-width="15"/><path d="${pipe}" fill="none" stroke="${color}" stroke-width="8"/><path d="${pipe}" fill="none" stroke="${lit ? '#f4ffd5' : '#a7c6b3'}" stroke-width="2"/>${lit ? `<path class="light-path-current" d="${pipe}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 12"/>` : ''}<g stroke="#d4bd87" stroke-width="3">${cap}</g></g>${cell.checkpoint ? `<circle cx="32" cy="32" r="9" fill="${lit ? '#e4ffa7' : '#193f34'}" stroke="#d9f77c" stroke-width="2"/><path d="m32 26 5 6-5 6-5-6z" fill="${lit ? '#234936' : '#a4b977'}"/>` : ''}${cell.locked ? '<path d="M48 50h8v8h-8zM50 50v-3a2 2 0 0 1 4 0v3" fill="none" stroke="#b8c9af" stroke-width="1.5"/>' : ''}</svg>`;
}

export default function createRenderer() {
  let host = null, t = hostT, onClick = null, onKey = null, latestEngine = null;
  return {
    kind: 'dom',
    mount(nextHost, engine, ctx = {}) {
      this.destroy(); host = nextHost; t = ctx.t ?? hostT;
      onClick = event => {
        const button = event.target?.closest?.('[data-light-cell]');
        if (!button || !host?.contains(button) || button.disabled) return;
        const index = Number(button.dataset.lightCell);
        if (!Number.isInteger(index) || index < 0 || index >= latestEngine.cells.length) return;
        ctx.dispatch?.({ type: 'rotate', args: [index] });
      };
      onKey = event => {
        const button = event.target?.closest?.('[data-light-cell]');
        const direction = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[event.key];
        if (!button || !host?.contains(button) || direction === undefined) return;
        event.preventDefault(); event.stopPropagation();
        let index = Number(button.dataset.lightCell);
        while ((index = neighbor(index, direction, latestEngine.config.width)) !== -1) {
          const next = host.querySelector(`[data-light-cell="${index}"]`);
          if (next && !next.disabled) { next.focus?.({ preventScroll: true }); break; }
        }
      };
      host.addEventListener('click', onClick); host.addEventListener('keydown', onKey); this.draw(engine);
    },
    draw(engine) {
      if (!host) return;
      latestEngine = engine;
      const activeElement = host.ownerDocument?.activeElement;
      const focused = activeElement && host.contains(activeElement) ? activeElement.dataset?.lightCell : undefined;
      const light = traceLight(engine.config, engine.cells);
      const relays = engine.cells.flatMap((cell, index) => cell.checkpoint ? [index] : []);
      const litRelays = relays.filter(index => light.lit.includes(index)).length;
      const cells = engine.cells.map((cell, index) => {
        const lit = light.lit.includes(index), isHint = engine.highlight === index, endpoint = cell.type === 'source' || cell.type === 'beacon';
        const disabled = engine.status !== 'playing' || cell.locked || cell.type === 'block';
        const shape = t(`game.light-path.${cell.type}`);
        const openings = ports(cell).map(direction => t(`game.light-path.${DIRECTIONS[direction]}`)).join(' / ');
        const label = t('game.light-path.cellLabel', { row: Math.floor(index / engine.config.width) + 1, col: index % engine.config.width + 1, shape, openings, state: t(lit ? 'game.light-path.powered' : 'game.light-path.unpowered') });
        const className = `light-path-cell${lit ? ' is-lit' : ''}${isHint ? ' is-hinted' : ''}${cell.type === 'block' ? ' is-empty' : ''}${endpoint ? ' is-endpoint' : ''}${cell.checkpoint ? ' is-relay' : ''}`;
        return `<button type="button" class="${className}" data-light-cell="${index}" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}">${fitting(cell, lit)}${endpoint ? `<span class="light-path-endpoint-label">${escapeHtml(shape)}</span>` : ''}${isHint ? '<span class="light-path-turn-mark" aria-hidden="true">↻</span>' : ''}</button>`;
      }).join('');
      host.innerHTML = `<section class="light-path-scene${engine.status === 'won' ? ' is-complete' : ''}" aria-label="${escapeHtml(t('game.light-path.sceneLabel'))}">
        <div class="light-path-topline"><span><i aria-hidden="true"></i>${escapeHtml(t('game.light-path.workshop'))}</span><span>${String(engine.level + 1).padStart(2, '0')} / 07</span></div>
        <div class="light-path-mission"><strong>${escapeHtml(t(engine.status === 'won' ? 'game.light-path.complete' : 'game.light-path.mission'))}</strong><span>${escapeHtml(relays.length ? t('game.light-path.relayProgress', { n: litRelays, total: relays.length }) : t('game.light-path.noRelays'))}</span></div>
        <div class="light-path-board" style="--columns:${engine.config.width}">${cells}</div>
        <div class="light-path-legend"><span><i class="light-path-legend-relay" aria-hidden="true">◆</i>${escapeHtml(t('game.light-path.relay'))}</span><span><i aria-hidden="true">↻</i>${escapeHtml(t('game.light-path.turn'))}</span><span><i aria-hidden="true">▣</i>${escapeHtml(t('game.light-path.fixed'))}</span></div>
        <p class="light-path-note">${escapeHtml(t(engine.status === 'ready' ? 'game.light-path.ready' : engine.status === 'won' ? 'game.light-path.completeNote' : engine.moves > engine.target ? 'game.light-path.keepGoing' : 'game.light-path.keyboard'))}</p>
      </section>`;
      if (focused !== undefined && engine.status === 'playing') host.querySelector(`[data-light-cell="${focused}"]`)?.focus?.({ preventScroll: true });
    },
    destroy() {
      if (host) { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.innerHTML = ''; }
      host = onClick = onKey = latestEngine = null; t = hostT;
    },
  };
}
