/**
 * 拉针救人 · 渲染器（DOM，kind: 'dom'）
 * ============================================================================
 * 纯点击驱动：由宿主派发动作，无内部可变状态。
 */
import { PIN_POINTS, pinLabel } from './dictionary.js';
import { t } from '../../src/core/host-surface.js';
import { getSoldierSprite, getCoinSprite } from '../../src/ui/scene/three-models.js';

let pinExplorerSrc = null;
let pinCoinSrc = null;
let pinSprites = null;

function loadPinSprites() {
  return pinSprites ||= Promise.all([getSoldierSprite('#e7b970'), getCoinSprite()]).then(([explorer, coin]) => {
    pinExplorerSrc = explorer?.src ?? null;
    pinCoinSrc = coin?.src ?? null;
  });
}

function defs(prefix) {
  return `<defs>
    <linearGradient id="${prefix}-jungle" x2="0" y2="1"><stop stop-color="#1c4a43"/><stop offset="1" stop-color="#102c30"/></linearGradient>
    <linearGradient id="${prefix}-stone" x2=".8" y2="1"><stop stop-color="#dccb9a"/><stop offset=".5" stop-color="#b89e70"/><stop offset="1" stop-color="#897554"/></linearGradient>
    <linearGradient id="${prefix}-room" x2="0" y2="1"><stop stop-color="#1c3539"/><stop offset="1" stop-color="#375052"/></linearGradient>
    <linearGradient id="${prefix}-water" x2="0" y2="1"><stop stop-color="#78e6ea"/><stop offset=".4" stop-color="#39a9c9"/><stop offset="1" stop-color="#217b9d"/></linearGradient>
    <linearGradient id="${prefix}-lava" x2="0" y2="1"><stop stop-color="#ffdc7b"/><stop offset=".3" stop-color="#ff9855"/><stop offset="1" stop-color="#bb4850"/></linearGradient>
    <linearGradient id="${prefix}-gold" x2=".3" y2="1"><stop stop-color="#fff4b0"/><stop offset=".45" stop-color="#e7b94f"/><stop offset="1" stop-color="#9f7027"/></linearGradient>
    <filter id="${prefix}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0c1d22" flood-opacity=".4"/></filter>
  </defs>`;
}

function explorer(x, y, won, lost) {
  if (pinExplorerSrc) {
    return `<g class="explorer ${won ? 'explorer-happy' : ''}" transform="translate(${x} ${y})"><image x="-32" y="-45" width="64" height="64" href="${pinExplorerSrc}"/></g>`;
  }
  return `<g class="explorer ${won ? 'explorer-happy' : ''}" transform="translate(${x} ${y})">
    <ellipse cy="25" rx="19" ry="5" fill="#051e2455"/>
    <path d="M-7 11l-4 14m18-14 4 14" stroke="#324f57" stroke-width="7" stroke-linecap="round"/>
    <rect x="-14" y="-7" width="28" height="23" rx="8" fill="#daac64"/>
    <path d="M-7-5v19m14-19v19" stroke="#967446" stroke-width="3"/><rect x="-6" y="2" width="12" height="9" rx="2" fill="#6b7153"/>
    <path d="M-14-2l-${won ? 12 : 5} -${won ? 13 : -8}m33-${won ? 5 : 8} 8-${won ? 10 : -2}" stroke="#e0b88b" stroke-width="6" stroke-linecap="round"/>
    <circle cy="-19" r="12" fill="#e3bd90"/><path d="M-15-23q1-17 24-7l5 10z" fill="#c8a56b"/><path d="M-18-21h34" stroke="#8b734a" stroke-width="5" stroke-linecap="round"/>
    ${lost ? '<path d="M-7-20l5 5m0-5-5 5m9-5 5 5m0-5-5 5" stroke="#51443b" stroke-width="2"/>' : '<path d="M-6-18h2m8 0h2" stroke="#51443b" stroke-width="3" stroke-linecap="round"/>'}
    <path d="M-3-12q3 ${won ? 5 : 1} 6 0" fill="none" stroke="#8a5d4a" stroke-width="1.6"/>
  </g>`;
}

