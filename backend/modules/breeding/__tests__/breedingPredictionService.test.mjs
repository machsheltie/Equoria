/**
 * breedingPredictionService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path tests (no DB fixture):
 *   calculateTemperamentInfluence — non-existent IDs → throws 'Horse not found'
 *   generateBreedingData — non-existent ID → throws
 *
 * DB-fixture branch coverage:
 *   calculateTemperamentInfluence:
 *     known key 'calm-gentle' → compatibilityScore=90, predictedOffspringTemperament=['balanced']
 *     unknown key (calm+null) → compatibilityScore=50
 *   generateBreedingData:
 *     horse with traits → hasInsufficientData=false, breedingQuality calculated
 *     horse without traits → hasInsufficientData=true, breedingQuality='poor'
 *
 * The calculateInheritanceProbabilities / predictOffspringTraits /
 * calculateFlagInheritanceScore tests were deleted with those functions
 * (owner ruling 2026-10-19, Equoria-6dace fix round 1).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { calculateTemperamentInfluence, generateBreedingData } from '../services/breedingPredictionService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup — a failed delete reds afterAll
// instead of being swallowed (the leak class that trips horseColorNullSentinel).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── Pure-path tests — no fixture ──────────────────────────────────────────────

describe('calculateTemperamentInfluence — non-existent horses', () => {
  it('throws "Horse not found" for non-existent IDs', async () => {
    await expect(calculateTemperamentInfluence(999999991, 999999992)).rejects.toThrow('Horse not found');
  });
});

describe('generateBreedingData — non-existent horse', () => {
  it('throws when horse does not exist', async () => {
    await expect(generateBreedingData(999999991)).rejects.toThrow('not found');
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('breedingPredictionService — DB fixture branch coverage (Equoria-jkht)', () => {
  let bpsUser;
  let bpsStallionCalm; // Stallion, temperament='calm', 4 traits: brave/focused/fearful/bold
  let bpsMareGentle; // Mare, temperament='gentle', 4 traits: brave/gentle/quick_learner/calm
  let bpsHorseNoTraits; // Mare, no traits → hasInsufficientData=true; temperament=null → unknown key
  let bpsHorseRare; // Mare, 1 rare trait (heart) → parentTraitCounts=1 → low (not insufficient)
  const bpsHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    bpsUser = await prisma.user.create({
      data: {
        email: `bps-${ts}-${rand()}@test.com`,
        username: `bps${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'BPS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    bpsStallionCalm = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BPS-StallionCalm-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(),
        age: 4,
        temperament: 'calm',
        userId: bpsUser.id,
      },
    });

    bpsMareGentle = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BPS-MareGentle-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(),
        age: 4,
        temperament: 'gentle',
        userId: bpsUser.id,
      },
    });

    bpsHorseNoTraits = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BPS-NoTraits-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(),
        age: 4,
        userId: bpsUser.id,
      },
    });

    bpsHorseRare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BPS-Rare-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(),
        age: 4,
        userId: bpsUser.id,
      },
    });

    bpsHorseIds.push(bpsStallionCalm.id, bpsMareGentle.id, bpsHorseNoTraits.id, bpsHorseRare.id);

    // bpsStallionCalm traits: brave, focused (rare), fearful (negative), bold.
    // Rare and negative are the roster's ruled rarity (q134) and polarity (q135)
    // (Equoria-qw4kp); the old fixture used off-roster sensitive and stubborn.
    for (const [traitName, extra] of [
      ['brave', {}],
      ['focused', {}], // ruled Rare
      ['fearful', {}], // ruled negative
      ['bold', {}],
    ]) {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: bpsStallionCalm.id,
          traitName,
          sourceType: 'groom',
          ageInDays: 100,
          ...extra,
        },
      });
    }

    // bpsMareGentle traits: brave (stacks with stallion), gentle, quick_learner (epigenetic), calm
    for (const [traitName, extra] of [
      ['brave', {}],
      ['gentle', {}],
      ['quick_learner', { isEpigenetic: true }],
      ['calm', {}],
    ]) {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: bpsMareGentle.id,
          traitName,
          sourceType: 'groom',
          ageInDays: 100,
          ...extra,
        },
      });
    }

    // bpsHorseRare: single rare trait
    await prisma.traitHistoryLog.create({
      data: {
        horseId: bpsHorseRare.id,
        traitName: 'heart', // ruled Legendary
        sourceType: 'groom',
        ageInDays: 100,
      },
    });

    // Equoria-1ohys: scoped, fail-loud cleanup. The 4 fixture horses are
    // independent (no sireId/damId), so a single id-IN deleteMany removes them
    // before the owning user (Horse.userId onDelete:Restrict, schema:282).
    // traitHistoryLog rows cascade on horse delete. A real scope/FK failure now
    // reds afterAll instead of being swallowed.
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: bpsHorseIds } } }), 'bpsHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: bpsUser.id } }), 'bpsUser');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  // ── calculateTemperamentInfluence branches ──────────────────────────────────

  it('calculateTemperamentInfluence: known key "calm-gentle" → compatibilityScore=90', async () => {
    const result = await calculateTemperamentInfluence(bpsStallionCalm.id, bpsMareGentle.id);
    expect(result.stallionTemperament).toBe('calm');
    expect(result.mareTemperament).toBe('gentle');
    expect(result.compatibilityScore).toBe(90);
    // 'calm-gentle' is not in temperamentPredictions → ['balanced']
    expect(result.predictedOffspringTemperament).toEqual(['balanced']);
    expect(result.traitInfluenceModifiers.empathy).toBe(1.3); // mare.temperament==='gentle'
    expect(result.traitInfluenceModifiers.calmness).toBe(1.2); // stallion.temperament==='calm'
  });

  it('calculateTemperamentInfluence: unknown key (calm + null temperament) → compatibilityScore=50', async () => {
    // bpsHorseNoTraits has temperament=null → key='calm-null' → not in matrix → 50
    const result = await calculateTemperamentInfluence(bpsStallionCalm.id, bpsHorseNoTraits.id);
    expect(result.compatibilityScore).toBe(50);
    expect(result.predictedOffspringTemperament).toEqual(['balanced']);
  });

  // ── generateBreedingData branches ───────────────────────────────────────────

  it('generateBreedingData: horse with traits → hasInsufficientData=false, quality computed', async () => {
    const result = await generateBreedingData(bpsStallionCalm.id);
    expect(result.horseId).toBe(bpsStallionCalm.id);
    expect(result.hasInsufficientData).toBe(false);
    expect(result.traitSummary.totalTraits).toBe(4);
    expect(result.traitSummary.rareTraits).toBe(1); // focused
    expect(result.traitSummary.negativeTraits).toBe(1); // fearful
    // score = 2 (traits≥4) + 1 (rare≥1) - 1 (negative) = 2 → 'fair'
    expect(result.breedingQuality).toBe('fair');
    expect(result.epigeneticFlags).toBeDefined();
    expect(result.temperamentInfluence.temperament).toBe('calm');
  });

  it('generateBreedingData: horse without traits → hasInsufficientData=true, quality="poor"', async () => {
    const result = await generateBreedingData(bpsHorseNoTraits.id);
    expect(result.hasInsufficientData).toBe(true);
    expect(result.traitSummary.totalTraits).toBe(0);
    expect(result.breedingQuality).toBe('poor');
  });

  it('generateBreedingData: temperamentInfluence affinities computed correctly for "calm"', async () => {
    const result = await generateBreedingData(bpsStallionCalm.id);
    const { traitAffinities } = result.temperamentInfluence;
    // calm: boldness=low, empathy=medium, calmness=high, energy=low
    expect(traitAffinities.boldness).toBe('low');
    expect(traitAffinities.calmness).toBe('high');
    expect(traitAffinities.energy).toBe('low');
  });
});
