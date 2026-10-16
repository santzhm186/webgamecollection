/**
 * 加减门冲关 · manifest
 * ============================================================================
 * 硬规则：**本文件必须无副作用、可静态分析。**
 * 首页会 import 全部 manifest 来渲染卡片，所以这里不能创建实例、不能碰 DOM。
 * levels / engine / renderer / assets 全部写成动态 import 函数，
 * 点开游戏时才加载（这是合集能容纳很多游戏的前提）。
 *
 * 本文件同时是 P3 迁移的样板：pins 与 screws 会照这个形状搬过来。
 *
 * @typedef {import('../../src/core/contracts.js').GameManifest} GameManifest
 */

/** @type {GameManifest} */
export default {
  id: 'runner',
  titleKey: 'game.runner.title',            // 显示名走文案字典，随语言切换
  category: 'action',
  order: '01',                              // 卡片序号（展示用，与 category 分离）
  levelCount: 5,
  preview: './public/assets/art/runner-preview.svg',
  taglineKey: 'game.runner.tagline',
  controlsKey: 'game.runner.instruction',
  cardMetaKey: 'game.runner.cardMeta',
  artLabelKey: 'game.runner.artLabel',
  hostApi: '^1.0.0',
  engineVersion: '1.1.0',                   // 玩法/数值改动必须提升（成绩榜单口径）
  timeDriven: true,                         // 需要逐帧推进 → 宿主托管 rAF（canvas 游戏为 true）

  levels: () => import('./levels.js'),
  engine: () => import('./engine.js'),
  renderer: () => import('./render.js'),
  assets: () => import('./assets.js'),

  scoring: { order: 'desc', primary: 'score', allowTotal: true },
  theme: { accent: '#64d9ff' },
};
