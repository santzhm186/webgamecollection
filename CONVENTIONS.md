# 项目约定

> **这是本项目的规则总表。** 贡献代码前请读完 §2（铁律）与 §3（命名），其余按需查阅。
>
> 每条约定都标注了**由谁执行** —— 本项目不靠自觉维护约定：
> 绝大多数规则都有对应的测试，违反会在 CI 阶段失败。
> 完整测试清单见 §6 对照表。
>
> 配套文档：[决策记录](docs/DECISIONS.md)（为什么这样设计）·
> [命名与字典](docs/NAMING-CONVENTIONS.md)（字典细则）·
> [架构方案](docs/ARCHITECTURE.md) · [协作与规模化](docs/SCALING-AND-CONTRIBUTING.md) ·
> [迁移映射](docs/MIGRATION-MAP.md) · [游戏模块约定](games/README.md)

---

## 1. 项目结构

```
index.html · styles.css        外壳（首页 + 统一游戏容器 + 卡片模板）
app.mjs                        宿主：注册表加载、DOM、进度、语言、音效
engine.mjs                     ⚠️ 过渡文件：仅剩 pins / screws 的规则（P4 删除）
boards.mjs                     ⚠️ 过渡文件：pins / screws 的 SVG 渲染（P4 拆分）

src/
├── core/
│   ├── contracts.js           契约层（唯一契约来源，无运行时代码）
│   ├── host-surface.js        ★ 游戏唯一可 import 的宿主入口
│   ├── enums.js               闭合枚举字典
│   ├── labels.js              共用显示文案（难度/分类/星级/语气）
│   ├── registry.js            注册表：manifest 校验、id 冲突、坏模块隔离
│   ├── lifecycle.js           会话：开局/推进/暂停/结算（纯逻辑无 DOM）
│   ├── i18n.js                多语言运行时
│   ├── locales.js             支持的语言清单
│   └── multiplayer.js         多人契约（**仅预留，未实现**）
├── locales/                   zh-CN.js · en.js（键集必须完全一致）
├── storage/adapter.js         存储端口（**仅端口，适配器未实现**）
├── ui/scene/primitives.js     ★ 共享 Canvas 绘制原语
├── services/  leaderboard/  assets/  models/  scene3d/   （目录已备，待实现）

games/
├── index.js                   ★ 注册表输入（动态 import 加载器数组）
├── README.md                  贡献者契约
├── _template/                 脚手架（可改名即用，自带 11 项测试）
├── runner/                    ✅ 已迁移：manifest / engine / render / levels / assets
├── pins/    screws/           ⏳ manifest 已就位，引擎待 P4 搬运

public/assets/                 brand · art · audio/{bgm,sfx} · models
tests/                         84 项测试（见 §6）
scripts/                       serve · build · balance
docs/                          架构 · 决策 · 命名 · 协作 · 迁移
```

★ = 游戏被允许 import 的宿主路径（见 §2 铁律 3）。

**待实现的目录说明**：`src/services/`、`src/leaderboard/`、`src/assets/`、`src/models/`、
`src/scene3d/`、`src/storage/` 下的适配器目前**只有目录或只有端口**，
详见 [架构方案](docs/ARCHITECTURE.md) 的阶段计划，不要以为它们已经能用。

---

## 2. 十条铁律

| # | 铁律 | 为什么 | 执行者 |
| --- | --- | --- | --- |
| **1** | **零运行时依赖，不引入打包器** | 没有供应链攻击面；首屏成本可控；clone 即跑 | 人工 review（新增依赖需单独论证） |
| **2** | **依赖单向向下**：`games → 契约 → 适配器`，禁止反向 | 反向依赖会让渲染层认识规则层，最终谁也不敢改 | T5 / T6 |
| **3** | **游戏只能 import 四个位置**：自己的文件、`src/core/host-surface.js`、`src/ui/scene/primitives.js`、`src/ui/scene/three-models.js` | 否则边界会一点点烂掉（今天 import i18n，明天直接读 localStorage） | T5 |
| **4** | **引擎不碰 DOM**（`document` / `window` / `localStorage` / `rAF` 全禁） | 这是能在 Node 里穷举玩法正确性的唯一前提 | T5（规则约束）+ 游戏测试 |
| **5** | **渲染器无状态**，`destroy()` 必须解绑 | 有状态渲染器会在换关/重开时画旧数据；漏解绑会累积泄漏 | T6 + 人工 review |
| **6** | **面向玩家的字符串必须有文案键**，禁止硬编码 | 否则加语言必漏翻译 | T4（扫描 JS 与 HTML） |
| **7** | **星级与分数由引擎判定**，宿主只存不猜 | 宿主猜玩法必然写错，且无法被游戏测试覆盖 | 会话测试 + 人工 review |
| **8** | **除 `src/storage/**` 外禁止直接访问持久化** | 换后端时不改业务代码；键位可版本化 | 人工 review（P1 收口后加测试） |
| **9** | **`manifest.js` 无副作用、可静态分析** | 首页要 import 全部 manifest 渲染卡片 | 注册表校验 + 契约测试 |
| **10** | **确定性与帧率无关**：`tick` 的 `dt` 由宿主夹在 `[0, 0.1]`；禁止用 `Date.now()` / `Math.random()` 参与玩法判定 | 掉帧、切后台、联机重放都必须得到同一结果 | 游戏测试 + 人工 review |

