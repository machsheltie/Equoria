/**
 * environmentalTriggerSystem + traitTimelineService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal (age 0, no interactions).
 * Zero-interaction paths exercise the empty-data branches.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  detectEnvironmentalTriggers,
  calculateTriggerThresholds,
  evaluateTraitExpressionProbability,
  processSeasonalTriggers,
  analyzeStressEnvironmentTriggers,
  trackCumulativeExposure,
  assessCriticalPeriodSensitivity,
  generateEnvironmentalReport,
} from '../../labs/services/environmentalTriggerSystem.mjs';
import { generateTraitTimeline, getTraitTimelineSummary } from '../../../services/traitTimelineService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `envtrigger-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `envtrigger${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EnvTrigger',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnvTriggerHorse-${Date.now()}`,
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

// ── environmentalTriggerSystem ────────────────────────────────────────────────

describe('detectEnvironmentalTriggers', () => {
  it('returns empty trigger set for horse with no interactions', async () => {
    const result = await detectEnvironmentalTriggers(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.detectedTriggers)).toBe(true);
    expect(result.detectedTriggers).toHaveLength(0);
    expect(result.triggerStrength).toBe(0);
    expect(result.interactionCount).toBe(0);
    expect(Array.isArray(result.environmentalFactors)).toBe(true);
    expect(result.analysisWindow).toBe(30);
  });
});

describe('calculateTriggerThresholds', () => {
  it('throws for non-existent horse', async () => {
    await expect(calculateTriggerThresholds(999999999)).rejects.toThrow();
  });

  it('returns threshold shape for newborn foal', async () => {
    const result = await calculateTriggerThresholds(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.baseThreshold).toBe('number');
    expect(typeof result.ageInDays).toBe('number');
    expect(typeof result.finalThreshold).toBe('number');
    expect(typeof result.sensitivity).toBe('number');
    expect(result.finalThreshold).toBeGreaterThanOrEqual(0.1);
    expect(result.finalThreshold).toBeLessThanOrEqual(1.0);
  });

  it('newborn has high sensitivity (finalThreshold < 0.5)', async () => {
    const result = await calculateTriggerThresholds(horse.id);
    expect(result.finalThreshold).toBeLessThan(0.5);
  });
});

describe('evaluateTraitExpressionProbability', () => {
  it('returns probability shape for brave trait', async () => {
    const result = await evaluateTraitExpressionProbability(horse.id, 'brave');
    expect(result.horseId).toBe(horse.id);
    expect(result.traitName).toBe('brave');
    expect(typeof result.baseProbability).toBe('number');
    expect(typeof result.finalProbability).toBe('number');
    expect(typeof result.expressionLikelihood).toBe('string');
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
    expect(result.finalProbability).toBeLessThanOrEqual(1);
    expect(result.analysisTimestamp).toBeInstanceOf(Date);
  });

  it('returns probability shape for fearful trait', async () => {
    const result = await evaluateTraitExpressionProbability(horse.id, 'fearful');
    expect(typeof result.expressionLikelihood).toBe('string');
    expect(Array.isArray(result.relevantTriggers)).toBe(true);
  });
});

describe('processSeasonalTriggers', () => {
  it('throws for invalid season', async () => {
    await expect(processSeasonalTriggers(horse.id, 'notaseason')).rejects.toThrow();
  });

  it('returns seasonal shape for spring', async () => {
    const result = await processSeasonalTriggers(horse.id, 'spring');
    expect(result.horseId).toBe(horse.id);
    expect(result.season).toBe('spring');
    expect(Array.isArray(result.seasonalFactors)).toBe(true);
    expect(typeof result.seasonalInfluence).toBe('object');
    expect(result.analysisTimestamp).toBeInstanceOf(Date);
  });
});

describe('analyzeStressEnvironmentTriggers', () => {
  it('returns stress analysis for horse with no interactions', async () => {
    const result = await analyzeStressEnvironmentTriggers(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.stressLevel).toBe('number');
    expect(Array.isArray(result.stressTriggers)).toBe(true);
    expect(result.stressTriggers).toHaveLength(0);
    expect(result.triggerIntensity).toBe(0);
    expect(result.stressfulInteractionCount).toBe(0);
    expect(Array.isArray(result.recommendedInterventions)).toBe(true);
  });
});

describe('trackCumulativeExposure', () => {
  it('returns zero exposure for horse with no interactions', async () => {
    const result = await trackCumulativeExposure(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(result.totalExposure).toBe(0);
    expect(typeof result.exposureByType).toBe('object');
    expect(Array.isArray(result.exposureTimeline)).toBe(true);
    expect(result.exposureTimeline).toHaveLength(0);
  });
});

describe('assessCriticalPeriodSensitivity', () => {
  it('returns sensitivity analysis for newborn foal', async () => {
    const result = await assessCriticalPeriodSensitivity(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.currentAge).toBe('number');
    expect(Array.isArray(result.criticalPeriods)).toBe(true);
    expect(Array.isArray(result.activeWindows)).toBe(true);
    expect(typeof result.sensitivityLevel).toBe('number');
    expect(result.sensitivityLevel).toBeGreaterThanOrEqual(0);
    expect(result.sensitivityLevel).toBeLessThanOrEqual(1);
    expect(result.analysisTimestamp).toBeInstanceOf(Date);
  });

  it('newborn has active critical periods', async () => {
    const result = await assessCriticalPeriodSensitivity(horse.id);
    expect(result.activeWindows.length).toBeGreaterThan(0);
    expect(result.sensitivityLevel).toBeGreaterThan(0);
  });
});

describe('generateEnvironmentalReport', () => {
  it('returns comprehensive report for newborn foal', async () => {
    const result = await generateEnvironmentalReport(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.environmentalTriggers).toBe('object');
    expect(typeof result.triggerThresholds).toBe('object');
    expect(Array.isArray(result.traitExpressionProbabilities)).toBe(true);
    expect(result.traitExpressionProbabilities.length).toBeGreaterThan(0);
    expect(typeof result.cumulativeExposure).toBe('object');
    expect(typeof result.criticalPeriodSensitivity).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.reportTimestamp).toBeInstanceOf(Date);
  });
});

// ── traitTimelineService ──────────────────────────────────────────────────────

describe('generateTraitTimeline', () => {
  it('returns empty timeline for newborn with no trait history', async () => {
    const result = await generateTraitTimeline(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.timelineEvents)).toBe(true);
    expect(result.timelineEvents).toHaveLength(0);
    expect(result.isEmpty).toBe(true);
    expect(typeof result.summary).toBe('object');
    expect(typeof result.bondStressTrend).toBe('object');
    expect(Array.isArray(result.excludedTraits)).toBe(true);
    expect(result.generatedAt).toBeInstanceOf(Date);
  });
});

describe('getTraitTimelineSummary', () => {
  it('returns no-development summary for horse with no traits', async () => {
    const result = await getTraitTimelineSummary(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(result.hasTraits).toBe(false);
    expect(result.developmentQuality).toBe('no_development');
    expect(typeof result.totalTraits).toBe('number');
    expect(result.totalTraits).toBe(0);
  });
});

// ── calculateTriggerThresholds / evaluateTraitExpressionProbability /
//    assessCriticalPeriodSensitivity — age-bracket + residual-sensitivity
//    branches (Equoria-jkht) ────────────────────────────────────────────────────
//
// calculateTriggerThresholds ageModifier tiers:
//   <= 7  → 0.6  (covered by newborn fixture above)
//   <= 30 → 0.7  ← horse10d
//   <= 90 → 0.8  ← horse60d
//   > 90  → 1.0  ← horse100d
//
// evaluateTraitExpressionProbability ageModifier tiers:
//   <= 30 → 1.5  (covered by newborn fixture above)
//   <= 90 → 1.2  ← horse60d
//   > 90  → 0.8  ← horse100d (finalP≈0.08 → 'very_unlikely')
//
// assessCriticalPeriodSensitivity residual sensitivity:
//   daysSinceLastPeriod < 30  → 0.3  ← horse125d (125-120=5)
//   daysSinceLastPeriod >= 30 → 0.1  ← horse160d (160-120=40)

describe('age-bracket + residual-sensitivity branches (Equoria-jkht)', () => {
  let ageUser;
  let horse10d;
  let horse60d;
  let horse100d;
  let horse125d;
  let horse160d;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ageUser = await prisma.user.create({
      data: {
        email: `et-ageb-${ts}-${rand()}@test.com`,
        username: `etageb${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ET',
        lastName: 'AgeBranch',
        money: 1000,
      },
    });

    const makeHorse = (name, daysAgo) =>
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name,
          sex: 'Filly',
          dateOfBirth: new Date(ts - daysAgo * 24 * 60 * 60 * 1000),
          age: 0,
          userId: ageUser.id,
        },
      });

    [horse10d, horse60d, horse100d, horse125d, horse160d] = await Promise.all([
      makeHorse(`TestFixture-ET-Age10-${ts}`, 10),
      makeHorse(`TestFixture-ET-Age60-${ts}`, 60),
      makeHorse(`TestFixture-ET-Age100-${ts}`, 100),
      makeHorse(`TestFixture-ET-Age125-${ts}`, 125),
      makeHorse(`TestFixture-ET-Age160-${ts}`, 160),
    ]);
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ET-Age' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: ageUser.id } }).catch(() => {});
  }, 30000);

  // ── calculateTriggerThresholds ageModifier ──────────────────────────────────

  it('calculateTriggerThresholds: ageModifier=0.7 for horse 10 days old (8-30d bracket)', async () => {
    const result = await calculateTriggerThresholds(horse10d.id);
    expect(result.ageModifier).toBe(0.7);
    expect(result.ageInDays).toBeGreaterThanOrEqual(9);
    expect(result.ageInDays).toBeLessThanOrEqual(11);
  });

  it('calculateTriggerThresholds: ageModifier=0.8 for horse 60 days old (31-90d bracket)', async () => {
    const result = await calculateTriggerThresholds(horse60d.id);
    expect(result.ageModifier).toBe(0.8);
  });

  it('calculateTriggerThresholds: ageModifier=1.0 for horse 100 days old (>90d bracket)', async () => {
    const result = await calculateTriggerThresholds(horse100d.id);
    expect(result.ageModifier).toBe(1.0);
  });

  // ── evaluateTraitExpressionProbability ageModifier + expressionLikelihood ───

  it('evaluateTraitExpressionProbability: ageModifier=1.2 for horse 60 days old (31-90d)', async () => {
    const result = await evaluateTraitExpressionProbability(horse60d.id, 'calm');
    expect(result.ageModifier).toBe(1.2);
  });

  it('evaluateTraitExpressionProbability: ageModifier=0.8 for horse 100 days old (>90d)', async () => {
    const result = await evaluateTraitExpressionProbability(horse100d.id, 'patient');
    expect(result.ageModifier).toBe(0.8);
  });

  it('expressionLikelihood=unlikely for horse 60d with calm trait (finalP≈0.12)', async () => {
    // stressLevel=0: stressModifier=Math.max(0.5, 1.0-0/30)=1.0; no interactions → envModifier=1.0
    // finalP = 0.1 * 1.0 * 1.2 * 1.0 = 0.12 → 0.1 ≤ 0.12 < 0.3 → 'unlikely'
    const result = await evaluateTraitExpressionProbability(horse60d.id, 'calm');
    expect(result.expressionLikelihood).toBe('unlikely');
  });

  it('expressionLikelihood=very_unlikely for horse 100d with neutral trait (finalP≈0.08)', async () => {
    // 'patient' is not in negativeTraits or positiveTraits → stressModifier=1.0
    // finalP = 0.1 * 1.0 * 0.8 * 1.0 = 0.08 → < 0.1 → 'very_unlikely'
    const result = await evaluateTraitExpressionProbability(horse100d.id, 'patient');
    expect(result.expressionLikelihood).toBe('very_unlikely');
  });

  // ── assessCriticalPeriodSensitivity residual sensitivity ────────────────────

  it('sensitivityLevel=0.3 when daysSinceLastPeriod=5 (horse 125 days old)', async () => {
    // independence_development ends at day 120; 125-120=5 < 30 → 0.3
    const result = await assessCriticalPeriodSensitivity(horse125d.id);
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.3);
  });

  it('sensitivityLevel=0.1 when daysSinceLastPeriod=40 (horse 160 days old)', async () => {
    // independence_development ends at day 120; 160-120=40 ≥ 30 → 0.1
    const result = await assessCriticalPeriodSensitivity(horse160d.id);
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.1);
  });
});

// ── analyzeStressEnvironmentTriggers — stressful interactions (Equoria-jkht) ──
// Creates a horse with stressLevel=8 plus 4 groomInteractions:
//   taskType='bathing':  stressChange=4,4 → avgStress=4 > 3  → severity='high'
//   taskType='feeding':  stressChange=2,3 → avgStress=2.5 > 2 → severity='moderate'
// Covers:
//   • interactions.length > 0 path in analyzeStressEnvironmentTriggers
//   • avgStress > 3 → severity='high'
//   • 2 < avgStress ≤ 3 → severity='moderate'
//   • stressLevel > 7 → extra interventions in generateStressInterventions
//   • severity='high' → "Avoid..." intervention
//   • else → "Use extra caution..." intervention
//   • trackCumulativeExposure non-empty path + calculateInteractionExposure stressChange>2 branch

describe('analyzeStressEnvironmentTriggers — stressful interactions (Equoria-jkht)', () => {
  let stressUser;
  let stressGroom;
  let stressHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    stressUser = await prisma.user.create({
      data: {
        email: `et-str-${ts}-${rand()}@test.com`,
        username: `etstr${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ET',
        lastName: 'StressB',
        money: 1000,
      },
    });

    stressGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-ET-StrGroom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: stressUser.id,
        isActive: true,
      },
    });

    stressHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-ET-StrHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: stressUser.id,
        stressLevel: 8,
      },
    });

    // 2 bathing interactions: stressChange=4 each → avgStress=4 > 3 → severity='high'
    for (let i = 0; i < 2; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: stressHorse.id,
          groomId: stressGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 0,
          stressChange: 4,
          quality: 'poor',
          taskType: 'bathing',
          createdAt: new Date(ts - (i + 1) * 60000),
          timestamp: new Date(ts - (i + 1) * 60000),
        },
      });
    }

    // 2 feeding interactions: stressChange=2 and stressChange=3 → avgStress=2.5 → severity='moderate'
    await prisma.groomInteraction.create({
      data: {
        foalId: stressHorse.id,
        groomId: stressGroom.id,
        interactionType: 'daily_care',
        duration: 20,
        bondingChange: 0,
        stressChange: 2,
        quality: 'fair',
        taskType: 'feeding',
        createdAt: new Date(ts - 3 * 60000),
        timestamp: new Date(ts - 3 * 60000),
      },
    });
    await prisma.groomInteraction.create({
      data: {
        foalId: stressHorse.id,
        groomId: stressGroom.id,
        interactionType: 'daily_care',
        duration: 20,
        bondingChange: 0,
        stressChange: 3,
        quality: 'fair',
        taskType: 'feeding',
        createdAt: new Date(ts - 4 * 60000),
        timestamp: new Date(ts - 4 * 60000),
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: stressHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: stressHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: stressGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: stressUser.id } }).catch(() => {});
  }, 30000);

  it('stressfulInteractionCount=4 (all 4 have stressChange > 0)', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    expect(result.stressfulInteractionCount).toBe(4);
    expect(result.triggerIntensity).toBeGreaterThan(0);
  });

  it('stressTriggers includes severity=high for bathing (avgStress=4 > 3)', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    const highTrigger = result.stressTriggers.find(t => t.trigger === 'bathing');
    expect(highTrigger).toBeDefined();
    expect(highTrigger.severity).toBe('high');
    expect(highTrigger.averageStressIncrease).toBe(4);
  });

  it('stressTriggers includes severity=moderate for feeding (avgStress=2.5)', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    const moderateTrigger = result.stressTriggers.find(t => t.trigger === 'feeding');
    expect(moderateTrigger).toBeDefined();
    expect(moderateTrigger.severity).toBe('moderate');
    expect(moderateTrigger.averageStressIncrease).toBe(2.5);
  });

  it('recommendedInterventions includes immediate-stress-reduction when stressLevel=8 (> 7)', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    expect(result.recommendedInterventions.some(r => r.includes('Immediate stress reduction'))).toBe(true);
  });

  it('recommendedInterventions includes Avoid message for high-severity bathing trigger', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    expect(result.recommendedInterventions.some(r => r.includes('Avoid bathing'))).toBe(true);
  });

  it('recommendedInterventions includes extra-caution message for moderate feeding trigger', async () => {
    const result = await analyzeStressEnvironmentTriggers(stressHorse.id);
    expect(result.recommendedInterventions.some(r => r.includes('extra caution with feeding'))).toBe(true);
  });

  it('trackCumulativeExposure returns non-zero exposure for horse with 4 interactions', async () => {
    const result = await trackCumulativeExposure(stressHorse.id);
    expect(result.totalExposure).toBeGreaterThan(0);
    expect(result.exposureTimeline).toHaveLength(4);
    expect(Object.keys(result.exposureByType).length).toBeGreaterThan(0);
  });
});
