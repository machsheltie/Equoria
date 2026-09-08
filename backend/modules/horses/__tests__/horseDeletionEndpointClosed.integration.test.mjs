/**
 * Task 18 / Equoria-9tque — players may not delete horses.
 *
 * The owner's ruling (2026-09-08): "players are not allowed to delete horses."
 *
 * The defect: `DELETE /api/v1/horses/:id` was mounted on the authenticated
 * router behind nothing but `mutationRateLimiter`, `validateHorseId` and
 * `requireOwnership('horse')`, then called `deleteHorseById`, which issued a
 * bare `prisma.horse.delete({ where: { id } })`. Ownership answers "is this my
 * horse"; it never answered "may this horse be destroyed". So any owner could
 * irreversibly erase a horse — and, through the schema's `onDelete: Cascade`
 * horse children, its rider assignment, groom assignments, XP events, training
 * logs and competition history with it — with no confirmation ceremony, no
 * economic consequence and no recovery. Same shape as audit Finding 2 (free
 * creation) and Finding 3 (self-awarded XP): ownership mistaken for authority.
 *
 * The invariant this file locks — scoped precisely to what it exercises:
 *   `DELETE /api/v1/horses/:id` removes no horse row for any caller, and the
 *   server-owned GDPR erasure path still does. This file does NOT prove the
 *   broader claim that no player-facing HTTP entry point anywhere removes a
 *   horse row; it drives one route. That broader guarantee would need a
 *   route-table sentinel walking the mounted Express stack for horse-scoped
 *   DELETE handlers — it belongs beside
 *   `modules/horses/__tests__/horseRoutesMounting.sentinel.test.mjs`, which
 *   already enumerates this router's mounted routes, and it is not written.
 *   At the time of this change the caller trace found no other such route:
 *   the only other horse DELETE is `/:id/stud-listing`, which delists rather
 *   than destroys, and the only production code that deletes horse rows is
 *   `modules/users` `eraseUserAccount` (which clears the `Restrict`
 *   lineage/sale FKs first) plus `scripts/purge-leaked-test-fixtures.mjs`.
 *
 * What the guard is: `DELETE /api/v1/horses/:id` answers 403 for every
 * authenticated caller. The refusal sits BEHIND the authRouter's
 * `authenticateToken` (so an anonymous call is still 401) and BEFORE
 * `validateHorseId` / `requireOwnership`, so it is payload- and id-independent:
 * a horse you own, a horse another player owns, an id that does not exist and a
 * non-numeric id all produce byte-identical responses. The route therefore
 * cannot be used as an existence or ownership oracle.
 *
 * Why these assertions detect the old defect: every rejection case asserts
 * PERSISTED state, not just a status code — the horse row is still present with
 * its `tack` JSON unchanged, its `RiderAssignment` and `GroomAssignment` rows
 * still present and still active. Under the pre-fix route the owner's request
 * returned 200 with `{ success: true, message: 'Horse deleted successfully' }`
 * and the horse plus both cascade-deleted assignment rows were gone; those
 * exact assertions fail loudly on the old code (verified RED before the fix).
 *
 * Retained legitimate behaviour proven here:
 *   - GDPR right-to-erasure still deletes the erased account's horse rows;
 *   - the neighbouring owner mutation `PUT /api/v1/horses/:id` still works, so
 *     the refusal is scoped to deletion and is not collateral damage.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures are uniquely named
 * and cleaned up by id in FK order (assignments/staff before horses, horses
 * before users — `Horse.userId` is `onDelete: Restrict`).
 *
 * @module modules/horses/__tests__/horseDeletionEndpointClosed.integration
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
// Cross-module import goes through the users barrel (CONTRIBUTING.md § "Module
// public API boundaries"), not the service's internal path.
import { eraseUserAccount } from '../../users/index.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-9tque';

const tag = () => randomBytes(6).toString('hex');

/** The tack JSON we assert is still byte-identical after the refusal. */
const TACK = { saddle: 'Close Contact', bridle: 'Snaffle', decoration: 'Rose Browband' };