---

## 3. 命名规范

**一句话原则：字符串键用 camelCase（game 的第二段保留 kebab-case 游戏 id）；其余一切用 kebab-case；导出用具名导出。**

| 类别 | 规范 | 示例 | 反例 |
| --- | --- | --- | --- |
| 文案键 | `<area>.<subject>[.<detail>]`，段内 camelCase，最多四段；`game.water-sort.*` 的游戏 id 保留连字符 | `dialog.assistGoalRunner` | `dialog-assist-goal-runner` |
| 游戏 id | kebab-case，**发布后不可改** | `runner` · `my-game` | `MyGame` · `my_game` |
| 枚举**成员名** | SCREAMING_SNAKE | `LOCAL_MULTI` | `localMulti` |
| 枚举**值** | kebab-case 字符串 | `'local-multi'` | `'localMulti'` |
| 关卡数据的机器值 | 稳定英文标识（**难度暂时例外**，见 §4.4） | `'entry'` | `'入门'`（待迁移） |
| 文件名 | kebab-case | `hotseat-transport.js` | `hotseatTransport.js` |
| 目录名 | kebab-case | `scene3d/` | `scene3D/` |
| CSS 类 / id | kebab-case | `.game-card` `#play-area` | `.gameCard` |
| JS 变量/函数 | camelCase | `startLevel()` | `start_level()` |
| 类 | PascalCase | `class Runner` | `class runner` |
| 常量（模块级） | SCREAMING_SNAKE | `RUNNER_LEVELS` | `runnerLevels` |
| 数据属性 | `data-*` kebab-case | `data-open` `data-i18n-params` | `dataOpen` |
| 导出方式 | **具名导出优先**，默认导出只用于「一个文件一个主体」（游戏/渲染器工厂/manifest/语言包） | `export function applyGate` | `export default { applyGate }` |
| 布尔 | `is` / `has` / `needs` / `should` 前缀 | `isPlaying` `needsStart` | `playing` `start` |
| 私有约定 | 前缀 `_` | `this._prefix` `_ctxDispatch` | — |

### 需要跨文件同步的标识组

改了必须一起改（否则运行时才报错）：

| 组 | 成员 |
| --- | --- |
| `manifest.id` / `engine.gameId` / 文案键前缀 / 注册表键 | 四处必须一致，契约测试会校验 `game.<id>.*` 的存在性 |
| `kebab-case id` / URL hash / `data-open` / `data-game` / 成绩库 `gameId` | 同一个 id |
| **渲染层 z-index 约定与引擎遮挡判定** | 见 §5 |

---

## 4. 字典

四层，各有归属。**判据是一句话**：

> **宿主需要在代码里 `if` 它吗？需要 → `src/core/`；只有自己认识 → `games/<id>/`；玩家能看见 → 必须有键。**

| 层 | 文件 | 放什么 | 谁能加 | 校验 |
| --- | --- | --- | --- | --- |
| 闭合枚举 | [`src/core/enums.js`](src/core/enums.js) | 宿主判断用的机器值（14 组，见 §4.5） | 只有宿主，算契约变更 | 枚举测试 |
| 共用显示文案 | [`src/core/labels.js`](src/core/labels.js) | 难度、分类名、星级图形、语气 | 宿主（PR 审核） | 单元测试 |
| 多语言文案 | [`src/locales/*.js`](src/locales/) | **所有面向玩家的字符串**（当前 202 键 × 2 语言） | 任何人，但须补全所有语言 | T1 / T3 / T4 |
| 游戏私有字典 | `games/<id>/dictionary.js` | 只有这个游戏认识的词汇与几何 | 该游戏贡献者 | T3 / T5 |

### 4.1 文案键的 area 白名单

`app` · `nav` · `home` · `dialog` · `status` · `progress` · `result` · `common` · `game`

