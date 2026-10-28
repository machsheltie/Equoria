/**
 * trainingAfterSale.integration.test.mjs (Equoria-kiwe5, audit TRAIN-07)
 *
 * Defect: the train call read the horse's owner before its transaction and
 * charged that owner, while the weekly cooldown claim matched the horse by id
 * alone. A horse sold between the route's ownership check and the claim was
 * trained on the seller's coins and used up the buyer's week.
 *
 * Contract: the session is charged to the player who pressed Train, and the
 * cooldown claim only succeeds while that player still owns the horse.
 *
 * The race is made deterministic with a lock barrier: the "sale" runs in a
 * holder transaction that locks the horse row and moves it to the buyer. The
 * session's reads see the seller, its claim queues on the horse row, the sale
 * commits, and the session must refuse with nothing written.
 *
 * Real DB, real controller. Fixtures are id-scoped with fail-loud cleanup.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';
import { createBarrierClient, raceBehindLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const barrierClient = createBarrierClient();
const userIds = [];
const horseIds = [];
let seller;
let buyer;
let horse;

async function makeUser(role) {
  const user = await prisma.user.create({
    data: {
      username: `TestFixture-kiwe5-${role}-${rand()}`,
      email: `testfixture-kiwe5-${role}-${rand()}@test.local`,
      password: 'irrelevant-hash',
      firstName: 'Train',
      lastName: 'Sale',
      money: 10000,
    },
  });
  userIds.push(user.id);
  return user;
}

beforeEach(async () => {
  seller = await makeUser('seller');
  buyer = await makeUser('buyer');
  const breed = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-kiwe5-${rand()}`,
      dateOfBirth: gameCalendarDate(new Date(), -(6 * 7 + 1)),
      age: 6,
      sex: 'Mare',
      userId: seller.id,
      breedId: breed.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
    },
  });
  horseIds.push(horse.id);
  await assignTestTrainer(horse);
});

afterAll(async () => {
  cleanup.add(() => cleanupTestTrainers(), 'trainers');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'training logs');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.xpEvent.deleteMany({ where: { userId: { in: userIds } } }), 'xp');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'transactions');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  await cleanup.run();
  await barrierClient.$disconnect();
}, 60000);

describe('training a horse sold mid-request (Equoria-kiwe5)', () => {
  it("refuses, charges the seller nothing and leaves the buyer's week unused", async () => {
    const [result] = await raceBehindLock(
      barrierClient,
      tx => tx.$executeRaw`UPDATE "horses" SET "userId" = ${buyer.id} WHERE "id" = ${horse.id}`,
      [() => trainHorse(horse.id, 'Dressage', { actorUserId: seller.id })],
    );

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no longer yours/);

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { userId: true, trainingCooldown: true, disciplineScores: true },
    });
    expect(after.userId).toBe(buyer.id);
    expect(after.trainingCooldown).toBeNull();
    expect(after.disciplineScores ?? {}).not.toHaveProperty('Dressage');

    const sellerAfter = await prisma.user.findUnique({
      where: { id: seller.id },
      select: { money: true, xp: true },
    });
    expect(sellerAfter.money).toBe(10000);
    expect(await prisma.trainingLog.count({ where: { horseId: horse.id } })).toBe(0);
  });

  it('the owner who presses Train is the one charged', async () => {
    const result = await trainHorse(horse.id, 'Dressage', { actorUserId: seller.id });
    expect(result.success).toBe(true);
    const sellerAfter = await prisma.user.findUnique({
      where: { id: seller.id },
      select: { money: true },
    });
    expect(sellerAfter.money).toBe(10000 - result.trainingFee);
  });
});
