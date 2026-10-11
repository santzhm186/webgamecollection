# 玩得到 · 大合集架构方案 v2

> 状态：**演进方案**。字典、契约与 P3 已落地，其余阶段以 [项目约定](../CONVENTIONS.md) §9 为准。
> 已确认的前提：
> ① 先纯静态、存储层做成可替换适配器
> ② 匿名设备 ID + 可自选昵称
> ③ 仓库内注册表 + 显式 manifest
> ④ 先定义方案与骨架，再按阶段落地
> ⑤ **目标规模：游戏可能很多；将在 GitHub 开源；会有多位开发者加入 → 共享入口、不同核心**
> ⑥ **"共享模型" = 3D 模型资源 + 共享实体模板库（两层都做）**
>
> 配套文档：[**项目约定**](../CONVENTIONS.md)【规则总表】 · [**决策记录**](DECISIONS.md)【为什么这样设计】
> · [命名与字典约定](NAMING-CONVENTIONS.md) · [规模化与多人协作](SCALING-AND-CONTRIBUTING.md) · [迁移映射表](MIGRATION-MAP.md)
> · [游戏模块约定](../games/README.md) · [契约层](../src/core/contracts.js) · [存储端口](../src/storage/adapter.js)
> · [共享入口 host-surface](../src/core/host-surface.js)【游戏唯一可 import 的宿主路径】
> · [多人契约](../src/core/multiplayer.js) · [枚举字典](../src/core/enums.js) · [i18n](../src/core/i18n.js)

---

## 1. 目标与非目标

### 目标

1. **同一接口进入**：所有游戏从同一个入口（首页卡片 → 统一游戏容器）进入，玩家不需要学习第二套交互。
2. **引擎可插拔**：每个游戏自带规则引擎与渲染方式，框架不假设任何具体玩法。
3. **共享资源库**：美术、音频、UI 组件、场景框架集中管理，避免每个游戏各写一套阴影、渐变、按钮。
4. **独立数据保存库**：按 `(user, game, level)` 保存成绩，读写只走一个存储接口。
5. **排行榜模块**：从成绩库派生排名，支持按关卡/总分，支持「我的最好成绩」与本机/云端排名。

### 非目标（本阶段明确不做）

- 不做实时对战、不做服务端权威反作弊（纯静态下无法做到，见 §9 风险）。
- 不引入构建期框架（React/Vue/TS 编译）。理由：现有代码零依赖且完全可读，引入后构建链与首屏成本都会上升。类型安全用 **JSDoc + `checkJs` 按需开启**替代。
- 不迁移到 WebGL/3D。所谓"模型"在本项目语境下指**可复用绘制原语与场景件**（见 §6），不是 3D 资产管线。

---

## 2. 现状盘点（迁移起点）

| 现有文件 | 承担职责 | 迁移问题 |
| --- | --- | --- |
| `engine.mjs` (225 行) | 三个游戏的规则 + 关卡数据，全混在一个文件 | 需按游戏拆分；关卡数据需外置 |
| `art.mjs` (113 行) | 冲关 Canvas 渲染 | 变成 `games/runner/render.js` |
| `boards.mjs` (106 行) | 神庙/工坊 SVG 渲染 + 命中区 | 需拆出**可共享**的 SVG defs 与场景件 |
| `app.mjs` (241 行) | **同时**承担：主循环、输入、音效、进度存储、解锁、关卡选择、HUD、结果面板、排行榜(无) | 一个文件 9 种职责，是本次重构的主要对象 |
| `index.html` / `styles.css` | 首页外壳 + 游戏弹窗（一个 `<dialog>` 承载全部游戏） | 弹窗骨架可复用；需要设计令牌层 |

**关键观察**：`app.mjs` 里 `unlocked()`、`hud()`、`updateStatus()`、`result-panel` 渲染、星级/分数结算逻辑**已经是对三个游戏通用的**——它们只是被硬编码在同一个文件里。这说明框架抽象不是新增概念，而是把已有的隐式框架**显式化**。这一点决定了迁移风险很低。

---

## 3. 分层架构

五层，依赖严格向下，**任何一层都不允许反向 import**（现有 `boards.mjs → engine.mjs` 的反向依赖要被消除）。

