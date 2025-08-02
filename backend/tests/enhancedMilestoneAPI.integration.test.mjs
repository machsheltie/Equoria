/**
 * Enhanced Milestone Evaluation API Integration Test Suite
 * 
 * Tests for the API endpoints of the enhanced milestone evaluation system.
 * 
 * 🎯 FEATURES TESTED:
 * - POST /api/traits/evaluate-milestone endpoint
 * - GET /api/traits/milestone-status/:horseId endpoint  
 * - GET /api/traits/milestone-definitions endpoint
 * - Authentication and authorization
 * - Input validation and error handling
 * - Response format validation
 * 
 * 🔧 TESTING APPROACH:
 * - Integration testing with real API endpoints
 * - Balanced mocking: Only mock database operations
 * - Real validation and business logic testing
 * - Comprehensive error scenario coverage
 * 
 * 📋 BUSINESS RULES TESTED:
 * - User authentication required for horse-specific endpoints
 * - Horse ownership validation
 * - Milestone type validation
 * - Age and window eligibility validation
 * - Proper error responses and status codes
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { MILESTONE_TYPES } from '../utils/enhancedMilestoneEvaluationSystem.mjs';

// Mock external dependencies
const mockPrisma = {
  horse: {
    findUnique: jest.fn()
  },
  groom: {
    findUnique: jest.fn()
  },
  groomInteraction: {
    findMany: jest.fn()
  },
  milestoneTraitLog: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn()
  }
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock imports
jest.unstable_mockModule('../db/index.mjs', () => ({
  default: mockPrisma
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: mockLogger
}));

// Import app after mocking
const { default: app } = await import('../app.mjs');

describe('🏇 Enhanced Milestone Evaluation API Integration', () => {
  const mockUser = {
    id: 'user123',
    username: 'testuser',
    email: 'test@example.com'
  };

  const mockAuthToken = 'mock-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/traits/evaluate-milestone', () => {
    const validRequestBody = {
      horseId: 1,
      milestoneType: MILESTONE_TYPES.IMPRINTING,
      groomId: 1,
      bondScore: 75
    };

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .send(validRequestBody);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should validate milestone type', async () => {
      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...validRequestBody,
          milestoneType: 'invalid_milestone'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('Milestone type must be one of')
          })
        ])
      );
    });

    it('should validate horse ID format', async () => {
      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...validRequestBody,
          horseId: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Horse ID must be a positive integer'
          })
        ])
      );
    });

    it('should validate bond score range', async () => {
      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          ...validRequestBody,
          bondScore: 150
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Bond score must be between 0 and 100'
          })
        ])
      );
    });

    it('should handle non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(validRequestBody);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Horse with ID 1 not found');
    });

    it('should handle successful milestone evaluation', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: mockUser.id,
        dateOfBirth: new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)), // 1 day old
        bondScore: 75,
        groomAssignments: []
      };

      const mockGroom = {
        id: 1,
        name: 'Test Groom',
        userId: mockUser.id
      };

      const mockMilestoneLog = {
        id: 1,
        horseId: 1,
        milestoneType: MILESTONE_TYPES.IMPRINTING,
        score: 2,
        finalTrait: 'trusting'
      };

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.groom.findUnique.mockResolvedValue(mockGroom);
      mockPrisma.milestoneTraitLog.findFirst.mockResolvedValue(null);
      mockPrisma.groomInteraction.findMany.mockResolvedValue([]);
      mockPrisma.milestoneTraitLog.create.mockResolvedValue(mockMilestoneLog);

      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send(validRequestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Milestone evaluation completed successfully');
      expect(response.body.data).toEqual(
        expect.objectContaining({
          horseId: 1,
          horseName: 'Test Horse',
          milestoneType: MILESTONE_TYPES.IMPRINTING,
          finalTrait: expect.any(String),
          traitType: expect.stringMatching(/^(positive|negative)$/),
          finalScore: expect.any(Number),
          modifiersApplied: expect.objectContaining({
            bondModifier: expect.any(Number),
            taskConsistencyModifier: expect.any(Number),
            careGapsPenalty: expect.any(Number)
          }),
          reasoning: expect.any(String),
          milestoneLogId: 1,
          groomCareHistory: expect.objectContaining({
            totalInteractions: expect.any(Number),
            taskDiversity: expect.any(Number),
            taskConsistency: expect.any(Number),
            averageQuality: expect.any(Number)
          })
        })
      );
    });
  });

  describe('GET /api/traits/milestone-status/:horseId', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/traits/milestone-status/1');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should validate horse ID parameter', async () => {
      const response = await request(app)
        .get('/api/traits/milestone-status/invalid')
        .set('Authorization', `Bearer ${mockAuthToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: 'Horse ID must be a positive integer'
          })
        ])
      );
    });

    it('should handle non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/traits/milestone-status/999')
        .set('Authorization', `Bearer ${mockAuthToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Horse with ID 999 not found');
    });

    it('should return milestone status for valid horse', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: mockUser.id,
        dateOfBirth: new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)) // 5 days old
      };

      const mockMilestoneEvaluations = [
        {
          id: 1,
          horseId: 1,
          milestoneType: MILESTONE_TYPES.IMPRINTING,
          score: 2,
          finalTrait: 'trusting',
          timestamp: new Date()
        }
      ];

      mockPrisma.horse.findUnique.mockResolvedValue(mockHorse);
      mockPrisma.milestoneTraitLog.findMany.mockResolvedValue(mockMilestoneEvaluations);

      const response = await request(app)
        .get('/api/traits/milestone-status/1')
        .set('Authorization', `Bearer ${mockAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Milestone status retrieved successfully');
      expect(response.body.data).toEqual(
        expect.objectContaining({
          horseId: 1,
          horseName: 'Test Horse',
          ageInDays: 5,
          availableMilestones: expect.arrayContaining([
            expect.objectContaining({
              milestoneType: expect.any(String),
              window: expect.objectContaining({
                start: expect.any(Number),
                end: expect.any(Number)
              }),
              isInWindow: expect.any(Boolean),
              isCompleted: expect.any(Boolean),
              isPastWindow: expect.any(Boolean),
              canEvaluate: expect.any(Boolean)
            })
          ]),
          completedEvaluations: mockMilestoneEvaluations,
          totalCompleted: 1,
          eligibleForEvaluation: true
        })
      );
    });
  });

  describe('GET /api/traits/milestone-definitions', () => {
    it('should return milestone definitions without authentication', async () => {
      const response = await request(app)
        .get('/api/traits/milestone-definitions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Milestone definitions retrieved successfully');
      expect(response.body.data).toEqual(
        expect.objectContaining({
          milestoneTypes: MILESTONE_TYPES,
          developmentalWindows: expect.any(Object),
          traitThresholds: expect.objectContaining({
            confirm: 3,
            deny: -3
          }),
          scoringFactors: expect.objectContaining({
            bondModifier: expect.any(String),
            taskConsistency: expect.any(String),
            careGapsPenalty: expect.any(String)
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      mockPrisma.horse.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/traits/evaluate-milestone')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .send({
          horseId: 1,
          milestoneType: MILESTONE_TYPES.IMPRINTING
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Internal server error during milestone evaluation');
    });
  });
});
