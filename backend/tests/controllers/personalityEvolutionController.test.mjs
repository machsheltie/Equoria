/**
 * Personality Evolution Controller API Tests
 *
 * Tests comprehensive personality evolution API endpoints including groom and horse evolution,
 * triggers analysis, stability assessment, prediction capabilities, and batch processing.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Groom personality evolution API with interaction pattern validation
 * - Horse temperament evolution API with care history analysis
 * - Evolution triggers calculation and analysis endpoints
 * - Personality stability assessment API functionality
 * - Evolution prediction capabilities with timeframe parameters
 * - Evolution history retrieval and tracking
 * - Manual evolution effects application (admin functionality)
 * - Batch processing for multiple entities
 * - System configuration endpoint validation
 */

// jest import removed - not used in this file
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Personality Evolution Controller API', () => {
  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate birth date for 2-year-old horse
  const birthDate2YearsOld = new Date(referenceDate);
  birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2); // 2023-06-01 (age 2)

  let testUser;
  let testGroom;
  let testHorse;
  let testBreed;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `personality_evolution_api_${Date.now()}`,
        email: `personality_evolution_api_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Generate auth token
    authToken = generateTestToken({ id: testUser.id, email: testUser.email });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Test Breed API',
        description: 'Test breed for personality evolution API testing',
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        userId: testUser.id ,
        name: 'API Test Groom',
        speciality: 'foal_care',
        personality: 'calm',
        groomPersonality: 'calm',
        skillLevel: 'intermediate',
        experience: 100,
        level: 5,
        sessionRate: 25.0,
        isActive: true,
      },
    });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        userId: testUser.id ,
        breedId: testBreed.id ,
        name: 'API Test Horse',
        sex: 'Filly',
        dateOfBirth: birthDate2YearsOld,
        age: 2,
        temperament: 'nervous',
        stressLevel: 7,
        bondScore: 20,
        healthStatus: 'Good',
        speed: 50,
        stamina: 50,
        agility: 50,
        balance: 50,
        precision: 50,
        intelligence: 50,
        boldness: 50,
        flexibility: 50,
        obedience: 50,
        focus: 50,
        epigeneticFlags: [],
      },
    });

    // Create interaction history for testing
    for (let i = 0; i < 20; i++) {
      await prisma.groomInteraction.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          taskType: 'trust_building',
          interactionType: 'enrichment',
          bondingChange: 2,
          stressChange: -2,
          quality: 'excellent',
          cost: 25.0,
          duration: 30,
          notes: 'API test interaction for evolution',
        },
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.groomInteraction.deleteMany({ where: { groomId: testGroom.id } });
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });
    await prisma.groom.deleteMany({ where: { userId: testUser.id } });
    await prisma.breed.delete({ where: { id: testBreed.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('POST /api/personality-evolution/groom/:groomId/evolve', () => {
    test('should evolve groom personality successfully', async () => {
      const response = await request(app)
        .post(`/api/personality-evolution/groom/${testGroom.id}/evolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('evolution');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.success).toBe(true);
      expect(typeof response.body.data.personalityEvolved).toBe('boolean');
    });

    test('should return 400 for invalid groom ID', async () => {
      const response = await request(app)
        .post('/api/personality-evolution/groom/invalid/evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/personality-evolution/groom/${testGroom.id}/evolve`)
        .set('x-test-require-auth', 'true')
        .expect(401);
    });
  });

  describe('POST /api/personality-evolution/horse/:horseId/evolve', () => {
    test('should evolve horse temperament successfully', async () => {
      const response = await request(app)
        .post(`/api/personality-evolution/horse/${testHorse.id}/evolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('evolution');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.success).toBe(true);
      expect(typeof response.body.data.temperamentEvolved).toBe('boolean');
    });

    test('should return 400 for invalid horse ID', async () => {
      const response = await request(app)
        .post('/api/personality-evolution/horse/invalid/evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/personality-evolution/:entityType/:entityId/triggers', () => {
    test('should get evolution triggers for groom', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/groom/${testGroom.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.triggers).toBeDefined();
      expect(response.body.data.evolutionReadiness).toBeDefined();
      expect(typeof response.body.data.evolutionReadiness).toBe('number');
    });

    test('should get evolution triggers for horse', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/horse/${testHorse.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.triggers).toBeDefined();
      expect(response.body.data.evolutionReadiness).toBeDefined();
    });

    test('should return 400 for invalid entity type', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/invalid/${testGroom.id}/triggers`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/personality-evolution/:entityType/:entityId/stability', () => {
    test('should analyze personality stability for groom', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/groom/${testGroom.id}/stability`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stabilityScore).toBeDefined();
      expect(typeof response.body.data.stabilityScore).toBe('number');
      expect(response.body.data.stabilityFactors).toBeDefined();
    });

    test('should analyze personality stability for horse', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/horse/${testHorse.id}/stability`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stabilityScore).toBeDefined();
      expect(response.body.data.stabilityFactors).toBeDefined();
    });
  });

  describe('GET /api/personality-evolution/:entityType/:entityId/predict', () => {
    test('should predict personality evolution with default timeframe', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/groom/${testGroom.id}/predict`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.predictions).toBeDefined();
      expect(Array.isArray(response.body.data.predictions)).toBe(true);
    });

    test('should predict personality evolution with custom timeframe', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/horse/${testHorse.id}/predict?timeframeDays=60`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.predictions).toBeDefined();
    });

    test('should return 400 for invalid timeframe', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/groom/${testGroom.id}/predict?timeframeDays=500`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/personality-evolution/:entityType/:entityId/history', () => {
    test('should get personality evolution history', async () => {
      const response = await request(app)
        .get(`/api/personality-evolution/groom/${testGroom.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.evolutionEvents).toBeDefined();
      expect(Array.isArray(response.body.data.evolutionEvents)).toBe(true);
      expect(response.body.data.totalEvolutions).toBeDefined();
    });
  });

  describe('POST /api/personality-evolution/apply-effects', () => {
    test('should apply personality evolution effects successfully', async () => {
      const evolutionData = {
        entityId: testGroom.id,
        entityType: 'groom',
        evolutionType: 'trait_strengthening',
        newTraits: ['enhanced_patience'],
        stabilityPeriod: 14,
        effectStrength: 0.8,
      };

      const response = await request(app)
        .post('/api/personality-evolution/apply-effects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(evolutionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.effectsApplied).toBeDefined();
    });

    test('should return 400 for missing required fields', async () => {
      const invalidData = {
        entityId: testGroom.id,
        // Missing entityType and evolutionType
      };

      const response = await request(app)
        .post('/api/personality-evolution/apply-effects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/personality-evolution/batch-evolve', () => {
    test('should process batch evolution successfully', async () => {
      const batchData = {
        entities: [
          { entityId: testGroom.id, entityType: 'groom' },
          { entityId: testHorse.id, entityType: 'horse' },
        ],
      };

      const response = await request(app)
        .post('/api/personality-evolution/batch-evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(batchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.results).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary).toBeDefined();
    });

    test('should return 400 for empty entities array', async () => {
      const response = await request(app)
        .post('/api/personality-evolution/batch-evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ entities: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/personality-evolution/config', () => {
    test('should get system configuration successfully', async () => {
      const response = await request(app)
        .get('/api/personality-evolution/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.evolutionTypes).toBeDefined();
      expect(Array.isArray(response.body.data.evolutionTypes)).toBe(true);
      expect(response.body.data.entityTypes).toBeDefined();
      expect(response.body.data.groomConfig).toBeDefined();
      expect(response.body.data.horseConfig).toBeDefined();
      expect(response.body.data.availableTraits).toBeDefined();
    });
  });
});