async function makeUser(label) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Task18',
      lastName: label,
      money: 1000,
      settings: {},
    },
  });
  return {
    id: user.id,
    email: user.email,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, label, extra = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
      tack: TACK,
      ...extra,
    },
  });
}

async function makeRider(ownerId) {
  return prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Task18-${tag()}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Jumping',
      weeklyRate: 200,
      level: 3,
      userId: ownerId,
    },
  });
}

async function makeGroom(ownerId) {
  return prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-groom-${tag()}`,
      speciality: 'foalCare',
      personality: 'gentle',
      skillLevel: 'intermediate',
      userId: ownerId,
    },
  });
}

function deleteHorseRequest(token, horseId) {
  return fetchCsrf(app).then(csrf =>
    request(app)
      .delete(`/api/v1/horses/${horseId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken),
  );
}

/**
 * A 403 alone is ambiguous — `csrfProtection` also answers 403 when the
 * token/cookie pair fails to bind, which would let this suite pass green while
 * the delete route was still wide open. Assert the ROUTE's own refusal message
 * so only the Equoria-9tque guard satisfies it. The negative case
 * ("a CSRF-rejected request produces a DIFFERENT 403") proves this matcher can
 * actually fail.
 *
 * COPY EDITORS: the phrase "cannot be deleted" in the route's player-facing
 * message (horseRoutes.mjs `router.delete('/:id', ...)`) is LOAD-BEARING for
 * this security regression. It is the only thing that distinguishes the route's
 * refusal from `csrfProtection`'s 403 on the same router, so a reword that drops
 * it turns these assertions vacuous while they stay green. Reword freely, but
 * update this matcher in the same commit — and keep the message free of
 * existence/ownership wording ("not found", "forbidden"), which the assertions
 * below also enforce.
 */
function expectDeletionClosed(res) {
  expect(res.status).toBe(403);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/cannot be deleted/i);
  // No existence/ownership detail may leak.
  expect(res.body.message).not.toMatch(/not found/i);
  expect(res.body.message).not.toMatch(/forbidden/i);
}

