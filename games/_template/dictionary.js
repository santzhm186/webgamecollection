/**
 * 未注册模板的独立预览文案。复制为正式游戏时，改掉 my-game 前缀，并将两套
 * 文案补入 src/locales/ 的对应语言包；正式会话优先使用宿主注入的 ctx.t。
 */
import { getLocale } from '../../src/core/host-surface.js';

export const MESSAGES = Object.freeze({
  'zh-CN': Object.freeze({
    'game.my-game.title': '我的游戏',
    'game.my-game.tagline': '点击数字，累计到目标值。',
    'game.my-game.instruction': '点击 +N 按钮，累计到目标值。',
    'game.my-game.cardMeta': '3 关 · 数字益智',
    'game.my-game.artLabel': '开始我的游戏',
    'game.my-game.level1': '试手',
    'game.my-game.level2': '加压',
    'game.my-game.level3': '极限',
    'game.my-game.intro': '累计达到 {target} 即可通关。',
    'game.my-game.start': '开始吧。',
    'game.my-game.win': '累计 {total}，用了 {moves} 步，获得 {stars} 星。',
    'game.my-game.current': '当前 {total} / {target}。',
    'game.my-game.hint': '提示：试试点第 {n} 个。',
    'game.my-game.hudTotal': '累计',
    'game.my-game.hudMoves': '步数',
    'game.my-game.hudHints': '提示',
    'game.my-game.sceneLabel': '数字累加玩法',
    'game.my-game.totalLabel': '累计 {total} / {target}',
    'game.my-game.pick': '+{n}',
    'game.my-game.pickLabel': '加 {n}',
  }),
  en: Object.freeze({
    'game.my-game.title': 'My Game',
    'game.my-game.tagline': 'Pick numbers and reach the target.',
    'game.my-game.instruction': 'Choose a +N button to reach the target.',
    'game.my-game.cardMeta': '3 levels · Number puzzle',
    'game.my-game.artLabel': 'Play My Game',
    'game.my-game.level1': 'Warm-up',
    'game.my-game.level2': 'Pressure',
    'game.my-game.level3': 'Limit',
    'game.my-game.intro': 'Reach a total of {target} to win.',
    'game.my-game.start': 'Let’s start.',
    'game.my-game.win': 'Total {total} in {moves} moves. Earned {stars} stars.',
    'game.my-game.current': 'Current total: {total} / {target}.',
    'game.my-game.hint': 'Hint: try button {n}.',
    'game.my-game.hudTotal': 'Total',
    'game.my-game.hudMoves': 'Moves',
    'game.my-game.hudHints': 'Hints',
    'game.my-game.sceneLabel': 'Number addition game',
    'game.my-game.totalLabel': 'Total {total} / {target}',
    'game.my-game.pick': '+{n}',
    'game.my-game.pickLabel': 'Add {n}',
  }),
});

export const dictionaryKeys = Object.freeze(Object.keys(MESSAGES['zh-CN']));

/** 与宿主 t(key, params) 同形的独立回落函数，不把未注册模板加入全局语言包。 */
export function t(key, params, locale = getLocale()) {
  const text = MESSAGES[locale]?.[key] ?? MESSAGES['zh-CN'][key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params?.[name] === undefined ? match : String(params[name]));
}
