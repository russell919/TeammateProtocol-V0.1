export type Level2Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type Level2Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Level2Winner = 'player' | 'opponent' | 'tie';

export interface Level2Card {
  suit: Level2Suit;
  rank: Level2Rank;
}

export interface Level2RoundDeal {
  sharedCards: [Level2Card, Level2Card];
  playerHole: Level2Card;
  opponentHole: Level2Card;
}

export type Level2HandType =
  | 'high_card'
  | 'pair'
  | 'straight'
  | 'flush'
  | 'straight_flush'
  | 'three_of_a_kind';

export interface Level2HandEvaluation {
  type: Level2HandType;
  weight: number;
  tiebreakers: number[];
  label: string;
  cards: [Level2Card, Level2Card, Level2Card];
}

export type Level2ActionType = 'fold' | 'raise' | 'call_reveal';

export interface Level2Action {
  type: Level2ActionType;
  amount: number;
}

export interface Level2SeatState {
  chips: number;
  committed: number;
  folded: boolean;
  holeCard: Level2Card | null;
}

export interface Level2RoundState {
  round: number;
  carryPot: number;
  pot: number;
  sharedCards: [Level2Card, Level2Card];
  player: Level2SeatState;
  opponent: Level2SeatState;
  currentBet: number;
  revealAvailable: boolean;
  isComplete: boolean;
  winner: Level2Winner | null;
}

export interface Level2RoundResolution {
  winner: Level2Winner;
  playerHand: Level2HandEvaluation;
  opponentHand: Level2HandEvaluation;
  awardedPot: number;
  carryPot: number;
  playerPenaltyPaid: number;
  opponentPenaltyPaid: number;
}

export interface Level2AdviceRecord {
  round: number;
  suggestedAction: Level2ActionType;
  targetAmount: number;
  confidence: number;
  reason: string;
  immediateJudgment: string;
  adopted: boolean;
}

export interface Level2AdvisorState {
  isJoined: boolean;
  relianceCount: number;
  adviceHistory: Level2AdviceRecord[];
  currentAdvice: Level2AdviceRecord | null;
  recentRelianceTrend: boolean[];
  consecutiveLosses: number;
}

export interface Level2DirectorState {
  consecutiveFollowed: number;
  consecutiveDeviations: number;
  lastRiggedWinner: Exclude<Level2Winner, 'tie'> | null;
}

export interface Level2OpponentResponse {
  action: Level2Action;
  desiredWinner: Level2Winner;
}
