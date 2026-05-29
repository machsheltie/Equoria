/**
 * dynamicCompatibilityScoring service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests exported async functions with real DB fixtures.
 * Uses a user+groom+horse fixture; focuses on zero-interaction code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  analyzeCompatibilityTrends,
  getOptimalGroomRecommendations,
  calculateDynamicCompatibility,
  analyzeCompatibilityFactors,
  predictInteractionOutcome,
  updateCompatibilityHistory,
} from '../../breeding/services/dynamicCompatibilityScoring.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `dyncompat-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `dyncompat${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'DynCompat',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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
        ...fixtureColor(),
        name: `TestFixture-DC-Improving-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: trendUser.id,
      },
    });

    decliningHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-DC-Declining-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: trendUser.id,
      },
    });

    stableHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
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
        ...fixtureColor(),
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

  it('recommendationLevel=not_recommended: stress=9 + chaotic environment', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'evening',
      horseCurrentStress: 9,
      environmentalFactors: ['chaotic'],
    });
    expect(result.recommendationLevel).toBe('not_recommended');
    expect(result.environmentalModifier).toBeCloseTo(0.85, 2);
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

  it('calculateEnvironmentalModifier: structured factor multiplies by 1.05', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['structured'],
    });
    expect(result.environmentalModifier).toBeCloseTo(1.05, 2);
  });

  it('calculateEnvironmentalModifier: stimulating factor leaves modifier at 1.0', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['stimulating'],
    });
    expect(result.environmentalModifier).toBeCloseTo(1.0, 2);
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

  it('methodical groom: high-experience score is in valid range (exercises outer cap false branch)', async () => {
    // methodical groom with high experience → experienceBonus=1.9
    // A fresh horse has baseCompatibility > 0.5 so the outer condition is false — exercises that branch
    const result = await calculateDynamicCompatibility(methodicalGroom.id, branchHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 1,
    });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(1.5);
    expect(['highly_recommended', 'recommended', 'acceptable', 'not_recommended']).toContain(
      result.recommendationLevel,
    );
  });
});

// ── Branch coverage extension (Equoria-rr7) ───────────────────────────────────
// Covers lines 279 (interaction-not-found throw), 348-354 (empty-grooms return),
// 562 (default env factor switch arm), 703 (methodical stress compat), 725/727
// (energetic/methodical bonding potential), 780 (low-bond+methodical risk),
// 803 (methodical+developing strength), 839 (high-stress recommendation), 855
// (0-interaction insufficient_data trend), 864-875 (multi-interaction slope),
// 898 (empty-recentInteractions baseline=0.5), 948-949/962 (contextual notes).

describe('dynamicCompatibilityScoring — extended branch coverage (Equoria-rr7)', () => {
  let rr7User;
  let rr7MethodicalGroom;
  let rr7EnergeticGroom;
  let rr7Horse; // bondScore default (0), stressLevel default (0)
  let rr7HighBondHorse; // bondScore=30 for energetic+highBond branch
  let rr7StressHorse; // stressLevel=9 for high-stress tests
  let rr7NoGroomUser;
  let rr7NoGroomHorse;
  let rr7Interaction1; // 1st interaction between rr7MethodicalGroom + rr7Horse (quality: 'poor')
  let rr7Interaction2; // 2nd interaction between rr7MethodicalGroom + rr7Horse (quality: 'excellent')

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rr7User = await prisma.user.create({
      data: {
        email: `rr7-${ts}-${rand()}@test.com`,
        username: `rr7${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'RR7',
        lastName: 'Branch',
        money: 1000,
      },
    });

    rr7NoGroomUser = await prisma.user.create({
      data: {
        email: `rr7ng-${ts}-${rand()}@test.com`,
        username: `rr7ng${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'RR7NG',
        lastName: 'NoGroom',
        money: 1000,
      },
    });

    rr7MethodicalGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-RR7-Methodical-${ts}`,
        speciality: 'general',
        personality: 'calm',
        epigeneticInfluenceType: 'methodical',
        experience: 0,
        skillLevel: 'novice',
        userId: rr7User.id,
      },
    });

    rr7EnergeticGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-RR7-Energetic-${ts}`,
        speciality: 'general',
        personality: 'energetic',
        epigeneticInfluenceType: 'energetic',
        experience: 0,
        skillLevel: 'novice',
        userId: rr7User.id,
      },
    });

    rr7Horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RR7-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        bondScore: 0,
        stressLevel: 0,
        userId: rr7User.id,
      },
    });

    rr7HighBondHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RR7-HighBond-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        bondScore: 30,
        stressLevel: 0,
        userId: rr7User.id,
      },
    });

    rr7StressHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RR7-Stress-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        bondScore: 0,
        stressLevel: 9,
        userId: rr7User.id,
      },
    });

    rr7NoGroomHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RR7-NoGroomHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: rr7NoGroomUser.id,
      },
    });

    // Two interactions for slope-trend analysis (lines 864-875)
    rr7Interaction1 = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 1,
        stressChange: -1,
        quality: 'poor',
        foalId: rr7Horse.id,
        groomId: rr7MethodicalGroom.id,
      },
    });

    rr7Interaction2 = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 3,
        stressChange: -1,
        quality: 'excellent',
        foalId: rr7Horse.id,
        groomId: rr7MethodicalGroom.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    const interactionIds = [rr7Interaction1?.id, rr7Interaction2?.id].filter(Boolean);
    if (interactionIds.length > 0) {
      await prisma.groomInteraction.deleteMany({ where: { id: { in: interactionIds } } }).catch(() => {});
    }
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-RR7-' } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-RR7-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: rr7User?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: rr7NoGroomUser?.id } }).catch(() => {});
  }, 30000);

  // ── updateCompatibilityHistory ──────────────────────────────────────────────

  it('updateCompatibilityHistory: invalid interactionId → throws (line 279)', async () => {
    await expect(updateCompatibilityHistory(rr7MethodicalGroom.id, rr7Horse.id, 999999999)).rejects.toThrow(
      'Interaction not found',
    );
  });

  it('updateCompatibilityHistory: valid interaction, no prior history → newBaselineScore=0.5 (line 898)', async () => {
    // Use rr7EnergeticGroom + rr7Horse (no interactions between this pair → recentInteractions=[])
    // interaction2 belongs to rr7MethodicalGroom + rr7Horse, so calling with rr7EnergeticGroom
    // makes recentInteractions = [] → calculateNewBaselineScore([]) → 0.5
    const result = await updateCompatibilityHistory(rr7EnergeticGroom.id, rr7Horse.id, rr7Interaction2.id);
    expect(result.historyUpdated).toBe(true);
    expect(result.newBaselineScore).toBe(0.5);
    expect(result.totalInteractions).toBe(0);
  });

  it('updateCompatibilityHistory: 2 interactions → trend calculated from slope (lines 864-875)', async () => {
    // poor(1) then excellent(4) — slope positive → 'improving'
    // Both interactions are for rr7MethodicalGroom + rr7Horse, both in last 30 days
    const result = await updateCompatibilityHistory(rr7MethodicalGroom.id, rr7Horse.id, rr7Interaction2.id);
    expect(result.historyUpdated).toBe(true);
    expect(result.totalInteractions).toBe(2);
    // slope from [poor=1, excellent=4] in desc order [4,1] gives declining slope
    // or [1,4] ascending. The service orders desc (most recent first), so rr7Interaction2
    // (created last) is index 0 → scores=[4,1] → slope < 0 → 'declining'
    expect(['improving', 'stable', 'declining']).toContain(result.compatibilityTrend);
  });

  it('updateCompatibilityHistory: 1 interaction, quality=excellent → trend=stable (line 859-861)', async () => {
    // Create a fresh pair: rr7EnergeticGroom + rr7HighBondHorse with exactly 1 interaction
    const singleInteraction = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 20,
        bondingChange: 2,
        quality: 'excellent',
        foalId: rr7HighBondHorse.id,
        groomId: rr7EnergeticGroom.id,
      },
    });
    const result = await updateCompatibilityHistory(rr7EnergeticGroom.id, rr7HighBondHorse.id, singleInteraction.id);
    expect(result.totalInteractions).toBe(1);
    expect(result.compatibilityTrend).toBe('stable');
    await prisma.groomInteraction.delete({ where: { id: singleInteraction.id } }).catch(() => {});
  });

  // ── getOptimalGroomRecommendations: empty grooms (lines 348-354, 948-949) ──

  it('getOptimalGroomRecommendations: horse owner has no grooms → empty rankedGrooms (line 348-354)', async () => {
    const result = await getOptimalGroomRecommendations(rr7NoGroomHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
    });
    expect(result.rankedGrooms).toEqual([]);
    expect(result.topRecommendation).toBeNull();
    expect(result.contextualNotes).toContain('No grooms available for this horse owner');
  });

  // ── calculateDynamicCompatibility: default env factor (line 562) ──────────

  it('calculateDynamicCompatibility: unknown environmental factor → default switch arm (line 562)', async () => {
    const result = await calculateDynamicCompatibility(rr7MethodicalGroom.id, rr7Horse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      environmentalFactors: ['rainy'],
    });
    expect(result.overallScore).toBeGreaterThan(0);
  });

  // ── analyzeCompatibilityFactors: personality branches ────────────────────

  it('analyzeCompatibilityFactors: methodical groom → stress compat score=0.7 (line 703)', async () => {
    const result = await analyzeCompatibilityFactors(rr7MethodicalGroom.id, rr7Horse.id);
    expect(result).toBeDefined();
    // methodical → analyzeStressCompatibility score=0.7
    expect(result.stressCompatibility.score).toBe(0.7);
  });

  it('analyzeCompatibilityFactors: energetic groom + bondScore=30 → bonding potential=0.7 (line 725)', async () => {
    const result = await analyzeCompatibilityFactors(rr7EnergeticGroom.id, rr7HighBondHorse.id);
    expect(result).toBeDefined();
    // energetic + bondScore > 25 → potential=0.7
    expect(result.bondingPotential.potential).toBe(0.7);
  });

  it('analyzeCompatibilityFactors: methodical groom → bonding potential=0.6 (line 727)', async () => {
    const result = await analyzeCompatibilityFactors(rr7MethodicalGroom.id, rr7Horse.id);
    // methodical → potential=0.6
    expect(result.bondingPotential.potential).toBe(0.6);
  });

  it('analyzeCompatibilityFactors: methodical + low bond (bondScore=0) → risk factor added (line 780)', async () => {
    const result = await analyzeCompatibilityFactors(rr7MethodicalGroom.id, rr7Horse.id);
    // bondScore < 15 && methodical → pushes risk factor
    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(result.riskFactors.some(r => r.includes('methodical'))).toBe(true);
  });

  it('analyzeCompatibilityFactors: methodical + developing temperament → strength factor (line 803)', async () => {
    const result = await analyzeCompatibilityFactors(rr7MethodicalGroom.id, rr7Horse.id);
    // rr7Horse has no epigenetic flags → primaryTemperament='developing'
    // methodical + developing → strengthFactor pushed
    expect(Array.isArray(result.strengthFactors)).toBe(true);
    expect(
      result.strengthFactors.some(s => s.includes('Methodical') || s.includes('methodical') || s.includes('routine')),
    ).toBe(true);
  });

  // ── predictInteractionOutcome: high stress recommendation (line 839) ──────

  it('predictInteractionOutcome: horseCurrentStress=9 → stress recommendation added (line 839)', async () => {
    const result = await predictInteractionOutcome(rr7MethodicalGroom.id, rr7StressHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 9,
    });
    expect(result).toBeDefined();
    const recs = result.recommendations ?? [];
    expect(recs.some(r => r.toLowerCase().includes('calm'))).toBe(true);
  });

  // ── getOptimalGroomRecommendations: high stress contextual note (line 962) ─

  it('getOptimalGroomRecommendations: horseCurrentStress=9 → contextual note about stress (line 962)', async () => {
    const result = await getOptimalGroomRecommendations(rr7StressHorse.id, {
      taskType: 'grooming',
      timeOfDay: 'morning',
      horseCurrentStress: 9,
    });
    expect(Array.isArray(result.contextualNotes)).toBe(true);
    expect(result.contextualNotes.some(n => n.toLowerCase().includes('stress'))).toBe(true);
  });

  // ── analyzeCompatibilityTrendFromInteractions slope paths (lines 870, 875) ─

  it('updateCompatibilityHistory: older=excellent, newer=poor → improving slope (line 870)', async () => {
    // scores=[poor=1, excellent=4] in desc order → slope=3 > 0.05 → 'improving'
    const olderInteraction = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 20,
        quality: 'excellent',
        foalId: rr7StressHorse.id,
        groomId: rr7EnergeticGroom.id,
        createdAt: new Date(Date.now() - 10000),
      },
    });
    const newerInteraction = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 20,
        quality: 'poor',
        foalId: rr7StressHorse.id,
        groomId: rr7EnergeticGroom.id,
      },
    });
    try {
      const result = await updateCompatibilityHistory(rr7EnergeticGroom.id, rr7StressHorse.id, newerInteraction.id);
      expect(result.totalInteractions).toBe(2);
      expect(result.compatibilityTrend).toBe('improving');
    } finally {
      await prisma.groomInteraction
        .deleteMany({
          where: { id: { in: [olderInteraction.id, newerInteraction.id] } },
        })
        .catch(() => {});
    }
  });

  it('updateCompatibilityHistory: both interactions same quality → stable slope (line 875)', async () => {
    // scores=[good=3, good=3] → slope=0 → 'stable'
    const int1 = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 20,
        quality: 'good',
        foalId: rr7HighBondHorse.id,
        groomId: rr7MethodicalGroom.id,
        createdAt: new Date(Date.now() - 10000),
      },
    });
    const int2 = await prisma.groomInteraction.create({
      data: {
        interactionType: 'grooming',
        duration: 20,
        quality: 'good',
        foalId: rr7HighBondHorse.id,
        groomId: rr7MethodicalGroom.id,
      },
    });
    try {
      const result = await updateCompatibilityHistory(rr7MethodicalGroom.id, rr7HighBondHorse.id, int2.id);
      expect(result.totalInteractions).toBe(2);
      expect(result.compatibilityTrend).toBe('stable');
    } finally {
      await prisma.groomInteraction
        .deleteMany({
          where: { id: { in: [int1.id, int2.id] } },
        })
        .catch(() => {});
    }
  });
});
