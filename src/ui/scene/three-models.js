/**
 * 3D 渲染与降级模块。
 * ============================================================================
 * 此模块负责尝试加载 Three.js 并进行 3D 模型渲染。
 * 遵循项目原则：如果加载失败或环境不支持，则静默降级为 false 状态，
 * 调用方应当在此时回退到原生 2D 绘制逻辑。
 */

let THREE = null;
let initialized = false;
let support3D = false;
let renderer = null;
let scene = null;
let camera = null;

// 缓存已经生成的 Sprite 图像，避免重复渲染
const spriteCache = new Map();

/**
 * 尝试初始化 3D 模块。
 * @returns {Promise<boolean>} 是否成功支持 3D
 */
export async function init3DModels() {
  if (initialized) return support3D;
  initialized = true;

  try {
    // 动态引入 three.js，如果因为未 install 或网络问题导致导入失败，会自动抛出异常
    THREE = await import('three');

    // 尝试创建离屏 WebGL 渲染器
    try {
      // 在浏览器环境尝试使用 OffscreenCanvas
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(256, 256)
        : document.createElement('canvas');

      if (!canvas.getContext) {
          throw new Error('Canvas not supported');
      }

      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
      });
      renderer.setSize(256, 256);

      scene = new THREE.Scene();

      // 设置基础光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(10, 20, 10);
      scene.add(dirLight);

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 5);

      support3D = true;
    } catch (e) {
      console.warn('3D renderer creation failed, falling back to 2D:', e);
      support3D = false;
    }
  } catch (e) {
    console.warn('Three.js failed to load, falling back to 2D:', e);
    support3D = false;
  }

  return support3D;
}

/**
 * 是否支持 3D 渲染（供调用方同步检查）。
 * @returns {boolean}
 */
export function is3DSupported() {
  return support3D;
}

/**
 * 渲染一个模型为图像。
 * @param {THREE.Object3D} model
 * @param {string} cacheKey
 * @param {number} size
 * @returns {Promise<HTMLImageElement | null>}
 */
async function renderModelToImage(model, cacheKey, size = 256) {
  if (!support3D) return null;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);

  // 清理场景
  while(scene.children.length > 2){
    scene.remove(scene.children[scene.children.length - 1]);
  }

  scene.add(model);

  // 调整相机
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);

  camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.5);
  camera.lookAt(center);

  renderer.setSize(size, size);
  renderer.render(scene, camera);

  // 将离屏 canvas 转换为图像，供普通的 canvas/svg 使用
  const img = new Image();

  const promise = new Promise(async (resolve) => {
    img.onload = () => {
      spriteCache.set(cacheKey, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };

    try {
      if (renderer.domElement.toDataURL) {
        // 普通 canvas
        img.src = renderer.domElement.toDataURL('image/png');
      } else if (renderer.domElement.convertToBlob) {
        // OffscreenCanvas
        const blob = await renderer.domElement.convertToBlob({ type: 'image/png' });
        const reader = new FileReader();
        reader.onload = () => { img.src = reader.result; };
        reader.readAsDataURL(blob);
      } else {
        resolve(null);
      }
    } catch (e) {
      console.warn('Failed to convert 3D model to image:', e);
      resolve(null);
    }
  });

  return promise;
}

/**
 * 生成 3D 士兵模型图像。
 * 用于 runner (冲关队伍) 和 pins (探索者/小兵)
 * @param {string} color 主色调，例如 'blue' 或 '#42c8eb'
 * @returns {Promise<HTMLImageElement | null>}
 */
export async function getSoldierSprite(color) {
  if (!support3D) return null;
  const cacheKey = `soldier_${color}`;
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);

  // 构建一个 Low-Poly 风格的士兵
  const group = new THREE.Group();

  // 身体
  const bodyGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
  const material = new THREE.MeshLambertMaterial({ color: color });
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0.4;
  group.add(body);

  // 头部
  const headGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.0;
  group.add(head);

  return renderModelToImage(group, cacheKey, 64);
}

/**
 * 生成 3D 金币/宝藏模型图像。
 * 用于 pins 中的宝藏。
 * @returns {Promise<HTMLImageElement | null>}
 */
export async function getCoinSprite() {
  if (!support3D) return null;
  const cacheKey = 'coin';
  if (spriteCache.has(cacheKey)) return spriteCache.get(cacheKey);

  const group = new THREE.Group();

  // 金币圆盘
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.8,
    roughness: 0.2
  });
  const coin = new THREE.Mesh(geo, mat);

  // 稍微倾斜展示立体感
  coin.rotation.x = Math.PI / 2.5;
  coin.rotation.z = Math.PI / 6;

  group.add(coin);

  return renderModelToImage(group, cacheKey, 64);
}
