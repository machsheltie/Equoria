/**
 * breedingPredictionService + advancedLineageAnalysisService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Stallion + Mare (no trait history, no lineage).
 * Tests exercise the zero-trait / missing-parent paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  calculateInheritanceProbabilities,
  calculateFlagInheritanceScore,
  calculateTemperamentInfluence,
  predictOffspringTraits,
  generateBreedingData,
} from '../../../services/breedingPredictionService.mjs';
import {
  generateLineageTree,
  calculateGeneticDiversityMetrics,
  calculateInbreedingCoefficient,
  generateBreedingRecommendations,
} from '../../../services/advancedLineageAnalysisService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;
let stallion;
let mare;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `breedlin-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `breedlin${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'BreedLin',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      name: `TestFixture-BreedLinStallion-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
    },
  });

  mare = await prisma.horse.create({
    data: {
      name: `TestFixture-BreedLinMare-${Date.now()}`,
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

// ── breedingPredictionService ─────────────────────────────────────────────────

describe('calculateInheritanceProbabilities', () => {
  it('returns summary shape for pair with no trait history', async () => {
    const result = await calculateInheritanceProbabilities(stallion.id, mare.id);
    expect(result.stallionId).toBe(stallion.id);
    expect(result.mareId).toBe(mare.id);
    expect(Array.isArray(result.traitProbabilities)).toBe(true);
    expect(result.traitProbabilities).toHaveLength(0);
    expect(typeof result.summary).toBe('object');
  });
});

describe('calculateFlagInheritanceScore', () => {
  it('returns flag score shape for pair with no traits', async () => {
    const result = await calculateFlagInheritanceScore(stallion.id, mare.id);
    expect(result.stallionId).toBe(stallion.id);
    expect(result.mareId).toBe(mare.id);
    expect(typeof result.stallionFlags).toBe('object');
    expect(typeof result.mareFlags).toBe('object');
    expect(typeof result.combinedScore).toBe('number');
    expect(result.calculatedAt).toBeInstanceOf(Date);
  });
});

describe('calculateTemperamentInfluence', () => {
  it('throws for non-existent horse IDs', async () => {
    await expect(calculateTemperamentInfluence(999999999, 999999998)).rejects.toThrow();
  });

  it('returns compatibility shape for valid pair', async () => {
    const result = await calculateTemperamentInfluence(stallion.id, mare.id);
    expect(result.stallionId).toBe(stallion.id);
    expect(result.mareId).toBe(mare.id);
    expect(typeof result.compatibilityScore).toBe('number');
    expect(Array.isArray(result.predictedOffspringTemperament)).toBe(true);
    expect(typeof result.traitInfluenceModifiers).toBe('object');
    expect(result.calculatedAt).toBeInstanceOf(Date);
  });
});

describe('predictOffspringTraits', () => {
  it('returns prediction shape for pair with no traits', async () => {
    const result = await predictOffspringTraits(stallion.id, mare.id);
    expect(result.stallionId).toBe(stallion.id);
    expect(result.mareId).toBe(mare.id);
    expect(typeof result.categoryProbabilities).toBe('object');
    expect(typeof result.estimatedTraitCount).toBe('object');
    expect(typeof result.estimatedTraitCount.min).toBe('number');
    expect(typeof result.estimatedTraitCount.max).toBe('number');
  });
});

describe('generateBreedingData', () => {
  it('throws for non-existent horse', async () => {
    await expect(generateBreedingData(999999999)).rejects.toThrow();
  });

  it('returns breeding data shape for valid horse', async () => {
    const result = await generateBreedingData(stallion.id);
    expect(result.horseId).toBe(stallion.id);
    expect(typeof result.traitSummary).toBe('object');
    expect(typeof result.traitSummary.totalTraits).toBe('number');
    expect(result.traitSummary.totalTraits).toBe(0);
  });
});

// ── advancedLineageAnalysisService ────────────────────────────────────────────

describe('generateLineageTree', () => {
  it('returns empty tree when parents have no lineage data', async () => {
    const result = await generateLineageTree(stallion.id, mare.id, 2);
    expect(typeof result.root).toBe('object');
    expect(typeof result.totalHorses).toBe('number');
    expect(typeof result.maxDepth).toBe('number');
  });

  it('returns empty structure for non-existent horses', async () => {
    const result = await generateLineageTree(999999999, 999999998, 1);
    expect(result.root.stallion).toBeNull();
    expect(result.root.mare).toBeNull();
    expect(result.totalHorses).toBe(0);
  });
});

describe('calculateGeneticDiversityMetrics', () => {
  it('returns diversity shape for empty generations array', async () => {
    const result = await calculateGeneticDiversityMetrics([]);
    expect(typeof result).toBe('object');
  });
});

describe('calculateInbreedingCoefficient', () => {
  it('returns a number between 0 and 1 for unrelated horses', async () => {
    const result = await calculateInbreedingCoefficient(stallion.id, mare.id);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

describe('generateBreedingRecommendations', () => {
  it('returns recommendations shape for valid horse pair', async () => {
    const result = await generateBreedingRecommendations(stallion.id, mare.id);
    expect(typeof result).toBe('object');
    expect(typeof result.compatibility).toBe('object');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});
