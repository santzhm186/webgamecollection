import { t as hostT } from '../../src/core/host-surface.js';
import { getAssetSprite } from '../../src/ui/scene/three-models.js';

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ESCAPE[char]);
const DIRECTIONS = ['up', 'left', 'down', 'right'];
const KEY_DIRECTION = Object.freeze({ ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' });
const ARROWS = Object.freeze({ up: '↑', left: '←', down: '↓', right: '→' });
const YAW = Object.freeze({ up: Math.PI, left: -Math.PI / 2, down: 0, right: Math.PI / 2 });

/** Optional raster sprites can be injected by the host with ctx.art.warehouse. */
export function cargoCrate(isDocked = false, sprite = null) {
  if (sprite) return `<ellipse cx="32" cy="51" rx="24" ry="8" fill="#071524" opacity=".45"/>
    ${isDocked ? '<ellipse cx="32" cy="49" rx="25" ry="11" fill="none" stroke="#a8ffe1" stroke-width="2" opacity=".8"/>' : ''}
    <image href="${escapeHtml(sprite)}" x="-8" y="-13" width="80" height="80"/>`;
  const light = isDocked ? '#a8ffe1' : '#ffe9ad';
  const main = isDocked ? '#4daf94' : '#d5a04d';
  return `<ellipse cx="33" cy="53" rx="25" ry="8" fill="#071524" opacity=".5"/>
    <rect x="11" y="15" width="43" height="39" rx="7" fill="${isDocked ? '#267762' : '#8d632a'}"/>
    <rect x="10" y="8" width="43" height="39" rx="6" fill="${main}" stroke="${light}" stroke-width="1.4"/>
    <path d="M17 9v37M46 9v37M11 17h41M11 38h41" stroke="${light}" stroke-width="3" opacity=".55"/>
    <rect x="24" y="21" width="15" height="12" rx="3" fill="#243c41"/><path d="M29 27h6m-3-3v6" stroke="${light}" stroke-width="2"/>
    <path d="M17 50h28" stroke="${light}" stroke-width="2" opacity=".35"/>`;
}

export function cargoBot(direction = 'up', sprite = null) {
  if (sprite) return `<ellipse cx="32" cy="53" rx="22" ry="7" fill="#071524" opacity=".6"/>
    <image href="${escapeHtml(sprite)}" x="-8" y="-12" width="80" height="80"/>`;
  const offset = direction === 'left' ? -3 : direction === 'right' ? 3 : 0;
  return `<ellipse cx="33" cy="55" rx="24" ry="7" fill="#071524" opacity=".65"/>
    <rect x="11" y="32" width="9" height="20" rx="4" fill="#1d3544"/><rect x="44" y="32" width="9" height="20" rx="4" fill="#1d3544"/>
    <path d="M14 37v10m34-10v10" stroke="#5f8491" stroke-width="2"/>
    <rect x="17" y="23" width="31" height="29" rx="9" fill="#2a9d8d" stroke="#78e3c9" stroke-width="1.5"/>
    <rect x="20" y="35" width="25" height="12" rx="5" fill="#66d9ba"/>
    <circle cx="32" cy="42" r="3.5" fill="#e9ffe0"/>
    <path d="M32 12V6" stroke="#95ffe0" stroke-width="2"/><circle cx="32" cy="5" r="3" fill="#ffd784"/>
    <rect x="14" y="12" width="37" height="25" rx="11" fill="#a5f4da" stroke="#e5fff1" stroke-width="1.5"/>
    <rect x="18" y="18" width="29" height="13" rx="6" fill="#153b43"/>
    <g fill="#9dffee"><rect x="${24 + offset}" y="21" width="4" height="6" rx="2"/><rect x="${36 + offset}" y="21" width="4" height="6" rx="2"/></g>
    <path d="M20 15h10" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/>`;
}

function dock(isDocked) {
  return `<rect x="10" y="11" width="44" height="42" rx="12" fill="${isDocked ? '#65e5b5' : '#45bca2'}" opacity=".12"/>
    <rect x="14" y="15" width="36" height="34" rx="9" fill="none" stroke="#78e9c5" stroke-width="2" stroke-dasharray="6 4"/>
    <path d="M27 32h10m-5-5v10" stroke="#9bf6d5" stroke-width="2.5" stroke-linecap="round"/>`;
}

function wall(index) {
  return `<rect x="1" y="10" width="62" height="51" rx="7" fill="#122736"/>
    <rect x="1" y="2" width="62" height="48" rx="7" fill="#304f5c" stroke="#4d6b75"/>
    <path d="M8 10h48M9 43h46" stroke="#64838b" stroke-width="1.4" opacity=".55"/>
    <rect x="${index % 2 ? 11 : 40}" y="19" width="13" height="3" rx="1.5" fill="#102d3a"/>
    ${index % 3 === 0 ? '<rect x="25" y="29" width="14" height="3" rx="1.5" fill="#75ceb6" opacity=".55"/>' : ''}`;
}

function boardMarkup(engine, images, t) {
  const { width, height, walls, goals } = engine.board;
  const tiles = Array.from({ length: width * height }, (_, index) => {
    const x = index % width * 64, y = Math.floor(index / width) * 64;
    const isWall = walls.includes(index), isDock = goals.includes(index), isBox = engine.boxes.includes(index);
    return `<g transform="translate(${x} ${y})">
      ${isWall ? wall(index) : `<rect x="1" y="1" width="62" height="62" rx="5" fill="${(index + Math.floor(index / width)) % 2 ? '#1c3745' : '#203d4a'}" stroke="#385561" stroke-width=".8"/>
      <path d="M7 13V7h6m38 0h6v6M7 51v6h6m38 0h6v-6" fill="none" stroke="#64808b" stroke-width="1" opacity=".4"/>
      ${isDock ? dock(isBox) : ''}${isBox ? cargoCrate(isDock, isDock ? images.dockedCrate ?? images.crate : images.crate) : ''}
      ${engine.player === index ? cargoBot(engine.direction, images.bot ?? images.botDirections?.[engine.direction]) : ''}`}
    </g>`;
  }).join('');
  return `<svg class="warehouse-board" viewBox="-4 -4 ${width * 64 + 8} ${height * 64 + 12}" role="img" aria-label="${escapeHtml(t('game.warehouse.sceneLabel'))}">
    <title>${escapeHtml(t('game.warehouse.sceneLabel'))}</title>${tiles}</svg>`;
}

export default function createRenderer({ loadSprite = getAssetSprite } = {}) {
  let host = null, keyTarget = null, onClick = null, onKey = null;
  let t = hostT, images = {};
  let latestEngine = null, generation = 0;
  return {
    kind: 'dom',
    mount(nextHost, engine, ctx = {}) {
      this.destroy();
      host = nextHost;
      keyTarget = host.ownerDocument ?? globalThis.document ?? host;
      t = typeof ctx.t === 'function' ? ctx.t : hostT;
      images = { ...ctx.art?.warehouse, botDirections: { ...ctx.art?.warehouse?.botDirections } };
      onClick = event => {
        const button = event.target?.closest?.('[data-warehouse-move]');
        if (!button || !host?.contains(button) || button.disabled) return;
        const direction = button.dataset.warehouseMove;
        if (DIRECTIONS.includes(direction)) ctx.dispatch?.({ type: 'move', args: [direction] });
      };
      onKey = event => {
        if (!host || host.dataset.warehousePlaying !== 'true' || event.altKey || event.ctrlKey || event.metaKey) return;
        const tag = event.target?.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target?.closest?.('[contenteditable="true"]')) return;
        const direction = KEY_DIRECTION[event.key];
        if (!direction) return;
        event.preventDefault();
        ctx.dispatch?.({ type: 'move', args: [direction] });
      };
      host.addEventListener('click', onClick);
      keyTarget.addEventListener('keydown', onKey);
      this.draw(engine);
      const mountedGeneration = generation;
      const jobs = [];
      const load = (id, color, yaw, apply) => {
        jobs.push(Promise.resolve().then(() => loadSprite(id, color, 128, yaw)).then(image => {
          if (!host || generation !== mountedGeneration || !image?.src) return;
          apply(image.src);
        }).catch(() => {}));
      };
      if (!images.bot) for (const direction of DIRECTIONS) {
        if (!images.botDirections[direction]) load('cargo-bot', undefined, YAW[direction], src => { images.botDirections[direction] = src; });
      }
      if (!images.crate) load('cargo-crate', undefined, 0, src => { images.crate = src; });
      if (jobs.length) Promise.all(jobs).then(() => {
        if (host && generation === mountedGeneration && latestEngine) this.draw(latestEngine);
      });
    },
    draw(engine) {
      if (!host) return;
      latestEngine = engine;
      const focusDirection = host.contains(keyTarget.activeElement) ? keyTarget.activeElement?.dataset.warehouseMove : null;
      host.dataset.warehousePlaying = String(engine.status === 'playing');
      host.innerHTML = `<section class="warehouse-scene${engine.deadlocked ? ' is-blocked' : ''}">
        <div class="warehouse-topline"><span class="warehouse-sector"><i></i>${escapeHtml(t('game.warehouse.sector', { n: String(engine.level + 1).padStart(2, '0') }))}</span><span class="warehouse-deliveries">${engine.docked}<span> / ${engine.boxes.length}</span></span></div>
        <div class="warehouse-grid-frame">${boardMarkup(engine, images, t)}</div>
        <div class="warehouse-console">
          <div class="warehouse-key-guide"><span class="warehouse-guide-icon">⌘</span><span>${escapeHtml(t('game.warehouse.controls'))}</span></div>
          <div class="warehouse-pad" role="group" aria-label="${escapeHtml(t('game.warehouse.padLabel'))}">
            ${DIRECTIONS.map(direction => `<button type="button" class="warehouse-direction warehouse-${direction}${engine.hintDirection === direction ? ' is-hinted' : ''}" data-warehouse-move="${direction}" aria-label="${escapeHtml(t('game.warehouse.moveLabel', { direction: t(`game.warehouse.${direction}`) }))}" ${engine.status !== 'playing' ? 'disabled' : ''}>${ARROWS[direction]}</button>`).join('')}
          </div>
          <div class="warehouse-legend"><span><i class="warehouse-dot dock"></i>${escapeHtml(t('game.warehouse.dockLabel'))}</span><span><i class="warehouse-dot cargo"></i>${escapeHtml(t('game.warehouse.cargoLabel'))}</span></div>
        </div>
      </section>`;
      if (focusDirection) host.querySelector(`[data-warehouse-move="${focusDirection}"]`)?.focus?.({ preventScroll: true });
    },
    destroy() {
      generation++;
      if (host && onClick) host.removeEventListener('click', onClick);
      if (keyTarget && onKey) keyTarget.removeEventListener('keydown', onKey);
      if (host) {
        host.innerHTML = '';
        delete host.dataset.warehousePlaying;
      }
      host = null;
      keyTarget = null;
      onClick = null;
      onKey = null;
      t = hostT;
      images = {};
      latestEngine = null;
    },
  };
}
