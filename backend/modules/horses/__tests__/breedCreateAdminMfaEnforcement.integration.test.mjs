/**
 * 🔒 Admin-MFA enforcement on POST /api/v1/breeds — real-DB integration
 *     (Equoria-e4a2y, OWASP A07).
 *
 * WHY THIS SUITE EXISTS
 *   Breed creation is an administrative write gated `requireRole('admin')`
 *   (Equoria-7p4xe). The `/breeds` write router rides the authRouter
 *   (backend/app/routers.mjs), NOT the adminRouter, so the global
 *   `requireAdminMfa` mounted on the adminRouter (Equoria-te21j) does NOT cover
 *   it. Equoria-e4a2y adds `requireAdminMfa` directly on the route (after
 *   `requireRole('admin')`) so the optional ADMIN_MFA_REQUIRED policy gates this
 *   admin write too — mirroring the Equoria-l432a fix on /shows/execute.
 *
 * CONTRACT PROVEN (no mocks — real Express app, real DB, real JWT + CSRF):
 *   - Flag ON  + admin WITHOUT mfaEnabled -> 403 "admin MFA required" + NO breed
 *                                            row created (the fix; without it
 *                                            this returns 201 and writes a row).
 *   - Flag OFF + admin WITHOUT mfaEnabled -> 201 normal create (existing admins
 *                                            not locked out — no behavior change).
 *   - Flag ON  + admin WITH mfaEnabled    -> 201 (passes the gate).
 *   - Flag ON  + non-admin                -> 403 "Insufficient permissions"
 *                                            (requireRole short-circuits first;
 *                                            the MFA gate never runs / crashes,
 *                                            and the message is NOT the MFA one).
 *
 * Fixtures use the `TestFixture-` prefix and id-scoped cleanup per CLAUDE.md §2 —
 * never a bare deleteMany(). The env flag is toggled per-test and restored in
 * afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const UNIQUE = randomBytes(6).toString('hex');
const FLAG = 'ADMIN_MFA_REQUIRED';
const ROUTE = '/api/v1/breeds';

// Build a real access-token COOKIE for a given user. authenticateToken reads
// req.cookies.accessToken; binding CSRF via the same cookie keeps the issued
// token's sessionIdentifier == req.user.id so the mutation passes CSRF.
function accessCookieFor(user) {
  const token = jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role, fingerprint: Date.now() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' },
  );
  return `accessToken=${token}`;
}

let adminNoMfa;
let adminWithMfa;
let normalUser;
const createdBreedIds = [];
const originalFlag = process.env[FLAG];

beforeAll(async () => {
  const pw = await bcrypt.hash('BreedMfa123!', 1);
  adminNoMfa = await prisma.user.create({
    data: {
      username: `TestFixture-e4a2y-admin-nomfa-${UNIQUE}`,
      email: `testfixture-e4a2y-admin-nomfa-${UNIQUE}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'AdminNoMfa',
      role: 'admin',
      mfaEnabled: false,
      dateOfBirth: new Date('1990-01-01'),
    },
  });
  adminWithMfa = await prisma.user.create({
    data: {
      username: `TestFixture-e4a2y-admin-mfa-${UNIQUE}`,
      email: `testfixture-e4a2y-admin-mfa-${UNIQUE}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'AdminMfa',
      role: 'admin',
      mfaEnabled: true,
      dateOfBirth: new Date('1990-01-01'),
    },
  });
  normalUser = await prisma.user.create({
    data: {
      username: `TestFixture-e4a2y-user-${UNIQUE}`,
      email: `testfixture-e4a2y-user-${UNIQUE}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'User',
      role: 'user',
      mfaEnabled: false,
      dateOfBirth: new Date('1990-01-01'),
    },
  });
}, 120000);

afterAll(async () => {
  if (originalFlag === undefined) {
    delete process.env[FLAG];
  } else {
    process.env[FLAG] = originalFlag;
  }
  if (createdBreedIds.length > 0) {
    await prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } });
  }
  // Defensive scoped sweep in case a write slipped through without capture.
  await prisma.breed.deleteMany({
    where: { name: { startsWith: `TestFixture-breed-e4a2y-${UNIQUE}` } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [adminNoMfa?.id, adminWithMfa?.id, normalUser?.id].filter(Boolean) } },
  });
}, 120000);

describe('Admin-MFA enforcement on POST /api/v1/breeds (Equoria-e4a2y)', () => {
  it('flag ON: admin WITHOUT mfaEnabled is blocked (403 MFA required), no breed row created', async () => {
    process.env[FLAG] = 'true';
    const name = `TestFixture-breed-e4a2y-${UNIQUE}-blocked`;
    const cookie = accessCookieFor(adminNoMfa);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post(ROUTE)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'should be blocked by MFA gate' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(201);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/admin.*MFA.*required/i);

    // Sentinel: the gate short-circuited before the controller — NO row written.
    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(0);
  });

  it('flag OFF (default): admin WITHOUT mfaEnabled creates normally (201, unchanged behavior)', async () => {
    delete process.env[FLAG];
    const name = `TestFixture-breed-e4a2y-${UNIQUE}-flagoff`;
    const cookie = accessCookieFor(adminNoMfa);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post(ROUTE)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'flag off — normal create' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name });
    createdBreedIds.push(res.body.data.id);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(1);
  });

  it('flag ON: admin WITH mfaEnabled passes the gate and creates (201)', async () => {
    process.env[FLAG] = 'true';
    const name = `TestFixture-breed-e4a2y-${UNIQUE}-mfaok`;
    const cookie = accessCookieFor(adminWithMfa);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post(ROUTE)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'flag on — admin with MFA' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name });
    createdBreedIds.push(res.body.data.id);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(1);
  });

  it('flag ON: non-admin is rejected by requireRole (403, NOT the MFA message, no crash, no row)', async () => {
    process.env[FLAG] = 'true';
    const name = `TestFixture-breed-e4a2y-${UNIQUE}-nonadmin`;
    const cookie = accessCookieFor(normalUser);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post(ROUTE)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'non-admin write attempt' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(201);
    expect(res.body.success).toBe(false);
    // requireRole('admin') rejects a 'user' BEFORE requireAdminMfa runs, so the
    // message is the role rejection, not the MFA-specific one.
    expect(res.body.message).toBe('Insufficient permissions');
    expect(String(res.body.message)).not.toMatch(/admin.*MFA.*required/i);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(0);
  });
});
