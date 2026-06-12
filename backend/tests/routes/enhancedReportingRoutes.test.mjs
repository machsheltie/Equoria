/**
 * Enhanced Reporting API Routes Tests
 *
 * Tests enhanced trait history API with advanced epigenetic data and insights.
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
 * FK-ORDERED (children before parents: traitHistoryLogs → groomInteractions
 * → groomAssignments → grooms → horses → users). Every delete is strictly
 * id-scoped (where: { id: { in: trackedIds } }) — never a broad deleteMany.
 *
 * Business Rules Tested:
 * - Enhanced trait history reporting with environmental context
 * - Comprehensive epigenetic insights and analysis reports
 * - Advanced filtering and aggregation capabilities
 * - Multi-horse comparison and analysis features
 * - Trend analysis and predictive insights
 * - Export capabilities for detailed reports
 * - Authentication and authorization for reporting endpoints
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

describe('Enhanced Reporting API Routes', () => {
  const cleanup = createCleanupTracker();

  // Per-model fixture id ledgers. Every create below pushes its id
  // IMMEDIATELY so a mid-setup failure still leaves a complete ledger for
  // the FK-ordered afterAll cleanup.
  const ids = {
    users: [],
    horses: [],
    grooms: [],
    interactions: [],
    traitLogs: [],
  };

  let __csrf__;
  let testUser;
  let testHorses = [];
  let testGrooms = [];
  let authToken;

  beforeAll(async () => {
    // FK-ordered, id-scoped, fail-loud cleanup. Registration order = run
    // order (children before parents).
    cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { id: { in: ids.traitLogs } } }), 'traitHistoryLogs');
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
        username: `enh_report_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `enh_report_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
        password: 'test_hash',
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
        name: `Test Groom Report ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        skillLevel: 'expert',
        speciality: 'foal_care',
        userId: testUser.id,
        sessionRate: 40.0,
        experience: 200,
        level: 10,
      },
    });
    ids.grooms.push(groom.id);
    testGrooms = [groom];

    // Create test horses with different developmental stages and traits
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const horseSpecs = [
      // Young foal with developing traits
      {
        name: `Test Foal Report ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: oneWeekAgo,
        bondScore: 20,
        stressLevel: 4,
        epigeneticFlags: ['curious', 'developing'],
      },
      // Older foal with established traits
      {
        name: `Test Horse Report ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'Colt',
        dateOfBirth: oneMonthAgo,
        bondScore: 35,
        stressLevel: 3,
        epigeneticFlags: ['confident', 'brave', 'social'],
      },
      // Mature foal with complex traits
      {
        name: `Test Mature Report ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'Colt',
        dateOfBirth: twoMonthsAgo,
        bondScore: 40,
        stressLevel: 2,
        epigeneticFlags: ['intelligent', 'calm', 'adaptable', 'social'],
      },
    ];

    testHorses = [];
    for (const spec of horseSpecs) {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          ...spec,
          userId: testUser.id,
        },
      });
      ids.horses.push(horse.id);
      testHorses.push(horse);
    }

    // Create diverse interactions for reporting analysis
    for (let i = 0; i < 3; i++) {
      for (const horse of testHorses) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: i % 2 === 0 ? 'enrichment' : 'grooming',
            duration: 30 + i * 10,
            taskType: ['trust_building', 'showground_exposure', 'desensitization'][i],
            bondingChange: [2, 3, 1][i],
            stressChange: [1, -1, 2][i],
            quality: ['good', 'excellent', 'fair'][i],
            cost: 40.0,
            createdAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
          },
        });
        ids.interactions.push(interaction.id);
      }
    }

    // Create trait history logs for reporting
    for (const horse of testHorses) {
      const ageInDays = Math.floor((now.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
      for (const trait of horse.epigeneticFlags) {
        const log = await prisma.traitHistoryLog.create({
          data: {
            horseId: horse.id,
            traitName: trait,
            sourceType: 'groom_interaction',
            ageInDays,
            timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            isEpigenetic: true,
            influenceScore: 5,
          },
        });
        ids.traitLogs.push(log.id);
      }
    }
  }, 120000); // 120s — 25+ DB creates (user/horses/grooms/interactions/traitLogs) under full-suite load

  afterAll(() => cleanup.run(), 120000);

  describe('Enhanced Trait History Endpoints', () => {
    test('GET /api/v1/horses/:id/enhanced-trait-history should return comprehensive trait history', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/enhanced-trait-history`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[1].id);
      expect(response.body.data.traitHistory).toBeDefined();
      expect(response.body.data.environmentalContext).toBeDefined();
      expect(response.body.data.developmentalTimeline).toBeDefined();
      expect(response.body.data.traitInteractions).toBeDefined();
      expect(response.body.data.insights).toBeDefined();
      expect(Array.isArray(response.body.data.traitHistory)).toBe(true);
      expect(Array.isArray(response.body.data.insights)).toBe(true);
    }, 120000); // 120s — parallelised DB calls can still be slow under full-suite load

    test('GET /api/v1/horses/:id/epigenetic-insights should return advanced epigenetic analysis', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[2].id}/epigenetic-insights`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[2].id);
      expect(response.body.data.traitAnalysis).toBeDefined();
      expect(response.body.data.environmentalInfluences).toBeDefined();
      expect(response.body.data.developmentalProgress).toBeDefined();
      expect(response.body.data.predictiveInsights).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    test('GET /api/v1/horses/:id/trait-timeline should return detailed trait development timeline', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/trait-timeline`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[1].id);
      expect(response.body.data.timeline).toBeDefined();
      expect(response.body.data.milestones).toBeDefined();
      expect(response.body.data.criticalPeriods).toBeDefined();
      expect(response.body.data.environmentalEvents).toBeDefined();
      expect(Array.isArray(response.body.data.timeline)).toBe(true);
      expect(Array.isArray(response.body.data.milestones)).toBe(true);
    });
  });

  describe('Multi-Horse Analysis Endpoints', () => {
    test('GET /api/v1/users/:id/stable-epigenetic-report should return stable-wide epigenetic analysis', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${testUser.id}/stable-epigenetic-report`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.stableOverview).toBeDefined();
      expect(response.body.data.traitDistribution).toBeDefined();
      expect(response.body.data.developmentalStages).toBeDefined();
      expect(response.body.data.environmentalFactors).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    test('POST /api/v1/horses/compare-epigenetics should compare multiple horses', async () => {
      const response = await request(app)
        .post('/api/v1/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseIds: [testHorses[0].id, testHorses[1].id, testHorses[2].id],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.comparison).toBeDefined();
      expect(response.body.data.similarities).toBeDefined();
      expect(response.body.data.differences).toBeDefined();
      expect(response.body.data.rankings).toBeDefined();
      expect(response.body.data.insights).toBeDefined();
      expect(Array.isArray(response.body.data.insights)).toBe(true);
    });

    test('GET /api/v1/horses/trait-trends should return trait development trends', async () => {
      const response = await request(app)
        .get('/api/v1/horses/trait-trends')
        .set('Origin', 'http://localhost:3000')
        .query({ userId: testUser.id, timeframe: 30 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.trends).toBeDefined();
      expect(response.body.data.patterns).toBeDefined();
      expect(response.body.data.predictions).toBeDefined();
      expect(response.body.data.timeframe).toBe(30);
      expect(Array.isArray(response.body.data.trends)).toBe(true);
    });
  });

  describe('Advanced Filtering and Export', () => {
    test('GET /api/v1/horses/:id/enhanced-trait-history with filters should return filtered results', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[1].id}/enhanced-trait-history`)
        .set('Origin', 'http://localhost:3000')
        .query({
          traitType: 'positive',
          discoveryMethod: 'milestone_evaluation',
          dateFrom: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          dateTo: new Date().toISOString(),
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.traitHistory).toBeDefined();
      expect(response.body.data.filters).toBeDefined();
      expect(response.body.data.filters.traitType).toBe('positive');
      expect(response.body.data.filters.discoveryMethod).toBe('milestone_evaluation');
    });

    test('GET /api/v1/horses/:id/epigenetic-report-export should return exportable report data', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testHorses[2].id}/epigenetic-report-export`)
        .set('Origin', 'http://localhost:3000')
        .query({ format: 'detailed' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.reportData).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.format).toBe('detailed');
      expect(response.body.data.generatedAt).toBeDefined();
    });
  });

  describe('Authentication and Validation', () => {
    test('should require authentication for enhanced reporting endpoints', async () => {
      await request(app)
        .get(`/api/v1/horses/${testHorses[0].id}/enhanced-trait-history`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });

    test('should validate horse ownership for reporting endpoints', async () => {
      // Create another user's horse — ids tracked immediately so the
      // FK-ordered afterAll cleanup removes them even if an assertion below
      // fails before this test's end.
      const otherUser = await prisma.user.create({
        data: {
          username: `other_report_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          email: `other_report_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
          password: 'test_hash',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });
      ids.users.push(otherUser.id);

      const otherHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `Other Horse Report ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          sex: 'Colt',
          dateOfBirth: new Date(),
          userId: otherUser.id,
          bondScore: 15,
          stressLevel: 5,
        },
      });
      ids.horses.push(otherHorse.id);

      await request(app)
        .get(`/api/v1/horses/${otherHorse.id}/enhanced-trait-history`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should validate input parameters for comparison endpoint', async () => {
      await request(app)
        .post('/api/v1/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseIds: [], // Empty array should be invalid
        })
        .expect(400);
    });

    test('should handle non-existent horse IDs in reporting', async () => {
      await request(app)
        .get('/api/v1/horses/99999/enhanced-trait-history')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
