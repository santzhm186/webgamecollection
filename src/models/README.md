# Arcade Kit · 可复用 3D 资产

原创低多边形模型与现有街机合集共用奶油白、墨绿、青蓝、珊瑚和荧光绿配色。统一米制、Y 向上、Z 朝前、底部居中原点。基础地块为 1 × 1 米，模型不依赖外部纹理，GLB 使用标准 PBR 材质。

## 使用与生成

- [可交互预览](../../public/assets/models/gallery.html)：旋转、缩放、切换模型、分类与逐个下载。需要通过 HTTP 打开。
- [源数据](arcade-kit.js)：24 个模型的零件、尺寸、变换、材质与复用场景。
- [GLB 清单](../../public/assets/models/manifest.json)：文件路径、字节数、三角面数与包围盒。
- `npm run models`：从同一份源数据重新导出全部 GLB。无需安装额外工具。
- `npm run build`：把源数据、模型、预览页一起放入 `dist/`。

```js
import { createAssetModel, getAssetSprite } from '../ui/scene/three-models.js';

const model = createAssetModel(THREE, 'cargo-bot', '#96dbb5');
scene.add(model); // 实例资源互相独立；卸载时释放 geometry/material
const sprite = await getAssetSprite('cargo-bot', undefined, 128, Math.PI / 2);
// sprite 为透明背景的 Image；WebGL 不可用时为 null，保留 SVG/Canvas 降级。
```

共享精灵生成器串行使用一个离屏渲染器，按资产、颜色、尺寸和角度缓存；只在需要时生成，无持续后台渲染。游戏运行时从源数据构建相同几何，独立 GLB 供其他项目、建模软件及后续场景复用。

| 资产 | 主要复用场景 |
| --- | --- |
| scout-bot 巡游机器人 | 冲关队伍、拉针探险家、射击玩家 |
| cargo-bot 货运机器人 | 推箱主角、搬运类游戏 |
| enemy-drone 警戒无人机 | 射击敌人、巡逻障碍 |
| boss-sentry 重装守卫 | 射击 Boss、要塞防线 |
| cargo-crate 标准货箱 | 推箱、场景掩体 |
| upgrade-crate 强化补给箱 | 射击强化、冲关补给 |
| floor-tile 模块地块 | 仓库、赛道、射击走廊 |
| wall-block 模块墙体 | 仓库、机关房、障碍物 |
| dock-pad 发光泊位 | 推箱目标、平台标记 |
| energy-gate 能量门框 | 冲关门、传送门 |
| screw 十字螺丝 | 机械类谜题、场景零件 |
| metal-plate 通用连接板 | 拆卸类谜题、机械装饰 |
| test-tube 透明试管 | 彩液分装、实验室场景 |
| coin 收藏金币 | 拉针宝藏、拾取物 |

这些是静态模块，没有骨骼或碰撞逻辑。螺丝螺纹采用分层圆环；连接板孔位采用深色面与金属环标记，便于轻量渲染。试管为空管，游戏中的液体状态由玩法层独立控制。

## 模块扩展

新增 `bridge-tile` 桥面、`corner-wall` 转角墙、`hazard-tile` 危险地块、`shield-cell` 护盾电池、`repair-kit` 维修补给、`sentry-turret` 炮塔、`pin-handle` 插销、`valve-wheel` 阀门、`tube-rack` 试管架及 `star-token` 星章。各游戏资源清单声明可复用模块；护盾电池已接入射击游戏的补给显示，其余扩展供后续关卡拼装，不改变当前规则。所有零件独立命名，可单独设置变换。
