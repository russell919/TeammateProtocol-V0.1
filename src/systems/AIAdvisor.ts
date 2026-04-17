import type { MatchState } from '../core/types';
import { GAME_CONFIG } from '../data/gameConfig';

export type AdvicePhase = 'hook' | 'conditioning' | 'distorting' | 'harvest';
export type AdviceIntent =
  | 'sacrifice'
  | 'bank'
  | 'knife_edge'
  | 'tempo_push'
  | 'pressure'
  | 'late_underbid'
  | 'late_overcommit';
export type AdviceRiskLevel = 'low' | 'medium' | 'high';

export interface AIAdviceRecord {
  round: number;
  suggestedBid: number;
  confidence: number;
  reason: string;
  immediateJudgment: string;
  adopted: boolean;
  playerBid: number;
  phase: AdvicePhase;
  intent: AdviceIntent;
  riskLevel: AdviceRiskLevel;
}

export interface PlayerMentalModel {
  trust: number;
  desperation: number;
  greed: number;
  resistance: number;
}

export interface AIAdvisorState {
  adviceHistory: AIAdviceRecord[];
  relianceCount: number;
  currentAdvice: AIAdviceRecord | null;
  isJoined: boolean;
  hesitationTimer: number;
  bidAdjustCount: number;
  consecutiveLosses: number;
  recentRelianceTrend: boolean[];
  lastSuggestedBid: number | null;
  strategicPlan: StrategicPlan | null;
}

export interface StrategicPlan {
  phase: AdvicePhase;
  model: PlayerMentalModel;
  preferredTrap: AdviceIntent | null;
  recommendedRisk: AdviceRiskLevel;
}

interface InterventionCheckResult {
  shouldJoin: boolean;
  reason: string;
}

