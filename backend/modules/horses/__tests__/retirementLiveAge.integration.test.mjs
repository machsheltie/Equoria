/**
 * retirementLiveAge.integration.test.mjs (Equoria-66qkj)
 *
 * Defect: the retirement gates (no new staff for a retired horse, staff release
 * when a 21+ mare foals, the feed door, the feed/vet health words) read the
 * stored `Horse.age`, which only the nightly birthday job (00:05 Eastern)
 * advances. A horse whose dateOfBirth made it 21 today on the Eastern calendar
 * (owner ruling: horses retire at 21; all game time is US Eastern) was still
 * treated as 20 until that job ran.
 *
 * Contract: the retirement gates use the same live age as the training and
 * rider gates (utils/horseAge.mjs liveHorseAgeYears): a birthday the nightly job
 * has not recorded yet (dateOfBirth age = stored age + 1) counts at once. For
 * consistent data (stored age = dateOfBirth age) nothing changes, and a row with
 * no dateOfBirth keeps its stored age.
 *
 * Real DB and real services; id-scoped fail-loud cleanup. The date-boundary
 * cases drive the pure health functions with injected Eastern instants
 * (23:30 / 00:30, and both daylight-saving change days of 2026).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import {
  careBeneathRetirement,
  getFeedHealth,
  getVetHealth,
  getDisplayedHealth,
  horseHealthGrade,
} from '../../../utils/horseHealth.mjs';
import { assertHorseTakesNewStaffTx, releaseStaffIfRetiredTx } from '../services/horseRetirementStaff.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';
import { HorseRetiredError } from '../../../errors/HorseRetiredError.mjs';

const scope = 'TestFixture-66qkj-retireLiveAge';
const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const horseIds = [];
const groomIds = [];
let user;
let breedId;

/** A mare `days` Eastern calendar days old, with the stored age the nightly job last wrote. */
async function makeHorse(days, storedAge, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${scope}-${rand()}`,
      sex: 'Mare',
      dateOfBirth: gameCalendarDate(new Date(), -days),
      age: storedAge,
      breedId,
      healthStatus: 'Good',
      userId: user.id,
      ...extra,
    },
  });
  horseIds.push(horse.id);
  return horse;
}

async function giveGroom(horse) {
  const groom = await prisma.groom.create({
    data: {
      name: `${scope}-groom-${rand()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: 20,
      userId: user.id,
    },
  });
  groomIds.push(groom.id);
  await prisma.groomAssignment.create({
    data: { foalId: horse.id, groomId: groom.id, userId: user.id, isActive: true },
  });
}

const activeGrooms = horseId => prisma.groomAssignment.count({ where: { foalId: horseId, isActive: true } });

beforeAll(async () => {
  breedId = (await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } })).id;
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${scope}-${rand()}`,
      email: `testfixture-66qkj-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Retire',
      lastName: 'LiveAge',
      money: 1000,
    },
  });
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'groom assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('no new staff for a horse that turned 21 today (Equoria-66qkj)', () => {
  it('refuses new staff before the nightly job ages it', async () => {
    const horse = await makeHorse(21 * 7, 20);
    await expect(prisma.$transaction(tx => assertHorseTakesNewStaffTx(tx, horse.id))).rejects.toBeInstanceOf(
      HorseRetiredError,
    );
  });

  it('a 20-year-old (consistent stored age) still takes new staff', async () => {
    const horse = await makeHorse(20 * 7 + 6, 20);
    await expect(prisma.$transaction(tx => assertHorseTakesNewStaffTx(tx, horse.id))).resolves.toBeUndefined();
  });

  it('a mare who turned 21 today but is in foal still takes new staff', async () => {
    const horse = await makeHorse(21 * 7, 20, { inFoalSinceDate: new Date() });
    await expect(prisma.$transaction(tx => assertHorseTakesNewStaffTx(tx, horse.id))).resolves.toBeUndefined();
  });
});

describe('foaling releases the staff of a mare who turned 21 today (Equoria-66qkj)', () => {
  it('releases her groom before the nightly job ages her', async () => {
    const mare = await makeHorse(21 * 7, 20);
    await giveGroom(mare);

    const released = await prisma.$transaction(tx => releaseStaffIfRetiredTx(tx, mare.id));

    expect(released).toEqual({ groomAssignmentsEnded: 1, riderAssignmentsEnded: 0, trainerAssignmentsEnded: 0 });
    expect(await activeGrooms(mare.id)).toBe(0);
  });

  it('keeps the groom of a 20-year-old mare', async () => {
    const mare = await makeHorse(20 * 7 + 6, 20);
    await giveGroom(mare);

    expect(await prisma.$transaction(tx => releaseStaffIfRetiredTx(tx, mare.id))).toBeNull();
    expect(await activeGrooms(mare.id)).toBe(1);
  });
});

