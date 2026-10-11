/**
 * 字典与命名约定的机械校验。
 * ============================================================================
 * 这个文件是「以后加内容不能随意取名」这条约定的执行者。
 * 它把四类约定从"文档里的建议"变成"CI 会失败的硬约束"：
 *
 *   T1 每个 locale 的键集完全一致（漏键 = 玩家看到键名）
 *   T2 t() 的缺键行为、参数插值、语言切换与订阅
 *   T3 游戏字典声明的键必须存在于语言包
 *   T4 面向玩家的文案必须走字典 —— 禁止在界面文件里硬编码中文
 *   T5 游戏不得 import 宿主内部模块，只能走 host-surface.js
 *
 * 新增文件时若被 T4 拦下，正确做法是补文案键，而不是加进白名单。
 * 白名单只接受"开发者诊断信息"这类**不面向玩家**的文本。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { BUNDLES } from '../src/locales/index.js';
import { LOCALES, DEFAULT_LOCALE, isSupportedLocale, localeMeta } from '../src/core/locales.js';
import { t, setLocale, getLocale, onLocaleChange, localeOptions, parseParams } from '../src/core/i18n.js';
import * as enums from '../src/core/enums.js';
import * as labels from '../src/core/labels.js';
import { validateMultiplayerSpec, createPlayerSlots } from '../src/core/multiplayer.js';

const root = fileURLToPath(new URL('../', import.meta.url));

/** 每个用例结束后恢复默认语言，避免用例之间互相影响 */
function withLocale(code, fn) {
  const before = getLocale();
  setLocale(code, { persist: false });
  try { fn(); } finally { setLocale(before, { persist: false }); }
}

/* ============================================================ T1 键集一致 */

test('T1 所有 locale 的键集与默认语言完全一致', () => {
  const base = new Set(Object.keys(BUNDLES[DEFAULT_LOCALE]));
  for (const { code, status } of LOCALES) {
    const bundle = BUNDLES[code];
    assert.ok(bundle, `locales.js 声明了 ${code}，但 src/locales/index.js 没有注册语言包`);
    const keys = new Set(Object.keys(bundle));
    const missing = [...base].filter(key => !keys.has(key));
    const extra = [...keys].filter(key => !base.has(key));
    assert.deepEqual(missing, [], `${code}（${status}）缺少 ${missing.length} 个键，玩家会看到键名本身`);
    assert.deepEqual(extra, [], `${code} 多出 ${extra.length} 个键，请同步到默认语言或删除`);
  }
});

test('T1 文案键命名符合约定：全部小写点分，area 在白名单内', () => {
  const areas = new Set(['app', 'nav', 'home', 'dialog', 'status', 'progress', 'result', 'common', 'game']);
  for (const key of Object.keys(BUNDLES[DEFAULT_LOCALE])) {
    // 段内允许 camelCase（app.footerYear），但每段必须以小写字母开头
    assert.match(key, /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){1,3}$/, `键格式不合法: ${key}`);
    const [area] = key.split('.');
    assert.ok(areas.has(area), `键 ${key} 的 area "${area}" 不在允许清单内（见 docs/NAMING-CONVENTIONS.md）`);
  }
});

test('T1 游戏专属文案必须放在 game.<id> 下，且 id 与注册游戏一致', () => {
  const gameIds = new Set(['runner', 'pins', 'screws']);
  const seen = new Set();
  for (const key of Object.keys(BUNDLES[DEFAULT_LOCALE])) {
    const parts = key.split('.');
    if (parts[0] !== 'game') continue;
    assert.ok(gameIds.has(parts[1]), `键 ${key} 引用了未注册的游戏 id "${parts[1]}"`);
    seen.add(parts[1]);
  }
  assert.deepEqual([...seen].sort(), [...gameIds].sort(), '每个游戏都应至少有一条专属文案');
});

test('T1 占位符在所有语言中保持一致', () => {
  const placeholders = text => new Set([...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]));
  const base = BUNDLES[DEFAULT_LOCALE];
  for (const { code } of LOCALES) {
    for (const [key, text] of Object.entries(BUNDLES[code])) {
      const expected = [...placeholders(base[key])].sort();
      const actual = [...placeholders(text)].sort();
      assert.deepEqual(actual, expected, `${code} 的 ${key} 占位符不一致：${actual} ≠ ${expected}`);
    }
  }
});