```
┌─ L4 应用层 ──────────────────────────────────────────────┐
│  index.html / styles.css                                  │
│  src/main.js        外壳：路由(首页↔游戏)、筛选、主题      │
│  src/ui/            共享 UI 组件 + 场景框架(Scene shell)   │
│  src/leaderboard/   排行榜视图与排名算法                    │
└───────────────────────────┬──────────────────────────────┘
                            │ 只通过契约调用
┌─ L3 服务层 ──────────────────────────────────────────────┐
│  src/core/lifecycle.js   游戏会话：挂载/暂停/结算/销毁      │
│  src/core/registry.js    游戏注册表（读 manifest）          │
│  src/core/session.js     当前会话状态、输入路由             │
│  src/services/resource-manager.js                        │
│  src/services/audio-manager.js      (BGM/SFX)             │
│  src/services/score-store.js        (成绩读写，唯一入口)    │
│  src/services/progress-store.js     (星级/解锁/设置)       │
└───────────────────────────┬──────────────────────────────┘
                            │ 依赖注入（构造时传入，不 import 单例）
┌─ L2 契约层 ──────────────────────────────────────────────┐
│  src/core/contracts.js   JSDoc typedef：                  │
│    GameEngine / GameManifest / ResourceItem /             │
│    ScoreRecord / LeaderboardQuery / ProgressRecord        │
│  src/storage/adapter.js  StorageAdapter 接口               │
└───────────────────────────┬──────────────────────────────┘
                            │ 实现
┌─ L1 适配层 ──────────────────────────────────────────────┐
│  src/storage/local-storage-adapter.js      （本轮实现）     │
│  src/storage/memory-adapter.js             （测试用）       │
│  src/storage/sqlite-adapter.js             （预留，见 §12） │
└──────────────────────────────────────────────────────────┘

  ┌─ 平级：游戏目录（只允许依赖 L2 契约 + L1 资源句柄）─┐
┌─ games/ ────────────────────────────────────────────┐
│  games/<id>/manifest.js   ← 唯一对外契约              │
│  games/<id>/engine.js     ← 纯规则，无 DOM            │
│  games/<id>/render.js     ← 渲染，无状态              │
│  games/<id>/levels.js     ← 数据                        │
└──────────────────────────────────────────────────────┘
```

### 依赖规则（要写进 lint / review checklist）

- `games/**` **不得** import `src/services/**`，也不得 import `src/ui/**`。游戏只能拿到注入的 `ctx`。
- `games/**/engine.js` **不得**触碰 `document` / `window` / `localStorage`——这是现有测试能在 Node 里跑 224 条路线的前提，必须保持。
- `src/storage/**` 只实现接口，不认识任何具体游戏。
- `src/leaderboard/**` 只通过 `ScoreStore` / `ProgressStore` 读数据，不直接访问适配器。

---

## 4. 契约层设计（L2）

这是整个方案的核心。**先把契约定死，游戏和框架就能并行开发。**

### 4.1 GameEngine —— 游戏逻辑与框架的唯一通信面

```js
/**
 * @typedef {Object} GameEngine
 * @property {string} gameId
 * @property {number} level            当前关卡下标
 * @property {object} config           关卡配置（含 title / difficulty）
 * @property {'ready'|'playing'|'won'|'lost'} status
 * @property {string} message          状态栏文案（框架直接渲染）
 * @property {number} stars            0..3，由引擎按自己的规则给
 * @property {number} score            主分值
 *
 * // 生命周期（全部可选，框架用 typeof 探测）
 * @property {() => void} [start]
 * @property {(dt:number) => void} [tick]       仅需要连续帧的游戏实现（如冲关）
 * @property {() => void} [pause]
 * @property {() => void} [resume]
 *
 * // 辅助能力（可选，框架据此显隐按钮）
 * @property {() => any} [hint]
 * @property {() => boolean} [undo]
 *
 * // 供 HUD / 排行榜使用的自述指标
 * @property {() => HudField[]} hud
 * @property {() => MetricBag} metrics   结构化指标，进成绩库
 */
```

**与现状的对应**：`Runner`/`Pins`/`Screws` 已经满足 `gameId/level/config/status/message/stars/score/start/tick/hint/undo` 中的绝大部分；需要新增的只有 `hud()` 和 `metrics()`——而这两个目前正是 `app.mjs` 的 `hud()` 函数里 `if (id === 'runner') ... else if` 的硬编码分支，抽出来即是。

### 4.2 关键决策：渲染适配器用「数据契约」而不是「类继承」

```js
/**
 * @typedef {Object} Renderer
 * @property {'canvas'|'dom'|'webgl'} kind
 * @property {(host:HTMLElement, engine:GameEngine, theme:Theme) => void} mount
 * @property {() => void} draw               框架在每帧/每次状态变更后调用
 * @property {() => void} [resize]
 * @property {() => void} destroy            必须解绑所有监听器
 * @property {(ev:NormalizedInput) => void} [onInput]
 */
```

- `kind: 'canvas'` → 框架给它一个 `<canvas>` 并管理 rAF（冲关走这条）。
- `kind: 'dom'` → 框架给它一个容器，它返回 HTML（拉针、螺丝走这条，保持现有 SVG 字符串方案不变）。
- 渲染器**无状态**：所有状态在 engine 里。现有代码已经是这个模式（`drawRunner(canvas, state)`、`pinBoard(engine, ...)`），所以迁移是**机械搬运**。

### 4.3 注入上下文 `ctx` —— 游戏唯一的对外通道

```js
/**
 * @typedef {Object} GameContext
 * @property {(item:ResourceItem) => Promise<any>} use   取资源（自动缓存/引用计数）
 * @property {(name:string, opts?:object) => void} sfx
 * @property {(name:string) => void} music
 * @property {(msg:string) => void} toast
 * @property {Theme} theme                               当前主题令牌
 * @property {(payload:object) => void} report           上报自定义事件（埋点/成就用）
 */
```

