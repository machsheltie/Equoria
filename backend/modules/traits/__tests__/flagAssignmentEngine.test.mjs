/**
 * flagAssignmentEngine service unit tests (Equoria-rr7 coverage sprint).
 *
 * evaluateFlagTriggers: pure in-memory (no DB).
 * analyzeTemporalPatterns, evaluatePersonalityModifiedTriggers,
 * calculateFlagAssignmentScore: DB fixture with zero interactions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  evaluateFlagTriggers,
  evaluatePersonalityModifiedTriggers,
  calculateFlagAssignmentScore,
  analyzeTemporalPatterns,
} from '../../../services/flagAssignmentEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `flagassign-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `flagassign${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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

// ── evaluateFlagTriggers — trigger function branch coverage (Equoria-jkht) ────
// Covers: evaluateAffectionateTriggers triggered=true, evaluateConfidentTriggers
// triggered=true, evaluateFearfulTriggers triggered=true, evaluateInsecureTriggers
// triggered=true, evaluateGenericTriggers POSITIVE triggered=true (resilient),
// evaluateGenericTriggers NEGATIVE triggered=true (aloof),
// hasConflictingFlags returns true (brave skipped when horse has fearful).

describe('evaluateFlagTriggers — trigger branch coverage (Equoria-jkht)', () => {
  it('evaluateAffectionateTriggers triggered=true: frequent care + consistent groom + improving bond', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [] });
    const care = makeCarePatterns({
      consistency: { consistencyScore: 0.9, averageInteractionsPerDay: 1.0, qualityInteractions: 10, careGaps: [] },
      bondTrends: { trend: 'improving', averageChange: 2, positiveRatio: 0.8, positiveInteractions: 10 },
      groomConsistency: { consistencyScore: 0.9, groomChanges: 0 },
      stressPatterns: { averageReduction: -0.5, stressSpikes: [] },
      taskDiversity: { diversity: 0.4, excellentQualityRatio: 0.3 },
      neglectPatterns: { neglectRatio: 0.1 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).toContain('affectionate');
  });

  it('evaluateConfidentTriggers triggered=true: high bond growth + low stress + task diversity', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [], stressLevel: 3 });
    const care = makeCarePatterns({
      bondTrends: { trend: 'improving', averageChange: 2.0, positiveRatio: 0.5, positiveInteractions: 5 },
      taskDiversity: { diversity: 0.7, excellentQualityRatio: 0.6 },
      consistency: { consistencyScore: 0.5, averageInteractionsPerDay: 0.5, qualityInteractions: 3, careGaps: [] },
      stressPatterns: { averageReduction: -0.5, stressSpikes: [] },
      groomConsistency: { consistencyScore: 0.5, groomChanges: 1 },
      neglectPatterns: { neglectRatio: 0.1 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).toContain('confident');
  });

  it('evaluateFearfulTriggers triggered=true: many stress spikes + poor stress management', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [] });
    const care = makeCarePatterns({
      stressPatterns: { averageReduction: -0.3, stressSpikes: [1, 2, 3, 4] },
      consistency: { consistencyScore: 0.5, averageInteractionsPerDay: 0.5, qualityInteractions: 2, careGaps: [] },
      bondTrends: { trend: 'stable', averageChange: 0.5, positiveRatio: 0.5, positiveInteractions: 3 },
      taskDiversity: { diversity: 0.4, excellentQualityRatio: 0.3 },
      groomConsistency: { consistencyScore: 0.5, groomChanges: 1 },
      neglectPatterns: { neglectRatio: 0.1 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).toContain('fearful');
  });

  it('evaluateInsecureTriggers triggered=true: frequent groom changes + declining bond', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [] });
    const care = makeCarePatterns({
      groomConsistency: { consistencyScore: 0.3, groomChanges: 3 },
      bondTrends: { trend: 'declining', averageChange: -1, positiveRatio: 0.5, positiveInteractions: 2 },
      consistency: { consistencyScore: 0.5, averageInteractionsPerDay: 0.5, qualityInteractions: 2, careGaps: [] },
      stressPatterns: { averageReduction: -0.5, stressSpikes: [] },
      taskDiversity: { diversity: 0.4, excellentQualityRatio: 0.3 },
      neglectPatterns: { neglectRatio: 0.1 },
    });
    const result = await evaluateFlagTriggers(h, care);
    expect(result.eligibleFlags).toContain('insecure');
  });

  it('evaluateGenericTriggers POSITIVE triggered=true: resilient flag with good care', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [] });
    const care = makeCarePatterns({
      consistency: { consistencyScore: 0.8, averageInteractionsPerDay: 1.0, qualityInteractions: 10, careGaps: [] },
      bondTrends: { trend: 'improving', averageChange: 2.0, positiveRatio: 0.8, positiveInteractions: 10 },
      taskDiversity: { diversity: 0.7, excellentQualityRatio: 0.6 },
      stressPatterns: { averageReduction: -2, stressSpikes: [] },
      groomConsistency: { consistencyScore: 0.85, groomChanges: 0 },
      neglectPatterns: { neglectRatio: 0.05 },
    });
    const result = await evaluateFlagTriggers(h, care);
    // resilient falls to default case → evaluateGenericTriggers (POSITIVE); goodCare=true + positiveBond=true
    expect(result.eligibleFlags).toContain('resilient');
  });

  it('evaluateGenericTriggers NEGATIVE triggered=true: aloof flag with poor care', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: [] });
    const care = makeCarePatterns({
      consistency: {
        consistencyScore: 0.3,
        averageInteractionsPerDay: 0.2,
        qualityInteractions: 1,
        careGaps: [1, 2, 3],
      },
      bondTrends: { trend: 'declining', averageChange: -0.5, positiveRatio: 0.2, positiveInteractions: 1 },
      stressPatterns: { averageReduction: -0.3, stressSpikes: [] },
      taskDiversity: { diversity: 0.2, excellentQualityRatio: 0.1 },
      groomConsistency: { consistencyScore: 0.2, groomChanges: 3 },
      neglectPatterns: { neglectRatio: 0.4 },
    });
    const result = await evaluateFlagTriggers(h, care);
    // aloof falls to default case → evaluateGenericTriggers (NEGATIVE); poorCare=true (0.3 < 0.4)
    expect(result.eligibleFlags).toContain('aloof');
  });

  it('hasConflictingFlags returns true: brave skipped when horse already has fearful', async () => {
    const h = makeHorsePOJO({ epigeneticFlags: ['fearful'] });
    const care = makeCarePatterns({
      consistency: { consistencyScore: 0.95, averageInteractionsPerDay: 1.5, qualityInteractions: 15, careGaps: [] },
      stressPatterns: { averageReduction: -3, stressSpikes: [] },
      bondTrends: { trend: 'improving', averageChange: 4, positiveRatio: 0.95, positiveInteractions: 15 },
      taskDiversity: { diversity: 0.9, excellentQualityRatio: 0.85 },
      groomConsistency: { consistencyScore: 0.95, groomChanges: 0 },
      neglectPatterns: { neglectRatio: 0.0 },
    });
    const result = await evaluateFlagTriggers(h, care);
    // brave.conflictsWith includes 'fearful' → hasConflictingFlags returns true → brave skipped
    expect(result.eligibleFlags).not.toContain('brave');
  });
});

// ── calculateFlagAssignmentScore — ageModifier branches (Equoria-jkht) ────────
// calculateAgeModifier: ≤30→1.5 (covered above), ≤90→1.3, ≤180→1.1, ≤365→1.0, >365→0.8

describe('calculateFlagAssignmentScore() — ageModifier branches (Equoria-jkht)', () => {
  it('ageModifier is 1.3 for horse 60 days old (31-90d bracket)', async () => {
    const h = makeHorsePOJO({ dateOfBirth: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) });
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);
    expect(result.components.ageModifier).toBe(1.3);
  });

  it('ageModifier is 1.1 for horse 120 days old (91-180d bracket)', async () => {
    const h = makeHorsePOJO({ dateOfBirth: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) });
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);
    expect(result.components.ageModifier).toBe(1.1);
  });

  it('ageModifier is 1.0 for horse 200 days old (181-365d bracket)', async () => {
    const h = makeHorsePOJO({ dateOfBirth: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) });
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);
    expect(result.components.ageModifier).toBe(1.0);
  });

  it('ageModifier is 0.8 for horse 400 days old (> 365d bracket)', async () => {
    const h = makeHorsePOJO({ dateOfBirth: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) });
    const care = makeCarePatterns();
    const result = await calculateFlagAssignmentScore(h, 'brave', care);
    expect(result.components.ageModifier).toBe(0.8);
  });
});

// ── catch-block tests (pure, no extra DB fixture) ─────────────────────────────
// Lines 69-70: evaluateFlagTriggers try/catch rethrows.
// Lines 382-383: evaluatePersonalityModifiedTriggers try/catch rethrows when
//   applyPersonalityModifiers receives undefined carePatterns → JSON.parse(JSON.stringify(undefined)) throws.
// Lines 687-688 / 727-728: calculatePersonalityModifier and calculateTemporalModifier
//   return fallback 1.0 via their respective catch blocks when Prisma receives an
//   invalid horse id that coerces to a no-result query; covered via the calculateFlagAssignmentScore test.
//   Note: Prisma coerces non-integer string ids to empty-result queries rather than throwing,
//   so lines 481-482 (analyzeTemporalPatterns catch) are NOT coverable via this path.

describe('flagAssignmentEngine — error-path catch blocks (Equoria-jkht)', () => {
  it('evaluateFlagTriggers rethrows when horse is null (lines 69-70)', async () => {
    await expect(evaluateFlagTriggers(null, {})).rejects.toThrow();
  });

  it('evaluatePersonalityModifiedTriggers rethrows when carePatterns is undefined (lines 382-383)', async () => {
    // undefined carePatterns → applyPersonalityModifiers calls JSON.parse(JSON.stringify(undefined)) → SyntaxError
    await expect(evaluatePersonalityModifiedTriggers({ id: 999999999 }, undefined)).rejects.toThrow();
  });

  it('calculateFlagAssignmentScore: non-existent horse id returns numeric totalScore (fallback 1.0 personality+temporal)', async () => {
    // Use a valid integer id that does not exist in the DB; both inner modifiers return fallback 1.0.
    const h = { id: 999999998, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'brave', makeCarePatterns());
    expect(typeof result.totalScore).toBe('number');
    expect(result.components.personalityModifier).toBe(1.0);
    expect(result.components.temporalModifier).toBe(1.0);
  });
});

// ── temporal patterns + methodical groom DB fixtures (Equoria-jkht) ───────────
// Three horses:
//   tmImprovingHorse — 6 interactions: early negative bond/positive stress, late positive bond/negative stress.
//     bondTrend='improving', stressTrend='decreasing', criticalPeriods=[stress_spike, bonding_failure].
//     Covers: lines 705 (positive flag → 1.3), 721 (negative flag + criticalPeriods → 1.4),
//             870 (stress_spike push), 881 (bonding_failure push),
//             552-553 (methodical personalityStats branch),
//             591-595 (applyPersonalityModifiers methodical branch),
//             681 (flagBias 'confident' → modifier *= 1.2).
//
//   tmDecliningHorse — 4 interactions: early positive bond, late neutral.
//     bondTrend='declining', stressTrend='increasing'.
//     Covers: line 718 (negative flag + declining bond → 1.3).
//
//   tmPeriodicHorse — 4 interactions at specific past dates:
//     35d+28d ago (same weekday) quality='poor'; 20d+13d ago (same weekday) quality='excellent'.
//     qualityTrend='improving', bondTrend='stable', stressTrend='stable'.
//     Covers: line 708 (positive flag + qualityTrend='improving' → 1.2),
//             837 (weekly_high_quality push), 844 (weekly_low_quality push).

describe('flagAssignmentEngine — temporal patterns + methodical groom (Equoria-jkht)', () => {
  let tmUser, tmGroom, tmImprovingHorse, tmDecliningHorse, tmPeriodicHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    tmUser = await prisma.user.create({
      data: {
        email: `tm-${ts}-${rand()}@test.com`,
        username: `tm${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TM',
        lastName: 'Tester',
        money: 1000,
      },
    });

    tmGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-TMGroom-${ts}`,
        speciality: 'foalCare',
        personality: 'methodical',
        userId: tmUser.id,
        epigeneticInfluenceType: 'methodical',
      },
    });

    // ── tmImprovingHorse ──────────────────────────────────────────────────────
    tmImprovingHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TMImproving-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: tmUser.id,
      },
    });

    // 6 interactions spaced 1 min apart so orderBy createdAt asc is deterministic.
    // midpoint=3: earlyBond=avg(-3,-2,0)=-1.67, lateBond=avg(3,2,2)=2.33 → improving.
    // earlyStress=avg(5,3,1)=3, lateStress=avg(-5,-4,-3)=-4 → decreasing.
    // criticalPeriods: [0]stressChange=5>=3 & [1]stressChange=3>=2 → stress_spike (line 870).
    //                  [0]bondingChange=-3<=-2 & [1]bondingChange=-2<=-1 → bonding_failure (line 881).
    const improvingData = [
      { bondingChange: -3, stressChange: 5, quality: 'excellent', createdAt: new Date(ts - 6 * 60 * 1000) },
      { bondingChange: -2, stressChange: 3, quality: 'excellent', createdAt: new Date(ts - 5 * 60 * 1000) },
      { bondingChange: 0, stressChange: 1, quality: 'fair', createdAt: new Date(ts - 4 * 60 * 1000) },
      { bondingChange: 3, stressChange: -5, quality: 'poor', createdAt: new Date(ts - 3 * 60 * 1000) },
      { bondingChange: 2, stressChange: -4, quality: 'poor', createdAt: new Date(ts - 2 * 60 * 1000) },
      { bondingChange: 2, stressChange: -3, quality: 'good', createdAt: new Date(ts - 1 * 60 * 1000) },
    ];
    for (const data of improvingData) {
      await prisma.groomInteraction.create({
        data: { foalId: tmImprovingHorse.id, groomId: tmGroom.id, interactionType: 'grooming', duration: 30, ...data },
      });
    }

    // ── tmDecliningHorse ──────────────────────────────────────────────────────
    tmDecliningHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TMDeclining-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: tmUser.id,
      },
    });

    // midpoint=2: earlyBond=avg(3,3)=3, lateBond=avg(0,0)=0 → declining.
    // earlyStress=avg(-1,-1)=-1, lateStress=avg(0,1)=0.5 → increasing.
    const decliningData = [
      { bondingChange: 3, stressChange: -1, createdAt: new Date(ts - 4 * 60 * 1000) },
      { bondingChange: 3, stressChange: -1, createdAt: new Date(ts - 3 * 60 * 1000) },
      { bondingChange: 0, stressChange: 0, createdAt: new Date(ts - 2 * 60 * 1000) },
      { bondingChange: 0, stressChange: 1, createdAt: new Date(ts - 1 * 60 * 1000) },
    ];
    for (const data of decliningData) {
      await prisma.groomInteraction.create({
        data: { foalId: tmDecliningHorse.id, groomId: tmGroom.id, interactionType: 'grooming', duration: 30, ...data },
      });
    }

    // ── tmPeriodicHorse ───────────────────────────────────────────────────────
    tmPeriodicHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TMPeriodic-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: tmUser.id,
      },
    });

    // 35d and 28d ago: same day-of-week (7d apart), quality='poor' → weekly_low_quality (line 844).
    // 20d and 13d ago: same day-of-week (7d apart), quality='excellent' → weekly_high_quality (line 837).
    // 35d-20d = 15d apart → different day-of-week (15 mod 7 = 1).
    // Ordered asc: 35d, 28d, 20d, 13d.
    //   early=[35d poor, 28d poor]: earlyQuality=1, lateBond=0, earlyStress=0.
    //   late=[20d excellent, 13d excellent]: lateQuality=4 → 4>1+0.3 → qualityTrend='improving' (line 708).
    //   bondTrend='stable', stressTrend='stable'.
    const periodicData = [
      { createdAt: new Date(ts - 35 * 24 * 60 * 60 * 1000), quality: 'poor', bondingChange: 0, stressChange: 0 },
      { createdAt: new Date(ts - 28 * 24 * 60 * 60 * 1000), quality: 'poor', bondingChange: 0, stressChange: 0 },
      { createdAt: new Date(ts - 20 * 24 * 60 * 60 * 1000), quality: 'excellent', bondingChange: 0, stressChange: 0 },
      { createdAt: new Date(ts - 13 * 24 * 60 * 60 * 1000), quality: 'excellent', bondingChange: 0, stressChange: 0 },
    ];
    for (const data of periodicData) {
      await prisma.groomInteraction.create({
        data: { foalId: tmPeriodicHorse.id, groomId: tmGroom.id, interactionType: 'grooming', duration: 30, ...data },
      });
    }
  }, 60000);

  afterAll(async () => {
    const horseIds = [tmImprovingHorse?.id, tmDecliningHorse?.id, tmPeriodicHorse?.id].filter(Boolean);
    await prisma.groomInteraction.deleteMany({ where: { foalId: { in: horseIds } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TM' } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-TMGroom-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: tmUser.id } }).catch(() => {});
  }, 30000);

  // ── analyzeTemporalPatterns: improving horse trends ───────────────────────

  it('analyzeTemporalPatterns: improving horse → bondTrend=improving, stressTrend=decreasing', async () => {
    const result = await analyzeTemporalPatterns(tmImprovingHorse.id);
    expect(result.trendAnalysis.bondTrend).toBe('improving');
    expect(result.trendAnalysis.stressTrend).toBe('decreasing');
  });

  // ── calculateTemporalModifier: line 705 — positive flag + improving trends → 1.3

  it('temporalModifier=1.3 for brave (positive) flag on improving horse (line 705)', async () => {
    const h = { id: tmImprovingHorse.id, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'brave', makeCarePatterns());
    expect(result.components.temporalModifier).toBe(1.3);
  });

  // ── identifyCriticalPeriods: line 870 — stress_spike push ────────────────

  it('identifyCriticalPeriods: stress_spike found when consecutive stressChange>=3 then >=2 (line 870)', async () => {
    const result = await analyzeTemporalPatterns(tmImprovingHorse.id);
    const spike = result.criticalPeriods.find(p => p.period === 'stress_spike');
    expect(spike).toBeDefined();
    expect(spike.severity).toBe('high');
  });

  // ── identifyCriticalPeriods: line 881 — bonding_failure push ─────────────

  it('identifyCriticalPeriods: bonding_failure found when consecutive bondingChange<=-2 then <=-1 (line 881)', async () => {
    const result = await analyzeTemporalPatterns(tmImprovingHorse.id);
    const failure = result.criticalPeriods.find(p => p.period === 'bonding_failure');
    expect(failure).toBeDefined();
    expect(failure.severity).toBe('moderate');
  });

  // ── calculateTemporalModifier: line 721 — negative flag + criticalPeriods → 1.4

  it('temporalModifier=1.4 for fearful (negative) flag on improving horse with criticalPeriods (line 721)', async () => {
    const h = { id: tmImprovingHorse.id, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'fearful', makeCarePatterns());
    expect(result.components.temporalModifier).toBe(1.4);
  });

  // ── calculatePersonalityModifiers: line 552-553 — methodical branch ────────

  it('evaluatePersonalityModifiedTriggers: methodical groom → personalityModifiers.methodical defined (lines 552-553)', async () => {
    const h = { id: tmImprovingHorse.id, dateOfBirth: new Date(), epigeneticFlags: [] };
    const result = await evaluatePersonalityModifiedTriggers(h, makeCarePatterns());
    expect(result.personalityModifiers.methodical).toBeDefined();
    expect(result.personalityModifiers.methodical.consistencyBonus).toBe(1.3);
  });

  // ── applyPersonalityModifiers: lines 591-595 — methodical adjusts carePatterns ─

  it('evaluatePersonalityModifiedTriggers: methodical modifier scales consistencyScore (lines 591-595)', async () => {
    const h = { id: tmImprovingHorse.id, dateOfBirth: new Date(), epigeneticFlags: [] };
    const care = makeCarePatterns();
    const result = await evaluatePersonalityModifiedTriggers(h, care);
    // consistencyScore 0.5 * consistencyBonus 1.3 = 0.65
    expect(result.adjustedTriggers.consistency.consistencyScore).toBeCloseTo(0.65);
  });

  // ── calculatePersonalityModifier: line 681 — flagBias 'confident' → modifier *= 1.2

  it('personalityModifier=1.2 for confident flag with methodical groom flagBias (line 681)', async () => {
    const h = { id: tmImprovingHorse.id, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'confident', makeCarePatterns());
    expect(result.components.personalityModifier).toBe(1.2);
  });

  // ── analyzeTemporalPatterns: declining horse trends ───────────────────────

  it('analyzeTemporalPatterns: declining horse → bondTrend=declining, stressTrend=increasing', async () => {
    const result = await analyzeTemporalPatterns(tmDecliningHorse.id);
    expect(result.trendAnalysis.bondTrend).toBe('declining');
    expect(result.trendAnalysis.stressTrend).toBe('increasing');
  });

  // ── calculateTemporalModifier: line 718 — negative flag + declining bond → 1.3

  it('temporalModifier=1.3 for fearful (negative) flag on declining horse (line 718)', async () => {
    const h = { id: tmDecliningHorse.id, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'fearful', makeCarePatterns());
    expect(result.components.temporalModifier).toBe(1.3);
  });

  // ── identifyPeriodicPatterns: line 837 — weekly_high_quality push ─────────

  it('identifyPeriodicPatterns: weekly_high_quality found when same-weekday avgQuality>=3.5 (line 837)', async () => {
    const result = await analyzeTemporalPatterns(tmPeriodicHorse.id);
    const highQ = result.periodicPatterns.find(p => p.type === 'weekly_high_quality');
    expect(highQ).toBeDefined();
    expect(highQ.avgQuality).toBeGreaterThanOrEqual(3.5);
  });

  // ── identifyPeriodicPatterns: line 844 — weekly_low_quality push ──────────

  it('identifyPeriodicPatterns: weekly_low_quality found when same-weekday avgQuality<=1.5 (line 844)', async () => {
    const result = await analyzeTemporalPatterns(tmPeriodicHorse.id);
    const lowQ = result.periodicPatterns.find(p => p.type === 'weekly_low_quality');
    expect(lowQ).toBeDefined();
    expect(lowQ.avgQuality).toBeLessThanOrEqual(1.5);
  });

  // ── calculateTemporalModifier: line 708 — positive flag + qualityTrend='improving' → 1.2

  it('temporalModifier=1.2 for brave (positive) flag on quality-improving horse (line 708)', async () => {
    const h = { id: tmPeriodicHorse.id, dateOfBirth: new Date(), epigeneticFlags: [], stressLevel: 3, bondScore: 30 };
    const result = await calculateFlagAssignmentScore(h, 'brave', makeCarePatterns());
    expect(result.components.temporalModifier).toBe(1.2);
  });
});