新增 area 需要同时改 `tests/dictionary.test.mjs`、本文档与
[命名与字典](docs/NAMING-CONVENTIONS.md) —— 属于约定变更。

### 4.2 文案键六条规则

| # | 规则 |
| --- | --- |
| R1 | 面向玩家的字符串**必须**有键，禁止在 `.js` / `.html` 里直接写文案字面量 |
| R2 | 游戏专属文案一律 `game.<id>.*`；宿主区域禁止出现某个游戏的专有名词 |
| R3 | 变量用 `{name}` 占位，由 `t(key, params)` 插值；**禁止字符串拼接** |
| R4 | 单位/量词写进文案（`common.levels` = `"{n} 关"`），不写进代码 |
| R5 | 新增键必须补全**所有** locale |
| R6 | 语言简称（`中` / `EN`）放 `src/core/locales.js`，不进文案文件 |

**两种用法**：

```html
<!-- 声明式：HTML 静态文案 -->
<h1 data-i18n="home.title1">别光看。</h1>
<input data-i18n-attr="aria-label:home.searchLabel,placeholder:home.searchPlaceholder">
<span data-i18n="progress.levels" data-i18n-params="n:0,total:3">0 / 3 关</span>
```

```js
// 命令式：JS 动态文案
t('game.runner.win', { arrived: 156, left: 46, stars: 3 })
```

> ⚠️ **含子元素的容器不能用 `data-i18n`。** `applyToDocument()` 用 `textContent` 赋值会
> **清空子节点**。本项目踩过这个坑：`<span id="footer-year" data-i18n="…">…<span id="year">`
> 导致 `#year` 变成 `null`，整个 `app.mjs` 初始化崩溃、整站白屏。
> 正确做法：让子节点各自带键，或改用命令式渲染。

### 4.3 游戏私有字典必须导出 `dictionaryKeys`

```js
// games/pins/dictionary.js
import { t } from '../../src/core/host-surface.js';   // ← 唯一允许的宿主 import
export const PIN_LABEL_KEYS = Object.freeze({ water: 'game.pins.pinWater', /* … */ });
export const pinLabel = pin => t(PIN_LABEL_KEYS[pin]);
export const dictionaryKeys = Object.freeze([...Object.values(PIN_LABEL_KEYS)]);  // T3 据此校验
```

### 4.4 已知偏离：难度的机器值是中文

`DIFFICULTY.ENTRY === '入门'`。它同时是关卡数据里的机器值且被三个游戏共享，
显示层已用 `difficultyLabel()` 映射（英文语境显示 `Beginner`），**不影响使用**。
改为英文键要同步改三套关卡数据，计划在 P4 完成。见 [决策 D11](docs/DECISIONS.md)。

### 4.5 枚举字典现状（14 组）

| 枚举 | 成员数 | 用途 |
| --- | --- | --- |
| `ENGINE_STATUS` | 5 | 引擎状态，宿主据此显隐按钮与结算 |
| `RENDERER_KIND` | 3 | 渲染技术（canvas / dom / webgl） |
| `STORAGE_KIND` | 3 | 存储实现（**与 RENDERER_KIND 无关，不得共用 `kind` 命名**） |
| `PLAY_MODE` | 3 | 玩法模式（联机项为**预留**） |
| `CONTROLLER_KIND` | 3 | 玩家位控制来源 |
| `NAMESPACE` | 5 | 存储命名空间隔离 |
| `LEADERBOARD_MODE` | 3 | 榜单聚合口径 |
| `RANK_SCOPE` | 2 | 榜单可见范围 |
| `SCORING_ORDER` / `SCORING_PRIMARY` | 2 / 3 | 排序方向与主指标 |
| `HUD_TONE` / `TOAST_TONE` | 3 / 2 | 语气 |
| `CATEGORY` | 3 | 游戏分类（同时用于首页筛选） |
| `SFX` | 4 | **音效注册表**：游戏只能引用已注册的名字 |

每个成员都必须有说明"什么时候会用到它"的注释 —— 由测试强制。

---

## 5. 数据与持久化不变量

| 不变量 | 说明 |
| --- | --- |
| **成绩键 = `${userId}:${gameId}:${level}`** | 天然幂等：同一人同一关重复提交是**更新**而非插入 |
| **昵称存快照** | 榜单渲染不需要 join 用户表；改名不让历史名次集体变动 |
| **记录 `engineVersion`** | 改了数值规则后，新旧成绩不静默混进同一个榜 |
| **进度与成绩分离** | 进度（星级/解锁）可由成绩派生；成绩是原始事实 |
| **星级只升不降** | 重玩不会降低已有星级 |
| **排行榜确定性全序** | `score desc → durationMs asc → updatedAt asc → userId asc`（全同分时也有稳定顺序） |
| **竞技排名** | 1,2,2,4（并列后跳号） |
| **本地榜必须诚实标注** | 纯静态下只有自己一条记录，UI 不得假装有他人排名 |
| **进度键位由注册表驱动** | 新增游戏自动获得进度槽位，不必改 `app.mjs` |

