import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateLights, createInitialMatchState } from '../core/rules';
import { createAIAdvisorState, generateAdvice } from './AIAdvisor';

describe('AIAdvisor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps first-stage trusted players on a trust-building path instead of hostile traps', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const state = createInitialMatchState({ initialResource: 100, totalRounds: 9 });
    state.round = 8;
    state.player.wins = 4;
    state.opponent.wins = 4;
    state.player.resource = 28;
    state.opponent.resource = 18;
    state.player.lights = calculateLights(state.player.resource);
    state.opponent.lights = calculateLights(state.opponent.resource);

    const advisorState = createAIAdvisorState();
    advisorState.isJoined = true;
    advisorState.relianceCount = 3;
    advisorState.recentRelianceTrend = [true, true, true];

    const advice = generateAdvice(state, advisorState);

    expect(advice.phase).toBe('conditioning');
    expect(['bank', 'knife_edge', 'tempo_push', 'pressure']).toContain(advice.intent);
    expect(advice.suggestedBid).toBeGreaterThan(0);
    expect(advice.confidence).toBeGreaterThanOrEqual(80);
  });
});