/* ============================================================ T2 运行时行为 */

test('T2 t() 插值参数，未知占位符原样保留', () => {
  withLocale('zh-CN', () => {
    assert.equal(t('dialog.levelChipLabel', { n: 3, title: '试手' }), '第 3 关 试手');
    assert.equal(t('dialog.levelChipLabel', { n: 3 }), '第 3 关 {title}', '缺参数时保留占位符，便于发现漏传');
  });
});

test('T2 缺键返回键名本身而不是空串，并回落到默认语言', () => {
  withLocale('en', () => {
    assert.equal(t('nope.missing.key'), 'nope.missing.key', '必须返回键名 —— 空白比看得见的键名更难排查');
  });
  // 人为构造"英文缺键、中文有"的场景，验证回落
  const savedEn = BUNDLES.en['common.level'];
  delete BUNDLES.en['common.level'];
  try {
    withLocale('en', () => assert.equal(t('common.level', { n: 2 }), '第 2 关', '缺失时应回落到默认语言'));
  } finally { BUNDLES.en['common.level'] = savedEn; }
});

test('T2 setLocale 幂等、拒绝不支持的语言、并通知订阅者', () => {
  const before = getLocale();
  const seen = [];
  const off = onLocaleChange(code => seen.push(code));
  try {
    assert.equal(setLocale('en', { persist: false }), true, '切换到不同语言应返回 true');
    assert.equal(setLocale('en', { persist: false }), false, '重复设置同一语言应返回 false 且不重复通知');
    assert.equal(getLocale(), 'en');
    assert.equal(setLocale('kl-GL', { persist: false }), true, '不支持的语言应回落为默认语言');
    assert.equal(getLocale(), DEFAULT_LOCALE);
    assert.deepEqual(seen, ['en', DEFAULT_LOCALE], '订阅者应只在真正变化时被通知');
  } finally {
    off();
    setLocale(before, { persist: false });
  }
});

test('T2 取消订阅后不再收到通知（组件卸载必须调用）', () => {
  const before = getLocale();
  let count = 0;
  const off = onLocaleChange(() => { count++; });
  off();
  setLocale(before === 'en' ? 'zh-CN' : 'en', { persist: false });
  setLocale(before, { persist: false });
  assert.equal(count, 0, '取消订阅后仍在回调：宿主重构后会残留幽灵监听器');
});

test('T2 localeOptions 标出当前语言，且顺序与 LOCALES 一致', () => {
  withLocale('en', () => {
    const options = localeOptions();
    assert.equal(options.length, LOCALES.length);
    assert.deepEqual(options.map(o => o.code), LOCALES.map(l => l.code));
    assert.equal(options.filter(o => o.selected).length, 1);
    assert.equal(options.find(o => o.selected).code, 'en');
  });
});

test('T2 parseParams 解析 data-i18n-params，数字自动转换', () => {
  assert.deepEqual(parseParams('n:3,total:45'), { n: 3, total: 45 });
  assert.deepEqual(parseParams("title:'试手'"), { title: '试手' });
  assert.deepEqual(parseParams('name:abc'), { name: 'abc' }, '非数字保持字符串');
  assert.equal(parseParams(''), undefined);
  assert.equal(parseParams(undefined), undefined);
});

test('T2 locales.js 是语言相关判断的唯一来源', () => {
  assert.ok(isSupportedLocale('zh-CN'));
  assert.ok(!isSupportedLocale('fr'));
  assert.equal(localeMeta('fr').code, DEFAULT_LOCALE, '未知语言应回落默认语言而不是 undefined');
  for (const locale of LOCALES) {
    assert.match(locale.code, /^[a-z]{2}(-[A-Z]{2})?$/, `locale code 必须符合 BCP 47: ${locale.code}`);
    assert.ok(['stable', 'beta'].includes(locale.status), `${locale.code} 的 status 不合法`);
    assert.ok(['ltr', 'rtl'].includes(locale.dir), `${locale.code} 的 dir 不合法`);
  }
});

/* ============================================================ T3 游戏字典 */

