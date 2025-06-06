/**
 * Competition API Endpoints Integration Tests
 * Tests for the new enhanced competition API endpoints:
 * - POST /api/competition/enter
 * - POST /api/competition/execute
 * - GET /api/competition/eligibility/:horseId/:discipline
 * - GET /api/competition/disciplines
 * - GET /api/leaderboard/competition
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  createTestUser,
  createTestHorse,
  createTestShow,
  cleanupTestData,
} from '../helpers/testAuth.mjs';

describe('🚀 INTEGRATION: Competition API Endpoints', () => {
  let testUser;
  let testHorse;
  let testShow;
  let authToken;

  beforeAll(async () => {
    // Create test user
    const userResult = await createTestUser({
      username: 'competitionapi',
      email: 'competitionapi@example.com',
      money: 10000,
      xp: 500,
      level: 5,
    });
    testUser = userResult.user;
    authToken = userResult.token;

    // Create test horse with good stats for competition
    testHorse = await createTestHorse({
      userId: testUser.id,
      name: 'API Test Horse',
      age: 5,
      speed: 80,
      stamina: 75,
      focus: 70,
      precision: 65,
      agility: 70,
      balance: 60,
      healthStatus: 'Excellent',
      epigeneticModifiers: {
        positive: ['fast', 'athletic', 'focused'],
        negative: [],
      },
      disciplineScores: {
        Racing: 100,
        Dressage: 80,
        'Show Jumping': 90,
      },
    });

    // Create test show
    testShow = await createTestShow({
      name: 'API Test Racing Show',
      discipline: 'Racing',
      levelMin: 1,
      levelMax: 10,
      entryFee: 100,
      prize: 1000,
      hostUserId: testUser.id,
      runDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('🎯 GET /api/competition/disciplines', () => {
    test('should return all available disciplines', async () => {
      const response = await request(app).get('/api/competition/disciplines').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.disciplines).toBeInstanceOf(Array);
      expect(response.body.data.disciplines.length).toBeGreaterThanOrEqual(24);
      expect(response.body.data.disciplines).toContain('Racing');
      expect(response.body.data.disciplines).toContain('Dressage');
      expect(response.body.data.disciplines).toContain('Gaited');
      expect(response.body.data.disciplineDetails).toBeInstanceOf(Array);
      expect(response.body.data.total).toBe(response.body.data.disciplines.length);
    });
  });

  describe('🔍 GET /api/competition/eligibility/:horseId/:discipline', () => {
    test('should check horse eligibility for Racing discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Racing`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.horseId).toBe(testHorse.id);
      expect(response.body.data.horseName).toBe(testHorse.name);
      expect(response.body.data.discipline).toBe('Racing');
      expect(response.body.data.eligibility).toHaveProperty('horseLevel');
      expect(response.body.data.eligibility).toHaveProperty('ageEligible');
      expect(response.body.data.eligibility).toHaveProperty('traitEligible');
      expect(response.body.data.eligibility).toHaveProperty('disciplineStats');
      expect(response.body.data.eligibility.ageEligible).toBe(true); // Horse is 5 years old
      expect(response.body.data.eligibility.traitEligible).toBe(true); // Racing doesn't require special traits
    });

    test('should check horse eligibility for Gaited discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Gaited`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.discipline).toBe('Gaited');
      expect(response.body.data.eligibility.traitEligible).toBe(false); // Horse doesn't have 'gaited' trait
      expect(response.body.data.eligibility.requiredTrait).toBe('gaited');
    });

    test('should reject invalid discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/InvalidDiscipline`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid discipline');
      expect(response.body.availableDisciplines).toBeInstanceOf(Array);
    });

    test('should reject unauthorized access', async () => {
      await request(app).get(`/api/competition/eligibility/${testHorse.id}/Racing`).expect(401);
    });

    test('should reject access to horse not owned by user', async () => {
      // Create another user and horse
      const otherUserResult = await createTestUser({
        username: 'otheruser',
        email: 'other@example.com',
      });
      const otherHorse = await createTestHorse({
        userId: otherUserResult.user.id,
        name: 'Other Horse',
      });

      const response = await request(app)
        .get(`/api/competition/eligibility/${otherHorse.id}/Racing`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('You do not own this horse');
    });
  });

  describe('📝 POST /api/competition/enter', () => {
    test('should successfully enter horse in competition', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Horse successfully entered in competition');
      expect(response.body.data.horseId).toBe(testHorse.id);
      expect(response.body.data.showId).toBe(testShow.id);
      expect(response.body.data.entryFee).toBe(testShow.entryFee);
      expect(response.body.data.eligibilityDetails).toHaveProperty('horseLevel');
      expect(response.body.data.eligibilityDetails).toHaveProperty('disciplineScore');

      // Verify entry was created in database
      const entry = await prisma.competitionResult.findFirst({
        where: {
          horseId: testHorse.id,
          showId: testShow.id,
        },
      });
      expect(entry).toBeTruthy();
      expect(entry.placement).toBeNull(); // Not yet executed
    });

    test('should reject duplicate entry', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse is already entered in this competition');
    });

    test('should reject invalid input', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          horseId: 'invalid',
          showId: testShow.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    test('should reject unauthorized access', async () => {
      await request(app)
        .post('/api/competition/enter')
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })
        .expect(401);
    });
  });

  describe('🏁 POST /api/competition/execute', () => {
    test('should successfully execute competition', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          showId: testShow.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Competition executed successfully');
      expect(response.body.data.showId).toBe(testShow.id);
      expect(response.body.data.showName).toBe(testShow.name);
      expect(response.body.data.discipline).toBe(testShow.discipline);
      expect(response.body.data.totalEntries).toBeGreaterThan(0);
      expect(response.body.data.results).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('totalPrizeDistributed');
      expect(response.body.data).toHaveProperty('totalXPAwarded');

      // Verify results don't contain scores (hidden from users)
      response.body.data.results.forEach(result => {
        expect(result).not.toHaveProperty('score');
        expect(result).toHaveProperty('placement');
        expect(result).toHaveProperty('horseName');
        expect(result).toHaveProperty('userName');
      });

      // Verify competition results were updated in database
      const updatedEntry = await prisma.competitionResult.findFirst({
        where: {
          horseId: testHorse.id,
          showId: testShow.id,
        },
      });
      expect(updatedEntry.placement).not.toBeNull(); // Should now have placement
    });

    test('should reject execution by non-host user', async () => {
      // Create another user
      const otherUserResult = await createTestUser({
        username: 'nonhost',
        email: 'nonhost@example.com',
      });

      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${otherUserResult.token}`)
        .send({
          showId: testShow.id,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Only the show host can execute this competition');
    });

    test('should reject invalid show ID', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          showId: 99999,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Show not found');
    });
  });

  describe('🏆 GET /api/leaderboard/competition', () => {
    test('should get competition leaderboard by wins', async () => {
      const response = await request(app)
        .get('/api/leaderboard/competition?metric=wins&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toBeInstanceOf(Array);
      expect(response.body.data.filters.metric).toBe('wins');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('offset');
      expect(response.body.data.pagination).toHaveProperty('hasMore');

      // Check leaderboard entry structure
      if (response.body.data.leaderboard.length > 0) {
        const entry = response.body.data.leaderboard[0];
        expect(entry).toHaveProperty('rank');
        expect(entry).toHaveProperty('horseId');
        expect(entry).toHaveProperty('horseName');
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('userName');
        expect(entry).toHaveProperty('wins');
        expect(entry).toHaveProperty('metric');
        expect(entry).toHaveProperty('value');
      }
    });

    test('should get competition leaderboard by earnings', async () => {
      const response = await request(app)
        .get('/api/leaderboard/competition?metric=earnings&discipline=Racing')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.metric).toBe('earnings');
      expect(response.body.data.filters.discipline).toBe('Racing');
    });

    test('should reject invalid metric', async () => {
      const response = await request(app)
        .get('/api/leaderboard/competition?metric=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject unauthorized access', async () => {
      await request(app).get('/api/leaderboard/competition').expect(401);
    });
  });
});
