/**
 * 🧪 UNIT TEST: XP Log Model - Experience Point Event Tracking
 *
 * This test validates the XP log model's functionality for tracking, logging,
 * and analyzing user experience point events across the game system.
 *
 * 📋 BUSINESS RULES TESTED:
 * - XP event logging with required fields (userId, amount, reason, timestamp)
 * - Input validation: userId required, amount must be number, reason must be string
 * - Negative XP support for penalties and rule violations
 * - User XP event retrieval with pagination and date filtering
 * - XP summary calculations: total gained, total lost, net total, event count
 * - Recent XP events across all users for admin analytics
 * - Date range filtering for historical analysis
 * - Database error handling with descriptive logging
 * - Proper ordering: newest events first (desc timestamp)
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. logXpEvent() - XP event creation with validation and logging
 * 2. getUserXpEvents() - User XP history with pagination and date filters
 * 3. getUserXpSummary() - XP statistics calculation with date range support
 * 4. getRecentXpEvents() - Global XP activity feed for analytics
 * 5. Input validation for all functions
 * 6. Database error handling scenarios
 * 7. Edge cases: negative XP, empty results, date boundaries
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All business logic, validation rules, calculation algorithms, error handling
 * ✅ REAL: XP summary calculations, date filtering logic, pagination handling
 * 🔧 MOCK: Database operations (Prisma calls) - external dependency
 * 🔧 MOCK: Logger calls - external dependency for audit trails
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on XP tracking
 *    business logic while ensuring predictable test outcomes for analytics calculations
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock Prisma client
const mockPrismaXpEvent = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
};

const mockPrisma = {
  xpEvent: mockPrismaXpEvent,
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

// Import the module after mocking
const { logXpEvent, getUserXpEvents, getUserXpSummary, getRecentXpEvents } = await import(
  join(__dirname, '../models/xpLogModel.mjs')
);

describe('📊 UNIT: XP Log Model - Experience Point Event Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaXpEvent.create.mockClear();
    mockPrismaXpEvent.findMany.mockClear();
    mockPrismaXpEvent.findUnique.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  describe('logXpEvent', () => {
    it('should log XP event successfully', async () => {
      const mockXpEvent = {
        id: 1,
        userId: 'user-123',
        amount: 5,
        reason: 'Trained horse in Dressage',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      };

      mockPrismaXpEvent.create.mockResolvedValue(mockXpEvent);

      const result = await logXpEvent({
        userId: 'user-123',
        amount: 5,
        reason: 'Trained horse in Dressage',
      });

      expect(mockPrismaXpEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          amount: 5,
          reason: 'Trained horse in Dressage',
        },
      });

      expect(result).toEqual({
        id: 1,
        userId: 'user-123',
        amount: 5,
        reason: 'Trained horse in Dressage',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[xpLogModel.logXpEvent] Logging XP event: User user-123, Amount: 5, Reason: Trained horse in Dressage',
      );
    });

    it('should validate required parameters', async () => {
      // Test missing userId
      await expect(
        logXpEvent({
          amount: 5,
          reason: 'Test reason',
        }),
      ).rejects.toThrow('User ID is required');

      // Test invalid amount
      await expect(
        logXpEvent({
          userId: 'user-123',
          amount: 'invalid',
          reason: 'Test reason',
        }),
      ).rejects.toThrow('Amount must be a number');

      // Test missing reason
      await expect(
        logXpEvent({
          userId: 'user-123',
          amount: 5,
        }),
      ).rejects.toThrow('Reason is required and must be a string');

      expect(mockPrismaXpEvent.create).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaXpEvent.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        logXpEvent({
          userId: 'user-123',
          amount: 5,
          reason: 'Test reason',
        }),
      ).rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[xpLogModel.logXpEvent] Error logging XP event: Database connection failed',
      );
    });

    it('should handle negative XP amounts', async () => {
      const mockXpEvent = {
        id: 2,
        userId: 'user-123',
        amount: -10,
        reason: 'XP penalty for rule violation',
        timestamp: new Date('2024-01-01T10:00:00Z'),
      };

      mockPrismaXpEvent.create.mockResolvedValue(mockXpEvent);

      const result = await logXpEvent({
        userId: 'user-123',
        amount: -10,
        reason: 'XP penalty for rule violation',
      });

      expect(result.amount).toBe(-10);
      expect(mockPrismaXpEvent.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          amount: -10,
          reason: 'XP penalty for rule violation',
        },
      });
    });
  });

  describe('getUserXpEvents', () => {
    it('should retrieve XP events for a user', async () => {
      const mockEvents = [
        {
          id: 1,
          userId: 'user-123',
          amount: 20,
          reason: '1st place with horse Nova in Racing',
          timestamp: new Date('2024-01-01T12:00:00Z'),
        },
        {
          id: 2,
          userId: 'user-123',
          amount: 5,
          reason: 'Trained horse in Dressage',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaXpEvent.findMany.mockResolvedValue(mockEvents);

      const result = await getUserXpEvents('user-123');

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { timestamp: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result).toEqual(mockEvents);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[xpLogModel.getUserXpEvents] Getting XP events for user user-123, limit: 50, offset: 0',
      );
    });

    it('should handle date filters', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-02T00:00:00Z');

      mockPrismaXpEvent.findMany.mockResolvedValue([]);

      await getUserXpEvents('user-123', {
        limit: 10,
        offset: 5,
        startDate,
        endDate,
      });

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('getUserXpSummary', () => {
    it('should calculate XP summary correctly', async () => {
      const mockEvents = [
        { amount: 20 },
        { amount: 15 },
        { amount: 5 },
        { amount: -5 },
        { amount: 10 },
      ];

      mockPrismaXpEvent.findMany.mockResolvedValue(mockEvents);

      const result = await getUserXpSummary('user-123');

      expect(result).toEqual({
        totalGained: 50, // 20 + 15 + 5 + 10
        totalLost: 5, // abs(-5)
        netTotal: 45, // 20 + 15 + 5 - 5 + 10
        totalEvents: 5,
      });

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        select: { amount: true },
      });
    });

    it('should handle empty results', async () => {
      mockPrismaXpEvent.findMany.mockResolvedValue([]);

      const result = await getUserXpSummary('user-123');

      expect(result).toEqual({
        totalGained: 0,
        totalLost: 0,
        netTotal: 0,
        totalEvents: 0,
      });
    });

    it('should handle date filters in summary', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-02T00:00:00Z');

      mockPrismaXpEvent.findMany.mockResolvedValue([]);

      await getUserXpSummary('user-123', startDate, endDate);

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { amount: true },
      });
    });
  });

  describe('getRecentXpEvents', () => {
    it('should retrieve recent XP events across all users', async () => {
      const mockEvents = [
        {
          id: 3,
          userId: 'user-456',
          amount: 15,
          reason: '2nd place with horse Star in Jumping',
          timestamp: new Date('2024-01-01T14:00:00Z'),
        },
        {
          id: 2,
          userId: 'user-123',
          amount: 5,
          reason: 'Trained horse in Dressage',
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      mockPrismaXpEvent.findMany.mockResolvedValue(mockEvents);

      const result = await getRecentXpEvents({ limit: 10, offset: 0 });

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        take: 10,
        skip: 0,
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

      expect(result).toEqual(mockEvents);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[xpLogModel.getRecentXpEvents] Getting recent XP events, limit: 10, offset: 0',
      );
    });

    it('should use default options', async () => {
      mockPrismaXpEvent.findMany.mockResolvedValue([]);

      await getRecentXpEvents();

      expect(mockPrismaXpEvent.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
        take: 100,
        skip: 0,
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    });
  });
});
