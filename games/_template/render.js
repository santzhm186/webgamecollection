/**
 * 模板渲染器 —— 演示 kind:'dom'（返回 HTML 字符串）这条路。
 *
 * 另外两条路：
 *   kind:'canvas'  宿主提供 <canvas>，你只管 ctx 绘制（现有冲关走这条）
 *   kind:'webgl'   宿主提供 canvas + WebGL2 上下文（3D 游戏走这条）
 *
 * 硬规则：**无状态**。所有状态在 engine 里，draw() 每次从参数取。
 * @typedef {import('../../src/core/contracts.js').GameRenderer} GameRenderer
 * @typedef {import('../../src/core/contracts.js').GameEngine} GameEngine
 */
import { t as templateT } from './dictionary.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export default function createRenderer() {
  /** @type {HTMLElement|null} */
  let host = null;
  /** @type {((e: Event) => void)|null} */
  let onPick = null;
  let t = templateT;

  /** @type {GameRenderer} */
  return {
    kind: 'dom',

    mount(nextHost, engine, ctx = {}) {
      // 同一渲染器实例再次挂载时也先解绑，避免旧容器继续接收输入。
      this.destroy();
      host = nextHost;
      t = typeof ctx.t === 'function' ? ctx.t : templateT;
      host.style.setProperty('--accent', ctx.theme?.accent || '#8fd58a');
      onPick = event => {
        const button = event.target?.closest?.('[data-pick]');
        if (!button || !host?.contains(button) || button.disabled) return;
        const index = Number(button.dataset.pick);
        if (!Number.isInteger(index) || index < 0 || index >= 4) return;
        // 宿主统一推进、重绘与结算；渲染器只上报输入，绝不直接修改引擎。
        ctx.dispatch?.({ type: 'pick', args: [index] });
      };
      host.addEventListener('click', onPick);
      this.draw(engine);
    },

    draw(engine) {
      if (!host) return;
      const picks = [1, 2, 3, 4];
      // 演示：渲染只用 engine 的公开字段，不引入任何宿主组件
      host.innerHTML = `
        <div class="template-scene" role="group" aria-label="${escapeHtml(t('game.my-game.sceneLabel'))}">
          <p class="template-total">${escapeHtml(t('game.my-game.totalLabel', { total: engine.total, target: engine.config.target }))}</p>
          <div class="template-picks">
            ${picks.map((n, i) => `<button type="button" data-pick="${i}" aria-label="${escapeHtml(t('game.my-game.pickLabel', { n }))}" ${engine.status !== 'playing' ? 'disabled' : ''}>${escapeHtml(t('game.my-game.pick', { n }))}</button>`).join('')}
          </div>
        </div>`;
    },

    /**
     * 必须解绑全部监听器。宿主在玩家关闭游戏 / 切换关卡时调用。
     * 漏掉这一步，多次开关后 CPU 与内存占用会累积到整个合集。
     */
    destroy() {
      if (host && onPick) host.removeEventListener('click', onPick);
      if (host) host.innerHTML = '';
      host = null;
      onPick = null;
      t = templateT;
    },
  };
}
