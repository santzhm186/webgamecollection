# 新游戏模板

复制整个目录、改名、补充宿主文案并登记加载器，就能接入一个游戏骨架。

```sh
# 1. 复制并改名（例子：做一个叫 light-switch 的游戏）
cp -r games/_template games/light-switch

# 2. 全局替换模板标识
#    my-game      → light-switch     （manifest.id，成绩库 gameId，发布后不可改）
#    MyGameEngine → LightSwitchEngine （类名）

# 3. 将 dictionary.js 的 zh-CN / en 文案合入 src/locales/ 对应语言包
#    修改 manifest 的序号、levelCount（必须与关卡数据一致）与文案内容
# 4. 在 games/index.js 登记 () => import('./light-switch/manifest.js')
# 5. 改玩法和测试，然后验证并起服务
npm test
npm run build
npm run dev
```

## 这个模板教了你什么

| 文件 | 演示的契约要点 |
| --- | --- |
| `manifest.js` | 无副作用、用动态 import、声明 `engineVersion`、`hostApi` 与 `levelCount`；显示字段使用文案键 |
| `engine.js` | 无 DOM、状态全在实例、`hud()` 自述指标、`metrics()` 记录操作序列。模板玩法不需要连续帧，所以**故意不实现 `tick`** —— 演示"静止时零 CPU" |
| `render.js` | `mount(host, engine, ctx)` 只绑定一次；点击通过 `ctx.dispatch({ type: 'pick', args: [index] })` 上报；`draw(engine)` 只读取状态；`destroy()` 完整解绑 |
| `levels.js` | 关卡数据与逻辑分离，宿主与平衡脚本都直接读它；起步数值由「最少步数」反推而来 |
| `dictionary.js` | 未注册模板的中英文独立预览回落；正式接入时引擎和渲染器优先用宿主 `ctx.t`，首页文案仍须补入宿主语言包 |
| `template.test.mjs` | 存在解、非法操作无副作用、**三星门槛可达**、分数可重放、输入派发、监听解绑与文案契约 |

测试文件使用同目录导入；复制目录后可通过 `node --test games/light-switch/template.test.mjs`
单独运行，并在正式提交前把测试加入 `package.json` 的 `test` 脚本。

渲染器不得直接调用 `engine.pick()`。宿主接收输入后统一推进会话、重绘、检测结算并保存成绩，
因此重开、换关、撤销和未来扩展都经过同一条流程。游戏状态只存在引擎里；
渲染器闭包仅保留容器、翻译函数和待解绑的监听器。

> 模板自身踩过一个值得记住的坑：最初的关卡数值（target=24 / 三星上限 5 步）在数学上**不可能**达成三星。
> 所以第 4 条测试用广度优先搜索**证明**三星可达，而不是断言一个硬编码的步数。

## 提交 PR 前

```sh
npm run test          # 契约 + 边界 + 你的玩法测试
npm run build         # 静态发布包
```

详细约定见 [`../README.md`](../README.md)，完整契约见 [`../../src/core/contracts.js`](../../src/core/contracts.js)。
