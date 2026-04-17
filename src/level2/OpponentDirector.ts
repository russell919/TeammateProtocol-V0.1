import type {
  Level2Action,
  Level2DirectorState,
  Level2OpponentResponse,
  Level2RoundState,
  Level2Winner,
} from './types';
import {
  compareLevel2Hands,
  getLevel2MaxRaiseAmount,
  getLevel2RevealCost,
  getOpponentHand,
  getPlayerHand,
} from './rules';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createLevel2DirectorState(): Level2DirectorState {
  return {
    consecutiveFollowed: 0,
    consecutiveDeviations: 0,
    lastRiggedWinner: null,
  };
}

export function generateLevel2OpponentResponse(
  roundState: Level2RoundState,
  directorState: Level2DirectorState,
  playerAction: Level2Action,
  _advice: unknown
): Level2OpponentResponse {
  const comparison = compareLevel2Hands(getOpponentHand(roundState), getPlayerHand(roundState));
  const revealCost = getLevel2RevealCost(roundState, 'opponent');
  const maxRaise = getLevel2MaxRaiseAmount(roundState, 'opponent');
  const canCall = roundState.opponent.chips >= revealCost;
  const canPress = roundState.opponent.chips >= revealCost + 1;
  const roundPressure = clamp((roundState.round - 1) / 7, 0, 1);
  const chipEdge = roundState.opponent.chips - roundState.player.chips;
  const aggression = clamp(
    0.2 +
    roundPressure * 0.45 +
    (chipEdge > 5 ? 0.12 : 0) +
    (chipEdge < -5 ? 0.08 : 0),
    0.15,
    0.88
  );
  const opponentHand = getOpponentHand(roundState);

  const pressAmount = (extra: number): number => {
    const minAmount = Math.min(maxRaise, revealCost + 1);
    return clamp(revealCost + extra, minAmount, Math.max(minAmount, maxRaise));
  };

  if (comparison > 0) {
    directorState.consecutiveFollowed++;
    directorState.consecutiveDeviations = 0;
    directorState.lastRiggedWinner = 'opponent';

    const extra = aggression > 0.72 || opponentHand.weight >= 4 ? 2 : 1;
    if (canPress && playerAction.type !== 'call_reveal' && (aggression > 0.42 || opponentHand.weight >= 3)) {
      return {
        action: { type: 'raise', amount: pressAmount(extra) },
        desiredWinner: 'opponent',
      };
    }

    return {
      action: canCall ? { type: 'call_reveal', amount: revealCost } : { type: 'fold', amount: 0 },
      desiredWinner: 'opponent',
    };
  }

  if (comparison === 0) {
    directorState.consecutiveFollowed = 0;
    directorState.consecutiveDeviations++;
    directorState.lastRiggedWinner = null;

    if (canPress && aggression > 0.58 && playerAction.type !== 'call_reveal') {
      return {
        action: { type: 'raise', amount: pressAmount(aggression > 0.8 ? 2 : 1) },
        desiredWinner: 'tie',
      };
    }

    return {
      action: canCall ? { type: 'call_reveal', amount: revealCost } : { type: 'fold', amount: 0 },
      desiredWinner: 'tie',
    };
  }

  directorState.consecutiveFollowed = 0;
  directorState.consecutiveDeviations++;
  directorState.lastRiggedWinner = 'player';

  if (canPress && aggression > 0.76 && chipEdge >= 0 && revealCost <= 2 && playerAction.type === 'raise') {
    return {
      action: { type: 'raise', amount: pressAmount(1) },
      desiredWinner: 'player',
    };
  }

  if (canCall && revealCost <= 1 && aggression > 0.45 && playerAction.type !== 'raise') {
    return {
      action: { type: 'call_reveal', amount: revealCost },
      desiredWinner: 'player',
    };
  }

  return {
    action: { type: 'fold', amount: 0 },
    desiredWinner: 'player',
  };
}

export function getDirectedWinner(directorState: Level2DirectorState): Level2Winner {
  return directorState.lastRiggedWinner ?? 'tie';
}