游戏**不 import 任何服务**，只从 `ctx` 拿。这样游戏才能被单测、被复用、被远程加载（为将来选项 B 留门）。

### 4.4 GameManifest —— 注册表的输入

```js
/** @type {import('../src/core/contracts.js').GameManifest} */
export default {
  id: 'runner',
  titleKey: 'game.runner.title',
  levelCount: 3,
  preview: './public/assets/art/runner-preview.svg',
  category: 'action',                    // all/action/puzzle/casual 之外可扩展
  tags: ['跑酷', '数学'],
  taglineKey: 'game.runner.tagline',
  controlsKey: 'game.runner.instruction',
  hostApi: '^1.0.0',
  engineVersion: '1.0.0',
  levels: () => import('./levels.js'),   // 懒加载：首页不加载任何游戏逻辑
  engine: () => import('./engine.js'),
  renderer: () => import('./render.js'),
  assets: () => import('./assets.js'),
  theme: { accent: '#64d9ff' },
  scoring: { primary: 'score', order: 'desc' },   // desc=分越高越好；asc=用时越短越好
};
```

`levels/engine/renderer/assets` 全部是**动态 import 函数**，不是值。这样：首页只加载 `manifest.js`（几百字节），点开游戏才加载引擎——这是合集做大的性能前提。

### 4.5 资源清单 ResourceItem

```js
/**
 * @typedef {Object} ResourceItem
 * @property {string} id               全局唯一，如 'sfx.click'、'scene.temple'
 * @property {'image'|'audio'|'json'|'svg'|'module'} type
 * @property {string} src
 * @property {number} [bytes]
 * @property {number} [version]        变更即失效缓存
 * @property {'eager'|'lazy'} [load]   默认 lazy
 * @property {string[]} [fallback]     加载失败后的降级链（见 §9）
 */
```

---

## 4.6 命名与国际化（横向约定，先于任何功能）

已单独成文：[命名与字典约定](NAMING-CONVENTIONS.md)。摘要：

- **四层字典**：`enums.js`（宿主判断的机器值）→ `labels.js`（共用显示文案）→
  `locales/*.js`（所有面向玩家的文案）→ `games/<id>/dictionary.js`（游戏私有词汇）。
- **一句话判据**：宿主需要在代码里 `if` 它 → `src/core/`；只有自己认识 → `games/<id>/`；玩家能看见 → 必须有键。
- **单一共享入口**：`games/**` 只允许 import `src/core/host-surface.js`，禁止 import 宿主内部模块。
- **测试即约定**：`tests/dictionary.test.mjs` 六组用例分别强制键集一致、无硬编码文案、跨语言占位符一致、
  依赖边界、渲染层可加载。约定不是建议，违反即 CI 失败。

---

## 4.7 多人游玩（同一游戏、同一局、同时多人）

契约见 [`src/core/multiplayer.js`](../src/core/multiplayer.js)，三条不可动摇的设计：

1. **一个引擎实例 = 一整局，局内有 N 个玩家位。** 不是"每人一个引擎实例"，因此 `GameEngine` 契约不变。
2. **补丁里只允许有动作，绝不允许有状态。** 传输层复制"谁做了什么"，各端靠确定性重放得到一致状态。
   一旦允许同步状态，确定性没了，服务端重放校验（本项目最大的反作弊优势）也没了。
3. **回合同步交给引擎。** 引擎通过 `activePlayers()` 报告轮到谁；传输层不理解任何玩法规则，
   因此同一套传输层对所有游戏通用，包括将来的联机。

### 当前状态：**仅预留接口，未实现任何适配器**（按需决定，不在近期范围内）

已就位的是"设计"而非"代码"：

| 已预留 | 位置 | 作用 |
| --- | --- | --- |
| `MatchTransport` / `PlayerSlot` / `PlayerAction` / `MatchPatch` 契约 | [`src/core/multiplayer.js`](../src/core/multiplayer.js) | 把设计钉死，将来加多人不必重新讨论架构 |
| `validateMultiplayerSpec()` / `createPlayerSlots()` | 同上（**已有测试覆盖**） | manifest 声明校验与玩家位生成，避免每个游戏重写样板 |
| `PLAY_MODE` / `CONTROLLER_KIND` 枚举成员 | [`src/core/enums.js`](../src/core/enums.js) | 先定义，避免将来改持久化与契约字段 |
| 接入路线与实现顺序 | `multiplayer.js` 文末 TODO | 下一步做什么、按什么顺序、每步补什么测试 |

**尚未实现**：`src/multiplayer/**` 下的任何传输适配器、`GameEngine.activePlayers()`、
玩家人数选择入口、对局编排、分屏布局、成绩的多人口径。

**为什么这样切分是安全的**：多人能力完全落在**新增文件 + 可选方法**上。
不声明 `players` 的游戏即为单人，因此现有三个游戏与将来的单人游戏都不受影响；
引擎只要实现可选的 `activePlayers()`，就能被三种传输（同设备 / 电脑 / 联机）共用。

