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
import { __TESTING_ONLY_setMarketplaceRaceBarrier } from '../services/marketplaceRaceBarrier.mjs';

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

async function makeGroom(ownerId) {
  return prisma.groom.create({
    data: {
      name: `TestFixture-StaffGroom-${tag()}`,
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      personality: 'gentle',
      sessionRate: 20.0,
      userId: ownerId,
    },
  });
}

/**
 * Groom assignments are created directly: the groom-assign endpoint carries
 * eligibility/capacity rules of its own that are not what this suite is about,
 * and the reconciliation acts on the ROW. The shape written here is the shape
 * `groomAssignmentService.createAssignment` writes.
 */
async function makeGroomAssignment(groomId, horseId, ownerId, { isActive = true } = {}) {
  return prisma.groomAssignment.create({
    data: {
      groomId,
      foalId: horseId,
      userId: ownerId,
      priority: 1,
      isActive,
      ...(isActive ? {} : { endDate: new Date('2026-01-01') }),
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

async function unassignTrainerRequest(token, assignmentId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .delete(`/api/v1/trainers/assignments/${assignmentId}`)
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
  __TESTING_ONLY_setMarketplaceRaceBarrier(async (stage, context) => {
    if (stage !== 'buyHorse:afterListingRead' || context?.buyerId !== buyerId) {
      return;
    }
    markReached();
    await gate;
  });
  return {
    reached,
    release: () => openGate(),
    disarm: () => __TESTING_ONLY_setMarketplaceRaceBarrier(null),
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
  let groom;
  let riderAssignmentId;
  let trainerAssignmentId;
  let groomAssignmentId;

  beforeEach(async () => {
    seller = await makeUser('seller', 0);
    buyer = await makeUser('buyer', 10000);
    listedHorse = await makeHorse(seller.id, { forSale: true, salePrice: LIST_PRICE });
    keptHorse = await makeHorse(seller.id);
    rider = await makeRider(seller.id);
    trainer = await makeTrainer(seller.id);
    groom = await makeGroom(seller.id);

    const userIds = [seller.id, buyer.id];
    const horseIds = [listedHorse.id, keptHorse.id];

    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds } } }), 'riderAssignment');
    cleanup.add(
      () => prisma.trainerAssignment.deleteMany({ where: { horseId: { in: horseIds } } }),
      'trainerAssignment',
    );
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom.id } }), 'groomInteraction');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: { in: horseIds } } }), 'groomAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: rider.id } }), 'rider');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: trainer.id } }), 'trainer');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
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

    groomAssignmentId = (await makeGroomAssignment(groom.id, listedHorse.id, seller.id)).id;
  }, 60000);

  afterEach(async () => {
    __TESTING_ONLY_setMarketplaceRaceBarrier(null);
    await cleanup.run();
  }, 30000);

  it('ends the seller’s rider, trainer and groom assignments and clears the horse rider', async () => {
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

    // Grooms too: dailyCareAutomation and processWeeklySalaries read active
    // assignments with no ownership check, so an active groom row on a sold
    // horse keeps grooming the buyer's horse on the seller's payroll.
    const groomAssignment = await prisma.groomAssignment.findUnique({
      where: { id: groomAssignmentId },
    });
    expect(groomAssignment).not.toBeNull();
    expect(groomAssignment.isActive).toBe(false);
    expect(groomAssignment.endDate).not.toBeNull();
    expect(groomAssignment.userId).toBe(seller.id);

    // The staff themselves never changed hands.
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).userId).toBe(seller.id);
    expect((await prisma.trainer.findUnique({ where: { id: trainer.id } })).userId).toBe(seller.id);
    expect((await prisma.groom.findUnique({ where: { id: groom.id } })).userId).toBe(seller.id);

    // And the buyer inherits no staff at all.
    expect(await prisma.riderAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.groomAssignment.count({ where: { foalId: listedHorse.id, isActive: true } })).toBe(0);
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
    expect((await prisma.groomAssignment.findUnique({ where: { id: groomAssignmentId } })).isActive).toBe(true);
  }, 60000);

  it('stays consistent when the seller unassigns while the purchase is in flight', async () => {
    const barrier = armBarrierFor(buyer.id);
    let purchase;
    let unassignedStatus;
    try {
      purchase = buySettled(buyer.token, listedHorse.id);
      await waitFor(barrier.reached, 'the buyer to read the listing');

      // The seller unassigns the rider from a horse they still own, in the
      // window between the buyer's listing read and the buyer's claim. The
      // status is read HERE, inside the try, so a failure surfaces as itself
      // rather than as a later read of an undefined response.
      unassignedStatus = (await unassignRiderRequest(seller.token, riderAssignmentId)).status;
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bought = await purchase;
    expect(bought.status).toBe(200);
    expect(unassignedStatus).toBe(200);

    // Whichever way the two transactions serialize, the end state is the same
    // and both representations agree: the horse belongs to the buyer, carries
    // no rider, and no assignment on it is still active.
    const persistedHorse = await horseRow(listedHorse.id);
    expect(persistedHorse.userId).toBe(buyer.id);
    expect(persistedHorse.rider).toBeNull();
    expect(await prisma.riderAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.groomAssignment.count({ where: { foalId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.horseSale.count({ where: { horseId: listedHorse.id } })).toBe(1);
  }, 60000);

  it('completes when the horse carries a re-assigned staff pair (composite-unique collision)', async () => {
    // Four ordinary actions reach what used to be a collision: assign ->
    // unassign -> assign the SAME staff member to the SAME horse again leaves
    // an inactive row beside the active one. Under the old composite uniques
    // (riderId|trainerId|groomId, horse, isActive) deactivating the active row
    // violated the index, and inside the buy transaction that P2002 aborted a
    // legitimate purchase. Since Equoria-kccmt the uniques are PARTIAL indexes
    // over active rows only, so the sale simply deactivates and every
    // historical row survives — which is what this now asserts.
    expect((await unassignRiderRequest(seller.token, riderAssignmentId)).status).toBe(200);
    const riderReassigned = await assignRiderRequest(seller.token, rider.id, listedHorse.id);
    expect(riderReassigned.status).toBe(201);
    const currentRiderAssignmentId = riderReassigned.body.data.id;
    expect(currentRiderAssignmentId).not.toBe(riderAssignmentId);

    expect((await unassignTrainerRequest(seller.token, trainerAssignmentId)).status).toBe(200);
    const trainerReassigned = await assignTrainerRequest(seller.token, trainer.id, listedHorse.id);
    expect(trainerReassigned.status).toBe(201);
    const currentTrainerAssignmentId = trainerReassigned.body.data.id;

    // Same shape for the groom pair, written directly (see makeGroomAssignment).
    const supersededGroom = await makeGroomAssignment(groom.id, listedHorse.id, seller.id, {
      isActive: false,
    });
    // Care history hangs off the row about to be superseded — it must survive.
    const interaction = await prisma.groomInteraction.create({
      data: {
        foalId: listedHorse.id,
        groomId: groom.id,
        assignmentId: supersededGroom.id,
        interactionType: 'daily_care',
        duration: 30,
        bondingChange: 2,
      },
    });

    const bought = await buyRequest(buyer.token, listedHorse.id);
    expect(bought.status).toBe(200);

    const persistedHorse = await horseRow(listedHorse.id);
    expect(persistedHorse.userId).toBe(buyer.id);
    expect(persistedHorse.rider).toBeNull();

    // The assignment in force at the moment of sale survives, deactivated ...
    expect((await prisma.riderAssignment.findUnique({ where: { id: currentRiderAssignmentId } })).isActive).toBe(false);
    expect((await prisma.trainerAssignment.findUnique({ where: { id: currentTrainerAssignmentId } })).isActive).toBe(
      false,
    );
    expect(await prisma.riderAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.trainerAssignment.count({ where: { horseId: listedHorse.id, isActive: true } })).toBe(0);
    expect(await prisma.groomAssignment.count({ where: { foalId: listedHorse.id, isActive: true } })).toBe(0);

    // ... and so does the SUPERSEDED one.
    //
    // DELIBERATE CONTRACT INVERSION (Equoria-kccmt, closing Equoria-6p398.10).
    // Until the partial unique index landed, these two assertions read
    // `.toBeNull()` — they PROVED that the sale destroyed one assignment row
    // per re-assigned pair, which was the stated history cost of the interim
    // delete-superseded guard in `endActiveAssignmentsOnHorse`. The owner
    // accepted the index, the guard is gone, and the contract is now the
    // opposite: a sale ends assignments, it never deletes them. This is an
    // intended contract change, not a weakened assertion — the old expectation
    // could only have been met by deleting player history.
    const supersededGroomRow = await prisma.groomAssignment.findUnique({
      where: { id: supersededGroom.id },
    });
    expect(supersededGroomRow).not.toBeNull();
    expect(supersededGroomRow.isActive).toBe(false);

    const supersededRiderRow = await prisma.riderAssignment.findUnique({
      where: { id: riderAssignmentId },
    });
    expect(supersededRiderRow).not.toBeNull();
    expect(supersededRiderRow.isActive).toBe(false);

    // The care history that hung off the superseded groom row keeps its
    // back-link too, because the row it points at is still there. (Before the
    // index this survived only with `assignmentId` nulled by ON DELETE SET
    // NULL — the second half of the same inversion.)
    const persistedInteraction = await prisma.groomInteraction.findUnique({
      where: { id: interaction.id },
    });
    expect(persistedInteraction).not.toBeNull();
    expect(persistedInteraction.assignmentId).toBe(supersededGroom.id);
    expect(persistedInteraction.bondingChange).toBe(2);
  }, 60000);
});
