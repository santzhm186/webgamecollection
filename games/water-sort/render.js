import { t as hostT } from '../../src/core/host-surface.js';

const COLORS = ['#ff8779', '#60d4ee', '#f3c66b', '#b9a0f7', '#85ddbb'];
const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function colorMark(color, y) {
  const marks = [
    `<circle cx="55" cy="${y}" r="4"/>`,
    `<path d="M49 ${y}h12" stroke="currentColor" stroke-width="3"/>`,
    `<path d="M55 ${y - 6}l6 6-6 6-6-6Z"/>`,
    `<path d="M55 ${y - 6}l6 11H49Z"/>`,
    `<path d="M49 ${y}h12m-6-6v12" stroke="currentColor" stroke-width="3"/>`,
  ];
  return `<g fill="currentColor" opacity=".6">${marks[color]}</g>`;
}

function tubeArt(tube, index, completed) {
  const prefix = `water-tube-${index}`;
  const fluid = tube.map((color, layer) => {
    const y = 216 - (layer + 1) * 42;
    return `<g style="color:#193344"><rect x="27" y="${y}" width="56" height="43" fill="url(#${prefix}-color-${color})"/><path d="M28 ${y}h54" stroke="white" stroke-opacity=".25"/>${colorMark(color, y + 21)}</g>`;
  }).join('');
  return `<svg viewBox="0 0 110 250" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${prefix}-glass" x1="0" x2="1"><stop stop-color="#c9f8ff" stop-opacity=".28"/><stop offset=".35" stop-color="#b3eafa" stop-opacity=".03"/><stop offset=".8" stop-color="#b3eafa" stop-opacity=".08"/><stop offset="1" stop-color="#c9f8ff" stop-opacity=".35"/></linearGradient>
      ${COLORS.map((color, i) => `<linearGradient id="${prefix}-color-${i}"><stop stop-color="${color}" stop-opacity=".65"/><stop offset=".32" stop-color="${color}"/><stop offset=".8" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".72"/></linearGradient>`).join('')}
      <clipPath id="${prefix}-inside"><path d="M27 39H83V190Q83 219 55 219Q27 219 27 190Z"/></clipPath>
    </defs>
    <ellipse cx="55" cy="237" rx="34" ry="7" fill="#071723" opacity=".7"/>
    <path d="M23 28H87V190Q87 226 55 226Q23 226 23 190Z" fill="url(#${prefix}-glass)" stroke="#c8f0f0" stroke-opacity=".48" stroke-width="2"/>
    <g clip-path="url(#${prefix}-inside)">${fluid}${tube.length ? `<ellipse cx="55" cy="${216 - tube.length * 42}" rx="28" ry="5" fill="${COLORS[tube.at(-1)]}" stroke="white" stroke-opacity=".25"/>` : '<path d="M43 188h24m-12-12v24" stroke="#c4e6e5" stroke-opacity=".32" stroke-width="2"/>'}</g>
    <path d="M30 43v140q0 25 15 29" fill="none" stroke="white" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
    <path d="M80 42v149" fill="none" stroke="white" stroke-opacity=".16" stroke-width="2"/>
    <rect x="19" y="23" width="72" height="12" rx="6" fill="#d7f6fb" fill-opacity=".12" stroke="#c4e6e5" stroke-opacity=".55" stroke-width="2"/>
    <path d="M26 25h57" stroke="white" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
    ${completed ? '<circle cx="55" cy="14" r="11" fill="#9be6c0"/><path d="m50 14 3 3 6-6" fill="none" stroke="#163c38" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' : ''}
  </svg>`;
}

export default function createRenderer() {
  let host = null;
  let onPick = null;
  let t = hostT;
  return {
    kind: 'dom',
    mount(nextHost, engine, ctx = {}) {
      this.destroy();
      host = nextHost;
      t = ctx.t ?? hostT;
      onPick = event => {
        const button = event.target?.closest?.('[data-water-tube]');
        if (!button || !host?.contains(button) || button.disabled) return;
        const index = Number(button.dataset.waterTube);
        if (!Number.isInteger(index) || index < 0 || index >= Number(button.dataset.tubeCount)) return;
        ctx.dispatch?.({ type: 'pick', args: [index] });
      };
      host.addEventListener('click', onPick);
      this.draw(engine);
    },
    draw(engine) {
      if (!host) return;
      const activeElement = host.ownerDocument?.activeElement;
      const focusIndex = activeElement && host.contains(activeElement) ? activeElement.dataset?.waterTube : undefined;
      const tubes = engine.tubes.map((tube, index) => {
        const completed = tube.length === engine.config.capacity && tube.every(color => color === tube[0]);
        const selected = engine.selected === index;
        const source = engine.highlight?.[0] === index;
        const destination = engine.highlight?.[1] === index;
        const colors = tube.length ? [...tube].reverse().map(color => t(`game.water-sort.color${color}`)).join(' / ') : t('game.water-sort.tubeEmpty');
        const stateKey = selected ? 'selected' : source ? 'source' : destination ? 'destination' : completed ? 'sorted' : null;
        const label = t('game.water-sort.tubeLabel', { n: index + 1, colors });
        return `<button type="button" class="water-sort-tube${selected ? ' is-selected' : ''}${source || destination ? ' is-hinted' : ''}${completed ? ' is-complete' : ''}" data-water-tube="${index}" data-tube-count="${engine.tubes.length}" aria-pressed="${selected}" aria-label="${escapeHtml(label)}" ${engine.status !== 'playing' ? 'disabled' : ''}>
          ${tubeArt(tube, index, completed)}
          <span class="water-sort-tube-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="water-sort-tube-state">${stateKey ? escapeHtml(t(`game.water-sort.${stateKey}`)) : '&nbsp;'}</span>
        </button>`;
      }).join('');
      host.innerHTML = `<div class="water-sort-scene" role="group" aria-label="${escapeHtml(t('game.water-sort.sceneLabel'))}">
        <div class="water-sort-heading"><span class="water-sort-lab-label"><i aria-hidden="true"></i>${escapeHtml(t('game.water-sort.labLabel'))}</span><span class="water-sort-lab-detail">${escapeHtml(t('game.water-sort.labDetail'))}</span></div>
        <div class="water-sort-tubes">${tubes}</div>
        <div class="water-sort-target"><span aria-hidden="true">✦</span>${escapeHtml(t('game.water-sort.target', { n: engine.config.steps }))}</div>
      </div>`;
      if (focusIndex !== undefined) host.querySelector?.(`[data-water-tube="${focusIndex}"]`)?.focus?.({ preventScroll: true });
    },
    destroy() {
      if (host && onPick) host.removeEventListener('click', onPick);
      if (host) host.innerHTML = '';
      host = null;
      onPick = null;
      t = hostT;
    },
  };
}
