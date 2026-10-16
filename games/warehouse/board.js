/** Pure board operations shared by the engine and its deterministic solver. */
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

export function parseBoard(map) {
  const width = map[0].length, height = map.length;
  const walls = [], goals = [], boxes = [];
  let player = -1;
  map.forEach((row, y) => [...row].forEach((cell, x) => {
    const index = y * width + x;
    if (cell === '#') walls.push(index);
    if ('.*+'.includes(cell)) goals.push(index);
    if ('$*'.includes(cell)) boxes.push(index);
    if ('@+'.includes(cell)) player = index;
  }));
  if (map.some(row => row.length !== width) || player < 0 || goals.length !== boxes.length) {
    throw new TypeError('Invalid warehouse board');
  }
  return { width, height, walls, goals, boxes: boxes.sort((a, b) => a - b), player };
}

export function adjacent(board, index, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) return -1;
  const x = index % board.width + delta.x;
  const y = Math.floor(index / board.width) + delta.y;
  return x >= 0 && x < board.width && y >= 0 && y < board.height ? y * board.width + x : -1;
}

export function isFloor(board, index) {
  return index >= 0 && index < board.width * board.height && !board.walls.includes(index);
}

export function transition(board, player, boxes, direction) {
  const next = adjacent(board, player, direction);
  if (!isFloor(board, next)) return null;
  const boxIndex = boxes.indexOf(next);
  if (boxIndex < 0) return { player: next, boxes, pushed: false };
  const beyond = adjacent(board, next, direction);
  if (!isFloor(board, beyond) || boxes.includes(beyond)) return null;
  const moved = boxes.slice();
  moved[boxIndex] = beyond;
  moved.sort((a, b) => a - b);
  return { player: next, boxes: moved, pushed: true };
}

/** Reverse pulls find squares from which cargo can never reach any dock. */
export function deadSquares(board) {
  const safe = new Set(board.goals), queue = [...board.goals];
  for (let head = 0; head < queue.length; head++) {
    for (const direction of Object.keys(DIRECTIONS)) {
      const previous = adjacent(board, queue[head], direction);
      const standing = adjacent(board, previous, direction);
      if (isFloor(board, previous) && isFloor(board, standing) && !safe.has(previous)) {
        safe.add(previous);
        queue.push(previous);
      }
    }
  }
  return new Set(Array.from({ length: board.width * board.height }, (_, index) => index)
    .filter(index => isFloor(board, index) && !safe.has(index)));
}

export function isSolved(board, boxes) {
  return boxes.every(box => board.goals.includes(box));
}

/** Few, compact levels allow exact shortest-move hints without a worker or deps. */
export function solveBoard(board, player = board.player, boxes = board.boxes, limit = 150000) {
  const dead = deadSquares(board);
  if (boxes.some(box => dead.has(box))) return null;
  const key = (p, cargo) => `${p}:${cargo.join(',')}`;
  const nodes = [{ player, boxes, parent: -1, direction: null }];
  const seen = new Set([key(player, boxes)]);
  for (let head = 0; head < nodes.length && head < limit; head++) {
    const node = nodes[head];
    if (isSolved(board, node.boxes)) {
      const path = [];
      for (let cursor = head; nodes[cursor].parent !== -1; cursor = nodes[cursor].parent) path.push(nodes[cursor].direction);
      return path.reverse();
    }
    for (const direction of Object.keys(DIRECTIONS)) {
      const next = transition(board, node.player, node.boxes, direction);
      if (!next || (next.pushed && next.boxes.some(box => dead.has(box)))) continue;
      const id = key(next.player, next.boxes);
      if (seen.has(id)) continue;
      seen.add(id);
      nodes.push({ ...next, parent: head, direction });
    }
  }
  return null;
}
