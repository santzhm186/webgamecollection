import { DIFFICULTY } from '../../src/core/host-surface.js';

// Tubes are listed from bottom to top. Each colour has exactly four units.
// Breadth-first search verifies the minimum pours: 3, 7, 7, 13, 14, 16.
export const LEVELS = [
  { titleKey: 'game.water-sort.level1', lessonKey: 'game.water-sort.lesson1', difficulty: DIFFICULTY.ENTRY,
    tubes: [[0, 0, 1, 1], [1, 1, 0, 0], []], par: 3, steps: 3 },
  { titleKey: 'game.water-sort.level2', lessonKey: 'game.water-sort.lesson2', difficulty: DIFFICULTY.ENTRY,
    tubes: [[0, 1, 0, 1], [1, 0, 1, 0], [], []], par: 7, steps: 8 },
  { titleKey: 'game.water-sort.level3', lessonKey: 'game.water-sort.lesson3', difficulty: DIFFICULTY.ADVANCED,
    tubes: [[0, 0, 1, 2], [1, 1, 2, 0], [2, 2, 0, 1], [], []], par: 7, steps: 8 },
  { titleKey: 'game.water-sort.level4', lessonKey: 'game.water-sort.lesson4', difficulty: DIFFICULTY.ADVANCED,
    tubes: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2], [], []], par: 13, steps: 14 },
  { titleKey: 'game.water-sort.level5', lessonKey: 'game.water-sort.lesson5', difficulty: DIFFICULTY.CHALLENGE,
    tubes: [[0, 1, 2, 0], [2, 3, 1, 3], [1, 0, 3, 2], [3, 2, 0, 1], [], []], par: 14, steps: 15 },
  { titleKey: 'game.water-sort.level6', lessonKey: 'game.water-sort.lesson6', difficulty: DIFFICULTY.CHALLENGE,
    tubes: [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 0], [3, 4, 0, 1], [4, 0, 1, 2], [], []], par: 16, steps: 18 },
].map(level => Object.freeze({ ...level, capacity: 4, tubes: Object.freeze(level.tubes.map(tube => Object.freeze(tube))) }));

export default LEVELS;
