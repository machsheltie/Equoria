/**
 * Sentinel-positive integration test for CWE-915/CWE-269 mass-assignment /
 * self-privilege-escalation on PUT /api/v1/users/:id (Equoria-qia4j).
 *
 * FAILING TEST FIRST (EDGE_CASE_FIX_DISCIPLINE §1):
 *   - These tests MUST FAIL against the un-patched controller.
 *   - After the allowlist fix is applied they MUST PASS.
 *
 * No bypass headers. Real auth token. Real CSRF. Real DB writes + re-reads.
 * Co-located in backend/modules/users/__tests__/ per module-test convention.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

/** Unique hex suffix so parallel test runs never collide on username/email. */
const uid = () => randomBytes(4).toString('hex');

let user;
let token;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  const suffix = `${uid()}${uid()}`;
  user = await prisma.user.create({
    data: {
      email: `testfixture-massassign-${suffix}@test.com`,
      username: `TestFixture-massassign-${suffix}`,
      password: '$2b$12$originalHashThatShouldNeverChange.XXXXXXXXXXXXXXXXXXXXX',
      firstName: 'Legit',
      lastName: 'User',
      money: 500,
      role: 'user',
      settings: {},
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  // Scoped, fail-loud cleanup (Equoria-cu3t5) — only the row this suite
  // created; replaces a swallowed cleanup catch. FK order (Equoria-myfc5):
  // delete any horses owned by this fixture user BEFORE the user row, because
  // Horse.userId is onDelete:Restrict (schema:282) — a user delete would P2003
  // if a horse referenced it.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30_000);

afterAll(() => cleanup.run(), 30_000);

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Send PUT /api/v1/users/:id with full auth (JWT + CSRF) and return the
 * response plus a fresh DB read of the user row.
 *
 * Equoria-myfc5 / plw0h: per-user CSRF binding. The CSRF token must be issued
 * under the SAME sessionIdentifier the mutation resolves to. The PUT
 * authenticates via the Bearer header → req.user.id; so the token must also be
 * issued bound to user.id. We forward the access token as a cookie on the
 * GET /csrf-token call (fetchCsrf shims req.user from it), and the returned
 * cookieHeader carries both that access cookie and the csrf cookie onto the PUT.
 */
async function doPut(body) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  const res = await request(app)
    .put(`/api/v1/users/${user.id}`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);

  // Re-read the DB row so tests can assert on persisted state.
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  return { res, fresh };
}

// ─── Sentinel-positive: PROTECTED fields MUST be immutable via this endpoint ─

describe('PUT /api/v1/users/:id — mass-assignment protection (Equoria-qia4j)', () => {
  it('MUST NOT allow a user to self-escalate role to admin', async () => {
    const { res, fresh } = await doPut({ role: 'admin' });

    // HTTP response should succeed (the request itself is valid-shaped).
    // The key assertion is on the DB row — the role must not have changed.
    expect(res.status).not.toBe(500);
    expect(fresh.role).toBe('user'); // PROTECTED — must remain unchanged
  });

  it('MUST NOT allow a user to set their own money arbitrarily', async () => {
    const { res, fresh } = await doPut({ money: 999_999_999 });

    expect(res.status).not.toBe(500);
    expect(fresh.money).toBe(user.money); // PROTECTED — must remain at original 500
  });

  it('MUST NOT allow a user to overwrite their own password hash', async () => {
    const knownHash = '$2b$12$attackerKnownHashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const { res, fresh } = await doPut({ password: knownHash });

    expect(res.status).not.toBe(500);
    expect(fresh.password).toBe(user.password); // PROTECTED — original hash must stand
  });

  it('MUST NOT allow a user to disable their own MFA flag', async () => {
    // Temporarily enable MFA on the row so we have a non-default value to assert on.
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });

    const { res, fresh } = await doPut({ mfaEnabled: false });

    expect(res.status).not.toBe(500);
    expect(fresh.mfaEnabled).toBe(true); // PROTECTED — must remain enabled

    // Restore
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false } });
  });

  it('MUST NOT allow a user to set level arbitrarily', async () => {
    const { res, fresh } = await doPut({ level: 999 });

    expect(res.status).not.toBe(500);
    expect(fresh.level).toBe(user.level); // PROTECTED
  });

  it('MUST NOT allow a user to set xp arbitrarily', async () => {
    const { res, fresh } = await doPut({ xp: 999_999 });

    expect(res.status).not.toBe(500);
    expect(fresh.xp).toBe(user.xp); // PROTECTED
  });

  // ─── Positive-path: ALLOWLISTED fields MUST be updatable ──────────────────

  it('MUST allow updating firstName (allowlisted)', async () => {
    const { res, fresh } = await doPut({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(fresh.firstName).toBe('Updated'); // ALLOWLISTED — must have changed
  });

  it('MUST allow updating lastName (allowlisted)', async () => {
    const { res, fresh } = await doPut({ lastName: 'LegitSurname' });

    expect(res.status).toBe(200);
    expect(fresh.lastName).toBe('LegitSurname'); // ALLOWLISTED
  });

  it('MUST allow updating settings with known-key contents (allowlisted)', async () => {
    // Equoria-bddjw: `settings` is allow-listed AND its CONTENTS are now
    // shape-validated against the same known-key surface as /auth/profile.
    // `theme` (the old free-form value) is no longer accepted; use a valid
    // notifications/display shape instead.
    const newSettings = { display: { highContrast: true } };
    const { res, fresh } = await doPut({ settings: newSettings });

    expect(res.status).toBe(200);
    // Validated subset is merged into the stored settings JSON.
    expect(fresh.settings).toMatchObject(newSettings); // ALLOWLISTED + shape-valid
  });

  // ─── Email-change resets verification flags ────────────────────────────────

  it('MUST reset emailVerified to false when email is changed', async () => {
    // Mark the user as verified first.
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    const newEmail = `testfixture-newemail-${uid()}${uid()}@test.com`;
    const { res, fresh } = await doPut({ email: newEmail });

    expect(res.status).toBe(200);
    expect(fresh.email).toBe(newEmail);
    expect(fresh.emailVerified).toBe(false); // MUST be reset on email change
    expect(fresh.emailVerifiedAt).toBeNull(); // MUST be cleared

    // Revert email so subsequent tests use the original user row cleanly
    await prisma.user.update({ where: { id: user.id }, data: { email: user.email } });
  });

  it('MUST NOT reset emailVerified when email is unchanged', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });

    // Send a non-email field; email should be untouched
    const { res, fresh } = await doPut({ firstName: 'NoEmailChange' });

    expect(res.status).toBe(200);
    expect(fresh.emailVerified).toBe(true); // MUST remain true — email unchanged
  });
});
