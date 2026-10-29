/**
 * liveAgeQueries.integration.test.mjs (Equoria-66qkj)
 *
 * Defect: list and count reads filtered on the stored `Horse.age`, which only
 * the nightly birthday job (00:05 Eastern) advances, so a horse whose
 * dateOfBirth made it 21 (retired) or 3 (no longer a foal) today on the Eastern
 * calendar was still listed as 20 or 2 until that job ran:
 *  - the farrier and vet dropdowns (retired horses are not listed),
 *  - the groom fee basis (retired horses are not counted),
 *  - next-actions (groom-foal for horses under 3; train / breed for 3-20).
 *
 * Contract: these reads use the same live age as every other age gate
 * (utils/horseAge.mjs liveHorseAgeYears; owner rulings: game time is US
 * Eastern, horses retire at 21, foals are under 3). For list queries that is
 * liveAgeBelowClauses, whose DB result must equal liveHorseAgeYears row by
 * row: proven here against the real database at injected Eastern instants
 * (23:30 / 00:30 on an ordinary day and on both 2026 DST change days). For
 * consistent data (stored age = dateOfBirth age) nothing changes.
 *
 * Real DB and HTTP; id-scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { createTestHorse, testHorseData } from '../helpers/createTestHorse.mjs';
import { giveEligibleRider } from '../helpers/eligibleCompetitor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';
import { liveAgeBelowClauses, liveHorseAgeYears } from '../../utils/horseAge.mjs';
import { countActiveAssignments } from '../../modules/grooms/services/groomFeeBasisService.mjs';
import { getAvailableInteractions } from '../../modules/grooms/services/enhancedGroomInteractions.mjs';
import { generateInteractionRecommendations } from '../../modules/grooms/controllers/enhancedGroomController.mjs';
import { checkAgeRequirements } from '../../utils/competitionLogic.mjs';
import { validateConformationEntry } from '../../modules/competition/services/conformationShowService.mjs';

const scope = 'TestFixture-66qkj-liveAgeQ';
const rand = () => randomBytes(5).toString('hex');
const DAY = 24 * 60 * 60 * 1000;
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const groomIds = [];
const riderIds = [];

cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'groom assignments');
cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: horseIds } } }), 'foal development');
cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 60000);

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `testfixture-66qkj-q-${rand()}@test.local`,
      username: `${scope}-${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Live',
      lastName: 'AgeQuery',
      money: 1000,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeHorse(user, { dateOfBirth, age, ...extra }) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${scope}-${rand()}`,
      sex: 'Mare',
      dateOfBirth,
      age,
      healthStatus: 'Excellent',
      userId: user.id,
      ...extra,
    }),
  });
  horseIds.push(horse.id);
  return horse;
}

/** Born `days` Eastern calendar days ago (real clock). */
const daysAgo = days => gameCalendarDate(new Date(), -days);

function get(user, path) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  return request(app).get(path).set('Origin', 'http://localhost:3000').set('Authorization', `Bearer ${token}`);
}

