/**
 * DELETE /api/v1/riders/assignments/:id — ownership + current-assignment
 * invariants (audit 2026-07 finding 6 / Equoria-6p398.6).
 *
 * The defect: the endpoint authorized on the ASSIGNMENT ROW's stored `userId`
 * only, accepted an inactive (historical) row, and then cleared
 * the horse by id with no ownership predicate at all. A player who had once put
 * a rider on a horse could therefore end the CURRENT owner's rider — or their
 * own replacement rider — long after that assignment stopped being the horse's
 * rider.
 *
 * Equoria-97se: the Horse.rider JSON copy is gone, so the RiderAssignment rows
 * are the only record of who rides a horse.
 *
 * What is asserted here is persisted state, never a status code alone: the
 * `RiderAssignment` rows' `isActive` flags.
 *
 * Real DB, real HTTP, real CSRF, real marketplace purchase for the ownership
 * transfer, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-6-owner';
const LIST_PRICE = 500;
const barrierClient = createBarrierClient();

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser(role, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
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
    select: { id: true, userId: true },
  });
}

/** The rider on the horse now: its active RiderAssignment, or null. */
async function activeRiderId(horseId) {
  const row = await prisma.riderAssignment.findFirst({
    where: { horseId, isActive: true },
    select: { riderId: true },
  });
  return row?.riderId ?? null;
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
    const userIds = () => [seller?.id, buyer?.id].filter(Boolean);
    const horseIds = () => [horse?.id].filter(Boolean);
    const riderIds = () => [sellerRider?.id, sellerRiderTwo?.id, buyerRider?.id].filter(Boolean);

    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: { in: horseIds() } } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds() } } }), 'rider');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds() } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds() } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds() } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds() } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds() } } }), 'user');

    seller = await makeUser('seller', 0);
    buyer = await makeUser('buyer', 10000);
    horse = await makeHorse(seller.id);
    sellerRider = await makeRider(seller.id, 'SellerRider');
    sellerRiderTwo = await makeRider(seller.id, 'SellerRiderTwo');
    buyerRider = await makeRider(buyer.id, 'BuyerRider');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  afterAll(() => barrierClient.$disconnect(), 30000);

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
    expect(await activeRiderId(horse.id)).toBe(buyerRider.id);

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

    expect(await activeRiderId(horse.id)).toBe(buyerRider.id);
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

    expect(await activeRiderId(horse.id)).toBe(sellerRiderTwo.id);
    expect((await assignmentRow(secondAssignmentId)).isActive).toBe(true);
    expect((await assignmentRow(firstAssignmentId)).isActive).toBe(false);
  }, 60000);

  it('a legitimate unassignment ends the assignment and leaves the horse riderless', async () => {
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const assignmentId = assigned.body.data.id;
    expect(await activeRiderId(horse.id)).toBe(sellerRider.id);

    const removed = await unassignRequest(seller.token, assignmentId);
    expect(removed.status).toBe(200);
    expect(removed.body.success).toBe(true);

    expect(await activeRiderId(horse.id)).toBeNull();
    expect((await assignmentRow(assignmentId)).isActive).toBe(false);
  }, 60000);

  it('a failure after the horse lock rolls the unassignment back', async () => {
    // Equoria-6p398.21. The unassign transaction writes in this order: clear
    // lock the horse row, THEN deactivate the assignment row. A failure on that second
    // write must undo the first. The old forcing mechanism (a composite-unique
    // rejection on deactivation) was removed with Equoria-kccmt, and deactivation
    // cannot fail on data any more, so the failure is forced the way a real
    // contended database forces one: a separate session holds the ASSIGNMENT row
    // FOR UPDATE, so the second write blocks past Prisma's interactive-transaction
    // timeout and the transaction expires. The first step (the horse lock)
    // has by then already been executed inside it. Nothing is mocked: every query is
    // the production query, delayed by a lock the database arbitrates, and the
    // endpoint's own retryable-transaction mapping answers 503.
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const assignmentId = assigned.body.data.id;
    expect(await activeRiderId(horse.id)).toBe(sellerRider.id);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "rider_assignments" WHERE "id" = ${assignmentId} FOR UPDATE`,
    );
    let unassign;
    try {
      const inFlight = unassignRequest(seller.token, assignmentId);
      // Observed blocked on the held lock (pg_blocking_pids), not assumed by timer.
      // Nothing in steps 1-2 touches that row, so a blocked session means the
      // request is parked at the deactivation, after the horse write.
      await barrier.waitForQueued(1);
      // Hold the lock past Prisma's interactive-transaction timeout (5000 ms, the
      // default; this repo sets none). The timeout is what makes the transaction
      // fail: once it has expired, the blocked write cannot be allowed to commit,
      // so the request answers with the retryable-transaction error and the
      // transaction is rolled back, horse write included. Releasing earlier would
      // let the deactivation succeed and the request return 200.
      await new Promise(resolve => setTimeout(resolve, 6500));
      await barrier.release();
      unassign = await inFlight;
    } finally {
      await barrier.release();
    }

    expect(unassign.status).toBe(503);
    expect(unassign.body.success).toBe(false);

    // Read the FINAL state: take the horse row lock on a separate session, which
    // queues until the expired transaction has really finished (its rollback runs
    // once the blocked statement is released), then read inside that lock.
    const finalHorse = await barrierClient.$transaction(
      async tx => {
        await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horse.id} FOR UPDATE`;
        return tx.riderAssignment.findFirst({
          where: { horseId: horse.id, isActive: true },
          select: { riderId: true },
        });
      },
      { maxWait: 20000, timeout: 30000 },
    );

    // Nothing moved: the horse still carries the rider and the assignment is
    // still the active one.
    expect(finalHorse.riderId).toBe(sellerRider.id);
    expect((await assignmentRow(assignmentId)).isActive).toBe(true);
  }, 90000);

  it('a failed assignment write leaves the horse rider untouched', async () => {
    const assigned = await assignRiderRequest(seller.token, sellerRider.id, horse.id);
    const assignmentId = assigned.body.data.id;
    expect(await activeRiderId(horse.id)).toBe(sellerRider.id);

    // FORCING MECHANISM CHANGED (Equoria-kccmt) — the invariant is unchanged.
    // This test used to reach a genuine in-transaction failure by planting a
    // second INACTIVE row for the same rider+horse pair, which the composite
    // unique `(riderId, horseId, isActive)` rejected. That constraint WAS the
    // defect Equoria-kccmt removed: it capped assignment history at one row per
    // pair. Deactivation can no longer fail that way, so the failure is now
    // forced on the ASSIGN transaction instead, which writes in the same order
    // and is the stronger case — the horse lock, then the deactivation, then the
    // create, where the deactivation must be undone.
    //
    // The failure is still genuine and unmocked: a NUL byte is not
    // representable in a Postgres `text` value ("invalid byte sequence for
    // encoding UTF8: 0x00"), so `riderAssignment.create` really fails at the
    // database, after the earlier deactivation has already been written inside
    // the transaction. Nothing about the request is faked; `notes` passes the
    // route's own validation (optional, max 500 characters).
    const poisonNotes = `note${String.fromCharCode(0)}end`;
    const attempted = await fetchCsrf(app).then(csrf =>
      request(app)
        .post('/api/v1/riders/assignments')
        .set('Authorization', `Bearer ${seller.token}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ riderId: sellerRiderTwo.id, horseId: horse.id, notes: poisonNotes }),
    );
    // The database error carries no numeric `status`, so it falls through to the
    // controller's generic 500 — pinned here so a future change to that mapping
    // is a visible decision rather than a silent one.
    expect(attempted.status).toBe(500);

    // Nothing moved: the horse still carries the FIRST rider and the first
    // assignment is still the active one. A non-transactional controller would
    // have left an inactive first assignment and no replacement.
    expect(await activeRiderId(horse.id)).toBe(sellerRider.id);
    expect((await assignmentRow(assignmentId)).isActive).toBe(true);
    expect(
      await prisma.riderAssignment.count({
        where: { horseId: horse.id, riderId: sellerRiderTwo.id },
      }),
    ).toBe(0);
  }, 60000);
});
