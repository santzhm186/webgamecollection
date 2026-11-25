// Directions rotate clockwise: north, east, south, west.
export const portCount = cell => cell.type === 'straight' ? 2 : 4;
export function ports(cell, rotation = cell.rotation) {
  if (cell.type === 'block') return [];
  if (cell.type === 'source' || cell.type === 'beacon') return [rotation];
  return [rotation, (rotation + (cell.type === 'straight' ? 2 : 1)) % 4];
}
export function neighbor(index, direction, width) {
  const row = Math.floor(index / width), column = index % width;
  if (direction === 0 && row > 0) return index - width;
  if (direction === 1 && column + 1 < width) return index + 1;
  if (direction === 2 && row + 1 < width) return index + width;
  if (direction === 3 && column > 0) return index - 1;
  return -1;
}
export function traceLight(config, cells) {
  const lit = [config.source], visited = new Set(lit);
  let index = config.source, exit = cells[index].rotation;
  while (true) {
    const next = neighbor(index, exit, config.width), entry = (exit + 2) % 4;
    if (next < 0 || visited.has(next) || !ports(cells[next]).includes(entry)) return { lit, connected: false, stop: next };
    lit.push(next); visited.add(next);
    if (next === config.beacon) return { lit, connected: true, stop: null };
    index = next;
    exit = ports(cells[index]).find(port => port !== entry);
    if (exit === undefined) return { lit, connected: false, stop: index };
  }
}
export function isSolved(config, cells) {
  const trace = traceLight(config, cells);
  return trace.connected && cells.every((cell, index) => !cell.checkpoint || trace.lit.includes(index));
}

/** Enumerate simple physical routes, minimizing clockwise quarter-turns.
 * Unlike a stored answer this also finds valid alternate paths after any move. */
export function solve(config, cells = config.cells) {
  let best = null, bestCost = Infinity;
  const checkpoints = cells.flatMap((cell, index) => cell.checkpoint ? [index] : []);
  function visit(index, exit, visited, changes, cost) {
    if (cost >= bestCost) return;
    const next = neighbor(index, exit, config.width), entry = (exit + 2) % 4;
    if (next < 0 || visited.has(next)) return;
    const cell = cells[next];
    if (cell.type === 'block' || cell.type === 'source') return;
    if (next === config.beacon) {
      if (cell.rotation !== entry || checkpoints.some(index => !visited.has(index))) return;
      bestCost = cost; best = changes; return;
    }
    const rotations = cell.locked ? [cell.rotation] : Array.from({ length: portCount(cell) }, (_, i) => i);
    for (const rotation of rotations) {
      const openings = ports(cell, rotation);
      if (!openings.includes(entry)) continue;
      const turns = (rotation - cell.rotation + portCount(cell)) % portCount(cell);
      const nextVisited = new Set(visited); nextVisited.add(next);
      visit(next, openings.find(port => port !== entry), nextVisited, [...changes, { index: next, rotation, turns }], cost + turns);
    }
  }
  visit(config.source, cells[config.source].rotation, new Set([config.source]), [], 0);
  return best ? { moves: best.flatMap(({ index, turns }) => Array(turns).fill(index)), cost: bestCost, route: best.map(item => item.index) } : null;
}
