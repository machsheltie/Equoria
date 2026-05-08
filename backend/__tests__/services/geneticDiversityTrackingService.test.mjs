/**
 * geneticDiversityTrackingService unit tests (Equoria-rr7 coverage sprint).
 *
 * DB fixture: user + Stallion + Mare (no lineage / trait history).
 * Array-based functions use [] to exercise the default/empty-population paths.
 * Pair functions use the real stallion/mare fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateAdvancedGeneticDiversity,
  calculateEffectivePopulationSize,
  identifyGeneticFounders,
  calculateDetailedInbreedingCoefficient,
  trackPopulationGeneticHealth,
  analyzeGeneticTrends,
  generateOptimalBreedingRecommendations,
  assessBreedingPairCompatibility,
  trackGeneticDiversityOverTime,
  generateGeneticDiversityReport,
} from '../../services/geneticDiversityTrackingService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let stallion;
let mare;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `gendiv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `gendiv${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GenDiv',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      name: `TestFixture-GenDivStallion-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
    },
  });

  mare = await prisma.horse.create({
    data: {
      name: `TestFixture-GenDivMare-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: stallion.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: mare.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── calculateAdvancedGeneticDiversity ─────────────────────────────────────────

describe('calculateAdvancedGeneticDiversity', () => {
  it('returns default zero metrics for empty population', async () => {
    const result = await calculateAdvancedGeneticDiversity([]);
    expect(typeof result.shannonIndex).toBe('number');
    expect(typeof result.simpsonIndex).toBe('number');
    expect(typeof result.diversityScore).toBe('number');
    expect(typeof result.alleleFrequencies).toBe('object');
  });

  it('returns metrics object for a small population', async () => {
    const result = await calculateAdvancedGeneticDiversity([stallion.id, mare.id]);
    expect(typeof result.diversityScore).toBe('number');
    expect(result.diversityScore).toBeGreaterThanOrEqual(0);
    expect(result.diversityScore).toBeLessThanOrEqual(100);
  });
});

// ── calculateEffectivePopulationSize ──────────────────────────────────────────

describe('calculateEffectivePopulationSize', () => {
  it('returns zero effectiveSize for empty population', async () => {
    const result = await calculateEffectivePopulationSize([]);
    expect(result.effectiveSize).toBe(0);
    expect(result.actualSize).toBe(0);
    expect(typeof result.breedingContributors).toBe('object');
  });

  it('returns populated shape for a mixed-sex group', async () => {
    const result = await calculateEffectivePopulationSize([stallion.id, mare.id]);
    expect(typeof result.effectiveSize).toBe('number');
    expect(result.actualSize).toBe(2);
    expect(typeof result.ratio).toBe('number');
  });
});

// ── identifyGeneticFounders ───────────────────────────────────────────────────

describe('identifyGeneticFounders', () => {
  it('returns empty array for empty population', async () => {
    const result = await identifyGeneticFounders([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns founder shape for horses with no parents in population', async () => {
    const result = await identifyGeneticFounders([stallion.id, mare.id]);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(typeof result[0].id).toBe('number');
      expect(typeof result[0].geneticInfluence).toBe('number');
    }
  });
});

// ── calculateDetailedInbreedingCoefficient ────────────────────────────────────

describe('calculateDetailedInbreedingCoefficient', () => {
  it('returns coefficient shape for unrelated horses', async () => {
    const result = await calculateDetailedInbreedingCoefficient(stallion.id, mare.id);
    expect(typeof result.coefficient).toBe('number');
    expect(result.coefficient).toBeGreaterThanOrEqual(0);
    expect(result.coefficient).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.commonAncestors)).toBe(true);
    expect(typeof result.riskAssessment).toBe('object');
  });
});

// ── trackPopulationGeneticHealth ──────────────────────────────────────────────

describe('trackPopulationGeneticHealth', () => {
  it('returns health shape for empty population', async () => {
    const result = await trackPopulationGeneticHealth([]);
    expect(typeof result.overallHealth).toBe('object');
    expect(typeof result.diversityTrends).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('returns health shape for small population', async () => {
    const result = await trackPopulationGeneticHealth([stallion.id, mare.id]);
    expect(typeof result.overallHealth.grade).toBe('string');
    expect(typeof result.diversityTrends.current).toBe('number');
  });
});

// ── analyzeGeneticTrends ──────────────────────────────────────────────────────

describe('analyzeGeneticTrends', () => {
  it('returns trend shape for empty population', async () => {
    const result = await analyzeGeneticTrends([]);
    expect(Array.isArray(result.generationalAnalysis)).toBe(true);
    expect(typeof result.diversityProgression).toBe('object');
    expect(typeof result.predictions).toBe('object');
  });
});

// ── generateOptimalBreedingRecommendations ────────────────────────────────────

describe('generateOptimalBreedingRecommendations', () => {
  it('returns recommendations shape for empty population', async () => {
    const result = await generateOptimalBreedingRecommendations([]);
    expect(Array.isArray(result.optimalPairs)).toBe(true);
    expect(Array.isArray(result.avoidPairs)).toBe(true);
    expect(typeof result.diversityGoals).toBe('object');
  });

  it('returns shape for a stallion+mare population', async () => {
    const result = await generateOptimalBreedingRecommendations([stallion.id, mare.id]);
    expect(Array.isArray(result.optimalPairs)).toBe(true);
    expect(typeof result.timeline).toBe('object');
  });
});

// ── assessBreedingPairCompatibility ───────────────────────────────────────────

describe('assessBreedingPairCompatibility', () => {
  it('returns compatibility shape for valid pair', async () => {
    const result = await assessBreedingPairCompatibility(stallion.id, mare.id);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(typeof result.geneticCompatibility).toBe('number');
    expect(typeof result.inbreedingRisk).toBe('number');
    expect(typeof result.recommendation).toBe('string');
  });
});

// ── trackGeneticDiversityOverTime ─────────────────────────────────────────────

describe('trackGeneticDiversityOverTime', () => {
  it('returns tracking shape for empty population', async () => {
    const result = await trackGeneticDiversityOverTime([]);
    expect(typeof result.diversityMetrics).toBe('object');
    expect(Array.isArray(result.milestones)).toBe(true);
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});

// ── generateGeneticDiversityReport ────────────────────────────────────────────

describe('generateGeneticDiversityReport', () => {
  it('returns report shape for empty population', async () => {
    const result = await generateGeneticDiversityReport([]);
    expect(typeof result.currentStatus).toBe('object');
    expect(typeof result.currentStatus.diversityScore).toBe('number');
    expect(typeof result.currentStatus.populationSize).toBe('number');
    expect(Array.isArray(result.recommendations.optimalPairs)).toBe(true);
  });
});
