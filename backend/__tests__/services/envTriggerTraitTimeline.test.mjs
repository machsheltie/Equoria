/**
 * environmentalTriggerSystem + traitTimelineService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal (age 0, no interactions).
 * Zero-interaction paths exercise the empty-data branches.
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
import { generateTraitTimeline, getTraitTimelineSummary } from '../../services/traitTimelineService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `envtrigger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `envtrigger${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'EnvTrigger',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
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
