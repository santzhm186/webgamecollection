/**
 * 游戏索引 —— 注册表的输入。
 * ============================================================================
 * ⚠️ 本文件目前**手写**。P0 计划中的 `scripts/games-index.mjs` 会扫描
 * 各游戏目录下的 manifest.js 自动生成它，并挂到 predev / prebuild 上，
 * 同时由 CI 校验"生成结果 == 已提交文件"。
 *
 * 为什么现在就手写：只有 3 个游戏时，显式列表比构建期代码生成更简单、
 * 也更容易看懂；但接口已按"生成式"设计 —— 注册表只接收一个**加载器数组**，
 * 生成器上线时替换本文件的实现即可，注册表与宿主体不用改动。
 *
 * 为什么是动态 import 函数而不是静态 import：
 *   首页只需要 manifest（几百字节）来渲染卡片；引擎与渲染器要等玩家点开游戏
 *   才加载。静态 import 会让首页一次性加载全部游戏的代码（游戏一多就崩）。
 *
 * 加一个游戏：在本文件加一行加载器。
 *
 * 类型说明（不写成 JSDoc 的箭头函数泛型 —— 那会让部分解析器把注释误当代码）：
 *   MODULES 是「返回 Promise<manifest 模块> 的函数」数组。
 */
export const MODULES = [
  function loadRunner() { return import('./runner/manifest.js'); },
  function loadPins() { return import('./pins/manifest.js'); },
  function loadScrews() { return import('./screws/manifest.js'); },
];

export default MODULES;
