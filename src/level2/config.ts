import type { Level2Rank, Level2Suit } from './types';

export const LEVEL2_SCENE_KEY = 'Level2Scene';
export const LEVEL2_TITLE = '第二关：盲河诈牌';

export const LEVEL2_INITIAL_CHIPS = 40;
export const LEVEL2_ANTE = 1;
export const LEVEL2_SPECIAL_FOLD_PENALTY = 10;
export const LEVEL2_MAX_RAISE = 6;

export const LEVEL2_RANKS: Level2Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const LEVEL2_SUITS: Level2Suit[] = ['spade', 'heart', 'club', 'diamond'];

export const LEVEL2_STRAIGHT_PATTERNS: Level2Rank[][] = [
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
  [4, 5, 6],
  [5, 6, 7],
  [6, 7, 8],
  [7, 8, 9],
  [8, 9, 10],
  [1, 9, 10],
  [1, 2, 10],
];

export const LEVEL2_HAND_WEIGHT = {
  high_card: 1,
  pair: 2,
  straight: 3,
  flush: 4,
  straight_flush: 5,
  three_of_a_kind: 6,
} as const;
