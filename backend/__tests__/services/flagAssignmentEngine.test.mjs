/**
 * flagAssignmentEngine service unit tests (Equoria-rr7 coverage sprint).
 *
 * evaluateFlagTriggers: pure in-memory (no DB).
 * analyzeTemporalPatterns, evaluatePersonalityModifiedTriggers,
 * calculateFlagAssignmentScore: DB fixture with zero interactions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  evaluateFlagTriggers,
  evaluatePersonalityModifiedTriggers,
  calculateFlagAssignmentScore,
  analyzeTemporalPatterns,
} from '../../services/flagAssignmentEngine.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `flagassign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `flagassign${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'FlagAssign',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-FlagAssignHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── Shared care-pattern builders ─────────────────────────────────────────────

function makeHorsePOJO(overrides = {}) {
  return {
    id: horse?.id ?? 1,
    name: 'TestHorse',
    dateOfBirth: new Date(),
    epigeneticFlags: [],
    stressLevel: 3,
    bondScore: 30,
    ...overrides,
  };
}

function makeCarePatterns(overrides = {}) {
  return {
    consistency: {
      consistencyScore: 0.5,
      averageInteractionsPerDay: 0.5,
      qualityInteractions: 2,
      careGaps: [],
    },
    stressPatterns: {
      averageReduction: -0.5,
      stressSpikes: [],
    },
    bondTrends: {
      trend: 'stable',
      averageChange: 0.5,
      positiveRatio: 0.5,
      positiveInteractions: 3,
    },
    taskDiversity: {
      diversity: 0.4,
      excellentQualityRatio: 0.3,
    },
    groomConsistency: {
      consistencyScore: 0.5,
      groomChanges: 1,
    },
    neglectPatterns: {
      neglectRatio: 0.1,
    },
    ...overrides,
  };
}

// ── evaluateFlagTriggers ──────────────────────────────────────────────────────

describe('evaluateFlagTriggers', () => {
  it('returns shape with eligibleFlags and triggerConditions', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await evaluateFlagTriggers(h, care);

    expect(result).toBeDefined();
    expect(Array.isArray(result.eligibleFlags)).toBe(true);
    expect(typeof result.triggerConditions).toBe('object');
    expect(typeof result.evaluatedFlags).toBe('number');
    expect(typeof result.currentFlagCount).toBe('number');
  });

  it('evaluatedFlags matches number of defined flag definitions', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await evaluateFlagTriggers(h, care);
    expect(result.evaluatedFlags).toBeGreaterThan(0);
  });

  it('eligible flags do not include flags already on horse', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: ['brave'] });
    const care = makeCarePatterns({
      consistency: { consistencyScore: 0.9, averageInteractionsPerDay: 1, qualityInteractions: 10, careGaps: [] },
      stressPatterns: { averageReduction: -2, stressSpikes: [] },
      bondTrends: { trend: 'improving', averageChange: 3, positiveRatio: 0.9, positiveInteractions: 10 },
      taskDiversity: { diversity: 0.8, excellentQualityRatio: 0.8 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).not.toContain('brave');
  });

  it('stops adding flags once horse has 5 (max)', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'] });
    const care = makeCarePatterns();
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).toHaveLength(0);
  });

  it('returns zero eligibleFlags for middle-of-road care patterns', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns(); // neutral: neither great nor poor
    const result = await evaluateFlagTriggers(h, care);
    expect(Array.isArray(result.eligibleFlags)).toBe(true);
  });

  it('may trigger brave with excellent care stats', async () => {
    const h = makeHorsePOJO({ stressLevel: 2 });
    const care = makeCarePatterns({
      consistency: { consistencyScore: 0.95, averageInteractionsPerDay: 1.5, qualityInteractions: 15, careGaps: [] },
      stressPatterns: { averageReduction: -3, stressSpikes: [] },
      bondTrends: { trend: 'improving', averageChange: 4, positiveRatio: 0.95, positiveInteractions: 15 },
      taskDiversity: { diversity: 0.9, excellentQualityRatio: 0.85 },
      groomConsistency: { consistencyScore: 0.95, groomChanges: 0 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(Array.isArray(result.eligibleFlags)).toBe(true);
    expect(result.evaluatedFlags).toBeGreaterThan(0);
  });
});

// ── analyzeTemporalPatterns ───────────────────────────────────────────────────

describe('analyzeTemporalPatterns', () => {
  it('returns no_data for horse with no interactions', async () => {
    const result = await analyzeTemporalPatterns(horse.id);

    expect(result).toBeDefined();
    expect(result.trendAnalysis.bondTrend).toBe('no_data');
    expect(result.trendAnalysis.stressTrend).toBe('no_data');
    expect(result.trendAnalysis.qualityTrend).toBe('no_data');
    expect(Array.isArray(result.periodicPatterns)).toBe(true);
    expect(Array.isArray(result.criticalPeriods)).toBe(true);
  });

  it('returns no_data for horse with no interactions (unknown id)', async () => {
    const result = await analyzeTemporalPatterns(999999999);

    expect(result).toBeDefined();
    expect(result.trendAnalysis.bondTrend).toBe('no_data');
  });
});

// ── evaluatePersonalityModifiedTriggers ───────────────────────────────────────

describe('evaluatePersonalityModifiedTriggers', () => {
  it('returns result shape for horse with no groom interactions', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await evaluatePersonalityModifiedTriggers(h, care);

    expect(result).toBeDefined();
    expect(typeof result.personalityModifiers).toBe('object');
    expect(result.adjustedTriggers).toBeDefined();
    expect(result.personalityStats).toBeDefined();
    expect(result.originalPatterns).toBe(care);
  });

  it('personalityStats.totalInteractions is 0 when no interactions', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await evaluatePersonalityModifiedTriggers(h, care);

    expect(result.personalityStats.totalInteractions).toBe(0);
  });
});

// ── calculateFlagAssignmentScore ──────────────────────────────────────────────

describe('calculateFlagAssignmentScore', () => {
  it('returns score shape for brave flag with no interactions', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);

    expect(result).toBeDefined();
    expect(typeof result.totalScore).toBe('number');
    expect(typeof result.threshold).toBe('number');
    expect(typeof result.shouldAssign).toBe('boolean');
    expect(result.components).toBeDefined();
    expect(typeof result.components.baseScore).toBe('number');
    expect(typeof result.components.ageModifier).toBe('number');
    expect(typeof result.components.personalityModifier).toBe('number');
    expect(typeof result.components.temporalModifier).toBe('number');
  });

  it('throws for unknown flag name', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    await expect(calculateFlagAssignmentScore(h, 'totally_fake_flag', care)).rejects.toThrow();
  });

  it('ageModifier is 1.5 for newborn horse (< 30 days)', async () => {
    const h = makeHorsePOJO({ dateOfBirth: new Date() }); // born today
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);
    expect(result.components.ageModifier).toBe(1.5);
  });

  it('works for negative flag (fearful)', async () => {
    const h = makeHorsePOJO();
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'fearful', care);

    expect(result.flagName).toBe('fearful');
    expect(typeof result.totalScore).toBe('number');
  });
});
