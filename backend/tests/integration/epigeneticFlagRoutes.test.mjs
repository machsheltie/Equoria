/**
 * Epigenetic Flag Routes Integration Tests
 * Integration tests for epigenetic flag API endpoints
 * 
 * 🧪 TESTING APPROACH: Balanced Mocking
 * - Mock database operations only
 * - Test real API request/response flow
 * - Validate authentication and authorization
 * - Test error handling and edge cases
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import epigeneticFlagRoutes from '../../routes/epigeneticFlagRoutes.mjs';

// Mock Prisma
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn()
  }
};

jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: mockPrisma
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.unstable_mockModule('../../utils/logger.mjs', () => ({
  default: mockLogger
}));

// We'll use real authentication in integration tests

// Mock flag evaluation engine
const mockEvaluateHorseFlagsEngine = jest.fn();
const mockBatchEvaluateFlagsEngine = jest.fn();
const mockGetEligibleHorsesEngine = jest.fn();

jest.unstable_mockModule('../../utils/flagEvaluationEngine.mjs', () => ({
  evaluateHorseFlags: mockEvaluateHorseFlagsEngine,
  batchEvaluateFlags: mockBatchEvaluateFlagsEngine,
  getEligibleHorses: mockGetEligibleHorsesEngine
}));

// Mock care pattern analysis
const mockAnalyzeCarePatterns = jest.fn();

jest.unstable_mockModule('../../utils/carePatternAnalysis.mjs', () => ({
  analyzeCarePatterns: mockAnalyzeCarePatterns
}));

describe('Epigenetic Flag Routes Integration Tests', () => {
  let app;
  let authToken;
  let adminToken;
  let testUser;
  let adminUser;

  beforeAll(async () => {
    // Import the full app for integration testing
    const { default: fullApp } = await import('../../app.mjs');
    app = fullApp;

    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser'
      });

    authToken = userResponse.body.data.token;
    testUser = userResponse.body.data.user;

    // Create admin user and get admin token
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'AdminPassword123!',
        firstName: 'Admin',
        lastName: 'User',
        username: 'adminuser'
      });

    adminToken = adminResponse.body.data.token;
    adminUser = adminResponse.body.data.user;

    // Update admin user role (this would normally be done through admin interface)
    // For testing purposes, we'll mock this by updating the user object
    adminUser.role = 'admin';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  // Helper function to make authenticated requests
  const authenticatedRequest = (method, url) => {
    return request(app)[method](url).set('Authorization', `Bearer ${authToken}`);
  };

  const adminRequest = (method, url) => {
    return request(app)[method](url).set('Authorization', `Bearer ${adminToken}`);
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/flags/evaluate', () => {
    test('should evaluate flags for valid horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'user123',
        dateOfBirth: new Date('2024-01-01'),
        epigeneticFlags: []
      };

      const mockEvaluationResult = {
        success: true,
        horseId: 1,
        horseName: 'Test Horse',
        ageInYears: '0.42',
        currentFlags: [],
        newFlags: ['brave', 'confident'],
        totalFlags: 2
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockEvaluateHorseFlagsEngine.mockResolvedValue(mockEvaluationResult);

      const response = await authenticatedRequest('post', '/api/flags/evaluate')
        .send({ horseId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.newFlags).toContain('brave');
      expect(response.body.data.newFlags).toContain('confident');
      expect(mockEvaluateHorseFlagsEngine).toHaveBeenCalledWith(1);
    });

    test('should return 400 for invalid horse ID', async () => {
      const response = await authenticatedRequest('post', '/api/flags/evaluate')
        .send({ horseId: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('should return 404 for non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const response = await authenticatedRequest('post', '/api/flags/evaluate')
        .send({ horseId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    test('should return 403 for unauthorized access', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'otheruser',
        dateOfBirth: new Date('2024-01-01'),
        epigeneticFlags: []
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const response = await authenticatedRequest('post', '/api/flags/evaluate')
        .send({ horseId: 1 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });

    test('should allow admin access to any horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'otheruser',
        dateOfBirth: new Date('2024-01-01'),
        epigeneticFlags: []
      };

      const mockEvaluationResult = {
        success: true,
        horseId: 1,
        horseName: 'Test Horse',
        newFlags: ['brave']
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockEvaluateHorseFlagsEngine.mockResolvedValue(mockEvaluationResult);

      const response = await adminRequest('post', '/api/flags/evaluate')
        .send({ horseId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/horses/:id/flags', () => {
    test('should return horse flags for valid horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'user123',
        dateOfBirth: new Date('2024-01-01'),
        epigeneticFlags: ['brave', 'confident'],
        bondScore: 60,
        stressLevel: 20
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const response = await authenticatedRequest('get', '/api/flags/horses/1/flags');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.horseId).toBe(1);
      expect(response.body.data.horseName).toBe('Test Horse');
      expect(response.body.data.flagCount).toBe(2);
      expect(response.body.data.flags).toHaveLength(2);
      expect(response.body.data.flags[0]).toHaveProperty('name');
      expect(response.body.data.flags[0]).toHaveProperty('displayName');
      expect(response.body.data.flags[0]).toHaveProperty('description');
    });

    test('should return 400 for invalid horse ID', async () => {
      const response = await authenticatedRequest('get', '/api/flags/horses/invalid/flags');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid horse ID');
    });

    test('should return 404 for non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const response = await authenticatedRequest('get', '/api/flags/horses/999/flags');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    test('should return 403 for unauthorized access', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'otheruser',
        dateOfBirth: new Date('2024-01-01'),
        epigeneticFlags: ['brave'],
        bondScore: 60,
        stressLevel: 20
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const response = await authenticatedRequest('get', '/api/flags/horses/1/flags');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });
  });

  describe('GET /api/flags/definitions', () => {
    test('should return all flag definitions', async () => {
      const response = await authenticatedRequest('get', '/api/flags/definitions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(9);
      expect(response.body.data.flags).toHaveLength(9);
      expect(response.body.data.flags[0]).toHaveProperty('name');
      expect(response.body.data.flags[0]).toHaveProperty('displayName');
      expect(response.body.data.flags[0]).toHaveProperty('type');
    });

    test('should filter flag definitions by type', async () => {
      const response = await authenticatedRequest('get', '/api/flags/definitions?type=positive');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(4);
      expect(response.body.data.flags.every(flag => flag.type === 'positive')).toBe(true);
    });

    test('should return 400 for invalid flag type', async () => {
      const response = await authenticatedRequest('get', '/api/flags/definitions?type=invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/flags/batch-evaluate', () => {
    test('should require admin role', async () => {
      const response = await request(app)
        .post('/api/flags/batch-evaluate')
        .send({ horseIds: [1, 2, 3] });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Admin access required');
    });

    test('should batch evaluate horses for admin', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 'admin123', role: 'admin' };
        next();
      });

      const mockBatchResults = [
        { success: true, horseId: 1, newFlags: ['brave'] },
        { success: true, horseId: 2, newFlags: ['confident'] },
        { success: false, horseId: 3, error: 'Horse not found' }
      ];

      mockBatchEvaluateFlagsEngine.mockResolvedValue(mockBatchResults);

      const response = await request(app)
        .post('/api/flags/batch-evaluate')
        .send({ horseIds: [1, 2, 3] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalHorses).toBe(3);
      expect(response.body.data.summary.successful).toBe(2);
      expect(response.body.data.summary.failed).toBe(1);
      expect(response.body.data.results).toHaveLength(3);
    });

    test('should return 400 for invalid horse IDs array', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        req.user = { id: 'admin123', role: 'admin' };
        next();
      });

      const response = await request(app)
        .post('/api/flags/batch-evaluate')
        .send({ horseIds: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('must be a non-empty array');
    });
  });

  describe('GET /api/horses/:id/care-patterns', () => {
    test('should return care patterns for valid horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'user123',
        dateOfBirth: new Date('2024-01-01')
      };

      const mockCareAnalysis = {
        eligible: true,
        horseId: 1,
        ageInYears: 0.42,
        patterns: {
          consistentCare: { totalInteractions: 10 },
          noveltyExposure: { noveltyEvents: 3 },
          stressManagement: { stressEvents: 2 }
        }
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockAnalyzeCarePatterns.mockResolvedValue(mockCareAnalysis);

      const response = await request(app)
        .get('/api/flags/horses/1/care-patterns');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.eligible).toBe(true);
      expect(response.body.data.patterns).toHaveProperty('consistentCare');
      expect(mockAnalyzeCarePatterns).toHaveBeenCalledWith(1);
    });

    test('should return 403 for unauthorized access', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        ownerId: 'otheruser',
        dateOfBirth: new Date('2024-01-01')
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);

      const response = await request(app)
        .get('/api/flags/horses/1/care-patterns');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permission');
    });
  });

  describe('GET /api/flags/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/flags/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('operational');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('Error Handling', () => {
    test('should handle internal server errors gracefully', async () => {
      mockPrisma.horse.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/flags/evaluate')
        .send({ horseId: 1 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Internal server error');
    });

    test('should handle authentication errors', async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, message: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/flags/evaluate')
        .send({ horseId: 1 });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Unauthorized');
    });
  });
});
