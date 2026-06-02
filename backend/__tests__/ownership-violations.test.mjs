import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';
import { createMockToken } from '../__tests__/factories/index.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { randomBytes } from 'node:crypto';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

/**
 * Integration tests to verify ownership enforcement for core resources.
 * Focuses on realistic, supported endpoints (horses, grooms) and ensures
 * cross-user access is denied while owners retain full access.
 */

describe('Ownership Violation Attempts Integration Tests', () => {
  // Equoria-0ys7m / Equoria-plw0h: per-user CSRF binding. The CSRF-gated
  // mutations below run on the authRouter (csrfProtection) authenticated as
  // userA. An anonymous fetchCsrf(app) binds the token to CSRF_SESSION_SALT,
  // which HMAC-mismatches req.user.id=userA -> a 403 that would mask the real
  // ownership-check (cross-user 404) and break the owner-update/delete 200s.
  // Bound per-test to userA's access cookie in beforeEach (after tokenA is
  // minted), so every mutation reaches the real ownership path.
  let __csrf__;

  let userA;
  let userB;
  let tokenA;
  let _tokenB;
  let horseA;
  let horseB;
  let groomA;
  let groomB;

  beforeEach(async () => {
    // Scoped cleanup: remove data from a previous iteration of this suite if it aborted early.
    // Avoids wiping ALL records (which would break concurrently-running suites).
    const staleUserIds = [userA?.id, userB?.id].filter(Boolean);
    if (staleUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: staleUserIds } } });
      await prisma.groomAssignment.deleteMany({ where: { userId: { in: staleUserIds } } });
      await prisma.groom.deleteMany({ where: { id: { in: [groomA?.id, groomB?.id].filter(Boolean) } } });
      await prisma.horse.deleteMany({ where: { id: { in: [horseA?.id, horseB?.id].filter(Boolean) } } });
      await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } });
    }

    // Ensure auth middleware and tokens share the same secret in test runs
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `userA-${randomBytes(8).toString('hex')}@example.com`,
        username: `userA-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'User',
        lastName: 'A',
        emailVerified: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `userB-${randomBytes(8).toString('hex')}@example.com`,
        username: `userB-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'User',
        lastName: 'B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });
    _tokenB = createMockToken(userB.id, {
      payload: { email: userB.email, role: userB.role || 'user' },
    });

    // Equoria-0ys7m: bind CSRF to userA's session so the gated mutations
    // resolve the same sessionIdentifier (req.user.id=userA) at validation.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${tokenA}`] });

    horseA = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `HorseA-${randomBytes(8).toString('hex')}`,
        userId: userA.id, // Matches schema field (line 144)
        sex: 'mare',
        dateOfBirth: new Date(),
      },
    });

    horseB = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `HorseB-${randomBytes(8).toString('hex')}`,
        userId: userB.id, // Matches schema field (line 144)
        sex: 'stallion',
        dateOfBirth: new Date(),
      },
    });

    groomA = await prisma.groom.create({
      data: {
        name: `GroomA-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        speciality: 'TRAINING',
        personality: 'diligent',
      },
    });

    groomB = await prisma.groom.create({
      data: {
        name: `GroomB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        speciality: 'CARE',
        personality: 'calm',
      },
    });
  });

  afterEach(async () => {
    const currentUserIds = [userA?.id, userB?.id].filter(Boolean);
    if (currentUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: currentUserIds } } });
    }
    await prisma.groom.deleteMany({
      where: { id: { in: [groomA?.id, groomB?.id].filter(Boolean) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseA?.id, horseB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } },
    });
  });

  describe('Cross-user horse access', () => {
    it('denies access to an unowned horse', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${horseB.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    it('allows owners to fetch their own horse', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${horseA.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(horseA.id);
      expect(response.body.data.userId).toBe(userA.id); // Matches schema field
    });

    it('blocks cross-user updates and preserves data integrity', async () => {
      const response = await request(app)
        .put(`/api/v1/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ name: 'HackedHorse' })
        .expect(404);

      expect(response.body.success).toBe(false);

      const horse = await prisma.horse.findUnique({ where: { id: horseB.id } });
      expect(horse.name).toBe(horseB.name);
    });

    it('allows owners to update their horse with a valid payload', async () => {
      const newName = 'Updated Horse Name';

      const response = await request(app)
        .put(`/api/v1/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: newName,
          sex: 'mare',
          dateOfBirth: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newName);

      const horse = await prisma.horse.findUnique({ where: { id: horseA.id } });
      expect(horse.name).toBe(newName);
    });

    it('blocks cross-user deletes and allows owner deletes', async () => {
      const blockResponse = await request(app)
        .delete(`/api/v1/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(404);

      expect(blockResponse.body.success).toBe(false);

      const allowResponse = await request(app)
        .delete(`/api/v1/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(allowResponse.body.success).toBe(true);

      const horse = await prisma.horse.findUnique({ where: { id: horseA.id } });
      expect(horse).toBeNull();
      // Prevent cleanup from double-deleting the record we just removed
      horseA = null;
    });
  });

  describe('Groom ownership', () => {
    it('denies access to an unowned groom profile', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/${groomB.id}/profile`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Groom not found');
    });

    it('allows owners to view their groom profile', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/${groomA.id}/profile`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.groom?.id || response.body.data?.id).toBe(groomA.id);
    });
  });

  describe('Parameter validation and enumeration safety', () => {
    it('rejects invalid horse identifiers', async () => {
      const response = await request(app)
        .get('/api/v1/horses/abc')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('returns the same 404 for missing and unowned horses', async () => {
      const missing = await request(app)
        .get('/api/v1/horses/999999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      const unowned = await request(app)
        .get(`/api/v1/horses/${horseB.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(missing.body.message).toBe(unowned.body.message);
      expect(missing.body.success).toBe(false);
      expect(unowned.body.success).toBe(false);
    });
  });
});
