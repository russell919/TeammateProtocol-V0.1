import type { GameConfig } from '../core/types';

export const GAME_CONFIG: GameConfig = {
  initialResource: 100,
  totalRounds: 9,
  minBid: 0,
  aiJoinRound: 3,
};

export const PRIZE_CONFIG = {
  currentPrize: 0,
  round1WinPrize: 20000,
  round2WinPrize: 50000,
  round3WinPrize: 100000,
  round4WinPrize: 200000,
  round5WinPrize: 500000,
} as const;

export function getNextPrize(round: number): number {
  switch (round) {
    case 1: return PRIZE_CONFIG.round1WinPrize;
    case 2: return PRIZE_CONFIG.round2WinPrize;
    case 3: return PRIZE_CONFIG.round3WinPrize;
    case 4: return PRIZE_CONFIG.round4WinPrize;
    case 5: return PRIZE_CONFIG.round5WinPrize;
    default: return 0;
  }
}

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  INTRO: 'IntroScene',
  RULES: 'RuleScene',
  MATCH: 'MatchScene',
  RESULT: 'ResultScene',
} as const;

export const COLORS = {
  BACKGROUND: 0x0a0a0f,
  PANEL_BG: 0x151520,
  PANEL_BORDER: 0x2a2a3a,
  TEXT_PRIMARY: 0xe8e8e8,
  TEXT_SECONDARY: 0x888899,
  ACCENT_RED: 0xff3344,
  ACCENT_GREEN: 0x00ff88,
  ACCENT_CYAN: 0x00ccff,
  ACCENT_YELLOW: 0xffcc00,
  LAMP_ON: 0xff3344,
  LAMP_OFF: 0x222233,
  HOST_COLOR: 0xffcc66,
  SYSTEM_COLOR: 0x88aaff,
  AI_COLOR: 0x00ff88,
} as const;

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