describe('liveAgeBelowClauses matches liveHorseAgeYears row by row (Eastern boundaries)', () => {
  // Each `birthday` is the Eastern date a horse born `21 * 7` days earlier turns 21.
  const boundaries = [
    {
      label: 'an ordinary summer day (EDT)',
      birthday: '2026-07-26',
      lateEveBefore: new Date('2026-07-26T03:30:00Z'), // 23:30 EDT Jul 25
      justAfterMidnight: new Date('2026-07-26T04:30:00Z'), // 00:30 EDT Jul 26
    },
    {
      label: 'the spring-forward day (Mar 8 2026)',
      birthday: '2026-03-08',
      lateEveBefore: new Date('2026-03-08T04:30:00Z'), // 23:30 EST Mar 7
      justAfterMidnight: new Date('2026-03-08T05:30:00Z'), // 00:30 EST Mar 8
    },
    {
      label: 'the fall-back day (Nov 1 2026)',
      birthday: '2026-11-01',
      lateEveBefore: new Date('2026-11-01T03:30:00Z'), // 23:30 EDT Oct 31
      justAfterMidnight: new Date('2026-11-01T04:30:00Z'), // 00:30 EDT Nov 1
    },
  ];

  const bornDaysBefore = (isoDate, days) => new Date(Date.parse(`${isoDate}T00:00:00Z`) - days * DAY);

  for (const { label, birthday, lateEveBefore, justAfterMidnight } of boundaries) {
    describe(label, () => {
      let user;
      let rows;

      beforeAll(async () => {
        user = await makeUser();
        // (dateOfBirth offset in days before the birthday, stored age) pairs around
        // both thresholds: 21 (retired) and 3 (foal).
        const shapes = [];
        for (const years of [3, 21]) {
          const turns = years * 7;
          shapes.push(
            [turns, years - 1], // birthday to `years` pending at 00:30, not at 23:30
            [turns, years], // already recorded
            [turns, null], // no stored age: dateOfBirth decides
            [turns, years - 2], // legacy mismatch: stored age stands
            [turns + 7, years - 1], // 23:30: pending to `years`; 00:30: a year further, not pending
            [turns + 7, null],
            [turns - 1, years - 1], // consistent, a day short of the birthday
            [turns - 1, null],
            [turns + 200, years + 4], // legacy older row
          );
        }
        rows = [];
        for (const [offset, age] of shapes) {
          rows.push(await makeHorse(user, { dateOfBirth: bornDaysBefore(birthday, offset), age }));
        }
      }, 60000);

      for (const years of [3, 21]) {
        for (const [when, nowFn] of [
          ['23:30 the evening before', () => lateEveBefore],
          ['00:30 on the birthday', () => justAfterMidnight],
        ]) {
          it(`below ${years} at ${when}: the DB answer equals the live age`, async () => {
            const now = nowFn();
            const ids = rows.map(r => r.id);
            const found = await prisma.horse.findMany({
              where: { id: { in: ids }, OR: liveAgeBelowClauses(years, now) },
              select: { id: true },
            });
            const expected = rows.filter(r => liveHorseAgeYears(r, now) < years).map(r => r.id);
            expect(found.map(r => r.id).sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
          });
        }
      }

      it('the pending birthday flips exactly at Eastern midnight', async () => {
        const pending = rows[9]; // shapes[0] of the 21 block: born 147 days before, stored 20
        expect(pending.age).toBe(20);
        const below21 = async now =>
          (await prisma.horse.count({ where: { id: pending.id, OR: liveAgeBelowClauses(21, now) } })) === 1;
        expect(await below21(lateEveBefore)).toBe(true);
        expect(await below21(justAfterMidnight)).toBe(false);
      });
    });
  }
});

describe('farrier and vet dropdowns leave out a horse that turned 21 today (real clock)', () => {
  let user;
  let turned21;
  let still20;
  let inFoal21;

  beforeAll(async () => {
    user = await makeUser();
    turned21 = await makeHorse(user, { dateOfBirth: daysAgo(21 * 7), age: 20 });
    still20 = await makeHorse(user, { dateOfBirth: daysAgo(21 * 7 - 1), age: 20 });
    inFoal21 = await makeHorse(user, { dateOfBirth: daysAgo(21 * 7), age: 20, inFoalSinceDate: new Date() });
  }, 60000);

  it('GET /api/v1/farrier/horses', async () => {
    const res = await get(user, '/api/v1/farrier/horses');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(h => h.id);
    expect(ids).toContain(still20.id);
    expect(ids).not.toContain(turned21.id);
  });

  it('GET /api/v1/vet/horses (an in-foal mare of 21 stays listed)', async () => {
    const res = await get(user, '/api/v1/vet/horses');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(h => h.id);
    expect(ids).toContain(still20.id);
    expect(ids).toContain(inFoal21.id);
    expect(ids).not.toContain(turned21.id);
  });
});

describe('the groom fee basis does not count a horse that turned 21 today (real clock)', () => {
  async function groomOn(user, horse) {
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
    return groom;
  }

  it('counts the 20-year-old, not the horse whose 21st birthday is today', async () => {
    const user = await makeUser();
    const groomRetired = await groomOn(user, await makeHorse(user, { dateOfBirth: daysAgo(21 * 7), age: 20 }));
    const groomActive = await groomOn(user, await makeHorse(user, { dateOfBirth: daysAgo(21 * 7 - 1), age: 20 }));

    const counts = await countActiveAssignments(prisma, [groomRetired.id, groomActive.id]);

    expect(counts.get(groomActive.id)).toBe(1);
    expect(counts.get(groomRetired.id)).toBe(0);
  });
});

describe('next-actions follows the live age (real clock)', () => {
  const actionsFor = async user => {
    const res = await get(user, '/api/v1/next-actions');
    expect(res.status).toBe(200);
    return res.body.data.actions;
  };

  it('groom-foal leaves out a horse that turned 3 today, and keeps a 2-year-old', async () => {
    const user = await makeUser();
    const foal = await makeHorse(user, {
      dateOfBirth: daysAgo(3 * 7 - 1),
      age: 2,
      sex: 'Filly',
      lastFedDate: new Date(),
    });
    const turned3 = await makeHorse(user, {
      dateOfBirth: daysAgo(3 * 7),
      age: 2,
      sex: 'Filly',
      lastFedDate: new Date(),
    });
    await prisma.foalDevelopment.create({ data: { foalId: foal.id } });
    await prisma.foalDevelopment.create({ data: { foalId: turned3.id } });

    const groomFoal = (await actionsFor(user)).filter(a => a.type === 'groom-foal').map(a => a.horseId);

    expect(groomFoal).toEqual([foal.id]);
  });

  async function adultMare(user, daysOld, age) {
    const horse = await createTestHorse(
      prisma,
      {
        name: `${scope}-mare-${rand()}`,
        sex: 'Mare',
        age,
        dateOfBirth: daysAgo(daysOld),
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        lastVettedDate: gameCalendarDate(),
        trainingCooldown: null,
        lastBredDate: null,
        userId: user.id,
      },
      horseIds,
    );
    await giveEligibleRider(prisma, { horseId: horse.id, userId: user.id }, riderIds);
    return horse;
  }

  it('a 20-year-old mare is suggested for train and breed', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, 21 * 7 - 1, 20);
    const types = (await actionsFor(user)).filter(a => a.horseId === mare.id).map(a => a.type);
    expect(types).toEqual(expect.arrayContaining(['train', 'breed']));
  });

  it('a mare whose 21st birthday is today is not, before the nightly job ages her', async () => {
    const user = await makeUser();
    const mare = await adultMare(user, 21 * 7, 20);
    const types = (await actionsFor(user)).filter(a => a.horseId === mare.id).map(a => a.type);
    expect(types).not.toContain('train');
    expect(types).not.toContain('breed');
  });
});