describe('the feed door treats a horse that turned 21 today as retired (Equoria-66qkj)', () => {
  it('returns retired before the nightly job ages it', async () => {
    const horse = await makeHorse(21 * 7, 20);
    const result = await feedHorse({ userId: user.id, horseId: horse.id });
    expect(result.skipped).toBe('retired');
  });

  it('a 20-year-old is not retired (it reaches the no-feed-equipped refusal)', async () => {
    const horse = await makeHorse(20 * 7 + 6, 20);
    await expect(feedHorse({ userId: user.id, horseId: horse.id })).rejects.toMatchObject({ status: 400 });
  });
});

describe('health words on the Eastern calendar (Equoria-66qkj)', () => {
  // Each case: a date-only birth date whose 147th day (21 game-years) is `birthday`,
  // and the stored age the nightly job wrote before it (20).
  const cases = [
    {
      label: 'an ordinary summer day (EDT)',
      dateOfBirth: new Date('2026-03-01T00:00:00Z'), // + 147 days = 2026-07-26
      lateEveBefore: new Date('2026-07-26T03:30:00Z'), // 23:30 EDT Jul 25
      justAfterMidnight: new Date('2026-07-26T04:30:00Z'), // 00:30 EDT Jul 26
    },
    {
      label: 'the spring-forward day (Mar 8 2026)',
      dateOfBirth: new Date('2025-10-12T00:00:00Z'), // + 147 days = 2026-03-08
      lateEveBefore: new Date('2026-03-08T04:30:00Z'), // 23:30 EST Mar 7
      justAfterMidnight: new Date('2026-03-08T05:30:00Z'), // 00:30 EST Mar 8
    },
    {
      label: 'the fall-back day (Nov 1 2026)',
      dateOfBirth: new Date('2026-06-07T00:00:00Z'), // + 147 days = 2026-11-01
      lateEveBefore: new Date('2026-11-01T03:30:00Z'), // 23:30 EDT Oct 31
      justAfterMidnight: new Date('2026-11-01T04:30:00Z'), // 00:30 EDT Nov 1
    },
  ];

  for (const { label, dateOfBirth, lateEveBefore, justAfterMidnight } of cases) {
    describe(label, () => {
      const pending = {
        age: 20,
        dateOfBirth,
        lastFedDate: lateEveBefore,
        lastVettedDate: lateEveBefore,
        healthStatus: 'Excellent',
      };

      it('at 23:30 Eastern the evening before, the horse is still 20 and not retired', () => {
        expect(getFeedHealth(pending, lateEveBefore)).not.toBe('retired');
        expect(getVetHealth(pending, lateEveBefore)).not.toBe('retired');
        expect(getDisplayedHealth(pending, lateEveBefore)).not.toBe('retired');
      });

      it('at 00:30 Eastern on the birthday, before the nightly job, the horse is retired', () => {
        expect(getFeedHealth(pending, justAfterMidnight)).toBe('retired');
        expect(getVetHealth(pending, justAfterMidnight)).toBe('retired');
        expect(getDisplayedHealth(pending, justAfterMidnight)).toBe('retired');
      });

      it('after the nightly job (stored 21) the answer is the same', () => {
        expect(getFeedHealth({ ...pending, age: 21 }, justAfterMidnight)).toBe('retired');
      });
    });
  }

  it('a row with no dateOfBirth keeps its stored age (unchanged contract)', () => {
    const now = new Date('2026-07-26T04:30:00Z');
    expect(getFeedHealth({ age: 21 }, now)).toBe('retired');
    expect(getFeedHealth({ age: 20, lastFedDate: now }, now)).not.toBe('retired');
  });
});

describe('care beneath retirement still reads the care, not the age (Equoria-66qkj)', () => {
  const now = new Date('2026-07-26T16:00:00Z');
  // 25 game-years old, consistent stored age and birth date.
  const elder = {
    age: 25,
    dateOfBirth: new Date('2026-07-26T00:00:00Z').getTime() - 25 * 7 * 86400000,
    lastFedDate: now,
    lastVettedDate: now,
    healthStatus: 'Excellent',
  };

  it('horseHealthGrade grades a retired horse on its care', () => {
    expect(getVetHealth(elder, now)).toBe('retired');
    expect(horseHealthGrade(elder, now)).toBe('excellent');
  });

  // The vet's in-foal 21+ mare path (vetHealthOf) uses this; its route is covered
  // by horseRetirementStaffRelease 'she can still be vetted'.
  it('careBeneathRetirement reads the care of a horse with a 21+ birth date', () => {
    expect(getVetHealth(careBeneathRetirement(elder), now)).toBe('Excellent');
    expect(getFeedHealth(careBeneathRetirement(elder), now)).toBe('Excellent');
  });
});
