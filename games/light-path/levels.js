import { DIFFICULTY } from '../../src/core/host-surface.js';

// A route is authored as adjoining grid cells. Extra chips are deliberate decoys.
// The builder derives the correct fittings, then applies fixed quarter-turns.
const direction = (a, b, width) => b === a - width ? 0 : b === a + 1 ? 1 : b === a + width ? 2 : 3;
function level(width, path, offsets, decoys = [], checkpoints = [], locked = [], allowance = 1) {
  const cells = Array.from({ length: width * width }, () => ({ type: 'block', rotation: 0 }));
  path.forEach((index, position) => {
    if (position === 0 || position === path.length - 1) {
      cells[index] = { type: position === 0 ? 'source' : 'beacon', rotation: direction(index, path[position === 0 ? 1 : position - 1], width), locked: true };
      return;
    }
    const a = direction(index, path[position - 1], width), b = direction(index, path[position + 1], width);
    const straight = (a + 2) % 4 === b;
    const rotation = straight ? a % 2 : (a + 1) % 4 === b ? a : b;
    const isLocked = locked.includes(index);
    const offset = isLocked ? 0 : offsets[(position - 1) % offsets.length];
    cells[index] = { type: straight ? 'straight' : 'corner', rotation: (rotation + offset) % (straight ? 2 : 4), locked: isLocked, checkpoint: checkpoints.includes(index) };
  });
  decoys.forEach(([index, type, rotation]) => { cells[index] = { type, rotation }; });
  return { width, cells, source: path[0], beacon: path.at(-1), allowance };
}

export const LEVELS = [
  level(3, [3, 4, 5], [1], [], [], [], 0),
  level(3, [6, 7, 4, 1, 2], [3, 1, 2], [[0, 'corner', 1]], [4], [], 1),
  level(4, [0, 1, 2, 6, 10, 9, 8, 12, 13, 14, 15], [1, 3, 0, 1, 2], [[3, 'corner', 2], [7, 'straight', 0]], [9], [6], 2),
  level(4, [4, 5, 1, 2, 6, 10, 9, 13, 14, 15, 11], [3, 1, 2, 1], [[0, 'corner', 1], [7, 'corner', 3], [12, 'straight', 1]], [2, 13], [10], 2),
  level(5, [20, 15, 10, 5, 6, 7, 12, 11, 16, 21, 22, 23, 18, 13, 8, 9, 14], [1, 2, 3, 1, 0, 3], [[0, 'corner', 1], [1, 'straight', 1], [2, 'corner', 2], [3, 'corner', 2], [19, 'straight', 0]], [6, 16, 18], [12, 23], 3),
  level(5, [0, 1, 6, 5, 10, 15, 16, 11, 12, 7, 8, 13, 18, 17, 22, 23, 24, 19, 14, 9, 4], [1, 3, 2, 1, 0, 2], [[2, 'corner', 2], [3, 'straight', 1], [20, 'corner', 0], [21, 'straight', 1]], [5, 11, 13, 22], [10, 8, 19], 3),
  level(5, [10, 5, 0, 1, 2, 7, 6, 11, 16, 15, 20, 21, 22, 17, 12, 13, 8, 3, 4, 9, 14, 19, 24, 23, 18], [3, 1, 2, 0, 1, 3], [], [1, 6, 21, 12, 9], [0, 15, 17, 4], 4),
].map((config, index) => ({ ...config, titleKey: `game.light-path.level${index + 1}`, lessonKey: `game.light-path.lesson${index + 1}`, difficulty: index < 2 ? DIFFICULTY.ENTRY : index < 4 ? DIFFICULTY.ADVANCED : DIFFICULTY.CHALLENGE }));

export default LEVELS;
