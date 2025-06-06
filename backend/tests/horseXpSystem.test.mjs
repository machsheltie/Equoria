/**
 * Horse XP System Tests
 *
 * Testing Philosophy: Balanced Mocking Approach
 * - Strategic external dependency mocking only (database operations via Prisma)
 * - Real business logic validation without artificial test environments
 * - Integration testing with actual database operations where appropriate
 * - No over-mocking of internal business logic or horse XP calculations
 *
 * Business Rules Tested:
 * - Horses earn XP from competition participation (separate from user XP)
 * - Every 100 Horse XP allows +1 stat point allocation to any horse stat
 * - Stat allocation validation and tracking
 * - Horse XP event logging and history tracking
 * - Integration with existing competition system
 *
 * Coverage:
 * - Horse XP earning from competitions
 * - Stat point allocation and validation
 * - Horse XP event logging
 * - Available stat points calculation
 * - Integration with competition rewards
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

jest.unstable_mockModule(join(__dirname, '../db/index.js'), () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
}));

// Import the module after mocking
const horseXpModel = await import(join(__dirname, '../models/horseXpModel.js'));

describe('Horse XP System - Core Business Logic', () => {
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

  describe('addXpToHorse', () => {
    it('should add XP to horse and calculate available stat points correctly', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        horseXp: 50,
        availableStatPoints: 0,
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        horseXp: 150,
        availableStatPoints: 1, // 150 XP = 1 stat point (100 XP per point)
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);
      mockPrismaHorseXpEvent.create.mockResolvedValue({
        id: 1,
        horseId: 1,
        amount: 100,
        reason: 'Competition participation',
        timestamp: new Date(),
      });

      const result = await horseXpModel.addXpToHorse(1, 100, 'Competition participation');

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(150);
      expect(result.availableStatPoints).toBe(1);
      expect(result.xpGained).toBe(100);
      expect(result.statPointsGained).toBe(1);

      // Verify database operations
      expect(mockPrismaHorse.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          horseXp: true,
          availableStatPoints: true,
        },
      });
      expect(mockPrismaHorse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          horseXp: 150,
          availableStatPoints: 1,
        },
      });
      expect(mockPrismaHorseXpEvent.create).toHaveBeenCalledWith({
        data: {
          horseId: 1,
          amount: 100,
          reason: 'Competition participation',
        },
      });
    });

    it('should handle multiple stat points correctly (200+ XP)', async () => {
      const mockHorse = {
        id: 1,
        horseXp: 50,
        availableStatPoints: 0,
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        horseXp: 250,
        availableStatPoints: 2, // 250 XP = 2 stat points
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);
      mockPrismaHorseXpEvent.create.mockResolvedValue({});

      const result = await horseXpModel.addXpToHorse(1, 200, 'Major competition win');

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(250);
      expect(result.availableStatPoints).toBe(2);
      expect(result.statPointsGained).toBe(2);
    });

    it('should preserve existing stat points when adding XP', async () => {
      const mockHorse = {
        id: 1,
        horseXp: 150,
        availableStatPoints: 1, // Already has 1 unspent point
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        horseXp: 250,
        availableStatPoints: 2, // Should have 2 total (1 existing + 1 new)
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);
      mockPrismaHorseXpEvent.create.mockResolvedValue({});

      const result = await horseXpModel.addXpToHorse(1, 100, 'Training session');

      expect(result.success).toBe(true);
      expect(result.availableStatPoints).toBe(2);
      expect(result.statPointsGained).toBe(1); // Only 1 new point gained
    });

    it('should handle validation errors properly', async () => {
      const result = await horseXpModel.addXpToHorse(null, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Horse ID is required');
      expect(mockPrismaHorse.findUnique).not.toHaveBeenCalled();
    });

    it('should handle horse not found error', async () => {
      mockPrismaHorse.findUnique.mockResolvedValue(null);

      const result = await horseXpModel.addXpToHorse(999, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Horse not found');
    });
  });

  describe('allocateStatPoint', () => {
    it('should allocate stat point and decrease available points', async () => {
      const mockHorse = {
        id: 1,
        name: 'Test Horse',
        speed: 75,
        availableStatPoints: 2,
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        speed: 76,
        availableStatPoints: 1,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);

      const result = await horseXpModel.allocateStatPoint(1, 'speed');

      expect(result.success).toBe(true);
      expect(result.newStatValue).toBe(76);
      expect(result.remainingStatPoints).toBe(1);

      expect(mockPrismaHorse.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          speed: { increment: 1 },
          availableStatPoints: { decrement: 1 },
        },
        select: {
          speed: true,
          availableStatPoints: true,
        },
      });
    });

    it('should reject allocation when no stat points available', async () => {
      const mockHorse = {
        id: 1,
        availableStatPoints: 0,
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);

      const result = await horseXpModel.allocateStatPoint(1, 'speed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No stat points available');
      expect(mockPrismaHorse.update).not.toHaveBeenCalled();
    });

    it('should validate stat names properly', async () => {
      const result = await horseXpModel.allocateStatPoint(1, 'invalidStat');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid stat name');
      expect(mockPrismaHorse.findUnique).not.toHaveBeenCalled();
    });

    it('should handle all valid stat names', async () => {
      const validStats = [
        'speed',
        'stamina',
        'agility',
        'balance',
        'precision',
        'intelligence',
        'boldness',
        'flexibility',
        'obedience',
        'focus',
      ];

      for (const stat of validStats) {
        const result = await horseXpModel.validateStatName(stat);
        expect(result).toBe(true);
      }
    });
  });

  describe('getHorseXpHistory', () => {
    it('should retrieve horse XP events with proper filtering', async () => {
      const mockEvents = [
        {
          id: 1,
          amount: 50,
          reason: 'Competition: 1st place',
          timestamp: new Date('2024-01-01'),
        },
        {
          id: 2,
          amount: 25,
          reason: 'Training session',
          timestamp: new Date('2024-01-02'),
        },
      ];

      mockPrismaHorseXpEvent.findMany.mockResolvedValue(mockEvents);

      const result = await horseXpModel.getHorseXpHistory(1, { limit: 10 });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].amount).toBe(50);

      expect(mockPrismaHorseXpEvent.findMany).toHaveBeenCalledWith({
        where: { horseId: 1 },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0,
      });
    });
  });
});

describe('Horse XP System - Integration with Competition System', () => {
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

  describe('Competition XP Awards', () => {
    it('should award horse XP based on competition performance', async () => {
      // Test the integration point where competitions award horse XP
      const mockCompetitionResult = {
        horseId: 1,
        placement: '1st',
        score: 85.5,
        discipline: 'Dressage',
      };

      // XP calculation: base XP + placement bonus
      const expectedXP = 20 + 10; // 20 base + 10 for 1st place

      const mockHorse = {
        id: 1,
        horseXp: 0,
        availableStatPoints: 0,
      };

      const mockUpdatedHorse = {
        ...mockHorse,
        horseXp: expectedXP,
        availableStatPoints: 0, // Not enough for stat point yet
      };

      mockPrismaHorse.findUnique.mockResolvedValue(mockHorse);
      mockPrismaHorse.update.mockResolvedValue(mockUpdatedHorse);
      mockPrismaHorseXpEvent.create.mockResolvedValue({});

      const result = await horseXpModel.awardCompetitionXp(
        mockCompetitionResult.horseId,
        mockCompetitionResult.placement,
        mockCompetitionResult.discipline,
      );

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(expectedXP);
      expect(result.currentXP).toBe(expectedXP);
    });
  });
});