---

## 4.8 P3 已落地：宿主框架与第一个迁移完成的游戏

**已完成**（runner 已完全迁移到 `games/runner/`，仓库根目录不再有它的代码）：

| 新增 | 位置 | 职责 |
| --- | --- | --- |
| 注册表 | [`src/core/registry.js`](../src/core/registry.js) | manifest 加载、校验、id 冲突检测、惰性 resolve、坏模块隔离 |
| 会话 | [`src/core/lifecycle.js`](../src/core/lifecycle.js) | 开局/推进/暂停/结算检测/销毁。**纯逻辑无 DOM**，因此可测 |
| 游戏索引 | [`games/index.js`](../games/index.js) | 动态 import 加载器数组（将来由构建期生成） |
| runner 模块 | [`games/runner/`](../games/runner/) | manifest / engine / render / levels / assets |
| 共享绘制原语 | [`src/ui/scene/primitives.js`](../src/ui/scene/primitives.js) | Canvas 与 SVG 共用的 rounded / label / polygon |

**宿主由此产生的变化**（`app.mjs` 从"硬编码三个游戏"变成"只认契约"）：

| 旧实现（游戏专属分支） | 新实现（契约驱动） |
| --- | --- |
| `games` 对象硬编码 title/category/instruction | 注册表读 manifest 的文案键 |
| `if (active.id === 'runner') mountRunner()` | 按 `renderer.kind` 分派，宿主不认游戏名 |
| `if (active.id !== 'runner') return` 只给冲关跑 rAF | `session.timeDriven`（manifest 声明或按 tick 推断） |
| `hud()` 里三个 if 分支 | `engine.hud()` 自述字段 |
| `lastStatus` 手工防重复结算 | `session.poll()` 保证每次结束结算一次；撤销恢复后可再次结算 |
| 卡片写死在 index.html | 注册表 + `<template>` 生成（文案键仍在 HTML 里，可被 T4 扫描） |

**数据流**：`games/index.js → registry.load() → manifest → registry.resolve() → {levels, Engine, createRenderer}
→ createSession() → renderer.mount(host, engine, session.ctx) → 玩家操作经 ctx.dispatch 回到宿主 → engine 判定
→ session.poll() → 宿主写进度/显示结果`。

**待续（P4）**：pins 与 screws 的引擎与渲染仍在根目录 `engine.mjs` / `boards.mjs`，
但它们的 manifest 已就位（通过动态 import 适配），所以**已经走同一套注册表与入口**，
P4 只需搬运实现，manifest 不用改。

---

## 5. 数据保存库设计

### 5.1 铁律：所有持久化只有一个出口

现在 `app.mjs` 有 5 处裸 `localStorage` 调用。重构后**任何文件都不允许直接 `localStorage.setItem`**，全部走 `StorageAdapter`。这条规则带来的收益是可测性（用 `MemoryAdapter` 跑测试）、可迁移性（换 IndexedDB/SQLite 不动业务代码）、以及**数据形状可版本化**。

### 5.2 StorageAdapter 接口

```js
/**
 * @typedef {Object} StorageAdapter
 * @property {(ns:string, key:string) => Promise<any>} get
 * @property {(ns:string, value:any, key?:string) => Promise<void>} put
 * @property {(ns:string, key?:string) => Promise<void>} remove
 * @property {(ns:string) => Promise<any[]>} list      用于排行榜扫描
 * @property {() => Promise<void>} clear
 * @property {() => Promise<{used:number, quota:number}>} usage
 */
```

全异步是刻意的：`localStorage` 是同步的，但 IndexedDB/SQLite/HTTP 不是。**如果现在写成同步，将来换后端要改遍每个调用点。** 异步接口是本方案里最重要的一条不可逆决策。

`localStorage` 适配器的实现要点：一个 `namespace` 前缀 + JSON 编解码 + 配额超限降级（见 §9）。

### 5.3 成绩记录 ScoreRecord

```js
/**
 * @typedef {Object} ScoreRecord
 * @property {string} id            `${userId}:${gameId}:${level}`  —— 天然去重，天然按 ID 保存
 * @property {string} userId
 * @property {string} nickname      记录时的昵称快照（改名不改历史，避免榜单被改名污染）
 * @property {string} gameId
 * @property {number} level
 * @property {number} score         主分值
 * @property {number} stars
 * @property {Record<string,number|string>} metrics  引擎自述指标（如 {arrived:156, peak:176}）
 * @property {number} plays         该 (user,game,level) 的游玩次数
 * @property {number} durationMs    本局耗时
 * @property {string} engineVersion 用于榜单口径一致性
 * @property {string} createdAt     首次记录时间（ISO）
 * @property {string} updatedAt     最近刷新时间
 */
```

**三条设计要点**：

