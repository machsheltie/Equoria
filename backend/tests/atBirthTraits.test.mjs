/**
 * Integration Test: At-Birth Traits System (atBirthTraits.mjs)
 *
 * Pure-function sections (AT_BIRTH_TRAITS, evaluateTraitConditions,
 * checkLineageForDisciplineAffinity, getMostCommonDisciplineFromHistory,
 * getHighestScoringDiscipline) are tested without any DB or fixture setup.
 *
 * DB-dependent sections (assessFeedQuality, getAncestors, detectInbreeding,
 * analyzeLineage, applyEpigeneticTraitsAtBirth) use real TestFixture-ATBT-*
 * horses created in beforeAll and cleaned in afterAll.
 *
 * Probabilistic trait assertions use a retry helper (up to 50 runs) so they
 * are statistically near-deterministic without controlling Math.random.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import prisma from '../db/index.mjs';
import {
  AT_BIRTH_TRAITS,
  analyzeLineage,
  detectInbreeding,
  getAncestors,
  assessFeedQuality,
  applyEpigeneticTraitsAtBirth,
  evaluateTraitConditions,
  checkLineageForDisciplineAffinity,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
} from '../utils/atBirthTraits.mjs';

async function traitAppears(fn, traitName, category = 'positive', maxRuns = 50) {
  for (let i = 0; i < maxRuns; i++) {
    const result = await fn();
    if (result.traits[category].includes(traitName)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure function tests — no DB fixtures required
// ─────────────────────────────────────────────────────────────────────────────

describe('AT_BIRTH_TRAITS — trait definition structure', () => {
  it('has positive and negative trait categories', () => {
    expect(AT_BIRTH_TRAITS).toHaveProperty('positive');
    expect(AT_BIRTH_TRAITS).toHaveProperty('negative');
    expect(typeof AT_BIRTH_TRAITS.positive).toBe('object');
    expect(typeof AT_BIRTH_TRAITS.negative).toBe('object');
  });

  it('all traits have required fields with valid types and probability range', () => {
    const allTraits = { ...AT_BIRTH_TRAITS.positive, ...AT_BIRTH_TRAITS.negative };
    Object.values(allTraits).forEach(trait => {
      expect(trait).toHaveProperty('name');
      expect(trait).toHaveProperty('description');
      expect(trait).toHaveProperty('conditions');
      expect(trait).toHaveProperty('probability');
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.description).toBe('string');
      expect(typeof trait.conditions).toBe('object');
      expect(typeof trait.probability).toBe('number');
      expect(trait.probability).toBeGreaterThan(0);
      expect(trait.probability).toBeLessThanOrEqual(1);
    });
  });
});

describe('evaluateTraitConditions — condition matching logic', () => {
  it('evaluates mareStressMax correctly', () => {
    const conditions = { mareStressMax: 30 };
    expect(evaluateTraitConditions(conditions, { mareStress: 20 })).toBe(true);
    expect(evaluateTraitConditions(conditions, { mareStress: 30 })).toBe(true);
    expect(evaluateTraitConditions(conditions, { mareStress: 40 })).toBe(false);
  });

  it('evaluates feedQualityMin correctly', () => {
    const conditions = { feedQualityMin: 70 };
    expect(evaluateTraitConditions(conditions, { feedQuality: 80 })).toBe(true);
    expect(evaluateTraitConditions(conditions, { feedQuality: 70 })).toBe(true);
    expect(evaluateTraitConditions(conditions, { feedQuality: 60 })).toBe(false);
  });

  it('evaluates noInbreeding correctly', () => {
    const conditions = { noInbreeding: true };
    expect(evaluateTraitConditions(conditions, { noInbreeding: true })).toBe(true);
    expect(evaluateTraitConditions(conditions, { noInbreeding: false })).toBe(false);
  });

  it('evaluates multiple conditions — all must be satisfied', () => {
    const conditions = { mareStressMax: 20, feedQualityMin: 80, noInbreeding: true };
    expect(evaluateTraitConditions(conditions, { mareStress: 15, feedQuality: 85, noInbreeding: true })).toBe(true);
    expect(evaluateTraitConditions(conditions, { mareStress: 25, feedQuality: 85, noInbreeding: true })).toBe(false);
  });
});

describe('checkLineageForDisciplineAffinity — discipline detection', () => {
  it('returns affinity=true when 3+ ancestors share the same discipline', () => {
    const ancestors = [
      { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
      { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
      { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
      { id: 4, name: 'Horse4', discipline: 'Dressage' },
      { id: 5, name: 'Horse5', discipline: 'Racing' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Show Jumping');
    expect(result.count).toBe(3);
    expect(result.totalAnalyzed).toBe(5);
    expect(result.totalWithDisciplines).toBe(5);
    expect(result.disciplineBreakdown).toEqual({ 'Show Jumping': 3, Dressage: 1, Racing: 1 });
  });

  it('returns affinity=false when fewer than 3 ancestors share a discipline', () => {
    const ancestors = [
      { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
      { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
      { id: 3, name: 'Horse3', discipline: 'Dressage' },
      { id: 4, name: 'Horse4', discipline: 'Racing' },
      { id: 5, name: 'Horse5', discipline: 'Racing' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(false);
    expect(result.discipline).toBeNull();
    expect(result.count).toBe(2);
  });

  it('detects discipline from competitionHistory when discipline field absent', () => {
    const ancestors = [
      { id: 1, name: 'Horse1', competitionHistory: [{ discipline: 'Racing' }, { discipline: 'Racing' }] },
      { id: 2, name: 'Horse2', competitionHistory: [{ discipline: 'Racing' }] },
      { id: 3, name: 'Horse3', competitionHistory: [{ discipline: 'Racing' }] },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Racing');
    expect(result.count).toBe(3);
  });

  it('detects discipline from disciplineScores when other fields absent', () => {
    const ancestors = [
      { id: 1, name: 'Horse1', disciplineScores: { 'Show Jumping': 85, Dressage: 60 } },
      { id: 2, name: 'Horse2', disciplineScores: { 'Show Jumping': 90, Dressage: 70 } },
      { id: 3, name: 'Horse3', disciplineScores: { 'Show Jumping': 85, Racing: 75 } },
      { id: 4, name: 'Horse4', disciplineScores: { Dressage: 95, Racing: 65 } },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Show Jumping');
    expect(result.count).toBe(3);
  });

  it('returns affinity=false for empty ancestors array', () => {
    const result = checkLineageForDisciplineAffinity([]);
    expect(result.affinity).toBe(false);
    expect(result.discipline).toBeUndefined();
  });

  it('returns affinity=false for null ancestors', () => {
    const result = checkLineageForDisciplineAffinity(null);
    expect(result.affinity).toBe(false);
    expect(result.discipline).toBeUndefined();
  });

  it('returns affinity=false when no ancestors have discipline data', () => {
    const ancestors = [
      { id: 1, name: 'Horse1' },
      { id: 2, name: 'Horse2' },
      { id: 3, name: 'Horse3' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(false);
    expect(result.totalAnalyzed).toBe(3);
    expect(result.totalWithDisciplines).toBe(0);
  });

  it('prioritizes direct discipline field over competitionHistory and disciplineScores', () => {
    const ancestors = [
      {
        id: 1,
        name: 'Horse1',
        discipline: 'Show Jumping',
        competitionHistory: [{ discipline: 'Racing' }],
        disciplineScores: { Dressage: 95 },
      },
      { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
      { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Show Jumping');
    expect(result.count).toBe(3);
  });

  it('handles mixed data sources across ancestors', () => {
    const ancestors = [
      { id: 1, name: 'Horse1', discipline: 'Racing' },
      { id: 2, name: 'Horse2', competitionHistory: [{ discipline: 'Racing' }, { discipline: 'Racing' }] },
      { id: 3, name: 'Horse3', disciplineScores: { Racing: 85, Dressage: 60 } },
      { id: 4, name: 'Horse4', discipline: 'Show Jumping' },
    ];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Racing');
    expect(result.count).toBe(3);
  });
});

describe('getMostCommonDisciplineFromHistory — history parsing', () => {
  it('returns the most frequent discipline', () => {
    const history = [
      { discipline: 'Racing', placement: '1st' },
      { discipline: 'Racing', placement: '2nd' },
      { discipline: 'Racing', placement: '3rd' },
      { discipline: 'Dressage', placement: '1st' },
      { discipline: 'Show Jumping', placement: '2nd' },
    ];
    expect(getMostCommonDisciplineFromHistory(history)).toBe('Racing');
  });

  it('returns null for empty array', () => {
    expect(getMostCommonDisciplineFromHistory([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
  });

  it('returns null when no entries have a discipline field', () => {
    expect(getMostCommonDisciplineFromHistory([{ placement: '1st' }, { placement: '2nd' }])).toBeNull();
  });
});

describe('getHighestScoringDiscipline — score parsing', () => {
  it('returns the discipline with the highest numeric score', () => {
    expect(getHighestScoringDiscipline({ Racing: 75, Dressage: 90, 'Show Jumping': 65 })).toBe('Dressage');
  });

  it('returns null for empty object', () => {
    expect(getHighestScoringDiscipline({})).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getHighestScoringDiscipline(null)).toBeNull();
  });

  it('ignores non-numeric score entries', () => {
    expect(getHighestScoringDiscipline({ Racing: 'high', Dressage: 90, 'Show Jumping': 'medium' })).toBe('Dressage');
  });

  it('returns null when all scores are non-numeric', () => {
    expect(getHighestScoringDiscipline({ Racing: 'high', Dressage: 'medium' })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DB-dependent tests — require real horse fixtures
// ─────────────────────────────────────────────────────────────────────────────

describe('At-Birth Traits — DB-dependent tests', () => {
  let breed;
  let testShow;
  let createdShow = false;

  // Feed quality fixtures
  let excellentMare;
  let richMare;

  // Ancestor tree for getAncestors test (Parent1/Parent2 share no common ancestors)
  let grandSire1, grandDam1, grandSire2, grandDam2;
  let parent1, parent2;

  // Inbreeding fixtures
  let commonAncestor, inbredSire, inbredDam;

  // Racing specialization fixtures
  let racingAncestor, racingSire, racingDam;

  // Simple sire/dam with no lineage (for basic applyEpigeneticTraitsAtBirth tests)
  let sire, dam;

  beforeAll(async () => {
    breed = await prisma.breed.findFirst();

    testShow = await prisma.show.findFirst();
    if (!testShow) {
      testShow = await prisma.show.create({
        data: {
          name: 'TestFixture-ATBT-Show',
          discipline: 'Racing',
          levelMin: 1,
          levelMax: 100,
          entryFee: 0,
          prize: 0,
          runDate: new Date(),
        },
      });
      createdShow = true;
    }

    const dateOfBirth = new Date('2018-01-01');
    const breedData = breed ? { breedId: breed.id } : {};

    // Feed quality fixtures
    excellentMare = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-ExcellentMare',
        sex: 'Mare',
        dateOfBirth,
        healthStatus: 'Excellent',
        totalEarnings: 50000,
        ...breedData,
      },
    });
    richMare = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-RichMare',
        sex: 'Mare',
        dateOfBirth,
        healthStatus: 'Good',
        totalEarnings: 150000,
        ...breedData,
      },
    });

    // Ancestor tree: 4 grandparents + 2 parents (no shared ancestors)
    grandSire1 = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-GrandSire1', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    grandDam1 = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-GrandDam1', sex: 'Mare', dateOfBirth, ...breedData },
    });
    grandSire2 = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-GrandSire2', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    grandDam2 = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-GrandDam2', sex: 'Mare', dateOfBirth, ...breedData },
    });
    parent1 = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-Parent1',
        sex: 'Stallion',
        dateOfBirth,
        sireId: grandSire1.id,
        damId: grandDam1.id,
        ...breedData,
      },
    });
    parent2 = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-Parent2',
        sex: 'Mare',
        dateOfBirth,
        sireId: grandSire2.id,
        damId: grandDam2.id,
        stressLevel: 25,
        healthStatus: 'Good',
        ...breedData,
      },
    });

    // Inbreeding fixtures: both inbredSire and inbredDam share commonAncestor as their sire
    commonAncestor = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-CommonAncestor', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    inbredSire = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-InbredSire',
        sex: 'Stallion',
        dateOfBirth,
        sireId: commonAncestor.id,
        ...breedData,
      },
    });
    inbredDam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-InbredDam',
        sex: 'Mare',
        dateOfBirth,
        sireId: commonAncestor.id,
        stressLevel: 25,
        healthStatus: 'Good',
        ...breedData,
      },
    });

    // Racing specialization: racingAncestor has 3 Racing + 1 Dressage results (75%)
    racingAncestor = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-RacingAncestor', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    racingSire = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-RacingSire',
        sex: 'Stallion',
        dateOfBirth,
        sireId: racingAncestor.id,
        ...breedData,
      },
    });
    racingDam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-RacingDam',
        sex: 'Mare',
        dateOfBirth,
        stressLevel: 30,
        healthStatus: 'Good',
        ...breedData,
      },
    });

    const now = new Date();
    await prisma.competitionResult.createMany({
      data: [
        {
          horseId: racingAncestor.id,
          discipline: 'Racing',
          placement: '1st',
          score: 85,
          showId: testShow.id,
          showName: testShow.name,
          runDate: now,
        },
        {
          horseId: racingAncestor.id,
          discipline: 'Racing',
          placement: '2nd',
          score: 75,
          showId: testShow.id,
          showName: testShow.name,
          runDate: now,
        },
        {
          horseId: racingAncestor.id,
          discipline: 'Racing',
          placement: '3rd',
          score: 65,
          showId: testShow.id,
          showName: testShow.name,
          runDate: now,
        },
        {
          horseId: racingAncestor.id,
          discipline: 'Dressage',
          placement: '2nd',
          score: 70,
          showId: testShow.id,
          showName: testShow.name,
          runDate: now,
        },
      ],
    });

    // Simple sire/dam with no lineage (no sireId/damId)
    sire = await prisma.horse.create({
      data: { name: 'TestFixture-ATBT-Sire', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    dam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATBT-Dam',
        sex: 'Mare',
        dateOfBirth,
        stressLevel: 25,
        healthStatus: 'Good',
        ...breedData,
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.horse.updateMany({
        where: { name: { startsWith: 'TestFixture-ATBT-' } },
        data: { sireId: null, damId: null },
      });
      await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ATBT-' } } });
      if (createdShow) {
        await prisma.show.delete({ where: { name: 'TestFixture-ATBT-Show' } });
      }
    } catch (error) {
      console.warn('ATBT cleanup warning:', error.message);
    }
  });

  describe('assessFeedQuality', () => {
    it('returns feed quality based on health status (Excellent + moderate earnings)', async () => {
      const quality = await assessFeedQuality(excellentMare.id);
      expect(quality).toBeGreaterThan(80);
    });

    it('returns 50 for a mare not found in DB', async () => {
      const quality = await assessFeedQuality(999999997);
      expect(quality).toBe(50);
    });

    it('adjusts quality upward with high earnings', async () => {
      const quality = await assessFeedQuality(richMare.id);
      expect(quality).toBeGreaterThan(70);
    });
  });

  describe('getAncestors', () => {
    it('returns empty array when generations is 0', async () => {
      const ancestors = await getAncestors([sire.id, dam.id], 0);
      expect(ancestors).toEqual([]);
    });

    it('returns empty array for empty horseIds', async () => {
      const ancestors = await getAncestors([], 3);
      expect(ancestors).toEqual([]);
    });

    it('returns immediate parents across multiple starting horses', async () => {
      const ancestors = await getAncestors([parent1.id, parent2.id], 1);
      expect(ancestors).toHaveLength(4);
      const ancestorIds = ancestors.map(a => a.id);
      expect(ancestorIds).toContain(grandSire1.id);
      expect(ancestorIds).toContain(grandDam1.id);
      expect(ancestorIds).toContain(grandSire2.id);
      expect(ancestorIds).toContain(grandDam2.id);
    });
  });

  describe('detectInbreeding', () => {
    it('detects no inbreeding when sire and dam have no common ancestors', async () => {
      const result = await detectInbreeding(parent1.id, parent2.id);
      expect(result.inbreedingDetected).toBe(false);
      expect(result.commonAncestors).toHaveLength(0);
      expect(result.inbreedingCoefficient).toBe(0);
    });

    it('detects inbreeding when sire and dam share a common ancestor', async () => {
      const result = await detectInbreeding(inbredSire.id, inbredDam.id);
      expect(result.inbreedingDetected).toBe(true);
      expect(result.commonAncestors.length).toBeGreaterThan(0);
      const commonIds = result.commonAncestors.map(a => a.id);
      expect(commonIds).toContain(commonAncestor.id);
      expect(result.inbreedingCoefficient).toBeGreaterThan(0);
    });
  });

  describe('analyzeLineage', () => {
    it('detects Racing specialization when >60% of ancestor competition results are Racing', async () => {
      const result = await analyzeLineage(racingSire.id, racingDam.id);
      expect(result.disciplineSpecialization).toBe(true);
      expect(result.specializedDiscipline).toBe('Racing');
      expect(result.specializationStrength).toBeGreaterThan(0.6);
    });

    it('returns no specialization when horses have no competition history', async () => {
      const result = await analyzeLineage(sire.id, dam.id);
      expect(result.disciplineSpecialization).toBe(false);
      expect(result.specializedDiscipline).toBeNull();
      expect(result.totalCompetitions).toBe(0);
    });
  });

  describe('applyEpigeneticTraitsAtBirth', () => {
    it('returns correct structure with traits and breedingAnalysis', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 50,
      });
      expect(result).toHaveProperty('traits');
      expect(result).toHaveProperty('breedingAnalysis');
      expect(Array.isArray(result.traits.positive)).toBe(true);
      expect(Array.isArray(result.traits.negative)).toBe(true);
      expect(Array.isArray(result.traits.hidden)).toBe(true);
      expect(result.breedingAnalysis).toHaveProperty('lineage');
      expect(result.breedingAnalysis).toHaveProperty('inbreeding');
      expect(result.breedingAnalysis).toHaveProperty('conditions');
    });

    it('assigns positive traits with optimal conditions (probabilistic)', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 15, feedQuality: 85 }),
          'hardy',
        ),
      ).toBe(true);
    });

    it('assigns negative traits with poor conditions (probabilistic)', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 80, feedQuality: 25 }),
          'weak_constitution',
          'negative',
        ),
      ).toBe(true);
    });

    it('inbred trait conditions: evaluateTraitConditions correctly gates the trait', () => {
      const inbredConditions = AT_BIRTH_TRAITS.negative.inbred.conditions;
      expect(
        evaluateTraitConditions(inbredConditions, { inbreedingDetected: true, mareStress: 25, feedQuality: 70 }),
      ).toBe(true);
      expect(
        evaluateTraitConditions(inbredConditions, { inbreedingDetected: false, mareStress: 25, feedQuality: 70 }),
      ).toBe(false);
    });

    it('assigns inbred trait when common ancestor detected (probabilistic)', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: inbredSire.id, damId: inbredDam.id }),
          'inbred',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns specialized_lineage when ancestry shows Racing focus (probabilistic)', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: racingSire.id, damId: racingDam.id, mareStress: 30 }),
          'specialized_lineage',
        ),
      ).toBe(true);
    });

    it('throws when mare is not found', async () => {
      await expect(applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: 999999997 })).rejects.toThrow(
        'Mare with ID 999999997 not found',
      );
    });

    it('throws when sireId is missing', async () => {
      await expect(applyEpigeneticTraitsAtBirth({ damId: dam.id })).rejects.toThrow(
        'Both sireId and damId are required',
      );
    });

    it('throws when damId is missing', async () => {
      await expect(applyEpigeneticTraitsAtBirth({ sireId: sire.id })).rejects.toThrow(
        'Both sireId and damId are required',
      );
    });

    it('uses mare stress level from DB when mareStress not provided', async () => {
      const result = await applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id });
      expect(result).toHaveProperty('traits');
      expect(result.breedingAnalysis.conditions).toHaveProperty('mareStress');
    });

    it('returns valid structure regardless of how many traits are applied', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 15,
        feedQuality: 85,
      });
      const totalTraits = result.traits.positive.length + result.traits.negative.length + result.traits.hidden.length;
      expect(totalTraits).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.traits.hidden)).toBe(true);
    });

    it('returns defaults when horses have no lineage records', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 70,
      });
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
    });
  });
});