test('T3 游戏字典声明的文案键都存在于语言包', async () => {
  const games = (await readdir(join(root, 'games'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'));
  const base = new Set(Object.keys(BUNDLES[DEFAULT_LOCALE]));
  let checked = 0;
  for (const { name } of games) {
    // 尚未迁移的游戏目录（如 games/runner 仍是空目录）暂时跳过；
    // 一旦目录里出现 dictionary.js 就必须通过校验，避免校验被无声跳过。
    let dict;
    try {
      dict = await import(new URL(`../games/${name}/dictionary.js`, import.meta.url));
    } catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
      checked += 0;
      continue;
    }
    assert.ok(Array.isArray(dict.dictionaryKeys), `games/${name}/dictionary.js 必须导出 dictionaryKeys 数组`);
    for (const key of dict.dictionaryKeys) {
      assert.ok(base.has(key), `games/${name}/dictionary.js 声明了不存在的文案键: ${key}`);
      checked++;
    }
  }
  assert.ok(checked > 0, '没有检查到任何游戏字典键 —— 检查游戏目录是否正确');
});

test('T3 字典键值不重复：同一个文案不应有两个键', () => {
  const byValue = new Map();
  for (const [key, text] of Object.entries(BUNDLES[DEFAULT_LOCALE])) {
    if (!byValue.has(text)) byValue.set(text, []);
    byValue.get(text).push(key);
  }
  // 允许重复的白名单。判定标准：**同一中文词在不同语言里恰好同形**，
  // 属于翻译常态；而"同值同义的两个键"是真冗余，应当删除而不是加白名单
  // （本文件曾据此抓出 progress.locked 与 dialog.levelPending 完全冗余）。
  const allow = new Set([
    '★', '—', '分', '提示', '0 广告', 'GitHub', 'BOSS', '01 / ACTION', '02 / PUZZLE', '03 / CHILL',
    '宝藏',   // 机关名（拉环上）与场景区域标注，中文同词、英文不同（Treasure / TREASURE）
    '守卫',   // 面板标签"要塞守卫"与画布标签"守卫 N"
    '左', '右', // 短词在不同 UI 位置复用
    '挑战', // 关卡 chip 的默认态标签（dialog.levelChallenge）与难度分级名（common.difficultyChallenge）
           // 中文恰好同形，但英文不同（Play / Challenge），且语义确实不同，属于翻译常态
  ]);
  const dupes = [...byValue.entries()].filter(([text, keys]) => keys.length > 1 && !allow.has(text));
  assert.deepEqual(dupes.map(([text, keys]) => `${text} → ${keys.join(' / ')}`), [],
    '同一文案有多个键会导致改一处漏一处；请复用已有键，或确认后加进白名单');
});

/* ============================================================ T4 禁止硬编码 */

/**
 * 扫描面向玩家的文案是否绕过了字典。
 *
 * 判定方式：
 *   HTML —— 标签之间的文本节点含中文，且该元素没有 data-i18n
 *   JS   —— 字符串字面量含中文（注释已剔除）
 *
 * 白名单只接受**不面向玩家**的文本（开发者诊断、控制台告警）。
 * 如果被拦下的是玩家能看到的文案，正确做法是补键，而不是加白名单。
 */
const HARDCODE_ALLOWLIST = [
  { file: 'src/core/enums.js', reason: '枚举成员的中文注释是给贡献者看的，不面向玩家' },
  { file: 'src/core/labels.js', reason: '本文件就是共用文案字典本身' },
  { file: 'src/core/i18n.js', reason: '缺键告警是开发者诊断信息' },
  { file: 'src/core/locales.js', reason: '语言自称（简体中文/English）是数据，不是待翻译文案' },
  { file: 'src/locales/zh-CN.js', reason: '默认语言包本身' },
  { file: 'src/locales/en.js', reason: '英文包的注释与自检说明' },
  { file: 'src/storage/adapter.js', reason: '未实现异常与契约用例名是开发者诊断信息' },
  {
    file: 'app.mjs',
    reason: '仅放过 console.warn/error 的开发者诊断（[app] 前缀）。这类信息只进控制台、不进界面；'
      + '若将来要面向玩家，必须改为 t() 键。',
    // 按"行内特征"放过而不是整个文件：app.mjs 其余位置的中文仍会被拦截
    linePattern: /console\.(warn|error)\(/,
  },
];

async function collectFiles(dir, filter, out = []) {
  for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      await collectFiles(rel, filter, out);
    } else if (filter(entry.name)) out.push(rel);
  }
  return out;
}

/** 整文件白名单 */
const isFileAllowlisted = file => HARDCODE_ALLOWLIST.some(item => item.file === file && !item.linePattern);
/** 行级白名单：文件匹配 + 该行匹配 linePattern */
const isLineAllowlisted = (file, line) =>
  HARDCODE_ALLOWLIST.some(item => item.file === file && item.linePattern && item.linePattern.test(line));

test('T4 JS 界面文件不得硬编码面向玩家的中文文案', async () => {
  const files = ['app.mjs', 'boards.mjs', 'engine.mjs', 'games/runner/render.js'];
  const violations = [];
  for (const file of files) {
    if (isFileAllowlisted(file)) continue;
    const raw = await readFile(join(root, file), 'utf8');
    // 先把跨行块注释整体剔除并保留行数，否则说明文字（注释）会被误判成硬编码文案
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, block => block.replace(/[^\n]/g, ' '));
    text.split('\n').forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, '');
      const literals = [...code.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`\\]*)`/g)];
      for (const match of literals) {
        const value = match[1] ?? match[2] ?? match[3] ?? '';
        if (!/[\u4e00-\u9fa5]/.test(value)) continue;
        // 文案键本身是 ASCII，所以命中这里的一定是硬编码文案或诊断信息
        if (isLineAllowlisted(file, code)) continue;
        violations.push(`${file}:${index + 1}  ${value.slice(0, 48)}`);
      }
    });
  }
  assert.deepEqual(violations, [],
    `发现硬编码中文文案（请补进 src/locales/*.js 并用 t() 取值，而不是加白名单）：\n${violations.join('\n')}`);
});

