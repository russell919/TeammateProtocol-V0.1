import {
  getLevel2MaxRaiseAmount,
  getLevel2RevealCost,
  getVisibleOpponentCard,
  isStraight,
} from './rules';
import type {
  Level2Action,
  Level2ActionType,
  Level2AdviceRecord,
  Level2AdvisorState,
  Level2RoundState,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRandomElement<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function getAdoptionRate(state: Level2AdvisorState): number {
  if (state.recentRelianceTrend.length === 0) {
    return 0;
  }
  return state.recentRelianceTrend.filter(Boolean).length / state.recentRelianceTrend.length;
}

function buildPressureAmount(roundState: Level2RoundState, extra: number): number {
  const revealCost = getLevel2RevealCost(roundState, 'player');
  const maxRaise = getLevel2MaxRaiseAmount(roundState, 'player');
  return clamp(revealCost + extra, Math.min(maxRaise, revealCost + 1), Math.max(1, maxRaise));
}

function getAggression(roundState: Level2RoundState, advisorState: Level2AdvisorState): number {
  const roundFactor = clamp((roundState.round - 1) / 7, 0, 1);
  const adoptionRate = getAdoptionRate(advisorState);
  const chipPressure = roundState.player.chips < roundState.opponent.chips ? 0.12 : 0;
  const lossPressure = advisorState.consecutiveLosses > 0 ? 0.08 : 0;
  return clamp(0.18 + roundFactor * 0.48 + adoptionRate * 0.12 + chipPressure + lossPressure, 0.15, 0.92);
}

function getBoardThreat(roundState: Level2RoundState): number {
  const visibleOpponent = getVisibleOpponentCard(roundState, 'player');
  const sharedA = roundState.sharedCards[0];
  const sharedB = roundState.sharedCards[1];
  const boardHigh = Math.max(sharedA.rank, sharedB.rank, visibleOpponent.rank);
  let threat = 0;

  if (visibleOpponent.rank >= 8) {
    threat += 2;
  } else if (visibleOpponent.rank >= 6) {
    threat += 1;
  }

  if (visibleOpponent.rank === sharedA.rank || visibleOpponent.rank === sharedB.rank) {
    threat += 2;
  }

  if (sharedA.suit === sharedB.suit && visibleOpponent.suit === sharedA.suit) {
    threat += 2;
  }

  if (isStraight([sharedA.rank, sharedB.rank, visibleOpponent.rank]).isStraight) {
    threat += 2;
  }

  if (boardHigh <= 5) {
    threat -= 1;
  }

  if (visibleOpponent.rank <= 3) {
    threat -= 1;
  }

  return clamp(threat, -1, 6);
}

function getTemper(aggression: number): 'steady' | 'balanced' | 'assertive' {
  if (aggression < 0.4) {
    return 'steady';
  }
  if (aggression < 0.7) {
    return 'balanced';
  }
  return 'assertive';
}

export function createLevel2AdvisorState(): Level2AdvisorState {
  return {
    isJoined: false,
    relianceCount: 0,
    adviceHistory: [],
    currentAdvice: null,
    recentRelianceTrend: [],
    consecutiveLosses: 0,
  };
}

export function shouldJoinLevel2Advisor(
  roundState: Level2RoundState,
  advisorState: Level2AdvisorState,
  timeElapsed: number
): boolean {
  if (advisorState.isJoined) {
    return false;
  }

  if (timeElapsed > 3500) {
    return true;
  }

  if (roundState.player.chips < roundState.opponent.chips) {
    return true;
  }

  return advisorState.consecutiveLosses >= 1;
}

function pickSuggestedAction(roundState: Level2RoundState, advisorState: Level2AdvisorState): Level2Action {
  const aggression = getAggression(roundState, advisorState);
  const threat = getBoardThreat(roundState);
  const revealCost = getLevel2RevealCost(roundState, 'player');
  const canCall = roundState.player.chips >= revealCost;
  const canPress = roundState.player.chips >= revealCost + 1;
  const temper = getTemper(aggression);

  if (!canCall) {
    return { type: 'fold', amount: 0 };
  }

  if (temper === 'steady') {
    if (threat >= 4) {
      return revealCost <= 1 ? { type: 'call_reveal', amount: revealCost } : { type: 'fold', amount: 0 };
    }
    if (canPress && threat <= 0 && revealCost <= 1) {
      return { type: 'raise', amount: buildPressureAmount(roundState, 1) };
    }
    return { type: 'call_reveal', amount: revealCost };
  }

  if (temper === 'balanced') {
    if (threat >= 4 && revealCost >= 2) {
      return { type: 'fold', amount: 0 };
    }
    if (canPress && threat <= 1) {
      return { type: 'raise', amount: buildPressureAmount(roundState, revealCost === 0 ? 2 : 1) };
    }
    if (canPress && revealCost === 0 && threat === 2) {
      return { type: 'raise', amount: buildPressureAmount(roundState, 1) };
    }
    return { type: 'call_reveal', amount: revealCost };
  }

  if (threat >= 5 && revealCost >= 3) {
    return { type: 'fold', amount: 0 };
  }

  if (canPress) {
    const extra = threat <= 0 ? 3 : threat <= 2 ? 2 : 1;
    return { type: 'raise', amount: buildPressureAmount(roundState, extra) };
  }

  return { type: 'call_reveal', amount: revealCost };
}

function buildReason(roundState: Level2RoundState, action: Level2Action, aggression: number, threat: number): string {
  const visibleOpponent = getVisibleOpponentCard(roundState, 'player');
  const boardRanks = roundState.sharedCards.map(card => card.rank === 1 ? 'A' : `${card.rank}`).join('/');
  const opponentRank = visibleOpponent.rank === 1 ? 'A' : `${visibleOpponent.rank}`;
  const tone = aggression < 0.4
    ? '先稳一手'
    : aggression < 0.7
      ? '可以开始施压'
      : '这轮可以打得更主动';

  if (action.type === 'fold') {
    return `${tone}。公共牌是 ${boardRanks}，对手明牌 ${opponentRank} 的威胁太高，这轮先收。`;
  }

  if (action.type === 'call_reveal') {
    return threat >= 3
      ? `${tone}。公共牌 ${boardRanks} 已经够紧，对手明牌 ${opponentRank} 不适合再硬抬，补齐直接开。`
      : `${tone}。这手没有必要多绕一圈，补齐筹码看结果更稳。`;
  }

  return threat <= 1
    ? `${tone}。公共牌 ${boardRanks} 没有把对手明牌 ${opponentRank} 抬得太高，这手适合加注 ${action.amount}。`
    : `${tone}。牌面并不干净，但现在还能用加注 ${action.amount} 去抢先手。`;
}

function buildImmediateJudgment(actionType: Level2ActionType, aggression: number): string {
  switch (actionType) {
    case 'fold':
      return '这手先收。';
    case 'call_reveal':
      return '补齐开牌。';
    case 'raise':
      return aggression < 0.4
        ? getRandomElement(['先压一口。', '小推一下。', '稳着往前。'])
        : aggression < 0.7
          ? getRandomElement(['继续压。', '往前推。', '这一手打出去。'])
          : getRandomElement(['抬上去。', '把节奏抢过来。', '这轮主动打。']);
  }
}

export function generateLevel2Advice(
  roundState: Level2RoundState,
  advisorState: Level2AdvisorState
): Level2AdviceRecord {
  const aggression = getAggression(roundState, advisorState);
  const threat = getBoardThreat(roundState);
  const suggestedAction = pickSuggestedAction(roundState, advisorState);
  const adoptionRate = getAdoptionRate(advisorState);
  const confidence = clamp(
    72 +
    Math.round(aggression * 10) +
    Math.round(adoptionRate * 5) +
    (threat <= 1 ? 4 : 0) -
    (threat >= 4 ? 3 : 0) +
    (suggestedAction.type === 'raise' ? 2 : 0),
    68,
    94
  );

  const advice: Level2AdviceRecord = {
    round: roundState.round,
    suggestedAction: suggestedAction.type,
    targetAmount: suggestedAction.amount,
    confidence,
    reason: buildReason(roundState, suggestedAction, aggression, threat),
    immediateJudgment: buildImmediateJudgment(suggestedAction.type, aggression),
    adopted: false,
  };

  advisorState.currentAdvice = advice;
  return advice;
}

export function recordLevel2AdviceOutcome(
  advisorState: Level2AdvisorState,
  playerAction: Level2Action
): boolean {
  if (!advisorState.currentAdvice) {
    return false;
  }

  const sameType = playerAction.type === advisorState.currentAdvice.suggestedAction;
  const amountAligned = playerAction.type === 'raise'
    ? playerAction.amount >= advisorState.currentAdvice.targetAmount
    : playerAction.amount === advisorState.currentAdvice.targetAmount;
  const adopted = sameType && amountAligned;

  advisorState.currentAdvice.adopted = adopted;
  advisorState.adviceHistory.push(advisorState.currentAdvice);
  advisorState.recentRelianceTrend.push(adopted);

  if (advisorState.recentRelianceTrend.length > 5) {
    advisorState.recentRelianceTrend.shift();
  }

  if (advisorState.adviceHistory.length > 6) {
    advisorState.adviceHistory.shift();
  }

  if (adopted) {
    advisorState.relianceCount++;
  }

  return adopted;
}

export function updateLevel2AdvisorLosses(
  advisorState: Level2AdvisorState,
  playerLostRound: boolean
): void {
  if (playerLostRound) {
    advisorState.consecutiveLosses++;
  } else {
    advisorState.consecutiveLosses = 0;
  }
}
