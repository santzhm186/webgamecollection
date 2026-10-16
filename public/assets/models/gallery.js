import { MODELS } from '../../../src/models/arcade-kit.js';

const MESSAGES = {
  'zh-CN': {
    brand: '玩得到', back: '返回游戏合集', header: '原创角色与场景组件', eyebrow: 'ARCADE ASSET LAB · 01',
    title: '街机造物所。', intro: '同一套小小造物，走进不同的游戏。转一转、看一看，把喜欢的模型带走。',
    totalLabel: '个可复用模型', downloadManifest: '↓ 下载资源清单', libraryLabel: '模型列表', library: '模型收藏',
    filterLabel: '按类型筛选', previewLabel: '模型预览', live: '实时 3D 预览', canvasLabel: '拖动旋转模型，也可用左右方向键旋转',
    unavailableTitle: '模型预览暂不可用', unavailable: '浏览器未启用 WebGL。你仍然可以浏览模型信息、下载 GLB 文件。',
    dragHint: '拖动旋转 · 滚轮缩放', reset: '重置视角', download: '下载 GLB', parts: '模型部件', triangles: '三角面数', size: '文件大小',
    scale: '坐标规范', scaleValue: '米 · Y 轴向上', reuse: '适用玩法',
    footer: '从角色到场景，共用一套颜色、比例与材质。模型和游戏画面来自同一份设计。', footerTag: '为更多好玩而造。',
    all: '全部', character: '角色', prop: '道具', environment: '场景', mechanical: '机械',
    runner: '加减门冲关', pins: '拉针救人', screws: '拧螺丝', shooter: '火力防线', warehouse: '星港推箱',
    'water-sort': '彩液分装', 'future-puzzle': '更多益智玩法', languageLabel: 'Switch to English',
  },
  en: {
    brand: 'Playable', back: 'Back to games', header: 'ORIGINAL CHARACTERS & SCENE PARTS', eyebrow: 'ARCADE ASSET LAB · 01',
    title: 'Made for play.', intro: 'Little creations, endless new games. Take a closer look, give them a spin, and bring your favorite models along.',
    totalLabel: 'reusable models', downloadManifest: '↓ Download manifest', libraryLabel: 'Model library', library: 'The collection',
    filterLabel: 'Filter models by category', previewLabel: 'Model preview', live: 'LIVE 3D PREVIEW', canvasLabel: 'Drag to rotate the model, or use the left and right arrow keys',
    unavailableTitle: 'Preview unavailable', unavailable: 'WebGL is unavailable in this browser. You can still explore the collection and download every GLB model.',
    dragHint: 'Drag to rotate · Scroll to zoom', reset: 'Reset view', download: 'Download GLB', parts: 'Parts', triangles: 'Triangles', size: 'File size',
    scale: 'Coordinates', scaleValue: 'Metres · Y up', reuse: 'Ready for',
    footer: 'Characters and scenery share one palette, scale, and material library. Models and game art are built from the same design.', footerTag: 'Built for the next good game.',
    all: 'All', character: 'Characters', prop: 'Props', environment: 'Scenery', mechanical: 'Mechanical',
    runner: 'Gate Runner', pins: 'Pin Rescue', screws: 'Unscrew', shooter: 'Skyfire Defense', warehouse: 'Starport Cargo',
    'water-sort': 'Color Laboratory', 'future-puzzle': 'Future puzzles', languageLabel: '切换为简体中文',
  },
};
const ICONS = { character: '◉', prop: '◇', environment: '▧', mechanical: '✳' };
const entries = Object.entries(MODELS);
const params = new URLSearchParams(location.search);
let storedLocale;
try { storedLocale = localStorage.getItem('wande-dao-locale'); } catch { /* Language works with blocked storage. */ }
let locale = (params.get('lang') ?? storedLocale ?? navigator.language).startsWith('en') ? 'en' : 'zh-CN';
let selected = Object.hasOwn(MODELS, params.get('model')) ? params.get('model') : 'cargo-bot';
let category = 'all';
let metadata = new Map();
let preview = null;
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const t = key => MESSAGES[locale][key] ?? key;
const modelName = definition => {
  const names = definition.name?.split(' / ') ?? [];
  return names[locale === 'en' ? 1 : 0] ?? names[0] ?? selected.replaceAll('-', ' ');
};

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set('lang', locale);
  url.searchParams.set('model', selected);
  history.replaceState(null, '', url);
}

