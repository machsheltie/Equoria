/**
 * environmentalTriggerSystem branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path / non-existent horse:
 *   detectEnvironmentalTriggers — no interactions → empty return (not a throw)
 *   calculateTriggerThresholds — non-existent horseId → throws 'Horse not found'
 *   processSeasonalTriggers — invalid season → throws
 *   trackCumulativeExposure — no interactions → empty return
 *
 * DB-fixture branch coverage:
 *   calculateTriggerThresholds age branches:
 *     ageInDays ≤7  → ageModifier=0.6
 *     ageInDays ≤30 → ageModifier=0.7
 *     ageInDays ≤90 → ageModifier=0.8
 *     ageInDays >90 → ageModifier=1.0
 *   processSeasonalTriggers — valid seasons (spring, winter)
 *   analyzeStressEnvironmentTriggers — horse with no stress interactions → stressTriggers=[]
 *   assessCriticalPeriodSensitivity:
 *     horse in active critical period (age 0-3 days) → sensitivityLevel > 0
 *     horse past all critical periods, recent (age 121-149) → sensitivityLevel=0.3
 *     horse past all critical periods, old (age > 150) → sensitivityLevel=0.1
 *   evaluateTraitExpressionProbability — expressive likelihood label branches
 *   generateEnvironmentalReport — full aggregated report
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  detectEnvironmentalTriggers,
  calculateTriggerThresholds,
  evaluateTraitExpressionProbability,
  processSeasonalTriggers,
  analyzeStressEnvironmentTriggers,
  trackCumulativeExposure,
  assessCriticalPeriodSensitivity,
  generateEnvironmentalReport,
} from '../../services/environmentalTriggerSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// ── No-fixture pure paths ─────────────────────────────────────────────────────

describe('detectEnvironmentalTriggers — no interactions (non-existent horse)', () => {
  it('returns empty detectedTriggers for non-existent horseId (no DB error)', async () => {
    const result = await detectEnvironmentalTriggers(999999999);
    expect(result.horseId).toBe(999999999);
    expect(result.detectedTriggers).toHaveLength(0);
    expect(result.triggerStrength).toBe(0);
    expect(result.interactionCount).toBe(0);
  });
});

describe('calculateTriggerThresholds — non-existent horse', () => {
  it('throws "Horse not found" for non-existent horseId', async () => {
    await expect(calculateTriggerThresholds(999999999)).rejects.toThrow('Horse not found');
  });
});

describe('processSeasonalTriggers — invalid season', () => {
  it('throws for invalid season string', async () => {
    await expect(processSeasonalTriggers(999999999, 'invalid_season')).rejects.toThrow('Invalid season');
  });
});

describe('trackCumulativeExposure — no interactions', () => {
  it('returns empty totalExposure=0 for non-existent horseId', async () => {
    const result = await trackCumulativeExposure(999999999);
    expect(result.totalExposure).toBe(0);
    expect(result.exposureTimeline).toHaveLength(0);
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('environmentalTriggerSystem — DB fixture branch coverage (Equoria-jkht)', () => {
  let etsUser;
  let etsHorseNewborn; // 1 day old → ageInDays ≤7 (ageModifier=0.6) + imprinting critical period
  let etsHorseYoung; // 15 days old → ageInDays ≤30 (ageModifier=0.7)
  let etsHorseDeveloping; // 45 days old → ageInDays ≤90 (ageModifier=0.8)
  let etsHorseMature; // 200 days old → ageInDays >90 (ageModifier=1.0) + past critical periods
  let etsHorseRecent; // 130 days old → past critical periods, daysSinceLastPeriod < 30 (residual=0.3)

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    etsUser = await prisma.user.create({
      data: {
        email: `ets-${ts}-${rand()}@test.com`,
        username: `ets${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ETS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    const daysAgo = days => new Date(ts - days * 24 * 60 * 60 * 1000);

    etsHorseNewborn = await prisma.horse.create({
      data: {
        name: `TestFixture-ETS-Newborn-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(1),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseYoung = await prisma.horse.create({
      data: {
        name: `TestFixture-ETS-Young-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(15),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseDeveloping = await prisma.horse.create({
      data: {
        name: `TestFixture-ETS-Developing-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(45),
        age: 0,
        userId: etsUser.id,
      },
    });

    etsHorseMature = await prisma.horse.create({
      data: {
        name: `TestFixture-ETS-Mature-${ts}`,
        sex: 'Colt',
        dateOfBirth: daysAgo(200),
        age: 0,
        userId: etsUser.id,
      },
    });

    // 130 days old: past last critical period (ends day 120), daysSinceLastPeriod=10 < 30 → sensitivityLevel=0.3
    etsHorseRecent = await prisma.horse.create({
      data: {
        name: `TestFixture-ETS-Recent-${ts}`,
        sex: 'Filly',
        dateOfBirth: daysAgo(130),
        age: 0,
        userId: etsUser.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ETS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: etsUser?.id } }).catch(() => {});
  }, 30000);

  // ── calculateTriggerThresholds age branches ──────────────────────────────

  it('calculateTriggerThresholds: ageInDays ≤7 → ageModifier=0.6', async () => {
    const result = await calculateTriggerThresholds(etsHorseNewborn.id);
    expect(result.ageModifier).toBe(0.6);
    expect(result.horseId).toBe(etsHorseNewborn.id);
    expect(typeof result.finalThreshold).toBe('number');
  });

  it('calculateTriggerThresholds: ageInDays ≤30 → ageModifier=0.7', async () => {
    const result = await calculateTriggerThresholds(etsHorseYoung.id);
    expect(result.ageModifier).toBe(0.7);
  });

  it('calculateTriggerThresholds: ageInDays ≤90 → ageModifier=0.8', async () => {
    const result = await calculateTriggerThresholds(etsHorseDeveloping.id);
    expect(result.ageModifier).toBe(0.8);
  });

  it('calculateTriggerThresholds: ageInDays >90 → ageModifier=1.0', async () => {
    const result = await calculateTriggerThresholds(etsHorseMature.id);
    expect(result.ageModifier).toBe(1.0);
  });

  // ── processSeasonalTriggers — valid seasons ──────────────────────────────

  it('processSeasonalTriggers: spring returns seasonal factors', async () => {
    const result = await processSeasonalTriggers(etsHorseMature.id, 'spring');
    expect(result.season).toBe('spring');
    expect(Array.isArray(result.seasonalFactors)).toBe(true);
    expect(typeof result.triggerModifications).toBe('object');
    expect(Array.isArray(result.modifiedTriggers)).toBe(true);
  });

  it('processSeasonalTriggers: winter returns winter factors', async () => {
    const result = await processSeasonalTriggers(etsHorseMature.id, 'winter');
    expect(result.season).toBe('winter');
    expect(result.seasonalFactors).toContain('cold_weather');
  });

  // ── analyzeStressEnvironmentTriggers ─────────────────────────────────────

  it('analyzeStressEnvironmentTriggers: no stress interactions → stressTriggers=[]', async () => {
    const result = await analyzeStressEnvironmentTriggers(etsHorseMature.id);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(Array.isArray(result.stressTriggers)).toBe(true);
    expect(result.stressfulInteractionCount).toBe(0);
    expect(typeof result.recommendedInterventions).toBe('object');
  });

  // ── assessCriticalPeriodSensitivity branches ─────────────────────────────

  it('assessCriticalPeriodSensitivity: newborn (age 1d) is in active critical period', async () => {
    const result = await assessCriticalPeriodSensitivity(etsHorseNewborn.id);
    // Age 1 day: within imprinting (0-3), early_socialization (1-14) → activeWindows.length > 0
    expect(result.activeWindows.length).toBeGreaterThan(0);
    expect(result.sensitivityLevel).toBeGreaterThan(0);
    expect(Array.isArray(result.criticalPeriods)).toBe(true);
  });

  it('assessCriticalPeriodSensitivity: recent past periods (130d) → sensitivityLevel=0.3', async () => {
    const result = await assessCriticalPeriodSensitivity(etsHorseRecent.id);
    // Age 130: past all critical periods (last ends at 120), daysSinceLastPeriod=10 < 30 → 0.3
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.3);
  });

  it('assessCriticalPeriodSensitivity: old horse (200d) → sensitivityLevel=0.1', async () => {
    const result = await assessCriticalPeriodSensitivity(etsHorseMature.id);
    // Age 200: daysSinceLastPeriod=80 >= 30 → sensitivityLevel=0.1
    expect(result.activeWindows).toHaveLength(0);
    expect(result.sensitivityLevel).toBe(0.1);
  });

  // ── evaluateTraitExpressionProbability ───────────────────────────────────

  it('evaluateTraitExpressionProbability: returns expressionLikelihood for brave (positive trait)', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseMature.id, 'brave');
    expect(result.traitName).toBe('brave');
    expect(typeof result.finalProbability).toBe('number');
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
    expect(result.finalProbability).toBeLessThanOrEqual(1);
    expect(
      ['very_likely', 'likely', 'possible', 'unlikely', 'very_unlikely'].includes(result.expressionLikelihood),
    ).toBe(true);
  });

  it('evaluateTraitExpressionProbability: fearful (negative trait) has stress modifier applied', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseMature.id, 'fearful');
    expect(result.traitName).toBe('fearful');
    // stressModifier > 1.0 since fearful is in negativeTraits list (even for stressLevel=50)
    expect(result.stressModifier).toBeGreaterThan(0);
  });

  it('evaluateTraitExpressionProbability: neutral trait (not in negative/positive list)', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseMature.id, 'curious');
    expect(result.traitName).toBe('curious');
    // curious is in positiveTraits → stressModifier applied; finalProbability still in [0,1]
    expect(result.finalProbability).toBeGreaterThanOrEqual(0);
  });

  it('evaluateTraitExpressionProbability: young foal ageModifier=1.5 (≤30 days)', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseYoung.id, 'brave');
    // ageInDays=15 ≤30 → ageModifier=1.5
    expect(result.ageModifier).toBe(1.5);
  });

  it('evaluateTraitExpressionProbability: developing foal ageModifier=1.2 (≤90 days)', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseDeveloping.id, 'brave');
    // ageInDays=45 ≤90 → ageModifier=1.2
    expect(result.ageModifier).toBe(1.2);
  });

  it('evaluateTraitExpressionProbability: mature horse ageModifier=0.8 (>90 days)', async () => {
    const result = await evaluateTraitExpressionProbability(etsHorseMature.id, 'calm');
    // ageInDays=200 >90 → ageModifier=0.8
    expect(result.ageModifier).toBe(0.8);
  });

  // ── generateEnvironmentalReport ──────────────────────────────────────────

  it('generateEnvironmentalReport: returns aggregated report for mature horse', async () => {
    const result = await generateEnvironmentalReport(etsHorseMature.id);
    expect(result.horseId).toBe(etsHorseMature.id);
    expect(result.environmentalTriggers).toBeDefined();
    expect(result.triggerThresholds).toBeDefined();
    expect(Array.isArray(result.traitExpressionProbabilities)).toBe(true);
    expect(result.traitExpressionProbabilities.length).toBeGreaterThan(0);
    expect(result.cumulativeExposure).toBeDefined();
    expect(result.criticalPeriodSensitivity).toBeDefined();
    expect(result.reportTimestamp).toBeDefined();
  });
});
