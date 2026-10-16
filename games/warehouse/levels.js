import { DIFFICULTY } from '../../src/core/host-surface.js';

// Hand-authored teaching sequence. # bulkhead, . dock, $ cargo, @ courier.
// Step targets are verified by the breadth-first search in the game tests.
export const LEVELS = [
  {
    titleKey: 'game.warehouse.level1', lessonKey: 'game.warehouse.lesson1',
    difficulty: DIFFICULTY.ENTRY, steps: 2, budget: 6,
    map: ['#######', '#     #', '# @$ .#', '#     #', '#######'],
  },
  {
    titleKey: 'game.warehouse.level2', lessonKey: 'game.warehouse.lesson2',
    difficulty: DIFFICULTY.ENTRY, steps: 6, budget: 12,
    map: ['#######', '#   . #', '#     #', '#  $  #', '#  @  #', '#######'],
  },
  {
    titleKey: 'game.warehouse.level3', lessonKey: 'game.warehouse.lesson3',
    difficulty: DIFFICULTY.ADVANCED, steps: 8, budget: 16,
    map: ['########', '#      #', '# .  . #', '# $  $ #', '#   @  #', '########'],
  },
  {
    titleKey: 'game.warehouse.level4', lessonKey: 'game.warehouse.lesson4',
    difficulty: DIFFICULTY.ADVANCED, steps: 18, budget: 30,
    map: ['########', '#.    .#', '#  ##  #', '# $  $ #', '#   @  #', '#      #', '########'],
  },
  {
    titleKey: 'game.warehouse.level5', lessonKey: 'game.warehouse.lesson5',
    difficulty: DIFFICULTY.CHALLENGE, steps: 20, budget: 32,
    map: ['########', '#  .   #', '# .# . #', '#  $ $ #', '# $    #', '#   @  #', '########'],
  },
  {
    titleKey: 'game.warehouse.level6', lessonKey: 'game.warehouse.lesson6',
    difficulty: DIFFICULTY.CHALLENGE, steps: 26, budget: 40,
    map: ['########', '# . .  #', '#    . #', '# $#$  #', '#  $ # #', '# @    #', '########'],
  },
];

export default LEVELS;
