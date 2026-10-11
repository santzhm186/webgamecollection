/**
 * 模板 manifest —— 游戏对外的唯一入口，宿主的注册表读它。
 *
 * 硬规则 4：**本文件必须无副作用、可静态分析。**
 * 首页会 import 全部 manifest 来渲染游戏卡片，所以这里不能创建实例、不能碰 DOM。
 * 所有重的东西都写成动态 import 函数，点开游戏时才加载。
 *
 * @typedef {import('../../src/core/contracts.js').GameManifest} GameManifest
 */

/** @type {GameManifest} */
export default {
  id: 'my-game',                    // 成绩库的 gameId。kebab-case，一经发布**不可更改**
  titleKey: 'game.my-game.title',
  category: 'puzzle',               // action | puzzle | casual | 自定义
  order: '04',
  tags: ['template', 'example'],
  taglineKey: 'game.my-game.tagline',
  controlsKey: 'game.my-game.instruction',
  cardMetaKey: 'game.my-game.cardMeta',
  artLabelKey: 'game.my-game.artLabel',
  levelCount: 3,
  hostApi: '^1.0.0',                // 声明兼容的宿主版本，宿主据此做兼容包装
  engineVersion: '1.0.0',           // 改了玩法/数值必须提升，否则新旧成绩混进同一个榜
  timeDriven: false,

  levels: () => import('./levels.js'),
  engine: () => import('./engine.js'),
  renderer: () => import('./render.js'),
  assets: () => import('./assets.js'),

  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#8fd58a' },
};
