export const isComplete = (tube, capacity = 4) => tube.length === capacity && tube.every(color => color === tube[0]);
export const isSolved = (tubes, capacity = 4) => tubes.every(tube => tube.length === 0 || isComplete(tube, capacity));

/** The whole contiguous top colour pours, limited by the destination's free space. */
export function pourAmount(tubes, from, to, capacity = 4) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !tubes[from] || !tubes[to]) return 0;
  const source = tubes[from], target = tubes[to];
  if (!source.length || target.length >= capacity || (target.length && target.at(-1) !== source.at(-1))) return 0;
  let count = 1;
  while (count < source.length && source.at(-1 - count) === source.at(-1)) count++;
  return Math.min(count, capacity - target.length);
}

export function poured(tubes, from, to, amount) {
  const next = tubes.map(tube => [...tube]);
  next[to].push(...next[from].splice(-amount));
  return next;
}

const stateKey = tubes => tubes.map(tube => tube.join('.')).sort().join('|');

/** BFS returns a shortest route. Tube permutation symmetry keeps all six levels small. */
export function solve(tubes, capacity = 4) {
  const initial = tubes.map(tube => [...tube]);
  const queue = [{ tubes: initial, parent: -1, move: null }];
  const seen = new Set([stateKey(initial)]);
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (isSolved(node.tubes, capacity)) {
      const path = [];
      for (let index = head; queue[index].parent !== -1; index = queue[index].parent) path.push(queue[index].move);
      return path.reverse();
    }
    for (let from = 0; from < tubes.length; from++) {
      const source = node.tubes[from];
      if (!source.length || isComplete(source, capacity)) continue;
      for (let to = 0; to < tubes.length; to++) {
        const amount = pourAmount(node.tubes, from, to, capacity);
        if (!amount) continue;
        // Moving an entire monochrome tube into an empty one only renames it.
        if (!node.tubes[to].length && amount === source.length) continue;
        const next = poured(node.tubes, from, to, amount), key = stateKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ tubes: next, parent: head, move: [from, to] });
      }
    }
  }
  return null;
}
