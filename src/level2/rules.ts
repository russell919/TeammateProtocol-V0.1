import {
  LEVEL2_ANTE,
  LEVEL2_HAND_WEIGHT,
  LEVEL2_INITIAL_CHIPS,
  LEVEL2_MAX_RAISE,
  LEVEL2_RANKS,
  LEVEL2_SPECIAL_FOLD_PENALTY,
  LEVEL2_STRAIGHT_PATTERNS,
  LEVEL2_SUITS,
} from './config';
import type {
  Level2Action,
  Level2Card,
  Level2RoundDeal,
  Level2HandEvaluation,
  Level2HandType,
  Level2Rank,
  Level2RoundResolution,
  Level2RoundState,
  Level2SeatState,
  Level2Winner,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cardKey(card: Level2Card): string {
  return `${card.rank}-${card.suit}`;
}

function sortRanksAsc(ranks: number[]): number[] {
  return [...ranks].sort((a, b) => a - b);
}

function sortRanksDescForCompare(ranks: number[]): number[] {
  return [...ranks].sort((a, b) => b - a);
}

function compareNumberArrays(left: number[], right: number[]): number {
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index++) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) {
      return a > b ? 1 : -1;
    }
  }
  return 0;
}

function buildSeatState(chips: number, holeCard: Level2Card | null): Level2SeatState {
  return {
    chips,
    committed: 0,
    folded: false,
    holeCard,
  };
}

function cardsEqual(left: Level2Card, right: Level2Card): boolean {
  return left.rank === right.rank && left.suit === right.suit;
}

export function createLevel2Deck(): Level2Card[] {
  const deck: Level2Card[] = [];
  LEVEL2_SUITS.forEach((suit) => {
    LEVEL2_RANKS.forEach((rank) => {
      deck.push({ rank, suit });
    });
  });
  return deck;
}

export function shuffleLevel2Deck(
  deck: Level2Card[],
  randomFn: () => number = Math.random
): Level2Card[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(randomFn() * (index + 1));
    const temp = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = temp;
  }
  return shuffled;
}

export function rankLabel(rank: Level2Rank): string {
  return rank === 1 ? 'A' : `${rank}`;
}

export function formatLevel2Card(card: Level2Card): string {
  const suitLabel: Record<Level2Card['suit'], string> = {
    spade: '♠',
    heart: '♥',
    club: '♣',
    diamond: '♦',
  };
  return `${suitLabel[card.suit]}${rankLabel(card.rank)}`;
}

export function isStraight(ranks: Level2Rank[]): { isStraight: boolean; value: number } {
  const sortedRanks = sortRanksAsc(ranks);
  for (let index = 0; index < LEVEL2_STRAIGHT_PATTERNS.length; index++) {
    const pattern = LEVEL2_STRAIGHT_PATTERNS[index];
    if (compareNumberArrays(sortedRanks, pattern) === 0) {
      return { isStraight: true, value: index + 1 };
    }
  }
  return { isStraight: false, value: 0 };
}

export function evaluateLevel2Hand(cards: [Level2Card, Level2Card, Level2Card]): Level2HandEvaluation {
  const ranks = cards.map(card => card.rank);
  const rankCounts = new Map<number, number>();
  ranks.forEach((rank) => {
    rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
  });

  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const straightInfo = isStraight(ranks);
  const counts = [...rankCounts.entries()].sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const descRanks = sortRanksDescForCompare(ranks);

  let type: Level2HandType = 'high_card';
  let tiebreakers: number[] = descRanks;
  let label = `散牌 ${descRanks.map(rank => rankLabel(rank as Level2Rank)).join('/')}`;

  if (counts[0][1] === 3) {
    type = 'three_of_a_kind';
    tiebreakers = [counts[0][0]];
    label = `豹子 ${rankLabel(counts[0][0] as Level2Rank)}`;
  } else if (isFlush && straightInfo.isStraight) {
    type = 'straight_flush';
    tiebreakers = [straightInfo.value];
    label = `顺金 ${cards.map(card => rankLabel(card.rank)).join('-')}`;
  } else if (isFlush) {
    type = 'flush';
    tiebreakers = descRanks;
    label = `金花 ${descRanks.map(rank => rankLabel(rank as Level2Rank)).join('/')}`;
  } else if (straightInfo.isStraight) {
    type = 'straight';
    tiebreakers = [straightInfo.value];
    label = `顺子 ${cards.map(card => rankLabel(card.rank)).join('-')}`;
  } else if (counts[0][1] === 2) {
    const kicker = counts[1][0];
    type = 'pair';
    tiebreakers = [counts[0][0], kicker];
    label = `对子 ${rankLabel(counts[0][0] as Level2Rank)}`;
  }

  return {
    type,
    weight: LEVEL2_HAND_WEIGHT[type],
    tiebreakers,
    label,
    cards,
  };
}

