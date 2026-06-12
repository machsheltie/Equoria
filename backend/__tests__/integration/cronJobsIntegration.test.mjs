/**
 * Integration Test: Admin Cron API Routes — Real Database
 *
 * Tests admin API endpoints for cron job management (status, start/stop,
 * manual trigger, foal listing, trait definitions) using the real database.
 * No mocks — validates actual HTTP routing, admin auth, response structure,
 * and real database queries for foal listing.
 *
 * Endpoints tested (adminRouter is mounted at /api/v1/admin — backend/app.mjs):
 * - GET  /api/v1/admin/cron/status       — cron job status
 * - POST /api/v1/admin/cron/start        — start cron service
 * - POST /api/v1/admin/cron/stop         — stop cron service
 * - POST /api/v1/admin/traits/evaluate   — manual trait evaluation
 * - GET  /api/v1/admin/foals/development — foals in development period
 * - GET  /api/v1/admin/traits/definitions — trait definitions reference
 *
 * Auth tested:
 * - All endpoints require admin authentication (401 without token)
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import bcrypt from 'bcryptjs';

import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The old afterAll wrapped its
// deletes in a swallowed empty catch arm + an outer try/catch console.warn, so
// a leaked foal/groom/user (Horse.userId onDelete:Restrict, schema:282) stayed
// hidden and could trip the canonical NULL-phenotype sentinel (Equoria-a429/lfj5).
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';

// Import the real app — no mocks
const app = (await import('../../app.mjs')).default;

describe('INTEGRATION: Admin Cron API Routes — Real Database', () => {
  const cleanup = createCleanupTracker();
  let __csrf__;

  let adminUser;
  let adminToken;
  let testFoal;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  beforeAll(async () => {
    // rounds=1: fast in tests; the password is never verified (JWT is generated
    // directly via generateTestToken). bcrypt rounds=10 can exceed 60s under
    // full-suite --runInBand load (cronJobs timeout, Equoria-v1qf follow-up).
    const hashedPassword = await bcrypt.hash('AdminPassword123!', 1);
    adminUser = await prisma.user.create({
      data: {
        username: `cron_admin_${ts}`,
        email: `cron_admin_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'CronAdmin',
        lastName: 'Tester',
        role: 'admin',
      },
    });

    // Generate a JWT token with admin role for the real user
    adminToken = generateTestToken({ id: adminUser.id, role: 'admin' });

    // Equoria-plw0h: per-user CSRF binding. The adminRouter mounts
    // authenticateToken BEFORE csrfProtection (backend/app/routers.mjs), so
    // on every admin mutation the CSRF sessionIdentifier resolves to
    // req.user.id. The token must therefore be ISSUED under that same
    // identity — fetched AFTER the admin token exists, forwarding it as an
    // accessToken cookie so tryPopulateUserFromAccessCookie binds issuance
    // to adminUser.id. An anonymous (salt-bound) token correctly 403s.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${adminToken}`] });

    // Create a real foal (age 0) so the foals/development endpoint has data
    testFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `CronTestFoal_${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: adminUser.id,
        bondScore: 65,
        stressLevel: 35,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    // Equoria-1ohys: register fail-loud, scoped cleanup. FK order: foal child
    // rows -> horse (Horse.userId onDelete:Restrict) -> groom -> user.
    cleanup.add(async () => {
      if (!testFoal) {
        return;
      }
      await prisma.foalTrainingHistory.deleteMany({ where: { horseId: testFoal.id } });
      await prisma.foalDevelopment.deleteMany({ where: { foalId: testFoal.id } });
      await prisma.foalActivity.deleteMany({ where: { foalId: testFoal.id } });
      await prisma.groomAssignment.deleteMany({ where: { foalId: testFoal.id } });
      await prisma.horse.deleteMany({ where: { id: testFoal.id } });
    }, 'foal children + foal horse');
    cleanup.add(async () => {
      if (!adminUser) {
        return;
      }
      await prisma.groom.deleteMany({ where: { userId: adminUser.id } });
      await prisma.user.deleteMany({ where: { id: adminUser.id } });
    }, 'admin groom + user');
  }, 120000); // 120s — bcrypt + two DB creates can be slow under full-suite load

  afterAll(() => cleanup.run(), 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('Admin API Endpoints', () => {
    it('should get cron job status', async () => {
      const response = await request(app)
        .get('/api/v1/admin/cron/status')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('serviceRunning');
      expect(response.body.data).toHaveProperty('totalJobs');
    });

    it('should manually trigger trait evaluation', async () => {
      const response = await request(app)
        .post('/api/v1/admin/traits/evaluate')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      // Distinguish the rejecting middleware: a CSRF-binding regression must
      // surface as a CSRF defect, not fold into the generic status assertion.
      expect(response.body?.code).not.toBe('INVALID_CSRF_TOKEN');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('completed successfully');
    });

    it('should get foals in development from the real database', async () => {
      // The historical snake_case-Prisma-field bug in this route (bond_score
      // vs bondScore → Prisma validation error → 500) is fixed: the
      // controller now selects camelCase fields
      // (backend/modules/admin/controllers/adminController.mjs#getFoalDevelopment).
      // Assert the working contract unconditionally — a 500 here is a real
      // regression and must fail loudly, not be excused by a fallback branch.
      const response = await request(app)
        .get('/api/v1/admin/foals/development')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('foals');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.foals)).toBe(true);

      // Our test foal (age 0) should appear in the results
      const foalIds = response.body.data.foals.map(f => f.id);
      expect(foalIds).toContain(testFoal.id);

      // Verify the foal data structure
      const ourFoal = response.body.data.foals.find(f => f.id === testFoal.id);
      expect(ourFoal).toBeTruthy();
      expect(ourFoal.name).toBe(testFoal.name);
      expect(ourFoal.age).toBe(0);
    });

    it('should get trait definitions', async () => {
      const response = await request(app)
        .get('/api/v1/admin/traits/definitions')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('positive');
      expect(response.body.data).toHaveProperty('negative');
      expect(response.body.data).toHaveProperty('rare');

      // Verify trait definition structure
      Object.values(response.body.data).forEach(category => {
        Object.values(category).forEach(trait => {
          expect(trait).toHaveProperty('name');
          expect(trait).toHaveProperty('description');
          expect(trait).toHaveProperty('revealConditions');
          expect(trait).toHaveProperty('rarity');
          expect(trait).toHaveProperty('baseChance');
        });
      });
    });

    it('should start and stop cron job service', async () => {
      const startResponse = await request(app)
        .post('/api/v1/admin/cron/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(startResponse.body?.code).not.toBe('INVALID_CSRF_TOKEN');
      expect(startResponse.status).toBe(200);
      expect(startResponse.body.success).toBe(true);
      expect(startResponse.body.message).toContain('started successfully');

      const stopResponse = await request(app)
        .post('/api/v1/admin/cron/stop')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(stopResponse.body?.code).not.toBe('INVALID_CSRF_TOKEN');
      expect(stopResponse.status).toBe(200);
      expect(stopResponse.body.success).toBe(true);
      expect(stopResponse.body.message).toContain('stopped successfully');
    });

    it('requires admin authentication — rejects missing token', async () => {
      await request(app).get('/api/v1/admin/cron/status').set('Origin', 'http://localhost:3000').expect(401);
    });

    it('requires admin role — rejects non-admin user', async () => {
      const regularToken = generateTestToken({ id: adminUser.id, role: 'user' });
      await request(app)
        .get('/api/v1/admin/cron/status')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    }, 120000);
  });
});
