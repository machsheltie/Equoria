/**
 * POST /api/v1/marketplace/buy/:horseId — the seller's staff do not travel
 * with the horse (audit 2026-07 finding 6 / Equoria-6p398.6).
 *
 * Riders and trainers are EMPLOYEES of a user: `Rider.userId` / `Trainer.userId`
 * are set when the player hires (and pays for) them, and assignment requires
 * that the player owns BOTH the staff member and the horse
 * (riderController.assignRider / trainerController.assignTrainer). Selling a
 * horse therefore cannot move an employee, and an employee cannot stay actively
 * assigned to a horse their employer no longer owns. Before this fix the sale
 * left both assignment rows active, which had two live consequences:
 *
 *   - the seller's rider/trainer stayed "busy" on a horse the seller no longer
 *     owned, and the assign endpoints refused to put them on anything else
 *     ("Rider is already assigned to a horse. Unassign first."); and
 *   - `trainingController.trainHorse` looks up the active TrainerAssignment by
 *     horseId alone, so the BUYER's training sessions were modified by — and
 *     awarded XP to — the SELLER's trainer.
 *
 * History is preserved: the assignment rows survive, deactivated. Nothing is
 * re-owned; only `isActive` and the horse's derived `rider` JSON change.
 *
 * Real DB, real HTTP, real CSRF, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { setMarketplaceRaceBarrier } from '../services/marketplaceRaceBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-6-staff';
const LIST_PRICE = 400;
const BARRIER_TIMEOUT_MS = 20000;

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser(role, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${role}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'StaffTransfer',
      lastName: role,
      money,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, { forSale = false, salePrice = 0 } = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
      forSale,
      salePrice,
    },
  });
}

async function makeRider(ownerId) {
  return prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `StaffRider-${tag()}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Jumping',
      weeklyRate: 200,
      level: 4,
      userId: ownerId,
    },
  });
}

async function makeTrainer(ownerId) {
  return prisma.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `StaffTrainer-${tag()}`,
      personality: 'focused',
      skillLevel: 'expert',
      speciality: 'Jumping',
      sessionRate: 150,
      level: 4,
      userId: ownerId,
    },
  });
}

async function assignRiderRequest(token, riderId, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/riders/assignments')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ riderId, horseId });
}

async function assignTrainerRequest(token, trainerId, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/trainers/assignments')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ trainerId, horseId });
}

async function unassignRiderRequest(token, assignmentId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .delete(`/api/v1/riders/assignments/${assignmentId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}

async function buyRequest(token, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(`/api/v1/marketplace/buy/${horseId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});
}

/** Settled-safe: a rejected supertest promise must not surface as an unhandled rejection. */
function buySettled(token, horseId) {
  return buyRequest(token, horseId).then(
    res => ({ status: res.status, body: res.body }),
    err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
  );
}

/** Arm the delay-only interleaving seam for exactly ONE buyer. */
function armBarrierFor(buyerId) {
  let markReached;
  let openGate;
  const reached = new Promise(resolve => {
    markReached = resolve;
  });
  const gate = new Promise(resolve => {
    openGate = resolve;
  });
  setMarketplaceRaceBarrier(async (stage, context) => {
    if (stage !== 'buyHorse:afterListingRead' || context?.buyerId !== buyerId) {
      return;
    }
    markReached();
    await gate;
  });
  return {
    reached,
    release: () => openGate(),
    disarm: () => setMarketplaceRaceBarrier(null),
  };
}

async function waitFor(promise, label) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), BARRIER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function horseRow(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true, userId: true, rider: true },
  });
}

