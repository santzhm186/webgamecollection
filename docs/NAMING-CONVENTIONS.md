# 命名与字典约定

> 📌 **本文件是「命名与字典」的细则。** 项目级规则总表见 [CONVENTIONS.md](../CONVENTIONS.md)，
> 设计取舍的原因见 [DECISIONS.md](DECISIONS.md)（相关决策：D11 四层字典、D12 多语言、D14 命名）。
>
> **这是本项目最需要被遵守的一份文档。** 它回答一个问题：**我要加一个新东西，该叫什么名字、放在哪里？**
>
> 约定不是靠自觉维持的 —— 本文的每一条都有对应的自动化测试（`tests/dictionary.test.mjs`），违反会在 CI 阶段失败。

---

## 0. 先记住一句话

> **宿主需要在代码里 `if` 它的 → 放进 `src/core/`；只有自己认识的 → 放进 `games/<id>/`；
> 玩家能看见的 → 必须有文案键。**

违反这一条，项目会以最典型的方式烂掉：同一个概念出现 3 个不同拼写、一个词在 4 个文件里各定义一次、
改一处漏三处、新增语言时满屏漏翻译。

---

## 1. 字典分四层，各有归属

| 层 | 文件 | 放什么 | 谁能加成员 | 强制度 |
| --- | --- | --- | --- | --- |
| **闭合枚举** | `src/core/enums.js` | 宿主需要判断的机器值：状态、kind、分类、音效名、namespace | 只有宿主，且算契约变更 | T5/T6 测试 |
| **共用显示文案** | `src/core/labels.js` | 跨游戏共享的领域词汇：难度分级、分类名、语气、星级图形 | 宿主（PR 审核） | 单元测试 |
| **多语言文案** | `src/locales/<code>.js` | **所有面向玩家的字符串** | 任何人，但必须补全所有语言 | T1/T3/T4 测试 |
| **游戏私有字典** | `games/<id>/dictionary.js` | 只有这个游戏认识的词汇与领域常量（机关名、孔位、私有几何） | 该游戏贡献者自己 | T3/T5 测试 |

### 判断流程（加新名字时照着走）

```
我要加一个名字
├─ 它是玩家能看到的文字吗？
│   ├─ 是 → 加进 src/locales/*.js 的**所有**语言文件，用 t('key') 取值   ← 规则 R1
│   └─ 否 ↓
├─ 宿主需要在代码里判断它吗（if / switch / 筛选 / 排序）？
│   ├─ 是 → 加进 src/core/enums.js（并在 ALL_ENUMS 登记、写明注释）
│   └─ 否 ↓
├─ 只有我这个游戏认识它吗？
│   ├─ 是 → 加进 games/<id>/dictionary.js（并在 dictionaryKeys 里登记）
│   └─ 否 → 加进 src/core/labels.js（共用领域词汇）
```

**反例**：`'引水' / '排空' / '排气'` 是 pins 的机关名。宿主永远不需要 `if (pin === '引水')`，
所以它**不属于** `enums.js`，也不属于 `labels.js` —— 它属于 `games/pins/dictionary.js`。
宿主若认识这些词，第二个游戏就无法定义自己的机关名了。

---

## 2. 文案键命名规则

```
键路径 = <area>.<subject>[.<detail>]
全小写；段内允许 camelCase；最多四段；area 必须在白名单内
```

**area 白名单**（新增 area 需要改测试与本文档，属于约定变更）：

| area | 用途 |
| --- | --- |
| `app` | 全站标识、页脚、版本号 |
| `nav` | 侧栏导航、分类名、语言 |
| `home` | 首页英雄区、搜索、卡片列表、底部条 |
| `dialog` | 游戏容器：标题栏、关卡选择、工具栏、结果面板、按钮 |
| `status` | 游戏状态栏与通用提示 |
| `progress` | 进度、星级、通关数 |
| `result` | 结算面板明细 |
| `common` | 跨游戏通用短词（星级、关卡、难度、分数） |
| `game` | **游戏专属文案，第三段必须是 manifest id** |

