/**
 * 游戏注册表 —— manifest 的加载、校验与查询。
 * ============================================================================
 * 这是"同一个接口进入、不同引擎驱动"的落地点：宿主只认 manifest，
 * 不认任何具体游戏。
 *
 * 多人协作下最容易出的事故都在这里挡住（见 validateManifest）：
 *   · 两个贡献者用了同一个 id（成绩库会串台）
 *   · 忘了 engineVersion（排行榜无法区分新旧口径）
 *   · 把重活写在 manifest 顶层（首页加载被拖慢甚至报错）
 *   · 某个游戏加载失败拖垮整站（load 内部 try/catch 隔离）
 *
 * 设计取舍：注册表**不**静态 import 任何游戏文件，只接收一个"动态 import 函数数组"
 * （由 games/index.js 提供）。这样首页只加载 manifest，引擎与渲染器点开游戏才加载。
 *
 * @typedef {import('./contracts.js').GameManifest} GameManifest
 */
import { HOST_API_VERSION } from './contracts.js';
import { CATEGORY, SCORING_ORDER, SCORING_PRIMARY, RENDERER_KIND } from './enums.js';
import { validateMultiplayerSpec } from './multiplayer.js';

/** id 规则：kebab-case，成绩库键的稳定性依赖它 */
const ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
/** hostApi 只支持 ^x.y.z 与 x.y.z 两种写法（够用且能机械校验） */
const HOST_API_PATTERN = /^\^?\d+\.\d+\.\d+$/;

/**
 * 校验一个 manifest。**返回错误数组而不是抛错**：
 * 宿主需要把所有问题一次报全，而不是让贡献者改一个跑一次。
 *
 * @param {GameManifest} manifest
 * @returns {string[]} 错误信息（空数组 = 通过）
 */
export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest 必须是对象'];

  const { id } = manifest;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    errors.push(`id 必须是 kebab-case 字符串（当前: ${JSON.stringify(id)}）—— 它是成绩库的 gameId，发布后不可更改`);
  }

  // 文案一律用键：漏了会让卡片显示成空白或键名
  for (const field of ['titleKey', 'taglineKey', 'controlsKey']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].includes('.')) {
      errors.push(`${field} 必须是文案键（如 'game.${id}.title'），而不是文案本身`);
    }
  }
  for (const field of ['cardMetaKey', 'artLabelKey']) {
    if (manifest[field] !== undefined && typeof manifest[field] !== 'string') {
      errors.push(`${field} 若提供必须是字符串文案键`);
    }
  }

  if (!Object.values(CATEGORY).includes(manifest.category)) {
    errors.push(`category 必须是 ${Object.values(CATEGORY).join(' / ')} 之一（当前: ${JSON.stringify(manifest.category)}）`);
  }
  if (manifest.order !== undefined && !/^\d{1,3}$/.test(String(manifest.order))) {
    errors.push('order 若提供必须是 1–3 位数字字符串（如 \'01\'）');
  }

  if (typeof manifest.hostApi !== 'string' || !HOST_API_PATTERN.test(manifest.hostApi)) {
    errors.push(`hostApi 必须是 '^1.0.0' 或 '1.0.0' 形式（当前: ${JSON.stringify(manifest.hostApi)}）`);
  }
  if (typeof manifest.engineVersion !== 'string' || !SEMVER_PATTERN.test(manifest.engineVersion)) {
    errors.push(`engineVersion 必须是 x.y.z（当前: ${JSON.stringify(manifest.engineVersion)}）—— 数值改动不提升会让新旧成绩混进同一个榜`);
  }

  // 三个加载器必须是函数（写成值意味着 manifest 顶层已经做了重活）
  for (const field of ['levels', 'engine', 'renderer']) {
    if (typeof manifest[field] !== 'function') {
      errors.push(`${field} 必须是动态 import 函数（如 () => import('./${field}.js')），不能在 manifest 顶层直接加载`);
    }
  }
  if (manifest.assets !== undefined && typeof manifest.assets !== 'function') {
    errors.push('assets 若提供必须是动态 import 函数');
  }

  const scoring = manifest.scoring;
  if (!scoring || typeof scoring !== 'object') {
    errors.push('scoring 是必需的（排行榜需要知道"什么算更好"）');
  } else {
    if (!Object.values(SCORING_ORDER).includes(scoring.order)) {
      errors.push(`scoring.order 必须是 ${Object.values(SCORING_ORDER).join(' / ')}`);
    }
    if (!Object.values(SCORING_PRIMARY).includes(scoring.primary)) {
      errors.push(`scoring.primary 必须是 ${Object.values(SCORING_PRIMARY).join(' / ')}`);
    }
  }

  if (manifest.timeDriven !== undefined && typeof manifest.timeDriven !== 'boolean') {
    errors.push('timeDriven 必须是布尔值');
  }
  if (!Number.isInteger(manifest.levelCount) || manifest.levelCount < 1) {
    errors.push('levelCount 必须是正整数，首页用它显示进度而不提前加载游戏');
  }
  if (manifest.preview !== undefined && typeof manifest.preview !== 'string') {
    errors.push('preview 若提供必须是相对站点根目录的图片路径');
  }

  errors.push(...validateMultiplayerSpec(manifest.players));
  return errors;
}