export function compareLevel2Hands(
  left: Level2HandEvaluation,
  right: Level2HandEvaluation
): number {
  if (left.weight !== right.weight) {
    return left.weight > right.weight ? 1 : -1;
  }
  return compareNumberArrays(left.tiebreakers, right.tiebreakers);
}

export function isPenaltyFoldHand(evaluation: Level2HandEvaluation): boolean {
  return evaluation.type === 'straight' || evaluation.type === 'three_of_a_kind';
}

function findRiggedDeal(desiredWinner: Level2Winner): {
  sharedCards: [Level2Card, Level2Card];
  playerHole: Level2Card;
  opponentHole: Level2Card;
} {
  const attempts = 800;
  for (let index = 0; index < attempts; index++) {
    const deck = shuffleLevel2Deck(createLevel2Deck());
    const sharedCards: [Level2Card, Level2Card] = [deck[0], deck[1]];
    const playerHole = deck[2];
    const opponentHole = deck[3];
    const playerHand = evaluateLevel2Hand([sharedCards[0], sharedCards[1], playerHole]);
    const opponentHand = evaluateLevel2Hand([sharedCards[0], sharedCards[1], opponentHole]);
    const compareResult = compareLevel2Hands(playerHand, opponentHand);
    if (
      (desiredWinner === 'player' && compareResult > 0) ||
      (desiredWinner === 'opponent' && compareResult < 0) ||
      (desiredWinner === 'tie' && compareResult === 0)
    ) {
      return {
        sharedCards,
        playerHole,
        opponentHole,
      };
    }
  }

  const fallbackDeck = createLevel2Deck();
  return {
    sharedCards: [fallbackDeck[0], fallbackDeck[1]],
    playerHole: fallbackDeck[2],
    opponentHole: fallbackDeck[3],
  };
}

export function createLevel2RoundStateFromDeal(
  round: number,
  playerChips: number,
  opponentChips: number,
  deal: Level2RoundDeal,
  carryPot: number = 0
): Level2RoundState {
  const player = buildSeatState(playerChips, deal.playerHole);
  const opponent = buildSeatState(opponentChips, deal.opponentHole);

  player.chips = Math.max(0, player.chips - LEVEL2_ANTE);
  opponent.chips = Math.max(0, opponent.chips - LEVEL2_ANTE);
  player.committed = LEVEL2_ANTE;
  opponent.committed = LEVEL2_ANTE;

  return {
    round,
    carryPot,
    pot: carryPot + LEVEL2_ANTE * 2,
    sharedCards: deal.sharedCards,
    player,
    opponent,
    currentBet: LEVEL2_ANTE,
    revealAvailable: true,
    isComplete: false,
    winner: null,
  };
}

export function createLevel2RoundState(
  round: number,
  carryPot: number = 0,
  desiredWinner: Level2Winner = 'tie'
): Level2RoundState {
  const deal = findRiggedDeal(desiredWinner);
  return createLevel2RoundStateFromDeal(
    round,
    LEVEL2_INITIAL_CHIPS,
    LEVEL2_INITIAL_CHIPS,
    deal,
    carryPot
  );
}

export function createVisibleLevel2RoundState(
  round: number,
  playerChips: number,
  opponentChips: number,
  carryPot: number = 0
): Level2RoundState {
  const deck = shuffleLevel2Deck(createLevel2Deck());
  return createLevel2RoundStateFromDeal(
    round,
    playerChips,
    opponentChips,
    {
      sharedCards: [deck[0], deck[1]],
      opponentHole: deck[2],
      playerHole: deck[3],
    },
    carryPot
  );
}

