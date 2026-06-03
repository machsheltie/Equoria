/**
 * Advanced Breeding Genetics API Integration Tests
 *
 * Tests for API endpoints that integrate enhanced genetic probability calculations,
 * advanced lineage analysis, and genetic diversity tracking systems.
 *
 * Testing Approach: TDD with NO MOCKING - Real API validation
 * Business Rules: Complete breeding genetics workflow integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../helpers/testAuth.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

describe('🧬 Advanced Breeding Genetics API Integration', () => {
  // Equoria-emkv6: per-user CSRF binding (Equoria-plw0h). authRouter applies
  // authenticateToken BEFORE csrfProtection, so at verify time the session
  // identifier resolves to req.user.id (from the Bearer token). The CSRF token
  // must therefore be ISSUED bound to that same user.id — achieved by forwarding
  // an `accessToken=<jwt>` cookie as extraCookies on the GET /auth/csrf-token
  // call so csrf.mjs#tryPopulateUserFromAccessCookie binds issuance to user.id.
  // Issuing the token anonymously (no accessToken cookie) binds it to the
  // fallback salt and every authed mutation then 403s on the identifier change.
  let __csrf__;

  let authToken;
  let testUser;
  let testStallion, testMare;
  let testPopulation = [];
  let testBreed;
  let testSuffix;
  let usernameSuffix;

  // Equoria-emkv6: FK-ordered, fail-loud cleanup (replaces the three silent
  // no-op catch arms this suite carried on the Equoria-1ohys ratchet). Horse.userId
  // is onDelete: Restrict, so horses MUST be deleted BEFORE their owning user or
  // the user delete throws a FK violation. createCleanupTracker runs every
  // registered task and throws loudly if any fail, so a leaked fixture in the
  // canonical DB (CLAUDE.md §2) surfaces as a red suite instead of a swallowed
  // warning.
  const suiteCleanup = createCleanupTracker();

  // Per-iteration horse cleanup: scoped to the test user's horses. Used by
  // beforeEach/afterEach to reset the per-test horse fixtures. Throws on failure
  // (no silent catch) so a delete failure is visible.
  const cleanupUserHorses = async userId => {
    if (!userId) {
      return;
    }
    await prisma.horse.deleteMany({ where: { userId } });
  };

  beforeAll(async () => {
    // Include PID + a random segment so parallel Jest workers cannot produce
    // the same usernameSuffix/email — Date.now() alone collides when two
    // worker processes spin up in the same millisecond, which was the source
    // of "parallel isolation" flakes.
    const workerId = process.env.JEST_WORKER_ID || String(process.pid);
    const random = Math.random().toString(36).slice(2, 8);
    testSuffix = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${workerId}_${random}`;
    usernameSuffix = testSuffix.replace(/[^a-zA-Z0-9]/g, '').slice(-16);

    // Create test user using helper function for more reliable authentication
    const { user, token } = await createTestUser({
      username: `geneticsTestUser_${usernameSuffix}`,
      firstName: 'Genetics',
      lastName: 'TestUser',
      email: `genetics+${testSuffix}@test.com`,
      password: 'TestPassword123!',
    });

    testUser = user;
    authToken = token;

    // Verify token was created successfully
    if (!authToken) {
      throw new Error('Failed to generate authentication token in beforeAll');
    }

    // Equoria-emkv6: fetch CSRF AFTER the user/token exist, forwarding the JWT
    // as an accessToken cookie so the issued token binds to testUser.id.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // FK order: horses first, then user. Registered in this order; the tracker
    // runs them sequentially in afterAll.
    suiteCleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUser?.id } }), 'horses-for-testUser');
    suiteCleanup.add(() => {
      if (!testUser?.id) {
        return undefined;
      }
      return prisma.user.deleteMany({ where: { id: testUser.id } });
    }, 'testUser');

    await cleanupUserHorses(testUser?.id);

    // Find a canonical breed by name; fall back to upsert if not yet seeded in this DB
    testBreed = await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } });
    if (!testBreed) {
      testBreed = await prisma.breed.create({
        data: {
          name: 'Thoroughbred',
          description: 'Test breed for genetics API tests',
        },
      });
    }
  });

  beforeEach(async () => {
    await cleanupUserHorses(testUser?.id);
    // Create test horses for genetic analysis. POST /api/v1/horses runs the real
    // createHorse() path, which auto-generates a valid colorGenotype + phenotype —
    // the enhanced genetic-probability service needs those to compute correctly
    // (a raw prisma.horse.create would leave phenotype NULL).
    const stallionResponse = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: 'Genetic Test Stallion',
        breedId: testBreed.id,
        sex: 'stallion',
        age: 5,
      });

    // Check if the response contains the data
    if (!stallionResponse.body.data) {
      throw new Error(
        `Stallion creation failed. Status: ${stallionResponse.status}, Body: ${JSON.stringify(stallionResponse.body)}`,
      );
    }
    testStallion = stallionResponse.body.data;

    const mareResponse = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: 'Genetic Test Mare',
        breedId: testBreed.id,
        sex: 'mare',
        age: 4,
      });

    // Check if the response contains the data
    if (!mareResponse.body.data) {
      throw new Error(
        `Mare creation failed. Status: ${mareResponse.status}, Body: ${JSON.stringify(mareResponse.body)}`,
      );
    }
    testMare = mareResponse.body.data;

    // Create additional horses for population analysis
    const additionalHorses = await Promise.all([
      request(app)
        .post('/api/v1/horses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: 'Population Horse 1',
          breedId: testBreed.id,
          sex: 'stallion',
          age: 6,
        }),
      request(app)
        .post('/api/v1/horses')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: 'Population Horse 2',
          breedId: testBreed.id,
          sex: 'mare',
          age: 7,
        }),
    ]);

    testPopulation = [testStallion, testMare, ...additionalHorses.map(r => r.body.data)];
  });

  afterEach(async () => {
    await cleanupUserHorses(testUser?.id);
    testPopulation = [];
  });

  afterAll(async () => {
    // FK-ordered, fail-loud cleanup (horses → user). Throws if any task fails so
    // leaked fixtures in the canonical DB surface as a red suite (CLAUDE.md §2).
    await suiteCleanup.run();
    // Disconnect Prisma to prevent open handles
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  describe('🎯 Enhanced Genetic Probability API', () => {
    test('POST /api/v1/breeding/genetic-probability should calculate breeding probabilities', async () => {
      const response = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
          includeLineage: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('statProbabilities');
      expect(response.body.data).toHaveProperty('traitProbabilities');
      expect(response.body.data).toHaveProperty('compatibilityAnalysis');
      expect(response.body.data).toHaveProperty('lineageAnalysis');

      // Verify stat probabilities structure
      expect(response.body.data.statProbabilities).toHaveProperty('speed');
      expect(response.body.data.statProbabilities.speed).toHaveProperty('expectedRange');
      expect(response.body.data.statProbabilities.speed).toHaveProperty('distribution');

      // Verify compatibility analysis
      expect(response.body.data.compatibilityAnalysis).toHaveProperty('overallScore');
      expect(response.body.data.compatibilityAnalysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.compatibilityAnalysis.overallScore).toBeLessThanOrEqual(100);
    });

    test('POST /api/v1/breeding/genetic-probability should handle invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          stallionId: 99999,
          mareId: testMare.id,
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /api/v1/breeding/genetic-probability should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Origin', 'http://localhost:3000')
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('🌳 Advanced Lineage Analysis API', () => {
    test('GET /api/v1/breeding/lineage-analysis/:stallionId/:mareId should generate lineage tree', async () => {
      const response = await request(app)
        .get(`/api/v1/breeding/lineage-analysis/${testStallion.id}/${testMare.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .query({ generations: 3 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('lineageTree');
      expect(response.body.data).toHaveProperty('diversityMetrics');
      expect(response.body.data).toHaveProperty('performanceAnalysis');
      expect(response.body.data).toHaveProperty('visualizationData');

      // Verify lineage tree structure
      expect(response.body.data.lineageTree).toHaveProperty('root');
      expect(response.body.data.lineageTree).toHaveProperty('generations');
      expect(response.body.data.lineageTree).toHaveProperty('totalHorses');

      // Verify visualization data
      expect(response.body.data.visualizationData).toHaveProperty('nodes');
      expect(response.body.data.visualizationData).toHaveProperty('edges');
      expect(response.body.data.visualizationData).toHaveProperty('layout');
    });

    test('GET /api/v1/breeding/lineage-analysis should handle missing horses gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/breeding/lineage-analysis/99999/99998')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    });

    test('POST /api/v1/breeding/breeding-recommendations should generate comprehensive recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/breeding/breeding-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('compatibility');
      expect(response.body.data).toHaveProperty('strengths');
      expect(response.body.data).toHaveProperty('risks');
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('expectedOutcomes');

      // Verify compatibility structure
      expect(response.body.data.compatibility).toHaveProperty('score');
      expect(response.body.data.compatibility).toHaveProperty('factors');
      expect(typeof response.body.data.compatibility.score).toBe('number');

      // Verify suggestions are actionable
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });
  });

  describe('📊 Genetic Diversity Tracking API', () => {
    test('POST /api/v1/genetics/population-analysis should analyze population genetics', async () => {
      const horseIds = testPopulation.map(h => h.id);

      const response = await request(app)
        .post('/api/v1/genetics/population-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('diversityMetrics');
      expect(response.body.data).toHaveProperty('populationHealth');
      expect(response.body.data).toHaveProperty('geneticTrends');
      expect(response.body.data).toHaveProperty('breedingRecommendations');

      // Verify diversity metrics
      expect(response.body.data.diversityMetrics).toHaveProperty('shannonIndex');
      expect(response.body.data.diversityMetrics).toHaveProperty('diversityScore');
      expect(response.body.data.diversityMetrics.diversityScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.diversityMetrics.diversityScore).toBeLessThanOrEqual(100);

      // Verify population health
      expect(response.body.data.populationHealth).toHaveProperty('overallHealth');
      expect(response.body.data.populationHealth.overallHealth).toHaveProperty('score');
      expect(response.body.data.populationHealth.overallHealth).toHaveProperty('grade');
    });

    test('POST /api/v1/genetics/inbreeding-analysis should calculate detailed inbreeding', async () => {
      const response = await request(app)
        .post('/api/v1/genetics/inbreeding-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('coefficient');
      expect(response.body.data).toHaveProperty('commonAncestors');
      expect(response.body.data).toHaveProperty('pathAnalysis');
      expect(response.body.data).toHaveProperty('riskAssessment');
      expect(response.body.data).toHaveProperty('recommendations');

      // Verify coefficient is valid
      expect(response.body.data.coefficient).toBeGreaterThanOrEqual(0);
      expect(response.body.data.coefficient).toBeLessThanOrEqual(1);

      // Verify risk assessment
      expect(response.body.data.riskAssessment).toHaveProperty('level');
      expect(['low', 'medium', 'high', 'critical']).toContain(response.body.data.riskAssessment.level);
    });

    test('GET /api/v1/genetics/diversity-report/:userId should generate comprehensive report', async () => {
      const response = await request(app)
        .get(`/api/v1/genetics/diversity-report/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('executiveSummary');
      expect(response.body.data).toHaveProperty('currentStatus');
      expect(response.body.data).toHaveProperty('historicalAnalysis');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('actionPlan');

      // Verify executive summary
      expect(response.body.data.executiveSummary).toHaveProperty('overallHealth');
      expect(response.body.data.executiveSummary).toHaveProperty('keyFindings');
      expect(Array.isArray(response.body.data.executiveSummary.keyFindings)).toBe(true);

      // Verify action plan
      expect(response.body.data.actionPlan).toHaveProperty('immediate');
      expect(response.body.data.actionPlan).toHaveProperty('shortTerm');
      expect(response.body.data.actionPlan).toHaveProperty('longTerm');
    });

    test('GET /api/v1/genetics/population-health/:userId returns population health for the owner', async () => {
      // Equoria-n12y1: NO test exercised population-health before this — that
      // absence is exactly why the Equoria-86nbb bug (isInt+parseInt validation
      // that rejected ALL UUID users) shipped undetected. The owner request
      // below would have failed under that bug: isInt({min:1}) on a UUID string
      // → validateRequest 400 (never reaching the handler), so this 200 +
      // real-shape assertion is part of the regression lock.
      const response = await request(app)
        .get(`/api/v1/genetics/population-health/${testUser.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      // Real response shape = trackPopulationGeneticHealth() return value
      // (backend/modules/breeding/services/genetics/populationHealth.mjs).
      const { data } = response.body;
      expect(data).toHaveProperty('overallHealth');
      expect(data).toHaveProperty('diversityTrends');
      expect(data).toHaveProperty('inbreedingLevels');
      expect(data).toHaveProperty('geneticBottlenecks');
      expect(data).toHaveProperty('recommendations');

      // overallHealth = { score, grade, components: { diversity, effectiveSize, inbreeding } }
      expect(data.overallHealth).toHaveProperty('score');
      expect(typeof data.overallHealth.score).toBe('number');
      expect(data.overallHealth.score).toBeGreaterThanOrEqual(0);
      expect(data.overallHealth.score).toBeLessThanOrEqual(100);
      expect(data.overallHealth).toHaveProperty('grade');
      expect(['A', 'B', 'C', 'D', 'F']).toContain(data.overallHealth.grade);
      expect(data.overallHealth).toHaveProperty('components');
      expect(data.overallHealth.components).toHaveProperty('diversity');
      expect(data.overallHealth.components).toHaveProperty('effectiveSize');
      expect(data.overallHealth.components).toHaveProperty('inbreeding');

      // diversityTrends = { current, trend, effectiveSize }
      expect(data.diversityTrends).toHaveProperty('current');
      expect(data.diversityTrends).toHaveProperty('trend');
      expect(data.diversityTrends).toHaveProperty('effectiveSize');

      // inbreedingLevels = { averageCoefficient, inbredPercentage, distribution, riskLevel }
      expect(data.inbreedingLevels).toHaveProperty('averageCoefficient');
      expect(data.inbreedingLevels).toHaveProperty('inbredPercentage');
      expect(data.inbreedingLevels).toHaveProperty('distribution');

      // Arrays for bottlenecks + recommendations
      expect(Array.isArray(data.geneticBottlenecks)).toBe(true);
      expect(Array.isArray(data.recommendations)).toBe(true);
    });

    test('GET /api/v1/genetics/population-health/:userId denies a different non-admin user with 403', async () => {
      // SENTINEL-POSITIVE (Equoria-n12y1): under the pre-86nbb bug, the route
      // validated :userId as isInt({min:1}) and then compared parseInt(userId)
      // (NaN) against req.user.id — so EVERY non-admin caller got a 400 (UUID
      // fails isInt) instead of reaching this ownership branch. With the fix
      // (isUUID + direct String compare), a non-owner correctly hits the 403
      // ownership denial. This test fails on the old code and passes on the new
      // code, locking the fix in.
      //
      // Equoria-n12y1: create the second non-admin user via the SAME helper the
      // suite uses for its main user — it returns a real token directly
      // (cookie-extraction from a login response was returning null here).
      const { user: otherUser, token: otherToken } = await createTestUser({
        username: `popHealthOther_${usernameSuffix}`,
        firstName: 'PopHealth',
        lastName: 'Other',
        email: `pophealth+${testSuffix}@test.com`,
        password: 'TestPassword123!',
      });
      expect(otherToken).toBeTruthy();

      // FK-ordered, fail-loud cleanup (horses → user) for the second user so it
      // does not leak in the canonical DB (CLAUDE.md §2).
      suiteCleanup.add(() => prisma.horse.deleteMany({ where: { userId: otherUser.id } }), 'horses-for-popHealthOther');
      suiteCleanup.add(() => prisma.user.deleteMany({ where: { id: otherUser.id } }), 'popHealthOther');

      // The other user requests testUser's :userId. GET has no CSRF requirement;
      // Bearer auth is sufficient. The fix routes this to the ownership branch,
      // which returns 403 because userId !== requestingUserId and role !== admin.
      const response = await request(app)
        .get(`/api/v1/genetics/population-health/${testUser.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    });

    test('GET /api/v1/genetics/population-health/:userId requires authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/genetics/population-health/${testUser.id}`)
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(401);
    });

    test('POST /api/v1/genetics/optimal-breeding should recommend optimal breeding pairs', async () => {
      const horseIds = testPopulation.map(h => h.id);

      const response = await request(app)
        .post('/api/v1/genetics/optimal-breeding')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('optimalPairs');
      expect(response.body.data).toHaveProperty('avoidPairs');
      expect(response.body.data).toHaveProperty('priorityBreedings');
      expect(response.body.data).toHaveProperty('diversityGoals');

      // Verify optimal pairs structure
      expect(Array.isArray(response.body.data.optimalPairs)).toBe(true);
      if (response.body.data.optimalPairs.length > 0) {
        const pair = response.body.data.optimalPairs[0];
        expect(pair).toHaveProperty('stallionId');
        expect(pair).toHaveProperty('mareId');
        expect(pair).toHaveProperty('compatibilityScore');
        expect(pair.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(pair.compatibilityScore).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('🔒 API Security and Validation', () => {
    test('All genetic endpoints should require authentication', async () => {
      const endpoints = [
        { method: 'post', path: '/api/v1/breeding/genetic-probability' },
        { method: 'get', path: `/api/v1/breeding/lineage-analysis/${testStallion.id}/${testMare.id}` },
        { method: 'post', path: '/api/v1/breeding/breeding-recommendations' },
        { method: 'post', path: '/api/v1/genetics/population-analysis' },
        { method: 'post', path: '/api/v1/genetics/inbreeding-analysis' },
        { method: 'get', path: `/api/v1/genetics/diversity-report/${testUser.id}` },
        { method: 'post', path: '/api/v1/genetics/optimal-breeding' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
      }
    });

    test('Genetic endpoints should validate input parameters', async () => {
      // Test missing required parameters
      const response1 = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({});

      expect(response1.status).toBe(400);

      // Test invalid horse IDs
      const response2 = await request(app)
        .post('/api/v1/genetics/inbreeding-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          stallionId: 'invalid',
          mareId: 'invalid',
        });

      expect(response2.status).toBe(400);

      // Test empty horse arrays
      const response3 = await request(app)
        .post('/api/v1/genetics/population-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ horseIds: [] });

      expect(response3.status).toBe(400);
    });

    test('Genetic endpoints should handle ownership validation', async () => {
      // Create another user via the real register/login flow. The register call
      // is a public POST; it needs a CSRF token. The login response sets an
      // accessToken cookie we extract below.
      const otherUserResponse = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          username: `otherUser_${usernameSuffix}`,
          email: `other+${testSuffix}@test.com`,
          password: 'TestPassword123!',
          firstName: 'Other',
          lastName: 'User',
          // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
          dateOfBirth: '1990-01-01',
        });

      // FK order: register may have created a user + starter horse. Register a
      // fail-loud cleanup (horses → user) for the other user so it does not leak.
      const otherUserId = otherUserResponse.body.data?.user?.id;
      if (otherUserId) {
        suiteCleanup.add(() => prisma.horse.deleteMany({ where: { userId: otherUserId } }), 'horses-for-otherUser');
        suiteCleanup.add(() => prisma.user.deleteMany({ where: { id: otherUserId } }), 'otherUser');
      }

      const otherLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          email: `other+${testSuffix}@test.com`,
          password: 'TestPassword123!',
        });

      // Extract token from httpOnly cookie
      const extractCookie = (cookies, name) => {
        if (!cookies || !Array.isArray(cookies)) {
          return null;
        }
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        if (!cookie) {
          return null;
        }
        const match = cookie.match(new RegExp(`${name}=([^;]+)`));
        return match ? match[1] : null;
      };

      const otherToken = extractCookie(otherLoginResponse.headers['set-cookie'], 'accessToken');

      // Try to access genetic analysis with horses not owned by the other user.
      // The other user has their own session — fetch a CSRF token bound to THEIR
      // user.id (per-user CSRF, Equoria-plw0h) so the request passes the CSRF
      // gate and the 403 we assert is the OWNERSHIP denial, not a CSRF mismatch.
      const otherCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${otherToken}`] });
      const response = await request(app)
        .post('/api/v1/breeding/genetic-probability')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('Cookie', otherCsrf.cookieHeader)
        .set('X-CSRF-Token', otherCsrf.csrfToken)
        .send({
          stallionId: testStallion.id,
          mareId: testMare.id,
        });

      // The batch-ownership check maps "not yours / doesn't exist" → 404 (CWE-639:
      // an attacker cannot distinguish foreign from missing). The test user's
      // horses are not owned by otherUser, so the lookup returns null → 404.
      expect(response.status).toBe(404);
    });
  });
});
