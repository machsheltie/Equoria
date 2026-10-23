/**
 * Equoria-oey96.50 — the horse's rider copy carries the rider's name.
 *
 * assignRider copies the rider into `Horse.rider` JSON as { id, name, level,
 * speciality }. Riders have firstName/lastName and no `name` column, so the copy
 * was written with `name: undefined`, which JSON drops: every assigned horse's
 * rider copy had no name. The write site was fixed in 2746d4211 (pinned by
 * riderAssignJsonName.integration).
 *
 * Owner ruling 2026-10-23: copies written before the fix are backfilled from the
 * rider record (backend/scripts/backfill-horse-rider-names.mjs). The backfill is
 * proven here on rows this suite plants: dry run writes nothing, execute fills
 * only the nameless copies it can resolve, and a second run changes nothing.
 *
 * Real DB, real script function. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { backfillHorseRiderNames } from '../../../scripts/backfill-horse-rider-names.mjs';

const fixturePrefix = 'TestFixture-oey96_50-rider';
const RUN = randomBytes(4).toString('hex');

const createdHorseIds = [];
const createdRiderIds = [];
const cleanup = createCleanupTracker();
let user;

async function seedRider(lastName) {
  const rider = await prisma.rider.create({
    data: {
      userId: user.id,
      firstName: 'Willow',
      lastName: `${lastName}${RUN}`,
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate: 100,
    },
  });
  createdRiderIds.push(rider.id);
  return rider;
}

async function seedHorse(label, rider = undefined) {
  return createTestHorse(
    prisma,
    {
      name: `${fixturePrefix}-${label}-${RUN}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01T00:00:00.000Z'),
      userId: user.id,
      ...(rider === undefined ? {} : { rider }),
    },
    createdHorseIds,
  );
}

const riderOf = async horseId =>
  (await prisma.horse.findUnique({ where: { id: horseId }, select: { rider: true } })).rider;

beforeAll(async () => {
  const pw = await bcrypt.hash('TestPassword123!', 1);
  user = await prisma.user.create({
    data: {
      username: `${fixturePrefix}-${RUN}`,
      email: `${fixturePrefix}-${RUN}@example.com`,
      password: pw,
      firstName: 'Rider',
      lastName: 'Name',
    },
  });
  cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { userId: user.id } }), 'riderAssignment');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: createdRiderIds } } }), 'rider');
  cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('backfill-horse-rider-names (Equoria-oey96.50)', () => {
  let nameless;
  let emptyName;
  let named;
  let orphan;
  let scope;
  let riderA;
  let riderB;

  beforeAll(async () => {
    riderA = await seedRider('Backfill');
    riderB = await seedRider('Kept');
    // The pre-fix shape: no name key at all.
    nameless = await seedHorse('nameless', { id: riderA.id, level: 3, speciality: 'Show Jumping' });
    emptyName = await seedHorse('empty', { id: riderA.id, name: '', level: 3 });
    named = await seedHorse('named', { id: riderB.id, name: 'Custom Name', level: 1 });
    // Points at a rider row that does not exist.
    orphan = await seedHorse('orphan', { id: 2147480000, level: 1 });
    scope = [nameless.id, emptyName.id, named.id, orphan.id];
  });

  it('dry run counts and writes nothing', async () => {
    const counts = await backfillHorseRiderNames({ horseIds: scope });
    expect(counts).toEqual({ nameless: 3, fixable: 2, riderMissing: 1, updated: 0 });
    expect(await riderOf(nameless.id)).toEqual({ id: riderA.id, level: 3, speciality: 'Show Jumping' });
  });

  it('execute fills only the nameless copies it can resolve, and keeps every other key', async () => {
    const counts = await backfillHorseRiderNames({ horseIds: scope, execute: true });
    expect(counts).toEqual({ nameless: 3, fixable: 2, riderMissing: 1, updated: 2 });

    const name = `Willow Backfill${RUN}`;
    expect(await riderOf(nameless.id)).toEqual({ id: riderA.id, name, level: 3, speciality: 'Show Jumping' });
    expect(await riderOf(emptyName.id)).toEqual({ id: riderA.id, name, level: 3 });
    expect(await riderOf(named.id)).toEqual({ id: riderB.id, name: 'Custom Name', level: 1 });
    expect(await riderOf(orphan.id)).toEqual({ id: 2147480000, level: 1 });
  });

  it('a second run changes nothing (idempotent)', async () => {
    const counts = await backfillHorseRiderNames({ horseIds: scope, execute: true });
    expect(counts).toEqual({ nameless: 1, fixable: 0, riderMissing: 1, updated: 0 });
  });
});