function gem(x, y, prefix, size = 1) {
  if (pinCoinSrc) {
    return `<g transform="translate(${x} ${y}) scale(${size})"><image x="-32" y="-32" width="64" height="64" href="${pinCoinSrc}"/></g>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M-10-5-5-12H5L10-5 0 8z" fill="url(#${prefix}-gold)" stroke="#ffec9699"/><path d="M-10-5H10M-5-12 0 8 5-12M0-12v7" fill="none" stroke="#fff2ab99" stroke-width=".8"/></g>`;
}

function foliage() {
  return `<g fill="#2b6553" opacity=".75">${[0, 1, 2, 3, 4].map(i => `<path d="M${10 + i * 7} ${20 + i * 22}q-${28 - i} -27 3-39 17 27-3 39M${466 - i * 6} ${50 + i * 24}q30-33 0-43-19 27 0 43"/>`).join('')}</g><path d="M13 0q-12 73 25 100m422-100q25 90-12 154" fill="none" stroke="#456f4b" stroke-width="4"/>`;
}

export function pinBoard(engine, { prefix = 'pin-main', decorative = false, highlight = null } = {}) {
  const hot = engine.hot, drained = engine.drained, won = engine.status === 'won', lost = engine.status === 'lost';
  const water = !engine.removed.has('water');
  const chapter = Math.floor((engine.level || 0) / 2);
  const chamber = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#0c2229"/><rect x="${x + 3}" y="${y + 4}" width="${w - 6}" height="${h - 6}" rx="7" fill="url(#${prefix}-room)" stroke="#e1cb9133"/>`;

  return `<div class="scene temple-scene ${lost ? 'scene-failed' : ''}"><svg viewBox="0 0 480 420" aria-hidden="true">${defs(prefix)}
    <rect width="480" height="420" fill="url(#${prefix}-jungle)"/><rect width="480" height="420" fill="${['#285b45', '#3e486e', '#735242', '#31626b'][chapter % 4]}" opacity=".3"/>${foliage()}
    <ellipse cx="240" cy="400" rx="191" ry="15" fill="#061e2477"/>
    <g filter="url(#${prefix}-shadow)"><path d="M31 42 55 18H421L449 42V389H31z" fill="#716546"/><rect x="38" y="35" width="404" height="349" rx="12" fill="url(#${prefix}-stone)"/><path d="M53 37H425M40 70V364" fill="none" stroke="#ead9a6" stroke-width="4" opacity=".5"/>
    <path d="M36 85h21m-21 77h21m-21 79h21m-21 78h21m365-236h22m-22 79h22m-22 79h22m-22 78h22" stroke="#665e4455" stroke-width="3"/>
    ${chamber(56, 56, 153, 84)}${chamber(56, 174, 153, 86)}${chamber(56, 294, 153, 69)}${chamber(260, 56, 154, 84)}${chamber(260, 174, 154, 86)}${chamber(260, 294, 154, 69)}
    <path d="M337 148v11H218l-23 20M208 267v13h51M209 329h52" fill="none" stroke="#655a3d" stroke-width="13" stroke-linejoin="round"/>
    <path d="M337 148v11H218l-23 20M208 267v13h51M209 329h52" fill="none" stroke="#d3bd83" stroke-width="6" stroke-linejoin="round"/>
    <path d="M237 154l-9 5 9 5m-4 111 9 5-9 5" fill="none" stroke="#9a884f" stroke-width="2"/>
    ${water ? `<path d="M60 79q13-5 26 0t26 0t26 0t26 0t26 0t15 0v57H60z" fill="url(#${prefix}-water)"/><path class="water-ripple" d="M64 82q14-5 28 0t28 0t28 0t28 0t26 0" fill="none" stroke="#b5f5ed" stroke-width="2"/><g fill="#b1f4ea88"><circle cx="93" cy="109" r="3"/><circle cx="178" cy="120" r="2"/><circle cx="157" cy="96" r="2"/></g>` : `<path d="M126 141v41m10-41v41m-5-42v44" fill="none" stroke="#65d6dd" stroke-width="4" class="water-stream"/><path d="M85 79q40-12 95 0" fill="none" stroke="#5b879077" stroke-width="2"/>`}
    ${!drained ? hot ? `<path d="M60 197q17-7 30 0t30 0t30 0t30 0t25 0v59H60z" fill="url(#${prefix}-lava)"/><path d="M62 251l9-23 13 12 10-29 17 20 15-23 15 24 14-19 14 29 18-22 18 29z" fill="#ffd675" opacity=".8"/><g class="lava-sparks" fill="#ffe49a"><circle cx="88" cy="186" r="2"/><circle cx="161" cy="182" r="3"/><circle cx="185" cy="202" r="2"/></g>` : `<g fill="#8a9c93" stroke="#546c68" stroke-width="2"><path d="M62 217l24-20 35 10 8 34-18 16H63z"/><path d="M119 212l28-21 31 11 24 32v23h-82z"/><path d="M82 229l24 8m36-21 18 19 25-10" fill="none" stroke="#bdccac"/></g>` : '<text x="132" y="226" text-anchor="middle" font-size="11" fill="#8baf9f" letter-spacing="2">' + t('game.pins.canvasEmpty') + '</text>'}
    ${engine.spider ? `<g class="temple-spider" transform="translate(336 101)"><path d="M-8-4l-16-11-7 6m23 7-25 4-3 9m27-7-16 16 2 9M8-4l16-11 7 6M8-2l25 4 3 9M9 4l16 16-2 9" fill="none" stroke="#242332" stroke-width="5" stroke-linecap="round"/><ellipse rx="15" ry="12" fill="#383344"/><ellipse cy="-12" rx="10" ry="8" fill="#4b3d50"/><circle cx="-4" cy="-14" r="2" fill="#f5b76b"/><circle cx="4" cy="-14" r="2" fill="#f5b76b"/></g>` : engine.config.spider ? '<path d="M326 105l8 7 14-19" stroke="#82b890" stroke-width="4" fill="none"/>' : `<g fill="#8aa08255"><path d="M308 95l20-13 30 8 9 28h-62z"/><path d="M324 86l4 13 20-5" fill="none" stroke="#b6c8a355" stroke-width="2"/></g>`}
    ${engine.gas ? `<g class="gas-cloud" fill="#c4a9cf" opacity=".65"><ellipse cx="309" cy="76" rx="27" ry="13"/><ellipse cx="345" cy="67" rx="35" ry="15"/><ellipse cx="378" cy="83" rx="25" ry="12"/></g>` : ''}
    <path d="M315 56V40h45v16" fill="none" stroke="#857750" stroke-width="9"/>
    ${!engine.removed.has('treasure') ? Array.from({ length: 8 }, (_, i) => gem(286 + i % 4 * 33, 211 + Math.floor(i / 4) * 24, prefix, .9)).join('') : ''}
    <path d="M269 357h134" stroke="#ac9a69" stroke-width="8"/>
    ${engine.config.bridge ? engine.bridge ? `<g fill="#b59f70" stroke="#5c624e"><path d="M209 321h52v14h-52z"/><path d="M219 322v12m12-12v12m12-12v12m12-12v12" stroke-width="2"/></g>` : '<path d="M211 324v13h47v-13" fill="#102a31"/>' : ''}
    ${drained ? '<g fill="#748a7e"><path d="M65 346l18-23 20 12 15-17 27 18 23-9 29 22v10H65z"/></g>' : '<path d="M65 344h133" stroke="#718a7c44" stroke-width="2"/>'}
    ${explorer(337, 335, won, lost)}${won ? gem(292, 340, prefix, .8) + gem(382, 334, prefix, 1) : ''}
    <g fill="#dbca97" font-family="system-ui" font-size="8" letter-spacing="1.5" opacity=".7"><text x="132" y="72" text-anchor="middle">${t('game.pins.canvasWater')}</text><text x="132" y="190" text-anchor="middle">${t(hot ? 'game.pins.canvasLava' : 'game.pins.canvasStone')}</text><text x="337" y="190" text-anchor="middle">${t('game.pins.canvasTreasure')}</text></g>
    </g>
    ${engine.config.ventBlockedBySpider && engine.spider ? `<path d="M315 43h45m-43-5 40 15m-34-18 23 19" stroke="#d5cbdc" stroke-width="1.5" opacity=".85"/>` : ''}
    ${engine.config.bridgeBeforeDrain ? `<path d="M222 350v-12m25 12v-12M218 349h34" stroke="#74dbd7" stroke-width="4"/>` : ''}
    ${decorative ? engine.config.pins.map(pin => { const p = PIN_POINTS[pin]; return `<g transform="translate(${p.x} ${p.y})"><rect y="-4" width="${p.width - 14}" height="8" rx="3" fill="url(#${prefix}-gold)" stroke="#8e6e34"/><circle cx="${p.width - 14}" r="12" fill="url(#${prefix}-gold)" stroke="#8e6e34" stroke-width="3"/><circle cx="${p.width - 14}" r="5" fill="#4b5541"/></g>`; }).join('') : ''}
    ${won ? '<g fill="#f1d77f"><path d="M101 47l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM409 283l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>' : ''}
    </svg>${decorative ? '' : [...engine.config.pins].sort((a, b) => PIN_POINTS[a].y - PIN_POINTS[b].y || PIN_POINTS[a].x - PIN_POINTS[b].x).map(pin => { const p = PIN_POINTS[pin], removed = engine.removed.has(pin); return `<button class="temple-pin ${removed ? 'pin-pulled' : ''} ${highlight === pin ? 'hint-glow' : ''}" data-pin="${pin}" style="left:${p.x / 480 * 100}%;top:${p.y / 420 * 100}%;width:${p.width / 480 * 100}%" ${removed || engine.status !== 'playing' ? 'disabled' : ''} aria-label="${pinLabel(pin)}"><b>${pinLabel(pin)}</b><span class="pin-ring">↗</span></button>`; }).join('')}
    ${lost ? `<div class="scene-result failed-result"><span>${t('game.pins.sceneFail')}</span><small>${t('game.pins.sceneFailHint')}</small></div>` : ''}
    ${won ? `<div class="scene-result success-result"><span>${t('game.pins.sceneWin')}</span><small>${t('game.pins.sceneWinHint')}</small></div>` : ''}
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
      const token = ++generation;
      loadPinSprites().then(() => {
        if (host && token === generation && latestEngine) this.draw(latestEngine, latestOptions);
      }).catch(() => {});
      this._prefix = `pin-${Math.random().toString(36).slice(2, 8)}`;
      host.innerHTML = pinBoard(engine, { prefix: this._prefix });
      onClick = event => {
        const button = event.target.closest?.('[data-pin]');
        if (!button || button.disabled) return;
        ctx?.dispatch?.({
          type: 'pull',
          args: [button.dataset.pin],
        });
      };
      host.addEventListener('click', onClick);
    },

    draw(engine, options = {}) {
      latestEngine = engine;
      latestOptions = options;
      if (!host) return;
      const focused = host.ownerDocument?.activeElement;
      const buttons = [...host.querySelectorAll('[data-pin]')];
      const index = buttons.indexOf(focused);
      host.innerHTML = pinBoard(engine, { prefix: this._prefix, ...options });
      if (index >= 0) {
        const next = [...host.querySelectorAll('[data-pin]')];
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

export const pinRenderer = createRenderer;
export default createRenderer;
