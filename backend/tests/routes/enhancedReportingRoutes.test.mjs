/**
 * Enhanced Reporting API Routes Tests
 *
 * Tests enhanced trait history API with advanced epigenetic data and insights.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
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
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('Enhanced Reporting API Routes', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `enh_report_${Date.now()}`,
        email: `enh_report_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, username: testUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Create test grooms
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Test Groom Report ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 40.0,
          experience: 200,
          level: 10,
        },
      }),
    ]);

    // Create test horses with different developmental stages and traits
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Young foal with developing traits
      prisma.horse.create({
        data: {
          name: `Test Foal Report ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneWeekAgo,
          ownerId: testUser.id,
          bondScore: 20,
          stressLevel: 4,
          epigeneticFlags: ['curious', 'developing'],
        },
      }),
      // Older foal with established traits
      prisma.horse.create({
        data: {
          name: `Test Horse Report ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          ownerId: testUser.id,
          bondScore: 35,
          stressLevel: 3,
          epigeneticFlags: ['confident', 'brave', 'social'],
        },
      }),
      // Mature foal with complex traits
      prisma.horse.create({
        data: {
          name: `Test Mature Report ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: twoMonthsAgo,
          ownerId: testUser.id,
          bondScore: 40,
          stressLevel: 2,
          epigeneticFlags: ['intelligent', 'calm', 'adaptable', 'social'],
        },
      }),
    ]);

    // Create diverse interactions for reporting analysis
    const interactions = [];
    for (let i = 0; i < 3; i++) {
      for (const horse of testHorses) {
        interactions.push(
          prisma.groomInteraction.create({
            data: {
              groomId: testGrooms[0].id,
              foalId: horse.id,
              interactionType: i % 2 === 0 ? 'enrichment' : 'grooming',
              duration: 30 + (i * 10),
              taskType: ['trust_building', 'showground_exposure', 'desensitization'][i],
              bondingChange: [2, 3, 1][i],
              stressChange: [1, -1, 2][i],
              quality: ['good', 'excellent', 'fair'][i],
              cost: 40.0,
              createdAt: new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
            },
          }),
        );
      }
    }
    await Promise.all(interactions);

    // Create trait history logs for reporting
    const traitLogs = [];
    for (const horse of testHorses) {
      const ageInDays = Math.floor((now.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
      for (const trait of horse.epigeneticFlags) {
        traitLogs.push(
          prisma.traitHistoryLog.create({
            data: {
              horseId: horse.id,
              traitName: trait,
              sourceType: 'groom_interaction',
              ageInDays,
              timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
              isEpigenetic: true,
              influenceScore: 5,
            },
          }),
        );
      }
    }
    await Promise.all(traitLogs);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.traitHistoryLog.deleteMany({
      where: { horseId: { in: testHorses.map(h => h.id) } },
    });
    await prisma.groomInteraction.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groomAssignment.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groom.deleteMany({
      where: { id: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map(h => h.id) } },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('Enhanced Trait History Endpoints', () => {
    test('GET /api/horses/:id/enhanced-trait-history should return comprehensive trait history', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/enhanced-trait-history`)
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
    });

    test('GET /api/horses/:id/epigenetic-insights should return advanced epigenetic analysis', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[2].id}/epigenetic-insights`)
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

    test('GET /api/horses/:id/trait-timeline should return detailed trait development timeline', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/trait-timeline`)
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
    test('GET /api/users/:id/stable-epigenetic-report should return stable-wide epigenetic analysis', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.id}/stable-epigenetic-report`)
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

    test('POST /api/horses/compare-epigenetics should compare multiple horses', async () => {
      const response = await request(app)
        .post('/api/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${authToken}`)
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

    test('GET /api/horses/trait-trends should return trait development trends', async () => {
      const response = await request(app)
        .get('/api/horses/trait-trends')
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
    test('GET /api/horses/:id/enhanced-trait-history with filters should return filtered results', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/enhanced-trait-history`)
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

    test('GET /api/horses/:id/epigenetic-report-export should return exportable report data', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[2].id}/epigenetic-report-export`)
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
        .get(`/api/horses/${testHorses[0].id}/enhanced-trait-history`)
        .expect(401);
    });

    test('should validate horse ownership for reporting endpoints', async () => {
      // Create another user's horse
      const otherUser = await prisma.user.create({
        data: {
          username: `other_report_${Date.now()}`,
          email: `other_report_${Date.now()}@test.com`,
          password: 'test_hash',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });

      const otherHorse = await prisma.horse.create({
        data: {
          name: `Other Horse Report ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: new Date(),
          ownerId: otherUser.id,
          bondScore: 15,
          stressLevel: 5,
        },
      });

      await request(app)
        .get(`/api/horses/${otherHorse.id}/enhanced-trait-history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Cleanup
      await prisma.horse.delete({ where: { id: otherHorse.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    test('should validate input parameters for comparison endpoint', async () => {
      await request(app)
        .post('/api/horses/compare-epigenetics')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseIds: [], // Empty array should be invalid
        })
        .expect(400);
    });

    test('should handle non-existent horse IDs in reporting', async () => {
      await request(app)
        .get('/api/horses/99999/enhanced-trait-history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
