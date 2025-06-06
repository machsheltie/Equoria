/**
 * Horse XP Controller Tests
 *
 * Testing Philosophy: Balanced Mocking Approach
 * - Strategic external dependency mocking only (database operations, authentication)
 * - Real business logic validation through controller layer
 * - Integration testing with actual HTTP requests where appropriate
 * - No over-mocking of internal business logic or horse XP calculations
 *
 * Business Rules Tested:
 * - Horse XP viewing endpoints with proper authentication
 * - Stat point allocation endpoints with validation
 * - Horse XP history retrieval with pagination
 * - Authorization checks (users can only manage their own horses)
 * - Input validation and error handling
 *
 * API Endpoints Tested:
 * - GET /api/horses/:horseId/xp - Get horse XP status
 * - POST /api/horses/:horseId/allocate-stat - Allocate stat point
 * - GET /api/horses/:horseId/xp-history - Get horse XP history
 * - POST /api/horses/:horseId/award-xp - Award XP (admin/system use)
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Prisma client
const mockPrismaHorse = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaHorseXpEvent = {
  create: jest.fn(),
  findMany: jest.fn(),
};

const mockPrisma = {
  horse: mockPrismaHorse,
  horseXpEvent: mockPrismaHorseXpEvent,
};

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule(join(__dirname, '../db/index.mjs'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the controller directly for testing
const horseXpController = await import(join(__dirname, '../controllers/horseXpController.mjs'));

describe('Horse XP Controller - API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaHorse.findUnique.mockClear();
    mockPrismaHorse.update.mockClear();
    mockPrismaHorseXpEvent.create.mockClear();
    mockPrismaHorseXpEvent.findMany.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getHorseXpStatus', () => {
    it('should return horse XP status for authorized user', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: 'user-123',
        horseXp: 150,
        availableStatPoints: 1,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);

      const req = {
        params: { horseId: '1' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.getHorseXpStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          horseId: 1,
          horseName: 'Test Horse',
          currentXP: 150,
          availableStatPoints: 1,
          nextStatPointAt: 200, // Next 100 XP milestone
          xpToNextStatPoint: 50,
        },
      });

      expect(mockPrismaHorse.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          userId: true,
          horseXp: true,
          availableStatPoints: true,
        },
      });
    });

    it('should reject unauthorized access to other users horses', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: 'other-user',
        horseXp: 150,
        availableStatPoints: 1,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);

      const req = {
        params: { horseId: '1' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.getHorseXpStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'You are not authorized to view this horse',
      });
    });

    it('should handle horse not found', async () => {
      mockPrismaHorse.findUnique.mockResolvedValue(null);

      const req = {
        params: { horseId: '999' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.getHorseXpStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Horse not found',
      });
    });
  });

  describe('allocateStatPoint', () => {
    it('should allocate stat point successfully', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: 'user-123',
        speed: 75,
        availableStatPoints: 2,
      };

      const mockUpdatedHorse = {
        speed: 76,
        availableStatPoints: 1,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);

      const req = {
        params: { horseId: '1' },
        body: { statName: 'speed' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.allocateStatPoint(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          statName: 'speed',
          newStatValue: 76,
          remainingStatPoints: 1,
        },
      });
    });

    it('should validate stat name', async () => {
      const req = {
        params: { horseId: '1' },
        body: { statName: 'invalidStat' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.allocateStatPoint(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Invalid stat name'),
      });
    });

    it('should require stat name in request body', async () => {
      const req = {
        params: { horseId: '1' },
        body: {},
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.allocateStatPoint(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'statName is required',
      });
    });
  });

  describe('getHorseXpHistory', () => {
    it('should return horse XP history with pagination', async () => {
      const mockHorse = {
        id: 1,
        userId: 'user-123',
      };

      const mockEvents = [
        {
          id: 1,
          amount: 30,
          reason: 'Competition: 1st place in Dressage',
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 2,
          amount: 20,
          reason: 'Training session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorseXpEvent.findMany.mockResolvedValue(mockEvents);

      const req = {
        params: { horseId: '1' },
        query: { limit: '10', offset: '0' },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.getHorseXpHistory(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          events: mockEvents,
          count: 2,
          pagination: {
            limit: 10,
            offset: 0,
            hasMore: false,
          },
        },
      });
    });
  });

  describe('awardXpToHorse', () => {
    it('should award XP to horse (system/admin use)', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        userId: 'user-123',
        horseXp: 50,
        availableStatPoints: 0,
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        horseXp: 100,
        availableStatPoints: 1,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);
      mockPrismaHorseXpEvent.create.mockResolvedValue({});

      const req = {
        params: { horseId: '1' },
        body: {
          amount: 50,
          reason: 'Competition participation',
        },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.awardXpToHorse(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          currentXP: 100,
          availableStatPoints: 1,
          xpGained: 50,
          statPointsGained: 1,
        },
      });
    });

    it('should validate XP amount', async () => {
      const req = {
        params: { horseId: '1' },
        body: {
          amount: -10,
          reason: 'Test',
        },
        user: { id: 'user-123' },
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await horseXpController.awardXpToHorse(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'XP amount must be a positive number',
      });
    });
  });
});
