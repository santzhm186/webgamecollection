import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'styles.css', 'app.mjs', 'engine.mjs', 'art.mjs', 'boards.mjs']) await copyFile(new URL(name, root), new URL(name, output));
console.log(`Static site built: ${fileURLToPath(output)}`);
