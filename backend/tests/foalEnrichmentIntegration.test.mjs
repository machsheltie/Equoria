/**
 * 🧪 INTEGRATION TEST: Foal Enrichment API Integration - Complete API Workflow Validation
 *
 * This test validates the complete foal enrichment API workflow including request handling,
 * validation, database operations, and response formatting for the early training system.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Foal enrichment API: POST /api/foals/:foalId/enrichment endpoint functionality
 * - Request validation: Day (0-6), activity name, foal ID parameter validation
 * - Activity validation: Day-specific activities, appropriate activity-day combinations
 * - Bond/stress management: Score updates with proper bounds (0-100) and change tracking
 * - Database operations: Horse lookup, updates, training history record creation
 * - Response structure: Success/error responses with proper data formatting
 * - Error handling: 404 for missing foals, 400 for validation failures
 * - Activity flexibility: Multiple name formats (type, name, case insensitive)
 * - Training history: Complete activity logging with outcomes and changes
 * - Edge case handling: Extreme bond/stress values with proper bounds enforcement
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. POST /api/foals/:foalId/enrichment - Complete enrichment activity API
 * 2. Request validation - Required fields, data types, range validation
 * 3. Database integration - Horse queries, updates, training history creation
 * 4. Response formatting - Success/error responses with proper structure
 * 5. Activity validation - Day-specific activity appropriateness
 * 6. Bond/stress bounds - 0-100 range enforcement and change tracking
 * 7. Error scenarios - Missing foals, invalid parameters, inappropriate activities
 * 8. Activity formats - Type names, display names, case insensitive matching
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ⚠️  HEAVILY OVER-MOCKED: Complete database layer (Prisma) with complex orchestration
 * ⚠️  EXTREME RISK: Tests completely disconnected from real database behavior
 * 🔧 MOCK: All database operations - for API endpoint isolation
 *
 * 💡 TEST STRATEGY: API integration testing with heavily mocked database to validate
 *    request-response cycles and endpoint behavior
 *
 * 🚨 CRITICAL WARNING: Massive over-mocking with complex beforeAll/beforeEach setup.
 *    This creates extreme maintenance burden and loses all touch with reality.
 *    Consider replacing with real database integration tests for meaningful validation.
 */

import { jest, describe, beforeEach, expect, it, beforeAll } from '@jest/globals';
import request from 'supertest';
import { generateTestToken } from './helpers/authHelper.mjs';

// Create mock objects BEFORE jest.unstable_mockModule
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  horse: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  breed: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  foalTrainingHistory: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    deleteMany: jest.fn(),
  },
  $disconnect: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));

// Now import the app
const app = (await import('../app.mjs')).default;

