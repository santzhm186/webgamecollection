/**
 * 本地开发服务器（零依赖）。
 * ============================================================================
 * 本轮修正：原先白名单只有 .html/.css/.mjs 三种后缀，导致 src/** 下的 .js
 * 模块（以及将来的 json / 图片 / 音频 / glTF 模型）一律 404 ——
 * 浏览器里表现为 "Failed to fetch dynamically imported module"，
 * 而服务器日志只有一行 404，很难定位。现在：
 *
 *   1. 后缀白名单显式列出，覆盖源码、数据、模型与音频
 *   2. **每个后缀都必须有正确的 MIME**：ES 模块要求 text/javascript，
 *      类型不对浏览器会直接拒绝执行（这是比 404 更难查的一类故障）
 *   3. 404 时打印具体路径，而不是静默返回 Not found
 *
 * 安全约定（保持原有）：路径必须落在仓库目录内、后缀必须在白名单内，
 * 因此 dotfiles、node_modules、dist 等无法被读取。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 5173);

/**
 * 后缀 → Content-Type。**新增资源类型时必须同时加进这里**，
 * 否则浏览器会拒绝执行/渲染（模块尤其严格）。
 */
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  let requested = '/';
  try {
    requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
    const extension = extname(file).toLowerCase();
    if (!file.startsWith(root + sep) || !types[extension] || !(await stat(file)).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      console.warn(`404 ${requested}${types[extension] ? '' : `（后缀 ${extension} 不在白名单内）`}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': types[extension], 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    console.warn(`404 ${requested} — ${error.code || error.message}`);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Local: http://127.0.0.1:${port}`);
  console.log(`Serving: ${relative(process.cwd(), root) || '.'}  (${Object.keys(types).length} 种后缀)`);
});
