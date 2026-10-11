# 游戏模块约定（贡献者入口）

> 想给这个合集加一个游戏？**只需要读这一篇 + [契约层](../src/core/contracts.js) +
> [命名与字典约定](../docs/NAMING-CONVENTIONS.md) + [项目约定](../CONVENTIONS.md)**，
> 不需要读宿主实现。
> 复制 [`_template/`](_template/) 改名即可开始。
>
> **你唯一允许 import 的宿主路径是 [`src/core/host-surface.js`](../src/core/host-surface.js)。**
> 违规会被 `tests/dictionary.test.mjs` 的 T5 用例拦下。

---

## 一个游戏 = 一个目录、一个 manifest、四条硬规则

```
games/<your-game-id>/
├── manifest.js     ← 唯一对外入口（宿主的注册表读它）
├── engine.js       ← 玩法逻辑（硬规则 1、2）
├── render.js       ← 渲染（硬规则 3）
├── levels.js       ← 关卡数据
└── assets.js       ← 资源清单（可选）
```

在所有语言包补齐游戏文案，并在 [`games/index.js`](index.js) 增加一行 manifest 加载器，即可注册。卡片、关卡选择、HUD、结果面板、本机进度、音效与暂停由宿主提供；排行榜与独立成绩库存储仍在规划中。

---

## 四条硬规则

### 规则 1：`engine.js` 不得触碰 DOM

**禁止**出现 `document`、`window`、`localStorage`、`requestAnimationFrame`、`matchMedia`。

原因不是洁癖：本项目现有三个引擎都是**确定性纯函数**，所以能在 Node 里穷举 224 条冲关路线、918 种拉针顺序、6 个螺丝棋盘的全部解法。你的游戏只有保持无 DOM，才能享受同样的自动化验证 —— 这也是将来服务端**重放校验分数**（反作弊）的前提。

```js
// ✗ 错误
tick(dt) { this.x += 10; document.querySelector('.x').style.left = this.x; }

// ✓ 正确
tick(dt) { this.x += 10; this.message = `位置 ${this.x}`; }   // render.js 负责画
```

### 规则 2：状态全在 engine，renderer 必须无状态

`render.js` 在 `mount(host, engine, ctx)` 时挂载，在 `draw(engine)` 时读取引擎状态。所有可变状态都在 engine 实例上。

现有代码已经是这个形状（`drawRunner(canvas, state)`、`pinBoard(engine, opts)`），照着写就行。**`destroy()` 必须解绑所有监听器**，宿主会在关闭游戏时调用，泄漏会累积到整个合集。

### 规则 3：只能通过 `ctx` 或 `host-surface.js` 拿外部能力

**禁止** `import` 宿主内部模块（`src/services/**`、`src/storage/**`、`src/ui/**`、
以及 `src/core/` 下的具体文件）。允许的两条通道：

- 运行时的资源/音效/主题/埋点 → 从构造参数 `ctx` 拿
- 翻译与枚举等静态能力 → `import { t, DIFFICULTY } from '../../src/core/host-surface.js'`

**所有面向玩家的文字必须有文案键**（`src/locales/*.js`），并遵守
[命名与字典约定](../docs/NAMING-CONVENTIONS.md) 的 R1–R6。

```js
import { t, DIFFICULTY } from '../../src/core/host-surface.js';  // 唯一允许的宿主 import

export default class MyEngine {
  constructor(level, ctx) {
    this.ctx = ctx;
    this.level = level;
    this.config = LEVELS[level];
    this.status = 'ready';      // 宿主据此显隐"开始"按钮
    this.message = ctx.t('game.my-game.intro');
    this.stars = 0;
    this.score = 0;
  }
  start()  { this.status = 'playing'; }
  tick(dt) { /* 每帧推进；不需要连续帧的游戏可以不实现此方法 */ }
  hud()    { return [{ label: this.ctx.t('game.my-game.hudMoves'), value: this.moves }]; }
  metrics(){ return { route: this.trace.join(','), moves: this.moves }; }  // ← 会进成绩库
}
```

`metrics()` 请**尽量记录操作序列**。宿主会把确定性引擎的操作序列存进成绩库，将来服务端可以只靠 `(gameId, level, 操作序列)` 重放验证分数，不用信任客户端上报的 `score`。

### 规则 4：`manifest.js` 必须无副作用、可静态分析

