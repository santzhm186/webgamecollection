/**
 * 加减门冲关 · 资源清单
 * ============================================================================
 * 本游戏当前**不需要任何外部资源**：全部画面由 Canvas 程序化绘制，
 * 音效走宿主内置的合成音通道（零字节、零加载延迟）。
 *
 * 这本身是一个值得说明的设计立场：程序化绘制 + 合成音让这个游戏
 * 的首屏成本接近 0，也让"资源 404 导致白屏"这类故障不可能发生。
 * 只有当需要真实素材（如美术提供的背景图或 3D 模型）时才在这里登记。
 *
 * @typedef {import('../../src/core/contracts.js').ResourceItem} ResourceItem
 */

/** @type {ResourceItem[]} */
export const ASSETS = [
  // 宿主已内置的合成音效（登记为 lazy：点开游戏才需要，首页不加载）
  { id: 'sfx.click', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.win', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.lose', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.fall', type: 'audio', src: '', load: 'lazy' },

  // 将来加入真实素材的写法（必须声明 bytes，供首页预算检查）：
  // { id: 'image.runner.sky', type: 'image', src: 'games/runner/sky.webp',
  //   bytes: 48_000, load: 'lazy', fallback: ['art.sky.default'] },
];

export default ASSETS;
