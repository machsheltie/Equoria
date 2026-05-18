/**
 * breedingPredictionService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path tests (no DB fixture):
 *   calculateInheritanceProbabilities — non-existent IDs → hasInsufficientData=true (not a throw)
 *   calculateTemperamentInfluence — non-existent IDs → throws 'Horse not found'
 *   generateBreedingData — non-existent ID → throws
 *
 * DB-fixture branch coverage:
 *   calculateInheritanceProbabilities:
 *     both parents share 'brave' → stacking, probability=65, hasStacking=true
 *     single-parent rare 'sensitive' → probability=35 (+10 rare bonus)
 *     single-parent negative 'stubborn' → probability=20 (-5 negative penalty)
 *     single-parent epigenetic 'quick_learner' → probability=30 (+5 epigenetic bonus)
 *     summary.hasInsufficientData=true when no traits exist
 *   calculateTemperamentInfluence:
 *     known key 'calm-gentle' → compatibilityScore=90, predictedOffspringTemperament=['balanced']
 *     unknown key (calm+null) → compatibilityScore=50
 *   predictOffspringTraits confidenceLevel branches:
 *     hasInsufficientData=true → 'low'
 *     parentTraitCounts=1 (not insufficient) → 'low'
 *     parentTraitCounts=4 → 'medium'
 *     parentTraitCounts=7 → 'high'
 *   generateBreedingData:
 *     horse with traits → hasInsufficientData=false, breedingQuality calculated
 *     horse without traits → hasInsufficientData=true, breedingQuality='poor'
 *   calculateFlagInheritanceScore → returns combined inheritance categories + individual flags
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateInheritanceProbabilities,
  calculateFlagInheritanceScore,
  calculateTemperamentInfluence,
  predictOffspringTraits,
  generateBreedingData,
} from '../../../services/breedingPredictionService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// ── Pure-path tests — no fixture ──────────────────────────────────────────────

describe('calculateInheritanceProbabilities — non-existent horses', () => {
  it('returns hasInsufficientData=true for non-existent horse pair (no throw)', async () => {
    const result = await calculateInheritanceProbabilities(999999991, 999999992);
    expect(result.hasInsufficientData).toBe(true);
    expect(result.traitProbabilities).toHaveLength(0);
    expect(result.stallionId).toBe(999999991);
    expect(result.mareId).toBe(999999992);
    expect(result.summary.totalTraitsConsidered).toBe(0);
  });
});

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
  let bpsStallionCalm; // Stallion, temperament='calm', 4 traits: brave/sensitive/stubborn/bold
  let bpsMareGentle; // Mare, temperament='gentle', 4 traits: brave/gentle/quick_learner/calm
  let bpsHorseNoTraits; // Mare, no traits → hasInsufficientData=true; temperament=null → unknown key
  let bpsHorseRare; // Mare, 1 rare trait (charismatic) → parentTraitCounts=1 → low (not insufficient)

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

    // bpsStallionCalm traits: brave, sensitive (rare), stubborn (negative), bold
    for (const [traitName, extra] of [
      ['brave', {}],
      ['sensitive', {}], // in RARE_TRAITS
      ['stubborn', {}], // in NEGATIVE_TRAITS
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
        traitName: 'charismatic', // in RARE_TRAITS
        sourceType: 'groom',
        ageInDays: 100,
      },
    });
  }, 60000);

  afterAll(async () => {
    // traitHistoryLog cascades on horse delete
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-BPS-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: bpsUser?.id } }).catch(() => {});
  }, 30000);

  // ── calculateInheritanceProbabilities probability branches ──────────────────

  it('calculateInheritanceProbabilities: both parents share "brave" → stacking, probability=65', async () => {
    const result = await calculateInheritanceProbabilities(bpsStallionCalm.id, bpsMareGentle.id);
    const braveTrait = result.traitProbabilities.find(t => t.traitName === 'brave');
    expect(braveTrait).toBeDefined();
    expect(braveTrait.hasStacking).toBe(true);
    expect(braveTrait.probability).toBe(65);
    expect(braveTrait.parentSources.stallion).toBe(true);
    expect(braveTrait.parentSources.mare).toBe(true);
  });

  it('calculateInheritanceProbabilities: single-parent rare "sensitive" → probability=35', async () => {
    const result = await calculateInheritanceProbabilities(bpsStallionCalm.id, bpsMareGentle.id);
    const sensitiveTrait = result.traitProbabilities.find(t => t.traitName === 'sensitive');
    expect(sensitiveTrait).toBeDefined();
    expect(sensitiveTrait.isRare).toBe(true);
    expect(sensitiveTrait.probability).toBe(35); // 25 + 10 rare bonus
    expect(sensitiveTrait.hasStacking).toBe(false);
    expect(sensitiveTrait.parentSources.stallion).toBe(true);
    expect(sensitiveTrait.parentSources.mare).toBe(false);
  });

  it('calculateInheritanceProbabilities: single-parent negative "stubborn" → probability=20', async () => {
    const result = await calculateInheritanceProbabilities(bpsStallionCalm.id, bpsMareGentle.id);
    const stubbornTrait = result.traitProbabilities.find(t => t.traitName === 'stubborn');
    expect(stubbornTrait).toBeDefined();
    expect(stubbornTrait.isNegative).toBe(true);
    expect(stubbornTrait.probability).toBe(20); // 25 - 5 negative penalty
    expect(stubbornTrait.hasStacking).toBe(false);
  });

  it('calculateInheritanceProbabilities: single-parent epigenetic "quick_learner" → probability=30', async () => {
    const result = await calculateInheritanceProbabilities(bpsStallionCalm.id, bpsMareGentle.id);
    const qlTrait = result.traitProbabilities.find(t => t.traitName === 'quick_learner');
    expect(qlTrait).toBeDefined();
    expect(qlTrait.isEpigenetic).toBe(true);
    expect(qlTrait.probability).toBe(30); // 25 + 5 epigenetic bonus
    expect(qlTrait.hasStacking).toBe(false);
  });

  it('calculateInheritanceProbabilities: horse with no traits → hasInsufficientData=true', async () => {
    const result = await calculateInheritanceProbabilities(bpsHorseNoTraits.id, bpsHorseNoTraits.id);
    expect(result.hasInsufficientData).toBe(true);
    expect(result.traitProbabilities).toHaveLength(0);
  });

  it('calculateInheritanceProbabilities: summary statistics are correct', async () => {
    const result = await calculateInheritanceProbabilities(bpsStallionCalm.id, bpsMareGentle.id);
    expect(result.summary.totalTraitsConsidered).toBe(7); // brave/sensitive/stubborn/bold/gentle/quick_learner/calm
    expect(result.summary.rareTraits).toBe(1); // sensitive
    expect(result.summary.negativeTraits).toBe(1); // stubborn
    expect(result.summary.stackingTraits).toBe(1); // brave
    expect(result.summary.averageInheritanceChance).toBeGreaterThan(0);
    expect(result.hasInsufficientData).toBe(false);
  });

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

  // ── predictOffspringTraits confidenceLevel branches ─────────────────────────

  it('predictOffspringTraits: hasInsufficientData=true → confidenceLevel="low"', async () => {
    const result = await predictOffspringTraits(bpsHorseNoTraits.id, bpsHorseNoTraits.id);
    expect(result.confidenceLevel).toBe('low');
  });

  it('predictOffspringTraits: parentTraitCounts=1 (not insufficient) → confidenceLevel="low"', async () => {
    // bpsHorseRare (1 rare trait) + bpsHorseNoTraits (0 traits) → parentTraitCounts=1 < 3
    const result = await predictOffspringTraits(bpsHorseRare.id, bpsHorseNoTraits.id);
    expect(result.confidenceLevel).toBe('low');
    expect(result.parentTraitData.totalParentTraits).toBe(1);
  });

  it('predictOffspringTraits: parentTraitCounts=4 → confidenceLevel="medium"', async () => {
    // bpsHorseNoTraits (0) + bpsMareGentle (4 traits) → parentTraitCounts=4 ≥3 → medium
    const result = await predictOffspringTraits(bpsHorseNoTraits.id, bpsMareGentle.id);
    expect(result.confidenceLevel).toBe('medium');
    expect(result.parentTraitData.totalParentTraits).toBe(4);
  });

  it('predictOffspringTraits: parentTraitCounts=7 → confidenceLevel="high"', async () => {
    // stallion (4 traits) + mare (4 traits), 1 shared (brave) → 7 unique traits all >0
    const result = await predictOffspringTraits(bpsStallionCalm.id, bpsMareGentle.id);
    expect(result.confidenceLevel).toBe('high');
    expect(result.parentTraitData.totalParentTraits).toBe(7);
    expect(result.isEstimate).toBe(true);
    expect(typeof result.estimatedTraitCount.min).toBe('number');
    expect(typeof result.estimatedTraitCount.max).toBe('number');
  });

  // ── generateBreedingData branches ───────────────────────────────────────────

  it('generateBreedingData: horse with traits → hasInsufficientData=false, quality computed', async () => {
    const result = await generateBreedingData(bpsStallionCalm.id);
    expect(result.horseId).toBe(bpsStallionCalm.id);
    expect(result.hasInsufficientData).toBe(false);
    expect(result.traitSummary.totalTraits).toBe(4);
    expect(result.traitSummary.rareTraits).toBe(1); // sensitive
    expect(result.traitSummary.negativeTraits).toBe(1); // stubborn
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

  // ── calculateFlagInheritanceScore ────────────────────────────────────────────

  it('calculateFlagInheritanceScore: returns combined inheritance categories and flag scores', async () => {
    const result = await calculateFlagInheritanceScore(bpsStallionCalm.id, bpsMareGentle.id);
    expect(result.stallionId).toBe(bpsStallionCalm.id);
    expect(result.mareId).toBe(bpsMareGentle.id);
    expect(typeof result.combinedScore).toBe('number');
    expect(typeof result.inheritanceCategories).toBe('object');
    expect(result.stallionFlags).toBeDefined();
    expect(result.mareFlags).toBeDefined();
    expect(typeof result.stallionFlags.totalFlags).toBe('number');
    expect(typeof result.mareFlags.totalFlags).toBe('number');
  });

  it('calculateFlagInheritanceScore: non-existent pair returns 0 combinedScore', async () => {
    const result = await calculateFlagInheritanceScore(999999991, 999999992);
    expect(result.combinedScore).toBe(0);
  });
});
