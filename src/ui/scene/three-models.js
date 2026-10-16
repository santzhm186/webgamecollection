/** Shared model definitions drive both in-game sprites and portable GLB assets. */
import { MATERIALS, MODELS } from '../../models/arcade-kit.js';

let three = null;
let initialization = null;
let support3D = false;
let renderer = null;
let scene = null;
let camera = null;
let renderQueue = Promise.resolve();
const spriteCache = new Map();
const pendingSprites = new Map();

/** Pure factory: accepts a Three namespace so the same geometry also runs in Node. */
export function createAssetModel(THREE, id, color) {
  const definition = MODELS[id];
  if (!definition) return null;
  const constructors = {
    box: THREE.BoxGeometry,
    cylinder: THREE.CylinderGeometry,
    sphere: THREE.SphereGeometry,
    torus: THREE.TorusGeometry,
  };
  const group = new THREE.Group();
  group.name = id;
  group.userData = { assetId: id, labelKey: definition.labelKey, name: definition.name, category: definition.category, reuse: definition.reuse };
  for (const node of definition.nodes) {
    const Geometry = constructors[node.shape];
    const materialSpec = MATERIALS[node.material];
    if (!Geometry || !materialSpec) throw new TypeError(`Invalid model node: ${id}/${node.name}`);
    const { tintable, doubleSided, ...parameters } = materialSpec;
    const material = new THREE.MeshStandardMaterial({
      ...parameters,
      color: color && tintable ? color : materialSpec.color,
      transparent: materialSpec.transparent ?? (materialSpec.opacity < 1),
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    material.name = node.material;
    const mesh = new THREE.Mesh(new Geometry(...node.args), material);
    mesh.name = node.name;
    mesh.position.fromArray(node.position ?? [0, 0, 0]);
    mesh.rotation.set(...(node.rotation ?? [0, 0, 0]));
    mesh.scale.fromArray(node.scale ?? [1, 1, 1]);
    group.add(mesh);
  }
  return group;
}

/** Concurrent callers share initialization; unsupported devices keep the 2D fallback. */
export function init3DModels() {
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      three = await import('../../../public/lib/three.mjs');
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas')
        : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : null;
      if (!canvas?.getContext) return false;
      renderer = new three.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(256, 256, false);
      renderer.setClearColor(0x000000, 0);
      scene = new three.Scene();
      scene.add(new three.AmbientLight(0xffffff, 2.2));
      const key = new three.DirectionalLight(0xfff0d5, 3.2);
      key.position.set(4, 7, 6);
      scene.add(key);
      const rim = new three.DirectionalLight(0x9ce9f0, 2);
      rim.position.set(-4, 3, -2);
      scene.add(rim);
      camera = new three.PerspectiveCamera(35, 1, 0.01, 100);
      support3D = true;
    } catch (error) {
      console.warn('[models] 3D renderer unavailable:', error?.message);
      renderer?.dispose();
      renderer = null;
      support3D = false;
    }
    return support3D;
  })();
  return initialization;
}

export function is3DSupported() { return support3D; }

function disposeModel(model) {
  model.traverse(node => {
    node.geometry?.dispose();
    if (Array.isArray(node.material)) node.material.forEach(material => material.dispose());
    else node.material?.dispose();
  });
}

async function renderAsset(id, color, resolution, yaw) {
  const model = createAssetModel(three, id, color);
  if (!model) return null;
  model.rotation.y = yaw;
  scene.add(model);
  try {
    const bounds = new three.Box3().setFromObject(model);
    const center = bounds.getCenter(new three.Vector3());
    const extent = bounds.getSize(new three.Vector3());
    const size = Math.max(extent.x, extent.y, extent.z, .1);
    camera.position.copy(center).add(new three.Vector3(1.1, .75, 1.8).normalize().multiplyScalar(size * 2.3));
    camera.lookAt(center);
    renderer.setSize(resolution, resolution, false);
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    let url;
    if (typeof canvas.toDataURL === 'function') url = canvas.toDataURL('image/png');
    else if (typeof canvas.convertToBlob === 'function') {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      // SVG consumers need a reusable URL, including after this image has loaded.
      url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else return null;
    return await new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  } catch (error) {
    console.warn('[models] Sprite fallback:', id, error?.message);
    return null;
  } finally {
    scene.remove(model);
    disposeModel(model);
  }
}

/** Transparent 256px sprite; pending requests are deduplicated and rendered in order. */
export async function getAssetSprite(id, color, size = 256, rotationY = 0) {
  if (!MODELS[id] || !(await init3DModels())) return null;
  const resolution = Number.isFinite(size) ? Math.max(16, Math.min(1024, Math.round(size))) : 256;
  const yaw = Number.isFinite(rotationY) ? rotationY : 0;
  const key = `${id}:${color ?? ''}:${resolution}:${yaw}`;
  if (spriteCache.has(key)) return spriteCache.get(key);
  if (pendingSprites.has(key)) return pendingSprites.get(key);
  const pending = renderQueue.then(() => renderAsset(id, color, resolution, yaw)).then(image => {
    if (image) spriteCache.set(key, image);
    return image;
  }).finally(() => pendingSprites.delete(key));
  renderQueue = pending.catch(() => null);
  pendingSprites.set(key, pending);
  return pending;
}

export const getSoldierSprite = color => getAssetSprite('scout-bot', color, 64);
export const getCoinSprite = () => getAssetSprite('coin', undefined, 64);
