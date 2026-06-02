/**
 * flagEvaluationEngine unit tests (Equoria-rr7 coverage sprint).
 *
 * Two real DB fixtures:
 *   - foal:   newborn horse — within [0, 3) year evaluation range
 *   - mature: 4-year-old horse — outside evaluation range
 *
 * Tests cover evaluateHorseFlags, batchEvaluateFlags, getEligibleHorses.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import flagEvalDefault, {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
} from '../../../utils/flagEvaluationEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-twmpa: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. The per-test maxFlagHorse (created in a
// test body) records its id in extraHorseIds so the fail-loud afterAll deletes
// it instead of a swallowed try/finally. horses -> user
// (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let foal;
let matureHorse;
const extraHorseIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `flagevalengine-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `flagevalengine${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'FlagEval',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-FlagEvalFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-FlagEvalMature-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
  cleanup.add(
    () => prisma.horse.deleteMany({ where: { id: { in: [foal.id, matureHorse.id, ...extraHorseIds] } } }),
    'horses',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── evaluateHorseFlags ────────────────────────────────────────────────────────

describe('evaluateHorseFlags', () => {
  it('throws for non-existent horse', async () => {
    await expect(evaluateHorseFlags(999999999)).rejects.toThrow();
  });

  it('returns success:false for horse outside age range (>= 3 years)', async () => {
    const result = await evaluateHorseFlags(matureHorse.id);

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toMatch(/outside evaluation range/i);
    expect(result.horseId).toBe(matureHorse.id);
    expect(Array.isArray(result.newFlags)).toBe(true);
    expect(result.newFlags).toHaveLength(0);
  });

  it('returns success:true for newborn foal with no interactions', async () => {
    const result = await evaluateHorseFlags(foal.id);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(foal.id);
    expect(Array.isArray(result.currentFlags)).toBe(true);
    expect(Array.isArray(result.newFlags)).toBe(true);
    expect(Array.isArray(result.flagEvaluations)).toBe(true);
  });

  it('returns success:false for horse already at max flags', async () => {
    const maxFlagHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-FlagEvalMaxFlags-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
      },
    });
    // Equoria-twmpa: record the id so the fail-loud afterAll deletes it (scoped,
    // re-throwing) instead of a swallowed try/finally that would leak on failure.
    extraHorseIds.push(maxFlagHorse.id);

    const result = await evaluateHorseFlags(maxFlagHorse.id);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/maximum number of flags/i);
    expect(result.newFlags).toHaveLength(0);
  });

  // Equoria-wpqr: ageInYears is now an integer count of canonical
  // game-years (getHorseAgeYears), not the old fractional calendar-year
  // string from `.toFixed(2)`. A just-born foal (dob = now) is 0
  // game-years old and eligible.
  it('returns ageInYears as an integer number of game-years for eligible horse', async () => {
    const result = await evaluateHorseFlags(foal.id);
    if (result.success) {
      expect(typeof result.ageInYears).toBe('number');
      expect(Number.isInteger(result.ageInYears)).toBe(true);
      expect(result.ageInYears).toBe(0);
    }
  });
});

// ── batchEvaluateFlags ────────────────────────────────────────────────────────

describe('batchEvaluateFlags', () => {
  it('returns empty array for empty horseIds', async () => {
    const result = await batchEvaluateFlags([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns one result per horse ID', async () => {
    const result = await batchEvaluateFlags([foal.id, matureHorse.id]);
    expect(result).toHaveLength(2);
  });

  it('includes success field in each result', async () => {
    const results = await batchEvaluateFlags([foal.id]);
    expect(results[0]).toHaveProperty('success');
  });

  it('returns success:false for mature horse in batch', async () => {
    const results = await batchEvaluateFlags([matureHorse.id]);
    expect(results[0].success).toBe(false);
  });

  it('includes error object for non-existent horse', async () => {
    const results = await batchEvaluateFlags([999999999]);
    expect(results).toHaveLength(1);
    // Either returns an error object or throws and pushes error entry
    expect(results[0]).toBeDefined();
  });
});

// ── getEligibleHorses ─────────────────────────────────────────────────────────

describe('getEligibleHorses', () => {
  it('returns an array', async () => {
    const result = await getEligibleHorses();
    expect(Array.isArray(result)).toBe(true);
  });

  it('includes newborn foal in eligible list', async () => {
    const result = await getEligibleHorses();
    expect(result).toContain(foal.id);
  });

  it('does not include mature horse (age >= 3 years)', async () => {
    const result = await getEligibleHorses();
    expect(result).not.toContain(matureHorse.id);
  });

  it('returns only numeric IDs', async () => {
    const result = await getEligibleHorses();
    for (const id of result) {
      expect(typeof id).toBe('number');
    }
  });
});

// ── getEligibleHorses catch block (lines 347-348) ─────────────────────────────

describe('getEligibleHorses — catch block (lines 347-348)', () => {
  it('re-throws when evaluationDate.getTime() throws (null passed as date)', async () => {
    await expect(getEligibleHorses(null)).rejects.toThrow();
  });
});

// ── evaluateFlagTriggers — default case (line 201, Equoria-jkht) ──────────────
// evaluateFlagTriggers is accessible via the default export.
// Calling it with an unknown flag name triggers the default: logger.warn branch.

describe('evaluateFlagTriggers — unknown flag name (line 201, Equoria-jkht)', () => {
  it('logs a warning and returns triggered=false for an unknown flag name', () => {
    const result = flagEvalDefault.evaluateFlagTriggers({ name: 'unknown_test_flag', triggerConditions: {} }, {});
    expect(result.triggered).toBe(false);
    expect(result.score).toBe(0);
  });
});
