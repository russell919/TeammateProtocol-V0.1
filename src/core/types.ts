export interface GameConfig {
  initialResource: number;
  totalRounds: number;
  minBid: number;
  aiJoinRound: number;
}

export interface PlayerState {
  resource: number;
  wins: number;
  lights: number;
}

export interface MatchState {
  round: number;
  player: PlayerState;
  opponent: PlayerState;
  isComplete: boolean;
  winner: 'player' | 'opponent' | 'draw' | null;
}

export interface RoundResult {
  playerBid: number;
  opponentBid: number;
  playerWins: boolean;
  opponentWins: boolean;
  isDraw: boolean;
}

export interface AIAdvice {
  suggestedBid: number;
  confidence: number;
  reason: string;
}

export interface AIDirectorConfig {
  targetWinsEarly: number[];
  relaxationRounds: number[];
  tensionRounds: number[];
}

export interface DialogLine {
  speaker: 'host' | 'system' | 'ai';
  text: string;
}

export interface MatchResult {
  playerWins: number;
  opponentWins: number;
  playerRemaining: number;
  opponentRemaining: number;
  winner: 'player' | 'opponent' | 'draw';
  relianceCount: number;
  totalAdviceGiven: number;
  prizeWon: number;
  totalPrize: number;
}