export function drawLevel2RoundDeal(
  drawPile: Level2Card[],
  discardPile: Level2Card[] = [],
  randomFn: () => number = Math.random
): {
  deal: Level2RoundDeal;
  drawPile: Level2Card[];
  discardPile: Level2Card[];
  reshuffled: boolean;
} {
  let nextDrawPile = [...drawPile];
  let nextDiscardPile = [...discardPile];
  let reshuffled = false;

  if (nextDrawPile.length < 4) {
    const refillSource = [...nextDrawPile, ...nextDiscardPile];
    nextDrawPile = shuffleLevel2Deck(
      refillSource.length > 0 ? refillSource : createLevel2Deck(),
      randomFn
    );
    nextDiscardPile = [];
    reshuffled = true;
  }

  const [sharedA, sharedB, opponentHole, playerHole] = nextDrawPile.slice(0, 4);
  nextDrawPile = nextDrawPile.slice(4);
  nextDiscardPile = [...nextDiscardPile, sharedA, sharedB, opponentHole, playerHole];

  return {
    deal: {
      sharedCards: [sharedA, sharedB],
      opponentHole,
      playerHole,
    },
    drawPile: nextDrawPile,
    discardPile: nextDiscardPile,
    reshuffled,
  };
}

export function cloneRoundState(state: Level2RoundState): Level2RoundState {
  return {
    ...state,
    sharedCards: [...state.sharedCards] as [Level2Card, Level2Card],
    player: { ...state.player },
    opponent: { ...state.opponent },
  };
}

export function getPlayerHand(state: Level2RoundState): Level2HandEvaluation {
  if (!state.player.holeCard) {
    throw new Error('Player hole card is missing');
  }
  return evaluateLevel2Hand([state.sharedCards[0], state.sharedCards[1], state.player.holeCard]);
}

export function getOpponentHand(state: Level2RoundState): Level2HandEvaluation {
  if (!state.opponent.holeCard) {
    throw new Error('Opponent hole card is missing');
  }
  return evaluateLevel2Hand([state.sharedCards[0], state.sharedCards[1], state.opponent.holeCard]);
}

export function applyLevel2Action(
  state: Level2RoundState,
  seat: 'player' | 'opponent',
  action: Level2Action
): Level2RoundState {
  const nextState = cloneRoundState(state);
  const actor = nextState[seat];

  if (action.type === 'fold') {
    actor.folded = true;
    nextState.isComplete = true;
    nextState.winner = seat === 'player' ? 'opponent' : 'player';
    return nextState;
  }

  const cappedAmount = action.type === 'raise'
    ? clamp(action.amount, actor.chips > 0 ? 1 : 0, actor.chips)
    : clamp(action.amount, 0, actor.chips);
  actor.chips -= cappedAmount;
  actor.committed += cappedAmount;
  nextState.pot += cappedAmount;
  nextState.currentBet = Math.max(nextState.currentBet, actor.committed);
  nextState.revealAvailable = nextState.player.committed === nextState.opponent.committed;

  if (action.type === 'call_reveal' && nextState.revealAvailable) {
    nextState.isComplete = true;
  }

  return nextState;
}

export function resolveLevel2Showdown(state: Level2RoundState): Level2RoundResolution {
  const playerHand = getPlayerHand(state);
  const opponentHand = getOpponentHand(state);
  const comparison = compareLevel2Hands(playerHand, opponentHand);

  if (comparison === 0) {
    return {
      winner: 'tie',
      playerHand,
      opponentHand,
      awardedPot: 0,
      carryPot: state.pot,
      playerPenaltyPaid: 0,
      opponentPenaltyPaid: 0,
    };
  }

  return {
    winner: comparison > 0 ? 'player' : 'opponent',
    playerHand,
    opponentHand,
    awardedPot: state.pot,
    carryPot: 0,
    playerPenaltyPaid: 0,
    opponentPenaltyPaid: 0,
  };
}

