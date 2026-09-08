/**
 * Rider re-assignment history and the ACTIVE-only unique invariant
 * (Equoria-kccmt, closing the owner decision Equoria-6p398.10).
 *
 * THE DEFECT THIS GUARDS
 * `rider_assignments` carried `@@unique([riderId, horseId, isActive])`. Because
 * `isActive` was part of the key, the constraint enforced two rules at once:
 * at most one ACTIVE row per (rider, horse) pair — wanted — and at most one
 * INACTIVE row per pair — a cap on HISTORY, which is the defect. Deactivating
 * an active row therefore raised P2002 whenever the pair already held an
 * inactive row, which `assignRider`'s unguarded
 * `updateMany({ horseId, isActive: true } -> false)` turned into an HTTP 500 on
 * the perfectly ordinary sequence assign R -> assign R2 -> assign R -> assign R3.
 *
 * The fix is a PARTIAL unique index that covers only active rows
 * (`rider_assignments_active_riderId_horseId_key ... WHERE "isActive"`,
 * migration 20260907120000_kccmt_partial_unique_active_staff_assignments), so
 * historical rows may accumulate freely while the one-active-row rule stands.
 *
 * Both halves are asserted here, because dropping the composite unique without
 * proving the replacement still bites would be a silent loss of a database
 * invariant:
 *   1. the four-step re-assign sequence succeeds through the real endpoints and
 *      EVERY historical row survives; and
 *   2. two concurrent writers still cannot leave two ACTIVE rows on the same
 *      (rider, horse) pair — the database, not the controller, refuses it.
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

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-kccmt-rider';

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser() {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-owner-${suffix}`,
      email: `${FIXTURE_PREFIX}-owner-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Kccmt',
      lastName: 'RiderOwner',
      money: 0,
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

describe('rider re-assignment history (Equoria-kccmt)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let horse;
  let riderA;
  let riderB;
  let riderC;

  beforeEach(async () => {
    owner = await makeUser();
    horse = await makeHorse(owner.id);
    riderA = await makeRider(owner.id, 'RiderA');
    riderB = await makeRider(owner.id, 'RiderB');
    riderC = await makeRider(owner.id, 'RiderC');

    const riderIds = [riderA.id, riderB.id, riderC.id];
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { horseId: horse.id } }), 'riderAssignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'rider');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('survives assign A -> B -> A -> C on one horse and keeps every historical row', async () => {
    // Step 3 is what puts a second row on the (riderA, horse) pair; step 4 then
    // deactivates the active one while the inactive one is still there. Under
    // the composite unique that fourth call was a P2002 -> HTTP 500.
    const first = await assignRiderRequest(owner.token, riderA.id, horse.id);
    expect(first.status).toBe(201);
    const firstAssignmentId = first.body.data.id;

    const second = await assignRiderRequest(owner.token, riderB.id, horse.id);
    expect(second.status).toBe(201);

    const third = await assignRiderRequest(owner.token, riderA.id, horse.id);
    expect(third.status).toBe(201);
    const thirdAssignmentId = third.body.data.id;
    expect(thirdAssignmentId).not.toBe(firstAssignmentId);

    const fourth = await assignRiderRequest(owner.token, riderC.id, horse.id);
    expect(fourth.status).toBe(201);

    // Persisted state, not the status codes alone.
    const rows = await prisma.riderAssignment.findMany({
      where: { horseId: horse.id },
      select: { id: true, riderId: true, isActive: true },
      orderBy: { id: 'asc' },
    });

    // Four assignments happened; four rows exist. Nothing was destroyed to make
    // room for the fourth.
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.id)).toEqual(expect.arrayContaining([firstAssignmentId, thirdAssignmentId]));

    // Both (riderA, horse) rows survive, and both are inactive history.
    const riderARows = rows.filter(r => r.riderId === riderA.id);
    expect(riderARows).toHaveLength(2);
    expect(riderARows.every(r => r.isActive === false)).toBe(true);

    // Exactly one active row on the horse, and it is riderC's.
    const active = rows.filter(r => r.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].riderId).toBe(riderC.id);

    const persistedHorse = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { rider: true },
    });
    expect(persistedHorse.rider.id).toBe(riderC.id);
  }, 60000);

  it('still refuses two ACTIVE rows for the same rider and horse under concurrent writers', async () => {
    // The partial index is the only thing standing between two racing writers
    // and a duplicate active assignment: neither transaction can see the
    // other's uncommitted insert, so the application-level "already assigned"
    // read cannot catch this. Both transactions insert the identical active
    // pair; the database must reject exactly one.
    const insertActive = () =>
      prisma.$transaction(tx =>
        tx.riderAssignment.create({
          data: { riderId: riderA.id, horseId: horse.id, userId: owner.id, isActive: true },
        }),
      );

    const results = await Promise.allSettled([insertActive(), insertActive()]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('P2002');

    expect(
      await prisma.riderAssignment.count({
        where: { riderId: riderA.id, horseId: horse.id, isActive: true },
      }),
    ).toBe(1);
  }, 60000);

  it('permits many INACTIVE rows for the same rider and horse', async () => {
    // The half of the old constraint that is deliberately gone. Three historical
    // rows for one pair is exactly what an assign/unassign/re-assign player
    // produces, and it must simply be storable.
    for (let i = 0; i < 3; i += 1) {
      await prisma.riderAssignment.create({
        data: { riderId: riderA.id, horseId: horse.id, userId: owner.id, isActive: false },
      });
    }

    expect(
      await prisma.riderAssignment.count({
        where: { riderId: riderA.id, horseId: horse.id, isActive: false },
      }),
    ).toBe(3);
  }, 60000);
});
