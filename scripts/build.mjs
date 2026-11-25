/** Build the portable static site and validate it before replacing dist/. */
import { cp, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename, extname, join, relative, sep } from 'node:path';
import { buildModels } from './build-models.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const entries = [
  'index.html', 'styles.css', 'app.mjs',
  'engine.mjs', 'boards.mjs', // Compatibility exports for consumers of the static site.
  'src', 'games', 'public',
];

function isRuntimeFile(source) {
  const name = basename(source);
  return !name.startsWith('.') && name !== 'node_modules'
    && !/\.test\.[cm]?js$|\.md$/i.test(name)
    && relative(root, source) !== join('games', '_template');
}

async function validateGames(directory) {
  const base = pathToFileURL(`${directory}${sep}`);
  const [{ MODULES }, { createRegistry }] = await Promise.all([
    import(new URL('games/index.js', base)),
    import(new URL('src/core/registry.js', base)),
  ]);
  const registry = createRegistry();
  const { loaded, failed } = await registry.load(MODULES);
  if (failed || !loaded) throw new Error(`构建产物中的游戏注册失败（${loaded} 成功，${failed} 失败）`);

  await Promise.all(registry.list().map(async manifest => {
    const { levels, Engine, createRenderer, assets } = await registry.resolve(manifest.id);
    if (!Array.isArray(levels) || levels.length !== manifest.levelCount
      || typeof Engine !== 'function' || typeof createRenderer !== 'function') {
      throw new Error(`${manifest.id} 的关卡或游戏入口与 manifest 不一致`);
    }
    const resources = [manifest.preview, ...assets.map(asset => asset.src)].filter(Boolean);
    await Promise.all(resources.map(async resource => {
      const url = new URL(resource, base);
      if (url.protocol !== 'file:') return;
      const path = fileURLToPath(url);
      if (!path.startsWith(`${directory}${sep}`) || !(await stat(path).catch(() => null))?.isFile()) {
        throw new Error(`${manifest.id} 的资源不在构建产物中: ${resource}`);
      }
    }));
  }));
  return loaded;
}

async function survey(dir, totals = { bytes: 0, files: 0, byExt: {} }) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await survey(path, totals);
      continue;
    }
    const size = (await stat(path)).size;
    const ext = extname(entry.name) || '(无后缀)';
    totals.bytes += size;
    totals.files++;
    totals.byExt[ext] = (totals.byExt[ext] ?? 0) + size;
  }
  return totals;
}

const staging = await mkdtemp(join(root, '.dist-'));
try {
  for (const entry of entries) {
    await cp(join(root, entry), join(staging, entry), { recursive: true, filter: isRuntimeFile });
  }
  await buildModels(join(staging, 'public/assets/models'));
  const loaded = await validateGames(staging);
  const stats = await survey(staging);
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);

  const kb = size => `${(size / 1024).toFixed(1)} KB`;
  console.log('\n静态站点构建完成: dist/');
  console.log(`  文件数 ${stats.files} · 总计 ${kb(stats.bytes)}（未压缩）`);
  console.log(`  按类型: ${Object.entries(stats.byExt).sort((a, b) => b[1] - a[1])
    .map(([ext, size]) => `${ext} ${kb(size)}`).join(' · ')}`);
  console.log(`  自检通过: ${loaded} 款游戏的模块及声明资源均可从产物读取。`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
