/**
 * horseUpdateParentageSexRole — integration tests (Equoria-91ezs)
 *
 * Sentinel coverage for the missing sex-role validation on PUT /horses/:id:
 *   Equoria-hg62v added ownership validation for body.sireId / body.damId on
 *   PUT, but PUT does not enforce that body.sireId points at a Stallion or
 *   body.damId points at a Mare. POST /horses (~line 904-911) and POST
 *   /horses/:id/foals BOTH enforce these biological-sex roles. PUT was the
 *   lone post-creation mutation that allowed an owner to corrupt their own
 *   horse's genealogy by, e.g., assigning a Mare or Colt as sire.
 *   Downstream breeding/pedigree assumptions depend on sireId.sex === 'Stallion'
 *   and damId.sex === 'Mare'.
 *
 * AC literal:
 *   1) PUT /horses/:id rejects 400 'Sire must be a stallion' when body.sireId
 *      points at non-Stallion.
 *   2) Same for damId / Mare.
 *   3) Integration test covers both reject paths and the success path.
 *   4) Mirror message/status of POST /horses pattern.
 *
 * Real-DB integration. No mocks (CLAUDE.md §3). Scoped cleanup by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

describe('PUT /horses/:id — sex-role validation (Equoria-91ezs)', () => {
  let __csrf__;
  let user;
  let token;
  let horse; // target of PUT
  let stallion;
  let mare;
  let colt;
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    const suffix = randomBytes(6).toString('hex');

    user = await prisma.user.create({
      data: {
        email: `91ezs-${suffix}@test.invalid`,
        username: `91ezs-${suffix}`,
        password: 'hashed',
        firstName: 'SexRole',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);

    token = createMockToken(user.id, {
      payload: { email: user.email, role: user.role || 'user' },
    });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 5);

    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-91ezs-target-${suffix}`,
        userId: user.id,
        sex: 'Mare',
        dateOfBirth: dob,
      },
    });
    stallion = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-91ezs-stallion-${suffix}`,
        userId: user.id,
        sex: 'Stallion',
        dateOfBirth: dob,
      },
    });
    mare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-91ezs-mare-${suffix}`,
        userId: user.id,
        sex: 'Mare',
        dateOfBirth: dob,
      },
    });
    colt = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-91ezs-colt-${suffix}`,
        userId: user.id,
        sex: 'Colt',
        dateOfBirth: dob,
      },
    });
    createdHorseIds.push(horse.id, stallion.id, mare.id, colt.id);

    // Equoria-plw0h: CSRF token is per-user-bound — fetch with the user's
    // accessToken cookie so the issued cookie+token validate when userA
    // sends the mutation under the same identifier.
    __csrf__ = await fetchCsrf(app, {
      extraCookies: [`accessToken=${token}`],
    });
  }, 120000);

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000);

  // ─── sentinel-positive ───────────────────────────────────────────────────
  // These three reject paths are the exact defect class 91ezs describes.
  // Before this fix, the PUT returned 200 and the row's sireId/damId would
  // be silently mutated to point at a sex-incompatible horse.

  it('rejects PUT { sireId: <Mare> } with 400 "Sire must be a stallion"', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: mare.id });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Sire must be a stallion');

    // Genealogy must NOT have been touched.
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { sireId: true, damId: true },
    });
    expect(after.sireId).toBeNull();
  });

  it('rejects PUT { sireId: <Colt> } with 400 "Sire must be a stallion"', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: colt.id });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Sire must be a stallion');
  });

  it('rejects PUT { damId: <Stallion> } with 400 "Dam must be a mare"', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ damId: stallion.id });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Dam must be a mare');

    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { sireId: true, damId: true },
    });
    expect(after.damId).toBeNull();
  });

  it('rejects PUT { damId: <Colt> } with 400 "Dam must be a mare"', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ damId: colt.id });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Dam must be a mare');
  });

  // ─── happy path: success when sexes correct ──────────────────────────────

  it('accepts PUT { sireId: <Stallion>, damId: <Mare> } — 200 and persists', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: stallion.id, damId: mare.id });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { sireId: true, damId: true },
    });
    expect(after.sireId).toBe(stallion.id);
    expect(after.damId).toBe(mare.id);

    // Reset for subsequent assertions
    await prisma.horse.update({
      where: { id: horse.id },
      data: { sireId: null, damId: null },
    });
  });

  // ─── ordering: sex check runs AFTER ownership check ──────────────────────
  // If a sireId points at the user's own non-Stallion, the response is the
  // 400 sex-role error (not the 404 ownership error). Ownership succeeds; sex
  // role fails. This ordering matches POST /horses (sex check follows ownership).

  it('owned non-Stallion sireId returns 400 sex-role (not 404 ownership)', async () => {
    expect.hasAssertions();
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sireId: colt.id }); // owned, but wrong sex

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Sire must be a stallion');
  });
});
