/**
 * Equoria-gfany — players cannot delete their accounts.
 *
 * OWNER RULING 2026-09-22: "Players cannot delete their accounts." Scope ruled
 * 2026-09-24: remove the Settings control AND both player-reachable routes;
 * keep `eraseUserAccount()` for erasure an operator runs by hand.
 *
 * The behaviour this replaces: two independent routes erased the caller's
 * whole account through `eraseUserAccount()` —
 *   - `DELETE /api/v1/users/:id` (the route the Settings "Delete Account"
 *     button called, gated only by typing your own username), and
 *   - `POST /api/v1/account/delete` (password-confirmed, no UI).
 * Both returned 200 and the user row, horses, staff, clubs and messages were
 * gone. The route-level tests that specified that (legacyUserDelete, the
 * DELETE blocks in userController/userRoutes, the password cases in
 * gdprAccountRoutes) were retired with the ruling; the erasure cascade itself
 * is still covered by the service-level tests.
 *
 * The invariant this file locks: neither route removes the caller's account,
 * for any id, password or payload, and each answers one byte-identical 403
 * "cannot be deleted" body, so neither is an existence or ownership oracle.
 * Every refusal case asserts PERSISTED state (the user row survives and the
 * same credentials still log in), not just a status code — under the old
 * routes the self-delete cases returned 200 and the login afterwards 401.
 *
 * Real database, real HTTP, real per-user CSRF. No mocks.
 *
 * @module modules/users/__tests__/accountDeletionClosed.integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'TestPassword123!';

/** CSRF bound to the acting identity (per-user binding, Equoria-plw0h). */
const fetchCsrfFor = token => fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

async function makeUser(label) {
  const ts = randomBytes(6).toString('hex');
  // Lowercase email: login's normalizeEmail() lowercases before lookup, so a
  // mixed-case address would 401 for a live account and fake a "deleted".
  const { user, token } = await createTestUser({
    username: `TestFixture_gfany_${label}_${ts}`,
    email: `testfixture_gfany_${label}_${ts}@test.com`,
    password: PASSWORD,
  });
  return { id: user.id, email: user.email, token };
}

async function deleteUserRoute(actor, targetId) {
  const csrf = await fetchCsrfFor(actor.token);
  return request(app)
    .delete(`/api/v1/users/${targetId}`)
    .set('Authorization', `Bearer ${actor.token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}

async function accountDeleteRoute(actor, body) {
  const csrf = await fetchCsrfFor(actor.token);
  return request(app)
    .post('/api/v1/account/delete')
    .set('Authorization', `Bearer ${actor.token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

/**
 * A 403 alone is ambiguous — `csrfProtection` also answers 403 on these
 * routers. Assert the refusal's own wording so only the Equoria-gfany guard
 * satisfies it; the CSRF case below proves this matcher can fail.
 *
 * COPY EDITORS: "cannot be deleted" in `refuseAccountDeletion`'s message is
 * LOAD-BEARING. Reword it and this matcher in the same commit, and keep the
 * message free of existence/ownership wording.
 */
function expectDeletionClosed(res) {
  expect(res.body?.code).not.toBe('INVALID_CSRF_TOKEN');
  expect(res.status).toBe(403);
  expect(res.body.success).toBe(false);
  expect(res.body.message).toMatch(/cannot be deleted/i);
  expect(res.body.message).not.toMatch(/not found/i);
  expect(res.body.message).not.toMatch(/incorrect/i);
  expect(res.body.message).not.toMatch(/your own/i);
}

/** The account is intact: the row exists and the same credentials log in. */
async function expectAccountIntact(subject) {
  expect(await prisma.user.findUnique({ where: { id: subject.id } })).not.toBeNull();
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email: subject.email, password: PASSWORD });
  expect(login.status).toBe(200);
}

describe('Equoria-gfany — player-reachable account deletion is closed', () => {
  const cleanup = createCleanupTracker();
  let subject;
  let stranger;

  beforeEach(async () => {
    subject = await makeUser('subject');
    stranger = await makeUser('stranger');
    const userIds = [subject.id, stranger.id];
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'fixture users');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  it('DELETE /api/v1/users/:id refuses the caller deleting themselves, and the account survives', async () => {
    const res = await deleteUserRoute(subject, subject.id);

    expectDeletionClosed(res);
    await expectAccountIntact(subject);
  }, 60000);

  it('POST /api/v1/account/delete refuses even with the correct password, and the account survives', async () => {
    const res = await accountDeleteRoute(subject, { password: PASSWORD });

    expectDeletionClosed(res);
    await expectAccountIntact(subject);
  }, 60000);

  it('answers identically for every id, password and payload (no oracle)', async () => {
    const missingId = randomUUID();
    expect(await prisma.user.findUnique({ where: { id: missingId } })).toBeNull();

    const attempts = [
      ['users: self', () => deleteUserRoute(subject, subject.id)],
      ['users: another player', () => deleteUserRoute(subject, stranger.id)],
      ['users: nonexistent', () => deleteUserRoute(subject, missingId)],
      ['users: malformed', () => deleteUserRoute(subject, 'not-a-uuid')],
      ['account: correct password', () => accountDeleteRoute(subject, { password: PASSWORD })],
      ['account: wrong password', () => accountDeleteRoute(subject, { password: 'WrongPassword999!' })],
      ['account: no password', () => accountDeleteRoute(subject, {})],
    ];

    const bodies = [];
    for (const [label, attempt] of attempts) {
      const res = await attempt();
      expect({ label, status: res.status }).toEqual({ label, status: 403 });
      expectDeletionClosed(res);
      bodies.push(JSON.stringify(res.body));
    }

    // Under the old routes these were 200 / 403 / 403 / 400 / 200 / 401 / 400.
    expect(new Set(bodies).size).toBe(1);

    await expectAccountIntact(subject);
    expect(await prisma.user.findUnique({ where: { id: stranger.id } })).not.toBeNull();
  }, 120000);

  it('still answers 401 (not 403) on both routes when no token is supplied', async () => {
    const csrf = await fetchCsrf(app);
    const viaUsers = await request(app)
      .delete(`/api/v1/users/${subject.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);
    const viaAccount = await request(app)
      .post('/api/v1/account/delete')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ password: PASSWORD });

    expect(viaUsers.status).toBe(401);
    expect(viaAccount.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { id: subject.id } })).not.toBeNull();
  }, 30000);

  it('a CSRF-rejected request produces a DIFFERENT 403 than the refusal (assertion is not vacuous)', async () => {
    const res = await request(app)
      .post('/api/v1/account/delete')
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('X-CSRF-Token', 'not-a-real-csrf-token')
      .send({ password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message ?? '').not.toMatch(/cannot be deleted/i);
    expect(() => expectDeletionClosed(res)).toThrow();
    expect(await prisma.user.findUnique({ where: { id: subject.id } })).not.toBeNull();
  }, 30000);

  it('leaves the neighbouring GET /api/v1/account/export working', async () => {
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.id).toBe(subject.id);
  }, 30000);
});
