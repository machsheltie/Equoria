/**
 * Tests for logic/enhancedCompetitionSimulation.mjs
 *
 * Covers the pure / validation functions that do not require a live DB:
 *   - validateCompetitionEntry  (async but validates passed-in objects only)
 *   - getCompetitionEligibilitySummary  (synchronous, fully pure)
 *
 * executeEnhancedCompetition is DB-heavy and is covered by competition integration tests.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  validateCompetitionEntry,
  getCompetitionEligibilitySummary,
  executeEnhancedCompetition,
} from '../../../logic/enhancedCompetitionSimulation.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// age is stored in game-days; 7 days = 1 in-game year (checkAgeRequirements uses Math.floor(age/7))
const validHorse = {
  id: 1,
  name: 'Spirit',
  age: 35, // 5 years = 35 days
  healthStatus: 'Good',
  speed: 60,
  stamina: 60,
  intelligence: 60,
  precision: 60,
  agility: 60,
  boldness: 60,
  focus: 60,
  obedience: 60,
  epigeneticModifiers: { positive: [], negative: [] },
  disciplineScores: { Racing: 0 },
};

const validShow = {
  name: 'Spring Sprint',
  discipline: 'Racing',
  levelMin: 1,
  levelMax: 15,
  entryFee: 100,
  showType: 'ridden',
};

const validUser = { id: 'u1', money: 500 };

// ---------------------------------------------------------------------------
// validateCompetitionEntry
// ---------------------------------------------------------------------------

describe('validateCompetitionEntry', () => {
  it('returns eligible:true for a valid horse/show/user', async () => {
    const result = await validateCompetitionEntry(validHorse, validShow, validUser);
    expect(result.eligible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a horse that is too young (age < 3 years = <21 days)', async () => {
    const youngHorse = { ...validHorse, age: 2 }; // 2 days = 0 years → ineligible; age<3 in days also catches the message
    const result = await validateCompetitionEntry(youngHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /too young/i.test(e))).toBe(true);
  });

  it('rejects a horse that is too old (age > 21 years = >147 days)', async () => {
    const oldHorse = { ...validHorse, age: 154 }; // 22 years = 154 days
    const result = await validateCompetitionEntry(oldHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /retired/i.test(e))).toBe(true);
  });

  it('rejects a horse whose health status is not Good or Excellent', async () => {
    const sickHorse = { ...validHorse, healthStatus: 'Poor' };
    const result = await validateCompetitionEntry(sickHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /health/i.test(e))).toBe(true);
  });

  it('accepts a horse with Excellent health status', async () => {
    const excellentHorse = { ...validHorse, healthStatus: 'Excellent' };
    const result = await validateCompetitionEntry(excellentHorse, validShow, validUser);
    expect(result.eligible).toBe(true);
  });

  it('rejects user who cannot afford the entry fee', async () => {
    const brokeUser = { id: 'u2', money: 50 };
    const result = await validateCompetitionEntry(validHorse, validShow, brokeUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /insufficient funds/i.test(e))).toBe(true);
  });

  it('rejects when horse level is below levelMin', async () => {
    // A horse with all-zero stats will have level 1
    const weakHorse = {
      ...validHorse,
      speed: 0,
      stamina: 0,
      intelligence: 0,
      precision: 0,
      agility: 0,
      boldness: 0,
      focus: 0,
      obedience: 0,
    };
    const highMinShow = { ...validShow, levelMin: 10, levelMax: 15 };
    const result = await validateCompetitionEntry(weakHorse, highMinShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /level/i.test(e))).toBe(true);
  });

  it('rejects when horse level exceeds levelMax', async () => {
    const strongHorse = { ...validHorse, speed: 300, stamina: 300, intelligence: 300 };
    const lowMaxShow = { ...validShow, levelMin: 1, levelMax: 2 };
    const result = await validateCompetitionEntry(strongHorse, lowMaxShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /level/i.test(e))).toBe(true);
  });

  it('returns horseLevel and disciplineScore in result', async () => {
    const result = await validateCompetitionEntry(validHorse, validShow, validUser);
    expect(typeof result.horseLevel).toBe('number');
    expect(result.horseLevel).toBeGreaterThanOrEqual(1);
    expect(typeof result.disciplineScore).toBe('number');
  });

  it('accumulates multiple validation errors when multiple conditions fail', async () => {
    // age:1 (1 day = 0 years, < 3 raw days so too-young message fires), health:Critical, broke user
    const badHorse = { ...validHorse, age: 1, healthStatus: 'Critical' };
    const badUser = { id: 'u3', money: 0 };
    const result = await validateCompetitionEntry(badHorse, validShow, badUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('handles thrown errors gracefully and returns eligible:false', async () => {
    // Pass null as horse to trigger an error path
    const result = await validateCompetitionEntry(null, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCompetitionEligibilitySummary
// ---------------------------------------------------------------------------

describe('getCompetitionEligibilitySummary', () => {
  it('returns a summary object with required fields', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary).toHaveProperty('horseLevel');
    expect(summary).toHaveProperty('ageEligible');
    expect(summary).toHaveProperty('traitEligible');
    expect(summary).toHaveProperty('disciplineStats');
    expect(summary).toHaveProperty('currentAge');
    expect(summary).toHaveProperty('healthStatus');
    expect(summary).toHaveProperty('disciplineScore');
  });

  it('marks age-eligible for a 5-year-old horse (35 days)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.ageEligible).toBe(true);
    expect(summary.currentAge).toBe(35); // raw day value stored on horse
  });

  it('marks age-ineligible for a 2-day-old horse (0 years)', () => {
    const youngHorse = { ...validHorse, age: 2 }; // 2 days = 0 years
    const summary = getCompetitionEligibilitySummary(youngHorse, 'Racing');
    expect(summary.ageEligible).toBe(false);
  });

  it('marks age-ineligible for a 154-day-old horse (22 years)', () => {
    const oldHorse = { ...validHorse, age: 154 }; // 22 years = 154 days
    const summary = getCompetitionEligibilitySummary(oldHorse, 'Racing');
    expect(summary.ageEligible).toBe(false);
  });

  it('returns traitEligible:true for disciplines that have no required trait', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.traitEligible).toBe(true);
  });

  it('reflects the discipline-specific stat list', () => {
    const racingSummary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(Array.isArray(racingSummary.disciplineStats)).toBe(true);
    expect(racingSummary.disciplineStats.length).toBeGreaterThan(0);

    const dressageSummary = getCompetitionEligibilitySummary(validHorse, 'Dressage');
    expect(Array.isArray(dressageSummary.disciplineStats)).toBe(true);
  });

  it('calculates horseLevel as a positive integer', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(Number.isInteger(summary.horseLevel)).toBe(true);
    expect(summary.horseLevel).toBeGreaterThanOrEqual(1);
  });

  it('returns disciplineScore from horse.disciplineScores', () => {
    const horseWithScore = { ...validHorse, disciplineScores: { Racing: 42 } };
    const summary = getCompetitionEligibilitySummary(horseWithScore, 'Racing');
    expect(summary.disciplineScore).toBe(42);
  });

  it('returns 0 disciplineScore when horse has no disciplineScores', () => {
    const horseNoScore = { ...validHorse, disciplineScores: undefined };
    const summary = getCompetitionEligibilitySummary(horseNoScore, 'Racing');
    expect(summary.disciplineScore).toBe(0);
  });

  it('returns healthStatus from horse', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.healthStatus).toBe('Good');
  });

  it('returns fallback summary on invalid horse input', () => {
    const summary = getCompetitionEligibilitySummary(null, 'Racing');
    // Fallback returns horseLevel:1 and ageEligible:false (no .eligible field on summary)
    expect(summary.horseLevel).toBe(1);
    expect(summary.ageEligible).toBe(false);
  });

  it('handles unknown discipline gracefully', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'UnknownSport');
    expect(summary).toBeDefined();
    expect(summary.horseLevel).toBeGreaterThanOrEqual(1);
  });

  it('requiredTrait is null for non-Gaited discipline (|| null branch)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.requiredTrait).toBeNull();
  });

  it('requiredTrait is "gaited" for Gaited discipline (requiresTrait branch)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Gaited');
    expect(summary.requiredTrait).toBe('gaited');
  });

  it('traitEligible is false for horse without "gaited" in Gaited discipline', () => {
    const horseNoGaited = { ...validHorse, epigeneticModifiers: { positive: [], negative: [] } };
    const summary = getCompetitionEligibilitySummary(horseNoGaited, 'Gaited');
    expect(summary.traitEligible).toBe(false);
  });

  it('traitEligible is true for horse with "gaited" trait in Gaited discipline', () => {
    const horseGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: ['gaited'], negative: [] },
    };
    const summary = getCompetitionEligibilitySummary(horseGaited, 'Gaited');
    expect(summary.traitEligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateCompetitionEntry — trait-failure branch (lines 52-54) (Equoria-jkht)
// ---------------------------------------------------------------------------

describe('validateCompetitionEntry — trait-failure branch', () => {
  it('rejects horse without gaited trait entering Gaited discipline (lines 52-54)', async () => {
    const gaitedShow = {
      name: 'Gaited Classic',
      discipline: 'Gaited',
      levelMin: 1,
      levelMax: 15,
      entryFee: 0,
      showType: 'ridden',
    };
    const horseNoGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: [], negative: [] },
    };
    const result = await validateCompetitionEntry(horseNoGaited, gaitedShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /gaited/i.test(e))).toBe(true);
  });

  it('accepts horse with gaited trait entering Gaited discipline', async () => {
    const gaitedShow = {
      name: 'Gaited Classic',
      discipline: 'Gaited',
      levelMin: 1,
      levelMax: 15,
      entryFee: 0,
      showType: 'ridden',
    };
    const horseGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: ['gaited'], negative: [] },
    };
    const result = await validateCompetitionEntry(horseGaited, gaitedShow, validUser);
    expect(result.errors.every(e => !/gaited/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeEnhancedCompetition — DB fixture integration (Equoria-rr7)
// Covers lines 113-296: score calc, placements (1-4), ordinal strings,
// prize/XP distribution, statGain null arm, horseXpResult.success arm.
// ---------------------------------------------------------------------------

describe('executeEnhancedCompetition — DB fixture integration (Equoria-rr7)', () => {
  let ecsUser, ecsShow, ecsHorse1, ecsHorse2, ecsHorse3, ecsHorse4;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ecsUser = await prisma.user.create({
      data: {
        email: `ecs-${ts}-${rand()}@test.com`,
        username: `ecs${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ECS',
        lastName: 'Tester',
        money: 10000,
      },
    });

    // 4 horses with tiered Racing stats (speed+stamina+intelligence).
    // Tier gaps are large enough that ±9% luck cannot cause crossover.
    // Tier1≈240, Tier2≈180, Tier3≈120, Tier4≈60 — min gap 49 > max luck (24).
    ecsHorse1 = await prisma.horse.create({
      data: {
        name: `TestFixture-ECS-Horse1-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date('2019-01-01'),
        age: 35,
        userId: ecsUser.id,
        speed: 80,
        stamina: 80,
        intelligence: 80,
      },
    });
    ecsHorse2 = await prisma.horse.create({
      data: {
        name: `TestFixture-ECS-Horse2-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date('2019-01-01'),
        age: 35,
        userId: ecsUser.id,
        speed: 60,
        stamina: 60,
        intelligence: 60,
      },
    });
    ecsHorse3 = await prisma.horse.create({
      data: {
        name: `TestFixture-ECS-Horse3-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date('2019-01-01'),
        age: 35,
        userId: ecsUser.id,
        speed: 40,
        stamina: 40,
        intelligence: 40,
      },
    });
    ecsHorse4 = await prisma.horse.create({
      data: {
        name: `TestFixture-ECS-Horse4-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date('2019-01-01'),
        age: 35,
        userId: ecsUser.id,
        speed: 20,
        stamina: 20,
        intelligence: 20,
      },
    });

    ecsShow = await prisma.show.create({
      data: {
        name: `TestFixture-ECS-Show-${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 15,
        entryFee: 50,
        prize: 500,
        runDate: new Date(),
        showType: 'ridden',
      },
    });
  }, 60000);

  afterAll(async () => {
    if (ecsShow?.id) {
      await prisma.competitionResult.deleteMany({ where: { showId: ecsShow.id } }).catch(() => {});
      await prisma.show.delete({ where: { id: ecsShow.id } }).catch(() => {});
    }
    const horseIds = [ecsHorse1?.id, ecsHorse2?.id, ecsHorse3?.id, ecsHorse4?.id].filter(Boolean);
    if (horseIds.length) {
      await prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } }).catch(() => {});
      await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-ECS-' } } }).catch(() => {});
    }
    if (ecsUser?.id) {
      await prisma.xpEvent.deleteMany({ where: { userId: ecsUser.id } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: ecsUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: ecsUser.id } }).catch(() => {});
    }
  }, 30000);

  it('returns success:true with 4 results covering all placement branches (lines 113-296)', async () => {
    const entries = [
      { horse: ecsHorse1, user: ecsUser },
      { horse: ecsHorse2, user: ecsUser },
      { horse: ecsHorse3, user: ecsUser },
      { horse: ecsHorse4, user: ecsUser },
    ];

    const result = await executeEnhancedCompetition(ecsShow, entries);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(4);
    expect(result.showName).toBe(ecsShow.name);
    expect(result.discipline).toBe('Racing');
    expect(typeof result.totalPrizeDistributed).toBe('number');
    expect(typeof result.totalXPAwarded).toBe('number');
    expect(Array.isArray(result.statGains)).toBe(true);

    // All four ordinal strings exercised
    const placements = result.results.map(r => r.placement).sort((a, b) => a - b);
    expect(placements).toEqual([1, 2, 3, 4]);

    // 4th place always gets 0 prize (covers placement > 3 branch)
    const fourthPlace = result.results.find(r => r.placement === 4);
    expect(fourthPlace.prizeWon).toBe(0);

    // 1st place gets XP bonus
    const firstPlace = result.results.find(r => r.placement === 1);
    expect(firstPlace.xpGained).toBeGreaterThan(0);

    // Prizes distributed only to top-3
    expect(result.totalPrizeDistributed).toBe(500); // 50%+30%+20% of 500
  });

  it('returns success:false for executeEnhancedCompetition outer catch (lines 297-305)', async () => {
    // horse:null causes calculateCompetitionScore to throw inside entries.map(),
    // which is caught by the outer catch; show is real so showId access succeeds.
    const result = await executeEnhancedCompetition(ecsShow, [{ horse: null, user: ecsUser }]);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.showId).toBe(ecsShow.id);
  });
});