describe('Equoria-9tque — DELETE /api/v1/horses/:id is closed to players', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let stranger;
  let horse;
  let strangerHorse;
  let rider;
  let groom;
  let riderAssignmentId;
  let groomAssignmentId;

  beforeEach(async () => {
    owner = await makeUser('owner');
    stranger = await makeUser('stranger');
    horse = await makeHorse(owner.id, 'horse');
    strangerHorse = await makeHorse(stranger.id, 'strangerhorse');
    rider = await makeRider(owner.id);
    groom = await makeGroom(owner.id);

    // Both assignment tables are `onDelete: Cascade` on the horse, so the
    // pre-fix delete silently destroyed them alongside the horse.
    const riderAssignment = await prisma.riderAssignment.create({
      data: { riderId: rider.id, horseId: horse.id, userId: owner.id, isActive: true },
    });
    riderAssignmentId = riderAssignment.id;
    const groomAssignment = await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: owner.id, isActive: true },
    });
    groomAssignmentId = groomAssignment.id;

    const ids = {
      riderAssignmentId,
      groomAssignmentId,
      riderId: rider.id,
      groomId: groom.id,
      horseIds: [horse.id, strangerHorse.id],
      userIds: [owner.id, stranger.id],
    };
    cleanup.add(() => prisma.riderAssignment.deleteMany({ where: { id: ids.riderAssignmentId } }), 'rider assignment');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: ids.groomAssignmentId } }), 'groom assignment');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: ids.riderId } }), 'rider');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: ids.groomId } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horseIds } } }), 'fixture horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }), 'fixture users');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it("refuses the owner's own delete and changes no persisted state", async () => {
    const res = await deleteHorseRequest(owner.token, horse.id);

    expectDeletionClosed(res);

    // The horse row survives, with its tack JSON untouched.
    const persisted = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { id: true, userId: true, name: true, tack: true },
    });
    expect(persisted).not.toBeNull();
    expect(persisted.userId).toBe(owner.id);
    expect(persisted.name).toBe(horse.name);
    expect(persisted.tack).toEqual(TACK);

    // Its cascade-deletable children survive too, still active.
    const riderRow = await prisma.riderAssignment.findUnique({
      where: { id: riderAssignmentId },
      select: { id: true, horseId: true, isActive: true },
    });
    expect(riderRow).toEqual({ id: riderAssignmentId, horseId: horse.id, isActive: true });

    const groomRow = await prisma.groomAssignment.findUnique({
      where: { id: groomAssignmentId },
      select: { id: true, foalId: true, isActive: true },
    });
    expect(groomRow).toEqual({ id: groomAssignmentId, foalId: horse.id, isActive: true });
  }, 60000);

  it("answers identically for an owned horse, a stranger's horse, a missing id and a bad id (no oracle)", async () => {
    const missingId = 2147483000 + Math.floor(Math.random() * 600);
    expect(await prisma.horse.findUnique({ where: { id: missingId } })).toBeNull();

    const targets = [
      ['owned', String(horse.id)],
      ['cross-owner', String(strangerHorse.id)],
      ['nonexistent', String(missingId)],
      ['non-numeric', 'not-an-id'],
    ];

    const bodies = [];
    for (const [label, target] of targets) {
      const res = await deleteHorseRequest(owner.token, target);
      expect({ label, status: res.status }).toEqual({ label, status: 403 });
      expectDeletionClosed(res);
      bodies.push(JSON.stringify(res.body));
    }

    // Byte-identical responses: the route reveals nothing about whether the id
    // exists, is well-formed, or belongs to the caller. Under the pre-fix route
    // these were 200 / 404 / 404 / 400 respectively.
    expect(new Set(bodies).size).toBe(1);

    // Neither horse was touched.
    expect(await prisma.horse.count({ where: { id: { in: [horse.id, strangerHorse.id] } } })).toBe(2);
  }, 90000);

  it('still answers 401 (not 403) when no token is supplied', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/v1/horses/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(await prisma.horse.findUnique({ where: { id: horse.id } })).not.toBeNull();
  }, 30000);

  it('a CSRF-rejected request produces a DIFFERENT 403 than the route guard (assertion is not vacuous)', async () => {
    const res = await request(app)
      .delete(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', 'not-a-real-csrf-token');

    expect(res.status).toBe(403);
    expect(res.body.message ?? '').not.toMatch(/cannot be deleted/i);
    expect(() => expectDeletionClosed(res)).toThrow();
    expect(await prisma.horse.findUnique({ where: { id: horse.id } })).not.toBeNull();
  }, 30000);

  it('leaves the neighbouring owner mutation PUT /:id working', async () => {
    const newName = `${FIXTURE_PREFIX}-renamed-${tag()}`;
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: newName });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const persisted = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { name: true },
    });
    expect(persisted.name).toBe(newName);
  }, 60000);
});

describe('Equoria-9tque — the legitimate server-owned deletion path still removes horses', () => {
  const cleanup = createCleanupTracker();

  afterEach(() => cleanup.run(), 30000);

  it("GDPR right-to-erasure still deletes the erased account's horse rows", async () => {
    const doomed = await makeUser('gdpr');
    const doomedHorse = await makeHorse(doomed.id, 'gdprhorse');

    // Fail-loud safety net only: eraseUserAccount is expected to remove both
    // rows, so these cleanups should find nothing.
    const ids = { horseId: doomedHorse.id, userId: doomed.id };
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { id: ids.horseId } }),
      'gdpr fixture horse (should already be gone)',
    );
    cleanup.add(
      () => prisma.user.deleteMany({ where: { id: ids.userId } }),
      'gdpr fixture user (should already be gone)',
    );

    const result = await eraseUserAccount(doomed.id);
    expect(result).toEqual({ deleted: true });

    expect(await prisma.horse.findUnique({ where: { id: doomedHorse.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: doomed.id } })).toBeNull();
  }, 90000);
});
