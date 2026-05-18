/**
 * Integration Test: Apply Epigenetic Traits At Birth (atBirthTraits.mjs)
 *
 * Validates the async DB-calling applyEpigeneticTraitsAtBirth() from
 * atBirthTraits.mjs against real database fixtures. Probabilistic trait
 * assertions use a retry loop (up to 50 runs) to be statistically robust
 * without controlling Math.random.
 *
 * BUSINESS RULES TESTED:
 * - Positive traits: hardy (25%), well_bred (20%), premium_care (15%)
 * - Negative traits: weak_constitution (35%), stressed_lineage (25%), poor_nutrition (40%), inbred (60%)
 * - Inbreeding detection: common ancestor in both sire and dam lineage
 * - Discipline specialization: >60% competitions in same discipline → specialized_lineage (30%)
 * - Error handling: missing IDs, non-existent mare
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import prisma from '../db/index.mjs';
import { applyEpigeneticTraitsAtBirth } from '../utils/atBirthTraits.mjs';
import { fixtureColor } from './helpers/fixtureColor.mjs';

async function traitAppears(fn, traitName, category = 'positive', maxRuns = 50) {
  for (let i = 0; i < maxRuns; i++) {
    const result = await fn();
    if (result.traits[category].includes(traitName)) {
      return true;
    }
  }
  return false;
}

describe('Apply Epigenetic Traits At Birth (atBirthTraits.mjs) — DB Integration', () => {
  let breed;
  let testShow;
  let createdShow = false;
  let sire, dam;
  let commonAncestor, inbredSire, inbredDam;
  let racingAncestor, racingSire, racingDam;

  beforeAll(async () => {
    breed = await prisma.breed.findFirst();

    testShow = await prisma.show.findFirst();
    if (!testShow) {
      testShow = await prisma.show.create({
        data: {
          name: 'TestFixture-ATB8-Show',
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
    // Equoria-qtyv8: spread fixtureColor() alongside the optional breedId so
    // every fixture horse below gets a non-NULL colorGenotype + phenotype
    // (the canonical-DB invariant; color is not the SUT here). `breedData`
    // is already spread into every create, so this propagates uniformly.
    const breedData = { ...fixtureColor(), ...(breed ? { breedId: breed.id } : {}) };

    sire = await prisma.horse.create({
      data: { name: 'TestFixture-ATB8-Sire', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    dam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATB8-Dam',
        sex: 'Mare',
        dateOfBirth,
        stressLevel: 10,
        healthStatus: 'Excellent',
        totalEarnings: 200000,
        ...breedData,
      },
    });

    commonAncestor = await prisma.horse.create({
      data: { name: 'TestFixture-ATB8-CommonAncestor', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    inbredSire = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATB8-InbredSire',
        sex: 'Stallion',
        dateOfBirth,
        sireId: commonAncestor.id,
        ...breedData,
      },
    });
    inbredDam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATB8-InbredDam',
        sex: 'Mare',
        dateOfBirth,
        sireId: commonAncestor.id,
        stressLevel: 30,
        healthStatus: 'Good',
        ...breedData,
      },
    });

    racingAncestor = await prisma.horse.create({
      data: { name: 'TestFixture-ATB8-RacingAncestor', sex: 'Stallion', dateOfBirth, ...breedData },
    });
    racingSire = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATB8-RacingSire',
        sex: 'Stallion',
        dateOfBirth,
        sireId: racingAncestor.id,
        ...breedData,
      },
    });
    racingDam = await prisma.horse.create({
      data: {
        name: 'TestFixture-ATB8-RacingDam',
        sex: 'Mare',
        dateOfBirth,
        stressLevel: 35,
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
          placement: '1st',
          score: 90,
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
  });

  afterAll(async () => {
    try {
      await prisma.horse.updateMany({
        where: { name: { startsWith: 'TestFixture-ATB8-' } },
        data: { sireId: null, damId: null },
      });
      await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ATB8-' } } });
      if (createdShow) {
        await prisma.show.delete({ where: { name: 'TestFixture-ATB8-Show' } });
      }
    } catch (error) {
      console.warn('ATB8 cleanup warning:', error.message);
    }
  });

  describe('Low-stress premium-fed mare produces positive traits', () => {
    it('assigns hardy trait with low stress and premium feed', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 15, feedQuality: 85 }),
          'hardy',
        ),
      ).toBe(true);
    });

    it('assigns well_bred trait with optimal conditions and no inbreeding', async () => {
      const check = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 25,
        feedQuality: 75,
      });
      expect(check.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 25, feedQuality: 75 }),
          'well_bred',
        ),
      ).toBe(true);
    });

    it('assigns premium_care trait with exceptional conditions', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 8, feedQuality: 95 }),
          'premium_care',
        ),
      ).toBe(true);
    });

    it('does not assign positive traits when stress is too high', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 60,
        feedQuality: 90,
      });
      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });

    it('does not assign positive traits when feed quality is too low', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 15,
        feedQuality: 50,
      });
      expect(result.traits.positive).not.toContain('hardy');
      expect(result.traits.positive).not.toContain('well_bred');
      expect(result.traits.positive).not.toContain('premium_care');
    });
  });

  describe('Inbreeding detection triggers negative traits', () => {
    it('assigns inbred trait when common ancestor detected in both lineages', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: inbredSire.id, damId: inbredDam.id }),
          'inbred',
          'negative',
        ),
      ).toBe(true);
    });

    it('detects common ancestor in breeding analysis', async () => {
      const result = await applyEpigeneticTraitsAtBirth({ sireId: inbredSire.id, damId: inbredDam.id });
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(true);
      expect(result.breedingAnalysis.inbreeding.commonAncestors.length).toBeGreaterThan(0);
      const ancestorIds = result.breedingAnalysis.inbreeding.commonAncestors.map(a => a.id);
      expect(ancestorIds).toContain(commonAncestor.id);
    });

    it('does not assign inbred trait without common ancestors', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 70,
      });
      expect(result.traits.negative).not.toContain('inbred');
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
      expect(result.breedingAnalysis.inbreeding.commonAncestors).toHaveLength(0);
    });
  });

  describe('Poor breeding conditions trigger negative traits', () => {
    it('assigns weak_constitution trait with high stress and poor feed', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 75, feedQuality: 35 }),
          'weak_constitution',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns stressed_lineage trait with high mare stress', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 65, feedQuality: 50 }),
          'stressed_lineage',
          'negative',
        ),
      ).toBe(true);
    });

    it('assigns poor_nutrition trait with very poor feed quality', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 40, feedQuality: 25 }),
          'poor_nutrition',
          'negative',
        ),
      ).toBe(true);
    });
  });

  describe('Discipline specialization produces legacy traits', () => {
    it('detects Racing specialization when ancestors have 80% racing results', async () => {
      const result = await applyEpigeneticTraitsAtBirth({ sireId: racingSire.id, damId: racingDam.id, mareStress: 35 });
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(true);
      expect(result.breedingAnalysis.lineage.specializedDiscipline).toBe('Racing');
      expect(result.breedingAnalysis.lineage.specializationStrength).toBeGreaterThan(0.6);
    });

    it('assigns specialized_lineage trait with Racing ancestry', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: racingSire.id, damId: racingDam.id, mareStress: 35 }),
          'specialized_lineage',
        ),
      ).toBe(true);
    });

    it('does not assign specialized_lineage without sufficient discipline focus', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 50,
      });
      expect(result.traits.positive).not.toContain('specialized_lineage');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.lineage.specializedDiscipline).toBeNull();
    });

    it('handles empty competition history gracefully', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 50,
      });
      expect(result.traits.positive).not.toContain('specialized_lineage');
      expect(result.breedingAnalysis.lineage.totalCompetitions).toBe(0);
    });
  });

  describe('Return value structure', () => {
    it('always returns traits and breedingAnalysis with expected shape', async () => {
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

    it('applies positive traits under optimal conditions (smoke test)', async () => {
      expect(
        await traitAppears(
          () => applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: dam.id, mareStress: 8, feedQuality: 95 }),
          'hardy',
        ),
      ).toBe(true);
    });
  });

  describe('Error handling', () => {
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

    it('throws when mare is not found in database', async () => {
      await expect(applyEpigeneticTraitsAtBirth({ sireId: sire.id, damId: 999999999 })).rejects.toThrow(
        'Mare with ID 999999999 not found',
      );
    });

    it('returns valid structure for horses with no lineage records', async () => {
      const result = await applyEpigeneticTraitsAtBirth({
        sireId: sire.id,
        damId: dam.id,
        mareStress: 30,
        feedQuality: 70,
      });
      expect(result).toHaveProperty('traits');
      expect(result.breedingAnalysis.lineage.disciplineSpecialization).toBe(false);
      expect(result.breedingAnalysis.inbreeding.inbreedingDetected).toBe(false);
    });
  });
});
