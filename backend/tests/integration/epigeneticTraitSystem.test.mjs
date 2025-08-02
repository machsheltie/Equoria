/**
 * Integration tests for the Enhanced Epigenetic Trait System
 *
 * Tests the complete epigenetic trait development pipeline including:
 * - Epigenetic flag evaluation
 * - Enhanced milestone evaluation
 * - Trait history logging
 * - Breeding insights
 * - API endpoints
 */

// Jest is available globally in test environment
import request from 'supertest';
import app from '../../app.mjs';
import { PrismaClient } from '../../../packages/database/node_modules/@prisma/client/index.js';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

describe('Epigenetic Trait System Integration Tests', () => {
  let testUser;
  let testHorse;
  let testGroom;
  let authToken;

  beforeAll(async () => {
    // Clean up any existing test data first
    await prisma.traitHistoryLog.deleteMany({
      where: {
        OR: [
          { horse: { name: { startsWith: 'EpigeneticTest' } } },
          { horse: { ownerId: { startsWith: 'epigenetic_test' } } },
        ],
      },
    });
    await prisma.groomAssignment.deleteMany({
      where: {
        foal: {
          name: { startsWith: 'EpigeneticTest' },
        },
      },
    });
    await prisma.groom.deleteMany({
      where: {
        user: {
          username: { startsWith: 'epigeneticTestUser' },
        },
      },
    });
    await prisma.horse.deleteMany({
      where: {
        name: { startsWith: 'EpigeneticTest' },
      },
    });
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: 'epigeneticTestUser' },
      },
    });

    // Create test user
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `epigeneticTestUser_${timestamp}`,
        email: `epigenetic_${timestamp}@test.com`,
        password: 'hashedPassword',
        firstName: 'Epigenetic',
        lastName: 'Test',
        money: 10000,
      },
    });

    // Create auth token
    authToken = jwt.sign(
      { id: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' },
    );

    // Create test horse (young foal for epigenetic testing)
    const foalBirthDate = new Date();
    foalBirthDate.setDate(foalBirthDate.getDate() - 60); // 60 days old

    testHorse = await prisma.horse.create({
      data: {
        name: 'EpigeneticTest Foal',
        ownerId: testUser.id,
        dateOfBirth: foalBirthDate,
        age: 0,
        sex: 'female',
        temperament: 'calm',
        epigeneticFlags: [], // Start with no flags
      },
    });

    // Create test groom with specific personality
    testGroom = await prisma.groom.create({
      data: {
        name: 'Gentle Test Groom',
        speciality: 'foal_care',
        experience: 15,
        skillLevel: 'expert',
        personality: 'calm',
        groomPersonality: 'gentle',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Assign groom to horse
    await prisma.groomAssignment.create({
      data: {
        foalId: testHorse.id,
        groomId: testGroom.id,
        userId: testUser.id,
        isActive: true,
        priority: 1,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.traitHistoryLog.deleteMany({
      where: { horseId: testHorse.id },
    });
    await prisma.groomAssignment.deleteMany({
      where: { foalId: testHorse.id },
    });
    await prisma.groom.deleteMany({
      where: { id: testGroom.id },
    });
    await prisma.horse.deleteMany({
      where: { id: testHorse.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser.id },
    });

    await prisma.$disconnect();
  });

  describe('API Endpoints', () => {
    test('GET /api/epigenetic-traits/definitions should return flag and personality definitions', async () => {
      const response = await request(app)
        .get('/api/epigenetic-traits/definitions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('epigeneticFlags');
      expect(response.body.data).toHaveProperty('groomPersonalities');
      expect(response.body.data.flagCount).toBeGreaterThan(0);
      expect(response.body.data.personalityCount).toBeGreaterThan(0);

      // Verify specific flags exist
      expect(response.body.data.epigeneticFlags).toHaveProperty('BRAVE');
      expect(response.body.data.epigeneticFlags).toHaveProperty('AFFECTIONATE');
      expect(response.body.data.groomPersonalities).toHaveProperty('GENTLE');
    });

    test('POST /api/epigenetic-traits/evaluate-milestone/:horseId should evaluate enhanced milestone', async () => {
      const response = await request(app)
        .post(`/api/epigenetic-traits/evaluate-milestone/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          milestoneData: {
            ageCategory: 'foal',
            developmentalStage: 'socialization',
          },
          includeHistory: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('currentGroom', testGroom.name);
      expect(response.body.data).toHaveProperty('milestoneResult');
      expect(response.body.data.careHistoryIncluded).toBe(true);
    });

    test('POST /api/epigenetic-traits/log-trait should log trait assignment', async () => {
      const traitData = {
        horseId: testHorse.id,
        traitName: 'Affectionate',
        sourceType: 'groom',
        sourceId: testGroom.id.toString(),
        influenceScore: 3.5,
        isEpigenetic: true,
        groomId: testGroom.id,
        bondScore: 25,
        stressLevel: 2,
      };

      const response = await request(app)
        .post('/api/epigenetic-traits/log-trait')
        .set('Authorization', `Bearer ${authToken}`)
        .send(traitData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.traitName).toBe('Affectionate');
      expect(response.body.data.sourceType).toBe('groom');
      expect(response.body.data.isEpigenetic).toBe(true);
      expect(response.body.data.influenceScore).toBe(3);
    });

    test('GET /api/epigenetic-traits/history/:horseId should return trait history', async () => {
      const response = await request(app)
        .get(`/api/epigenetic-traits/history/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          limit: 10,
          isEpigenetic: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('history');
      expect(Array.isArray(response.body.data.history)).toBe(true);

      // Should have the trait we just logged
      expect(response.body.data.history.length).toBeGreaterThan(0);
      const affectionateTrait = response.body.data.history.find(h => h.traitName === 'Affectionate');
      expect(affectionateTrait).toBeDefined();
      expect(affectionateTrait.isEpigenetic).toBe(true);
    });

    test('GET /api/epigenetic-traits/summary/:horseId should return development summary', async () => {
      const response = await request(app)
        .get(`/api/epigenetic-traits/summary/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('summary');

      const { summary } = response.body.data;
      expect(summary).toHaveProperty('horseId', testHorse.id);
      expect(summary).toHaveProperty('totalTraits');
      expect(summary).toHaveProperty('epigeneticTraits');
      expect(summary).toHaveProperty('groomInfluencedTraits');
      expect(summary).toHaveProperty('developmentalStages');
      expect(summary).toHaveProperty('sourceBreakdown');
      expect(summary).toHaveProperty('groomContributions');
      expect(summary).toHaveProperty('traitTimeline');

      // Verify our logged trait appears in the summary
      expect(summary.totalTraits).toBeGreaterThan(0);
      expect(summary.epigeneticTraits).toBeGreaterThan(0);
      expect(summary.groomInfluencedTraits).toBeGreaterThan(0);
    });

    test('GET /api/epigenetic-traits/breeding-insights/:horseId should return breeding insights', async () => {
      const response = await request(app)
        .get(`/api/epigenetic-traits/breeding-insights/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('insights');

      const { insights } = response.body.data;
      expect(insights).toHaveProperty('horseId', testHorse.id);
      expect(insights).toHaveProperty('epigeneticProfile');
      expect(insights).toHaveProperty('inheritanceRisk');
      expect(insights).toHaveProperty('recommendedCarePatterns');
      expect(insights).toHaveProperty('breedingNotes');

      // Should have our Affectionate trait in the epigenetic profile
      expect(insights.epigeneticProfile).toHaveProperty('Affectionate');
      expect(insights.epigeneticProfile.Affectionate).toHaveProperty('source', 'groom');
    });

    test('Should handle authentication errors properly', async () => {
      await request(app)
        .get(`/api/epigenetic-traits/history/${testHorse.id}`)
        .expect(401);

      await request(app)
        .post(`/api/epigenetic-traits/evaluate-milestone/${testHorse.id}`)
        .expect(401);
    });

    test('Should handle horse ownership validation', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: `otherUser_${Date.now()}`,
          email: `other_${Date.now()}@test.com`,
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });

      const otherToken = jwt.sign(
        { id: otherUser.id, username: otherUser.username },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' },
      );

      // Try to access our horse with other user's token
      await request(app)
        .get(`/api/epigenetic-traits/history/${testHorse.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    test('Should validate input parameters properly', async () => {
      // Invalid horse ID
      await request(app)
        .get('/api/epigenetic-traits/history/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Invalid trait logging data
      await request(app)
        .post('/api/epigenetic-traits/log-trait')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: 'invalid',
          traitName: '',
          sourceType: 'invalid_source',
        })
        .expect(400);
    });
  });

  describe('Epigenetic Flag System', () => {
    test('Should apply epigenetic flags based on care patterns', async () => {
      // Create multiple positive interactions to trigger AFFECTIONATE flag
      for (let i = 0; i < 7; i++) {
        await prisma.groomInteraction.create({
          data: {
            foalId: testHorse.id,
            groomId: testGroom.id,
            interactionType: 'grooming',
            duration: 30,
            bondingChange: 2,
            stressChange: -1,
            quality: 'excellent',
            cost: 25.0,
            timestamp: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Daily for past week
          },
        });
      }

      // Evaluate milestone with care history
      const response = await request(app)
        .post(`/api/epigenetic-traits/evaluate-milestone/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          milestoneData: { ageCategory: 'foal' },
          includeHistory: true,
        })
        .expect(200);

      const { milestoneResult } = response.body.data;
      expect(milestoneResult).toHaveProperty('epigeneticFlags');
      expect(milestoneResult).toHaveProperty('careConsistencyBonus');
      expect(milestoneResult).toHaveProperty('personalityBonuses');

      // Care consistency bonus should be positive due to daily interactions
      expect(milestoneResult.careConsistencyBonus).toBeGreaterThan(1.0);
    });
  });

  describe('Enhanced Milestone Evaluation', () => {
    test('Should factor in groom personality bonuses', async () => {
      const response = await request(app)
        .post(`/api/epigenetic-traits/evaluate-milestone/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          milestoneData: { ageCategory: 'foal' },
          includeHistory: true,
        })
        .expect(200);

      const { milestoneResult } = response.body.data;
      expect(milestoneResult).toHaveProperty('enhancementFactors');
      expect(milestoneResult.enhancementFactors).toHaveProperty('groomPersonality', 'gentle');
      expect(milestoneResult.enhancementFactors).toHaveProperty('careQuality');
      expect(milestoneResult.enhancementFactors).toHaveProperty('bondStability');
    });
  });
});

describe('Trait History Service', () => {
  let testUser, testHorse, testGroom;

  beforeAll(async () => {
    // Create minimal test data for service tests
    testUser = await prisma.user.create({
      data: {
        username: `serviceTestUser_${Date.now()}`,
        email: `service_${Date.now()}@test.com`,
        password: 'hashedPassword',
        firstName: 'Service',
        lastName: 'Test',
        money: 1000,
      },
    });

    testHorse = await prisma.horse.create({
      data: {
        name: 'ServiceTest Horse',
        ownerId: testUser.id,
        dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
        age: 0,
        sex: 'male',
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: 'Service Test Groom',
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'intermediate',
        personality: 'patient',
        groomPersonality: 'patient',
        sessionRate: 20.0,
        userId: testUser.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.traitHistoryLog.deleteMany({ where: { horseId: testHorse.id } });
    await prisma.groom.delete({ where: { id: testGroom.id } });
    await prisma.horse.delete({ where: { id: testHorse.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  test('Should log and retrieve trait assignments correctly', async () => {
    const { logTraitAssignment, getTraitHistory } = await import('../../services/traitHistoryService.mjs');

    // Log a trait assignment
    const traitData = {
      horseId: testHorse.id,
      traitName: 'Confident',
      sourceType: 'milestone',
      sourceId: 'socialization_milestone',
      influenceScore: 2.5,
      isEpigenetic: true,
      groomId: testGroom.id,
      bondScore: 20,
      stressLevel: 3,
    };

    const loggedTrait = await logTraitAssignment(traitData);
    expect(loggedTrait).toHaveProperty('id');
    expect(loggedTrait.traitName).toBe('Confident');
    expect(loggedTrait.isEpigenetic).toBe(true);

    // Retrieve trait history
    const history = await getTraitHistory(testHorse.id);
    expect(history.length).toBeGreaterThan(0);

    const confidentTrait = history.find(h => h.traitName === 'Confident');
    expect(confidentTrait).toBeDefined();
    expect(confidentTrait.sourceType).toBe('milestone');
  });
});
