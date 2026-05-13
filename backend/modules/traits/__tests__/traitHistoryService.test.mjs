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
} from '../../../services/traitHistoryService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

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

// ── traitHistoryService — branch coverage with rich fixture data (Equoria-jkht) ──
// 7 log entries cover all getAgeStage branches (imprinting/socialization/fear_period/
// juvenile/adolescent/young_adult/mature). 3 negative epigenetic traits → high risk.
// 1-negative-trait horse → moderate risk. Groom-linked entries → groomEffectiveness.

describe('traitHistoryService — branch coverage (Equoria-jkht)', () => {
  let thUser;
  let thGroom;
  let thHorse;
  let thModerateHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    thUser = await prisma.user.create({
      data: {
        email: `th-branch-${ts}-${rand()}@test.com`,
        username: `thbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TH',
        lastName: 'Branch',
        money: 1000,
      },
    });

    thGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-TH-Groom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: thUser.id,
      },
    });

    thHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TH-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: thUser.id,
      },
    });

    thModerateHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TH-ModHorse-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: thUser.id,
      },
    });

    // 7 entries on thHorse — ageInDays spread to hit every getAgeStage branch
    const entries = [
      {
        ageInDays: 15,
        traitName: 'Calm',
        isEpigenetic: true,
        sourceType: 'groom',
        groomId: thGroom.id,
        influenceScore: 5,
      },
      {
        ageInDays: 60,
        traitName: 'Brave',
        isEpigenetic: false,
        sourceType: 'groom',
        groomId: thGroom.id,
        influenceScore: 4,
      },
      {
        ageInDays: 120,
        traitName: 'Curious',
        isEpigenetic: false,
        sourceType: 'environmental',
        groomId: null,
        influenceScore: 3,
      },
      {
        ageInDays: 200,
        traitName: 'Nervous',
        isEpigenetic: true,
        sourceType: 'groom',
        groomId: thGroom.id,
        influenceScore: 2,
      },
      {
        ageInDays: 500,
        traitName: 'Skittish',
        isEpigenetic: true,
        sourceType: 'genetic',
        groomId: null,
        influenceScore: 1,
      },
      {
        ageInDays: 800,
        traitName: 'Anxious',
        isEpigenetic: true,
        sourceType: 'milestone',
        groomId: null,
        influenceScore: 3,
      },
      {
        ageInDays: 1200,
        traitName: 'Focused',
        isEpigenetic: false,
        sourceType: 'environmental',
        groomId: null,
        influenceScore: 2,
      },
    ];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      await prisma.traitHistoryLog.create({
        data: {
          horseId: thHorse.id,
          traitName: e.traitName,
          sourceType: e.sourceType,
          sourceId: null,
          influenceScore: e.influenceScore,
          isEpigenetic: e.isEpigenetic,
          groomId: e.groomId,
          bondScore: null,
          stressLevel: null,
          ageInDays: e.ageInDays,
          timestamp: new Date(ts - (entries.length - i) * 1000),
        },
      });
    }

    // 1 negative epigenetic entry on thModerateHorse → moderate risk
    await prisma.traitHistoryLog.create({
      data: {
        horseId: thModerateHorse.id,
        traitName: 'Nervous',
        sourceType: 'groom',
        sourceId: null,
        influenceScore: 3,
        isEpigenetic: true,
        groomId: null,
        bondScore: null,
        stressLevel: null,
        ageInDays: 30,
        timestamp: new Date(ts),
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.traitHistoryLog
      .deleteMany({ where: { horseId: { in: [thHorse.id, thModerateHorse.id] } } })
      .catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TH-' } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-TH-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: thUser.id } }).catch(() => {});
  }, 30000);

  it('getTraitHistory with isEpigenetic=true filter (whereClause.isEpigenetic branch)', async () => {
    const result = await getTraitHistory(thHorse.id, { isEpigenetic: true });
    expect(Array.isArray(result)).toBe(true);
    result.forEach(entry => expect(entry.isEpigenetic).toBe(true));
    expect(result.length).toBe(4); // Calm, Nervous, Skittish, Anxious
  });

  it('getTraitHistory with isEpigenetic=false filter', async () => {
    const result = await getTraitHistory(thHorse.id, { isEpigenetic: false });
    expect(Array.isArray(result)).toBe(true);
    result.forEach(entry => expect(entry.isEpigenetic).toBe(false));
    expect(result.length).toBe(3); // Brave, Curious, Focused
  });

  it('getTraitHistory with startDate only (timestamp.gte branch)', async () => {
    const result = await getTraitHistory(thHorse.id, { startDate: new Date(0) });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
  });

  it('getTraitHistory with endDate only (timestamp.lte branch)', async () => {
    const result = await getTraitHistory(thHorse.id, { endDate: new Date(Date.now() + 86400000) });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
  });

  it('getTraitHistory with both startDate and endDate (both timestamp branches)', async () => {
    const result = await getTraitHistory(thHorse.id, {
      startDate: new Date(0),
      endDate: new Date(Date.now() + 86400000),
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(7);
  });

  it('getTraitDevelopmentSummary covers all 7 getAgeStage branches and groom contributions', async () => {
    const result = await getTraitDevelopmentSummary(thHorse.id);
    expect(result.totalTraits).toBe(7);
    expect(result.epigeneticTraits).toBe(4);
    expect(result.groomInfluencedTraits).toBe(3); // entries with sourceType='groom'
    // All 7 age stages must appear in developmentalStages
    expect(result.developmentalStages['imprinting']).toBe(1);
    expect(result.developmentalStages['socialization']).toBe(1);
    expect(result.developmentalStages['fear_period']).toBe(1);
    expect(result.developmentalStages['juvenile']).toBe(1);
    expect(result.developmentalStages['adolescent']).toBe(1);
    expect(result.developmentalStages['young_adult']).toBe(1);
    expect(result.developmentalStages['mature']).toBe(1);
    // Groom contributions present (3 entries linked to thGroom)
    expect(Object.keys(result.groomContributions).length).toBeGreaterThan(0);
  });

  it('getBreedingInsights returns inheritanceRisk=high for horse with 3 negative epigenetic traits', async () => {
    const result = await getBreedingInsights(thHorse.id);
    expect(result.inheritanceRisk).toBe('high');
    expect(result.breedingNotes.length).toBeGreaterThan(0);
    // bestGrooms branch: thGroom has averageInfluence > 2
    expect(result.recommendedCarePatterns.length).toBeGreaterThan(0);
  });

  it('getBreedingInsights returns inheritanceRisk=moderate for horse with 1 negative epigenetic trait', async () => {
    const result = await getBreedingInsights(thModerateHorse.id);
    expect(result.inheritanceRisk).toBe('moderate');
  });

  it('analyzeTraitPatterns with groom-linked entries → groomEffectiveness populated and recommendation generated', async () => {
    const result = await analyzeTraitPatterns([thHorse.id]);
    expect(Object.keys(result.commonTraits).length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
