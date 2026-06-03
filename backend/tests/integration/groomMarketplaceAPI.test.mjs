/**
 * Groom Marketplace API Integration Tests
 * Tests for the complete groom marketplace API workflow
 *
 * Test Coverage:
 * - Get marketplace
 * - Refresh marketplace
 * - Hire grooms from marketplace
 * - Marketplace statistics
 * - Authentication and authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createTestUser } from '../helpers/testAuth.mjs';
import { forceExpireMarketplace } from '../../controllers/groomMarketplaceController.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🏪 INTEGRATION: Groom Marketplace API', () => {
  // Equoria-rnbzn: __csrf__ is fetched AFTER the user/token exist and bound to
  // that user (extraCookies: accessToken). The POST groom-marketplace endpoints
  // (refresh, hire) authenticate via the Bearer token, so csrfProtection
  // resolves the sessionIdentifier from req.user.id; a token issued
  // anonymously (before the user existed) binds to the fallback salt and 403s
  // the legitimate mutation.
  let __csrf__;

  let _testUser;
  let authToken;
  // Equoria-rnbzn: collect EVERY user id this suite creates — the main user
  // here plus the poor-user / no-marketplace-user created inside it()-bodies —
  // so afterAll can do a scoped, FK-ordered, fail-loud teardown instead of the
  // ID-tracked cleanupTestData() that (a) swallowed errors via a console.warn
  // and (b) never deleted the Groom rows hired from the marketplace (grooms
  // FK userId is SET NULL, so those rows would orphan, not block, and leak).
  const createdUserIds = [];

  beforeAll(async () => {
    // Equoria-rnbzn: randomize the fixture identifiers (was a fixed Date.now()
    // timestamp that collides with a crashed prior run on the User.username /
    // User.email unique constraints). Underscore-only suffix keeps the username
    // within the valid [A-Za-z0-9_] charset.
    const suffix = randomBytes(6).toString('hex');
    const userData = await createTestUser({
      username: `marketplace_test_user_${suffix}`,
      email: `marketplace_${suffix}@example.com`,
      money: 10000, // Give user plenty of money for testing
    });
    _testUser = userData.user;
    authToken = userData.token;
    createdUserIds.push(_testUser.id);

    // Bind the CSRF token to this user (per-user CSRF, Equoria-plw0h).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });
  });

  afterAll(async () => {
    // FK-ordered, scoped, fail-loud teardown (Equoria-rnbzn) for EVERY user
    // this suite created (main + the in-test poor/no-marketplace users).
    //
    // Order per user-set: groomAssignment → groom → horse → user.
    //   - Hiring from the marketplace creates Groom rows owned by the user;
    //     grooms.userId is onDelete: SET NULL so they would not block the user
    //     delete but WOULD orphan — delete grooms (and any assignments that FK
    //     to them) explicitly, scoped to userId.
    //   - StaffMarketplaceState.user is onDelete: Cascade, so the marketplace
    //     cache row is removed with the user automatically — no explicit step.
    //   - Horse.userId is onDelete: Restrict; createTestUser uses a direct
    //     prisma.user.create (no register-flow starter horse) and this suite
    //     creates no horses, but the user-scoped horse delete is kept as a
    //     defensive FK-safe step in case that ever changes.
    //
    // createCleanupTracker runs every task even if one throws, then throws ONE
    // aggregated error so a leak into the canonical DB (CLAUDE.md §2) fails the
    // suite loudly instead of being swallowed by a console.warn.
    const ids = createdUserIds.filter(Boolean);
    const cleanup = createCleanupTracker();
    if (ids.length > 0) {
      cleanup.add(
        () => prisma.groomAssignment.deleteMany({ where: { userId: { in: ids } } }),
        'suite users groom assignments',
      );
      cleanup.add(() => prisma.groom.deleteMany({ where: { userId: { in: ids } } }), 'suite users grooms');
      cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: ids } } }), 'suite users horses');
      cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids } } }), 'suite users');
    }
    await cleanup.run();
  });

  describe('Authentication', () => {
    it('should require authentication for all marketplace endpoints', async () => {
      // Test all endpoints without auth
      const endpoints = [
        { method: 'get', path: '/api/v1/groom-marketplace' },
        { method: 'post', path: '/api/v1/groom-marketplace/refresh' },
        { method: 'post', path: '/api/v1/groom-marketplace/hire' },
        { method: 'get', path: '/api/v1/groom-marketplace/stats' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('GET /api/v1/groom-marketplace', () => {
    it('should get marketplace with available grooms', async () => {
      const response = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Marketplace retrieved successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('grooms');
      expect(data).toHaveProperty('lastRefresh');
      expect(data).toHaveProperty('nextFreeRefresh');
      expect(data).toHaveProperty('refreshCost');
      expect(data).toHaveProperty('canRefreshFree');
      expect(data).toHaveProperty('refreshCount');

      // Check grooms array
      expect(Array.isArray(data.grooms)).toBe(true);
      expect(data.grooms.length).toBeGreaterThan(0);

      // Check first groom structure
      const [firstGroom] = data.grooms;
      expect(firstGroom).toHaveProperty('firstName');
      expect(firstGroom).toHaveProperty('lastName');
      expect(firstGroom).toHaveProperty('specialty');
      expect(firstGroom).toHaveProperty('skillLevel');
      expect(firstGroom).toHaveProperty('personality');
      expect(firstGroom).toHaveProperty('experience');
      expect(firstGroom).toHaveProperty('sessionRate');
      expect(firstGroom).toHaveProperty('bio');
      expect(firstGroom).toHaveProperty('availability');
      expect(firstGroom).toHaveProperty('marketplaceId');

      // Check refresh info (first generation counts as refresh)
      expect(data.refreshCount).toBe(1);
      // Note: canRefreshFree may be false immediately after generation due to timing
    });

    it('should return same marketplace on subsequent calls', async () => {
      // Get marketplace twice
      const response1 = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Should have same grooms and refresh count
      expect(response1.body.data.grooms).toEqual(response2.body.data.grooms);
      expect(response1.body.data.refreshCount).toBe(response2.body.data.refreshCount);
    });
  });

  describe('POST /api/v1/groom-marketplace/refresh', () => {
    it('should refresh marketplace when free refresh available', async () => {
      // First get current marketplace
      const initialResponse = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const initialGrooms = initialResponse.body.data.grooms;

      // Force-expire the marketplace so the free refresh window is available immediately.
      // forceExpireMarketplace is async — must be awaited or the refresh below races
      // ahead with lastRefresh still recent → controller returns 400.
      await forceExpireMarketplace(_testUser.id);

      // Refresh marketplace
      const refreshResponse = await request(app)
        .post('/api/v1/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.message).toBe('Marketplace refreshed successfully');

      const { data } = refreshResponse.body;
      expect(data).toHaveProperty('grooms');
      expect(data).toHaveProperty('paidRefresh');
      expect(data.paidRefresh).toBe(false); // Should be free

      // Grooms should be different (very high probability)
      const newGrooms = data.grooms;
      expect(newGrooms).not.toEqual(initialGrooms);
      expect(newGrooms.length).toBe(initialGrooms.length);
    });

    it('should require payment for premium refresh when not enough time passed', async () => {
      // Refresh marketplace first
      await request(app)
        .post('/api/v1/groom-marketplace/refresh')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      // Try to refresh again immediately (should require payment)
      const response = await request(app)
        .post('/api/v1/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('costs');
      expect(response.body.data).toHaveProperty('cost');
      expect(response.body.data.cost).toBeGreaterThan(0);
    });

    it('should allow premium refresh with force=true', async () => {
      // Refresh once to ensure a recent timestamp, then force a premium refresh
      await request(app)
        .post('/api/v1/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      const refreshResponse = await request(app)
        .post('/api/v1/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ force: true });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(typeof refreshResponse.body.data.paidRefresh).toBe('boolean');
    });
  });

  describe('POST /api/v1/groom-marketplace/hire', () => {
    let marketplaceGroom;

    beforeEach(async () => {
      // Get fresh marketplace
      const response = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      [marketplaceGroom] = response.body.data.grooms;
    });

    it('should hire groom from marketplace successfully', async () => {
      const response = await request(app)
        .post('/api/v1/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: marketplaceGroom.marketplaceId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Groom hired successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('groom');
      expect(data).toHaveProperty('cost');
      expect(data).toHaveProperty('remainingMoney');

      // Check hired groom data
      const hiredGroom = data.groom;
      expect(hiredGroom.name).toBe(`${marketplaceGroom.firstName} ${marketplaceGroom.lastName}`);
      expect(hiredGroom.speciality).toBe(marketplaceGroom.specialty);
      expect(hiredGroom.skillLevel).toBe(marketplaceGroom.skillLevel);
      expect(Number(hiredGroom.sessionRate)).toBe(marketplaceGroom.sessionRate);

      // Check cost calculation (one week upfront)
      const expectedCost = marketplaceGroom.sessionRate * 7;
      expect(data.cost).toBe(expectedCost);
    });

    it('should remove hired groom from marketplace', async () => {
      // Get initial marketplace
      const initialResponse = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const _initialGroomCount = initialResponse.body.data.grooms.length;
      const [groomToHire] = initialResponse.body.data.grooms;

      // Hire the groom
      await request(app)
        .post('/api/v1/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: groomToHire.marketplaceId });

      // Check marketplace again
      const updatedResponse = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const updatedGrooms = updatedResponse.body.data.grooms;
      expect(Array.isArray(updatedGrooms)).toBe(true);
      expect(updatedGrooms.length).toBeGreaterThan(0);

      // Hired groom should not be in marketplace anymore
      const hiredGroomStillThere = updatedGrooms.find(g => g.marketplaceId === groomToHire.marketplaceId);
      expect(hiredGroomStillThere).toBeUndefined();
    });

    it('should reject hiring with insufficient funds', async () => {
      // Create a poor user with a randomized, scoped-for-cleanup identity.
      const poorSuffix = randomBytes(6).toString('hex');
      const poorUserData = await createTestUser({
        username: `poor_marketplace_user_${poorSuffix}`,
        email: `poor_${poorSuffix}@example.com`,
        money: 10, // Very little money
      });
      // Equoria-rnbzn: track for the suite's FK-ordered fail-loud teardown.
      createdUserIds.push(poorUserData.user.id);

      // Equoria-2gqir: the hire mutation runs on authRouter, where
      // authenticateToken populates req.user BEFORE csrfProtection, so
      // resolveSessionIdentifier (middleware/csrf.mjs) binds the CSRF check to
      // req.user.id = poorUser.id. The suite-level __csrf__ is bound to the
      // MAIN user's accessToken — replaying it here would HMAC-mismatch under
      // poorUser.id and 403 the request, masking the 400 Insufficient-funds
      // path this test exists to assert. Mint a CSRF token bound to THIS user
      // instead (per-user CSRF, Equoria-plw0h).
      const poorCsrf = await fetchCsrf(app, {
        extraCookies: [`accessToken=${poorUserData.token}`],
      });

      // Get marketplace for poor user. loadOrCreateMarketplace auto-generates a
      // fresh marketplace on first GET, so the subsequent hire reaches the
      // funds check rather than the 404 "Groom not found" path. The cheapest
      // groom is a novice at $15/session ($105 for the one-week-upfront hire),
      // so a groom whose 7×rate exceeds the poor user's $10 balance is always
      // present.
      const marketplaceResponse = await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${poorUserData.token}`);

      const expensiveGroom = marketplaceResponse.body.data.grooms.find(g => g.sessionRate * 7 > 10); // Find groom that costs more than user has
      // Guard the assertion from silently no-opping: every generated
      // marketplace contains a groom dearer than $10, so this must hold. If it
      // ever fails, fail loudly instead of skipping the funds-check assertions.
      expect(expensiveGroom).toBeDefined();

      const response = await request(app)
        .post('/api/v1/groom-marketplace/hire')
        .set('Authorization', `Bearer ${poorUserData.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', poorCsrf.cookieHeader)
        .set('X-CSRF-Token', poorCsrf.csrfToken)
        .send({ marketplaceId: expensiveGroom.marketplaceId });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient funds');
    });

    it('should reject hiring non-existent groom', async () => {
      const response = await request(app)
        .post('/api/v1/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ marketplaceId: 'non-existent-id' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Groom not found in marketplace');
    });

    it('should require marketplaceId', async () => {
      const response = await request(app)
        .post('/api/v1/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('marketplaceId is required');
    });
  });

  describe('GET /api/v1/groom-marketplace/stats', () => {
    it('should return marketplace statistics', async () => {
      // Ensure marketplace exists
      await request(app)
        .get('/api/v1/groom-marketplace')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/v1/groom-marketplace/stats')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Marketplace statistics retrieved successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('totalGrooms');
      expect(data).toHaveProperty('lastRefresh');
      expect(data).toHaveProperty('refreshCount');
      expect(data).toHaveProperty('qualityDistribution');
      expect(data).toHaveProperty('specialtyDistribution');
      expect(data).toHaveProperty('config');

      // Check distributions
      expect(typeof data.qualityDistribution).toBe('object');
      expect(typeof data.specialtyDistribution).toBe('object');

      // Check config
      expect(data.config).toHaveProperty('refreshIntervalHours');
      expect(data.config).toHaveProperty('premiumRefreshCost');
      expect(data.config).toHaveProperty('defaultSize');
    });

    it('should return empty stats for user with no marketplace', async () => {
      // Create a new user with no marketplace and a randomized identity.
      const noMarketSuffix = randomBytes(6).toString('hex');
      const newUserData = await createTestUser({
        username: `no_marketplace_user_${noMarketSuffix}`,
        email: `nomarket_${noMarketSuffix}@example.com`,
      });
      // Equoria-rnbzn: track for the suite's FK-ordered fail-loud teardown.
      createdUserIds.push(newUserData.user.id);

      const response = await request(app)
        .get('/api/v1/groom-marketplace/stats')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${newUserData.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalGrooms).toBe(0);
      expect(response.body.data.lastRefresh).toBe('never');
      expect(response.body.data.refreshCount).toBe(0);
    });
  });
});