test('T4 HTML 里的中文文本节点必须带 data-i18n 或 data-i18n-attr', async () => {
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const violations = [];
  // 逐标签检查：<tag ...>文本</tag> 形式
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>([^<]*[\u4e00-\u9fa5][^<]*)</gi)) {
    const [, tag, attrs, inner] = match;
    if (tag === 'title' || tag === 'meta') continue;
    if (/data-i18n/.test(attrs)) continue;
    // 容器本身只是外壳，内部子节点各自带 data-i18n —— 跳过，避免误报
    if (/<[a-z][^>]*\sdata-i18n/.test(inner)) continue;
    violations.push(`<${tag}> ${inner.trim().slice(0, 40)}`);
  }
  assert.deepEqual(violations, [],
    `HTML 里的中文没有接字典（加 data-i18n 或 data-i18n-attr）：\n${violations.join('\n')}`);
});

/* ============================================================ T5 依赖边界 */

/**
 * 游戏目录只允许 import 三处：
 *   1. 自己的相对文件
 *   2. src/core/host-surface.js（宿主开放的门面）
 *   3. 其他游戏目录（若确有共享需求，应先考虑上提到共享实体库）
 * 绝对禁止 import 宿主内部模块（services / storage / ui / leaderboard / 具体 core 文件）。
 */
test('T5 games/** 不得 import 宿主内部模块，只能走 host-surface.js', async () => {
  const files = await collectFiles('games', name => name.endsWith('.js') || name.endsWith('.mjs'));
  const violations = [];
  for (const file of files) {
    const text = await readFile(join(root, file), 'utf8');
    for (const match of text.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
      const spec = match[1];
      if (spec.startsWith('.')) {
        // 相对路径：解析后只允许落在游戏目录或两个"合法共享入口"
        const resolved = relative(root, join(root, dirname(file), spec)).replace(/\\/g, '/');
        const allowed = resolved.startsWith('games/')
          || resolved === 'src/core/host-surface.js'          // 宿主开放的能力门面
          || resolved === 'src/ui/scene/primitives.js';        // 共享 Canvas 绘制原语（游戏渲染器必需）
        if (!allowed) violations.push(`${file} → ${spec}  (解析为 ${resolved})`);
        continue;
      }
      // node: 内置模块是允许的（测试文件需要 node:test / node:assert）；
      // 其余裸模块一律禁止 —— 零运行时依赖是"没有供应链攻击面"的唯一保证
      if (spec.startsWith('node:')) continue;
      violations.push(`${file} → ${spec}  (禁止引入外部裸模块依赖)`);
    }
  }
  assert.deepEqual(violations, [],
    `游戏模块越过契约边界（只允许 import 自己的文件、src/core/host-surface.js、src/ui/scene/primitives.js）：\n${violations.join('\n')}`);
});

