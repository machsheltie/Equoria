/**
 * Groom Performance System Integration Tests
 *
 * Tests the groom performance tracking and reputation system
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import {
  recordGroomPerformance,
  getGroomPerformanceSummary,
  getTopPerformingGrooms,
  PERFORMANCE_CONFIG,
} from '../../services/groomPerformanceService.mjs';

describe('Groom Performance System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  let authToken;

  beforeAll(async () => {
    // Clean up any existing test data first
    await prisma.groomPerformanceRecord.deleteMany({
      where: {
        OR: [
          { user: { username: { startsWith: 'performanceTestUser' } } },
          { user: { email: { startsWith: 'performance@test' } } },
        ],
      },
    });
    await prisma.groomMetrics.deleteMany({
      where: {
        groom: {
          user: {
            username: { startsWith: 'performanceTestUser' },
          },
        },
      },
    });
    await prisma.groom.deleteMany({
      where: {
        user: {
          username: { startsWith: 'performanceTestUser' },
        },
      },
    });
    await prisma.horse.deleteMany({
      where: {
        user: {
          username: { startsWith: 'performanceTestUser' },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        username: { startsWith: 'performanceTestUser' },
      },
    });

    // Create test user
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `performanceTestUser_${timestamp}`,
        email: `performance_${timestamp}@test.com`,
        password: 'hashedPassword',
        firstName: 'Performance',
        lastName: 'Test',
        money: 1000,
      },
    });

    authToken = generateTestToken({ id: testUser.id });

    // Create test horse with minimal required fields
    testHorse = await prisma.horse.create({
      data: {
        name: 'Performance Test Horse',
        userId: testUser.id ,
        dateOfBirth: new Date('2019-01-01'),
        age: 5,
        sex: 'male',
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Performance Test Groom',
        skillLevel: 'expert',
        speciality: 'general',
        personality: 'gentle',
        experience: 50,
        userId: testUser.id ,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.groomPerformanceRecord.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.groomMetrics.deleteMany({
      where: { groomId: testGroom.id },
    });
    await prisma.groom.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.horse.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('Performance Recording', () => {
    it('should record groom performance successfully', async () => {
      const performanceData = {
        horseId: testHorse.id,
        bondGain: 5.0,
        taskSuccess: true,
        wellbeingImpact: 2.5,
        duration: 30,
        playerRating: 4,
      };

      const record = await recordGroomPerformance(testGroom.id, testUser.id, 'grooming', performanceData);

      expect(record).toBeDefined();
      expect(record.groomId).toBe(testGroom.id);
      expect(record.userId).toBe(testUser.id);
      expect(record.interactionType).toBe('grooming');
      expect(record.bondGain).toBe(5.0);
      expect(record.taskSuccess).toBe(true);
      expect(record.wellbeingImpact).toBe(2.5);
      expect(record.duration).toBe(30);
      expect(record.playerRating).toBe(4);
    });

    it('should update groom metrics after recording performance', async () => {
      // Record multiple performances
      const performances = [
        { bondGain: 4.0, taskSuccess: true, wellbeingImpact: 2.0, duration: 25 },
        { bondGain: 6.0, taskSuccess: true, wellbeingImpact: 3.0, duration: 35 },
        { bondGain: 3.0, taskSuccess: false, wellbeingImpact: 1.0, duration: 20 },
      ];

      for (const perf of performances) {
        await recordGroomPerformance(testGroom.id, testUser.id, 'training', perf);
      }

      // Check that metrics were updated
      const metrics = await prisma.groomMetrics.findUnique({
        where: { groomId: testGroom.id },
      });

      expect(metrics).toBeDefined();
      expect(metrics.totalInteractions).toBeGreaterThan(0);
      expect(metrics.reputationScore).toBeGreaterThan(0);
      expect(metrics.bondingEffectiveness).toBeGreaterThan(0);
      expect(metrics.taskCompletion).toBeGreaterThan(0);
    });
  });

  describe('API Endpoints', () => {
    it('should record performance via API', async () => {
      const response = await request(app)
        .post('/api/groom-performance/record')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          groomId: testGroom.id,
          horseId: testHorse.id,
          interactionType: 'enrichment',
          bondGain: 4.5,
          taskSuccess: true,
          wellbeingImpact: 2.0,
          duration: 40,
          playerRating: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.interactionType).toBe('enrichment');
    });

    it('should get groom performance summary', async () => {
      const response = await request(app)
        .get(`/api/groom-performance/groom/${testGroom.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('reputationTier');
      expect(response.body.data).toHaveProperty('recentRecords');
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('hasReliableReputation');

      expect(response.body.data.groom.id).toBe(testGroom.id);
      expect(response.body.data.groom.name).toBe('Performance Test Groom');
    });

    it('should get top performing grooms', async () => {
      const response = await request(app)
        .get('/api/groom-performance/top?limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('grooms');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.grooms)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);

      // Check that our test groom is included
      const testGroomInResults = response.body.data.grooms.find(g => g.id === testGroom.id);
      expect(testGroomInResults).toBeDefined();
      expect(testGroomInResults).toHaveProperty('reputationScore');
      expect(testGroomInResults).toHaveProperty('reputationTier');
    });

    it('should get performance configuration', async () => {
      const response = await request(app)
        .get('/api/groom-performance/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reputationRanges');
      expect(response.body.data).toHaveProperty('metricWeights');
      expect(response.body.data).toHaveProperty('minInteractionsForReputation');
      expect(response.body.data).toHaveProperty('excellenceBonusThreshold');

      // Verify configuration values
      expect(response.body.data.minInteractionsForReputation).toBe(PERFORMANCE_CONFIG.MIN_INTERACTIONS_FOR_REPUTATION);
      expect(response.body.data.excellenceBonusThreshold).toBe(PERFORMANCE_CONFIG.EXCELLENCE_BONUS_THRESHOLD);
    });

    it('should get groom analytics', async () => {
      const response = await request(app)
        .get(`/api/groom-performance/analytics/${testGroom.id}?days=30`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data).toHaveProperty('analytics');
      expect(response.body.data).toHaveProperty('records');

      const { analytics } = response.body.data;
      expect(analytics).toHaveProperty('totalInteractions');
      expect(analytics).toHaveProperty('averageBondGain');
      expect(analytics).toHaveProperty('successRate');
      expect(analytics).toHaveProperty('averageWellbeingImpact');
      expect(analytics).toHaveProperty('interactionTypes');
      expect(analytics).toHaveProperty('dailyActivity');
      expect(analytics).toHaveProperty('horsesWorkedWith');
    });

    it('should validate groom ownership', async () => {
      // Create another user's groom
      const otherTimestamp = Date.now();
      const otherUser = await prisma.user.create({
        data: {
          username: `otherPerformanceUser_${otherTimestamp}`,
          email: `otherperformance_${otherTimestamp}@test.com`,
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherGroom = await prisma.groom.create({
        data: {
          name: 'Other User Groom',
          skillLevel: 'novice',
          speciality: 'general',
          personality: 'gentle',
          userId: otherUser.id ,
        },
      });

      const response = await request(app)
        .get(`/api/groom-performance/groom/${otherGroom.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Groom not found');

      // Clean up
      await prisma.groom.delete({ where: { id: otherGroom.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should validate input parameters', async () => {
      // Test invalid groom ID
      const response1 = await request(app)
        .post('/api/groom-performance/record')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          groomId: 'invalid',
          interactionType: 'grooming',
        });

      expect(response1.status).toBe(400);
      expect(response1.body.success).toBe(false);

      // Test invalid bond gain
      const response2 = await request(app)
        .post('/api/groom-performance/record')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          groomId: testGroom.id,
          interactionType: 'grooming',
          bondGain: 15, // Too high
        });

      expect(response2.status).toBe(400);
      expect(response2.body.success).toBe(false);

      // Test invalid player rating
      const response3 = await request(app)
        .post('/api/groom-performance/record')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          groomId: testGroom.id,
          interactionType: 'grooming',
          playerRating: 6, // Too high (max is 5)
        });

      expect(response3.status).toBe(400);
      expect(response3.body.success).toBe(false);
    });
  });

  describe('Service Functions', () => {
    it('should calculate performance summary correctly', async () => {
      const summary = await getGroomPerformanceSummary(testGroom.id);

      expect(summary).toHaveProperty('groom');
      expect(summary).toHaveProperty('metrics');
      expect(summary).toHaveProperty('reputationTier');
      expect(summary).toHaveProperty('recentRecords');
      expect(summary).toHaveProperty('trends');
      expect(summary).toHaveProperty('hasReliableReputation');

      expect(summary.groom.id).toBe(testGroom.id);
      expect(summary.reputationTier).toHaveProperty('tier');
      expect(summary.reputationTier).toHaveProperty('label');
      expect(summary.reputationTier).toHaveProperty('color');
    });

    it('should get top performing grooms correctly', async () => {
      const topPerformers = await getTopPerformingGrooms(testUser.id, 3);

      expect(Array.isArray(topPerformers)).toBe(true);
      expect(topPerformers.length).toBeGreaterThan(0);

      const testGroomInResults = topPerformers.find(g => g.id === testGroom.id);
      expect(testGroomInResults).toBeDefined();
      expect(testGroomInResults).toHaveProperty('reputationScore');
      expect(testGroomInResults).toHaveProperty('reputationTier');
      expect(testGroomInResults).toHaveProperty('totalInteractions');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for POST /api/groom-performance/record', async () => {
      const response = await request(app).post('/api/groom-performance/record').set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-performance/groom/:groomId', async () => {
      const response = await request(app)
        .get(`/api/groom-performance/groom/${testGroom.id}`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-performance/top', async () => {
      const response = await request(app).get('/api/groom-performance/top').set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-performance/config', async () => {
      const response = await request(app).get('/api/groom-performance/config').set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-performance/analytics/:groomId', async () => {
      const response = await request(app)
        .get(`/api/groom-performance/analytics/${testGroom.id}`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
