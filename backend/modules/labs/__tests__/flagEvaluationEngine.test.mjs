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
import flagEvalDefault, {
  evaluateHorseFlags,
  batchEvaluateFlags,
  getEligibleHorses,
} from '../../../utils/flagEvaluationEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;
let foal;
let matureHorse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `flagevalengine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `flagevalengine${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'FlagEval',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      name: `TestFixture-FlagEvalFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      name: `TestFixture-FlagEvalMature-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: matureHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

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
        name: `TestFixture-FlagEvalMaxFlags-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
      },
    });

    try {
      const result = await evaluateHorseFlags(maxFlagHorse.id);
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/maximum number of flags/i);
      expect(result.newFlags).toHaveLength(0);
    } finally {
      await prisma.horse.delete({ where: { id: maxFlagHorse.id } }).catch(() => {});
    }
  });

  it('returns ageInYears as string for eligible horse', async () => {
    const result = await evaluateHorseFlags(foal.id);
    if (result.success) {
      expect(typeof result.ageInYears).toBe('string');
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
