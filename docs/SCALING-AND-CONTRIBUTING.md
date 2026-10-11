# 规模化与多人协作

> 本文回答一个问题：当游戏从 3 个变成几十个、贡献者从 1 人变成几十人时，
> 架构需要额外做什么。这是对 [ARCHITECTURE.md](ARCHITECTURE.md) 的补充。

---

## 1. 注册表：用「生成式显式索引」而非运行时扫目录，也不用 Vite glob

游戏数量增长后，注册表有三种做法：

| 做法 | 静态可分析 | 需要构建期代码生成 | 无打包器可用 | 结论 |
| --- | --- | --- | --- | --- |
| 手写 `games/index.js` | ✅ | ❌ | ✅ | 几十个游戏时手写容易漏、容易冲突 |
| 运行时 `fetch` 扫目录 | ❌ | ❌ | ❌ | 需要目录列表接口，纯静态托管没有 |
| `import.meta.glob`（Vite） | ✅ | — | ❌ | **引入打包器**，违背零依赖前提 |
| **构建期生成 `games/index.js`** | ✅ | ✅ | ✅ | **采用** |

**方案**：`scripts/games-index.mjs` 扫描 `games/*/manifest.js`，生成：

```js
// games/index.js —— 由 scripts/games-index.mjs 生成，请勿手改
export const MODULES = [
  () => import('./runner/manifest.js'),
  () => import('./pins/manifest.js'),
  () => import('./screws/manifest.js'),
];
```

挂在 `predev` / `prebuild` 上自动跑，并在 CI 里校验「生成结果 == 已提交文件」，防止有人只改游戏不跑生成。

**为什么坚持显式**：显式索引让每个游戏**可被静态分析、可被 tree-shake、可被单独测试和单独构建**。运行时扫目录会让构建产物体积失控，也会让"某个游戏加载失败"变成整站故障。

### 冲突检测（多人协作必备）

宿主启动时校验，任一不满足即拒绝启动并在控制台给出明确修复指引：

- `id` 全局唯一（两人同时开发撞名是最常见的协作事故）
- `id` 符合 `^[a-z][a-z0-9-]*$`（成绩库键稳定性）
- 每个模块的 `engineVersion` 存在且是合法 semver
- `scoring.order` 必须是 `asc` / `desc`
- 无两条记录的 `title` 完全相同（搜索体验）

---

## 2. 懒加载预算

游戏多了以后，**首页加载量必须与游戏数量解耦**：

```
首页加载：index.html + styles + main.js + registry.js + N × manifest.js
         manifest 只是一堆动态 import 函数，单个 < 1KB
点开游戏：+ engine.js + render.js + levels.js + 该游戏资源
```

要有自动化守护，否则半年后首页会悄悄变成几 MB：

- CI 断言 `首页首包 < 150KB`（gzip 前），超标即失败。
- `ResourceItem.load: 'eager'` 只允许品牌资源使用；游戏自己的资源一律 `lazy`。
- 单个游戏首包超过预算的，CI 给出告警并附上文件明细。

---

## 3. 契约版本策略（开源后最重要的一件事）

外部贡献者的游戏会长期存在于仓库之外，所以**契约一旦发布就不能随便改**：

| 变更类型 | 示例 | 处理 |
| --- | --- | --- |
| **向后兼容**（加可选字段） | `ctx` 增加 `vibrate()`、`GameEngine` 增加可选 `teardown()` | 直接加，但用 `typeof` 探测；不提升主版本 |
| **行为变更** | 星级算法、结算时机、HUD 更新频率 | 提升 `HOST_API_VERSION` 次版本；在 CHANGELOG 里写清影响 |
| **破坏性变更** | 改 `tick` 签名、改 manifest 必需字段 | 提升主版本；**保留上一版适配层**，按 manifest 声明的 `hostApi` 做兼容包装 |

游戏在 manifest 里声明 `hostApi: '^1.0.0'`，宿主加载时判断：

- 兼容 → 正常加载
- 主版本落后但存在适配层 → 用适配层包装，控制台给 deprecation 警告
- 完全不兼容 → 卡片显示"该游戏需要更新"，**不崩溃、不影响其他游戏**

**加载隔离**：所有 manifest / engine / renderer 的动态 import 必须包在 `try/catch` 里。一个贡献者的语法错误只能让那一张卡片降级，绝不能让整个合集白屏。

---

## 4. 贡献者工作流

### PR 必过的四道门

```
1. npm run test          契约测试 + 边界测试 + 各游戏玩法测试
2. npm run games:check   索引生成结果与提交一致、id 无冲突
3. npm run budget        首包预算未超标
4. 人工 review           数值合理性 + 无障碍（键盘可达、aria-live、reduced-motion）
```

### CODEOWNERS 分区（开源后立即需要）

```
games/**          @维护者组       # 防止贡献者互相踩到对方的游戏
src/core/**       @架构组         # 契约层改动需要更严格 review
src/storage/**    @架构组
docs/**           任何人
```

### 新游戏模板

[`games/_template/`](../games/_template/) 提供可直接改名的最小实现，含：manifest 骨架、极简引擎（含 `hud`/`metrics`）、极简 DOM 渲染器、一个可通过测试的关卡、以及对应的测试骨架。**降低首次贡献门槛比写更多文档有效。**

---

## 5. 安全与信任边界（开源 + 外部贡献引入的新问题）

纯静态站 + 第三方代码，有三条现实风险：

| 风险 | 说明 | 应对 |
| --- | --- | --- |
| **恶意/失控的游戏代码** | 游戏拥有与宿主相同的权限，能读 localStorage（含他人成绩、昵称） | 同源下无法真正沙箱化。缓解：① 所有游戏必须经 PR review 合并（不允许运行时加载未审计的远程脚本）② 成绩与设置分 namespace，游戏拿不到 `ScoreStore` 句柄 ③ 未来可选用 iframe + `sandbox` + `postMessage` 隔离高风险游戏 |
| **成绩被玩家伪造** | 本地排行榜无法防 | ① UI 明确标注本地成绩 ② 成绩记录结构校验 ③ **确定性引擎的天然优势**：只上传 `metrics` 里的操作序列，服务端重放验证，不信任上报的 `score` |
| **依赖投毒** | 贡献者引入 npm 包 | **继续保持零运行时依赖**。这条不只是洁癖：它是"没有供应链攻击面"的唯一保证，也是首包体积可控的前提。新增依赖需要在 PR 里单独论证 |

**积分/成就的写权限**：`ScoreStore` 只接受 `engine` 结算后的结果，不接受游戏直接 `setScore(9999)`。星级同样由引擎判定、宿主只存。这条边界要在 review 里把关。

---

## 6. 目录会如何继续长

```
src/
  core/        契约、注册表、生命周期、会话
  services/    资源、音频、成绩、进度、身份、成就(未来)
  storage/     适配器（local / memory / 将来 sqlite）
  leaderboard/ 排名纯函数 + 视图
  ui/          令牌、组件、场景
  assets/      资源加载与解析（含模型）
  models/      共享实体模板库（数据层）
  scene3d/     (未来) WebGL/three 渲染适配层
  social/      (未来) 分享、好友、挑战链接
```

**扩展原则**：新的横切能力一律加在 `services/` 并通过 `ctx` 注入，不新增游戏对宿主的 import。这样游戏目录永远保持"只依赖契约"，多人和长期协作才不会退化成意大利面。
