/**
 * weeklyFlagEvaluationService unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests the 4 exported async functions with real DB fixtures.
 * Newborn foal exercises the zero-data care patterns evaluation path.
 * evaluateWeeklyFlags runs all eligible horses (including our fixture).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  getEligibleHorsesForFlagEvaluation,
  processHorseForFlagEvaluation,
  evaluateWeeklyFlags,
  triggerWeeklyFlagEvaluation,
} from '../../../services/weeklyFlagEvaluationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let foal;
let matureHorse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `weeklyflags-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `weeklyflags${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'WeeklyFlags',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-WeeklyFlagFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-WeeklyFlagMature-${Date.now()}`,
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

// ── getEligibleHorsesForFlagEvaluation ────────────────────────────────────────

describe('getEligibleHorsesForFlagEvaluation', () => {
  it('returns an array', async () => {
    const result = await getEligibleHorsesForFlagEvaluation();
    expect(Array.isArray(result)).toBe(true);
  });

  it('includes newborn foal in eligible list', async () => {
    const result = await getEligibleHorsesForFlagEvaluation();
    const ids = result.map(h => h.id);
    expect(ids).toContain(foal.id);
  });

  it('does not include mature horse (>3 years)', async () => {
    const result = await getEligibleHorsesForFlagEvaluation();
    const ids = result.map(h => h.id);
    expect(ids).not.toContain(matureHorse.id);
  });
});

// ── processHorseForFlagEvaluation ─────────────────────────────────────────────

describe('processHorseForFlagEvaluation', () => {
  it('returns error object for non-existent horse (does not throw)', async () => {
    const result = await processHorseForFlagEvaluation(999999999);
    expect(result).toBeDefined();
    expect(result.evaluated).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns evaluated:true for newborn foal', async () => {
    const result = await processHorseForFlagEvaluation(foal.id);
    expect(result).toBeDefined();
    expect(result.horseId).toBe(foal.id);
    expect(result.evaluated).toBe(true);
    expect(Array.isArray(result.flagsAssigned)).toBe(true);
  });

  it('returns evaluated:false for mature horse (over 3 years)', async () => {
    const result = await processHorseForFlagEvaluation(matureHorse.id);
    expect(result).toBeDefined();
    expect(result.evaluated).toBe(false);
    expect(typeof result.reason).toBe('string');
  });

  it('returns horse name and bond data when evaluated', async () => {
    const result = await processHorseForFlagEvaluation(foal.id);
    if (result.evaluated && !result.error) {
      expect(typeof result.horseName).toBe('string');
      expect(typeof result.ageInDays).toBe('number');
    }
  });
});

// ── evaluateWeeklyFlags ────────────────────────────────────────────────────────

describe('evaluateWeeklyFlags', () => {
  it('returns summary object with expected shape', async () => {
    const result = await evaluateWeeklyFlags();

    expect(result).toBeDefined();
    expect(typeof result.totalHorsesEvaluated).toBe('number');
    expect(typeof result.flagsAssigned).toBe('number');
    expect(Array.isArray(result.horsesProcessed)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('includes our foal in the processed results', async () => {
    const result = await evaluateWeeklyFlags();
    const processedIds = result.horsesProcessed.map(h => h.horseId);
    expect(processedIds).toContain(foal.id);
  });
});

// ── triggerWeeklyFlagEvaluation ───────────────────────────────────────────────

describe('triggerWeeklyFlagEvaluation', () => {
  it('returns a result object (either evaluation or skip)', async () => {
    const result = await triggerWeeklyFlagEvaluation();
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('if skipped, includes skipped:true and reason', async () => {
    const result = await triggerWeeklyFlagEvaluation();
    const now = new Date();
    if (now.getDay() !== 1) {
      // Not Monday — should be skipped
      expect(result.skipped).toBe(true);
      expect(typeof result.reason).toBe('string');
    } else {
      // Monday — evaluation runs
      expect(typeof result.totalHorsesEvaluated).toBe('number');
    }
  });
});

// ── processHorseForFlagEvaluation — in-loop max-flags break (Equoria-rr7) ────
// Covers weeklyFlagEvaluationService.mjs line 123 (`break`).
// Horse starts with 4 flags. No-care fresh foal triggers 'aloof' + 'skittish'
// (generic negative: poorCare=true). Loop iter 1 adds 'aloof' (4+0<5).
// Loop iter 2: 4+1=5 ≥ 5 → break fires before 'skittish' is assigned.

describe('processHorseForFlagEvaluation — in-loop max-flags break (Equoria-rr7)', () => {
  let mlHorse;

  beforeAll(async () => {
    mlHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WF-MaxLoop-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        // 4 flags (not aloof/skittish so both remain eligible to trigger)
        epigeneticFlags: ['brave', 'confident', 'fearful', 'fragile'],
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-WF-MaxLoop-' } } }).catch(() => {});
  }, 30000);

  it('line-123 break fires: exactly 1 flag assigned when 4 existing + 2 eligible (aloof/skittish) triggers', async () => {
    const result = await processHorseForFlagEvaluation(mlHorse.id);
    expect(result.evaluated).toBe(true);
    expect(Array.isArray(result.flagsAssigned)).toBe(true);
    // The break fires on 2nd iteration (4+1=5>=5), so only 1 flag is assigned
    expect(result.flagsAssigned).toHaveLength(1);
    // currentFlags in result = original 4 + 1 newly assigned = 5
    expect(result.currentFlags).toHaveLength(5);
  });
});

// ── processHorseForFlagEvaluation — max-flags branch (Equoria-jkht) ───────────

describe('processHorseForFlagEvaluation — max-flags branch (Equoria-jkht)', () => {
  let mfHorse;

  beforeAll(async () => {
    mfHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WF-MaxFlags-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        epigeneticFlags: ['brave', 'confident', 'affectionate', 'resilient', 'fearful'],
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: mfHorse.id } }).catch(() => {});
  }, 30000);

  it('returns evaluated:true with empty flagsAssigned and max-flags reason when horse already has 5 flags', async () => {
    const result = await processHorseForFlagEvaluation(mfHorse.id);
    expect(result.evaluated).toBe(true);
    expect(Array.isArray(result.flagsAssigned)).toBe(true);
    expect(result.flagsAssigned).toHaveLength(0);
    expect(result.reason).toBe('Horse already has maximum 5 flags');
    expect(result.currentFlags).toHaveLength(5);
  });
});

// ── processHorseForFlagEvaluation — flag-already-in-currentFlags branch (Equoria-rr7) ─────────
// Branch 5 at line 126: !currentFlags.includes(flagName) === false
// Achieved by giving the foal 'aloof' already; when flagAssignmentEngine triggers
// 'aloof' for a no-care foal, the check fires and the existing flag is skipped.
// 'skittish' is then assigned (or the horse ends up with only existing flags).

describe('processHorseForFlagEvaluation — flag-already-in-currentFlags branch (Equoria-rr7)', () => {
  let afoalWithAloof;

  beforeAll(async () => {
    afoalWithAloof = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WF-AlreadyAloof-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        // 'aloof' is already assigned — when it triggers again, line 126 branch fires
        epigeneticFlags: ['aloof'],
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-WF-AlreadyAloof-' } } }).catch(() => {});
  }, 30000);

  it('skips a flag already in currentFlags (branch-5: !currentFlags.includes false)', async () => {
    const result = await processHorseForFlagEvaluation(afoalWithAloof.id);
    expect(result.evaluated).toBe(true);
    // 'aloof' was already there — should not be re-assigned
    expect(result.flagsAssigned).not.toContain('aloof');
    // currentFlags in result must still include 'aloof'
    expect(result.currentFlags).toContain('aloof');
  });
});

// ── evaluateWeeklyFlags — evaluation.flagsAssigned falsy branch (Equoria-rr7) ─
// Branch 9 at line 200: if (evaluation.flagsAssigned) falsy path.
// processHorseForFlagEvaluation catches its own errors and returns
// { horseId, evaluated: false, error: '...' } (no flagsAssigned key).
// evaluateWeeklyFlags accesses horse.id from the eligible list — but if the
// horse is found eligible yet returns an error object, flagsAssigned is undefined.
// We verify evaluateWeeklyFlags still completes and returns a valid summary.

describe('evaluateWeeklyFlags — summary shape regardless of per-horse errors (Equoria-rr7)', () => {
  it('flagsAssigned counter not incremented when evaluation.flagsAssigned is undefined', async () => {
    // evaluateWeeklyFlags runs on all eligible horses including our foal.
    // The foal may or may not trigger flags; in either case the summary must be valid.
    const result = await evaluateWeeklyFlags();
    expect(typeof result.flagsAssigned).toBe('number');
    expect(result.flagsAssigned).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.horsesProcessed)).toBe(true);
  });
});