describe('buyHorse — seller-owned staff stay with the seller (finding 6)', () => {
  const cleanup = createCleanupTracker();
  let seller;
  let buyer;
  let listedHorse;
  let keptHorse;
  let rider;
  let trainer;
  let riderAssignmentId;
  let trainerAssignmentId;

  beforeEach(async () => {
    seller = await makeUser('seller', 0);
    buyer = await makeUser('buyer', 10000);
    listedHorse = await makeHorse(seller.id, { forSale: true, salePrice: LIST_PRICE });
    keptHorse = await makeHorse(seller.id);
    rider = await makeRider(seller.id);
    trainer = await makeTrainer(seller.id);

    const userIds = [seller.id, buyer.id];
    const horseIds = [listedHorse.id, keptHorse.id];

    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds } } }), 'riderAssignment');
    cleanup.add(
      () => prisma.trainerAssignment.deleteMany({ where: { horseId: { in: horseIds } } }),
      'trainerAssignment',
    );
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: rider.id } }), 'rider');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: trainer.id } }), 'trainer');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');

    const riderAssigned = await assignRiderRequest(seller.token, rider.id, listedHorse.id);
    expect(riderAssigned.status).toBe(201);
    riderAssignmentId = riderAssigned.body.data.id;

    const trainerAssigned = await assignTrainerRequest(seller.token, trainer.id, listedHorse.id);
    expect(trainerAssigned.status).toBe(201);
    trainerAssignmentId = trainerAssigned.body.data.id;
  }, 60000);

  afterEach(async () => {
    setMarketplaceRaceBarrier(null);
    await cleanup.run();
  }, 30000);

  it('ends the seller’s rider and trainer assignments and clears the horse rider', async () => {
    const bought = await buyRequest(buyer.token, listedHorse.id);
    expect(bought.status).toBe(200);

    const persistedHorse = await horseRow(listedHorse.id);
    expect(persistedHorse.userId).toBe(buyer.id);
    expect(persistedHorse.rider).toBeNull();

    // History rows survive, deactivated — nothing is deleted, nothing re-owned.
    const riderAssignment = await prisma.riderAssignment.findUnique({
      where: { id: riderAssignmentId },
    });
    expect(riderAssignment).not.toBeNull();
    expect(riderAssignment.isActive).toBe(false);
    expect(riderAssignment.userId).toBe(seller.id);

    const trainerAssignment = await prisma.trainerAssignment.findUnique({
      where: { id: trainerAssignmentId },
    });
    expect(trainerAssignment).not.toBeNull();
    expect(trainerAssignment.isActive).toBe(false);
    expect(trainerAssignment.userId).toBe(seller.id);

    // The staff themselves never changed hands.
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).userId).toBe(seller.id);
    expect((await prisma.trainer.findUnique({ where: { id: trainer.id } })).userId).toBe(seller.id);

    // And the buyer inherits no staff at all.
    expect(await prisma.riderAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
  }, 60000);

  it('frees the seller’s rider to work another horse the seller still owns', async () => {
    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    const reassigned = await assignRiderRequest(seller.token, rider.id, keptHorse.id);
    expect(reassigned.status).toBe(201);
    expect((await horseRow(keptHorse.id)).rider.id).toBe(rider.id);
  }, 60000);

  it('leaves the seller’s staff untouched when the purchase is rejected', async () => {
    const brokeBuyer = await makeUser('broke', 1);
    cleanup.add(() => prisma.user.deleteMany({ where: { id: brokeBuyer.id } }), 'brokeBuyer');

    const rejected = await buyRequest(brokeBuyer.token, listedHorse.id);
    expect(rejected.status).toBe(400);

    const persistedHorse = await horseRow(listedHorse.id);
    expect(persistedHorse.userId).toBe(seller.id);
    expect(persistedHorse.rider.id).toBe(rider.id);
    expect((await prisma.riderAssignment.findUnique({ where: { id: riderAssignmentId } })).isActive).toBe(true);
    expect((await prisma.trainerAssignment.findUnique({ where: { id: trainerAssignmentId } })).isActive).toBe(true);
  }, 60000);

  it('stays consistent when the seller unassigns while the purchase is in flight', async () => {
    const barrier = armBarrierFor(buyer.id);
    let purchase;
    let unassigned;
    try {
      purchase = buySettled(buyer.token, listedHorse.id);
      await waitFor(barrier.reached, 'the buyer to read the listing');

      // The seller unassigns the rider from a horse they still own, in the
      // window between the buyer's listing read and the buyer's claim.
      unassigned = await unassignRiderRequest(seller.token, riderAssignmentId);
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bought = await purchase;
    expect(bought.status).toBe(200);
    expect(unassigned.status).toBe(200);

    // Whichever way the two transactions serialize, the end state is the same
    // and both representations agree: the horse belongs to the buyer, carries
    // no rider, and no assignment on it is still active.
    const persistedHorse = await horseRow(listedHorse.id);
    expect(persistedHorse.userId).toBe(buyer.id);
    expect(persistedHorse.rider).toBeNull();
    expect(await prisma.riderAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.horseSale.count({ where: { horseId: listedHorse.id } })).toBe(1);
  }, 60000);
});
