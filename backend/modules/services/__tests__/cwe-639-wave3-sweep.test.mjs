/**
 * CWE-639 Wave-3 Sweep — sentinel tests for Equoria-1i6w.
 *
 * Audit verdict (wave-3 candidate list):
 *   - 0 REAL LEAKS (status code or message divergence reachable in production)
 *   - 5 DEAD-CODE branches (controller's 403 unreachable because route uses
 *     `requireOwnership` middleware, which returns 404 first)
 *   - 3 NOT-A-LEAK sites (already collapsed to 404 with identical message,
 *     pre-wave-3 hardening — defense-in-depth or AC5 doctrine)
 *
 * These tests assert the middleware/service chain returns 404 (NOT 403) for
 * cross-user access, which proves the controller-level 403 branches the
 * companion cleanup commit removes were genuinely unreachable. If a future
 * change removes the middleware, these tests fail RED — exactly the regression
 * signal §2 sentinel-positive contract requires.
 *
 * Companion cleanup:
 *   horseXpController.mjs (3 branches: getHorseXpStatus, allocateStatPoint, getHorseXpHistory)
 *   enhancedGroomController.mjs (1 branch: getRelationshipDetails)
 *   groomAssignmentService.mjs (1 branch: removeAssignment)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('CWE-639 wave-3 sweep (Equoria-1i6w)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let userA;
  let userB;
  let tokenA;
  let horseA;
  let horseB;
  let groomA;
  let groomB;

  const NONEXISTENT_ID = 999999999;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `cwe639w3a-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w3a-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe3',
        lastName: 'A',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `cwe639w3b-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w3b-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe3',
        lastName: 'B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });

    horseA = await prisma.horse.create({
      data: {
        name: `CweHorseW3A-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        sex: 'mare',
        dateOfBirth: new Date(),
      },
    });
    horseB = await prisma.horse.create({
      data: {
        name: `CweHorseW3B-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'stallion',
        dateOfBirth: new Date(),
      },
    });
    groomA = await prisma.groom.create({
      data: {
        name: `CweGroomW3A-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        speciality: 'TRAINING',
        personality: 'diligent',
      },
    });
    groomB = await prisma.groom.create({
      data: {
        name: `CweGroomW3B-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        speciality: 'CARE',
        personality: 'calm',
      },
    });
  });

  afterEach(async () => {
    const ids = [userA?.id, userB?.id].filter(Boolean);
    if (ids.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.groomAssignment.deleteMany({ where: { userId: { in: ids } } });
    }
    await prisma.groom.deleteMany({
      where: { id: { in: [groomA?.id, groomB?.id].filter(Boolean) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseA?.id, horseB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  // ─── Horse XP routes (3 dead-code branches) ──────────────────────────────
  // Mount path: app.use('/api/v1', authRouter) (app.mjs:636) +
  //             authRouter.use('/horses', horseRoutes) (app.mjs:185)
  describe('GET /api/v1/horses/:id/xp (getHorseXpStatus)', () => {
    it('returns 404 (not 403) for cross-user horse — middleware fires before controller', async () => {
      const resCrossUser = await request(app)
        .get(`/api/v1/horses/${horseB.id}/xp`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resCrossUser.status).toBe(404);
      // Disclosure-resistance: 'not authorized to view this horse' (the
      // controller's 403 message) MUST NOT appear. Middleware returns the
      // 'Horse not found' message instead.
      expect(JSON.stringify(resCrossUser.body)).not.toContain('not authorized');

      const resMissing = await request(app)
        .get(`/api/v1/horses/${NONEXISTENT_ID}/xp`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  describe('POST /api/v1/horses/:id/allocate-stat (allocateStatPoint)', () => {
    it('returns 404 (not 403) for cross-user horse — middleware fires before controller', async () => {
      const resCrossUser = await request(app)
        .post(`/api/v1/horses/${horseB.id}/allocate-stat`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statName: 'speed' });

      expect(resCrossUser.status).toBe(404);
      expect(JSON.stringify(resCrossUser.body)).not.toContain('not authorized');

      const resMissing = await request(app)
        .post(`/api/v1/horses/${NONEXISTENT_ID}/allocate-stat`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statName: 'speed' });

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  describe('GET /api/v1/horses/:id/xp-history (getHorseXpHistory)', () => {
    it('returns 404 (not 403) for cross-user horse — middleware fires before controller', async () => {
      const resCrossUser = await request(app)
        .get(`/api/v1/horses/${horseB.id}/xp-history`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resCrossUser.status).toBe(404);
      expect(JSON.stringify(resCrossUser.body)).not.toContain('not authorized');

      const resMissing = await request(app)
        .get(`/api/v1/horses/${NONEXISTENT_ID}/xp-history`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  // ─── enhancedGroomController.getRelationshipDetails (dead-code branch) ───
  // Mount path: authRouter.use('/grooms/enhanced', enhancedGroomRoutes) (app.mjs:214)
  describe('GET /api/v1/grooms/enhanced/relationship/:groomId/:horseId', () => {
    it('returns 404 (not 403) for cross-user groom — middleware fires before controller', async () => {
      const resCrossUserGroom = await request(app)
        .get(`/api/v1/grooms/enhanced/relationship/${groomB.id}/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resCrossUserGroom.status).toBe(404);
      // The controller's collapsed 'Horse not found or not owned by user'
      // message is dead code — ownership middleware says 'Groom not found'.
      expect(JSON.stringify(resCrossUserGroom.body)).not.toContain('not owned by user');
    });

    it('returns 404 (not 403) for cross-user horse — middleware fires before controller', async () => {
      const resCrossUserHorse = await request(app)
        .get(`/api/v1/grooms/enhanced/relationship/${groomA.id}/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(resCrossUserHorse.status).toBe(404);
      expect(JSON.stringify(resCrossUserHorse.body)).not.toContain('not owned by user');
    });
  });

  // ─── groomAssignmentService.removeAssignment (dead-code branch) ─────────
  // Mount path: authRouter.use('/groom-assignments', groomAssignmentRoutes) (app.mjs:215)
  describe('DELETE /api/v1/groom-assignments/:assignmentId (removeAssignment)', () => {
    it('returns 404 (not 403) for cross-user assignment — middleware fires before service', async () => {
      // Create an assignment owned by userB
      const assignmentB = await prisma.groomAssignment.create({
        data: {
          groomId: groomB.id,
          foalId: horseB.id,
          userId: userB.id,
          isActive: true,
          priority: 1,
        },
      });

      try {
        const resCrossUser = await request(app)
          .delete(`/api/v1/groom-assignments/${assignmentB.id}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);

        expect(resCrossUser.status).toBe(404);
        // The service's 'You do not have permission to remove this assignment'
        // message is dead code — ownership middleware says 'Groom-assignment
        // not found' first.
        expect(JSON.stringify(resCrossUser.body)).not.toContain('do not have permission');

        const resMissing = await request(app)
          .delete(`/api/v1/groom-assignments/${NONEXISTENT_ID}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);

        expect(resMissing.status).toBe(404);
        expect(resMissing.body).toEqual(resCrossUser.body);
      } finally {
        await prisma.groomAssignment.delete({ where: { id: assignmentB.id } }).catch(() => {});
      }
    });
  });
});
