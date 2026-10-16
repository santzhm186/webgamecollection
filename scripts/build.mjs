/**
 * 静态站点构建（零依赖）。
 * ============================================================================
 * P3 之后仓库从 6 个扁平文件变成了多层目录（src/**、games/**、public/**），
 * 旧的"拷贝 6 个文件"实现会让 dist 残缺 —— 首页能打开但点开游戏就 404。
 *
 * 因此改为：按目录递归拷贝到 dist/，并做三件事后的自检：
 *   1. 校验入口文件存在（index.html / app.mjs）
 *   2. 校验每个游戏的 manifest 与其声明的加载目标文件都在产物里
 *      —— 这是"构建成功但运行时 404"的唯一防线（模块 404 在浏览器里
 *         只表现为一句 Failed to fetch dynamically imported module）
 *   3. 打印产物体积概览，便于发现首页被拖胖
 *
 * 保持相对路径：dist/ 可直接部署到静态托管（含 GitHub Pages 项目子路径）。
 */
import { mkdir, copyFile, rm, readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, extname } from 'node:path';
import { buildModels } from './build-models.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');

/** 需要进入产物的顶层条目 */
const ENTRIES = [
  'index.html', 'styles.css', 'app.mjs',
  // P4 之前的过渡文件：pins 与 screws 的 manifest 仍通过动态 import 指向它们。
  // P4 把这两个游戏搬进各自目录后，这两项即可删除（构建自检会提示）。
  'engine.mjs', 'boards.mjs',
  'src', 'games', 'public',
];

/** 递归拷贝一个文件或目录 */
async function copy(source, target) {
  const info = await stat(source);
  if (info.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      await copy(join(source, entry), join(target, entry));
    }
    return 1;
  }
  await mkdir(join(target, '..'), { recursive: true });
  await copyFile(source, target);
  return 1;
}

/** 递归统计产物体积 */
async function survey(dir, out = { bytes: 0, files: 0, byExt: {} }) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { await survey(path, out); continue; }
    const size = (await stat(path)).size;
    out.bytes += size; out.files++;
    const ext = extname(entry.name) || '(无后缀)';
    out.byExt[ext] = (out.byExt[ext] ?? 0) + size;
  }
  return out;
}

// Re-export portable assets from the source that also drives runtime sprites.
await buildModels();
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

let copied = 0;
for (const entry of ENTRIES) {
  const source = join(root, entry);
  if (!existsSync(source)) {
    console.warn(`  ! 跳过缺失条目: ${entry}`);
    continue;
  }
  copied += await copy(source, join(output, entry));
}

/* ---------------------------------------------------------------- 自检 */

const problems = [];
for (const required of ['index.html', 'app.mjs', 'games/index.js']) {
  if (!existsSync(join(output, required))) problems.push(`产物缺少入口文件: ${required}`);
}

/**
 * 逐个游戏检查它的动态 import 目标是否真的在产物里。
 * games/<id>/manifest.js 里的 `import('./x.js')` 会被解析为 dist 内的相对路径。
 */
const gamesDir = join(output, 'games');
if (existsSync(gamesDir)) {
  for (const entry of await readdir(gamesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const manifestPath = join(gamesDir, entry.name, 'manifest.js');
    if (!existsSync(manifestPath)) continue;
    const text = await readFile(manifestPath, 'utf8');
    for (const match of text.matchAll(/import\(\s*'([^']+)'\s*\)/g)) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue;
      // 从 manifest 自身所在目录解析（spec 是相对于 manifest 文件的）
      const resolved = join(gamesDir, entry.name, spec);
      if (!existsSync(resolved)) {
        problems.push(`${entry.name}/manifest.js 引用了产物中不存在的文件: ${spec} → ${relative(output, resolved)}`);
      }
      // 产物根目录之外的目标一定是错的（例如解析到 dist 的上一级）
      if (relative(output, resolved).startsWith('..')) {
        problems.push(`${entry.name}/manifest.js 的引用越出了产物根目录: ${spec}`);
      }
    }
  }
}

const stats = await survey(output);
const mb = size => `${(size / 1024).toFixed(1)} KB`;
console.log(`\n静态站点构建完成: ${relative(root, output) || 'dist'}/`);
console.log(`  文件数 ${stats.files} · 总计 ${mb(stats.bytes)}（未压缩）`);
console.log(`  按类型: ${Object.entries(stats.byExt).sort((a, b) => b[1] - a[1])
  .map(([ext, size]) => `${ext} ${mb(size)}`).join(' · ')}`);

if (problems.length) {
  console.error('\n构建自检未通过:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
} else {
  console.log('  自检通过: 入口文件与全部游戏的加载目标都已在产物中。\n');
}