describe('in-memory age reads and shown ages follow the live age (real clock)', () => {
  const groom = { speciality: 'foalCare', skillLevel: 'novice', personality: 'gentle' };
  const twoYearOld = () => ({ age: 2, dateOfBirth: daysAgo(3 * 7 - 1) });
  const turned3Today = () => ({ age: 2, dateOfBirth: daysAgo(3 * 7) });

  it('foal enrichment interactions stop on the 3rd birthday, before the nightly job', () => {
    const categories = horse => getAvailableInteractions(groom, horse).map(i => i.category);
    expect(categories(twoYearOld())).toContain('enrichment');
    expect(categories(turned3Today())).not.toContain('enrichment');
  });

  it('the foal-care recommendation stops on the 3rd birthday', () => {
    const variations = horse => generateInteractionRecommendations(groom, horse, { level: 5 }).map(r => r.variation);
    expect(variations(twoYearOld())).toContain('Sensory Exploration');
    expect(variations(turned3Today())).not.toContain('Sensory Exploration');
  });

  it('checkAgeRequirements refuses a horse whose 21st birthday is today', () => {
    expect(checkAgeRequirements({ age: 20, dateOfBirth: daysAgo(21 * 7 - 1) })).toBe(true);
    expect(checkAgeRequirements({ age: 20, dateOfBirth: daysAgo(21 * 7) })).toBe(false);
  });

  it('the conformation age class moves on the 1st birthday; a negative stored age is still invalid', async () => {
    // id null: the pure-input path (no groom-assignment read).
    const classOf = async horse =>
      (await validateConformationEntry({ id: null, ...horse }, { id: null }, 'uid')).ageClass;
    expect(await classOf({ age: 0, dateOfBirth: daysAgo(6) })).toBe('Weanling');
    expect(await classOf({ age: 0, dateOfBirth: daysAgo(7) })).toBe('Yearling');
    const invalid = await validateConformationEntry(
      { id: null, age: -1, dateOfBirth: daysAgo(0) },
      { id: null },
      'uid',
    );
    expect(invalid.errors.some(e => e.includes('invalid'))).toBe(true);
    expect(invalid.ageClass).toBeNull();
  });

  it('the trait routes show the live age', async () => {
    const user = await makeUser();
    const horse = await makeHorse(user, { dateOfBirth: daysAgo(4 * 7), age: 3 });
    const traits = await get(user, `/api/v1/traits/horse/${horse.id}`);
    expect(traits.status).toBe(200);
    expect(traits.body.data.age).toBe(4);
    const discovery = await get(user, `/api/v1/traits/discovery-status/${horse.id}`);
    expect(discovery.status).toBe(200);
    expect(discovery.body.data.currentStats.age).toBe(4);
  });
});