示例：

```
home.collectionTitle          首页合集标题
dialog.assistGoalRunner       游戏容器的辅助目标说明（runner 专属但归 dialog，因为是宿主渲染）
game.pins.level3              pins 第三关的标题（游戏专属）
game.runner.hudArmy           runner 的 HUD 字段名
common.difficultyEntry        难度"入门"（跨游戏共用）
```

### 六条硬规则

| # | 规则 | 违反后果 | 由谁强制 |
| --- | --- | --- | --- |
| **R1** | 面向玩家的字符串**必须**有键，禁止在 `.js`/`.html` 里直接写文案字面量 | 新增语言时漏翻译；文案散落无法统一改 | T4 测试（扫描 JS 字符串与 HTML 文本节点） |
| **R2** | 游戏专属文案一律放 `game.<id>.*`；宿主区域禁止出现某个游戏的专有名词 | 宿主与游戏耦合，第二个游戏无法复用 | T1 测试（area 与游戏 id 白名单） |
| **R3** | 变量用 `{name}` 占位，由 `t(key, params)` 插值；**禁止字符串拼接** | 其他语言无法调整语序 | T1 测试（占位符跨语言一致） |
| **R4** | 单位/量词写进文案，不写进代码（`common.levels` = `"{n} 关"`） | 语序与量词无法本地化 | 人工 review |
| **R5** | 新增键必须补全**所有** locale | 玩家看到键名本身 | T1 测试（键集完全一致） |
| **R6** | 语言简称（`中` / `EN`）放 `src/core/locales.js`，不进文案文件 | 语言选择器无法在未知语言下正确显示 | T1 测试（键格式校验） |

---

## 3. 三种使用方式

### ① 声明式（HTML 静态文案）

```html
<h1 data-i18n="home.title1">别光看。</h1>
<input data-i18n-attr="aria-label:home.searchLabel,placeholder:home.searchPlaceholder">
<span data-i18n="progress.levels" data-i18n-params="n:0,total:3">0 / 3 关</span>
```

> ⚠️ **含子元素的容器不能用 `data-i18n`。** `applyToDocument()` 用 `textContent` 赋值，
> 会**清空子节点**。本项目踩过这个坑：`<span id="footer-year" data-i18n="…">…<span id="year">`
> 导致 `#year` 变成 `null`，整个 `app.mjs` 在初始化时崩溃、整站白屏。
>
> 正确做法：让子节点各自带 `data-i18n`，或改用命令式渲染。

### ② 命令式（JS 动态文案）

```js
t('game.runner.win', { arrived: 156, left: 46, stars: 3 })
t('progress.levels', { n: 0, total: 3 })
```

### ③ 游戏侧私有词汇（不直接面向玩家的键名 → 文案）

```js
// games/pins/dictionary.js
export const PIN_LABEL_KEYS = Object.freeze({ water: 'game.pins.pinWater', /* … */ });
export const pinLabel = pin => t(PIN_LABEL_KEYS[pin]);
export const dictionaryKeys = Object.freeze([...Object.values(PIN_LABEL_KEYS)]);  // ← 供 T3 校验
```

游戏字典必须导出 `dictionaryKeys`，否则测试无法校验它的键是否真的存在。

---

## 4. 加一门新语言（三步）

1. `src/core/locales.js` 的 `LOCALES` 加一条（`code` 用 BCP 47，`label` 用该语言的自称，`status` 先标 `beta`）
2. 新建 `src/locales/<code>.js`，默认导出与 `zh-CN` **完全相同的键集**
3. `src/locales/index.js` 的 `BUNDLES` 注册

**不需要改的地方**（这是这套设计的目的）：`index.html`、`app.mjs`、任何游戏代码、任何渲染层。
语言选择器由 `localeOptions()` 自动渲染。

`?lang=en` 可直接切换语言且**不写入**持久化设置（便于分享链接与端到端测试）。

---

## 5. 加一个音效 / 一个分类 / 一个状态

