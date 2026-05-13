/**
 * Integration tests for enterAndRunShow (competition/controllers/competitionController.mjs).
 * Equoria-rr7 coverage sprint.
 * Real DB, no mocks.
 *
 * Note on Horse.level: the Horse schema has no `level` field, so
 * isHorseEligibleForShow() always returns false for DB horses (the level check
 * `typeof horse.level !== 'number'` evaluates to true). As a result, the success
 * path of enterAndRunShow (lines after validHorses.length > 0) cannot be reached
 * with real DB horses. The tests below cover all reachable paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../db/index.mjs';
import { enterAndRunShow } from '../../modules/competition/controllers/competitionController.mjs';

const PREFIX = 'TestFixture-EaRS-';

function uid() {
  return randomBytes(6).toString('hex');
}

let user;
let horse;
let horseWithRider;
let show;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      id: `${PREFIX}${uid()}`,
      username: `ears_${uid()}`,
      email: `${PREFIX}${uid()}@test.com`,
      password: 'irrelevant',
      firstName: 'EaRS',
      lastName: 'Tester',
      money: 10000,
    },
  });

  // Horse with NO rider — fails hasValidRider check
  horse = await prisma.horse.create({
    data: {
      name: `${PREFIX}NoRider-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
      rider: null,
    },
  });

  // Horse WITH rider JSON and healthy lastFedDate — passes hasValidRider and
  // the critical-health gate, but fails isHorseEligibleForShow (Horse schema
  // has no `level` field so typeof horse.level !== 'number' is always true).
  horseWithRider = await prisma.horse.create({
    data: {
      name: `${PREFIX}WithRider-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
      rider: { id: 1, name: 'Test Rider' },
      lastFedDate: new Date(), // healthy — so rejection comes from eligibility, not health
    },
  });

  show = await prisma.show.create({
    data: {
      name: `${PREFIX}Show-${uid()}`,
      discipline: 'Dressage',
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      prize: 5000,
      entryFee: 0,
      levelMin: 1,
      levelMax: 10,
      status: 'open',
      hostUserId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.competitionResult
    .deleteMany({ where: { OR: [{ horseId: horse?.id }, { horseId: horseWithRider?.id }] } })
    .catch(() => {});
  if (show) {
    await prisma.show.delete({ where: { id: show.id } }).catch(() => {});
  }
  if (horseWithRider) {
    await prisma.horse.delete({ where: { id: horseWithRider.id } }).catch(() => {});
  }
  if (horse) {
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

// ─── Input validation ─────────────────────────────────────────────────────────

describe('enterAndRunShow — input validation', () => {
  it('throws when horseIds is null', async () => {
    await expect(enterAndRunShow(null, show)).rejects.toThrow('Horse IDs array is required');
  });

  it('throws when horseIds is a string (not an array)', async () => {
    await expect(enterAndRunShow('12345', show)).rejects.toThrow('Horse IDs must be an array');
  });

  it('throws when horseIds is an empty array', async () => {
    await expect(enterAndRunShow([], show)).rejects.toThrow('At least one horse ID is required');
  });

  it('throws when show is null', async () => {
    await expect(enterAndRunShow([1], null)).rejects.toThrow('Show object is required');
  });
});

// ─── Horse not found ──────────────────────────────────────────────────────────

describe('enterAndRunShow — horse not found in DB', () => {
  it('returns success: false / no valid horses when horse ID does not exist', async () => {
    const result = await enterAndRunShow([999999999], show);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no valid horses/i);
    expect(result.failedFetches).toHaveLength(1);
    expect(result.failedFetches[0].horseId).toBe(999999999);
  });
});

// ─── Horse has no rider ───────────────────────────────────────────────────────

describe('enterAndRunShow — horse with no rider', () => {
  it('returns success: false when horse has no rider (fails hasValidRider)', async () => {
    const result = await enterAndRunShow([horse.id], show);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no valid horses/i);
    expect(result.failedFetches).toHaveLength(1);
    expect(result.failedFetches[0].reason).toMatch(/rider/i);
  });
});

// ─── Horse has rider but no level (ineligible) ────────────────────────────────

describe('enterAndRunShow — horse with rider but no level field', () => {
  it('returns success: false when horse is ineligible (no level on Horse schema)', async () => {
    // Horse.level is undefined (Horse schema has no level field).
    // isHorseEligibleForShow returns false → horse is filtered out.
    const result = await enterAndRunShow([horseWithRider.id], show);

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no valid horses/i);
    expect(result.summary.validEntries).toBe(0);
    expect(result.summary.totalEntries).toBe(1);
    expect(result.summary.skippedEntries).toBeGreaterThan(0);
  });

  it('includes correct summary structure even on failure', async () => {
    const result = await enterAndRunShow([horseWithRider.id], show);

    expect(result.summary.topThree).toEqual([]);
    expect(result.summary.entryFeesCollected).toBe(0);
    expect(result.summary.prizesAwarded).toBe(0);
  });
});

// ─── Multiple horses, all fail ────────────────────────────────────────────────

describe('enterAndRunShow — multiple horses, all invalid', () => {
  it('accounts for all horse IDs in totalEntries', async () => {
    const result = await enterAndRunShow([horse.id, horseWithRider.id, 999999998], show);

    expect(result.success).toBe(false);
    expect(result.summary.totalEntries).toBe(3);
  });

  it('collects failedFetches for non-existent horse IDs', async () => {
    const result = await enterAndRunShow([999999997, 999999996], show);

    expect(result.failedFetches.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Critical-health gate (Equoria-p1fq) ─────────────────────────────────────

describe('enterAndRunShow — critical-health gate', () => {
  let criticalHorse;

  beforeAll(async () => {
    criticalHorse = await prisma.horse.create({
      data: {
        name: `${PREFIX}CriticalHealth-${uid()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        rider: { id: 1, name: 'Test Rider' }, // passes hasValidRider
        lastFedDate: null, // triggers critical feedHealth
      },
    });
  }, 30000);

  afterAll(async () => {
    if (criticalHorse) {
      await prisma.horse.delete({ where: { id: criticalHorse.id } }).catch(() => {});
    }
  }, 30000);

  it('puts horse in failedFetches with critical-health reason when lastFedDate is null', async () => {
    const result = await enterAndRunShow([criticalHorse.id], show);

    expect(result.success).toBe(false);
    expect(result.failedFetches).toHaveLength(1);
    expect(result.failedFetches[0].horseId).toBe(criticalHorse.id);
    expect(result.failedFetches[0].reason).toMatch(/critical health/i);
  });
});
