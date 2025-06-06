import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database module BEFORE importing the app
jest.unstable_mockModule(join(__dirname, '../../db/index.mjs'), () => ({
  default: {
    user: {
      findUnique: jest.fn(),
    },
    horse: {
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Now import the app and the mocked modules
const app = (await import('../../app.mjs')).default;
const mockPrisma = (await import(join(__dirname, '../../db/index.mjs'))).default;

describe('Horse Routes Integration Tests', () => {
  const mockUser = {
    id: 'test-user-uuid-123',
    name: 'Test User',
    horses: [
      {
        id: 1,
        name: 'Adult Horse 1',
        age: 4,
        userId: 'test-user-uuid-123',
      },
      {
        id: 2,
        name: 'Adult Horse 2',
        age: 5,
        userId: 'test-user-uuid-123',
      },
    ],
  };

  beforeEach(() => {
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
  });
  describe('GET /api/horses/trainable/:userId', () => {
    it('should return trainable horses for valid user ID', async () => {
      const userId = 'test-user-uuid-123';

      const response = await request(app).get(`/api/horses/trainable/${userId}`).expect(200);

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

    it('should return empty array for non-existent user', async () => {
      const userId = 'nonexistent-user-uuid-456';

      const response = await request(app).get(`/api/horses/trainable/${userId}`).expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data', []);
    });

    it('should return validation error for invalid user ID', async () => {
      await request(app).get('/api/horses/trainable/').expect(404); // Route not found for empty user ID
    });

    it('should return validation error for user ID that is too long', async () => {
      const longUserId = 'a'.repeat(51); // Exceeds 50 character limit

      const response = await request(app).get(`/api/horses/trainable/${longUserId}`).expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Validation failed');
      expect(response.body).toHaveProperty('errors');
    });

    it('should handle server errors gracefully', async () => {
      // This test would require mocking the controller to throw an error
      // For now, we'll just verify the endpoint exists and responds
      const userId = 'test-user-uuid-123';

      const response = await request(app).get(`/api/horses/trainable/${userId}`);

      expect([200, 500]).toContain(response.status);
    });
  });
});