function renderLibrary() {
  $('#category-filters').innerHTML = ['all', 'character', 'prop', 'environment', 'mechanical'].map(key =>
    `<button type="button" class="category-filter" data-category="${key}" aria-pressed="${key === category}">${escapeHtml(t(key))}</button>`).join('');
  const filtered = entries.filter(([, model]) => category === 'all' || category === model.category);
  $('#library-count').textContent = filtered.length;
  $('#asset-list').innerHTML = filtered.map(([id, model]) =>
    `<button type="button" class="asset-button" data-model="${id}" aria-pressed="${id === selected}">
      <span class="asset-icon" aria-hidden="true">${ICONS[model.category] ?? '◇'}</span>
      <span class="asset-copy"><strong>${escapeHtml(modelName(model))}</strong><small>${escapeHtml(id.toUpperCase())}</small></span>
    </button>`).join('');
}

function updateModelInfo() {
  const definition = MODELS[selected], details = metadata.get(selected);
  $('#model-name').textContent = modelName(definition);
  $('#model-id').textContent = selected;
  $('#model-category').textContent = t(definition.category).toUpperCase();
  $('#model-parts').textContent = definition.nodes.length;
  $('#model-triangles').textContent = details?.triangles?.toLocaleString(locale) ?? '—';
  $('#model-size').textContent = details?.bytes ? `${(details.bytes / 1024).toFixed(1)} KB` : '—';
  $('#download-model').href = `./${selected}.glb`;
  $('#download-model').download = `${selected}.glb`;
  $('#download-model').setAttribute('aria-label', `${t('download')} · ${modelName(definition)}`);
  $('#model-reuse').innerHTML = definition.reuse.map(id => `<span class="reuse-chip">${escapeHtml(t(id))}</span>`).join('');
}

function renderLanguage() {
  document.documentElement.lang = locale;
  document.title = `${t('title')} · Arcade Asset Kit`;
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-aria]')) element.setAttribute('aria-label', t(element.dataset.i18nAria));
  $('#language-button').textContent = locale === 'en' ? '中' : 'EN';
  $('#language-button').setAttribute('aria-label', t('languageLabel'));
  $('#asset-total').textContent = entries.length;
  renderLibrary();
  updateModelInfo();
}

function selectModel(id) {
  if (!Object.hasOwn(MODELS, id)) return;
  selected = id;
  updateUrl();
  renderLibrary();
  updateModelInfo();
  preview?.select(id);
  $('#asset-list').querySelector(`[data-model="${id}"]`)?.focus({ preventScroll: true });
}

$('#language-button').addEventListener('click', () => {
  locale = locale === 'en' ? 'zh-CN' : 'en';
  updateUrl();
  renderLanguage();
});
$('#category-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  category = button.dataset.category;
  renderLibrary();
  $('#category-filters').querySelector(`[data-category="${category}"]`)?.focus({ preventScroll: true });
});
$('#asset-list').addEventListener('click', event => {
  const button = event.target.closest('[data-model]');
  if (button) selectModel(button.dataset.model);
});
$('#reset-view').addEventListener('click', () => preview?.reset());

function showFallback() {
  $('#preview-fallback').hidden = false;
  $('#model-canvas').hidden = true;
  $('#reset-view').hidden = true;
}

