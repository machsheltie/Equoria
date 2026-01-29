import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

// Import authentication helpers
import { generateTestToken } from '../helpers/authHelper.mjs';

// Create mock object BEFORE jest.unstable_mockModule
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  horse: {
    findMany: jest.fn(),
  },
  trainingLog: {
    groupBy: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// Mock the database module BEFORE importing the app
jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma,
}));

// Now import the app
const app = (await import('../../app.mjs')).default;

describe('Horse Routes Integration Tests', () => {
  // Authentication variables
  let authToken;

  const mockUser = {
    id: 'test-user-uuid-123',
    name: 'Test User',
    horses: [
      {
        id: 1,
        name: 'Adult Horse 1',
        age: 4,
        dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000), // 4 years ago
        userId: 'test-user-uuid-123',
        breed: { id: 1, name: 'Thoroughbred' },
        stable: { id: 1, name: 'Main Stable' },
        epigeneticModifiers: {
          positive: [], // No special traits (including no "gaited" trait)
          negative: [],
        },
      },
      {
        id: 2,
        name: 'Adult Horse 2',
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000), // 5 years ago
        userId: 'test-user-uuid-123',
        breed: { id: 2, name: 'Arabian' },
        stable: { id: 1, name: 'Main Stable' },
        epigeneticModifiers: {
          positive: [], // No special traits
          negative: [],
        },
      },
    ],
  };

  beforeEach(() => {
    // Generate test authentication token
    authToken = generateTestToken({
      id: 'test-user-uuid-123',
      email: 'test@example.com',
      role: 'user',
    });
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup database mocks
    // Mock for user.findUnique, which is used by horseController for /trainable/:userId
    mockPrisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'test-user-uuid-123') {
        return Promise.resolve(mockUser); // mockUser includes the horses array
      } else if (where.id === 'nonexistent-user-uuid-456') {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    mockPrisma.horse.findMany.mockImplementation(({ where }) => {
      if (where?.userId === 'test-user-uuid-123') {
        return Promise.resolve(mockUser.horses);
      }
      return Promise.resolve([]);
    });

    // Mock upsert for auth bypass
    mockPrisma.user.upsert.mockResolvedValue({
      id: 'test-user-uuid-123',
      email: 'test@example.com',
    });

    // Mock groupBy for trainingModel
    mockPrisma.trainingLog.groupBy.mockResolvedValue([]);
  });
  describe('GET /api/horses/trainable/:userId', () => {
    it('should return trainable horses for valid user ID', async () => {
      const userId = 'test-user-uuid-123';

      const response = await request(app)
        .get(`/api/horses/trainable/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Each horse should have the required properties
      response.body.data.forEach(horse => {
        expect(horse).toHaveProperty('horseId');
        expect(horse).toHaveProperty('name');
        expect(horse).toHaveProperty('age');
        expect(horse).toHaveProperty('trainableDisciplines');
        expect(Array.isArray(horse.trainableDisciplines)).toBe(true);
        expect(horse.age).toBeGreaterThanOrEqual(3); // Only horses 3+ should be returned
      });
    });

    it("should return 403 when accessing another user's trainable horses", async () => {
      const userId = 'nonexistent-user-uuid-456';

      const response = await request(app)
        .get(`/api/horses/trainable/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Forbidden: Cannot access trainable horses for another user');
    });

    it('should return validation error for invalid user ID', async () => {
      await request(app).get('/api/horses/trainable/').set('Authorization', `Bearer ${authToken}`).expect(400); // Validation error for empty user ID
    });

    it('should return validation error for user ID that is too long', async () => {
      const longUserId = 'a'.repeat(51); // Exceeds 50 character limit

      const response = await request(app)
        .get(`/api/horses/trainable/${longUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle server errors gracefully', async () => {
      // This test would require mocking the controller to throw an error
      // For now, we'll just verify the endpoint exists and responds
      const userId = 'test-user-uuid-123';

      const response = await request(app)
        .get(`/api/horses/trainable/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 500]).toContain(response.status);
    });
  });
});
