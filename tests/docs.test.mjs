/**
 * 文档校验 —— 让文档也遵守"每条约定都要有执行者"这条原则。
 * ============================================================================
 * 文档腐烂是本项目的真实风险：约定写了好几份（CONVENTIONS / DECISIONS /
 * NAMING-CONVENTIONS / ARCHITECTURE / MIGRATION-MAP），而代码一直在动。
 * 最常见的两种腐烂方式：
 *
 *   ① 链接失效 —— 目录结构一变，文档里的相对链接全部指空。
 *      本项目 P3 就整批移动过文件（art.mjs 删除、src/ 与 games/ 新建）。
 *
 *   ② 阶段状态说谎 —— 文档写着"待实现"，代码其实已经做完了（或反过来）。
 *      这类问题没有任何报错，只会误导下一个贡献者。
 *
 * 因此这里做机械校验：#1 检查全部相对链接可解析；#2 检查阶段状态标记与
 * 代码事实一致。**改文档时如果这两项失败，说明文档与代码已经不同步。**
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

/** 所有需要被校验的 Markdown 文档（新增文档时请加进来） */
const DOCS = [
  'README.md',
  'CONVENTIONS.md',
  'games/README.md',
  'games/_template/README.md',
  'docs/ARCHITECTURE.md',
  'docs/DECISIONS.md',
  'docs/NAMING-CONVENTIONS.md',
  'docs/MIGRATION-MAP.md',
  'docs/SCALING-AND-CONTRIBUTING.md',
];

test('文档：全部相对链接都能解析到真实文件或目录', async () => {
  const broken = [];
  for (const doc of DOCS) {
    const path = join(root, doc);
    if (!existsSync(path)) { broken.push(`${doc} 不存在（文档清单过期？）`); continue; }
    const text = await readFile(path, 'utf8');
    for (const match of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const [, label, target] = match;
      if (target.startsWith('http') || target.startsWith('#')) continue;
      const resolved = join(dirname(path), target.split('#')[0]);
      if (!existsSync(resolved)) broken.push(`${doc} → [${label}](${target}) 指向不存在的路径`);
    }
  }
  assert.deepEqual(broken, [],
    `文档里有失效链接（文件移动/改名后必须同步更新）：\n${broken.join('\n')}`);
});

test('文档：文档清单本身是最新的（docs/ 下的 .md 都已登记）', async () => {
  const onDisk = (await readdir(join(root, 'docs')))
    .filter(name => name.endsWith('.md'))
    .map(name => `docs/${name}`);
  const registered = DOCS.filter(doc => doc.startsWith('docs/'));
  const unregistered = onDisk.filter(doc => !registered.includes(doc));
  assert.deepEqual(unregistered, [],
    `docs/ 下有未登记的文档，请加进本测试的 DOCS 清单：${unregistered.join(', ')}`);
});

test('文档：阶段状态与代码事实一致（防止"待实现"说谎）', async () => {
  const conventions = await readFile(join(root, 'CONVENTIONS.md'), 'utf8');
  const decisions = await readFile(join(root, 'docs/DECISIONS.md'), 'utf8');
  const migration = await readFile(join(root, 'docs/MIGRATION-MAP.md'), 'utf8');

  // ── P3：runner 已迁移（代码事实见 tests/framework.test.mjs 的迁移完整性用例）
  assert.ok(existsSync(join(root, 'games/runner/engine.js')), 'runner 引擎应在游戏目录内');
  assert.ok(!existsSync(join(root, 'art.mjs')), 'art.mjs 应已删除（内容已迁走）');
  assert.match(conventions, /P3[^\n]*已完成|P3 宿主框架 \+ runner 迁移 \| ✅/,
    'CONVENTIONS 应把 P3 标为已完成');

  // ── P4：pins/screws 已迁移至各自目录
  for (const id of ['pins', 'screws']) {
    assert.ok(existsSync(join(root, 'games', id, 'manifest.js')), `${id} 的 manifest 应已就位`);
    assert.ok(existsSync(join(root, 'games', id, 'engine.js')), `${id} 的引擎应已迁移`);
    assert.ok(existsSync(join(root, 'games', id, 'render.js')), `${id} 的渲染器应已迁移`);
    assert.ok(existsSync(join(root, 'games', id, 'levels.js')), `${id} 的关卡应已迁移`);
  }
  assert.ok(existsSync(join(root, 'engine.mjs')), 'engine.mjs 作为过渡兼容桥梁仍保留');
  assert.match(conventions, /P4[^\n]*已完成|P4[^\n]*✅/, 'CONVENTIONS 应把 P4 标为已完成');
  assert.match(migration, /P4/, 'MIGRATION-MAP 必须有 P4 相关记录');

  // ── 多人：仅预留、未实现（T7 也校验这一点，这里是文档侧的对应检查）
  assert.ok(!existsSync(join(root, 'src/multiplayer')), 'src/multiplayer/ 不应存在（多人仅预留）');
  assert.ok(existsSync(join(root, 'src/core/multiplayer.js')), '多人契约应保留');
  assert.match(decisions, /多人游玩[^\n]*接口预留|仅预留/,
    'DECISIONS 必须写明多人是"仅预留"');

  // ── 存储：端口在、适配器未实现 → 文档不得声称已完成
  assert.ok(existsSync(join(root, 'src/storage/adapter.js')), '存储端口应存在');
  assert.ok(!existsSync(join(root, 'src/storage/local-storage-adapter.js')),
    'localStorage 适配器尚未实现，文档与 CONVENTIONS 的"未实现"标注才是对的');
  assert.match(conventions, /存储收口[^\n]*⏳/, 'CONVENTIONS 应把存储收口标为未开始');
});

test('文档：约定的执行者（测试组）真实存在', async () => {
  const conventions = await readFile(join(root, 'CONVENTIONS.md'), 'utf8');
  const dictionary = await readFile(join(root, 'tests/dictionary.test.mjs'), 'utf8');
  const framework = await readFile(join(root, 'tests/framework.test.mjs'), 'utf8');

  // CONVENTIONS §6 用 T1…T7 指代字典测试组，那些前缀必须真的存在
  for (const group of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']) {
    assert.match(conventions, new RegExp('`' + group + '\\b'), `CONVENTIONS 应引用测试组 ${group}`);
    assert.ok(dictionary.includes(`test('${group} `),
      `CONVENTIONS 声称 ${group} 是约定的执行者，但 tests/dictionary.test.mjs 里没有该组测试`);
  }

  // 文档里点名的关键测试文件必须存在
  for (const [file, content, marker] of [
    ['tests/framework.test.mjs', framework, '结算只发生一次'],
    ['tests/framework.test.mjs', framework, '迁移完整性'],
  ]) {
    assert.ok(content.includes(marker), `${file} 应包含「${marker}」用例（被文档引用为执行者）`);
  }
});
