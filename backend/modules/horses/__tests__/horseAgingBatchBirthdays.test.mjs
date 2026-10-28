/**
 * Nightly horse aging — no redundant re-fetch, batched plain birthdays
 * (Equoria-cmw85.27).
 *
 * processHorseBirthdays() already holds each candidate's id/name/dateOfBirth/age
 * from its scan, yet updateHorseAge() re-fetched the same row, then every plain
 * birthday did its own single-row UPDATE. The fix hands the scanned row to
 * updateHorseAge and groups birthdays with no milestone by new age into one
 * updateMany per age. Milestone horses (age 1 trait evaluation, age 21
 * retirement) keep their individual path — their writes differ per horse.
 *
 * Real database, real service. Prisma calls are counted through delegating
 * wrappers; nothing is mocked. The post-run rows and the result summary are the
 * behaviour contract: they are exactly what the per-horse path produced.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { processHorseBirthdays } from '../../../utils/horseAgingSystem.mjs';

const SCOPE = 'TestFixture-AgingBatch';
const RUN = randomBytes(6).toString('hex');
const daysAgo = days => gameCalendarDate(new Date(), -days);

const cleanup = createCleanupTracker();
const ids = {};
let user;

async function makeHorse(key, { daysOld, storedAge }) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex: 'Mare',
      dateOfBirth: daysAgo(daysOld),
      age: storedAge,
      userId: user.id,
    },
  });
  ids[key] = horse.id;
  return horse;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `agingbatch-${RUN}@test.com`,
      username: `agingbatch${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Aging',
      lastName: 'Batch',
      money: 0,
    },
  });
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: Object.values(ids) } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  // Plain birthdays to game-year 3 (21-27 days old, stored 2): no milestone.
  await makeHorse('plain3a', { daysOld: 21, storedAge: 2 });
  await makeHorse('plain3b', { daysOld: 24, storedAge: 2 });
  await makeHorse('plain3c', { daysOld: 27, storedAge: 2 });
  // Plain birthdays to game-year 5 (35-41 days old, stored 4): no milestone.
  await makeHorse('plain5a', { daysOld: 35, storedAge: 4 });
  await makeHorse('plain5b', { daysOld: 38, storedAge: 4 });
  // Stored age ahead of the calendar (corrupt row): corrected to 5, no birthday.
  await makeHorse('ahead5', { daysOld: 36, storedAge: 30 });
  // Already current: untouched.
  await makeHorse('current', { daysOld: 36, storedAge: 5 });
  // Milestones keep their individual path.
  await makeHorse('age1', { daysOld: 8, storedAge: 0 });
  await makeHorse('retire', { daysOld: 147, storedAge: 20 });
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('processHorseBirthdays() (Equoria-cmw85.27)', () => {
  it('re-fetches no scanned horse, batches plain birthdays, and ages every horse identically', async () => {
    const counts = { findUnique: 0, update: 0, updateMany: 0 };
    const originals = {};
    for (const op of Object.keys(counts)) {
      originals[op] = prisma.horse[op].bind(prisma.horse);
      prisma.horse[op] = (...args) => {
        counts[op] += 1;
        return originals[op](...args);
      };
    }

    let summary;
    try {
      summary = await processHorseBirthdays({ horseIds: Object.values(ids) });
    } finally {
      for (const op of Object.keys(counts)) {
        prisma.horse[op] = originals[op];
      }
    }

    // Behaviour: result summary and persisted ages.
    expect(summary.totalProcessed).toBe(9);
    expect(summary.birthdaysFound).toBe(8); // every horse but 'current'
    expect(summary.milestonesTriggered).toBe(2); // age1 + retire
    expect(summary.errors).toBe(0);

    const byId = Object.fromEntries(summary.results.map(r => [r.horseId, r]));
    expect(summary.results).toHaveLength(8);
    expect(summary.results.map(r => r.horseId)).toEqual([...summary.results.map(r => r.horseId)].sort((a, b) => a - b));
    for (const key of ['plain3a', 'plain3b', 'plain3c']) {
      expect(byId[ids[key]]).toMatchObject({
        ageUpdated: true,
        newAge: 3,
        hadBirthday: true,
        milestonesTriggered: [],
        traitsAssigned: [],
      });
    }
    for (const key of ['plain5a', 'plain5b']) {
      expect(byId[ids[key]]).toMatchObject({
        ageUpdated: true,
        newAge: 5,
        hadBirthday: true,
        milestonesTriggered: [],
      });
    }
    expect(byId[ids.ahead5]).toMatchObject({
      ageUpdated: true,
      newAge: 5,
      hadBirthday: false,
      milestonesTriggered: [],
    });
    expect(byId[ids.age1]).toMatchObject({ newAge: 1, hadBirthday: true });
    expect(byId[ids.age1].milestonesTriggered).toHaveLength(1);
    expect(byId[ids.age1].milestonesTriggered).not.toContain('retirement');
    expect(byId[ids.retire]).toMatchObject({ newAge: 21, hadBirthday: true });
    expect(byId[ids.retire].milestonesTriggered).toEqual(['retirement']);
    expect(byId[ids.current]).toBeUndefined();

    const rows = await prisma.horse.findMany({
      where: { id: { in: Object.values(ids) } },
      select: { id: true, age: true },
    });
    const ageOf = Object.fromEntries(rows.map(r => [r.id, r.age]));
    expect(ageOf[ids.plain3a]).toBe(3);
    expect(ageOf[ids.plain3b]).toBe(3);
    expect(ageOf[ids.plain3c]).toBe(3);
    expect(ageOf[ids.plain5a]).toBe(5);
    expect(ageOf[ids.plain5b]).toBe(5);
    expect(ageOf[ids.ahead5]).toBe(5);
    expect(ageOf[ids.current]).toBe(5);
    expect(ageOf[ids.age1]).toBe(1);
    expect(ageOf[ids.retire]).toBe(21);

    // Query shape: the only findUnique reads left are the two milestone reads
    // (age-1 trait data, retirement log line) - none per scanned horse.
    expect(counts.findUnique).toBeLessThanOrEqual(2);
    // Plain/corrective updates collapse to one updateMany per distinct new age
    // (3 and 5); only the two milestone horses are written one by one.
    expect(counts.updateMany).toBeLessThanOrEqual(2);
    expect(counts.update).toBeLessThanOrEqual(2);
  }, 60_000);
});