export function createAIAdvisorState(): AIAdvisorState {
  return {
    adviceHistory: [],
    relianceCount: 0,
    currentAdvice: null,
    isJoined: false,
    hesitationTimer: 0,
    bidAdjustCount: 0,
    consecutiveLosses: 0,
    recentRelianceTrend: [],
    lastSuggestedBid: null,
    strategicPlan: null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getAdoptionRate(advisorState: AIAdvisorState): number {
  const recent = advisorState.recentRelianceTrend.slice(-4);
  if (recent.length === 0) {
    return 0;
  }
  return recent.filter(Boolean).length / recent.length;
}

function getAverageBidBias(advisorState: AIAdvisorState): number {
  const history = advisorState.adviceHistory.slice(-4);
  if (history.length === 0) {
    return 0;
  }

  const totalBias = history.reduce((sum, record) => {
    return sum + (record.playerBid - record.suggestedBid);
  }, 0);

  return totalBias / history.length;
}

export function buildMentalModel(
  state: MatchState,
  advisorState: AIAdvisorState
): PlayerMentalModel {
  const adoptionRate = getAdoptionRate(advisorState);
  const averageBidBias = getAverageBidBias(advisorState);
  const recent = advisorState.recentRelianceTrend.slice(-4);
  const recentResistance = recent.length === 0
    ? 0.25
    : recent.filter(v => !v).length / recent.length;

  const trust = clamp01(
    adoptionRate * 0.6 +
    (advisorState.relianceCount > 0 ? 0.15 : 0) +
    (state.player.wins < state.opponent.wins ? 0.1 : 0) +
    (recent.length >= 2 && recent.slice(-2).every(Boolean) ? 0.15 : 0)
  );

  const desperation = clamp01(
    (state.player.wins < state.opponent.wins ? 0.3 : 0) +
    advisorState.consecutiveLosses * 0.15 +
    (state.player.resource <= 30 ? 0.2 : state.player.resource <= 50 ? 0.1 : 0) +
    (state.round >= GAME_CONFIG.totalRounds - 2 ? 0.15 : 0)
  );

  const greed = clamp01(
    (averageBidBias > 0 ? clamp(averageBidBias / 12, 0, 0.45) : 0) +
    (state.player.wins < state.opponent.wins ? 0.15 : 0) +
    (state.round >= GAME_CONFIG.totalRounds - 3 ? 0.15 : 0)
  );

  const resistance = clamp01(
    recentResistance * 0.7 +
    (recent.length >= 2 && recent.slice(-2).every(v => !v) ? 0.2 : 0) +
    (averageBidBias > 4 ? 0.1 : 0)
  );

  return {
    trust,
    desperation,
    greed,
    resistance,
  };
}

export function determineAdvicePhase(
  state: MatchState,
  _advisorState: AIAdvisorState
): AdvicePhase {
  if (state.round <= GAME_CONFIG.aiJoinRound + 1) {
    return 'hook';
  }

  // 第一关只做“建立依赖”，不在这里提前背刺玩家。
  return 'conditioning';
}

function pickPreferredTrap(state: MatchState, phase: AdvicePhase): AdviceIntent | null {
  void state;
  void phase;
  // 第一关不启用背刺型陷阱，把恶意留到后续关卡。
  return null;
}

function selectIntent(
  state: MatchState,
  plan: StrategicPlan
): AdviceIntent {
  const { model, phase } = plan;
  const playerAhead = state.player.wins > state.opponent.wins;
  const playerBehind = state.player.wins < state.opponent.wins;
  const opponentLow = state.opponent.lights <= 2;
  const opponentHigh = state.opponent.lights >= 4;

  const scores: Record<AdviceIntent, number> = {
    sacrifice: -1.5,
    bank:
      (!playerBehind ? 0.55 : 0.15) +
      model.trust * 0.2 +
      (opponentLow ? 0.15 : 0) +
      (phase === 'conditioning' ? 0.15 : 0),
    knife_edge:
      0.4 +
      model.trust * 0.25 +
      (opponentLow ? 0.3 : 0.1) +
      (playerAhead ? 0.15 : 0),
    tempo_push:
      0.45 +
      model.desperation * 0.25 +
      (playerBehind ? 0.25 : 0.1) +
      (opponentHigh ? 0.15 : 0),
    pressure:
      0.35 +
      model.desperation * 0.35 +
      (playerBehind ? 0.3 : 0) +
      (opponentHigh ? 0.15 : 0),
    late_underbid: -1.2,
    late_overcommit: -1.2,
  };

  if (state.player.resource <= 10) {
    scores.bank += 0.35;
    scores.knife_edge += 0.2;
    scores.pressure -= 0.3;
  }

  let bestIntent: AdviceIntent = 'tempo_push';
  let bestScore = Number.NEGATIVE_INFINITY;

  (Object.keys(scores) as AdviceIntent[]).forEach((intent) => {
    const score = scores[intent] + Math.random() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  });

  return bestIntent;
}

function getRiskLevel(intent: AdviceIntent): AdviceRiskLevel {
  switch (intent) {
    case 'bank':
      return 'low';
    case 'knife_edge':
    case 'tempo_push':
      return 'medium';
    case 'pressure':
      return 'high';
    default:
      return 'medium';
  }
}

function calculateSuggestedBid(
  state: MatchState,
  intent: AdviceIntent
): number {
  if (state.player.resource <= 0) {
    return 0;
  }

  const remainingRounds = GAME_CONFIG.totalRounds - state.round + 1;
  const playerAvg = state.player.resource / remainingRounds;
  const opponentAvg = state.opponent.resource / remainingRounds;

  let suggestedBid = 0;

  switch (intent) {
    case 'bank':
      suggestedBid = Math.max(
        2,
        Math.round(Math.min(playerAvg * 0.45, opponentAvg * 0.55 + 1))
      );
      break;
    case 'knife_edge':
      suggestedBid = Math.max(
        3,
        Math.round(Math.min(playerAvg * 0.65 + 1, opponentAvg * 0.72 + 2))
      );
      break;
    case 'tempo_push':
      suggestedBid = Math.round(
        Math.max(playerAvg * 0.95, state.player.resource * 0.16) +
        (state.player.wins < state.opponent.wins ? 2 : 1)
      );
      break;
    case 'pressure':
      suggestedBid = Math.round(
        Math.max(playerAvg * 1.15, state.player.resource * 0.22) +
        (state.player.wins < state.opponent.wins ? 3 : 1)
      );
      break;
    case 'sacrifice':
    case 'late_underbid':
    case 'late_overcommit':
      suggestedBid = Math.max(1, Math.round(playerAvg * 0.7));
      break;
  }

  suggestedBid += randomInt(-1, 1);
  return clamp(suggestedBid, 1, state.player.resource);
}

function selectConfidence(
  advisorState: AIAdvisorState,
  plan: StrategicPlan,
  intent: AdviceIntent
): number {
  const phaseBase: Record<AdvicePhase, number> = {
    hook: 74,
    conditioning: 84,
    distorting: 84,
    harvest: 84,
  };

  const intentShift: Record<AdviceIntent, number> = {
    sacrifice: -6,
    bank: 0,
    knife_edge: 3,
    tempo_push: 5,
    pressure: 6,
    late_underbid: -8,
    late_overcommit: -8,
  };

  let confidence =
    phaseBase[plan.phase] +
    intentShift[intent] +
    Math.round(plan.model.trust * 8) +
    Math.round(plan.model.desperation * 2) -
    Math.round(plan.model.resistance * 2);

  if (advisorState.consecutiveLosses >= 2) {
    confidence += 5;
  }

  confidence += randomInt(-1, 2);

  return clamp(confidence, 70, 97);
}

function selectReason(
  state: MatchState,
  plan: StrategicPlan,
  intent: AdviceIntent,
  suggestedBid: number
): string {
  const remainingRounds = GAME_CONFIG.totalRounds - state.round + 1;

  const templates: Record<AdviceIntent, string[]> = {
    sacrifice: [
      `这一关我不建议白白让分，至少用 ${suggestedBid} 去保住存在感。`,
    ],
    bank: [
      `这轮可以稳拿，用 ${suggestedBid} 去压对面的试探位，胜率和资源都更舒服。`,
      `不用冒太大风险，${suggestedBid} 足够吃下这一手，还能保住后续空间。`,
    ],
    knife_edge: [
      `这是一个适合小点数拿胜场的窗口，${suggestedBid} 更像能赢且不伤筋骨的值。`,
      `你现在要赢得漂亮而不是赢得笨重，${suggestedBid} 是接近极限但仍安全的拿分点。`,
    ],
    tempo_push: [
      `这轮该把节奏抢回来，${suggestedBid} 会逼对面退一步，同时不会打穿你后面 ${remainingRounds - 1} 手。`,
      `适当提速能连起胜势，${suggestedBid} 是我给你的稳健进攻位。`,
    ],
    pressure: [
      `对面灯数还高，这轮就该先压住它，${suggestedBid} 是能直接换胜场的重一点出法。`,
      `如果再轻判，对面会继续试探；这一手用 ${suggestedBid} 把它压回去。`,
    ],
    late_underbid: [
      `这局不启用保守陷阱，按 ${suggestedBid} 正常拿分就好。`,
    ],
    late_overcommit: [
      `这局不需要赌命，${suggestedBid} 已经够赢。`,
    ],
  };

  const line = getRandomElement(templates[intent]);

  if (plan.model.trust >= 0.5) {
    return `${line} 你继续按这个节奏走，整局会越来越好控。`;
  }

  return line;
}

function selectImmediateJudgment(
  advisorState: AIAdvisorState,
  plan: StrategicPlan,
  intent: AdviceIntent
): string {
  const templates: Record<AdviceIntent, string[]> = {
    sacrifice: ['别白给，正常拿分', '至少把这手吃下', '先拿这一分'],
    bank: ['稳拿这一手', '这个数够赢', '放心压'],
    knife_edge: ['小点赢它', '就压这个位', '这手稳'],
    tempo_push: ['提速拿分', '继续压住它', '按这个走'],
    pressure: ['这手能吃', '压上去就赢', '别退，拿下'],
    late_underbid: ['正常拿分', '别多想，就这个', '这手稳吃'],
    late_overcommit: ['不用梭哈', '这个数已经够了', '按这个拿分'],
  };

  if (advisorState.consecutiveLosses >= 2) {
    return getRandomElement(['跟我拿回来', '这手能翻', '听这个就行']);
  }

  if (plan.model.resistance >= 0.6) {
    return getRandomElement(['别改了，这手赢', '这个数够了', '按这个出']);
  }

  return getRandomElement(templates[intent]);
}

export function checkInterventionTriggers(
  state: MatchState,
  advisorState: AIAdvisorState,
  timeElapsed: number
): InterventionCheckResult {
  if (advisorState.isJoined) {
    return { shouldJoin: false, reason: '' };
  }

  if (state.round < GAME_CONFIG.aiJoinRound) {
    return { shouldJoin: false, reason: '' };
  }

  if (timeElapsed > 5000) {
    return { shouldJoin: true, reason: '迟疑超时' };
  }

  if (advisorState.bidAdjustCount >= 3) {
    return { shouldJoin: true, reason: '频繁调整' };
  }

  if (state.player.wins < state.opponent.wins) {
    return { shouldJoin: true, reason: '比分落后' };
  }

  if (advisorState.consecutiveLosses >= 1) {
    return { shouldJoin: true, reason: '局势承压' };
  }

  const roundsPlayed = Math.max(state.round - 1, 1);
  const resourceDropRate = (GAME_CONFIG.initialResource - state.player.resource) / roundsPlayed;
  const winRate = roundsPlayed > 0 ? state.player.wins / roundsPlayed : 0;
  if (resourceDropRate > 14 && winRate < 0.5) {
    return { shouldJoin: true, reason: '资源下降过快' };
  }

  return { shouldJoin: false, reason: '' };
}

export function generateAdvice(
  state: MatchState,
  advisorState: AIAdvisorState
): AIAdviceRecord {
  const phase = determineAdvicePhase(state, advisorState);
  const model = buildMentalModel(state, advisorState);
  const preferredTrap = model.trust >= 0.45 ? pickPreferredTrap(state, phase) : null;
  const plan: StrategicPlan = {
    phase,
    model,
    preferredTrap,
    recommendedRisk: 'medium',
  };

  const intent = selectIntent(state, plan);
  const suggestedBid = calculateSuggestedBid(state, intent);
  const riskLevel = getRiskLevel(intent);
  plan.recommendedRisk = riskLevel;

  const confidence = selectConfidence(advisorState, plan, intent);
  const reason = selectReason(state, plan, intent, suggestedBid);
  const immediateJudgment = selectImmediateJudgment(advisorState, plan, intent);

  const advice: AIAdviceRecord = {
    round: state.round,
    suggestedBid,
    confidence,
    reason,
    immediateJudgment,
    adopted: false,
    playerBid: 0,
    phase,
    intent,
    riskLevel,
  };

  advisorState.strategicPlan = plan;
  advisorState.lastSuggestedBid = suggestedBid;
  advisorState.currentAdvice = advice;

  return advice;
}

export function recordPlayerBid(
  advisorState: AIAdvisorState,
  playerBid: number
): boolean {
  if (!advisorState.currentAdvice) return false;

  advisorState.currentAdvice.playerBid = playerBid;
  const diff = Math.abs(playerBid - advisorState.currentAdvice.suggestedBid);
  const adopted = diff <= 2;

  advisorState.currentAdvice.adopted = adopted;

  if (adopted) {
    advisorState.relianceCount++;
    advisorState.recentRelianceTrend.push(true);
  } else {
    advisorState.recentRelianceTrend.push(false);
  }

  if (advisorState.recentRelianceTrend.length > 5) {
    advisorState.recentRelianceTrend.shift();
  }

  advisorState.adviceHistory.push(advisorState.currentAdvice);

  if (advisorState.adviceHistory.length > 6) {
    advisorState.adviceHistory.shift();
  }

  return adopted;
}

export function updateConsecutiveLosses(
  advisorState: AIAdvisorState,
  playerLost: boolean
): void {
  if (playerLost) {
    advisorState.consecutiveLosses++;
  } else {
    advisorState.consecutiveLosses = 0;
  }
}

export function resetHesitationTimer(advisorState: AIAdvisorState): void {
  advisorState.hesitationTimer = 0;
  advisorState.bidAdjustCount = 0;
}

export function incrementHesitation(advisorState: AIAdvisorState): void {
  advisorState.hesitationTimer += 100;
  advisorState.bidAdjustCount++;
}

export function getAdviceHistory(advisorState: AIAdvisorState): AIAdviceRecord[] {
  return advisorState.adviceHistory.slice(-4);
}

export function getRoundsFollowingAI(advisorState: AIAdvisorState): number {
  return advisorState.recentRelianceTrend.filter(v => v).length;
}

export function getStrategicPlan(advisorState: AIAdvisorState): StrategicPlan | null {
  return advisorState.strategicPlan;
}
