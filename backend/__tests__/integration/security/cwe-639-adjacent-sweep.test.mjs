/**
 * CWE-639 Adjacent-Locations Sweep — sentinel tests for Equoria-4o39.
 *
 * Each describe block covers ONE leak fixed in the 4o39 sweep. Each test asserts
 * cross-user access returns 404 (not 403) AND that the response body is byte-
 * identical to the not-exists case — the byte-identical sentinel is what makes
 * these CWE-639 tests, not just "404 instead of 403" tests.
 *
 * Companion child issues:
 *   - Equoria-m55h — ultraRareTraitRoutes /effects/calculate
 *   - Equoria-qpeg — enhancedReportingRoutes /horses/compare-epigenetics
 *   - Equoria-msh4 — environmentalRoutes /environment/calculate-impact
 *   - Equoria-q4yy — traitDiscoveryRoutes /discover/batch
 *   - Equoria-5w2v — groomAssignmentService.validateAssignmentEligibility
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createMockToken } from '../../factories/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('CWE-639 adjacent-locations sweep (Equoria-4o39)', () => {
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
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `cwe639a-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639a-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'A',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `cwe639b-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639b-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });

    horseA = await prisma.horse.create({
      data: {
        name: `CweHorseA-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        sex: 'mare',
        dateOfBirth: new Date(),
      },
    });
    horseB = await prisma.horse.create({
      data: {
        name: `CweHorseB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'stallion',
        dateOfBirth: new Date(),
      },
    });
    groomA = await prisma.groom.create({
      data: {
        name: `CweGroomA-${randomBytes(8).toString('hex')}`,
        userId: userA.id,
        speciality: 'TRAINING',
        personality: 'diligent',
      },
    });
    groomB = await prisma.groom.create({
      data: {
        name: `CweGroomB-${randomBytes(8).toString('hex')}`,
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

  // ─── Equoria-m55h ────────────────────────────────────────────────────────
  describe('ultraRareTraitRoutes POST /api/v1/auth/ultra-rare-traits/effects/calculate', () => {
    it('returns 404 for cross-user horse with byte-identical response to not-exists', async () => {
      const resNotOwned = await request(app)
        .post('/api/v1/auth/ultra-rare-traits/effects/calculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: horseB.id, effectType: 'stress', baseValue: 1 });

      expect(resNotOwned.status).toBe(404);
      expect(resNotOwned.body.success).toBe(false);

      const resMissing = await request(app)
        .post('/api/v1/auth/ultra-rare-traits/effects/calculate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseId: NONEXISTENT_ID, effectType: 'stress', baseValue: 1 });

      expect(resMissing.status).toBe(404);
      // Byte-identical sentinel — divergence allows ID enumeration.
      expect(resMissing.body).toEqual(resNotOwned.body);
    });
  });

  // ─── Equoria-qpeg ────────────────────────────────────────────────────────
  describe('enhancedReportingRoutes POST /horses/compare-epigenetics', () => {
    it('returns 404 for cross-user horseIds with byte-identical response to not-exists', async () => {
      // Need at least 2 horseIds (route AC).
      const horseA2 = await prisma.horse.create({
        data: {
          name: `CweHorseA2-${randomBytes(8).toString('hex')}`,
          userId: userA.id,
          sex: 'mare',
          dateOfBirth: new Date(),
        },
      });

      try {
        const resCrossUser = await request(app)
          .post('/api/v1/auth/horses/compare-epigenetics')
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({ horseIds: [horseA.id, horseB.id] });

        expect(resCrossUser.status).toBe(404);
        expect(resCrossUser.body.success).toBe(false);

        const resMissing = await request(app)
          .post('/api/v1/auth/horses/compare-epigenetics')
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({ horseIds: [horseA.id, NONEXISTENT_ID] });

        expect(resMissing.status).toBe(404);
        expect(resMissing.body).toEqual(resCrossUser.body);
      } finally {
        await prisma.horse.delete({ where: { id: horseA2.id } }).catch(() => {});
      }
    });
  });

  // ─── Equoria-msh4 ────────────────────────────────────────────────────────
  describe('environmentalRoutes POST /environment/calculate-impact', () => {
    it('returns 404 for cross-user horseIds with byte-identical response to not-exists', async () => {
      const resCrossUser = await request(app)
        .post('/api/v1/auth/environment/calculate-impact')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseB.id] });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body.success).toBe(false);

      const resMissing = await request(app)
        .post('/api/v1/auth/environment/calculate-impact')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [NONEXISTENT_ID] });

      expect(resMissing.status).toBe(404);
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });

  // ─── Equoria-q4yy ────────────────────────────────────────────────────────
  describe('traitDiscoveryRoutes POST /api/v1/trait-discovery/discover/batch (all-fail)', () => {
    it('returns 404 (not 403) when all horses fail ownership; per-horse messages disclosure-resistant', async () => {
      const resAllForeign = await request(app)
        .post('/api/v1/trait-discovery/discover/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [horseB.id] });

      expect(resAllForeign.status).toBe(404);
      expect(resAllForeign.body.success).toBe(false);

      const resAllMissing = await request(app)
        .post('/api/v1/trait-discovery/discover/batch')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [NONEXISTENT_ID] });

      expect(resAllMissing.status).toBe(404);
      // Per-horse error message is the same for both not-exists and not-yours
      // (already disclosure-resistant via findOwnedResource — see route).
      // The per-horse `horseId` field will differ (different IDs), but the
      // error string for each is identical.
      const fErr = resAllForeign.body.errors[0]?.error;
      const mErr = resAllMissing.body.errors[0]?.error;
      expect(fErr).toBe(mErr);
    });
  });

  // ─── Equoria-5w2v ────────────────────────────────────────────────────────
  describe('groomAssignmentRoutes /api/groom-assignments/validate', () => {
    it('errors do not distinguish exists-but-not-yours from doesnt-exist', async () => {
      const resForeignGroom = await request(app)
        .post('/api/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomB.id, horseId: horseA.id });

      const resMissingGroom = await request(app)
        .post('/api/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: NONEXISTENT_ID, horseId: horseA.id });

      // Status codes equal AND the errors array equal — disclosure-resistant.
      expect(resForeignGroom.status).toBe(resMissingGroom.status);
      expect(resForeignGroom.body.data.errors).toEqual(resMissingGroom.body.data.errors);
      // The 'You do not own this groom' message must NOT appear — that was
      // the leak vector.
      expect(JSON.stringify(resForeignGroom.body)).not.toContain('You do not own');

      const resForeignHorse = await request(app)
        .post('/api/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomA.id, horseId: horseB.id });

      const resMissingHorse = await request(app)
        .post('/api/groom-assignments/validate')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: groomA.id, horseId: NONEXISTENT_ID });

      expect(resForeignHorse.body.data.errors).toEqual(resMissingHorse.body.data.errors);
      expect(JSON.stringify(resForeignHorse.body)).not.toContain('You do not own');
    });
  });
});