首页会 import **全部** manifest 来做卡片列表，所以它不能创建实例、不能碰 DOM、不能有副作用。所有重的东西都写成动态 import 函数。首页只用 `levelCount` 建进度槽位、用 `preview` 图片展示插画，点击后才解析加载器：

```js
export default {
  id: 'my-game',                    // 一经发布不可更改：它是成绩库的 gameId
  titleKey: 'game.my-game.title',
  levelCount: 3,                    // 须与 levels() 的实际长度一致
  preview: './public/assets/art/my-game-preview.svg', // 可选静态图片，不加载渲染器
  category: 'puzzle',
  taglineKey: 'game.my-game.tagline',
  controlsKey: 'game.my-game.instruction',
  hostApi: '^1.0.0',                // 声明兼容的宿主版本
  engineVersion: '1.0.0',           // 改了数值/玩法必须提升，否则新旧成绩混在一个榜里
  levels:   () => import('./levels.js'),      // ← 动态，点开游戏才加载
  engine:   () => import('./engine.js'),
  renderer: () => import('./render.js'),
  assets:   () => import('./assets.js'),
  scoring:  { order: 'desc', primary: 'score', allowTotal: true },
  theme:    { accent: '#8fd58a' },
};
```

渲染器在 `mount` 时绑定一次事件，通过 `ctx.dispatch({ type: 'pick', args: [index] })` 派发操作；宿主负责调用同名引擎方法、重绘和结算。`draw` 不得重复绑定，`destroy` 必须解绑。无参动作使用 `args: []`。暂停按钮调用 `ctx.togglePause()`。开始游戏后宿主会立即重绘 DOM。

---

## 验证自己的游戏（提交 PR 前请确保）

宿主提供三类自动化检查，你的游戏需要被它们覆盖：

| 检查 | 位置 | 你要做的 |
| --- | --- | --- |
| 契约一致性 | `tests/framework.test.mjs` | 无需额外工作：声明 manifest 后自动被检查（必需字段、动态 import、engineVersion 格式） |
| 依赖边界 | `tests/dictionary.test.mjs` | 只要遵守规则 1/3 即可通过（脚本会扫你的 import 语句） |
| 玩法正确性 | `tests/<你的游戏>.test.mjs` | **需要你写**：至少覆盖"存在可通关路径""非法操作无副作用""星级门槛可达" |

第三项是硬性要求。参考现有 [tests/games.test.mjs](../tests/games.test.mjs)：它用固定步长穷举验证了 224 条路线、918 种拉针顺序、6 个棋盘的可解性与失败恢复。你的游戏不需要做到这个程度，但"存在解"必须被证明，否则玩家会卡死在一个无解的关卡上。

---

## 常见坑

| 坑 | 后果 | 正确做法 |
| --- | --- | --- |
| `manifest.id` 用了大写或中文 | 成绩库键不稳定 | 只用 kebab-case，一经发布不改 |
| 同一个 `id` 被两个游戏使用 | 注册表冲突，成绩串台 | 宿主启动时会检测并报错；本地起服务后看控制台 |
| `engineVersion` 忘了提升 | 改数值后排行榜新旧成绩混排 | 任何影响分数的改动都提升它 |
| `tick` 里直接用 rAF 的 `dt` | 掉帧时玩法速度改变，测试无法复现 | 宿主已把 `dt` 夹在 `[0, 0.1]`；只用它，别自己取时间 |
| `render.js` 里缓存了 engine 引用 | 换关后画的是旧状态 | `draw(engine)` 每次从参数取 |
| `destroy()` 忘了解绑 | 多次开关游戏后 CPU 占用飙升 | 用 `ctx.onFrame` 返回的取消函数，或在 destroy 里 removeEventListener |
| 星级规则写在宿主能算出来的地方 | 契约漂移 | 星级只由你的引擎判定，宿主只存不猜 |

---

## 需要宿主新增能力怎么办

不要在自己的游戏里绕开契约实现。开一个 issue 说明需求，走契约层扩展：

1. 在 [`contracts.js`](../src/core/contracts.js) 增加可选字段（可选 = 向后兼容，不提升主版本）。
2. 宿主实现该能力并注入 `ctx`。
3. 你的游戏用 `typeof ctx.newThing === 'function'` 探测，缺失时优雅降级。

这样其他游戏和第三方贡献者也能受益，而不是只有你的游戏能用。