describe('🐴 INTEGRATION: Foal Enrichment API Integration - Complete API Workflow Validation', () => {
  let testFoal;
  let testBreed;
  let authToken;
  let testUser; // Declare testUser in test scope

  beforeAll(async () => {
    // Mock test breed
    testBreed = {
      id: 1,
      name: 'Test Breed for Enrichment',
      description: 'Test breed for foal enrichment testing',
    };

    // Mock test foal
    testFoal = {
      id: 1,
      name: 'Test Enrichment Foal',
      age: 0,
      breedId: testBreed.id,
      ownerId: 'test-user-id',
      bondScore: 50,
      stressLevel: 20,
    };

    // Mock test user for authentication
    testUser = {
      // Assign to test scope variable (not const)
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      firstName: 'Test',
      lastName: 'User',
    };

    // Setup default mock responses
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
    mockPrisma.breed.create.mockResolvedValue(testBreed);
    mockPrisma.horse.create.mockResolvedValue(testFoal);
    mockPrisma.horse.findUnique.mockResolvedValue(testFoal);
    mockPrisma.horse.findFirst.mockResolvedValue(testFoal);
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Reset default mock responses
    mockPrisma.user.findUnique.mockResolvedValue(testUser);
    mockPrisma.horse.findUnique.mockResolvedValue(testFoal);
    mockPrisma.horse.findFirst.mockImplementation(({ where } = {}) => {
      if (where?.id === testFoal.id) {
        return Promise.resolve(testFoal);
      }
      return Promise.resolve(null);
    });
    mockPrisma.horse.update.mockResolvedValue({
      ...testFoal,
      bondScore: 55,
      stressLevel: 22,
    });

    // Ensure foalTrainingHistory.create always returns a valid object
    mockPrisma.foalTrainingHistory.create.mockResolvedValue({
      id: 'test-training-id',
      horseId: testFoal.id,
      day: 3,
      activity: 'Test Activity',
      outcome: 'success',
      bondChange: 5,
      stressChange: 2,
      timestamp: new Date(),
    });

    // Generate JWT token for authentication (SAFE - uses real token generation)
    authToken = generateTestToken({ id: testFoal.ownerId, role: 'user' });
  });

  describe('POST /api/foals/:foalId/enrichment', () => {
    it('should complete enrichment activity successfully', async () => {
      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Trailer Exposure',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Trailer Exposure');
      expect(response.body.data).toHaveProperty('foal');
      expect(response.body.data).toHaveProperty('activity');
      expect(response.body.data).toHaveProperty('updatedLevels');
      expect(response.body.data).toHaveProperty('changes');
      expect(response.body.data).toHaveProperty('trainingRecordId');

      // Verify foal data
      expect(response.body.data.foal.id).toBe(testFoal.id);
      expect(response.body.data.foal.name).toBe(testFoal.name);

      // Verify activity data
      expect(response.body.data.activity.name).toBe('Trailer Exposure');
      expect(response.body.data.activity.day).toBe(3);
      expect(response.body.data.activity.outcome).toMatch(/success|excellent|challenging/);

      // Verify levels are within bounds
      expect(response.body.data.updatedLevels.bondScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.stressLevel).toBeLessThanOrEqual(100);

      // Verify changes are reported
      expect(response.body.data.changes).toHaveProperty('bondChange');
      expect(response.body.data.changes).toHaveProperty('stressChange');

      // Verify training record was created
      expect(mockPrisma.foalTrainingHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          horseId: testFoal.id,
          day: 3,
          activity: 'Trailer Exposure',
        }),
      });
    });

    it('should update horse bond_score and stress_level in database', async () => {
      // Setup mock for initial horse state
      mockPrisma.horse.findUnique.mockResolvedValueOnce({
        ...testFoal,
        bond_score: 50,
        stress_level: 20,
      });

      // Setup mock for updated horse state
      mockPrisma.horse.update.mockResolvedValueOnce({
        ...testFoal,
        bond_score: 55,
        stress_level: 22,
      });

      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Halter Introduction',
        })
        .expect(200);

      // Verify horse was updated in database
      expect(mockPrisma.horse.update).toHaveBeenCalledWith({
        where: { id: testFoal.id },
        data: expect.objectContaining({
          bondScore: expect.any(Number),
          stressLevel: expect.any(Number),
        }),
      });

      // Verify response contains updated levels
      expect(response.body.data.updatedLevels).toHaveProperty('bondScore');
      expect(response.body.data.updatedLevels).toHaveProperty('stressLevel');
    });

    it('should validate request parameters', async () => {
      // Missing day
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          activity: 'Trailer Exposure',
        })
        .expect(400);

      // Missing activity
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
        })
        .expect(400);

      // Invalid day (too high)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 7,
          activity: 'Trailer Exposure',
        })
        .expect(400);

      // Invalid day (negative)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: -1,
          activity: 'Trailer Exposure',
        })
        .expect(400);

      // Empty activity
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: '',
        })
        .expect(400);
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app)
        .post('/api/foals/99999/enrichment')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Trailer Exposure',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for inappropriate activity for day', async () => {
      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 0,
          activity: 'Trailer Exposure', // This is a day 3 activity
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not appropriate for day 0');
    });

    it('should accept different activity name formats', async () => {
      // Test exact type
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'leading_practice',
        })
        .expect(200);

      // Test exact name
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Leading Practice',
        })
        .expect(200);

      // Test case insensitive
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'HANDLING EXERCISES',
        })
        .expect(200);
    });

    it('should handle all day 3 activities', async () => {
      const day3Activities = ['Halter Introduction', 'Leading Practice', 'Handling Exercises', 'Trailer Exposure'];

      for (const activity of day3Activities) {
        const response = await request(app)
          .post(`/api/foals/${testFoal.id}/enrichment`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-test-skip-csrf', 'true')
          .send({
            day: 3,
            activity,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.activity.name).toBe(activity);
        expect(response.body.data.activity.day).toBe(3);
      }
    });

    it('should create training history records for each activity', async () => {
      // Setup mock for initial count
      mockPrisma.foalTrainingHistory.count.mockResolvedValueOnce(5);

      // Setup mock for training record creation
      mockPrisma.foalTrainingHistory.create.mockResolvedValueOnce({
        id: 'test-training-record',
        horseId: testFoal.id,
        day: 1,
        activity: 'Feeding Assistance',
        outcome: 'success',
        bondChange: 6,
        stressChange: 1,
        timestamp: new Date(),
      });

      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 1,
          activity: 'Feeding Assistance',
        })
        .expect(200);

      // Verify training record was created
      expect(mockPrisma.foalTrainingHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          horseId: testFoal.id,
          day: 1,
          activity: 'Feeding Assistance',
          outcome: expect.stringMatching(/success|excellent|challenging/),
          bondChange: expect.any(Number),
          stressChange: expect.any(Number),
        }),
      });
    });

    it('should handle edge cases with bond and stress levels', async () => {
      // Mock a foal with extreme values
      const extremeFoal = {
        id: 999,
        name: 'Extreme Test Foal',
        age: 0,
        breedId: testBreed.id,
        ownerId: testFoal.ownerId,
        bondScore: 95,
        stressLevel: 5,
      };

      mockPrisma.horse.findFirst.mockResolvedValueOnce(extremeFoal);

      // Setup mock to return extreme foal
      mockPrisma.horse.findUnique.mockResolvedValueOnce(extremeFoal);

      // Setup mock for updated extreme foal (values should be capped)
      mockPrisma.horse.update.mockResolvedValueOnce({
        ...extremeFoal,
        bondScore: 100, // Capped at maximum
        stressLevel: 0, // Capped at minimum
      });

      const response = await request(app)
        .post(`/api/foals/${extremeFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Trailer Exposure',
        })
        .expect(200);

      // Values should be capped at bounds
      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);
    });
  });
});
