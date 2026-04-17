import { describe, expect, it } from 'vitest';
import { createLevel2AdvisorState, generateLevel2Advice } from './AIAdvisor';
import { createLevel2RoundStateFromDeal } from './rules';
import type { Level2Card, Level2RoundDeal } from './types';

function card(rank: Level2Card['rank'], suit: Level2Card['suit']): Level2Card {
  return { rank, suit };
}

describe('level2 advisor', () => {
  it('becomes more aggressive in later rounds under the same visible information', () => {
    const deal: Level2RoundDeal = {
      sharedCards: [card(2, 'spade'), card(6, 'heart')],
      opponentHole: card(3, 'club'),
      playerHole: card(9, 'diamond'),
    };

    const earlyState = createLevel2RoundStateFromDeal(1, 30, 30, deal);
    const lateState = createLevel2RoundStateFromDeal(8, 24, 30, deal);
    const earlyAdvice = generateLevel2Advice(earlyState, createLevel2AdvisorState());
    const lateAdvice = generateLevel2Advice(lateState, createLevel2AdvisorState());

    expect(earlyAdvice.suggestedAction).toBe('raise');
    expect(lateAdvice.suggestedAction).toBe('raise');
    expect(lateAdvice.targetAmount).toBeGreaterThan(earlyAdvice.targetAmount);
  });
});
