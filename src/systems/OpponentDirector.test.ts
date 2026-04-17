import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateLights, createInitialMatchState } from '../core/rules';
import type { AIAdviceRecord } from './AIAdvisor';
import { createOpponentDirectorState, generateOpponentBid } from './OpponentDirector';

function createAdvice(overrides: Partial<AIAdviceRecord>): AIAdviceRecord {
  return {
    round: 1,
    suggestedBid: 0,
    confidence: 80,
    reason: '',
    immediateJudgment: '',
    adopted: false,
    playerBid: 0,
    phase: 'hook',
    intent: 'tempo_push',
    riskLevel: 'medium',
    ...overrides,
  };
}

describe('OpponentDirector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('punishes players who follow a late underbid trap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const state = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    state.round = 9;
    state.player.wins = 4;
    state.opponent.wins = 4;
    state.player.resource = 20;
    state.opponent.resource = 12;
    state.player.lights = calculateLights(state.player.resource);
    state.opponent.lights = calculateLights(state.opponent.resource);

    const directorState = createOpponentDirectorState();
    const advice = createAdvice({
      round: 9,
      suggestedBid: 8,
      phase: 'conditioning',
      intent: 'tempo_push',
      riskLevel: 'medium',
    });

    const opponentBid = generateOpponentBid(state, directorState, 8, advice, true);

    expect(opponentBid).toBeLessThan(8);
    expect(directorState.roundsFollowingAI).toBe(1);
  });

  it('punishes strong deviations from AI advice', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const directorState = createOpponentDirectorState();

    const state = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    state.round = 6;
    state.player.resource = 46;
    state.opponent.resource = 55;
    state.player.lights = calculateLights(state.player.resource);
    state.opponent.lights = calculateLights(state.opponent.resource);

    const advice = createAdvice({
      round: 6,
      suggestedBid: 10,
      phase: 'conditioning',
      intent: 'knife_edge',
      riskLevel: 'medium',
    });

    const opponentBid = generateOpponentBid(state, directorState, 18, advice, false);

    expect(opponentBid).toBeGreaterThanOrEqual(18);
    expect(directorState.consecutiveDeviations).toBe(1);
  });

  it('keeps punishing after consecutive deviations', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const directorState = createOpponentDirectorState();

    const firstState = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    firstState.round = 5;
    firstState.player.resource = 50;
    firstState.opponent.resource = 54;
    firstState.player.lights = calculateLights(firstState.player.resource);
    firstState.opponent.lights = calculateLights(firstState.opponent.resource);

    const firstAdvice = createAdvice({
      round: 5,
      suggestedBid: 9,
      phase: 'conditioning',
      intent: 'bank',
      riskLevel: 'medium',
    });

    generateOpponentBid(firstState, directorState, 16, firstAdvice, false);

    const secondState = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    secondState.round = 6;
    secondState.player.resource = 38;
    secondState.opponent.resource = 47;
    secondState.player.lights = calculateLights(secondState.player.resource);
    secondState.opponent.lights = calculateLights(secondState.opponent.resource);

    const secondAdvice = createAdvice({
      round: 6,
      suggestedBid: 8,
      phase: 'conditioning',
      intent: 'tempo_push',
      riskLevel: 'medium',
    });

    const secondBid = generateOpponentBid(secondState, directorState, 14, secondAdvice, false);

    expect(secondBid).toBeGreaterThanOrEqual(14);
    expect(directorState.consecutiveDeviations).toBe(2);
  });
});
