/**
 * competitionAwards.test.mjs (Equoria-oey96.4)
 *
 * Unit + determinism coverage for the progression-award helper
 * (backend/modules/competition/services/competitionAwards.mjs), per
 * docs/architecture/show-xp-award-architecture.md §5.D.
 *
 *   - computePlacementAwards: pins ALL FOUR rows of the PRD-03 §2.1 table. This
 *     is the sentinel that FIRES if anyone edits a constant away from the PRD.
 *   - awardPlacementProgression: deterministic via the calculateStatGains _rngFn
 *     seam threaded through the helper's `rng` option — () => 0 always gains,
 *     () => 0.999 never gains, 4th place never gains (chance 0). Includes the
 *     stat=100 CAP sentinel (the `lt: 100` guard is a no-op at the ceiling).
 *
 * Real DB (CLAUDE.md §3): the determinism cases pass the ROOT prisma client as
 * `db` (the helper opens no $transaction), create TestFixture- fixtures via
 * createTestHorse, and clean up id-scoped.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { computePlacementAwards, awardPlacementProgression } from '../services/competitionAwards.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const uid = () => `${randomBytes(6).toString('hex')}`;
const cleanup = createCleanupTracker();
const horseIds = [];
const userIds = [];

afterAll(() => cleanup.run(), 60000);

// Register scoped cleanup once (closures read the id arrays at run() time).
cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseXpEvent');
cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: { in: userIds } } }), 'xpEvent');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

async function makeOwner() {
  const owner = await prisma.user.create({
    data: {
      email: `oey96.4-unit-${uid()}@test.local`,
      username: `o4u${uid()}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Unit',
      lastName: 'Owner',
      money: 0,
      xp: 0,
      level: 1,
    },
  });
  userIds.push(owner.id);
  return owner;
}

async function makeHorse(ownerId, overrides = {}) {
  return createTestHorse(
    prisma,
    {
      name: `TestFixture-oey96.4-unit-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      speed: 50,
      stamina: 50,
      agility: 50,
      balance: 50,
      precision: 50,
      boldness: 50,
      ...overrides,
    },
    horseIds,
  );
}

describe('computePlacementAwards — PRD-03 §2.1 table sentinel (Equoria-oey96.4)', () => {
  it('pins the four canonical rows exactly', () => {
    expect(computePlacementAwards(1)).toEqual({
      horseXp: 30,
      userXp: 20,
      statGainChance: 0.1,
      ordinal: '1st',
    });
    expect(computePlacementAwards(2)).toEqual({
      horseXp: 27,
      userXp: 15,
      statGainChance: 0.05,
      ordinal: '2nd',
    });
    expect(computePlacementAwards(3)).toEqual({
      horseXp: 25,
      userXp: 10,
      statGainChance: 0.03,
      ordinal: '3rd',
    });
    // 4th+: base participation horse XP only, no user XP, no stat roll.
    expect(computePlacementAwards(4)).toEqual({
      horseXp: 20,
      userXp: 0,
      statGainChance: 0,
      ordinal: '4th',
    });
  });

  it('treats any placement >= 4 as participation (20 horse XP, nothing else)', () => {
    for (const n of [5, 10, 50]) {
      expect(computePlacementAwards(n)).toEqual({
        horseXp: 20,
        userXp: 0,
        statGainChance: 0,
        ordinal: `${n}th`,
      });
    }
  });

  it('defensively maps invalid input to participation without throwing', () => {
    for (const bad of [0, -1, NaN, undefined, null, 2.5]) {
      const a = computePlacementAwards(bad);
      expect(a.horseXp).toBe(20);
      expect(a.userXp).toBe(0);
      expect(a.statGainChance).toBe(0);
    }
  });
});

describe('awardPlacementProgression — determinism + stat cap (Equoria-oey96.4)', () => {
  it('rng()=0 at 1st place: +30 horse XP, +20 owner XP with XpEvent, +1 on a Dressage stat', async () => {
    const owner = await makeOwner();
    const horse = await makeHorse(owner.id); // precision 50 (< 100)

    const { awards, statGain } = await awardPlacementProgression(prisma, {
      horseId: horse.id,
      ownerId: owner.id,
      placementNumber: 1,
      discipline: 'Dressage',
      horseName: horse.name,
      rng: () => 0,
    });

    expect(awards.horseXp).toBe(30);
    // rng()=0 -> chance passes (0 <= 0.10) and relevantStats[floor(0*3)] = index 0.
    expect(statGain).toEqual({ stat: 'precision', gain: 1 });

    const h = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, precision: true },
    });
    expect(h.horseXp).toBe(30);
    expect(h.precision).toBe(51); // 50 + 1
    const hEvents = await prisma.horseXpEvent.findMany({ where: { horseId: horse.id } });
    expect(hEvents).toHaveLength(1);
    expect(hEvents[0].amount).toBe(30);

    const u = await prisma.user.findUnique({ where: { id: owner.id }, select: { xp: true } });
    expect(u.xp).toBe(20);
    const uEvents = await prisma.xpEvent.findMany({ where: { userId: owner.id } });
    expect(uEvents).toHaveLength(1);
    expect(uEvents[0].amount).toBe(20);
  }, 30000);

  it('CAP SENTINEL: a stat already at 100 does not exceed the ceiling (lt:100 guard)', async () => {
    const owner = await makeOwner();
    const horse = await makeHorse(owner.id, { precision: 100 });

    const { statGain } = await awardPlacementProgression(prisma, {
      horseId: horse.id,
      ownerId: owner.id,
      placementNumber: 1,
      discipline: 'Dressage',
      horseName: horse.name,
      rng: () => 0, // would gain precision, but it is capped at 100
    });

    expect(statGain).toEqual({ stat: 'precision', gain: 1 }); // helper computed a gain…
    const h = await prisma.horse.findUnique({ where: { id: horse.id }, select: { precision: true } });
    expect(h.precision).toBe(100); // …but the cap-safe updateMany was a no-op
  }, 30000);

  it('rng()=0.999 at 1st place: XP awarded but NO stat gain', async () => {
    const owner = await makeOwner();
    const horse = await makeHorse(owner.id);

    const { statGain } = await awardPlacementProgression(prisma, {
      horseId: horse.id,
      ownerId: owner.id,
      placementNumber: 1,
      discipline: 'Dressage',
      horseName: horse.name,
      rng: () => 0.999, // 0.999 > 0.10 -> no gain
    });

    expect(statGain).toBeNull();
    const h = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, precision: true },
    });
    expect(h.horseXp).toBe(30);
    expect(h.precision).toBe(50); // unchanged
  }, 30000);

  it('4th place with rng()=0: +20 horse XP only — no owner XP, no stat gain (table teeth)', async () => {
    const owner = await makeOwner();
    const horse = await makeHorse(owner.id);

    const { awards, statGain } = await awardPlacementProgression(prisma, {
      horseId: horse.id,
      ownerId: owner.id,
      placementNumber: 4,
      discipline: 'Dressage',
      horseName: horse.name,
      rng: () => 0, // chance is 0 for 4th -> calculateStatGains never consulted
    });

    expect(awards.horseXp).toBe(20);
    expect(awards.userXp).toBe(0);
    expect(statGain).toBeNull();

    const h = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, precision: true },
    });
    expect(h.horseXp).toBe(20);
    expect(h.precision).toBe(50);
    const u = await prisma.user.findUnique({ where: { id: owner.id }, select: { xp: true } });
    expect(u.xp).toBe(0); // no owner XP for 4th
    const uEvents = await prisma.xpEvent.findMany({ where: { userId: owner.id } });
    expect(uEvents).toHaveLength(0); // no XpEvent row written
  }, 30000);
});
