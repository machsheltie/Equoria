/**
 * traitHistoryService service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests exported async functions with real DB fixtures.
 * Horse with no trait history exercises the zero-data code paths.
 * logTraitAssignment is tested by creating a real TraitHistoryLog entry.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  logTraitAssignment,
  getTraitHistory,
  getTraitDevelopmentSummary,
  getBreedingInsights,
  analyzeTraitPatterns,
} from '../../services/traitHistoryService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traithist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `traithist${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TraitHist',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-TraitHistHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.traitHistoryLog.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── getTraitHistory ────────────────────────────────────────────────────────────

describe('getTraitHistory', () => {
  it('returns empty array for horse with no history', async () => {
    const result = await getTraitHistory(horse.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for unknown horseId', async () => {
    const result = await getTraitHistory(999999999);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('accepts options object without throwing', async () => {
    const result = await getTraitHistory(horse.id, { limit: 10, offset: 0, sourceType: 'groom' });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── logTraitAssignment ─────────────────────────────────────────────────────────

describe('logTraitAssignment', () => {
  it('throws for non-existent horse', async () => {
    await expect(
      logTraitAssignment({
        horseId: 999999999,
        traitName: 'Brave',
        sourceType: 'groom',
        sourceId: 1,
        influenceScore: 5,
        isEpigenetic: true,
      }),
    ).rejects.toThrow();
  });

  it('creates a trait history log entry for a real horse', async () => {
    const entry = await logTraitAssignment({
      horseId: horse.id,
      traitName: 'Curious',
      sourceType: 'milestone',
      sourceId: 1,
      influenceScore: 3,
      isEpigenetic: false,
    });

    expect(entry).toBeDefined();
    expect(entry.horseId).toBe(horse.id);
    expect(entry.traitName).toBe('Curious');
    expect(entry.sourceType).toBe('milestone');
    expect(typeof entry.ageInDays).toBe('number');
  });
});

// ── getTraitDevelopmentSummary ─────────────────────────────────────────────────

describe('getTraitDevelopmentSummary', () => {
  it('returns zero-summary for horse with no history', async () => {
    const freshHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TraitHistSummaryHorse-${Date.now()}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
      },
    });

    try {
      const result = await getTraitDevelopmentSummary(freshHorse.id);
      expect(result).toBeDefined();
      expect(result.horseId).toBe(freshHorse.id);
      expect(result.totalTraits).toBe(0);
      expect(result.epigeneticTraits).toBe(0);
      expect(result.groomInfluencedTraits).toBe(0);
      expect(typeof result.developmentalStages).toBe('object');
      expect(typeof result.sourceBreakdown).toBe('object');
      expect(typeof result.groomContributions).toBe('object');
    } finally {
      await prisma.horse.delete({ where: { id: freshHorse.id } }).catch(() => {});
    }
  });
});

// ── getBreedingInsights ────────────────────────────────────────────────────────

describe('getBreedingInsights', () => {
  it('returns insights object with low inheritance risk for horse with no traits', async () => {
    const freshHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TraitHistBreedHorse-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
      },
    });

    try {
      const result = await getBreedingInsights(freshHorse.id);
      expect(result).toBeDefined();
      expect(result.horseId).toBe(freshHorse.id);
      expect(result.inheritanceRisk).toBe('low');
      expect(typeof result.epigeneticProfile).toBe('object');
      expect(Array.isArray(result.recommendedCarePatterns)).toBe(true);
      expect(Array.isArray(result.breedingNotes)).toBe(true);
    } finally {
      await prisma.horse.delete({ where: { id: freshHorse.id } }).catch(() => {});
    }
  });
});

// ── analyzeTraitPatterns ───────────────────────────────────────────────────────

describe('analyzeTraitPatterns', () => {
  it('returns empty patterns for empty horse list', async () => {
    const result = await analyzeTraitPatterns([]);
    expect(result).toBeDefined();
    expect(typeof result.commonTraits).toBe('object');
    expect(typeof result.epigeneticTrends).toBe('object');
    expect(typeof result.groomEffectiveness).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('returns patterns object for a horse with no history', async () => {
    const result = await analyzeTraitPatterns([horse.id]);
    expect(result).toBeDefined();
    expect(typeof result.commonTraits).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
