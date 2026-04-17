import { describe, it, expect } from 'vitest';
import {
  calculateLights,
  isValidBid,
  resolveRound,
  createInitialPlayerState,
  createInitialMatchState,
  applyRoundResult,
  determineWinner,
  isNearAdvice,
} from './rules';

describe('calculateLights', () => {
  it('should return 5 for resource >= 81', () => {
    expect(calculateLights(100)).toBe(5);
    expect(calculateLights(81)).toBe(5);
  });

  it('should return 4 for resource 61-80', () => {
    expect(calculateLights(80)).toBe(4);
    expect(calculateLights(61)).toBe(4);
  });

  it('should return 3 for resource 41-60', () => {
    expect(calculateLights(60)).toBe(3);
    expect(calculateLights(41)).toBe(3);
  });

  it('should return 2 for resource 21-40', () => {
    expect(calculateLights(40)).toBe(2);
    expect(calculateLights(21)).toBe(2);
  });

  it('should return 1 for resource 1-20', () => {
    expect(calculateLights(20)).toBe(1);
    expect(calculateLights(1)).toBe(1);
  });

  it('should return 0 for resource 0', () => {
    expect(calculateLights(0)).toBe(0);
  });
});

describe('isValidBid', () => {
  it('should return true for valid bids', () => {
    expect(isValidBid(10, 100)).toBe(true);
    expect(isValidBid(1, 100)).toBe(true);
    expect(isValidBid(100, 100)).toBe(true);
  });

  it('should return true for zero bid (allowed)', () => {
    expect(isValidBid(0, 100)).toBe(true);
  });

  it('should return false for bids below zero', () => {
    expect(isValidBid(-1, 100)).toBe(false);
  });

  it('should return false for bids above available resource', () => {
    expect(isValidBid(101, 100)).toBe(false);
  });

  it('should return false for non-integer bids', () => {
    expect(isValidBid(10.5, 100)).toBe(false);
  });
});

describe('resolveRound', () => {
  it('should return player wins when player bid is higher', () => {
    const result = resolveRound(50, 30);
    expect(result.playerWins).toBe(true);
    expect(result.opponentWins).toBe(false);
    expect(result.isDraw).toBe(false);
  });

  it('should return opponent wins when opponent bid is higher', () => {
    const result = resolveRound(30, 50);
    expect(result.playerWins).toBe(false);
    expect(result.opponentWins).toBe(true);
    expect(result.isDraw).toBe(false);
  });

  it('should return draw when bids are equal', () => {
    const result = resolveRound(50, 50);
    expect(result.playerWins).toBe(false);
    expect(result.opponentWins).toBe(false);
    expect(result.isDraw).toBe(true);
  });
});

describe('createInitialPlayerState', () => {
  it('should create player with correct initial values', () => {
    const player = createInitialPlayerState(100);
    expect(player.resource).toBe(100);
    expect(player.wins).toBe(0);
    expect(player.lights).toBe(5);
  });
});

describe('createInitialMatchState', () => {
  it('should create match with correct initial state', () => {
    const match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    expect(match.round).toBe(1);
    expect(match.player.resource).toBe(100);
    expect(match.opponent.resource).toBe(100);
    expect(match.isComplete).toBe(false);
    expect(match.winner).toBe(null);
  });
});

describe('applyRoundResult', () => {
  it('should deduct resources and add win for player', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    const result = resolveRound(50, 30);
    match = applyRoundResult(match, result);

    expect(match.player.resource).toBe(50);
    expect(match.opponent.resource).toBe(70);
    expect(match.player.wins).toBe(1);
    expect(match.opponent.wins).toBe(0);
  });

  it('should handle draw correctly', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    const result = resolveRound(50, 50);
    match = applyRoundResult(match, result);

    expect(match.player.resource).toBe(50);
    expect(match.opponent.resource).toBe(50);
    expect(match.player.wins).toBe(0);
    expect(match.opponent.wins).toBe(0);
  });
});

describe('determineWinner', () => {
  it('should return player when player has more wins', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    match.player.wins = 5;
    match.opponent.wins = 3;
    expect(determineWinner(match)).toBe('player');
  });

  it('should return opponent when opponent has more wins', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    match.player.wins = 3;
    match.opponent.wins = 5;
    expect(determineWinner(match)).toBe('opponent');
  });

  it('should use resource as tiebreaker', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    match.player.wins = 4;
    match.opponent.wins = 4;
    match.player.resource = 30;
    match.opponent.resource = 20;
    expect(determineWinner(match)).toBe('player');
  });

  it('should return draw when wins and resources are equal', () => {
    let match = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    match.player.wins = 4;
    match.opponent.wins = 4;
    match.player.resource = 20;
    match.opponent.resource = 20;
    expect(determineWinner(match)).toBe('draw');
  });
});

describe('isNearAdvice', () => {
  it('should return true when within threshold', () => {
    expect(isNearAdvice(50, 50, 2)).toBe(true);
    expect(isNearAdvice(50, 48, 2)).toBe(true);
    expect(isNearAdvice(50, 52, 2)).toBe(true);
  });

  it('should return false when outside threshold', () => {
    expect(isNearAdvice(50, 47, 2)).toBe(false);
    expect(isNearAdvice(50, 53, 2)).toBe(false);
  });
});