test('T5 host-surface 是宿主对游戏的唯一出口，且不承载逻辑', async () => {
  const text = await readFile(join(root, 'src/core/host-surface.js'), 'utf8');
  assert.match(text, /host-surface|共享入口/, 'host-surface.js 必须保留说明其用途的注释');
  // 只做转发：不应出现函数体（花括号内的语句）
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bfunction\b/.test(withoutComments), 'host-surface.js 只应 re-export，不应实现逻辑');
});

/* ============================================================ T6 渲染层冒烟 */

/**
 * 这一组是为了堵住一个真实盲区：本轮重构中 boards.mjs 曾把模板插值写进
 * 单引号字符串（'…${t(…)}…'），浏览器与 Node 都会直接 SyntaxError，
 * 但**原有测试全绿** —— 因为没有任何测试 import 渲染层。
 * 结果整站白屏，只能靠人工打开页面才发现。
 *
 * 因此：渲染层必须被真实 import 一次。它不含 DOM 顶层代码，可以在 Node 里
 * 安全加载；同时校验导出仍然存在（防止后续重构误删）。
 */
test('T6 渲染层可以被真实加载（防模板转义类语法错误）', async () => {
  const boards = await import('../boards.mjs');
  assert.equal(typeof boards.pinBoard, 'function', 'boards.mjs 必须导出 pinBoard');
  assert.equal(typeof boards.screwBoard, 'function', 'boards.mjs 必须导出 screwBoard');
  assert.equal(typeof boards.PIN_POINTS, 'object', 'boards.mjs 需保留 PIN_POINTS 兼容再导出');

  // runner 的渲染器已在 P3 迁到 games/runner/rendering.js；art.mjs 已删除
  const runnerRender = await import('../games/runner/render.js');
  assert.equal(typeof runnerRender.drawScene, 'function', 'runner 渲染器必须导出 drawScene');
  assert.equal(typeof runnerRender.drawPreview, 'function', 'runner 渲染器必须导出 drawPreview');
  assert.equal(typeof runnerRender.default, 'function', 'runner 渲染器必须默认导出工厂');
});

