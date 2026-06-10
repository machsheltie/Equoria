/**
 * horseXpModel branch-coverage tests (Equoria-rr7 coverage sprint).
 *
 * Pure validation branches (no DB):
 *   addXpToHorse — missing horseId, invalid amount, missing reason
 *   validateStatName — valid + invalid
 *   allocateStatPoint — missing horseId, invalid stat name, horse-not-found, no-points
 *
 * DB-fixture paths:
 *   addXpToHorse — horse-not-found error return, success path (creates HorseXpEvent)
 *   allocateStatPoint — success path (requires horse with availableStatPoints > 0)
 *   getHorseXpHistory — number API + options API
 *   awardCompetitionXp — 1st/2nd/3rd/other placements
 *   getHorseXpStatus — success path
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  addXpToHorse,
  validateStatName,
  allocateStatPoint,
  getHorseXpHistory,
  awardCompetitionXp,
  getHorseXpStatus,
} from '../services/horseXpModelService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const cleanup = createCleanupTracker();
let xpUser;
let xpHorse;
let xpHorseWithPoints;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  xpUser = await prisma.user.create({
    data: {
      email: `horsexp-${ts}-${rand()}@test.com`,
      username: `horsexp${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'HorseXP',
      lastName: 'Tester',
      money: 1000,
    },
  });

  xpHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HorseXP-Horse-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: xpUser.id,
      horseXp: 0,
      availableStatPoints: 0,
    },
  });

  // Horse pre-seeded with a stat point so allocateStatPoint can succeed
  xpHorseWithPoints = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-HorseXP-WithPoints-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 0,
      userId: xpUser.id,
      horseXp: 100,
      availableStatPoints: 1,
    },
  });

  // FK-order scoped cleanup (Equoria-n7qa3). The TestFixture-HorseXP- horses are
  // owned by xpUser and Horse.userId is onDelete:Restrict (schema:282), so the
  // XP events and horse rows must be deleted BEFORE the user. The horse sweep is
  // name-prefix-scoped (covers xpHorse, xpHorseWithPoints, and the freshHorse
  // the no-stat-points test creates — also TestFixture-HorseXP-named, no XP
  // events). Fail-loud: any failure reds afterAll instead of being swallowed.
  cleanup.add(
    () =>
      prisma.horseXpEvent.deleteMany({
        where: { horse: { name: { startsWith: 'TestFixture-HorseXP-' } } },
      }),
    'horseXpEvent',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-HorseXP-' } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: xpUser.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── validateStatName ──────────────────────────────────────────────────────────

describe('validateStatName()', () => {
  it('returns true for a valid stat name', () => {
    expect(validateStatName('speed')).toBe(true);
    expect(validateStatName('stamina')).toBe(true);
    expect(validateStatName('precision')).toBe(true);
  });

  it('returns false for an invalid stat name', () => {
    expect(validateStatName('unicornPower')).toBe(false);
    expect(validateStatName('')).toBe(false);
    expect(validateStatName('SPEED')).toBe(false);
  });
});

// ── addXpToHorse — validation error returns ───────────────────────────────────

describe('addXpToHorse() — validation errors', () => {
  it('returns success:false when horseId is missing', async () => {
    const result = await addXpToHorse(null, 50, 'test');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns success:false when amount is not a positive number', async () => {
    const result = await addXpToHorse(xpHorse.id, -5, 'test');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns success:false when amount is zero', async () => {
    const result = await addXpToHorse(xpHorse.id, 0, 'test');
    expect(result.success).toBe(false);
  });

  it('returns success:false when reason is missing', async () => {
    const result = await addXpToHorse(xpHorse.id, 50, null);
    expect(result.success).toBe(false);
  });

  it('returns success:false when reason is not a string', async () => {
    const result = await addXpToHorse(xpHorse.id, 50, 42);
    expect(result.success).toBe(false);
  });

  it('returns success:false for non-existent horse', async () => {
    const result = await addXpToHorse(999999999, 50, 'test reason');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ── addXpToHorse — success path ───────────────────────────────────────────────

describe('addXpToHorse() — success path', () => {
  it('adds XP and returns new totals with statPointsGained when crossing 100xp threshold', async () => {
    const result = await addXpToHorse(xpHorse.id, 100, 'test competition win');
    expect(result.success).toBe(true);
    expect(result.xpGained).toBe(100);
    expect(result.currentXP).toBeGreaterThanOrEqual(100);
    expect(typeof result.statPointsGained).toBe('number');
    expect(typeof result.availableStatPoints).toBe('number');
  });

  it('returns statPointsGained=0 when XP does not cross a threshold', async () => {
    const result = await addXpToHorse(xpHorse.id, 1, 'tiny amount');
    expect(result.success).toBe(true);
    expect(result.statPointsGained).toBe(0);
  });
});

// ── allocateStatPoint — validation errors ─────────────────────────────────────

describe('allocateStatPoint() — validation errors', () => {
  it('returns success:false when horseId is missing', async () => {
    const result = await allocateStatPoint(null, 'speed');
    expect(result.success).toBe(false);
  });

  it('returns success:false for invalid stat name', async () => {
    const result = await allocateStatPoint(xpHorse.id, 'invalidStat');
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns success:false for non-existent horse', async () => {
    const result = await allocateStatPoint(999999999, 'speed');
    expect(result.success).toBe(false);
  });

  it('returns success:false when no stat points available', async () => {
    // xpHorse starts with 0 available stat points (before addXpToHorse runs)
    const freshHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HorseXP-NoPoints-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: xpUser.id,
        availableStatPoints: 0,
      },
    });
    // Equoria-n7qa3: freshHorse is TestFixture-HorseXP-named, so the afterAll
    // name-prefix horse sweep removes it. The old per-test delete used a
    // swallowed empty-arm catch that hid cleanup failures (a leaked
    // NULL-phenotype-risk row); dropping it lets the fail-loud afterAll own
    // teardown. The assertion does not depend on freshHorse being deleted here.
    const result = await allocateStatPoint(freshHorse.id, 'speed');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no stat points/i);
  });
});

// ── allocateStatPoint — success path ─────────────────────────────────────────

describe('allocateStatPoint() — success path', () => {
  it('allocates a stat point and returns updated values', async () => {
    const result = await allocateStatPoint(xpHorseWithPoints.id, 'speed');
    expect(result.success).toBe(true);
    expect(result.statName).toBe('speed');
    expect(typeof result.newStatValue).toBe('number');
    expect(typeof result.remainingStatPoints).toBe('number');
  });
});

// ── getHorseXpHistory ─────────────────────────────────────────────────────────

describe('getHorseXpHistory()', () => {
  it('returns events array using number API (legacy signature)', async () => {
    const result = await getHorseXpHistory(xpHorse.id, 10, 0);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
    expect(typeof result.count).toBe('number');
    expect(result.pagination.limit).toBe(10);
  });

  it('returns events array using options object API', async () => {
    const result = await getHorseXpHistory(xpHorse.id, { limit: 5, offset: 0 });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.pagination.limit).toBe(5);
  });

  it('supports startDate and endDate filtering', async () => {
    const result = await getHorseXpHistory(xpHorse.id, {
      startDate: new Date(0),
      endDate: new Date(Date.now() + 86400000),
    });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('throws DatabaseError when horseId is missing', async () => {
    await expect(getHorseXpHistory(null)).rejects.toThrow();
  });
});

// ── awardCompetitionXp ────────────────────────────────────────────────────────

describe('awardCompetitionXp()', () => {
  it('awards 30 XP (20 base + 10 bonus) for 1st place', async () => {
    const result = await awardCompetitionXp(xpHorse.id, '1st', 'Dressage');
    expect(result.success).toBe(true);
    expect(result.xpAwarded).toBe(30);
  });

  it('awards 27 XP (20 base + 7 bonus) for 2nd place', async () => {
    const result = await awardCompetitionXp(xpHorse.id, '2nd', 'Jumping');
    expect(result.success).toBe(true);
    expect(result.xpAwarded).toBe(27);
  });

  it('awards 25 XP (20 base + 5 bonus) for 3rd place', async () => {
    const result = await awardCompetitionXp(xpHorse.id, '3rd', 'Cross Country');
    expect(result.success).toBe(true);
    expect(result.xpAwarded).toBe(25);
  });

  it('awards 20 XP (base only) for other placements', async () => {
    const result = await awardCompetitionXp(xpHorse.id, '4th', 'Dressage');
    expect(result.success).toBe(true);
    expect(result.xpAwarded).toBe(20);
  });
});

// ── getHorseXpStatus ──────────────────────────────────────────────────────────

describe('getHorseXpStatus()', () => {
  it('returns status with progression info for real horse', async () => {
    const result = await getHorseXpStatus(xpHorse.id);
    expect(result.success).toBe(true);
    expect(result.data.horseId).toBe(xpHorse.id);
    expect(typeof result.data.currentXP).toBe('number');
    expect(typeof result.data.availableStatPoints).toBe('number');
    expect(typeof result.data.nextStatPointAt).toBe('number');
    expect(typeof result.data.xpToNextStatPoint).toBe('number');
  });

  it('returns success:false when horseId is missing', async () => {
    const result = await getHorseXpStatus(null);
    expect(result.success).toBe(false);
  });

  it('returns success:false for non-existent horse', async () => {
    const result = await getHorseXpStatus(999999999);
    expect(result.success).toBe(false);
  });
});
