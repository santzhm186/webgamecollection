# 迁移映射表

> 从现状（扁平 6 文件 + 241 行 app.mjs）到目标架构的**逐文件搬运清单**。
> 原则：**现有 141 行测试的断言在迁移过程中一行都不改** —— 它们是这次重构的安全网。

---

## 1. 文件级映射

| 现状 | 去处 | 处理方式 | 风险 |
| --- | --- | --- | --- |
| `engine.mjs` → `RUNNER_LEVELS`/`applyGate`/`Runner`/`runnerBalance` | `games/runner/levels.js` + `games/runner/engine.js` | 原样搬运，`Runner` 增加 `hud()`/`metrics()` | 低 |
| `engine.mjs` → `PIN_LEVELS`/`PIN_LABELS`/`Pins` | `games/pins/levels.js` + `games/pins/engine.js` | 原样搬运；`PIN_LABELS` 归游戏私有（宿主不该认识"引水/排气"） | 低 |
| `engine.mjs` → `SCREW_LEVELS`/`SCREW_RULES`/`Screws`/`solveScrews`/`screwPosition` | `games/screws/levels.js` + `games/screws/engine.js` | 原样搬运 | 低 |
| `art.mjs` → `drawRunner` | `games/runner/render.js` | 包装成 `GameRenderer{kind:'canvas'}` | 中 |
| `art.mjs` → `rounded`/`label`/`polygon`/`soldier`/`gateArt` | `src/ui/scene/primitives.js`（共享） | 提取；`soldier`/`gateArt` 保留在 runner 内，仅 `rounded/label/polygon` 上提 | 低 |
| `boards.mjs` → `pinBoard` | `games/pins/render.js` | 包装成 `GameRenderer{kind:'dom'}` | 中 |
| `boards.mjs` → `screwBoard` | `games/screws/render.js` | 同上 | 中 |
| `boards.mjs` → `defs()`/`metallic`/`gem`/`foliage`/`explorer`/`screwHead` | `src/ui/scene/svg-defs.js` + `src/ui/scene/primitives.js` | 提取共享；`defs(prefix)` 改为 `palette(theme)` 按需生成 | 中 |
| `boards.mjs` → `PIN_POINTS` | `games/pins/render.js` | **必须搬走**：它是 pins 私有布局，宿主不该知道坐标 | 低 |
| `app.mjs` → `games` 注册表 | `src/core/registry.js` + `games/index.js` | 改为读 manifest | 中 |
| `app.mjs` → `unlocked()` | `src/services/progress-store.js` | 搬家；命名改 `unlockedLevel(gameId)` | 低 |
| `app.mjs` → `hud()` 的三个分支 | 各游戏 `engine.hud()` | **消除硬编码分支**（本次重构的核心收益之一） | 低 |
| `app.mjs` → `updateStatus()` / `result-panel` / `renderPicker()` | `src/ui/components/{hud,result-panel,level-picker}.js` | 提取为共享组件 | 中 |
| `app.mjs` → `animate()` | `src/core/lifecycle.js` | 改为"引擎声明需要帧才跑 rAF"，pins/screws 保持零帧 | 中 |
| `app.mjs` → `playTone()` | `src/services/audio-manager.js` | 保留合成音为默认通道，登记为 `sfx.click/win/lose/fall` | 低 |
| `app.mjs` → 5 处 `localStorage` | 经 `src/services/score-store.js` / `progress-store.js` | **P1 优先做**：先用适配器包住，行为完全不变 | 低 |
| `app.mjs` → `wande-dao-progress-v2` 迁移逻辑 | `src/storage/migrations/` | 保留为一次性迁移，读旧键写新 schema | 低 |
| `index.html` → `<dialog>` 骨架 | 保留在 `index.html`，内容由组件填充 | 不拆 HTML，避免破坏现有样式 | 低 |
| `styles.css` (25KB/26 行) | 拆 `src/ui/tokens.css` + 组件样式 | 可延后；先保证不回归 | 中 |
| `scripts/serve.mjs` | 增加 `.glb`/`.gltf`/`.png` 等 MIME | 3D 模型必需 | 低 |
| `scripts/build.mjs` | 增加 `public/` 拷贝 + 生成 `games/index.js` | — | 低 |

