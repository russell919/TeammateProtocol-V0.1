import { describe, expect, it } from 'vitest';
import { createLevel2DirectorState, generateLevel2OpponentResponse } from './OpponentDirector';
import { createLevel2RoundStateFromDeal } from './rules';
import type { Level2Action, Level2Card, Level2RoundDeal } from './types';

function card(rank: Level2Card['rank'], suit: Level2Card['suit']): Level2Card {
  return { rank, suit };
}

describe('level2 opponent director', () => {
  it('can continue raising with a stronger hand', () => {
    const deal: Level2RoundDeal = {
      sharedCards: [card(7, 'heart'), card(2, 'spade')],
      opponentHole: card(7, 'club'),
      playerHole: card(4, 'diamond'),
    };
    const state = createLevel2RoundStateFromDeal(7, 26, 32, deal);
    const action: Level2Action = { type: 'raise', amount: 1 };
    const response = generateLevel2OpponentResponse(state, createLevel2DirectorState(), action, null);

    expect(response.action.type).toBe('raise');
    expect(response.action.amount).toBeGreaterThanOrEqual(1);
  });
});