v0.3 共 6 款游戏、38 关、114 星；新增关卡只追加，旧索引保持不变。`assistGoal()` 与 `canUndo()` 是可选引擎能力，宿主优先采用。3D 定义见 [资产说明](src/models/README.md)。

**当前存储键（P1 收口前）**：`wande-dao-progress-v2` · `wande-dao-completed`（旧版迁移）·
`wande-dao-sound` · `wande-dao-locale`。迁移规则见 [迁移映射](docs/MIGRATION-MAP.md) §5。

### 渲染层与规则层的共享约定

| 约定 | 位置 | 必须同步修改的地方 |
| --- | --- | --- |
| **id 更大的金属片覆盖 id 更小的片** | `games/screws/dictionary.js` 的 `containsPlate()` | 渲染层的 `z-index: p.id + 4` |
| 螺丝孔位几何 | `screwPosition()`（同一个函数） | 引擎的 `available()` 与渲染层的命中区都用它 —— **禁止各自实现一份**，否则会出现"看起来能拆、实际不可拆" |

---

## 6. 每条约定由谁执行（对照表）

| 约定 | 执行者（测试名） |
| --- | --- |
| 语言键集一致 / 键名格式 / `game.<id>` 归属 / 占位符一致 / 同值键检测 | `T1 *`（4 项） |
| `t()` 插值 / 缺键回落 / `setLocale` 幂等 / 取消订阅 / `parseParams` | `T2 *`（6 项） |
| 游戏字典的键真实存在 | `T3 *`（2 项） |
| 禁止硬编码文案（JS + HTML） | `T4 *`（2 项） |
| 游戏依赖边界 / host-surface 不承载逻辑 | `T5 *`（2 项） |
| 渲染层可加载 / 产出真实标记 / 不反向依赖规则层 | `T6 *`（4 项） |
| 多人声明的校验与预留状态 | `T7 *`（3 项） |
| 枚举值唯一且已登记 / kind 不撞车 / 难度顺序与 tone / 星级钳制 / 成员注释 | 枚举与字典（6 项） |
| manifest 校验 / id 冲突 / 坏模块隔离 / 文案键跨语言存在 / hostApi 兼容 | 注册表（6 项） |
| `timeDriven` 推进 / 暂停 / **每次结束结算一次（撤销恢复后可再结算）** / hint-undo 能力探测 / destroy / 参数校验 | 会话（7 项） |
| runner 已离开根目录 / 过渡文件已标注 P4 | 迁移完整性（1 项） |
| 玩法正确性（224 条路线 / 918 种拉针顺序 / 6 棋盘可解性 / 撤销与满槽） | 游戏测试（12 项） |
| 贡献者脚手架可用 | 模板测试（11 项） |
| 首页懒加载 / 主按钮 / 卡片翻译 / 撤销存档 / 通用输入 / 加载竞态 | [宿主交互](tests/app.test.mjs)（6 项） |
| 并发加载去重 / 失败隔离 / 关卡数与静态预览 | [注册表加载](tests/registry-loading.test.mjs)（4 项） |
| 冲关按钮 / 鼠标触摸 / 暂停 / 清理 | [冲关输入](tests/runner-input.test.mjs)（4 项） |
| **文档自身**：链接有效 / 文档清单最新 / 阶段状态不说谎 / 执行者真实存在 | 文档校验（4 项） |

**改约定时必须同时改文档与测试** —— 否则 CI 会失败，这正是设计意图（见 [决策 D15](docs/DECISIONS.md)）。

P3 基线共 84 项测试（v0.3 已增加新游戏、模型与宿主回归用例）：字典与约定 29 · 注册表与会话 14 · 文档 4 · 注册表加载 4 · 宿主交互 6 · 玩法 12 · 模板 11 · 冲关输入 4。具体项数以 `npm test` 输出为准。

---

## 7. 加东西时的检查清单

### 加一个游戏

1. `cp -r games/_template games/<id>`，改 id / 文案键 / 内部命名
2. `games/index.js` 加一行加载器；manifest 声明与实际关卡一致的 `levelCount`，可选 `preview` 提供静态插画
3. 在 `src/locales/*.js` 的**所有**语言里加 `game.<id>.*` 文案键
4. 自带 `tests/<id>.test.mjs`：至少证明"存在通关路径""非法操作无副作用""星级门槛可达"
5. `npm test` 全绿

