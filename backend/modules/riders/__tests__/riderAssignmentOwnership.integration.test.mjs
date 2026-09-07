/**
 * DELETE /api/v1/riders/assignments/:id — ownership + current-assignment
 * invariants (audit 2026-07 finding 6 / Equoria-6p398.6).
 *
 * The defect: the endpoint authorized on the ASSIGNMENT ROW's stored `userId`
 * only, accepted an inactive (historical) row, and then cleared
 * `Horse.rider` by horse id with no ownership predicate at all. A player who
 * had once put a rider on a horse could therefore null the CURRENT owner's
 * rider — or their own replacement rider — long after that assignment stopped
 * being the horse's rider, and the two representations (the assignment rows
 * and `Horse.rider`) drifted apart.
 *
 * What is asserted here is persisted state, never a status code alone:
 *   - `Horse.rider` (the JSON the competition engine reads through
 *     `hasValidRider`), and
 *   - the `RiderAssignment` rows' `isActive` flags (the roster representation).
 *
 * Real DB, real HTTP, real CSRF, real marketplace purchase for the ownership
 * transfer, scoped fail-loud fixtures. No mocks.
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

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-6-owner';
const LIST_PRICE = 500;

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
      firstName: 'Finding6',
      lastName: role,
      money,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
    },
  });
}

async function makeRider(ownerId, label) {
  return prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `${label}-${tag()}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Jumping',
      weeklyRate: 200,
      level: 3,
      userId: ownerId,
    },
  });
}

function assignRiderRequest(token, riderId, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post('/api/v1/riders/assignments')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId, horseId }),
  );
}

function unassignRequest(token, assignmentId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .delete(`/api/v1/riders/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken),
  );
}

function buyRequest(token, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .post(`/api/v1/marketplace/buy/${horseId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({}),
  );
}

async function horseRow(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true, userId: true, rider: true },
  });
}

async function assignmentRow(assignmentId) {
  return prisma.riderAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, riderId: true, horseId: true, userId: true, isActive: true },
  });
}

describe('rider assignment ownership (finding 6)', () => {
  const cleanup = createCleanupTracker();
  let seller;
  let buyer;
  let horse;
  let sellerRider;
  let sellerRiderTwo;
  let buyerRider;

  beforeEach(async () => {
    seller = await makeUser('seller', 0);
    buyer = await makeUser('buyer', 10000);
    horse = await makeHorse(seller.id);
    sellerRider = await makeRider(seller.id, 'SellerRider');
    sellerRiderTwo = await makeRider(seller.id, 'SellerRiderTwo');
    buyerRider = await makeRider(buyer.id, 'BuyerRider');

    const userIds = [seller.id, buyer.id];
    const horseIds = [horse.id];
    const riderIds = [sellerRider.id, sellerRiderTwo.id, buyerRider.id];

    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds } } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('a former owner cannot clear the new owner’s rider through the historical assignment', async () => {
    // A assigns their rider, then sells the horse to B.
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    expect(assigned.status).toBe(201);
    const sellerAssignmentId = assigned.body.data.id;

    await prisma.horse.update({
      where: { id: horse.id },
      data: { forSale: true, salePrice: LIST_PRICE },
    });
    const bought = await buyRequest(buyer.token, horse.id);
    expect(bought.status).toBe(200);

    // B puts their OWN rider on the horse they now own.
    const replacement = await assignRiderRequest(buyer.token, buyerRider.id, horse.id);
    expect(replacement.status).toBe(201);
    const buyerAssignmentId = replacement.body.data.id;

    // A deletes the stale assignment id. This must not touch B's horse.
    const stale = await unassignRequest(seller.token, sellerAssignmentId);

    // Persisted state first: the damage the audit reproduced is B's rider
    // being erased, which the pre-fix endpoint did while answering HTTP 200.
    const persistedHorse = await horseRow(horse.id);
    expect(persistedHorse.userId).toBe(buyer.id);
    expect(persistedHorse.rider).not.toBeNull();
    expect(persistedHorse.rider.id).toBe(buyerRider.id);

    expect((await assignmentRow(buyerAssignmentId)).isActive).toBe(true);
    expect((await assignmentRow(sellerAssignmentId)).isActive).toBe(false);

    expect(stale.status).toBe(409);
    expect(stale.body.success).toBe(false);
  }, 60000);

  it('repeating the stale deletion still preserves the new owner’s rider', async () => {
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const sellerAssignmentId = assigned.body.data.id;

    await prisma.horse.update({
      where: { id: horse.id },
      data: { forSale: true, salePrice: LIST_PRICE },
    });
    expect((await buyRequest(buyer.token, horse.id)).status).toBe(200);
    const replacement = await assignRiderRequest(buyer.token, buyerRider.id, horse.id);
    const buyerAssignmentId = replacement.body.data.id;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stale = await unassignRequest(seller.token, sellerAssignmentId);
      expect(stale.status).toBe(409);
    }

    const persistedHorse = await horseRow(horse.id);
    expect(persistedHorse.rider.id).toBe(buyerRider.id);
    expect((await assignmentRow(buyerAssignmentId)).isActive).toBe(true);
  }, 60000);

  it('an owner’s own superseded assignment cannot clear their replacement rider', async () => {
    const first = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    expect(first.status).toBe(201);
    const firstAssignmentId = first.body.data.id;

    // Assigning a second rider to the same horse supersedes the first row.
    const second = await assignRiderRequest(seller.token, sellerRiderTwo.id, horse.id);
    expect(second.status).toBe(201);
    const secondAssignmentId = second.body.data.id;

    const stale = await unassignRequest(seller.token, firstAssignmentId);
    expect(stale.status).toBe(409);

    const persistedHorse = await horseRow(horse.id);
    expect(persistedHorse.rider).not.toBeNull();
    expect(persistedHorse.rider.id).toBe(sellerRiderTwo.id);
    expect((await assignmentRow(secondAssignmentId)).isActive).toBe(true);
    expect((await assignmentRow(firstAssignmentId)).isActive).toBe(false);
  }, 60000);

  it('a legitimate unassignment clears the assignment row and the horse rider together', async () => {
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const assignmentId = assigned.body.data.id;
    expect((await horseRow(horse.id)).rider.id).toBe(sellerRider.id);

    const removed = await unassignRequest(seller.token, assignmentId);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);

    expect((await horseRow(horse.id)).rider).toBeNull();
    expect((await assignmentRow(assignmentId)).isActive).toBe(false);
  }, 60000);

  it('a failed assignment write leaves the horse rider untouched (both representations roll back)', async () => {
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const assignmentId = assigned.body.data.id;

    // A genuine, unmocked in-transaction write failure: `RiderAssignment` is
    // UNIQUE on (riderId, horseId, isActive), so a pre-existing INACTIVE row
    // for this exact rider+horse pair makes the deactivation UPDATE violate the
    // constraint. Nothing about the request is faked — the deactivation is the
    // real statement, and it really fails.
    const collidingRow = await prisma.riderAssignment.create({
      data: {
        riderId: sellerRider.id,
        horseId: horse.id,
        userId: seller.id,
        isActive: false,
      },
    });
    expect(collidingRow.id).not.toBe(assignmentId);

    const attempted = await unassignRequest(seller.token, assignmentId);
    // P2002 carries no numeric `status`, so it falls through to the controller's
    // generic 500 — pinned here so a future change to that mapping is a visible
    // decision rather than a silent one. (The underlying constraint defect is a
    // known residual: Equoria-kccmt owns the partial-unique-index migration.)
    expect(attempted.status).toBe(500);

    // The horse's rider must not have been cleared by a transaction that
    // could not also record the unassignment.
    const persistedHorse = await horseRow(horse.id);
    expect(persistedHorse.rider).not.toBeNull();
    expect(persistedHorse.rider.id).toBe(sellerRider.id);
    expect((await assignmentRow(assignmentId)).isActive).toBe(true);
  }, 60000);
});
