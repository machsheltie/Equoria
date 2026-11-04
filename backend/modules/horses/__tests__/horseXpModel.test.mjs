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
 *   getHorseXpStatus — success path
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  addXpToHorse,
  validateStatName,
  allocateStatPoint,
  getHorseXpHistory,
  getHorseXpStatus,
  horsePointsPerStatPoint as P,
} from '../services/horseXpModelService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const cleanup = createCleanupTracker();
let xpUser;
let xpHorse;
let xpHorseWithPoints;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

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

  xpUser = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `horsexp-${ts}-${rand()}@test.com`,
      username: `horsexp${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'HorseXP',
      lastName: 'Tester',
      money: 1000,
    },
  });

  xpHorse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-HorseXP-Horse-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: xpUser.id,
      horseXp: 0,
      availableStatPoints: 0,
    }),
  });

  // Horse pre-seeded with a stat point so allocateStatPoint can succeed
  xpHorseWithPoints = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-HorseXP-WithPoints-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(),
      age: 0,
      userId: xpUser.id,
      horseXp: 100,
      availableStatPoints: 1,
    }),
  });
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
  it('adds XP and returns new totals (a stat point is credited per 1,000 Horse Points, C15)', async () => {
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
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-HorseXP-NoPoints-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: xpUser.id,
        availableStatPoints: 0,
      }),
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

// ── Merged from the former horse XP system and integration suites (Equoria-k1vly) ──
// Owner ruling C15 (2026-10-16; Equoria-576c0 B13): 1,000 Horse Points per stat point.
// Each case below builds its own horse, so no case depends on another's leftovers.

let horseSeq = 0;
async function mkHorse(label, opts = {}) {
  return prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-HorseXP-${label}-${Date.now()}-${horseSeq++}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
      age: 0,
      userId: xpUser.id,
      horseXp: opts.horseXp ?? 0,
      availableStatPoints: opts.availableStatPoints ?? 0,
      ...(opts.speed !== undefined && { speed: opts.speed }),
    }),
  });
}

describe('addXpToHorse() — stat points per 1,000 Horse Points', () => {
  it('credits one stat point when an award carries the horse over a 1,000 mark', async () => {
    const horse = await mkHorse('AddXp1', { horseXp: P / 2 });
    const result = await addXpToHorse(horse.id, P, 'Competition participation');

    expect(result.success).toBe(true);
    expect(result.currentXP).toBe(1.5 * P);
    expect(result.availableStatPoints).toBe(1);
    expect(result.xpGained).toBe(P);
    expect(result.statPointsGained).toBe(1);
  });

  it('credits several stat points for a large award', async () => {
    const horse = await mkHorse('AddXp2', { horseXp: P / 2 });
    const result = await addXpToHorse(horse.id, 2 * P, 'Major competition win');

    expect(result.success).toBe(true);
    expect(result.currentXP).toBe(2.5 * P);
    expect(result.availableStatPoints).toBe(2);
    expect(result.statPointsGained).toBe(2);
  });

  it('keeps the stat points the horse already holds', async () => {
    const horse = await mkHorse('AddXp3', { horseXp: 1.5 * P, availableStatPoints: 1 });
    const result = await addXpToHorse(horse.id, P, 'Training session');

    expect(result.success).toBe(true);
    expect(result.availableStatPoints).toBe(2);
    expect(result.statPointsGained).toBe(1);
  });

  it('says why when the horse id is missing or the horse does not exist', async () => {
    const missing = await addXpToHorse(null, 100, 'Test');
    expect(missing.success).toBe(false);
    expect(missing.error).toContain('Horse ID is required');

    const unknown = await addXpToHorse(999999999, 100, 'Test');
    expect(unknown.success).toBe(false);
    expect(unknown.error).toContain('Horse not found');
  });

  it('credits the stat point only on the award that crosses 1,000, and stores the totals', async () => {
    const horse = await mkHorse('Threshold');
    await addXpToHorse(horse.id, 300, 'Test seed: competition 1');
    await addXpToHorse(horse.id, 300, 'Test seed: competition 2');
    const below = await addXpToHorse(horse.id, 270, 'Test seed: competition 3');

    expect(below.currentXP).toBe(870);
    expect(below.statPointsGained).toBe(0);

    const crossed = await addXpToHorse(horse.id, 250, 'Test seed: competition 4');

    expect(crossed.success).toBe(true);
    expect(crossed.currentXP).toBe(1120);
    expect(crossed.statPointsGained).toBe(1);

    const stored = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(stored.horseXp).toBe(1120);
    expect(stored.availableStatPoints).toBe(1);
  });
});

describe('allocateStatPoint() — points and stats', () => {
  it('raises the stat by one and spends one available point', async () => {
    const horse = await mkHorse('AllocStat1', { availableStatPoints: 2, speed: 75 });
    const result = await allocateStatPoint(horse.id, 'speed');

    expect(result.success).toBe(true);
    expect(result.newStatValue).toBe(76);
    expect(result.remainingStatPoints).toBe(1);
  });

  it('refuses with a clear message when no stat points are available', async () => {
    const horse = await mkHorse('AllocStat2');
    const result = await allocateStatPoint(horse.id, 'speed');

    expect(result.success).toBe(false);
    expect(result.error).toContain('No stat points available');
  });

  it('refuses an invalid stat name before touching the database', async () => {
    const result = await allocateStatPoint(1, 'invalidStat');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid stat name');
  });

  it('spends points earned through addXpToHorse and stores the new stat and point count', async () => {
    const horse = await mkHorse('AllocViaXp');
    await addXpToHorse(horse.id, 2000, 'Test XP for stat allocation');
    const before = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { speed: true, availableStatPoints: true },
    });
    expect(before.availableStatPoints).toBe(2);

    const result = await allocateStatPoint(horse.id, 'speed');

    expect(result.success).toBe(true);
    expect(result.statName).toBe('speed');
    expect(result.newStatValue).toBe(before.speed + 1);
    expect(result.remainingStatPoints).toBe(1);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { speed: true, availableStatPoints: true },
    });
    expect(after.speed).toBe(before.speed + 1);
    expect(after.availableStatPoints).toBe(1);
  });
});

describe('validateStatName() — every stat', () => {
  it('accepts all ten stat names', () => {
    const validStats = [
      'speed',
      'stamina',
      'agility',
      'balance',
      'precision',
      'intelligence',
      'boldness',
      'flexibility',
      'obedience',
      'focus',
    ];
    for (const stat of validStats) {
      expect(validateStatName(stat)).toBe(true);
    }
  });
});

describe('getHorseXpHistory() — contents and order', () => {
  it('returns each event with its amount and reason', async () => {
    const horse = await mkHorse('XpHistory1');
    await addXpToHorse(horse.id, 50, 'Competition: 1st place');
    await addXpToHorse(horse.id, 25, 'Training session');

    const result = await getHorseXpHistory(horse.id, { limit: 10 });

    expect(result.success).toBe(true);
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.events[0]).toHaveProperty('amount');
    expect(result.events[0]).toHaveProperty('reason');
    expect(result.pagination.limit).toBe(10);
  });

  it('lists events newest first with the count and paging flags', async () => {
    const horse = await mkHorse('XpHistory2');
    await addXpToHorse(horse.id, 50, 'First competition');
    await addXpToHorse(horse.id, 30, 'Second competition');
    await addXpToHorse(horse.id, 25, 'Third competition');

    const result = await getHorseXpHistory(horse.id, 10, 0);

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(3);
    expect(result.count).toBe(3);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.events.map(e => e.amount)).toEqual([25, 30, 50]);
  });
});

describe('getHorseXpStatus() — progress to the next stat point', () => {
  it('reports the name, the totals and how far the next stat point is', async () => {
    const horse = await mkHorse('XpStatus');
    await addXpToHorse(horse.id, 1500, 'Test XP');

    const result = await getHorseXpStatus(horse.id);

    expect(result.success).toBe(true);
    expect(result.data.horseId).toBe(horse.id);
    expect(result.data.horseName).toBe(horse.name);
    expect(result.data.currentXP).toBe(1500);
    expect(result.data.availableStatPoints).toBe(1);
    expect(result.data.nextStatPointAt).toBe(2000);
    expect(result.data.xpToNextStatPoint).toBe(500);
  });
});

describe('Horse XP workflow — award, status, allocate, history', () => {
  it('keeps the earned points when a stat point is spent', async () => {
    const horse = await mkHorse('Workflow');
    const initialSpeed = horse.speed;

    await addXpToHorse(horse.id, 300, 'Test seed: competition 1');
    await addXpToHorse(horse.id, 270, 'Test seed: competition 2');
    await addXpToHorse(horse.id, 300, 'Test seed: competition 3');
    await addXpToHorse(horse.id, 250, 'Test seed: competition 4');

    const status = await getHorseXpStatus(horse.id);
    expect(status.success).toBe(true);
    expect(status.data.currentXP).toBe(1120);
    expect(status.data.availableStatPoints).toBe(1);

    const allocated = await allocateStatPoint(horse.id, 'speed');
    expect(allocated.success).toBe(true);
    expect(allocated.newStatValue).toBe(initialSpeed + 1);
    expect(allocated.remainingStatPoints).toBe(0);

    const stored = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, availableStatPoints: true, speed: true },
    });
    expect(stored.horseXp).toBe(1120);
    expect(stored.availableStatPoints).toBe(0);
    expect(stored.speed).toBe(initialSpeed + 1);

    const history = await getHorseXpHistory(horse.id, 10, 0);
    expect(history.success).toBe(true);
    expect(history.events).toHaveLength(4);
    expect(history.events.every(event => event.amount > 0)).toBe(true);
  });
});
