import { describe, expect, it } from 'vitest';
import {
  compareLevel2Hands,
  createLevel2RoundState,
  createLevel2Deck,
  drawLevel2RoundDeal,
  evaluateLevel2Hand,
  formatLevel2Card,
  getOpponentHand,
  getPlayerHand,
  isPenaltyFoldHand,
  isStraight,
} from './rules';
import type { Level2Card } from './types';

function card(rank: Level2Card['rank'], suit: Level2Card['suit']): Level2Card {
  return { rank, suit };
}

describe('level2 hand rules', () => {
  it('treats 9-10-A and 10-A-2 as straights', () => {
    expect(isStraight([9, 10, 1]).isStraight).toBe(true);
    expect(isStraight([10, 1, 2]).isStraight).toBe(true);
  });

  it('keeps three of a kind above straight flush', () => {
    const three = evaluateLevel2Hand([
      card(7, 'spade'),
      card(7, 'heart'),
      card(7, 'club'),
    ]);
    const straightFlush = evaluateLevel2Hand([
      card(8, 'diamond'),
      card(9, 'diamond'),
      card(10, 'diamond'),
    ]);

    expect(compareLevel2Hands(three, straightFlush)).toBeGreaterThan(0);
  });

  it('marks straight hands as penalty folds', () => {
    const straight = evaluateLevel2Hand([
      card(10, 'spade'),
      card(1, 'heart'),
      card(2, 'club'),
    ]);

    expect(isPenaltyFoldHand(straight)).toBe(true);
  });

  it('creates rigged rounds with deterministic player and opponent hands', () => {
    const playerRound = createLevel2RoundState(1, 0, 'player');
    const opponentRound = createLevel2RoundState(1, 0, 'opponent');

    expect(compareLevel2Hands(getPlayerHand(playerRound), getOpponentHand(playerRound))).toBeGreaterThan(0);
    expect(compareLevel2Hands(getPlayerHand(opponentRound), getOpponentHand(opponentRound))).toBeLessThan(0);
  });

  it('formats cards for UI text', () => {
    expect(formatLevel2Card(card(1, 'spade'))).toBe('♠A');
    expect(formatLevel2Card(card(10, 'club'))).toBe('♣10');
  });

  it('treats A as the lowest kicker in high-card comparisons', () => {
    const player = evaluateLevel2Hand([
      card(7, 'spade'),
      card(5, 'heart'),
      card(1, 'club'),
    ]);
    const opponent = evaluateLevel2Hand([
      card(7, 'club'),
      card(5, 'diamond'),
      card(2, 'spade'),
    ]);

    expect(player.type).toBe('high_card');
    expect(opponent.type).toBe('high_card');
    expect(compareLevel2Hands(player, opponent)).toBeLessThan(0);
  });

  it('keeps dealt cards out of the deck until reshuffle', () => {
    const deck = createLevel2Deck();
    const first = drawLevel2RoundDeal(deck, []);
    const second = drawLevel2RoundDeal(first.drawPile, first.discardPile);

    const firstRoundCards = [
      ...first.deal.sharedCards,
      first.deal.playerHole,
      first.deal.opponentHole,
    ].map(formatLevel2Card);
    const secondRoundCards = [
      ...second.deal.sharedCards,
      second.deal.playerHole,
      second.deal.opponentHole,
    ].map(formatLevel2Card);

    firstRoundCards.forEach((label) => {
      expect(secondRoundCards).not.toContain(label);
    });
  });

  it('reshuffles only after the deck can no longer deal a full round', () => {
    let drawPile = createLevel2Deck();
    let discardPile: Level2Card[] = [];
    let reshuffleCount = 0;

    for (let round = 0; round < 11; round++) {
      const result = drawLevel2RoundDeal(drawPile, discardPile, () => 0);
      drawPile = result.drawPile;
      discardPile = result.discardPile;
      if (result.reshuffled) {
        reshuffleCount++;
      }
    }

    expect(reshuffleCount).toBe(1);
  });
});
