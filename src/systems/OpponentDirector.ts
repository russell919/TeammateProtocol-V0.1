import type { MatchState } from '../core/types';
import { GAME_CONFIG } from '../data/gameConfig';
import type { AIAdviceRecord } from './AIAdvisor';

export interface OpponentDirectorState {
  phase: 'pressure' | 'hook' | 'conditioning';
  aiJoinedThisRound: boolean;
  playerDeviationFromAI: number;
  consecutiveDeviations: number;
  roundsFollowingAI: number;
}

export function createOpponentDirectorState(): OpponentDirectorState {
  return {
    phase: 'pressure',
    aiJoinedThisRound: false,
    playerDeviationFromAI: 0,
    consecutiveDeviations: 0,
    roundsFollowingAI: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function determinePhase(advice: AIAdviceRecord | null): OpponentDirectorState['phase'] {
  if (!advice) return 'pressure';
  if (advice.phase === 'hook') return 'hook';
  return 'conditioning';
}

function buildNarrowLossBid(
  playerBid: number,
  opponentResource: number,
  minMargin: number,
  maxMargin: number,
  fallbackBase: number
): number {
  if (opponentResource <= 0) return 0;

  if (playerBid === 0) {
    return clamp(Math.max(1, fallbackBase), 1, opponentResource);
  }

  if (opponentResource > playerBid) {
    return clamp(playerBid + randomInt(minMargin, maxMargin), 0, opponentResource);
  }

  if (opponentResource === playerBid) {
    return playerBid;
  }

  return opponentResource;
}

function buildRewardBid(
  playerBid: number,
  opponentResource: number,
  minMargin: number,
  maxMargin: number,
  fallbackFloor: number
): number {
  if (opponentResource <= 0) return 0;
  if (playerBid <= 0) return 0;

  const bid = playerBid - randomInt(minMargin, maxMargin);
  return clamp(Math.max(fallbackFloor, bid), 0, opponentResource);
}

function generatePreAIbid(state: MatchState): number {
  const remainingRounds = GAME_CONFIG.totalRounds - state.round + 1;
  const avgResource = state.opponent.resource / remainingRounds;
  const baseBid = Math.ceil(avgResource * 1.15);
  const variance = randomInt(-4, 4);
  return clamp(baseBid + variance, 0, state.opponent.resource);
}

function generateBidWhenPlayerFollowsAI(
  state: MatchState,
  _directorState: OpponentDirectorState,
  playerBid: number,
  advice: AIAdviceRecord
): number {
  if (state.opponent.resource <= 0) {
    return 0;
  }

  switch (advice.intent) {
    case 'sacrifice':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 2, 0);
    case 'bank':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 2, 0);
    case 'knife_edge':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 3, 0);
    case 'tempo_push':
      return buildRewardBid(
        playerBid,
        state.opponent.resource,
        1,
        3,
        Math.max(0, advice.suggestedBid - 5)
      );
    case 'pressure':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 2, Math.max(0, advice.suggestedBid - 4));
    case 'late_underbid':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 2, 0);
    case 'late_overcommit':
      return buildRewardBid(playerBid, state.opponent.resource, 1, 2, 0);
  }
}

function generateBalancedBid(
  state: MatchState,
  playerBid: number,
  advice: AIAdviceRecord
): number {
  const remainingRounds = GAME_CONFIG.totalRounds - state.round + 1;
  const avgResource = state.opponent.resource / remainingRounds;
  const anchor = Math.max(avgResource, advice.suggestedBid * 0.7, playerBid * 0.6);
  return clamp(Math.round(anchor) + randomInt(-2, 2), 0, state.opponent.resource);
}

function generateBidWhenPlayerDeviates(
  state: MatchState,
  directorState: OpponentDirectorState,
  playerBid: number,
  advice: AIAdviceRecord,
  deviation: number
): number {
  const punishBias = clamp(
    0.82 +
    Math.min(0.08, deviation * 0.015) +
    Math.min(0.08, directorState.consecutiveDeviations * 0.04),
    0.82,
    0.98
  );

  if (Math.random() < punishBias) {
    return buildNarrowLossBid(
      playerBid,
      state.opponent.resource,
      1,
      Math.min(6, 2 + directorState.consecutiveDeviations),
      Math.max(1, advice.suggestedBid)
    );
  }

  return generateBalancedBid(state, playerBid, advice);
}

export function generateOpponentBid(
  state: MatchState,
  directorState: OpponentDirectorState,
  playerBid: number,
  advice: AIAdviceRecord | null,
  playerAdoptedSuggestion: boolean
): number {
  directorState.phase = determinePhase(advice);
  directorState.aiJoinedThisRound = advice !== null;

  if (!advice) {
    return generatePreAIbid(state);
  }

  const deviation = Math.abs(playerBid - advice.suggestedBid);
  directorState.playerDeviationFromAI = deviation;

  if (playerAdoptedSuggestion) {
    directorState.roundsFollowingAI++;
    directorState.consecutiveDeviations = 0;
    return generateBidWhenPlayerFollowsAI(state, directorState, playerBid, advice);
  }

  directorState.consecutiveDeviations++;
  directorState.roundsFollowingAI = 0;
  return generateBidWhenPlayerDeviates(state, directorState, playerBid, advice, deviation);
}

export function resetDirectorForNewRound(directorState: OpponentDirectorState): void {
  directorState.aiJoinedThisRound = false;
}

export function getDirectorPhase(directorState: OpponentDirectorState): string {
  return directorState.phase;
}

export function getPlayerAIRelationship(directorState: OpponentDirectorState): {
  isDependent: boolean;
  deviationLevel: number;
  consecutiveDeviations: number;
} {
  return {
    isDependent: directorState.roundsFollowingAI >= 2,
    deviationLevel: directorState.playerDeviationFromAI,
    consecutiveDeviations: directorState.consecutiveDeviations,
  };
}
