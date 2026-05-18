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
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Equoria-8y0v: Horse.age stores GAME-YEARS directly (per Equoria-son6).
// checkAgeRequirements compares horse.age >= 3 && <= 21 with no /7 conversion.
const validHorse = {
  id: 1,
  name: 'Spirit',
  age: 5, // 5 game-years (eligible: 3-21)
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

  it('rejects a horse that is too young (age < 3 game-years)', async () => {
    const youngHorse = { ...validHorse, age: 2 }; // 2 game-years → ineligible
    const result = await validateCompetitionEntry(youngHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /too young/i.test(e))).toBe(true);
  });

  it('rejects a horse that is too old (age > 21 game-years)', async () => {
    const oldHorse = { ...validHorse, age: 22 }; // 22 game-years → retired
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

  it('marks age-eligible for a 5-year-old horse', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.ageEligible).toBe(true);
    expect(summary.currentAge).toBe(5); // raw game-year value stored on horse
  });

  it('marks age-ineligible for a 2-year-old horse (under minimum)', () => {
    const youngHorse = { ...validHorse, age: 2 };
    const summary = getCompetitionEligibilitySummary(youngHorse, 'Racing');
    expect(summary.ageEligible).toBe(false);
  });

  it('marks age-ineligible for a 22-year-old horse (retired)', () => {
    const oldHorse = { ...validHorse, age: 22 };
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
        ...fixtureColor(),
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
        ...fixtureColor(),
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
        ...fixtureColor(),
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
        ...fixtureColor(),
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
    // Use a FRESH open show — the prior test marked ecsShow as 'completed' via
    // the Equoria-mzy1 idempotency flip, which would now short-circuit before
    // the catch block. We want to genuinely exercise the catch path.
    const freshShow = await prisma.show.create({
      data: {
        name: `TestFixture-ECS-FreshCatch-${Date.now()}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 15,
        entryFee: 50,
        prize: 500,
        runDate: new Date(),
        showType: 'ridden',
        status: 'open',
      },
    });

    try {
      const result = await executeEnhancedCompetition(freshShow, [{ horse: null, user: ecsUser }]);
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.showId).toBe(freshShow.id);
    } finally {
      await prisma.show.delete({ where: { id: freshShow.id } }).catch(() => {});
    }
  });
});

// ---------------------------------------------------------------------------
// executeEnhancedCompetition — idempotency (Equoria-mzy1, mirrors Equoria-08ln)
// ---------------------------------------------------------------------------
// Adjacent-locations check (OPTIMAL_FIX_DISCIPLINE §3): conformation's
// executeConformationShow has a pre-transaction status read + atomic
// updateMany flip preventing double execution. The ridden-show path
// executeEnhancedCompetition previously relied solely on the caller's
// placement=null entries filter as an implicit guard — which works for
// sequential calls but races on concurrent /execute calls (both readers
// can see entries with placement=null before either writes results).
//
// Sentinel-positive test pair: first call succeeds and marks show
// status='completed'; second call rejects with success=false; horse/user
// state must not double-mutate.
describe('executeEnhancedCompetition — idempotency (Equoria-mzy1)', () => {
  let idemUser, idemShow, idemHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    idemUser = await prisma.user.create({
      data: {
        email: `idem-${ts}-${rand()}@test.com`,
        username: `idem${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'IDEM',
        lastName: 'Tester',
        money: 1000,
      },
    });

    idemHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-IDEM-Horse-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-01-01'),
        age: 35,
        userId: idemUser.id,
        speed: 80,
        stamina: 80,
        intelligence: 80,
      },
    });
  }, 60000);

  afterAll(async () => {
    if (idemShow?.id) {
      await prisma.competitionResult.deleteMany({ where: { showId: idemShow.id } }).catch(() => {});
      await prisma.show.delete({ where: { id: idemShow.id } }).catch(() => {});
    }
    if (idemHorse?.id) {
      await prisma.horseXpEvent.deleteMany({ where: { horseId: idemHorse.id } }).catch(() => {});
      await prisma.horse.delete({ where: { id: idemHorse.id } }).catch(() => {});
    }
    if (idemUser?.id) {
      await prisma.xpEvent.deleteMany({ where: { userId: idemUser.id } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { userId: idemUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: idemUser.id } }).catch(() => {});
    }
  }, 30000);

  it('first call succeeds and marks show.status = "completed"', async () => {
    const ts = Date.now();
    idemShow = await prisma.show.create({
      data: {
        name: `TestFixture-IDEM-Show-First-${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 15,
        entryFee: 50,
        prize: 500,
        runDate: new Date(),
        showType: 'ridden',
        status: 'open',
      },
    });

    const entries = [{ horse: idemHorse, user: idemUser }];
    const result = await executeEnhancedCompetition(idemShow, entries);

    expect(result.success).toBe(true);

    const showAfter = await prisma.show.findUnique({ where: { id: idemShow.id } });
    expect(showAfter.status).toBe('completed');
  });

  it('second call on the same showId rejects with success=false', async () => {
    // Sentinel-positive: re-running on the same show must not mutate state.
    const ts = Date.now();
    const show2 = await prisma.show.create({
      data: {
        name: `TestFixture-IDEM-Show-Second-${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 15,
        entryFee: 50,
        prize: 500,
        runDate: new Date(),
        showType: 'ridden',
        status: 'open',
      },
    });

    try {
      const entries = [{ horse: idemHorse, user: idemUser }];
      const moneyBefore = (await prisma.user.findUnique({ where: { id: idemUser.id } })).money;

      const first = await executeEnhancedCompetition(show2, entries);
      expect(first.success).toBe(true);

      const moneyAfterFirst = (await prisma.user.findUnique({ where: { id: idemUser.id } })).money;
      expect(moneyAfterFirst).toBeGreaterThan(moneyBefore);

      // Pass the show object back — the function should detect it's now completed.
      const showAfterFirst = await prisma.show.findUnique({ where: { id: show2.id } });
      const second = await executeEnhancedCompetition(showAfterFirst, entries);

      expect(second.success).toBe(false);
      expect(String(second.error)).toMatch(/already executed|completed/i);

      const moneyAfterSecond = (await prisma.user.findUnique({ where: { id: idemUser.id } })).money;
      expect(moneyAfterSecond).toBe(moneyAfterFirst);

      // No additional CompetitionResult rows beyond the first execution.
      const resultCount = await prisma.competitionResult.count({ where: { showId: show2.id } });
      expect(resultCount).toBe(1);
    } finally {
      await prisma.competitionResult.deleteMany({ where: { showId: show2.id } }).catch(() => {});
      await prisma.show.delete({ where: { id: show2.id } }).catch(() => {});
    }
  });

  it('rejects a show that was created with status=completed (sentinel)', async () => {
    // Covers the case where some other path (admin override, data import,
    // legacy fixture) sets status=completed without going through the
    // execute path. The idempotency guard must trust persisted status
    // and refuse, not silently re-distribute prizes.
    const ts = Date.now();
    const showCompleted = await prisma.show.create({
      data: {
        name: `TestFixture-IDEM-Show-Pre-${ts}`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 15,
        entryFee: 50,
        prize: 500,
        runDate: new Date(),
        showType: 'ridden',
        status: 'completed',
      },
    });

    try {
      const entries = [{ horse: idemHorse, user: idemUser }];
      const result = await executeEnhancedCompetition(showCompleted, entries);

      expect(result.success).toBe(false);
      expect(String(result.error)).toMatch(/already executed|completed/i);

      // No CompetitionResult rows created.
      const resultCount = await prisma.competitionResult.count({ where: { showId: showCompleted.id } });
      expect(resultCount).toBe(0);
    } finally {
      await prisma.show.delete({ where: { id: showCompleted.id } }).catch(() => {});
    }
  });
});
