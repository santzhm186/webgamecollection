/**
 * 模板资源清单。演示"共享资源优先、游戏私有资源兜底"的组织方式。
 * 资源由宿主的 ResourceManager 加载与缓存，游戏只通过 ctx.use(id) 取用。
 * @typedef {import('../../src/core/contracts.js').ResourceItem} ResourceItem
 */

/** @type {ResourceItem[]} */
export const ASSETS = [
  // 共享音效：宿主已内置，不必自带文件。合成音是默认通道，零字节、零加载延迟。
  { id: 'sfx.click', type: 'audio', src: '', load: 'lazy' },
  { id: 'sfx.win', type: 'audio', src: '', load: 'lazy' },

  // 游戏私有资源示例（放进 public/games/<id>/）：
  // { id: 'image.my-game.board', type: 'image', src: 'games/my-game/board.png', bytes: 42_000, load: 'lazy',
  //   fallback: ['art.board.default'] },   // ← 资源 404 时降级，游戏仍可玩
];

export default ASSETS;
