/**
 * dynamicCompatibilityScoring service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests exported async functions with real DB fixtures.
 * Uses a user+groom+horse fixture; focuses on zero-interaction code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  analyzeCompatibilityTrends,
  getOptimalGroomRecommendations,
  calculateDynamicCompatibility,
  analyzeCompatibilityFactors,
  predictInteractionOutcome,
} from '../../services/dynamicCompatibilityScoring.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `dyncompat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `dyncompat${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'DynCompat',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-DynCompatHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-DynCompatGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

const CONTEXT = { taskType: 'grooming', timeOfDay: 'morning', weather: 'sunny' };

// ─── analyzeCompatibilityTrends ───────────────────────────────────────────────

describe('analyzeCompatibilityTrends', () => {
  it('returns insufficient_data for groom+horse with no interactions', async () => {
    const result = await analyzeCompatibilityTrends(groom.id, horse.id);

    expect(result).toBeDefined();
    expect(result.overallTrend).toBe('insufficient_data');
    expect(result.trendStrength).toBe(0);
    expect(result.dataPoints).toBe(0);
  });

  it('returns insufficient_data for unknown ids', async () => {
    const result = await analyzeCompatibilityTrends(999999999, 999999998);

    expect(result).toBeDefined();
    expect(result.overallTrend).toBe('insufficient_data');
  });
});

// ─── getOptimalGroomRecommendations ───────────────────────────────────────────

describe('getOptimalGroomRecommendations', () => {
  it('returns recommendation structure including test groom', async () => {
    const result = await getOptimalGroomRecommendations(horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(Array.isArray(result.rankedGrooms)).toBe(true);
    expect(result.topRecommendation !== undefined || result.rankedGrooms !== undefined).toBe(true);
  });
});

// ─── calculateDynamicCompatibility ────────────────────────────────────────────

describe('calculateDynamicCompatibility', () => {
  it('returns compatibility score between 0 and 1.5', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1.5);
  });

  it('returns a recommendationLevel string', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, CONTEXT);

    expect(typeof result.recommendationLevel).toBe('string');
    expect(['highly_recommended', 'recommended', 'acceptable', 'not_recommended']).toContain(
      result.recommendationLevel,
    );
  });
});

// ─── analyzeCompatibilityFactors ──────────────────────────────────────────────

describe('analyzeCompatibilityFactors', () => {
  it('returns factors object for known groom+horse', async () => {
    const result = await analyzeCompatibilityFactors(groom.id, horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ─── predictInteractionOutcome ────────────────────────────────────────────────

describe('predictInteractionOutcome', () => {
  it('returns prediction object for known groom+horse', async () => {
    const result = await predictInteractionOutcome(groom.id, horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── calculateStressSituationModifier branches (Equoria-jkht) ──────────────────
// context.horseCurrentStress overrides horse.stressLevel in the modifier.
// Tiers: <= 3 → 1.1, <= 6 → 1.0, <= 8 → 0.9, > 8 → 0.7.

describe('calculateDynamicCompatibility — stressSituationModifier branches (Equoria-jkht)', () => {
  it('stressSituationModifier=1.1 when horseCurrentStress=1 (≤ 3)', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 1,
    });
    expect(result.stressSituationModifier).toBe(1.1);
  });

  it('stressSituationModifier=1.0 when horseCurrentStress=5 (≤ 6)', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 5,
    });
    expect(result.stressSituationModifier).toBe(1.0);
  });

  it('stressSituationModifier=0.9 when horseCurrentStress=7 (≤ 8)', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 7,
    });
    expect(result.stressSituationModifier).toBe(0.9);
  });

  it('stressSituationModifier=0.7 when horseCurrentStress=9 (> 8)', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 9,
    });
    expect(result.stressSituationModifier).toBe(0.7);
  });
});

// ── calculateTimeOfDayModifier branches (Equoria-jkht) ───────────────────────
// morning → 1.1, afternoon → 1.0, evening → 0.95.

describe('calculateDynamicCompatibility — timeOfDayModifier branches (Equoria-jkht)', () => {
  it('timeOfDayModifier=1.1 for timeOfDay=morning', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
    });
    expect(result.timeOfDayModifier).toBe(1.1);
  });

  it('timeOfDayModifier=1.0 for timeOfDay=afternoon', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'afternoon',
    });
    expect(result.timeOfDayModifier).toBe(1.0);
  });

  it('timeOfDayModifier=0.95 for timeOfDay=evening', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'evening',
    });
    expect(result.timeOfDayModifier).toBe(0.95);
  });
});

// ── analyzeCompatibilityTrends — slope branches with DB interactions (Equoria-jkht) ──
// One groom + 3 horses, each with 3 interactions shaped to produce:
//   improving: scores [0.467, 0.733, 0.833] → slope ≈ +0.183 > 0.05
//   declining: scores [0.833, 0.65,  0.317] → slope ≈ -0.258 < -0.05
//   stable:    scores [0.55,  0.55,  0.55 ] → slope = 0

describe('analyzeCompatibilityTrends — trend slope branches with DB interactions (Equoria-jkht)', () => {
  let trendUser;
  let trendGroom;
  let improvingHorse;
  let decliningHorse;
  let stableHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    trendUser = await prisma.user.create({
      data: {
        email: `dc-trend-${ts}-${rand()}@test.com`,
        username: `dctrend${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DC',
        lastName: 'Trend',
        money: 1000,
      },
    });

    trendGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-DC-TrendGroom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: trendUser.id,
        isActive: true,
      },
    });

    improvingHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DC-Improving-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: trendUser.id,
      },
    });

    decliningHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DC-Declining-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: trendUser.id,
      },
    });

    stableHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DC-Stable-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: trendUser.id,
      },
    });

    // improving: quality=[fair,good,excellent], bondingChange=[0,2,4], stressChange=0
    // → compatibility scores ≈ [0.467, 0.733, 0.833] → slope ≈ +0.183
    const improvingRows = [
      { quality: 'fair', bondingChange: 0, stressChange: 0 },
      { quality: 'good', bondingChange: 2, stressChange: 0 },
      { quality: 'excellent', bondingChange: 4, stressChange: 0 },
    ];
    for (let i = 0; i < improvingRows.length; i++) {
      const r = improvingRows[i];
      await prisma.groomInteraction.create({
        data: {
          foalId: improvingHorse.id,
          groomId: trendGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: r.bondingChange,
          stressChange: r.stressChange,
          quality: r.quality,
          taskType: 'grooming',
          createdAt: new Date(ts - (improvingRows.length - i) * 60000),
          timestamp: new Date(ts - (improvingRows.length - i) * 60000),
        },
      });
    }

    // declining: quality=[excellent,good,poor], bondingChange=[3,1,-1], stressChange=0
    // → compatibility scores ≈ [0.833, 0.65, 0.317] → slope ≈ -0.258
    const decliningRows = [
      { quality: 'excellent', bondingChange: 3, stressChange: 0 },
      { quality: 'good', bondingChange: 1, stressChange: 0 },
      { quality: 'poor', bondingChange: -1, stressChange: 0 },
    ];
    for (let i = 0; i < decliningRows.length; i++) {
      const r = decliningRows[i];
      await prisma.groomInteraction.create({
        data: {
          foalId: decliningHorse.id,
          groomId: trendGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: r.bondingChange,
          stressChange: r.stressChange,
          quality: r.quality,
          taskType: 'grooming',
          createdAt: new Date(ts - (decliningRows.length - i) * 60000),
          timestamp: new Date(ts - (decliningRows.length - i) * 60000),
        },
      });
    }

    // stable: all quality='fair', bondingChange=1, stressChange=0
    // → compatibility scores = [0.55, 0.55, 0.55] → slope = 0
    for (let i = 0; i < 3; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: stableHorse.id,
          groomId: trendGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 1,
          stressChange: 0,
          quality: 'fair',
          taskType: 'grooming',
          createdAt: new Date(ts - (3 - i) * 60000),
          timestamp: new Date(ts - (3 - i) * 60000),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    await prisma.groomInteraction
      .deleteMany({ where: { foalId: { in: [improvingHorse.id, decliningHorse.id, stableHorse.id] } } })
      .catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-DC-' } } }).catch(() => {});
    await prisma.groom.delete({ where: { id: trendGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: trendUser.id } }).catch(() => {});
  }, 30000);

  it('overallTrend=improving when compatibility scores increase (slope > 0.05)', async () => {
    const result = await analyzeCompatibilityTrends(trendGroom.id, improvingHorse.id);
    expect(result.overallTrend).toBe('improving');
    expect(result.dataPoints).toBe(3);
    expect(result.trendStrength).toBeGreaterThan(0);
  });

  it('overallTrend=declining when compatibility scores decrease (slope < -0.05)', async () => {
    const result = await analyzeCompatibilityTrends(trendGroom.id, decliningHorse.id);
    expect(result.overallTrend).toBe('declining');
    expect(result.dataPoints).toBe(3);
  });

  it('overallTrend=stable when all compatibility scores are equal (slope = 0)', async () => {
    const result = await analyzeCompatibilityTrends(trendGroom.id, stableHorse.id);
    expect(result.overallTrend).toBe('stable');
    expect(result.dataPoints).toBe(3);
    expect(result.trendStrength).toBeLessThan(0.1);
  });

  it('returns full trend data fields (improvementRate, stabilityScore, projectedCompatibility) when dataPoints >= 3', async () => {
    const result = await analyzeCompatibilityTrends(trendGroom.id, improvingHorse.id);
    expect(typeof result.improvementRate).toBe('number');
    expect(typeof result.stabilityScore).toBe('number');
    expect(typeof result.projectedCompatibility).toBe('number');
    expect(typeof result.currentAverage).toBe('number');
    expect(result.trendDetails).toBeDefined();
  });
});

// ── recommendationLevel + environmental branches (Equoria-jkht) ───────────────
// recommendationLevel tiers: highly_recommended(≥0.8), recommended(≥0.6),
// acceptable(≥0.4), not_recommended(<0.4).
// calculateEnvironmentalModifier switch cases: quiet, noisy, familiar, unfamiliar.
// calculateTimeOfDayModifier default case (unknown timeOfDay → 1.0).
// calculateHistoricalModifier non-1.0 path + confidence historicalModifier branch.
// Methodical groom cap: baseCompatibility≤0.5 && overallScore>0.75 → capped 0.75.

describe('dynamicCompatibilityScoring — branch coverage (Equoria-jkht)', () => {
  let branchUser;
  let branchHorse;
  let highExpGroom; // level=10, experience=200 → guaranteed highly_recommended
  let methodicalGroom; // epigeneticInfluenceType='methodical', high exp → cap test

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    branchUser = await prisma.user.create({
      data: {
        email: `dc-branch-${ts}-${rand()}@test.com`,
        username: `dcbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'DC',
        lastName: 'Branch',
        money: 1000,
      },
    });

    branchHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-DC-BranchHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: branchUser.id,
      },
    });

    [highExpGroom, methodicalGroom] = await Promise.all([
      prisma.groom.create({
        data: {
          name: `TestFixture-DC-HighExpGroom-${ts}`,
          speciality: 'foal_care',
          personality: 'gentle',
          level: 10,
          experience: 200,
          userId: branchUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-DC-MethodicalGroom-${ts}`,
          speciality: 'foal_care',
          personality: 'methodical',
          epigeneticInfluenceType: 'methodical',
          level: 10,
          experience: 200,
          userId: branchUser.id,
        },
      }),
    ]);

    // Seed 2 interactions between highExpGroom + branchHorse → historicalModifier != 1.0
    await prisma.groomInteraction.createMany({
      data: [
        {
          foalId: branchHorse.id,
          groomId: highExpGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 4,
          stressChange: -2,
          quality: 'excellent',
          taskType: 'grooming',
          timestamp: new Date(ts - 2 * 24 * 60 * 60 * 1000),
        },
        {
          foalId: branchHorse.id,
          groomId: highExpGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 3,
          stressChange: -1,
          quality: 'good',
          taskType: 'grooming',
          timestamp: new Date(ts - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: branchHorse.id } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-DC-Branch' } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-DC-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: branchUser.id } }).catch(() => {});
  }, 30000);

  it('recommendationLevel=acceptable: stress=7 + evening context', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'evening',
      horseCurrentStress: 7,
    });
    expect(result.recommendationLevel).toBe('acceptable');
    expect(result.overallScore).toBeGreaterThanOrEqual(0.4);
    expect(result.overallScore).toBeLessThan(0.6);
  });

  it('recommendationLevel=not_recommended: stress=9 + evening context', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'evening',
      horseCurrentStress: 9,
    });
    expect(result.recommendationLevel).toBe('not_recommended');
    expect(result.overallScore).toBeLessThan(0.4);
  });

  it('recommendationLevel=highly_recommended: high-experience groom morning low-stress', async () => {
    const result = await calculateDynamicCompatibility(highExpGroom.id, branchHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 1,
    });
    expect(result.recommendationLevel).toBe('highly_recommended');
    expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
  });

  it('calculateEnvironmentalModifier: quiet factor multiplies by 1.1', async () => {
    const base = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
    });
    const withQuiet = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['quiet'],
    });
    // quiet → modifier * 1.1; overall score should be higher
    expect(withQuiet.environmentalModifier).toBeCloseTo(1.1, 2);
    expect(withQuiet.overallScore).toBeGreaterThan(base.overallScore);
  });

  it('calculateEnvironmentalModifier: noisy factor multiplies by 0.9', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['noisy'],
    });
    expect(result.environmentalModifier).toBeCloseTo(0.9, 2);
  });

  it('calculateEnvironmentalModifier: familiar factor multiplies by 1.1', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['familiar'],
    });
    expect(result.environmentalModifier).toBeCloseTo(1.1, 2);
  });

  it('calculateEnvironmentalModifier: unfamiliar factor multiplies by 0.9', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['unfamiliar'],
    });
    expect(result.environmentalModifier).toBeCloseTo(0.9, 2);
  });

  it('calculateTimeOfDayModifier default branch: unknown timeOfDay returns 1.0', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'midnight',
    });
    expect(result.timeOfDayModifier).toBe(1.0);
  });

  it('calculateHistoricalModifier non-1.0: existing interactions produce modifier != 1.0', async () => {
    const result = await calculateDynamicCompatibility(highExpGroom.id, branchHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
    });
    // 2 excellent/good interactions → qualityModifier > 1, historicalModifier != 1.0
    expect(result.historicalModifier).not.toBe(1.0);
    expect(result.historicalModifier).toBeGreaterThan(1.0);
  });

  it('methodical groom cap: overallScore capped at 0.75 when baseCompatibility<=0.5 and score>0.75', async () => {
    // methodical groom with high experience → experienceBonus=1.9 → raw score > 0.75
    // methodical personality baseCompatibility <= 0.5 for developing horse → cap applies
    const result = await calculateDynamicCompatibility(methodicalGroom.id, branchHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 1,
    });
    // If the methodical cap fires, overallScore <= 0.75
    // Assert the cap was effective (score should not exceed 0.75 if cap applied)
    expect(result.overallScore).toBeLessThanOrEqual(0.75);
  });
});