test('T6 渲染器产出真实标记：两个棋盘都能渲染出按钮与无障碍标签', async () => {
  const { pinBoard, screwBoard } = await import('../boards.mjs');
  const { Pins, Screws } = await import('../engine.mjs');

  const pinMarkup = pinBoard(new Pins(0));
  assert.match(pinMarkup, /data-pin="water"/, '拉针棋盘必须渲染出机关按钮');
  assert.match(pinMarkup, /aria-label="/, '拉针按钮必须带无障碍标签');
  assert.match(pinMarkup, /<svg/, '必须产出 SVG 场景');

  const screwMarkup = screwBoard(new Screws(2));
  assert.match(screwMarkup, /data-plate="\d+" data-end="\d+"/, '螺丝棋盘必须渲染出螺丝按钮');
  assert.match(screwMarkup, /aria-label="/, '螺丝按钮必须带无障碍标签');
});

test('T6 渲染层不反向依赖规则层（boards → engine 已消除）', async () => {
  const text = await readFile(join(root, 'boards.mjs'), 'utf8');
  const imports = [...text.matchAll(/^\s*import[^'"]*from\s*['"]([^'"]+)['"]/gm)].map(match => match[1]);
  assert.ok(!imports.includes('./engine.mjs'),
    `boards.mjs（渲染）不得 import engine.mjs（规则）：${imports.join(', ')}`);
  for (const spec of imports) {
    assert.ok(spec.startsWith('./games/') || spec.startsWith('./src/'),
      `boards.mjs 只应从游戏侧字典或 src/ 取依赖，发现: ${spec}`);
  }
});

test('T6 runner 渲染器不得依赖旧路径（迁移完整性）', async () => {
  const text = await readFile(join(root, 'games/runner/render.js'), 'utf8');
  assert.ok(!/from '[^']*art\.mjs'/.test(text), 'art.mjs 已删除，渲染器不应再引用它');
  assert.ok(!/from '[^']*engine\.mjs'/.test(text), 'runner 渲染器不应引用根目录的过渡文件 engine.mjs');
});

/* ============================================================ T7 多人契约（预留） */

/**
 * 多人能力当前**只预留、未实现**。预留在没有测试时会腐烂成"看起来能用其实不能用"，
 * 所以这里校验三件事：
 *   ① 校验函数本身正确（将来 manifest 声明依赖它）
 *   ② 预留状态是显式的 —— 一旦有人开始实现适配器，这个测试会提醒他更新文档与路线图
 *   ③ 未声明 players 的游戏必须仍然合法（向后兼容是"预留"能安全存在的前提）
 */
test('T7 多人声明校验：合法声明通过，非法声明给出可读错误', () => {
  assert.deepEqual(validateMultiplayerSpec(undefined), [], '不声明 players 必须合法（= 单人，向后兼容）');

  const legal = [
    { min: 1, max: 1, defaultMode: 'solo' },
    { min: 1, max: 2, defaultMode: 'local-multi', order: 'turn' },
    { min: 2, max: 4, defaultMode: 'local-multi', order: 'simultaneous', requiresSeed: true },
    { min: 1, max: 8, defaultMode: 'online-multi' },
  ];
  for (const spec of legal) {
    assert.deepEqual(validateMultiplayerSpec(spec), [], `合法声明被误判: ${JSON.stringify(spec)}`);
  }

  const bad = [
    [{ min: 0, max: 2, defaultMode: 'local-multi' }, 'min 必须 >= 1'],
    [{ min: 3, max: 2, defaultMode: 'local-multi' }, 'max 不能小于 min'],
    [{ min: 1, max: 1, defaultMode: 'nonsense' }, 'defaultMode 必须是已知模式'],
    [{ min: 1, max: 4, defaultMode: 'solo' }, 'solo 却允许多人 → 矛盾'],
    [{ min: 1, max: 1, defaultMode: 'local-multi' }, '多人模式却只允许 1 人 → 矛盾'],
    [{ min: 1, max: 2, defaultMode: 'local-multi', order: '轮着来' }, 'order 取值非法'],
    [{ min: 1, max: 2, defaultMode: 'local-multi', requiresSeed: 'yes' }, 'requiresSeed 必须是布尔值'],
  ];
  for (const [spec, reason] of bad) {
    const errors = validateMultiplayerSpec(spec);
    assert.ok(errors.length > 0, `应被拒绝（${reason}）: ${JSON.stringify(spec)}`);
    assert.ok(errors.every(e => typeof e === 'string' && e.length > 0), '错误信息必须是可读字符串');
  }
});

test('T7 玩家位生成：数量被钳制在 min..max，1 号位是"我"，其余可控', () => {
  const spec = { min: 1, max: 4, defaultMode: 'local-multi' };

  const one = createPlayerSlots(spec, 1);
  assert.equal(one.length, 1);
  assert.equal(one[0].index, 0, 'index 必须从 0 开始（动作里用它寻址）');
  assert.equal(one[0].controller, 'human');
  assert.equal(one[0].isSelf, true);

  const four = createPlayerSlots(spec, 4);
  assert.equal(four.length, 4);
  assert.deepEqual(four.map(s => s.index), [0, 1, 2, 3], 'index 必须连续，否则动作寻址会错位');
  assert.equal(four.filter(s => s.isSelf).length, 1, '只能有一个"我"');
  assert.ok(four.every(s => s.ready === true), '本地局玩家位默认就绪');

  assert.equal(createPlayerSlots(spec, 99).length, spec.max, '超过上限必须钳制到 max');
  assert.equal(createPlayerSlots(spec, 0).length, spec.min, '低于下限必须钳制到 min');
  assert.equal(new Set(four.map(s => s.label)).size, 4, '玩家位标签必须互不相同，否则界面无法区分');
});

test('T7 多人仍处于"仅预留"状态：实现适配器时必须同步更新文档与路线图', async () => {
  // 这个断言是刻意设的"绊线"：一旦 src/multiplayer/ 出现实现，
  // 说明多人已进入开发，此时必须同步更新 docs/ARCHITECTURE.md 与
  // multiplayer.js 文末的接入路线，而不是让文档停留在"预留"。
  const exists = await readdir(join(root, 'src'), { withFileTypes: true })
    .then(entries => entries.some(entry => entry.name === 'multiplayer'))
    .catch(() => false);
  if (exists) {
    const doc = await readFile(join(root, 'docs/ARCHITECTURE.md'), 'utf8');
    assert.ok(!/仅预留接口，未实现任何适配器/.test(doc),
      'src/multiplayer/ 已出现实现，但文档仍写着"未实现任何适配器" —— 请更新 docs/ARCHITECTURE.md 与 multiplayer.js 的接入路线');
  }
  // 契约文件必须始终说明当前状态，避免读者以为可以直接用
  const contract = await readFile(join(root, 'src/core/multiplayer.js'), 'utf8');
  assert.match(contract, /仅预留接口，尚未实现/, 'multiplayer.js 顶部必须显式写明当前状态');
});

/* ============================================================ 枚举与标签 */

test('枚举字典：值唯一、非空、且都在 ALL_ENUMS 里登记', () => {
  for (const [name, dict] of Object.entries(enums.ALL_ENUMS)) {
    const values = Object.values(dict);
    assert.ok(values.length > 0, `${name} 是空字典`);
    assert.equal(new Set(values).size, values.length, `${name} 存在重复值`);
    for (const value of values) {
      assert.equal(typeof value, 'string', `${name} 的值必须是字符串，便于持久化与跨端传输`);
      assert.match(value, /^[a-z][a-z0-9-]*$/, `${name} 的值 "${value}" 不符合 kebab-case 约定`);
    }
  }
});

test('枚举字典：RENDERER_KIND 与 STORAGE_KIND 必须是两套互不相同的取值', () => {
  // 这两个字段以前都叫 kind，语义无关却共用命名，是最容易踩的坑
  const renderer = new Set(Object.values(enums.RENDERER_KIND));
  for (const value of Object.values(enums.STORAGE_KIND)) {
    assert.ok(!renderer.has(value), `STORAGE_KIND 与 RENDERER_KIND 不应有共同取值 "${value}"，否则调用方无法区分`);
  }
});

test('难度字典：顺序即难度递增，值与 tone 一一对应', () => {
  const order = Object.values(labels.DIFFICULTY);
  assert.equal(order.length, 3, '难度分级数量变化时必须同步更新本测试与文档');
  assert.deepEqual(order, ['入门', '进阶', '挑战'], '对象字面量必须保持插入顺序（依赖字符串键的顺序语义）');
  for (const difficulty of order) {
    assert.ok(labels.DIFFICULTY_TONE[difficulty], `难度 ${difficulty} 缺少 tone 映射，宿主渲染标签时会取到 undefined`);
  }
});

test('星级工具函数：边界钳制正确', () => {
  assert.deepEqual(labels.starRow(3).filled.length, 3);
  assert.deepEqual(labels.starRow(3).empty.length, 0);
  assert.equal(labels.starRow(99).filled.length, labels.STAR.MAX, '超过上限必须钳制，否则会画出 99 颗星');
  assert.equal(labels.starRow(-5).filled.length, 0);
  assert.equal(labels.starRow(NaN).filled.length, 0);
});

test('每个枚举成员都必须有中文注释（供贡献者理解何时使用）', async () => {
  const lines = (await readFile(join(root, 'src/core/enums.js'), 'utf8')).split('\n');
  const missing = [];
  for (const [name, dict] of Object.entries(enums.ALL_ENUMS)) {
    for (const [member, value] of Object.entries(dict)) {
      const index = lines.findIndex(line => new RegExp(`^\\s*${member}\\s*:\\s*'${value}',`).test(line));
      if (index < 0) { missing.push(`${name}.${member} 未在字典文件中找到`); continue; }
      const inline = /\/\/\s*\S/.test(lines[index].slice(lines[index].indexOf("',") + 2));
      const above = index > 0 && /^\s*(\/\/|\/\*)/.test(lines[index - 1]);
      if (!inline && !above) missing.push(`${name}.${member}（值 '${value}'）`);
    }
  }
  assert.deepEqual(missing, [],
    `以下枚举成员缺少说明注释 —— 枚举必须说明"什么时候会用到它"，否则贡献者会加重复成员：\n${missing.join('\n')}`);
});
