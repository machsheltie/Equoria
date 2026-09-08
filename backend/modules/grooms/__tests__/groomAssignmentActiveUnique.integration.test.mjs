/**
 * Groom assignment ACTIVE-only unique invariant (Equoria-kccmt, closing the
 * owner decision Equoria-6p398.10).
 *
 * `groom_assignments` carried `@@unique([foalId, groomId, isActive])`. Because
 * `isActive` was in the key it capped assignment HISTORY for a pair at one row,
 * which is why the horse-sale reconciliation had to DELETE the superseded
 * inactive row before it could deactivate the active one
 * (`horseTransferReconciliation.endActiveAssignmentsOnHorse`, task-6 fix
 * round 1) — destroying one real assignment row per re-assigned pair on every
 * sale.
 *
 * Migration 20260907120000_kccmt_partial_unique_active_staff_assignments
 * replaces it with `groom_assignments_active_foalId_groomId_key ... WHERE
 * "isActive"`. This suite proves the trade is the intended one, at the database
 * level rather than through a controller: unlimited history, still exactly one
 * active row per (groom, horse) pair even under concurrent writers.
 *
 * Assignments are written directly through Prisma on purpose — the groom-assign
 * endpoint carries eligibility and capacity rules of its own that are not what
 * this suite is about; the invariant under test belongs to the index.
 *
 * Real DB, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FIXTURE_PREFIX = 'TestFixture-kccmt-groom';

function tag() {
  return randomBytes(6).toString('hex');
}

describe('groom assignment active-only unique index (Equoria-kccmt)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let horse;
  let groom;

  beforeEach(async () => {
    const suffix = tag();
    owner = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-owner-${suffix}`,
        email: `${FIXTURE_PREFIX}-owner-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Kccmt',
        lastName: 'GroomOwner',
        money: 0,
      },
    });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${FIXTURE_PREFIX}-horse-${tag()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        userId: owner.id,
        healthStatus: 'Excellent',
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${tag()}`,
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'gentle',
        sessionRate: 20.0,
        userId: owner.id,
      },
    });

    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { foalId: horse.id } }), 'groomAssignment');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('still refuses two ACTIVE rows for the same groom and horse under concurrent writers', async () => {
    const insertActive = () =>
      prisma.$transaction(tx =>
        tx.groomAssignment.create({
          data: { foalId: horse.id, groomId: groom.id, userId: owner.id, isActive: true },
        }),
      );

    const results = await Promise.allSettled([insertActive(), insertActive()]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('P2002');

    expect(
      await prisma.groomAssignment.count({
        where: { foalId: horse.id, groomId: groom.id, isActive: true },
      }),
    ).toBe(1);
  }, 60000);

  it('permits many INACTIVE rows for the same groom and horse beside the active one', async () => {
    // Three ended assignments plus the one currently in force — the exact shape
    // the old composite unique made unstorable, and the reason the sale path had
    // to delete history.
    for (let i = 0; i < 3; i += 1) {
      await prisma.groomAssignment.create({
        data: {
          foalId: horse.id,
          groomId: groom.id,
          userId: owner.id,
          isActive: false,
          endDate: new Date(),
        },
      });
    }
    await prisma.groomAssignment.create({
      data: { foalId: horse.id, groomId: groom.id, userId: owner.id, isActive: true },
    });

    expect(
      await prisma.groomAssignment.count({
        where: { foalId: horse.id, groomId: groom.id, isActive: false },
      }),
    ).toBe(3);
    expect(
      await prisma.groomAssignment.count({
        where: { foalId: horse.id, groomId: groom.id, isActive: true },
      }),
    ).toBe(1);
  }, 60000);
});