/**
 * 判断游戏声明的 hostApi 是否兼容当前宿主。
 * 只做**主版本**比较：主版本相同即视为兼容（`^1.0.0` 对 `1.x` 全部成立）。
 * @param {string} hostApi
 * @param {string} [hostVersion]
 * @returns {'compatible'|'outdated'}
 */
export function hostApiStatus(hostApi, hostVersion = HOST_API_VERSION) {
  const wanted = Number(String(hostApi).replace('^', '').split('.')[0]);
  const current = Number(String(hostVersion).split('.')[0]);
  return wanted === current ? 'compatible' : 'outdated';
}

/**
 * 注册表。宿主通过 createRegistry() 创建，用 games/index.js 提供的加载器列表初始化。
 */
export function createRegistry() {
  /** @type {Map<string, {manifest: GameManifest, loaders: object|null, pending: Promise<object>|null, error: string|null}>} */
  const entries = new Map();
  let loaded = false;

  /**
   * 加载全部 manifest 并校验。**单个游戏失败不影响其他游戏** ——
   * 这是开源项目里最重要的一条韧性要求（一个贡献者的语法错误不能让整站白屏）。
   *
   * @param {Array<() => Promise<{default: GameManifest}>>} loaders
   * @param {{ onError?: (message: string) => void }} [options]
   * @returns {Promise<{loaded: number, failed: number}>}
   */
  async function load(loaders, { onError = message => console.error(message) } = {}) {
    entries.clear();
    let failed = 0;

    for (const loader of loaders) {
      let manifest;
      try {
        manifest = (await loader())?.default;
      } catch (error) {
        failed++;
        onError(`[registry] 游戏模块加载失败，已跳过该游戏: ${error?.message || error}`);
        continue;
      }

      const errors = validateManifest(manifest);
      if (errors.length) {
        failed++;
        onError(`[registry] ${manifest?.id ?? '(无 id)'} 的 manifest 不合法，已跳过:\n  - ${errors.join('\n  - ')}`);
        continue;
      }
      if (entries.has(manifest.id)) {
        failed++;
        onError(`[registry] id 冲突：'${manifest.id}' 已被占用 —— 两个贡献者用了同一个 id，成绩库会串台。请改名。`);
        continue;
      }

      entries.set(manifest.id, { manifest, loaders: null, pending: null, error: null });
    }

    // 标题重复检测：搜索体验问题，只警告不拒绝（可能是同一个游戏的不同版本并存）
    const byTitle = new Map();
    for (const { manifest } of entries.values()) {
      byTitle.set(manifest.titleKey, (byTitle.get(manifest.titleKey) ?? 0) + 1);
    }
    for (const [titleKey, count] of byTitle) {
      if (count > 1) onError(`[registry] 有 ${count} 个游戏共用文案键 ${titleKey} —— 玩家会看到两张同名卡片`);
    }

    loaded = true;
    return { loaded: entries.size, failed };
  }

  /**
   * 按需加载某游戏的 levels / engine / renderer / assets。
   * 结果缓存；失败时抛错并记住原因，宿主应把该游戏卡片标记为"暂时不可用"。
   * @param {string} id
   */
  async function resolve(id) {
    const entry = entries.get(id);
    if (!entry) throw new Error(`[registry] 未注册的游戏: ${id}`);
    if (entry.loaders) return entry.loaders;
    if (entry.error) throw new Error(entry.error);
    if (entry.pending) return entry.pending;

    entry.pending = (async () => {
      try {
        const [levels, engine, renderer, assets] = await Promise.all([
          entry.manifest.levels(),
          entry.manifest.engine(),
          entry.manifest.renderer(),
          entry.manifest.assets ? entry.manifest.assets() : Promise.resolve(null),
        ]);
        entry.loaders = {
          levels: levels?.default ?? levels,
          Engine: engine?.default ?? engine,
          createRenderer: renderer?.default ?? renderer,
          assets: assets?.default ?? assets ?? [],
        };
        return entry.loaders;
      } catch (error) {
        entry.error = `[registry] 游戏 '${id}' 加载失败: ${error?.message || error}`;
        throw new Error(entry.error);
      } finally {
        entry.pending = null;
      }
    })();
    return entry.pending;
  }

  return {
    load,
    resolve,
    /** @param {string} id */
    get: id => entries.get(id)?.manifest ?? null,
    has: id => entries.has(id),
    /** 全部 manifest，按 order 排序（order 缺失的排在最后，保持稳定顺序） */
    list: () => [...entries.values()]
      .map(entry => entry.manifest)
      .sort((a, b) => String(a.order ?? '999').localeCompare(String(b.order ?? '999'))),
    ids: () => [...entries.keys()],
    get isLoaded() { return loaded; },
    get size() { return entries.size; },
  };
}

export default createRegistry;
