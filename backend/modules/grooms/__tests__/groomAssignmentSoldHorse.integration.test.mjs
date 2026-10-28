/**
 * groomAssignmentSoldHorse.integration.test.mjs (Equoria-9e5ff, audit STAFF-15)
 *
 * Defect: both groom-assignment doors checked horse ownership BEFORE their
 * transaction and never again inside it. A horse sold between that read and the
 * create was handed the seller's groom.
 *
 * The race is made deterministic with a lock barrier: the "sale" runs in a
 * holder transaction that locks the horse row and moves it to the buyer. The
 * assignment's ownership read sees the seller (the sale is uncommitted), then
 * its transaction queues on the horse row; the sale commits; the assignment
 * must refuse rather than write the seller's groom onto the buyer's horse.
 *
 * Real DB, real services. Fixtures are id-scoped with fail-loud cleanup.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createAssignment } from '../services/groomAssignmentService.mjs';
import { assignGroomToFoal } from '../services/groomFoalAssignmentService.mjs';
import { createBarrierClient, raceBehindLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const barrierClient = createBarrierClient();
const userIds = [];
const horseIds = [];
const groomIds = [];
let seller;
let buyer;
let horse;
let groom;

async function makeUser(role) {
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `TestFixture-9e5ff-${role}-${rand()}`,
      email: `testfixture-9e5ff-${role}-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Sold',
      lastName: 'Horse',
      money: 1000,
    },
  });
  userIds.push(user.id);
  return user;
}

beforeEach(async () => {
  seller = await makeUser('seller');
  buyer = await makeUser('buyer');
  const breed = await prisma.breed.findFirst({ select: { id: true } });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-9e5ff-${rand()}`,
      dateOfBirth: gameCalendarDate(new Date(), -(5 * 7 + 1)),
      age: 5,
      sex: 'Mare',
      userId: seller.id,
      breedId: breed.id,
      healthStatus: 'Excellent',
    },
  });
  horseIds.push(horse.id);
  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-9e5ff-groom-${rand()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      userId: seller.id,
    },
  });
  groomIds.push(groom.id);
});

afterAll(async () => {
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'groom assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
  await barrierClient.$disconnect();
}, 60000);

/** The sale: lock the horse row and hand it to the buyer, uncommitted until the barrier lifts. */
const sellHorseUnderLock = tx => tx.$executeRaw`UPDATE "horses" SET "userId" = ${buyer.id} WHERE "id" = ${horse.id}`;

const settle = promise =>
  promise.then(
    value => ({ value }),
    error => ({ error }),
  );

describe('a groom is never assigned to a horse sold mid-request (Equoria-9e5ff)', () => {
  it('createAssignment refuses with 409 and writes no assignment', async () => {
    const [outcome] = await raceBehindLock(barrierClient, sellHorseUnderLock, [
      () => settle(createAssignment(groom.id, horse.id, seller.id)),
    ]);

    expect(outcome.error?.statusCode).toBe(409);
    expect(outcome.error?.message).toBe('That horse is no longer yours. Please reload your stable.');
    expect(await prisma.groomAssignment.count({ where: { groomId: groom.id } })).toBe(0);
  });

  it('assignGroomToFoal refuses with 409 and writes no assignment', async () => {
    const [outcome] = await raceBehindLock(barrierClient, sellHorseUnderLock, [
      () => settle(assignGroomToFoal(horse.id, groom.id, seller.id)),
    ]);

    expect(outcome.error?.statusCode).toBe(409);
    expect(await prisma.groomAssignment.count({ where: { groomId: groom.id } })).toBe(0);
  });

  it('a groom dismissed mid-request is not assigned', async () => {
    const [outcome] = await raceBehindLock(
      barrierClient,
      tx =>
        tx.$executeRaw`UPDATE "grooms" SET "isActive" = false WHERE "id" = ${groom.id}`.then(
          () => tx.$executeRaw`SELECT "id" FROM "horses" WHERE "id" = ${horse.id} FOR UPDATE`,
        ),
      [() => settle(createAssignment(groom.id, horse.id, seller.id))],
    );

    expect(outcome.error?.statusCode).toBe(404);
    expect(await prisma.groomAssignment.count({ where: { groomId: groom.id } })).toBe(0);
  });

  it('the owner still assigns her own groom to her own horse', async () => {
    const result = await createAssignment(groom.id, horse.id, seller.id);
    expect(result.success).toBe(true);
    expect(result.assignment.foal.id).toBe(horse.id);
  });
});
