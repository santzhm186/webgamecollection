// 游戏私有词汇与几何一律从游戏侧取：这是"渲染层不反向依赖规则层"的修正。
// 之前是 import { PIN_LABELS, screwPosition } from './engine.mjs'，
// 造成 boards（渲染）→ engine（规则）的反向依赖，也让宿主认识了 pins 的机关名。
import { PIN_POINTS, pinLabel } from './games/pins/dictionary.js';
import { screwPosition, screwEndLabel } from './games/screws/dictionary.js';
import { t } from './src/core/i18n.js';
import { getSoldierSprite, getCoinSprite } from './src/ui/scene/three-models.js';

let pinExplorerSrc = null;
let pinCoinSrc = null;

let pinSprites = null;
function loadPinSprites() {
  return pinSprites ||= Promise.all([getSoldierSprite('#e7b970'), getCoinSprite()]).then(([explorer, coin]) => {
    pinExplorerSrc = explorer?.src ?? null;
    pinCoinSrc = coin?.src ?? null;
  });
}

/**
 * 兼容再导出：PIN_POINTS 已移到 games/pins/dictionary.js（游戏私有布局）。
 * 保留此处转发是为了不让调用方在本轮受影响；P3/P4 拆分后移除，
 * 届时 app.mjs 应直接从 games/pins/dictionary.js 取。
 */
export { PIN_POINTS };

/**
 * DOM 类渲染器（kind: 'dom'）—— 拉针与拧螺丝的共用实现。
 * ============================================================================
 * 与 Canvas 渲染器的差别：这类玩法由**点击驱动**，不需要逐帧重画，
 * 所以 draw() 只在状态变化时被宿主调用（manifest.timeDriven = false）。
 *
 * 交互约定：渲染器不判定规则，只把"玩家点了哪个目标"回报给宿主：
 *   ctx.dispatch({ type, payload })
 * 是否合法、是否计分、是否失败，全部由引擎决定（与既有实现一致）。
 *
 * 兼容说明：本文件同时保留 pinBoard()/screwBoard() 纯函数导出 ——
 * 首页缩略图与 T6 冒烟测试都直接调用它们，不需要渲染器实例。
 *
 * @typedef {import('./src/core/contracts.js').GameRenderer} GameRenderer
 */

/**
 * @param {object} options
 * @param {(engine: object, options: object) => string} options.build   场景建造函数
 * @param {'pin'|'screw'} options.target                                命中区类型（决定选择器与事件属性）
 * @param {string} options.prefix                                       SVG defs 前缀，避免多实例 id 冲突
 * @returns {() => GameRenderer}
 */
