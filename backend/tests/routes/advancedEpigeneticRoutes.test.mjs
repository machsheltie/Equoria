/**
 * Advanced Epigenetic API Routes Tests
 * 
 * Tests API endpoints for environmental triggers, trait interactions, and developmental windows.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 * 
 * Business Rules Tested:
 * - Environmental trigger analysis API endpoints with authentication
 * - Trait interaction matrix API endpoints with proper data formatting
 * - Developmental window API endpoints with comprehensive forecasting
 * - Authentication and authorization for all advanced epigenetic endpoints
 * - Input validation and error handling for complex epigenetic data
 * - Response formatting and data consistency across endpoints
 * - Integration with existing horse and groom management systems
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

describe('Advanced Epigenetic API Routes', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `adv_epi_api_${Date.now()}`,
        email: `adv_epi_api_${Date.now()}@test.com`,
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
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test grooms
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Test Groom Calm ${Date.now()}`,
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

    // Create test horses at different developmental stages
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Young foal for developmental windows
      prisma.horse.create({
        data: {
          name: `Test Foal API ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneWeekAgo,
          ownerId: testUser.id,
          bondScore: 20,
          stressLevel: 4,
          epigeneticFlags: ['curious', 'developing'],
        },
      }),
      // Older foal with traits for interactions
      prisma.horse.create({
        data: {
          name: `Test Horse API ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          ownerId: testUser.id,
          bondScore: 35,
          stressLevel: 3,
          epigeneticFlags: ['confident', 'brave', 'social'],
        },
      }),
    ]);

    // Create some interactions for environmental analysis
    await Promise.all([
      prisma.groomInteraction.create({
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
      }),
      prisma.groomInteraction.create({
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
      }),
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
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

  describe('Environmental Trigger Endpoints', () => {
    test('GET /api/horses/:id/environmental-analysis should return environmental trigger analysis', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[0].id}/environmental-analysis`)
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

    test('GET /api/horses/:id/environmental-forecast should return environmental forecast', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[0].id}/environmental-forecast`)
        .query({ days: 30 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.horseId).toBe(testHorses[0].id);
      expect(response.body.data.forecastPeriod).toBe(30);
      expect(response.body.data.upcomingWindows).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });

    test('POST /api/horses/:id/evaluate-trait-opportunity should evaluate trait development opportunity', async () => {
      const response = await request(app)
        .post(`/api/horses/${testHorses[0].id}/evaluate-trait-opportunity`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          traitName: 'confident',
          windowName: 'early_socialization'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.traitName).toBe('confident');
      expect(response.body.data.windowName).toBe('early_socialization');
      expect(response.body.data.overallOpportunity).toBeDefined();
      expect(response.body.data.recommendedActions).toBeDefined();
      expect(Array.isArray(response.body.data.recommendedActions)).toBe(true);
    });

    test('should require authentication for environmental endpoints', async () => {
      await request(app)
        .get(`/api/horses/${testHorses[0].id}/environmental-analysis`)
        .expect(401);
    });

    test('should validate horse ownership for environmental endpoints', async () => {
      // Create another user's horse
      const otherUser = await prisma.user.create({
        data: {
          username: `other_user_${Date.now()}`,
          email: `other_user_${Date.now()}@test.com`,
          password: 'test_hash',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });

      const otherHorse = await prisma.horse.create({
        data: {
          name: `Other Horse ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: new Date(),
          ownerId: otherUser.id,
          bondScore: 15,
          stressLevel: 5,
        },
      });

      await request(app)
        .get(`/api/horses/${otherHorse.id}/environmental-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      // Cleanup
      await prisma.horse.delete({ where: { id: otherHorse.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Trait Interaction Endpoints', () => {
    test('GET /api/horses/:id/trait-interactions should return trait interaction analysis', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/trait-interactions`)
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

    test('GET /api/horses/:id/trait-matrix should return complete interaction matrix', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/trait-matrix`)
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

    test('GET /api/horses/:id/trait-stability should return interaction stability analysis', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[1].id}/trait-stability`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.overallStability).toBeDefined();
      expect(response.body.data.stabilityFactors).toBeDefined();
      expect(response.body.data.volatilityRisks).toBeDefined();
      expect(response.body.data.recommendations).toBeDefined();
      expect(Array.isArray(response.body.data.recommendations)).toBe(true);
    });
  });

  describe('Developmental Window Endpoints', () => {
    test('GET /api/horses/:id/developmental-windows should return active and upcoming windows', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[0].id}/developmental-windows`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.activeWindows).toBeDefined();
      expect(response.body.data.upcomingWindows).toBeDefined();
      expect(response.body.data.closedWindows).toBeDefined();
      expect(response.body.data.criticalityScore).toBeDefined();
      expect(Array.isArray(response.body.data.activeWindows)).toBe(true);
    });

    test('GET /api/horses/:id/developmental-forecast should return developmental forecast', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[0].id}/developmental-forecast`)
        .query({ days: 60 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.forecastPeriod).toBe(60);
      expect(response.body.data.upcomingWindows).toBeDefined();
      expect(response.body.data.traitDevelopmentPredictions).toBeDefined();
      expect(response.body.data.milestoneProjections).toBeDefined();
      expect(response.body.data.riskAssessment).toBeDefined();
      expect(Array.isArray(response.body.data.traitDevelopmentPredictions)).toBe(true);
    });

    test('GET /api/horses/:id/critical-period-analysis should return critical period sensitivity', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorses[0].id}/critical-period-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.criticalPeriods).toBeDefined();
      expect(response.body.data.sensitivityProfile).toBeDefined();
      expect(response.body.data.riskFactors).toBeDefined();
      expect(response.body.data.protectiveFactors).toBeDefined();
      expect(response.body.data.interventionRecommendations).toBeDefined();
      expect(Array.isArray(response.body.data.interventionRecommendations)).toBe(true);
    });

    test('POST /api/horses/:id/coordinate-development should coordinate multi-window development', async () => {
      const response = await request(app)
        .post(`/api/horses/${testHorses[0].id}/coordinate-development`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.activeWindows).toBeDefined();
      expect(response.body.data.coordinatedPlan).toBeDefined();
      expect(response.body.data.conflictResolution).toBeDefined();
      expect(Array.isArray(response.body.data.activeWindows)).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should validate trait opportunity evaluation input', async () => {
      await request(app)
        .post(`/api/horses/${testHorses[0].id}/evaluate-trait-opportunity`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          traitName: '', // Invalid empty trait name
          windowName: 'early_socialization'
        })
        .expect(400);
    });

    test('should validate forecast days parameter', async () => {
      await request(app)
        .get(`/api/horses/${testHorses[0].id}/developmental-forecast`)
        .query({ days: -5 }) // Invalid negative days
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    test('should handle non-existent horse IDs', async () => {
      await request(app)
        .get('/api/horses/99999/environmental-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
