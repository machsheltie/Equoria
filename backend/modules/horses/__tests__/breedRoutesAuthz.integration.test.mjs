/**
 * 🔒 Breed routes authorization — real-DB integration (Equoria-7p4xe, OWASP A01)
 *
 * SECURITY DEFECT (Equoria-7p4xe): `app.mjs` mounts breed routes publicly at
 * `/api/v1/breeds` for onboarding READS, but the same router also contained
 * `POST / createBreed` — exposing breed CREATION with NO auth and NO CSRF. An
 * anonymous client could write rows to the `breed` table.
 *
 * FIX: the public `/api/v1/breeds` mount serves a GET-only router
 * (`breedPublicRoutes.mjs`); the write router (`breedRoutes.mjs`) rides the
 * authenticated router and gates `POST /` behind `requireRole('admin')` + CSRF.
 *
 * CONTRACT proven here (all four AC clauses + the public-mount regression):
 *   1. Anonymous   POST /api/v1/breeds  → fails (401, NOT 201). [sentinel]
 *   2. Auth'd NON-admin POST            → fails (403, NOT 201). [sentinel]
 *   3. Admin POST (valid CSRF)          → succeeds (201, real row persisted).
 *   4. Public GET  /api/v1/breeds       → 200 (onboarding still works).
 *   4b.Public GET  /api/v1/breeds/:id   → 200 (read still works).
 *
 * No mocks. Real Express app, real DB, real JWT, real CSRF flow. Fixtures use
 * the `TestFixture-` prefix and id-scoped cleanup per CLAUDE.md §2 — never a
 * bare deleteMany().
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

// Build a real access-token COOKIE for a given user. authenticateToken reads
// req.cookies.accessToken; binding CSRF via the same cookie (fetchCsrf
// extraCookies) keeps the issued token's sessionIdentifier == req.user.id, so
// the admin mutation passes CSRF for the right user (Equoria-plw0h binding).
function accessCookieFor(user) {
  const token = jwt.sign(
    { id: user.id, userId: user.id, email: user.email, role: user.role, fingerprint: Date.now() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' },
  );
  return `accessToken=${token}`;
}

let adminUser;
let normalUser;
const createdBreedIds = [];

beforeAll(async () => {
  const pw = await bcrypt.hash('BreedAuthz123!', 1);
  adminUser = await prisma.user.create({
    data: {
      username: `TestFixture-7p4xe-admin-${UNIQUE}`,
      email: `testfixture-7p4xe-admin-${UNIQUE}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'Admin',
      role: 'admin',
      dateOfBirth: new Date('1990-01-01'),
    },
  });
  normalUser = await prisma.user.create({
    data: {
      username: `TestFixture-7p4xe-user-${UNIQUE}`,
      email: `testfixture-7p4xe-user-${UNIQUE}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'User',
      role: 'user',
      dateOfBirth: new Date('1990-01-01'),
    },
  });
}, 120000);

afterAll(async () => {
  if (createdBreedIds.length > 0) {
    await prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } });
  }
  // Defensive scoped sweep in case a write slipped through without capture.
  await prisma.breed.deleteMany({
    where: { name: { startsWith: `TestFixture-breed-7p4xe-${UNIQUE}` } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [adminUser?.id, normalUser?.id].filter(Boolean) } },
  });
}, 120000);

describe('Breed routes authorization (Equoria-7p4xe)', () => {
  it('SENTINEL: anonymous POST /api/v1/breeds is REJECTED (401), no row created', async () => {
    const name = `TestFixture-breed-7p4xe-${UNIQUE}-anon`;
    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', ORIGIN)
      .send({ name, description: 'anon write attempt' });

    // The defect was anonymous create returning 201. It MUST now fail auth.
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(201);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(0);
  });

  it('SENTINEL: authenticated NON-admin POST is REJECTED (403), no row created', async () => {
    const name = `TestFixture-breed-7p4xe-${UNIQUE}-nonadmin`;
    const cookie = accessCookieFor(normalUser);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'non-admin write attempt' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(201);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(0);
  });

  it('admin POST with valid CSRF SUCCEEDS (201) and persists exactly one row', async () => {
    const name = `TestFixture-breed-7p4xe-${UNIQUE}-admin`;
    const cookie = accessCookieFor(adminUser);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookie });

    const res = await request(app)
      .post('/api/v1/breeds')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name, description: 'admin write' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name });
    createdBreedIds.push(res.body.data.id);

    const rows = await prisma.breed.findMany({ where: { name } });
    expect(rows).toHaveLength(1);
  });

  it('REGRESSION: public GET /api/v1/breeds still works for onboarding (200)', async () => {
    const res = await request(app).get('/api/v1/breeds').set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('REGRESSION: public GET /api/v1/breeds/:id still works (200) for a known breed', async () => {
    // Use the admin-created breed id so we read a row we know exists.
    expect(createdBreedIds.length).toBeGreaterThan(0);
    const id = createdBreedIds[0];
    const res = await request(app).get(`/api/v1/breeds/${id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id });
  });
});