function createBoardRenderer({ build, target, prefix }) {
  return function createRenderer() {
    /** @type {HTMLElement|null} */
    let host = null;
    /** @type {((event: Event) => void)|null} */
    let onClick = null;
    let generation = 0, latestEngine = null, latestOptions = {};

    return {
      kind: 'dom',

      mount(nextHost, engine, ctx) {
        this.destroy();
        host = nextHost;
        latestEngine = engine;
        const token = ++generation;
        if (target === 'pin') loadPinSprites().then(() => {
          if (host && token === generation && latestEngine) this.draw(latestEngine, latestOptions);
        }).catch(() => {});
        // 每次挂载用新的前缀：同时存在多个场景（如预览 + 对局）时 SVG defs id 不会互相覆盖
        this._prefix = `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
        host.innerHTML = build(engine, { prefix: this._prefix });
        onClick = event => {
          const button = event.target.closest?.(target === 'pin' ? '[data-pin]' : '[data-plate]');
          if (!button || button.disabled) return;
          ctx?.dispatch?.({
            type: target === 'pin' ? 'pull' : 'remove',
            args: target === 'pin'
              ? [button.dataset.pin]
              : [Number(button.dataset.plate), Number(button.dataset.end)],
          });
        };
        host.addEventListener('click', onClick);
      },

      draw(engine, options = {}) {
        latestEngine = engine; latestOptions = options;
        if (!host) return;
        host.innerHTML = build(engine, { prefix: this._prefix, ...options });
      },

      /** 必须解绑：宿主会在切换关卡/关闭游戏时调用 */
      destroy() {
        generation++; latestEngine = null; latestOptions = {};
        if (host && onClick) host.removeEventListener('click', onClick);
        if (host) host.innerHTML = '';
        host = null;
        onClick = null;
      },
    };
  };
}

/** 拉针救人的渲染器工厂 */
export const pinRenderer = createBoardRenderer({ build: pinBoard, target: 'pin', prefix: 'pin' });
/** 拧螺丝的渲染器工厂 */
export const screwRenderer = createBoardRenderer({ build: screwBoard, target: 'screw', prefix: 'screw' });

export const metallic = ['#93b5d2', '#e8b76d', '#88b2a1', '#d98f7a', '#b29bcf', '#a6c4c5', '#e5a4af', '#c1cf82'];
function defs(prefix) {
  return `<defs>
    <linearGradient id="${prefix}-jungle" x2="0" y2="1"><stop stop-color="#1c4a43"/><stop offset="1" stop-color="#102c30"/></linearGradient>
    <linearGradient id="${prefix}-stone" x2=".8" y2="1"><stop stop-color="#dccb9a"/><stop offset=".5" stop-color="#b89e70"/><stop offset="1" stop-color="#897554"/></linearGradient>
    <linearGradient id="${prefix}-room" x2="0" y2="1"><stop stop-color="#1c3539"/><stop offset="1" stop-color="#375052"/></linearGradient>
    <linearGradient id="${prefix}-water" x2="0" y2="1"><stop stop-color="#78e6ea"/><stop offset=".4" stop-color="#39a9c9"/><stop offset="1" stop-color="#217b9d"/></linearGradient>
    <linearGradient id="${prefix}-lava" x2="0" y2="1"><stop stop-color="#ffdc7b"/><stop offset=".3" stop-color="#ff9855"/><stop offset="1" stop-color="#bb4850"/></linearGradient>
    <linearGradient id="${prefix}-gold" x2=".3" y2="1"><stop stop-color="#fff4b0"/><stop offset=".45" stop-color="#e7b94f"/><stop offset="1" stop-color="#9f7027"/></linearGradient>
    <radialGradient id="${prefix}-screw" cx=".3" cy=".2"><stop stop-color="#f8f7e8"/><stop offset=".45" stop-color="#c3ced0"/><stop offset=".85" stop-color="#7c8f9c"/><stop offset="1" stop-color="#ced9d5"/></radialGradient>
    <linearGradient id="${prefix}-wood" x2=".8" y2="1"><stop stop-color="#e0b67e"/><stop offset=".55" stop-color="#bd8d5e"/><stop offset="1" stop-color="#9c7050"/></linearGradient>
    <linearGradient id="${prefix}-rubber" x2=".6" y2="1"><stop stop-color="#354c55"/><stop offset="1" stop-color="#24333e"/></linearGradient>
    <pattern id="${prefix}-grain" width="90" height="45" patternUnits="userSpaceOnUse"><path d="M0 10q22-8 46-2t44-2M0 34q28-11 51-3t39-2M15 20h45" fill="none" stroke="#6c472520" stroke-width="1.4"/></pattern>
    <pattern id="${prefix}-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0v25" fill="none" stroke="#93b0b511" stroke-width="1"/></pattern>
    <filter id="${prefix}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0c1d22" flood-opacity=".4"/></filter>
    ${metallic.map((color, i) => `<linearGradient id="${prefix}-plate-${i}" x2="0" y2="1"><stop stop-color="${color}"/><stop offset=".13" stop-color="${color}"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="${['#567c9d', '#b07d3f', '#4d7f6d', '#a95e51', '#7e639c', '#638c90', '#a5667c', '#839c51'][i]}"/></linearGradient>`).join('')}
  </defs>`;
}
function explorer(x, y, won, lost) {
  if (pinExplorerSrc) {
    // 3D 降级方案
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
    // 3D 降级方案
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
function screwHead(x, y, prefix, radius = 12) {
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
