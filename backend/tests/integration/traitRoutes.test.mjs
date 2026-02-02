/**
 * Trait Routes Integration Tests
 * Tests for trait discovery API endpoints
 *
 * Testing Approach: Balanced Mocking - Real Database Integration
 * - Uses REAL database operations for horses, breeds, users
 * - Tests actual ownership validation and authentication
 * - Creates and cleans up real test data for realistic scenarios
 * - Only minimal mocking of external dependencies (logger if needed)
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// Import the app (no mocking - full integration testing)
const app = (await import('../../app.mjs')).default;

describe('Trait Routes Integration Tests', () => {
  let testHorse;
  let testBreed;
  let authToken;
  let testUser;

  beforeAll(async () => {
    try {
      // Create test user and get auth token
      console.log('[DEBUG] About to call createTestUser...');
      const auth = await createTestUser({ role: 'user' });
      console.log('[DEBUG] createTestUser returned:', auth);

      if (!auth || !auth.user) {
        throw new Error('createTestUser did not return a valid user object');
      }

      testUser = auth.user;
      authToken = auth.token;
      console.log('[DEBUG] testUser set to:', testUser);

      // Create real test breed in database
      testBreed = await prisma.breed.create({
        data: {
          name: `Test Breed for Traits ${Date.now()}`,
          description: 'Test breed for trait discovery testing',
        },
      });
      console.log('[DEBUG] Created test breed:', testBreed.id);

      // Create real test horse in database owned by test user
      const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
      testHorse = await prisma.horse.create({
        data: {
          name: `Test Discovery Horse ${Date.now()}`,
          sex: 'mare',
          dateOfBirth: twoYearsAgo,
          breedId: testBreed.id,
          userId: testUser.id, // Link horse to test user in ACTUAL database
          bondScore: 85,
          stressLevel: 15,
          healthStatus: 'excellent',
          epigeneticModifiers: {
            positive: ['resilient'],
            negative: [],
            hidden: ['bold', 'trainabilityBoost'],
          },
        },
      });
      console.log('[DEBUG] Created test horse:', testHorse.id, 'owned by user:', testUser.id);
    } catch (error) {
      console.error('[ERROR] Failed in beforeAll setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Clean up test data from database
    try {
      if (testHorse) {
        await prisma.horse.delete({ where: { id: testHorse.id } }).catch(() => {});
      }
      if (testBreed) {
        await prisma.breed.delete({ where: { id: testBreed.id } }).catch(() => {});
      }
      if (testUser) {
        await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
      }
    } catch (error) {
      console.error('[ERROR] Cleanup failed:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  beforeEach(() => {
    // Reset any mocks before each test (minimal mocking approach)
    jest.clearAllMocks();
    // Note: Using real database operations, no Prisma mocks needed
  });

  describe('POST /api/traits/discover/:horseId', () => {
    it('should trigger trait discovery successfully', async () => {
      const response = await request(app)
        .post(`/api/traits/discover/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          checkEnrichment: true,
          forceCheck: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('traitsRevealed');
      expect(response.body.data).toHaveProperty('conditionsMet');
      expect(response.body.data).toHaveProperty('updatedTraits');

      // Should have discovered at least one trait due to high bond score and low stress
      expect(response.body.data.revealed.length).toBeGreaterThan(0);
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app)
        .post('/api/traits/discover/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .post('/api/traits/discover/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          checkEnrichment: true,
          forceCheck: false,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    it('should handle optional parameters correctly', async () => {
      const response = await request(app)
        .post(`/api/traits/discover/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          checkEnrichment: false,
          forceCheck: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('traitsRevealed');
    });
  });

  describe('GET /api/traits/horse/:horseId', () => {
    it('should get horse traits successfully', async () => {
      const response = await request(app)
        .get(`/api/traits/horse/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Temporary debugging: log the response to see the actual error
      console.log('[DEBUG] Response status:', response.status);
      console.log('[DEBUG] Response body:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('bondScore');
      expect(response.body.data).toHaveProperty('stressLevel');
      expect(response.body.data).toHaveProperty('age');
      expect(response.body.data).toHaveProperty('traits');
      expect(response.body.data).toHaveProperty('summary');

      const { traits } = response.body.data;
      expect(traits).toHaveProperty('positive');
      expect(traits).toHaveProperty('negative');
      expect(traits).toHaveProperty('hidden');
      expect(Array.isArray(traits.positive)).toBe(true);
      expect(Array.isArray(traits.negative)).toBe(true);
      expect(Array.isArray(traits.hidden)).toBe(true);

      // Check trait structure
      if (traits.positive.length > 0) {
        expect(traits.positive[0]).toHaveProperty('name');
        expect(traits.positive[0]).toHaveProperty('definition');
      }
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app)
        .get('/api/traits/horse/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get('/api/traits/horse/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('GET /api/traits/definitions', () => {
    it('should get all trait definitions', async () => {
      const response = await request(app)
        .get('/api/traits/definitions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('traits');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('filter', 'all');
      expect(typeof response.body.data.traits).toBe('object');
      expect(response.body.data.count).toBeGreaterThan(0);

      // Check trait definition structure
      const traitKeys = Object.keys(response.body.data.traits);
      if (traitKeys.length > 0) {
        const firstTrait = response.body.data.traits[traitKeys[0]];
        expect(firstTrait).toHaveProperty('name');
        expect(firstTrait).toHaveProperty('type');
        expect(firstTrait).toHaveProperty('rarity');
      }
    });

    it('should filter traits by type', async () => {
      const response = await request(app)
        .get('/api/traits/definitions?type=positive')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filter).toBe('positive');

      // All returned traits should be positive
      const { traits } = response.body.data;
      Object.values(traits).forEach(trait => {
        expect(trait.type).toBe('positive');
      });
    });

    it('should return validation error for invalid type', async () => {
      const response = await request(app)
        .get('/api/traits/definitions?type=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Type must be either "all", "positive", or "negative"');
    });
  });

  describe('GET /api/traits/discovery-status/:horseId', () => {
    it('should get discovery status successfully', async () => {
      const response = await request(app)
        .get(`/api/traits/discovery-status/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('traitCounts');
      expect(response.body.data).toHaveProperty('discoveryConditions');
      expect(response.body.data).toHaveProperty('canDiscover');

      const { currentStats } = response.body.data;
      expect(currentStats).toHaveProperty('bondScore');
      expect(currentStats).toHaveProperty('stressLevel');
      expect(currentStats).toHaveProperty('age');

      const { traitCounts } = response.body.data;
      expect(traitCounts).toHaveProperty('visible');
      expect(traitCounts).toHaveProperty('hidden');

      const { discoveryConditions } = response.body.data;
      expect(discoveryConditions).toHaveProperty('met');
      expect(discoveryConditions).toHaveProperty('enrichment');
      expect(discoveryConditions).toHaveProperty('total');
      expect(Array.isArray(discoveryConditions.met)).toBe(true);
      expect(Array.isArray(discoveryConditions.enrichment)).toBe(true);
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app)
        .get('/api/traits/discovery-status/invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get('/api/traits/discovery-status/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('POST /api/traits/batch-discover', () => {
    it('should process batch discovery successfully', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          horseIds: [testHorse.id],
          checkEnrichment: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('errors');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(Array.isArray(response.body.data.errors)).toBe(true);

      const { summary } = response.body.data;
      expect(summary).toHaveProperty('processed');
      expect(summary).toHaveProperty('failed');
      expect(summary).toHaveProperty('totalRevealed');
    });

    it('should return validation error for empty horse IDs array', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          horseIds: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('horseIds must be an array with 1-10 elements');
    });

    it('should return validation error for too many horse IDs', async () => {
      const tooManyIds = Array.from({ length: 11 }, (_, i) => i + 1);

      const response = await request(app)
        .post('/api/traits/batch-discover')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          horseIds: tooManyIds,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('horseIds must be an array with 1-10 elements');
    });

    it('should return validation error for invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          horseIds: ['invalid', 'ids'],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('All horse IDs must be positive integers');
    });

    it('should handle mix of valid and invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          horseIds: [testHorse.id, 99999], // One valid, one invalid
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results.length).toBe(1); // Only valid horse processed
      expect(response.body.data.errors.length).toBe(1); // One error for invalid horse
    });
  });
});
