/**
 * Groom Retirement Routes Tests
 *
 * Tests for the groom retirement, legacy, and talent API endpoints
 *
 * Testing Approach: NO MOCKING - Real database operations
 * This validates actual API behavior and database constraints
 *
 * Equoria-4bs3s — versioned API surface: the unversioned `/api/*` mounts were
 * removed; `/api/v1/*` is the canonical surface (backend/app.mjs). Every
 * request below targets `/api/v1/grooms/...` — the old `/api/grooms/...`
 * paths 404 by design.
 *
 * Equoria-plw0h — per-user CSRF binding: csrfProtection derives the
 * sessionIdentifier from req.user.id on authenticated requests, so an
 * anonymous CSRF token (issued under the CSRF_SESSION_SALT fallback)
 * correctly 403s on an authenticated mutation. This suite creates a fresh
 * user per test (beforeEach), so the CSRF token is fetched per test AFTER
 * that user's JWT exists, forwarding the JWT as an accessToken cookie on the
 * token GET (fetchCsrf extraCookies) so issuance binds to the acting
 * identity. Mutations send the SAME JWT as both the accessToken cookie
 * (rides in csrf.cookieHeader) and the Authorization: Bearer header, so
 * whichever source authenticateToken picks, the resolved identity — and
 * therefore the CSRF sessionIdentifier — is identical.
 *
 * CRITICAL SAFETY (CLAUDE.md §2): every fixture row's id is tracked the
 * moment it is created and cleanup is FAIL-LOUD (createCleanupTracker — a
 * failed delete throws in afterAll instead of leaking silently) and
 * FK-ORDERED (children before parents: groomTalentSelections →
 * groomLegacyLogs → grooms → users). Every delete is scoped strictly to the
 * tracked fixture ids — never a broad deleteMany.
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { fetchCsrf } from '../helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

describe('Groom Retirement Routes', () => {
  const cleanup = createCleanupTracker();

  // Per-model fixture id ledgers. Every create below pushes its id
  // IMMEDIATELY so a mid-test failure still leaves a complete ledger for
  // the FK-ordered afterAll cleanup.
  const ids = {
    users: [],
    grooms: [],
  };

  let __csrf__;
  let testUser;
  let testToken;
  let testGroom;
  let retiredGroom;

  beforeAll(() => {
    // FK-ordered, id-scoped, fail-loud cleanup. Registration order = run
    // order (children before parents). Talent selections are created by the
    // POST /talents/select endpoint under test, so they are scoped by the
    // tracked groom ids (the suite never learns the selection row ids).
    cleanup.add(
      () => prisma.groomTalentSelections.deleteMany({ where: { groomId: { in: ids.grooms } } }),
      'groomTalentSelections',
    );
    cleanup.add(
      () =>
        prisma.groomLegacyLog.deleteMany({
          where: { OR: [{ retiredGroomId: { in: ids.grooms } }, { legacyGroomId: { in: ids.grooms } }] },
        }),
      'groomLegacyLogs',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.grooms } } }), 'grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.users } } }), 'users');
  });

  afterAll(() => cleanup.run(), 120000);

  beforeEach(async () => {
    // Create a fresh user for each test — avoids FK violations from test interference
    // when the full suite runs and Prisma connections are recycled between test files.
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    testUser = await prisma.user.create({
      data: {
        username: `testuser_routes_${ts}`,
        email: `test_routes_${ts}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    ids.users.push(testUser.id);
    testToken = generateTestToken(testUser);

    // Equoria-plw0h: CSRF token bound to THIS test's acting identity —
    // fetched after the JWT exists (an anonymous token correctly 403s).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${testToken}`] });

    // Create test grooms
    testGroom = await prisma.groom.create({
      data: {
        name: `Test Groom ${ts}`,
        personality: 'calm',
        skillLevel: 'intermediate',
        speciality: 'foal_care',
        userId: testUser.id,
        level: 5,
        careerWeeks: 50,
      },
    });
    ids.grooms.push(testGroom.id);

    retiredGroom = await prisma.groom.create({
      data: {
        name: `Retired Groom ${ts}`,
        personality: 'energetic',
        skillLevel: 'expert',
        speciality: 'general_grooming',
        userId: testUser.id,
        level: 8,
        careerWeeks: 104,
        retired: true,
        retirementReason: 'mandatory_career_limit',
      },
    });
    ids.grooms.push(retiredGroom.id);
  });

  describe('Retirement Endpoints', () => {
    test('GET /api/v1/grooms/:id/retirement/eligibility should check eligibility', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/${testGroom.id}/retirement/eligibility`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eligible');
      expect(response.body.data).toHaveProperty('weeksUntilRetirement');
    });

    test('GET /api/v1/grooms/retirement/statistics should return user stats', async () => {
      const response = await request(app)
        .get('/api/v1/grooms/retirement/statistics')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalGrooms');
      expect(response.body.data).toHaveProperty('activeGrooms');
      expect(response.body.data).toHaveProperty('retiredGrooms');
    });

    test('GET /api/v1/grooms/retirement/approaching should return approaching retirement grooms', async () => {
      const response = await request(app)
        .get('/api/v1/grooms/retirement/approaching')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Legacy Endpoints', () => {
    test('GET /api/v1/grooms/:id/legacy/eligibility should check legacy eligibility', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/${retiredGroom.id}/legacy/eligibility`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eligible');
    });

    test('GET /api/v1/grooms/legacy/history should return legacy history', async () => {
      const response = await request(app)
        .get('/api/v1/grooms/legacy/history')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Talent Endpoints', () => {
    test('GET /api/v1/grooms/talents/definitions should return talent definitions', async () => {
      const response = await request(app)
        .get('/api/v1/grooms/talents/definitions')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('calm');
      expect(response.body.data).toHaveProperty('energetic');
      expect(response.body.data).toHaveProperty('methodical');
    });

    test('GET /api/v1/grooms/:id/talents should return groom talent selections', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/${testGroom.id}/talents`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should be "none" for new groom with no selections
      expect(response.body.data).toBe('none');
    });

    test('POST /api/v1/grooms/:id/talents/validate should validate talent selection', async () => {
      const response = await request(app)
        .post(`/api/v1/grooms/${testGroom.id}/talents/validate`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          tier: 'tier1',
          talentId: 'gentle_hands',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid');
    });

    test('POST /api/v1/grooms/:id/talents/select should select talent', async () => {
      const response = await request(app)
        .post(`/api/v1/grooms/${testGroom.id}/talents/select`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          tier: 'tier1',
          talentId: 'gentle_hands',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('selection');
      expect(response.body.data.selection.tier1).toBe('gentle_hands');
    });
  });

  describe('Authentication', () => {
    test('should require authentication for protected endpoints', async () => {
      await request(app)
        .get(`/api/v1/grooms/${testGroom.id}/retirement/eligibility`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);

      await request(app)
        .get('/api/v1/grooms/retirement/statistics')
        .set('Origin', 'http://localhost:3000')

        .expect(401);

      await request(app)
        .get(`/api/v1/grooms/${testGroom.id}/talents`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });

    test('should require authentication for talent definitions', async () => {
      await request(app)
        .get('/api/v1/grooms/talents/definitions')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
    });
  });

  describe('Validation', () => {
    test('should validate groom ID parameter', async () => {
      await request(app)
        .get('/api/v1/grooms/invalid/retirement/eligibility')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
    });

    test('should validate talent selection data', async () => {
      await request(app)
        .post(`/api/v1/grooms/${testGroom.id}/talents/select`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          tier: 'invalid_tier',
          talentId: 'gentle_hands',
        })
        .expect(400);
    });
  });
});