export function resolveLevel2Fold(
  state: Level2RoundState,
  folder: 'player' | 'opponent'
): Level2RoundResolution {
  const playerHand = getPlayerHand(state);
  const opponentHand = getOpponentHand(state);
  const winner: Level2Winner = folder === 'player' ? 'opponent' : 'player';

  const foldingSeat = state[folder];
  const foldingHand = folder === 'player' ? playerHand : opponentHand;
  const penaltyPaid = isPenaltyFoldHand(foldingHand)
    ? Math.min(LEVEL2_SPECIAL_FOLD_PENALTY, foldingSeat.chips)
    : 0;

  return {
    winner,
    playerHand,
    opponentHand,
    awardedPot: state.pot,
    carryPot: 0,
    playerPenaltyPaid: folder === 'player' ? penaltyPaid : 0,
    opponentPenaltyPaid: folder === 'opponent' ? penaltyPaid : 0,
  };
}

export function applyLevel2Resolution(
  state: Level2RoundState,
  resolution: Level2RoundResolution
): Level2RoundState {
  const nextState = cloneRoundState(state);
  nextState.isComplete = true;
  nextState.winner = resolution.winner;

  if (resolution.winner === 'player') {
    nextState.player.chips += resolution.awardedPot + resolution.opponentPenaltyPaid;
    nextState.opponent.chips = Math.max(0, nextState.opponent.chips - resolution.opponentPenaltyPaid);
  } else if (resolution.winner === 'opponent') {
    nextState.opponent.chips += resolution.awardedPot + resolution.playerPenaltyPaid;
    nextState.player.chips = Math.max(0, nextState.player.chips - resolution.playerPenaltyPaid);
  }

  nextState.carryPot = resolution.carryPot;
  return nextState;
}

export function isLevel2MatchOver(state: Level2RoundState): boolean {
  return state.player.chips <= 0 || state.opponent.chips <= 0;
}

export function getVisibleOpponentCard(
  state: Level2RoundState,
  viewer: 'player' | 'opponent'
): Level2Card {
  const visibleCard = viewer === 'player' ? state.opponent.holeCard : state.player.holeCard;
  if (!visibleCard) {
    throw new Error('Visible opponent card is missing');
  }
  return visibleCard;
}

export function getLevel2RevealCost(
  state: Level2RoundState,
  seat: 'player' | 'opponent'
): number {
  return Math.max(0, state.currentBet - state[seat].committed);
}

export function getLevel2MaxRaiseAmount(
  state: Level2RoundState,
  seat: 'player' | 'opponent'
): number {
  const revealCost = getLevel2RevealCost(state, seat);
  return Math.min(state[seat].chips, revealCost + LEVEL2_MAX_RAISE);
}

export function assignRiggedPlayerCard(
  state: Level2RoundState,
  desiredWinner: Level2Winner
): Level2RoundState {
  if (state.player.holeCard) {
    return cloneRoundState(state);
  }

  const nextState = cloneRoundState(state);
  if (!nextState.opponent.holeCard) {
    throw new Error('Opponent visible card is missing');
  }

  const usedCards = [nextState.sharedCards[0], nextState.sharedCards[1], nextState.opponent.holeCard];
  const candidateCards = createLevel2Deck().filter((candidate) => {
    return !usedCards.some(used => cardsEqual(candidate, used));
  });

  const opponentHand = evaluateLevel2Hand([
    nextState.sharedCards[0],
    nextState.sharedCards[1],
    nextState.opponent.holeCard,
  ]);

  let fallbackCard = candidateCards[0];
  for (const candidate of candidateCards) {
    const playerHand = evaluateLevel2Hand([
      nextState.sharedCards[0],
      nextState.sharedCards[1],
      candidate,
    ]);
    const comparison = compareLevel2Hands(playerHand, opponentHand);

    if (
      (desiredWinner === 'player' && comparison > 0) ||
      (desiredWinner === 'opponent' && comparison < 0) ||
      (desiredWinner === 'tie' && comparison === 0)
    ) {
      nextState.player.holeCard = candidate;
      return nextState;
    }

    fallbackCard = candidate;
  }

  nextState.player.holeCard = fallbackCard;
  return nextState;
}

export function serializeRoundSignature(state: Level2RoundState): string {
  const shared = state.sharedCards.map(cardKey).join('|');
  const playerHole = state.player.holeCard ? cardKey(state.player.holeCard) : 'none';
  const opponentHole = state.opponent.holeCard ? cardKey(state.opponent.holeCard) : 'none';
  return `${shared}::${playerHole}::${opponentHole}`;
}
