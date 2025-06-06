/**
 * Trait Routes Integration Tests
 * Tests for trait discovery API endpoints
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database module BEFORE importing the app
jest.unstable_mockModule(join(__dirname, '../../db/index.mjs'), () => ({
  default: {
    horse: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    breed: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Now import the app and the mocked modules
const app = (await import('../../app.mjs')).default;
const mockPrisma = (await import(join(__dirname, '../../db/index.mjs'))).default;

describe('Trait Routes Integration Tests', () => {
  let testHorse;
  let testBreed;

  beforeAll(() => {
    // Mock test data
    testBreed = {
      id: 1,
      name: `Test Breed for Traits ${Date.now()}`,
      description: 'Test breed for trait discovery testing',
    };

    testHorse = {
      id: 1,
      name: `Test Discovery Horse ${Date.now()}`,
      age: 1,
      breedId: testBreed.id,
      bond_score: 85,
      stress_level: 15,
      epigenetic_modifiers: {
        positive: ['resilient'],
        negative: [],
        hidden: ['bold', 'trainability_boost'],
      },
    };
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup database mocks
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === testHorse.id) {
        return Promise.resolve(testHorse);
      } else if (where.id === 99999) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    mockPrisma.horse.update.mockImplementation(({ where, data }) => {
      if (where.id === testHorse.id) {
        return Promise.resolve({
          ...testHorse,
          ...data,
          epigenetic_modifiers: {
            ...testHorse.epigenetic_modifiers,
            ...data.epigenetic_modifiers,
          },
        });
      }
      return Promise.resolve(null);
    });

    mockPrisma.breed.findUnique.mockResolvedValue(testBreed);
  });

  describe('POST /api/traits/discover/:horseId', () => {
    it('should trigger trait discovery successfully', async () => {
      const response = await request(app)
        .post(`/api/traits/discover/${testHorse.id}`)
        .send({
          checkEnrichment: true,
          forceCheck: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('revealed');
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('updatedTraits');

      // Should have discovered at least one trait due to high bond score and low stress
      expect(response.body.data.revealed.length).toBeGreaterThan(0);
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app).post('/api/traits/discover/invalid').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app).post('/api/traits/discover/99999').send({}).expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    it('should handle optional parameters correctly', async () => {
      const response = await request(app)
        .post(`/api/traits/discover/${testHorse.id}`)
        .send({
          checkEnrichment: false,
          forceCheck: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('revealed');
    });
  });

  describe('GET /api/traits/horse/:horseId', () => {
    it('should get horse traits successfully', async () => {
      const response = await request(app).get(`/api/traits/horse/${testHorse.id}`).expect(200);

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
      const response = await request(app).get('/api/traits/horse/invalid').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app).get('/api/traits/horse/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('GET /api/traits/definitions', () => {
    it('should get all trait definitions', async () => {
      const response = await request(app).get('/api/traits/definitions').expect(200);

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
      const response = await request(app).get('/api/traits/definitions?type=positive').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filter).toBe('positive');

      // All returned traits should be positive
      const { traits } = response.body.data;
      Object.values(traits).forEach(trait => {
        expect(trait.type).toBe('positive');
      });
    });

    it('should return validation error for invalid type', async () => {
      const response = await request(app).get('/api/traits/definitions?type=invalid').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/traits/discovery-status/:horseId', () => {
    it('should get discovery status successfully', async () => {
      const response = await request(app)
        .get(`/api/traits/discovery-status/${testHorse.id}`)
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
      const response = await request(app).get('/api/traits/discovery-status/invalid').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app).get('/api/traits/discovery-status/99999').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('POST /api/traits/batch-discover', () => {
    it('should process batch discovery successfully', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
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
        .send({
          horseIds: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return validation error for too many horse IDs', async () => {
      const tooManyIds = Array.from({ length: 11 }, (_, i) => i + 1);

      const response = await request(app)
        .post('/api/traits/batch-discover')
        .send({
          horseIds: tooManyIds,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should return validation error for invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
        .send({
          horseIds: ['invalid', 'ids'],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle mix of valid and invalid horse IDs', async () => {
      const response = await request(app)
        .post('/api/traits/batch-discover')
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