1. **`id` 用 `${userId}:${gameId}:${level}` 复合**——这直接满足你说的"按 ID 保存用户成绩"，同时天然幂等：同一人同一关重复提交是更新而不是插入。`ScoreStore.submit()` 内部比较 `score` 与 `scoring.order`，只保留更优解，但 `plays` 始终累加。
2. **存昵称快照**：排行榜渲染不需要 join 用户表（纯静态下没有用户表），也避免改名后历史名次突然集体变化。
3. **存 `engineVersion`**：将来改了数值规则，老记录仍可识别并单独统计，不会出现"新老规则混在一个榜里比较"的静默错误。

### 5.4 进度与成绩分离

这是必须分开的两件事，现在 `app.mjs` 的 `progress` 把它们混在一个 `{stars,score}` 里：

| | ProgressStore | ScoreStore |
| --- | --- | --- |
| 内容 | 星级、解锁、设置（音效/主题） | 每次成绩、指标、次数、时长 |
| 键 | `userId:gameId:level` | 同上 |
| 用途 | 驱动关卡选择与解锁 UI | 驱动排行榜、统计 |
| 可再生 | 可以（从成绩派生） | 不可以（是原始事实） |

**实现上 ProgressStore 从 ScoreStore 派生**（`stars = max(stars)`），这样也顺手修掉现状中"星级与分数两处独立写入可能不一致"的隐患。

---

## 6. 共享资源库组织

### 6.1 资源分四类，各有归属

```
public/assets/
  brand/      logo、图标、字体子集、favicon            ← 全站共享
  art/        可复用 SVG 场景件与绘制原语              ← 美术共享（当前散在 boards.mjs）
  audio/
    bgm/      标签页级 BGM（跨游戏连续，不随游戏重启）  ← 音乐共享
    sfx/      click/win/lose/fall/pop ...              ← 音效共享（当前是 WebAudio 合成）
  games/<id>/ 该游戏专属的图/音频/关卡数据              ← 不共享，避免污染全局命名空间
```

### 6.1b "模型"的两层含义（已确认按 2+3 实现）

本项目里"模型"指**两件不同的事**，必须分开建设，否则 3D 渲染细节会污染玩法数据：

| 层 | 位置 | 内容 | 谁维护 |
| --- | --- | --- | --- |
| **渲染层：模型资源** | `public/assets/models/**` + `src/assets/model-loader.js` | `.glb/.gltf` 几何、材质、骨骼动画 | 美术 / 3D 贡献者，**不需要写代码** |
| **渲染层：3D 适配** | `src/scene3d/**`（`context.js` / `loader.js` / `instances.js` / `animator.js`） | WebGL2 上下文、模型实例化、动画播放、相机与光照预设 | 架构组 |
| **数据层：共享实体库** | `src/models/entities/**` | `EntityTemplate`：角色/道具/敌人/危险物的**数据定义**（速度、血量、碰撞半径、默认模型引用、语义标签） | 游戏贡献者共同积累 |

**为什么数据层要独立成"共享实体库"**：贡献者写第二个跑酷游戏时，不该重新定义一遍"守卫士兵"的移动速度与碰撞半径，也不该重新画一遍。实体模板 = 数据 + 默认模型引用，引擎只负责驱动这些参数，渲染层只负责播放。这样"共享"才真正落到可复用的粒度上，而不是停在"共享几个渐变函数"。

```js
// src/models/entities/guard-soldier.js
/** @type {import('../../core/contracts.js').EntityTemplate} */
export default {
  id: 'entity.soldier.guard',
  kind: 'enemy',
  model: 'model.soldier.basic',        // 指向 ModelAsset，可被换肤/替换
  stats: { speed: 0.6, hp: 1, radius: 9, value: 6 },
  traits: ['humanoid', 'melee', 'expendable'],
  source: 'runner',
};
```

**3D 接入方式（保持契约不变）**：3D 游戏就是 `Renderer.kind === 'webgl'` 的普通游戏 —— 宿主提供 `<canvas>` 与 WebGL2 上下文，`src/scene3d/**` 是被游戏 import 的**渲染工具库**，不是宿主强加给所有游戏的东西。这样现有两个 2D Canvas/SVG 游戏**零改动**，而新 3D 游戏也不需要另一套宿主 API。

**性能前提**（不可省略，否则 3D 游戏会毁掉合集的加载体验）：
- 模型一律 `load: 'lazy'`，且必须声明 `bytes`；首页不加载任何模型。
- 每个 3D 游戏在 manifest 里声明模型总字节预算，CI 检查。
- 必须提供 `fallback` 降级链（模型 404 时用几何体占位而不是黑屏）。
- 移动端默认降级：`dpr` 限制、可关闭后处理、低端设备走简化模型。

### 6.2 从 `boards.mjs` 里抽出的可复用件（**这是当前重复最多的地方**）

现有 `defs(prefix)` 每次渲染都重复生成一套几乎相同的渐变/滤镜（`-stone`、`-water`、`-lava`、`-gold`、`-wood`、`-screw`、`-shadow`…），而 `pinBoard` 与 `screwBoard` 各调一次，`metallic` 色板是硬编码数组。重构后：

