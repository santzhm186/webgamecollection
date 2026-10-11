/**
 * 存储端口（Port）—— 数据保存库对外的唯一抽象
 * ============================================================================
 * 铁律：**除 src/storage/** 之外，任何文件不得直接访问 localStorage / IndexedDB /
 * fetch 持久化接口。** 所有持久化都要经过 StorageAdapter。
 *
 * 为什么必须异步（本项目最重要的不可逆决策）：
 *   localStorage 是同步的，IndexedDB / SQLite / HTTP 不是。
 *   如果现在写成同步签名，将来接后端就要改遍每一个调用点，
 *   而那是破坏性变更——现在多写一个 await，将来少改几十处。
 *
 * 命名空间（namespace）代替裸 key 前缀，用于隔离不同用途的数据：
 *   'scores'    成绩记录（ScoreRecord）—— 排行榜的数据源
 *   'progress'  进度与星级（ProgressRecord）
 *   'settings'  音效/主题等本机设置
 *   'identity'  设备 ID 与昵称
 *   'meta'      适配器自身版本、迁移标记
 *
 * @typedef {'scores'|'progress'|'settings'|'identity'|'meta'} Namespace
 */

/**
 * 适配器能力声明。UI 据此决定显示"本地模式"还是真实排行榜——
 * 这是让排行榜 UI 在换成后端后**一行都不用改**的关键。
 *
 * @typedef {Object} AdapterCapabilities
 * @property {boolean} remote      数据是否跨设备可见。false 时榜单只能显示自己
 * @property {boolean} orderBy     是否支持服务端排序（后端应把排名下推到 SQL）
 * @property {boolean} paginate
 * @property {boolean} transactions
 * @property {number} [quotaBytes] 容量上限，超出需压缩策略
 */

/**
 * 存储适配器。所有方法失败时**不应抛出**，而应通过返回值或 reject 让上层决定降级；
 * 上层（ScoreStore）负责把失败转成 toast 提示，绝不静默丢数据。
 *
 * @typedef {Object} StorageAdapter
 * @property {AdapterCapabilities} capabilities
 * @property {string} kind                        'local' | 'memory' | 'sqlite'
 *
 * @property {(ns: Namespace, key: string) => Promise<unknown|null>} get
 * @property {(ns: Namespace, value: unknown, key?: string) => Promise<string>} put   返回写入后的 key
 * @property {(ns: Namespace, key: string) => Promise<boolean>} remove
 * @property {(ns: Namespace) => Promise<Array<{key: string, value: unknown}>>} list  排行榜扫描用
 * @property {(ns: Namespace) => Promise<void>} clearNamespace
 * @property {(ns?: Namespace) => Promise<void>} clear
 * @property {() => Promise<{used: number, quota: number}>} usage
 *
 * // --- 可选：远程适配器实现后，把排序下推，本地适配器可省略 ---
 * @property {(q: import('../core/contracts.js').LeaderboardQuery) => Promise<import('../core/contracts.js').LeaderboardRow[]>} [top]
 */

/**
 * 适配器契约的一致性测试用例。**每个适配器都必须通过同一组用例**，
 * 这是"可替换适配器"这个承诺能兑现的唯一保障。
 *
 * 实现约定：不在此文件写断言逻辑（宿主测试文件负责），只登记用例名，
 * 避免契约文件变成第 N 个测试实现。
 *
 * @type {readonly string[]}
 */
export const ADAPTER_CONTRACT_CASES = Object.freeze([
  'get 不存在的 key 返回 null',
  'put 默认 key 后可被 get 读回，且值深相等',
  'put 相同 key 覆盖而非追加',
  'remove 后 get 返回 null，重复 remove 返回 false',
  'list 只返回本 namespace 的条目',
  'clearNamespace 不影响其他 namespace',
  'namespace 隔离：相同 key 在不同 namespace 互不可见',
  'usage 返回非负的 used，且 put 后 used 增长',
  '写入不可序列化的值时应显式失败，而不是写入 "undefined"',
  '配额超限时应明确报错，调用方能据此降级',
]);

/**
 * 创建适配器的工厂签名。
 * @typedef {(opts?: object) => StorageAdapter} AdapterFactory
 */

/**
 * 按环境选择适配器。这是上层唯一允许的适配器获取方式。
 *
 * 选择顺序（可用性优先，绝不因为存储不可用而让游戏不能玩）：
 *   1. 显式 opts.kind
 *   2. 浏览器且 localStorage 可写 → 'local'
 *   3. 其余（Node 测试、隐私模式、配额为 0）→ 'memory'
 *
 * 注意：memory 适配器只保证本次会话内可用，适合测试与隐私模式降级。
 *
 * @param {object} [opts]
 * @param {'local'|'memory'|'sqlite'} [opts.kind]
 * @param {boolean} [opts.remote]  将来接后端时置 true 以选用远程适配器
 * @returns {Promise<StorageAdapter>}
 */
export async function createAdapter(opts = {}) {
  // P0 阶段：仅登记契约与选择顺序，实现见 src/storage/local-storage-adapter.js
  //           与 src/storage/memory-adapter.js
  //
  // 注意：因为是 async 函数，这里的失败以 **rejected promise** 形式出现，
  // 而不是同步抛出 —— 调用方统一用 try/catch + await 处理，不必区分两种错误形态。
  // 这也是"全异步"决策的一部分：同步抛错会迫使调用方写两套错误处理。
  throw new Error(`未实现(${opts.kind ?? 'auto'})：P0 阶段实现 local / memory 适配器并让 ADAPTER_CONTRACT_CASES 全绿`);
}

export default {};