---

## 2. 现有测试的归属（不改断言）

| 现状测试 | 去处 | 改动 |
| --- | --- | --- |
| 224 条冲关路线与星级门槛 | `tests/games/runner.test.mjs` | 仅改 import 路径 |
| 冲关逐渐变难、三星路线可达 | 同上 | 无 |
| `tick` 等待开始 / 夹紧延迟 / 忽略非法 delta | 同上 | 无 |
| 918 种拉针顺序与独立危险双解 | `tests/games/pins.test.mjs` | 仅改 import 路径 |
| 提示必然给出安全解 | 同上 | 无 |
| 重复/未知/失败后操作无副作用 | 同上 | 无 |
| 6 个螺丝棋盘可解 + 三孔片 | `tests/games/screws.test.mjs` | 仅改 import 路径 |
| 遮挡螺丝不可拆 | 同上 | 无 |
| 三孔片满槽释放次序 | 同上 | 无 |
| 撤销一次恢复失败 | 同上 | 无 |
| 提示给出可解续招、终局拒绝撤销 | 同上 | 无 |

**新增测试**（本方案引入的抽象必须自带测试）：
`tests/contract.test.mjs`（每个 manifest 的必需字段与动态 import）、
`tests/storage.test.mjs`（同一套用例跑所有适配器）、
`tests/leaderboard.test.mjs`（并列、聚合口径、刷榜约束、确定性全序）、
`tests/boundaries.test.mjs`（games/** 不得 import services/ui/storage）。

---

## 3. 阶段验收清单

每个阶段结束时，必须同时满足"自动化通过"与"人工确认"两栏。

| 阶段 | 自动化 | 人工 |
| --- | --- | --- |
| **P0 骨架** | `storage.test.mjs` 全绿（两个适配器跑同一套用例） | 目录结构符合 §10；`contracts.js` 无运行时代码 |
| **P1 存储** | `tests/games*` 全绿；新增旧数据迁移用例 | 老玩家的星级/分数**在新版里完全一致**；隐私模式下游戏仍可玩 |
| **P2 共享层** | `boundaries.test.mjs` 全绿 | 三个游戏画面与重构前**逐像素对照无明显差异**；音效听感不变 |
| **P3 runner 迁移** | ✅ 已完成：224 条路线测试**断言未改**通过；14 项框架测试，另有注册表加载与宿主交互回归 | ✅ 浏览器端到端验收通过（见下） |
| **P4 pins + screws 迁移** | 918 顺序 + 6 棋盘测试通过 | 盲测：不提示能否通关、提示后星级下降正确 |
| **P5 排行榜** | `leaderboard.test.mjs` 全绿 | 本地模式下榜单文案诚实（不假装有他人成绩） |
| **P6 资源外置** | 首包预算 CI 通过 | 断网 / 单个资源 404 时游戏仍可玩（走 fallback） |
| **P7 入口收口** | 新增第 4 个游戏零改壳 | 首页卡片由注册表生成，筛选/搜索仍正确 |

---

## 4. 明确不做的（避免范围蔓延）

- 不在本次重构中改动任何**玩法数值**。数值改动与结构重构必须分 PR，否则回归无法归因。
- 不引入 npm 运行时依赖（含 three.js 初期也不引入，`scene3d` 先用原生 WebGL2）。
- 不重写 `styles.css` 的视觉设计，只做拆分与令牌抽取。
- 不改 GitHub Pages 的相对路径约定。

---

## 5. 旧数据迁移细节（P1 必须处理）

现状键与形状：

```js
localStorage['wande-dao-progress-v2'] = { runner:[{stars,score}...], pins:[...], screws:[...] }
localStorage['wande-dao-completed']   = ['runner','pins',...]        // 更早的版本
localStorage['wande-dao-sound']       = 'true' | 'false'
```

目标 schema（namespace 化 + 加上 userId/engineVersion）：

```
scores:<userId>:<gameId>:<level>   → ScoreRecord
progress:<userId>:<gameId>:<level> → ProgressRecord
settings:<key>                     → 本机设置
identity:device                    → { userId, nickname }
meta:adapter-version               → 2
```

迁移规则：

1. 首次启动若 `meta:adapter-version` 缺失，执行一次性迁移。
2. `wande-dao-progress-v2` 的每个 `{stars, score}` → `ProgressRecord{stars, bestScore: score}`，**并同时生成一条 `ScoreRecord`**（`metrics: {}`、`engineVersion: '0.2.0'`、`nickname` 用当时的昵称或默认名），否则老玩家的成绩在排行榜里会消失。
3. `wande-dao-completed` 作为更早的降级依据（沿用现状逻辑：runner 记 1 关，其余各记 3 关，星级 1）。
4. `wande-dao-sound` → `settings:sound`。
5. 迁移**不删除旧键**（保留一个版本周期，便于回滚），仅在 `meta` 里标记完成。
6. 迁移必须是**幂等**的：重复执行结果一致。


---

## 6. P3 实际踩到的坑（供 P4 参考）

这次迁移暴露的问题都不是"架构不对"，而是**契约边界上的静默错误** —— 它们没有报错，
只表现为"点了没反应"，因此值得逐条记下来：

| 现象 | 真实原因 | 教训 |
| --- | --- | --- |
| 卡片按钮点了完全没反应 | `[data-open]` 监听器在 `renderCards()` **之前**绑定，而卡片是之后动态生成的 | 动态生成的元素一律用**事件委托**，不要逐个绑定 |
| 开局静默失败、无任何报错 | `openGame` 内 `startLevel` 抛错但没有 try/catch，且测试环境没有 window 错误监听 | 所有异步入口都要 try/catch 并给出可见反馈 |
| pins/screws 点击无反应 | `renderer.mount(area, engine, **gameContext**)` 传了原始上下文，而 `dispatch` 在 `session.ctx` 里 | **传错上下文不会有任何报错**，只在 `startLevel` 加显式检查 |
| 整站模块加载失败 | `games/index.js` 的 JSDoc 注释里写了 `games/*/manifest.js`，`*/` **提前关闭了块注释** | 注释里不要出现 `*/` 字面量 |
| 模块全部 404 | `serve.mjs` 只服务 `.html/.css/.mjs`，新增的 `.js` 全被拒 | 新增文件后缀必须同时加进服务器的 MIME 表 |
| 测试无法验证逐帧逻辑 | 无头 Chrome 里 `requestAnimationFrame` **只回调一次** | 提供 `__dsh.step(dt)` / `pump(s)` 手动推帧，复用与 rAF 相同的代码路径 |

另外两条与语言相关的坑（P0/P3 各一次）：`data-i18n` 用 `textContent` 赋值会**清空容器子节点**
（曾导致整站白屏）；搜索索引只索引当前语言的名称，导致"换个语言就搜不到"。


## 7. 宿主回归修复

首页改为只加载 manifest 与静态 SVG 插画，`levelCount` 驱动关卡进度；打开游戏才加载玩法模块。卡片文案键与插值参数按游戏设置，切换语言保留正确进度。全页面委托覆盖主 CTA。

螺丝满槽后保留引擎允许的撤销，恢复时清除旧失败结果与结算；后续胜利正常保存并解锁。模板改用统一 `ctx.dispatch({type, args})` 协议，开始后立即重绘，监听只在挂载时绑定。

自动化覆盖见 `tests/app.test.mjs`、`tests/registry-loading.test.mjs`、`tests/framework.test.mjs` 与模板测试。异步加载关闭/切换竞态也在宿主测试中验证。