### 加一条文案

1. 在 `src/locales/zh-CN.js` 与 `en.js` **同时**加键（键名遵守 §3）
2. HTML 用 `data-i18n`，JS 用 `t()`
3. 含子元素的容器改用命令式渲染（见 §4.2 警告）

### 加一门语言

1. `src/core/locales.js` 的 `LOCALES` 加一条（`code` 用 BCP 47，`label` 用该语言自称，`status` 先标 `beta`）
2. 新建 `src/locales/<code>.js`，导出与 `zh-CN` **完全相同**的键集
3. `src/locales/index.js` 注册

**不需要改**：`index.html`、`app.mjs`、任何游戏代码、任何渲染层。

### 加一个音效 / 分类 / 状态

| 目标 | 动作 |
| --- | --- |
| 音效 | `SFX` 加成员（带注释）→ `audio-manager` 登记 → 游戏在 `players`/`uses` 引用 |
| 分类 | `CATEGORY` 加成员 → `CATEGORY_LABEL` 加显示名 → 侧栏加筛选按钮 → 文案加 `nav.<category>` |
| 引擎状态 | 慎重：`ENGINE_STATUS` 是生命周期判断依据，加成员要同步 `lifecycle.js` 与本文档 |

### 加一个依赖

**先别加。** 零依赖是本项目的核心约束（[决策 D1](docs/DECISIONS.md)）。
确有必要时在 PR 里单独论证：替代方案是什么、体积多少、攻击面多大。

---

### 宿主交互协议

- 首页只读取 manifest；`levels` / `engine` / `renderer` / `assets` 在点开游戏时加载，同一游戏并发请求共享结果。
- 渲染器 `mount(host, engine, ctx)` 只绑定一次监听；`draw(engine)` 仅重绘，`destroy()` 完整解绑。
- 玩家操作走 `ctx.dispatch({ type, args })`，`args` 必须是数组；宿主调用同名引擎方法并统一结算。暂停走 `ctx.togglePause()`。
- 失败后仍可使用引擎允许的撤销；恢复进行中时清除旧结算，下一次结束重新结算。
- 加载中关闭窗口或切换游戏时，迟到的请求不得重新挂载旧游戏。

## 8. 无障碍（一等约束，不是可选项）

| 要求 | 现状 |
| --- | --- |
| 所有交互控件有可读的 `aria-label`（且必须走文案字典） | ✅ 由 T4 与渲染测试覆盖 |
| 状态文案用 `role="status" aria-live="polite"`，**只在文案变化时更新 DOM** | ✅ `updateStatus()` 内做比较 |
| 键盘可达：`Enter`/`Space` 激活控件不被劫持；空格用于暂停 | ✅ 保留按钮激活优先 |
| 尊重 `prefers-reduced-motion` | ✅ 关闭动画与粒子（`setReducedMotion`） |
| 切后台自动暂停（仅对需要连续帧的游戏） | ✅ `visibilitychange` + `session.timeDriven` |
| 焦点管理：键盘操作后焦点移到下一个可用目标 | ✅ DOM 渲染器的命中区是真实 `<button>` |

---

## 9. 当前进度与待办

| 阶段 | 状态 |
| --- | --- |
| P0 字典与命名统一 | ✅ 已完成（4 层字典、202 键 × 2 语言、14 组枚举） |
| P0 契约层 + 存储端口 | ✅ 已定义；⏳ 适配器与 `ScoreStore` / `ProgressStore` 未实现 |
| P3 宿主框架 + runner 迁移 | ✅ 已完成（注册表、会话、84 项测试、浏览器验收通过） |
| P1 存储收口（5 处 `localStorage` 改走适配器） | ⏳ 未开始 |
| P4 pins / screws 搬入各自目录，删除 `engine.mjs` 与 `boards.mjs` | ⏳ 未开始（manifest 已就位） |
| P5 排行榜 | ⏳ 未开始（排名算法与口径已设计） |
| P6 资源外置（ResourceManager、模型、音频文件） | ⏳ 未开始 |
| P7 入口收口（hash 路由、构建期生成 `games/index.js`） | ⏳ 未开始 |
| 多人游玩 | **仅预留**，不在近期范围内 |
| 3D / 共享实体库 | ✅ v0.3 已有 24 个可复用模型、GLB 导出、共享 Three.js 精灵与交互预览；动画骨骼/资源管理器未实现 |

完整阶段计划与验收标准见 [迁移映射](docs/MIGRATION-MAP.md)。开放问题见 [决策记录](docs/DECISIONS.md) 末尾。