```
src/ui/scene/svg-defs.js     → palette(theme) 返回 CSS 变量 + 按需注入的 defs 片段
src/ui/scene/primitives.js   → rounded / polygon / label / soldier / gem / metallicGradient
src/ui/scene/shell.js        → 统一的 .scene 容器、结果遮罩、burst 粒子
```

收益：换主题只改 `palette`；新增游戏不用再抄一遍渐变；`art.mjs` 的 `soldier/gateArt` 与 `boards.mjs` 的 `gem/foliage` 成为共享原语库的一部分。

### 6.3 音频：合成的保留，外部的可加

现状是 WebAudio 实时合成单音（[app.mjs:45-58](../app.mjs#L45-L58)），零字节资源、零加载延迟——**这是优点，应保留为默认**。`AudioManager` 设计成双通道：

```js
audio.sfx('click')          // 优先查外部音频文件，未登记则回落到合成音
audio.registerSynth('click', notes => ...)
audio.music('bgm.home')     // 标签页级 BGM，切游戏不重启
```

`music()` 在标签页级而非游戏级，避免玩家每换一个游戏音乐被打断重来。

### 6.4 UI 共享层

```
src/ui/tokens.css    设计令牌：色板/圆角/阴影/时长，由 theme 覆盖
src/ui/components/   button / badge / card / chip / dialog / hud / result-panel
src/ui/scene/        场景框架：容器 + 结果遮罩 + 粒子 + 无障碍状态区
```

现状中 `#game-hud` / `#result-panel` / `#level-picker` 的 HTML 是 `app.mjs` 里的模板字符串，`styles.css` 里对应 25KB 样式。抽成组件后，**新增游戏只写玩法，不写壳**。

---

## 7. 排行榜模块设计

### 7.1 排名算法（支持两种榜单口径）

```js
/**
 * @typedef {Object} LeaderboardQuery
 * @property {string} gameId
 * @property {number} [level]       省略=全部关卡聚合榜
 * @property {'best'|'total'|'stars'} [mode='best']
 * @property {'auto'|'local'|'global'} [scope='auto']
 * @property {number} [limit=50]
 * @property {string} [aroundUserId]  以某人为中心取 ±N（"我的名次"用）
 */
```

三种口径的计算方式：

| mode | 含义 | 聚合 |
| --- | --- | --- |
| `best` | 单关最高分（默认） | 按 `level` 过滤后取每人最大 `score` |
| `total` | 全游戏总分 | 每人所有关卡 `score` 求和 |
| `stars` | 星数榜 | 每人 `stars` 求和，**同分看通关数、再看总时长** |

**排序必须是确定性全序**，否则同分玩家名次会抖动：
`score desc → durationMs asc → updatedAt asc → userId asc`（最后一项保证即使全同分也有稳定顺序）。

### 7.2 并列名次规则

采用**竞技排名（1224）而非密集排名（1223）**：`rank = 1 + count(严格更优的记录)`。这样并列第三名之后是第五名，符合玩家直觉。名次在前端计算，不落库——落库会引入"插入一条记录要回写全榜"的写放大。

### 7.3 复合排行榜的坑（要在实现时处理）

`total` 与 `stars` 模式存在**刷榜漏洞**：玩家可以只玩 1 关刷到极高分就登顶总分。两种缓解，建议都做：

1. `total` 榜要求 `distinctLevels >= games[id].levels.length * 0.5`，不足者单独列出"未完成"区。
2. 榜单 UI 明确标注口径（"总分榜（需完成过半关卡）"），不静默隐藏。

### 7.4 纯静态下的诚实边界

本地排行榜 = **只有自己一条记录**。所以 `scope: 'local'` 的正确形态不是"排行榜"，而是**「我的成绩 + 本机历史趋势 + 与世界纪录/设计目标的差距」**。这一点必须诚实地反映在 UI 上，否则玩家会以为排行榜坏了。为此 `ProgressStore` 额外记录本地历史序列（用于折线图与"进步了多少"）。

`scope: 'global'` 留作适配器能力位：`adapter.capabilities = { remote: boolean }`，为 `false` 时 UI 自动隐藏全局榜单并显示"本地模式"角标。**这样将来接 `sqlite-adapter` 时，排行榜 UI 一行不用改。**

---

## 8. 用户与身份

```
src/services/identity.js
  getOrCreateUserId()   → 'u_' + crypto.randomUUID()，存于 settings 命名空间
  getNickname() / setNickname(name)
  displayName()          → nickname || '玩家' + userId.slice(-4)
```

- 首访即生成，无需注册（符合已选方案 A）。
- 改名只影响**之后**的成绩记录（昵称快照，见 §5.3）。
- 预留 `linkAccount(providerId)`：将来上账号体系时，把匿名 ID 迁移绑定到账号 ID，历史成绩按 `userId` 重写即可，排行榜逻辑不变。

---

## 9. 风险与应对

| 风险 | 触发条件 | 应对 |
| --- | --- | --- |
| **localStorage 5MB 配额** | 成绩记录累积 + 昵称快照，几万条后超限 | 适配器实现 `usage()`；超 80% 时对旧记录做**摘要压缩**（保留最高分与计数，丢弃 metrics 明细）；`quota exceeded` 异常走 `toast` 提示而非静默失败 |
| **纯静态下成绩可被玩家伪造** | 任何本地排行榜 | ① UI 明确标注"本地成绩" ② `engineVersion` + 记录结构校验 ③ 将来服务端校验时，只上传 `metrics` 由服务端重放验证（现有引擎是确定性纯函数，**这是本项目最大的可验证性优势**） |
| **资源缓存陈旧** | 更新了图/音频，玩家仍看到旧的 | `ResourceItem.version` + URL 查询串失效；`ResourceManager` 暴露 `invalidate(id)` |
| **游戏加载失败拖垮整个合集** | 某个 `renderer.js` 语法错误 | manifest 的动态 import 全部 `try/catch`，失败时卡片显示"该游戏暂时不可用"而不影响其他游戏；`fallback` 资源链降级 |
| **依赖方向被破坏** | 新游戏图省事直接 `import { ScoreStore }` | 加一个 10 行的 `scripts/check-boundaries.mjs` 进 `npm test`，扫 import 语句并断言无违规 |
| **现有 3 个游戏回归** | 重构中改坏数值 | 现有 141 行测试**全部保留**，纯规则层迁移时不改动一行断言——它们是这次重构的安全网 |

---

## 10. 目录结构骨架

```
WebGameCL/
├── index.html                 外壳（首页 + 统一游戏容器）
├── styles.css                 → 只保留 @import 令牌与全局重置
├── package.json               scripts: dev/test/build/balance/games:check/budget
│
├── src/
│   ├── main.js                入口：注册游戏、路由首页↔游戏、筛选
│   ├── router.js              hash 路由 #/ 与 #/play/<gameId>/<level>
│   ├── core/
│   │   ├── contracts.js       ✅已建：全部 typedef（唯一契约来源）
│   │   ├── registry.js        注册表：注册/解析/冲突检测
│   │   ├── lifecycle.js       会话：mount/pause/resume/settle/destroy
│   │   └── session.js         当前会话 + 归一化输入路由
│   ├── services/
│   │   ├── resource-manager.js
│   │   ├── audio-manager.js        （合成音保留为回落通道）
│   │   ├── score-store.js          ← 成绩唯一入口
│   │   ├── progress-store.js       ← 星级/解锁/设置（由成绩派生）
│   │   └── identity.js
│   ├── storage/
│   │   ├── adapter.js              ✅已建：端口定义 + 能力位 + 契约用例清单
│   │   ├── local-storage-adapter.js
│   │   ├── memory-adapter.js
│   │   └── index.js            createAdapter(kind) 工厂
│   ├── leaderboard/
│   │   ├── rank.js             纯函数：records → ranked[]（可单测）
│   │   └── view.js
│   ├── ui/
│   │   ├── tokens.css          设计令牌
│   │   ├── components/         button/badge/card/chip/dialog/hud/result-panel
│   │   └── scene/              shell.js / svg-defs.js / primitives.js
│   ├── assets/
│   │   ├── resource-loader.js
│   │   └── model-loader.js     glTF/GLB 解析
│   ├── models/
│   │   └── entities/           ★共享实体模板库（数据层，跨游戏复用）
│   └── scene3d/                ★3D 渲染适配层（kind:'webgl' 的游戏使用）
│       ├── context.js  loader.js  instances.js  animator.js
│
├── games/                      ★每个游戏一个目录，只依赖契约
│   ├── index.js               构建期生成，请勿手改
│   ├── _template/             贡献者脚手架（可直接改名使用）
│   ├── runner/    manifest.js engine.js render.js levels.js assets.js
│   ├── pins/      manifest.js engine.js render.js levels.js assets.js
│   └── screws/    manifest.js engine.js render.js levels.js assets.js
│
├── public/
│   ├── assets/
│   │   ├── brand/  art/  audio/{bgm,sfx}/        ← 全站共享
│   │   └── models/                               ← 共享 3D 模型
│   └── games/<id>/                               ← 游戏专属资源
│
├── tests/
│   ├── games.test.mjs         现有 141 行，迁移后断言不变
│   ├── contract.test.mjs      所有 manifest 的契约一致性
│   ├── storage.test.mjs       同一套用例跑所有适配器
│   ├── leaderboard.test.mjs   排名确定性、并列、聚合口径、刷榜约束
│   └── boundaries.test.mjs    依赖方向 + id 冲突断言
├── scripts/  serve.mjs build.mjs balance.mjs games-index.mjs check-boundaries.mjs budget.mjs
└── docs/     ARCHITECTURE.md · SCALING-AND-CONTRIBUTING.md · MIGRATION-MAP.md
```

**你期望的最终形态已经在目录结构里预留好了**：`games/**` 是"不同核心"的容器，`src/core/contracts.js` 是"共享入口"的法律条文，`src/{ui,assets,models,services}/**` 是"共享资源库"。三者之间只有单向依赖。

**新增一个游戏需要的动作**（设计目标：只碰 `games/` 下自己的目录）：

1. 复制 `games/_template/` 改名，写 `engine.js` + `render.js` + `levels.js`
2. 跑 `npm run games:index` 重新生成索引
3. 完。卡片、关卡选择、HUD、结果面板、成绩入库、排行榜、音效、暂停、无障碍全部由框架提供。

---

## 11. 迁移路径（不破坏现有可玩性）

按**风险从低到高**、每一步都可独立验证、可随时停下：

| 阶段 | 内容 | 验证方式 | 风险 |
| --- | --- | --- | --- |
| **P0 骨架** | 建目录、`contracts.js`、`storage/` + `memory/local` 适配器、`identity.js` | `storage.test.mjs` 契约测试通过 | 无（纯新增） |
| **P1 存储先行** | 把现有 5 处 `localStorage` 改走适配器，**保持数据形状与行为完全不变**（含旧数据迁移） | 手动：老进度能被读到；`tests` 全绿 | 低 |
| **P2 抽共享层** | `ui/scene/primitives.js` 从 `art.mjs`+`boards.mjs` 提公共原语；`audio-manager` 包装现有合成音 | 逐游戏对照截图无差异 | 低 |
| **P3 迁移第一个游戏（runner）** | 拆 `engine.mjs`→`games/runner/*`，写 manifest，走新 lifecycle | 224 条路线测试**一字不改**地通过 | 中（首个验证架构） |
| **P4 迁移其余两个** | pins / screws 同法 | 918 拉针顺序、6 棋盘可解性测试不变 | 中 |
| **P5 排行榜** | `rank.js` 纯函数 + 榜单 UI；`scope:'local'` 形态 | `leaderboard.test.mjs` 覆盖并列/聚合/约束 | 低 |
| **P6 资源外置** | 建立 `public/assets/`，`ResourceManager` 接管；合成音保留为回落 | 断网/资源 404 时游戏仍可玩 | 低 |
| **P7 入口收口** | hash 路由、首页卡片由注册表生成（不再硬编码 3 张卡） | 新增第 4 个游戏零改壳 | 低 |

**关键顺序原则**：**P1（存储）与 P2（共享层）先于 P3（迁移游戏）**。因为存储和 UI 壳是两个游戏都要用的横切面，先做完，游戏迁移就变成机械搬运，而不是边搬边改设计。

---

## 12. 为将来接后端预留的接口

已选方案 A（纯静态 + 可替换适配器），因此后端相关设计**只体现在契约里，不写实现**：

```js
// src/storage/sqlite-adapter.js —— 将来新增，不修改任何现有业务代码
export function createSqliteAdapter({ endpoint }) {
  return {
    capabilities: { remote: true, orderBy: true, paginate: true },
    get, put, remove, list, clear, usage,
    // 排行榜下推到 SQL：SELECT ... ORDER BY score DESC LIMIT ?
    top({ gameId, level, mode, limit, aroundUserId }) { /* fetch */ },
  };
}
```

需要现在就埋好的三件事：

1. **适配器可选声明 `capabilities`**——UI 据此决定是"本地模式"还是真排行榜。
2. **成绩记录必须自带 `userId/nickname/engineVersion/createdAt`**——否则上传时无法重建榜单口径。
3. **`ScoreStore` 的方法签名按"可能远程"设计**（异步、分页、可传 `aroundUserId`）——同步签名将来是破坏性变更。

**服务端权威校验的天然优势**：本项目三个引擎都是**确定性纯函数**（`runnerBalance` 穷举、`solveScrews` DFS、`Pins.safePins`），服务端可以只接收 `(gameId, level, 操作序列)` 并**重放验证**分数，无需信任客户端上报的分值。这比一般小游戏"信客户端数字"的做法强得多，值得在实现排行榜时就把 `metrics` 里的操作序列记录下来。

---

## 13. 尚待确认的开放问题

已确认：部署形态（A）、身份（A）、引擎接入（A）、本轮范围（A）、**规模=可能很多 + 开源 + 多人**、**模型=3D 资源 + 实体模板库**。
由此新增的三个决策已写入 [SCALING-AND-CONTRIBUTING.md](SCALING-AND-CONTRIBUTING.md)：生成式显式索引、契约版本策略、首包预算守护。

仍需你拍板：

1. **排行榜要真实榜单吗**：若确定要，P5 之后直接加 `sqlite-adapter`（Node + SQLite，约 150 行）即可；若暂不要，本地榜按 §7.4 做成"我的成绩 + 目标差距"形态。
2. **主题/换肤**：是否支持多套主题？这决定 `tokens.css` 与 `palette()` 的抽象程度。
3. **移动端优先级**：若移动端为一等目标，`Renderer.mount` 需约定安全区与手势冲突处理（赛道拖动 vs 页面滚动），建议在 P3 一并定下。
4. **是否需要真正的 3D 首发游戏**：若近期就有，`src/scene3d/**` 要从"预留目录"提前到 P2 建设，否则可以先只落 `ModelAsset` 契约与实体库，渲染适配往后放。