| 要加的东西 | 动作 |
| --- | --- |
| 音效 | `enums.js` 的 `SFX` 加成员（带注释）→ `audio-manager` 登记合成音或音频文件 → 游戏在 `manifest.uses.sfx` 引用 |
| 分类 | `enums.js` 的 `CATEGORY` 加成员 → `labels.js` 的 `CATEGORY_LABEL` 加显示名 → `index.html` 侧栏加筛选按钮 → `src/locales/*.js` 加 `nav.<category>` |
| 引擎状态 | 慎重：`ENGINE_STATUS` 是宿主生命周期判断的依据，加成员要同步 `lifecycle.js` 与本文档 |
| 难度分级 | 改 `labels.js` 的 `DIFFICULTY` + 所有语言文件 + `DIFFICULTY_TONE`；测试会强制数量和顺序 |

---

## 6. 已知偏离与历史包袱（诚实记录）

| 偏离 | 现状 | 计划 |
| --- | --- | --- |
| `DIFFICULTY` 的值是中文（`'入门'`） | 它同时作为 `engine.mjs` 关卡数据里的机器值使用，并被三个游戏共享 | 改为英文键（`ENTRY`）需同步三套关卡数据 + `?lang` 显示映射；等 P3/P4 拆分游戏目录时一并处理。当前用 `difficultyLabel()` 做显示映射，英文语境已正确 |
| `engine.mjs` 仍是三合一 | 三个游戏的规则与关卡数据还没拆到 `games/<id>/` | P3/P4；接缝已定（`titleKey` / `DIFFICULTY` / `pinLabel` / `screwPosition` 已就位） |
| `SCREW_LEVELS`（布局）与 `SCREW_LEVEL_META`（元数据）是两个常量 | 原名 `SCREW_RULES` 语义含糊，已改名 | 拆分到 `games/screws/` 时可合并为单一的 `SCREW_LEVELS` |
| `boards.mjs` 仍再导出 `PIN_POINTS` | 兼容旧调用点 | P3/P4 后由调用方直接从 `games/pins/dictionary.js` 取 |

---

## 7. 测试如何强制这些约定

`tests/dictionary.test.mjs` 的六组用例：

| 组 | 强制内容 |
| --- | --- |
| **T1** | 所有 locale 键集一致；键名格式与 area 白名单；`game.<id>` 的 id 已注册；占位符跨语言一致；**同值键检测**（抓真冗余 —— 曾据此抓出 `progress.locked` 与 `dialog.levelPending` 完全重复） |
| **T2** | `t()` 插值；缺键返回键名而非空串；英文缺键回落默认语言；`setLocale` 幂等与订阅通知；取消订阅后不再回调；`parseParams` |
| **T3** | 游戏字典声明的键真实存在 |
| **T4** | JS 与 HTML 里不得硬编码面向玩家的中文（白名单只接受开发者诊断信息） |
| **T5** | `games/**` 只能 import 自己或 `src/core/host-surface.js`；不得引入外部裸模块 |
| **T6** | 渲染层可被真实加载（**曾抓出整站白屏**：`boards.mjs` 把模板插值写进单引号字符串，`node --check` 与原有测试都没发现）；渲染层不得反向依赖规则层 |

### 两条来自实战的教训

1. **`node --check` 不够。** 它只校验单文件语法，不解析依赖图。`boards.mjs` 的语法错误让 `app.mjs`
   整个模块树加载失败，而 `node --check app.mjs` 仍然通过。**必须真实 import 一次**（T6）。
2. **必须用真实浏览器验证。** `serve.mjs` 当时只服务 `.html/.css/.mjs` 三种后缀，
   新增的 `.js` 模块全部 404，浏览器报 `Failed to fetch dynamically imported module`，
   而 Node 侧测试全绿。渲染层的最终验证只能在浏览器里做。

### v0.3：多段游戏 id

`game.<id>.*` 中的第二段保留 manifest 的 kebab-case id，例如 `game.water-sort.hudTarget`。其余文案键段继续使用 camelCase。注册游戏 id 由测试读取 `games/index.js` 验证，不维护第二份游戏白名单。