/** A single renderer redraws only after input or resize; there is no animation loop. */
async function initializePreview() {
  try {
    const [THREE, { createAssetModel }] = await Promise.all([
      import('three'), import('../../../src/ui/scene/three-models.js'),
    ]);
    const canvas = $('#model-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-2.4, 2.4, 2.4, -2.4, .1, 30);
    const ambient = new THREE.HemisphereLight(0xf2ffe1, 0x315247, 2.6);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff7da, 4);
    key.position.set(-3, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd1fda8, 2.3);
    rim.position.set(4, 3, -2);
    scene.add(rim);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.46, .12, 64), new THREE.MeshStandardMaterial({ color: '#264f3f', roughness: .85 }));
    disk.position.y = -.66;
    scene.add(disk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.26, .009, 5, 80), new THREE.MeshBasicMaterial({ color: '#8dad66', transparent: true, opacity: .6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -.595;
    scene.add(ring);
    const modelPivot = new THREE.Group();
    scene.add(modelPivot);
    let currentModel = null;
    let yaw = .48, pitch = .4, zoom = 1;
    let pointer = null;
    const cleanups = [];
    const on = (target, name, callback, options) => {
      target.addEventListener(name, callback, options);
      cleanups.push(() => target.removeEventListener(name, callback, options));
    };
    const disposeObject = object => object?.traverse(child => {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
      else child.material?.dispose();
    });
    function render() {
      modelPivot.rotation.y = yaw;
      camera.position.set(0, 5 * Math.sin(pitch), 5 * Math.cos(pitch));
      camera.lookAt(0, .2, 0);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    function resize() {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      const aspect = width / height;
      camera.left = -1.65 * aspect;
      camera.right = 1.65 * aspect;
      camera.top = 1.65;
      camera.bottom = -1.65;
      renderer.setSize(width, height, false);
      render();
    }
    function reset() { yaw = .48; pitch = .4; zoom = 1; render(); }
    function select(id) {
      if (currentModel) { modelPivot.remove(currentModel); disposeObject(currentModel); }
      currentModel = createAssetModel(THREE, id);
      if (!currentModel) return;
      const bounds = new THREE.Box3().setFromObject(currentModel);
      const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.6 / Math.max(size.x, size.y, size.z);
      currentModel.scale.setScalar(scale);
      currentModel.position.set(-center.x * scale, -.6 - bounds.min.y * scale, -center.z * scale);
      modelPivot.add(currentModel);
      reset();
    }
    on(canvas, 'pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
    });
    on(canvas, 'pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      yaw += (event.clientX - pointer.x) * .012;
      pitch = Math.max(.08, Math.min(1.2, pitch + (event.clientY - pointer.y) * .007));
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      render();
    });
    const release = event => {
      if (pointer?.id !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointer = null;
    };
    on(canvas, 'pointerup', release);
    on(canvas, 'pointercancel', release);
    on(canvas, 'lostpointercapture', () => { pointer = null; });
    on(canvas, 'wheel', event => {
      event.preventDefault();
      zoom = Math.max(.65, Math.min(1.65, zoom * Math.exp(-event.deltaY * .001)));
      render();
    }, { passive: false });
    on(canvas, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') { reset(); return; }
      if (event.key === 'ArrowLeft') yaw -= .15;
      if (event.key === 'ArrowRight') yaw += .15;
      if (event.key === 'ArrowUp') pitch = Math.min(1.2, pitch + .1);
      if (event.key === 'ArrowDown') pitch = Math.max(.08, pitch - .1);
      if (['+', '='].includes(event.key)) zoom = Math.min(1.65, zoom + .1);
      if (event.key === '-') zoom = Math.max(.65, zoom - .1);
      render();
    });
    on(canvas, 'webglcontextlost', event => { event.preventDefault(); showFallback(); });
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    preview = {
      select, reset,
      destroy() {
        observer.disconnect();
        cleanups.forEach(off => off());
        disposeObject(scene);
        renderer.dispose();
      },
    };
    select(selected);
    resize();
  } catch (error) {
    console.warn('[asset-gallery] Preview unavailable:', error);
    showFallback();
  }
}

renderLanguage();
fetch('./manifest.json').then(response => {
  if (!response.ok) throw new Error('Asset manifest unavailable');
  return response.json();
}).then(manifest => {
  metadata = new Map(manifest.assets.map(asset => [asset.id, asset]));
  updateModelInfo();
}).catch(error => console.warn('[asset-gallery]', error));
initializePreview();
addEventListener('pagehide', event => { if (!event.persisted) preview?.destroy(); });
