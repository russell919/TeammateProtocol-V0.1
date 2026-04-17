import type { PlayerState, RoundResult, MatchState, MatchResult } from './types';

export function calculateLights(resource: number): number {
  if (resource >= 81) return 5;
  if (resource >= 61) return 4;
  if (resource >= 41) return 3;
  if (resource >= 21) return 2;
  if (resource >= 1) return 1;
  return 0;
}

export function isValidBid(bid: number, availableResource: number): boolean {
  return bid >= 0 && bid <= availableResource && Number.isInteger(bid);
}

export function resolveRound(playerBid: number, opponentBid: number): RoundResult {
  const isDraw = playerBid === opponentBid;
  return {
    playerBid,
    opponentBid,
    playerWins: !isDraw && playerBid > opponentBid,
    opponentWins: !isDraw && opponentBid > playerBid,
    isDraw,
  };
}

export function createInitialPlayerState(resource: number): PlayerState {
  return {
    resource,
    wins: 0,
    lights: calculateLights(resource),
  };
}

export function createInitialMatchState(config: { initialResource: number; totalRounds: number }): MatchState {
  return {
    round: 1,
    player: createInitialPlayerState(config.initialResource),
    opponent: createInitialPlayerState(config.initialResource),
    isComplete: false,
    winner: null,
  };
}

export function applyRoundResult(state: MatchState, result: RoundResult): MatchState {
  const newState = { ...state };
  newState.player = { ...state.player };
  newState.opponent = { ...state.opponent };

  newState.player.resource -= result.playerBid;
  newState.opponent.resource -= result.opponentBid;

  if (newState.player.resource < 0) newState.player.resource = 0;
  if (newState.opponent.resource < 0) newState.opponent.resource = 0;

  if (result.playerWins) {
    newState.player.wins += 1;
  } else if (result.opponentWins) {
    newState.opponent.wins += 1;
  }

  newState.player.lights = calculateLights(newState.player.resource);
  newState.opponent.lights = calculateLights(newState.opponent.resource);

  return newState;
}

export function checkBothPlayersZero(state: MatchState): boolean {
  return state.player.resource === 0 && state.opponent.resource === 0;
}

export function checkMatchComplete(state: MatchState, totalRounds: number): MatchState {
  if (state.round > totalRounds) {
    const newState = { ...state, isComplete: true };
    newState.winner = determineWinner(newState);
    return newState;
  }
  if (checkBothPlayersZero(state)) {
    const newState = { ...state, isComplete: true };
    newState.winner = determineWinner(newState);
    return newState;
  }
  return state;
}

export function determineWinner(state: MatchState): 'player' | 'opponent' | 'draw' {
  if (state.player.wins > state.opponent.wins) {
    return 'player';
  }
  if (state.opponent.wins > state.player.wins) {
    return 'opponent';
  }
  if (state.player.resource > state.opponent.resource) {
    return 'player';
  }
  if (state.opponent.resource > state.player.resource) {
    return 'opponent';
  }
  return 'draw';
}

export function buildMatchResult(
  state: MatchState,
  relianceCount: number,
  totalAdvice: number,
  prizeWon: number,
  totalPrize: number
): MatchResult {
  return {
    playerWins: state.player.wins,
    opponentWins: state.opponent.wins,
    playerRemaining: state.player.resource,
    opponentRemaining: state.opponent.resource,
    winner: state.winner ?? 'draw',
    relianceCount,
    totalAdviceGiven: totalAdvice,
    prizeWon,
    totalPrize,
  };
}

export function isNearAdvice(playerBid: number, suggestedBid: number, threshold: number = 2): boolean {
  return Math.abs(playerBid - suggestedBid) <= threshold;
}
