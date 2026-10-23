/**
 * Advanced Epigenetic API Routes Tests
 *
 * Tests API endpoints for environmental triggers and trait interactions. The developmental
 * window, forecast and opportunity endpoints are gone (owner ruling 2026-10-07, Equoria-huuaf).
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Equoria-4bs3s — versioned API surface: the unversioned `/api/*` mounts were
 * removed; `/api/v1/*` is the canonical surface (backend/app.mjs). Every
 * request below targets `/api/v1/...` — the old `/api/horses/...` paths 404
 * by design.
 *
 * Equoria-plw0h — per-user CSRF binding: csrfProtection derives the
 * sessionIdentifier from req.user.id on authenticated requests, so an
 * anonymous CSRF token (issued under the CSRF_SESSION_SALT fallback)
 * correctly 403s on an authenticated mutation. Every mutation below uses a
 * CSRF token fetched AFTER the fixture user's JWT exists, with that JWT
 * forwarded as an accessToken cookie on the token GET (fetchCsrf
 * extraCookies) so issuance binds to the acting identity. The mutations
 * send the SAME JWT as both the accessToken cookie (rides in
 * csrf.cookieHeader) and the Authorization: Bearer header, so whichever
 * source authenticateToken picks, the resolved identity — and therefore the
 * CSRF sessionIdentifier — is identical.
 *
 * CRITICAL SAFETY (CLAUDE.md §2): every fixture row's id is tracked the
 * moment it is created and cleanup is FAIL-LOUD (createCleanupTracker — a
 * failed delete throws in afterAll instead of leaking silently) and
 * FK-ORDERED (children before parents: groomInteractions → groomAssignments
 * → grooms → horses → users). Every delete is strictly id-scoped
 * (where: { id: { in: trackedIds } }) — never a broad deleteMany.
 *
 * Business Rules Tested:
 * - Environmental trigger analysis API endpoints with authentication
 * - Trait interaction matrix API endpoints with proper data formatting
 * - Authentication and authorization for all advanced epigenetic endpoints
 * - Input validation and error handling for complex epigenetic data
 * - Response formatting and data consistency across endpoints
 * - Integration with existing horse and groom management systems
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Advanced Epigenetic API Routes', () => {
  const cleanup = createCleanupTracker();

  // Per-model fixture id ledgers. Every create below pushes its id
  // IMMEDIATELY so a mid-setup failure still leaves a complete ledger for
  // the FK-ordered afterAll cleanup.
  const ids = {
    users: [],
    horses: [],
    grooms: [],
    interactions: [],
  };

  let __csrf__;
  let testUser;
  let testHorses = [];
  let testGrooms = [];
  let authToken;

  beforeAll(async () => {
    // FK-ordered, id-scoped, fail-loud cleanup. Registration order = run
    // order (children before parents).
    cleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { id: { in: ids.interactions } } }),
      'groomInteractions',
    );
    cleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { groomId: { in: ids.grooms } } }),
      'groomAssignments',
    );
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.grooms } } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horses } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.users } } }), 'users');

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `adv_epi_api_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `adv_epi_api_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
        password: 'testHash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });
    ids.users.push(testUser.id);

    // Generate auth token
    authToken = jwt.sign({ id: testUser.id, username: testUser.username }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Equoria-plw0h: CSRF token bound to the acting identity — fetched AFTER
    // the fixture JWT exists, forwarding it as an accessToken cookie so
    // issuance binds to testUser.id (an anonymous token correctly 403s).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Create test grooms
    const groom = await prisma.groom.create({
      data: {
        name: `Test Groom Calm ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        skillLevel: 'expert',
        speciality: 'foalCare',
        userId: testUser.id,
        sessionRate: 40.0,
        experience: 200,
        level: 10,
      },
    });
    ids.grooms.push(groom.id);
    testGrooms = [groom];

    // Create test horses at different developmental stages
    const now = new Date();
    const oneWeekAgo = gameCalendarDate(now, -7);
    const oneMonthAgo = gameCalendarDate(now, -30);

    // Young foal for developmental windows
    const youngFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Foal API ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'filly',
        dateOfBirth: oneWeekAgo,
        userId: testUser.id,
        bondScore: 20,
        stressLevel: 4,
        epigeneticFlags: ['curious', 'developing'],
      },
    });
    ids.horses.push(youngFoal.id);
    // Older foal with traits for interactions
    const olderFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Horse API ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'colt',
        dateOfBirth: oneMonthAgo,
        userId: testUser.id,
        bondScore: 35,
        stressLevel: 3,
        epigeneticFlags: ['confident', 'brave', 'social'],
      },
    });
    ids.horses.push(olderFoal.id);
    testHorses = [youngFoal, olderFoal];

    // Create some interactions for environmental analysis
    const interactionA = await prisma.groomInteraction.create({
      data: {
        groomId: testGrooms[0].id,
        foalId: testHorses[0].id,
        interactionType: 'enrichment',
        duration: 30,
        taskType: 'trust_building',
        bondingChange: 2,
        stressChange: 1,
        quality: 'good',
        cost: 40.0,
      },
    });
    ids.interactions.push(interactionA.id);
    const interactionB = await prisma.groomInteraction.create({
      data: {
        groomId: testGrooms[0].id,
        foalId: testHorses[1].id,
        interactionType: 'enrichment',
        duration: 45,
        taskType: 'showground_exposure',
        bondingChange: 3,
        stressChange: -1,
        quality: 'excellent',
        cost: 40.0,
      },
    });
    ids.interactions.push(interactionB.id);
  });

  afterAll(() => cleanup.run(), 120000);

  describe('Environmental Trigger Endpoints', () => {
    test('GET /api/v1/horses/:id/environmental-analysis should return environmental trigger analysis', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[0].id}/environmental-analysis`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[0].id);
      expect(response.body.data.environmentalTriggers).toBeDefined();
      expect(response.body.data.triggerThresholds).toBeDefined();
      expect(response.body.data.traitExpressionProbabilities).toBeDefined();
      expect(Array.isArray(response.body.data.traitExpressionProbabilities)).toBe(true);
    });

    test('should require authentication for environmental endpoints', async () => {
      await request(app)
        .get(`/api/v1/horses/${testHorses[0].id}/environmental-analysis`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });

    test('should validate horse ownership for environmental endpoints', async () => {
      // Create another user's horse — ids tracked immediately so the
      // FK-ordered afterAll cleanup removes them even if an assertion below
      // fails before this test's end.
      const otherUser = await prisma.user.create({
        data: {
          username: `other_user_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          email: `other_user_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
          password: 'testHash',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });
      ids.users.push(otherUser.id);

      const otherHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `Other Horse ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          sex: 'colt',
          dateOfBirth: new Date(),
          userId: otherUser.id,
          bondScore: 15,
          stressLevel: 5,
        },
      });
      ids.horses.push(otherHorse.id);

      await request(app)
        .get(`/api/v1/horses/${otherHorse.id}/environmental-analysis`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Trait Interaction Endpoints', () => {
    test('GET /api/v1/horses/:id/trait-interactions should return trait interaction analysis', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/trait-interactions`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[1].id);
      expect(response.body.data.traitInteractions).toBeDefined();
      expect(response.body.data.synergies).toBeDefined();
      expect(response.body.data.conflicts).toBeDefined();
      expect(response.body.data.dominance).toBeDefined();
    });

    test('GET /api/v1/horses/:id/trait-matrix should return complete interaction matrix', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/trait-matrix`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.matrixVisualization).toBeDefined();
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.summary.totalTraits).toBeDefined();
      expect(response.body.data.summary.synergyCount).toBeDefined();
      expect(response.body.data.summary.conflictCount).toBeDefined();
    });

    test('GET /api/v1/horses/:id/trait-stability should return interaction stability analysis', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/trait-stability`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.overallStability).toBeDefined();
      expect(response.body.data.stabilityFactors).toBeDefined();
      expect(response.body.data.volatilityRisks).toBeDefined();
      // Owner ruling 2026-10-07 (no advice or recommendations; Equoria-5nxw0).
      expect(response.body.data.recommendations).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    test('should handle non-existent horse IDs', async () => {
      await request(app)
        .get('/api/v1/horses/99999/environmental-analysis')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
