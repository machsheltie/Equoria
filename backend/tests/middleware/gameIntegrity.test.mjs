/**
 * 🧪 COMPREHENSIVE TEST: Game Integrity Middleware
 *
 * Tests all game integrity middleware functions that prevent exploits and cheats
 * in the horse game system including stat manipulation, duplication, breeding exploits,
 * training exploits, financial transaction validation, and timestamp manipulation.
 *
 * 📋 COVERAGE SCOPE:
 * - validateStatChanges: Prevents unauthorized stat modifications
 * - preventDuplication: Blocks resource duplication exploits
 * - validateBreeding: Validates breeding operations and ownership
 * - validateTraining: Validates training sessions and cooldowns
 * - validateTransaction: Prevents financial exploits
 * - validateTimestamp: Blocks time-based manipulation
 *
 * 🎯 TEST CATEGORIES:
 * 1. Stat Validation - Protected stats, allowed modifications, range validation
 * 2. Duplication Prevention - Rapid requests, operation tracking
 * 3. Breeding Validation - Ownership, biology, health, cooldowns
 * 4. Training Validation - Ownership, age requirements, health checks
 * 5. Transaction Validation - Balance checks, limits, target validation
 * 6. Timestamp Validation - Clock drift detection, server-side enforcement
 * 7. Error Handling - Missing data, database errors
 * 8. Security - Exploit prevention, edge cases
 *
 * 🔄 TESTING APPROACH:
 * ✅ REAL: Middleware logic, validation rules, security checks
 * 🔧 MOCK: Prisma database, logger, request/response objects
 *
 * 💡 TEST STRATEGY: Unit tests with mocked database to ensure
 *    comprehensive coverage of all anti-cheat and validation logic
 */

import {
  validateStatChanges,
  preventDuplication,
  validateBreeding,
  validateTraining,
  validateTransaction,
  validateTimestamp,
} from '../../middleware/gameIntegrity.mjs';
import prisma from '../../db/index.mjs';
import { ApiResponse } from '../../utils/apiResponse.mjs';

// Mock dependencies
jest.mock('../../db/index.mjs', () => ({
  default: {
    horse: {
      findUnique: jest.fn(),
    },
    player: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/logger.mjs', () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../constants/schema.mjs', () => ({
  isValidDiscipline: jest.fn(() => true),
}));

describe('🛡️ Game Integrity Middleware Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: { id: 1 },
      method: 'POST',
      path: '/test',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('validateStatChanges Middleware', () => {
    describe('✅ Allowed Stat Modifications', () => {
      test('should allow modification of allowed fields', () => {
        mockReq.body = {
          speed: 75,
          agility: 80,
        };

        const middleware = validateStatChanges(['speed', 'agility']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should allow valid stat values within range', () => {
        mockReq.body = {
          speed: 50,
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should allow minimum stat value (0)', () => {
        mockReq.body = {
          speed: 0,
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should allow maximum stat value (100)', () => {
        mockReq.body = {
          speed: 100,
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should pass when no stats in request body', () => {
        mockReq.body = {
          name: 'Test Horse',
          color: 'Brown',
        };

        const middleware = validateStatChanges([]);
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('❌ Unauthorized Stat Modifications', () => {
      test('should block direct modification of protected stats', () => {
        mockReq.body = {
          speed: 100,
          strength: 95,
        };

        const middleware = validateStatChanges([]); // No stats allowed
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Direct stat modification not allowed',
          }),
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should block modification of precision stat', () => {
        mockReq.body = {
          precision: 90,
        };

        const middleware = validateStatChanges([]);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      test('should block modification of total_earnings', () => {
        mockReq.body = {
          total_earnings: 1000000,
        };

        const middleware = validateStatChanges([]);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      test('should block modification of level directly', () => {
        mockReq.body = {
          level: 99,
        };

        const middleware = validateStatChanges([]);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      test('should block multiple unauthorized stat modifications', () => {
        mockReq.body = {
          speed: 100,
          strength: 100,
          agility: 100,
          endurance: 100,
        };

        const middleware = validateStatChanges([]);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });
    });

    describe('❌ Invalid Stat Values', () => {
      test('should reject stat value below 0', () => {
        mockReq.body = {
          speed: -10,
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'speed must be between 0 and 100',
          }),
        );
      });

      test('should reject stat value above 100', () => {
        mockReq.body = {
          speed: 150,
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'speed must be between 0 and 100',
          }),
        );
      });

      test('should reject non-numeric stat value', () => {
        mockReq.body = {
          speed: 'invalid',
        };

        const middleware = validateStatChanges(['speed']);
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });
  });

  describe('preventDuplication Middleware', () => {
    describe('✅ Normal Operations', () => {
      test('should allow first operation', async () => {
        mockReq.body = { amount: 100 };

        const middleware = preventDuplication('transaction');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should allow operations after cooldown period (5+ seconds)', async () => {
        mockReq.body = { amount: 100 };

        const middleware = preventDuplication('transaction');

        // First operation
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);

        // Wait for cooldown (simulate 5+ seconds with mock)
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);

        // Second operation should succeed
        mockNext.mockClear();
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);

        jest.restoreAllMocks();
      });

      test('should allow operations with different data', async () => {
        const middleware = preventDuplication('transaction');

        mockReq.body = { amount: 100 };
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);

        mockNext.mockClear();
        mockReq.body = { amount: 200 }; // Different data
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
      });
    });

    describe('❌ Duplication Prevention', () => {
      test('should block rapid duplicate operations within 5 seconds', async () => {
        mockReq.body = { amount: 100 };

        const middleware = preventDuplication('transaction');

        // First operation
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();

        // Immediate duplicate operation
        mockNext.mockClear();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(429);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Operation too recent. Please wait before trying again.',
          }),
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should detect duplication exploit with identical requests', async () => {
        mockReq.body = {
          horseId: 1,
          action: 'breed',
          targetId: 2,
        };

        const middleware = preventDuplication('breeding');

        // First request
        await middleware(mockReq, mockRes, mockNext);

        // Rapid duplicate (exploitation attempt)
        mockNext.mockClear();
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(429);
      });
    });
  });

  describe('validateBreeding Middleware', () => {
    describe('✅ Valid Breeding Operations', () => {
      test('should allow valid breeding with owned horses', async () => {
        mockReq.body = {
          sireId: 1,
          damId: 2,
        };

        const mockSire = {
          id: 1,
          sex: 'Stallion',
          age: 5,
          playerId: 1,
          ownerId: 1,
          stud_status: 'Private',
          health_status: 'Healthy',
          last_bred_date: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
        };

        const mockDam = {
          id: 2,
          sex: 'Mare',
          age: 4,
          playerId: 1,
          ownerId: 1,
          health_status: 'Healthy',
          last_bred_date: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
        };

        prisma.horse.findUnique
          .mockResolvedValueOnce(mockSire)
          .mockResolvedValueOnce(mockDam);

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.validatedHorses).toEqual({ sire: mockSire, dam: mockDam });
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should allow breeding with public stud', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        const mockSire = {
          id: 1,
          sex: 'Stallion',
          age: 5,
          playerId: 2, // Different owner
          ownerId: 2,
          stud_status: 'Public Stud', // Public
          health_status: 'Healthy',
          last_bred_date: null,
        };

        const mockDam = {
          id: 2,
          sex: 'Mare',
          age: 4,
          playerId: 1, // User owns dam
          ownerId: 1,
          health_status: 'Healthy',
          last_bred_date: null,
        };

        prisma.horse.findUnique
          .mockResolvedValueOnce(mockSire)
          .mockResolvedValueOnce(mockDam);

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should allow breeding when no previous breeding date', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 3,
            playerId: 1,
            ownerId: 1,
            stud_status: 'Private',
            health_status: 'Healthy',
            last_bred_date: null,
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 3,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: null,
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('❌ Breeding Validation Failures', () => {
      test('should reject when sireId missing', async () => {
        mockReq.body = { damId: 2 };

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Both sire and dam IDs required',
          }),
        );
      });

      test('should reject when damId missing', async () => {
        mockReq.body = { sireId: 1 };

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject when sire not found', async () => {
        mockReq.body = { sireId: 999, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 2 });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'One or both horses not found',
          }),
        );
      });

      test('should reject when dam not found', async () => {
        mockReq.body = { sireId: 1, damId: 999 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({ id: 1 })
          .mockResolvedValueOnce(null);

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
      });
    });

    describe('❌ Ownership Violations', () => {
      test('should reject breeding with unowned private stud', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 2, // Different owner
            ownerId: 2,
            stud_status: 'Private', // Not public
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'You do not have access to this sire',
          }),
        );
      });

      test('should reject breeding with unowned mare', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            stud_status: 'Private',
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 2, // Different owner
            ownerId: 2,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'You do not own this mare',
          }),
        );
      });
    });

    describe('❌ Biological Validation', () => {
      test('should reject when sire is not male', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Mare', // Female!
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Sire must be a stallion or colt',
          }),
        );
      });

      test('should reject when dam is not female', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Stallion', // Male!
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Dam must be a mare or filly',
          }),
        );
      });

      test('should reject when sire too young (under 3)', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 2, // Too young
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Both horses must be at least 3 years old',
          }),
        );
      });

      test('should reject when dam too young', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 1, // Too young
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });

    describe('❌ Health and Cooldown Validation', () => {
      test('should reject breeding when sire injured', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Injured',
            last_bred_date: null,
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: null,
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Injured horses cannot breed',
          }),
        );
      });

      test('should reject breeding when dam injured', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: null,
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Injured',
            last_bred_date: null,
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject breeding when sire in cooldown period', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        const recentBreedDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: recentBreedDate,
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: null,
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Sire is still in breeding cooldown',
          }),
        );
      });

      test('should reject breeding when dam in cooldown period', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        const recentBreedDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago

        prisma.horse.findUnique
          .mockResolvedValueOnce({
            id: 1,
            sex: 'Stallion',
            age: 5,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: null,
          })
          .mockResolvedValueOnce({
            id: 2,
            sex: 'Mare',
            age: 4,
            playerId: 1,
            ownerId: 1,
            health_status: 'Healthy',
            last_bred_date: recentBreedDate,
          });

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Dam is still in breeding cooldown',
          }),
        );
      });
    });

    describe('❌ Database Errors', () => {
      test('should handle database error gracefully', async () => {
        mockReq.body = { sireId: 1, damId: 2 };

        prisma.horse.findUnique.mockRejectedValue(new Error('Database connection failed'));

        await validateBreeding(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Breeding validation failed',
          }),
        );
      });
    });
  });

  describe('validateTraining Middleware', () => {
    describe('✅ Valid Training Operations', () => {
      test('should allow valid training session', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Dressage',
        };

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 5,
          playerId: 1,
          ownerId: 1,
          health_status: 'Healthy',
          trainingCooldown: null,
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should allow training when cooldown expired', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Show Jumping',
        };

        const expiredCooldown = new Date(Date.now() - 1000); // Past

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 5,
          playerId: 1,
          ownerId: 1,
          health_status: 'Healthy',
          trainingCooldown: expiredCooldown,
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('❌ Training Validation Failures', () => {
      test('should reject when horseId missing', async () => {
        mockReq.body = { discipline: 'Dressage' };

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Horse ID and discipline required',
          }),
        );
      });

      test('should reject when discipline missing', async () => {
        mockReq.body = { horseId: 1 };

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject when horse not found', async () => {
        mockReq.body = {
          horseId: 999,
          discipline: 'Dressage',
        };

        prisma.horse.findUnique.mockResolvedValue(null);

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Horse not found',
          }),
        );
      });

      test('should reject when user does not own horse', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Dressage',
        };

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 5,
          playerId: 2, // Different owner
          ownerId: 2,
          health_status: 'Healthy',
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'You do not own this horse',
          }),
        );
      });

      test('should reject when horse too young (under 3)', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Dressage',
        };

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 2, // Too young
          playerId: 1,
          ownerId: 1,
          health_status: 'Healthy',
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Horse must be at least 3 years old to train',
          }),
        );
      });

      test('should reject when horse injured', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Dressage',
        };

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 5,
          playerId: 1,
          ownerId: 1,
          health_status: 'Injured',
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Injured horses cannot train',
          }),
        );
      });

      test('should reject when horse in training cooldown', async () => {
        mockReq.body = {
          horseId: 1,
          discipline: 'Dressage',
        };

        const futureCooldown = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

        prisma.horse.findUnique.mockResolvedValue({
          id: 1,
          age: 5,
          playerId: 1,
          ownerId: 1,
          health_status: 'Healthy',
          trainingCooldown: futureCooldown,
        });

        await validateTraining(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Horse is in training cooldown'),
          }),
        );
      });
    });
  });

  describe('validateTransaction Middleware', () => {
    describe('✅ Valid Transactions', () => {
      test('should allow transaction with sufficient funds', async () => {
        mockReq.body = {
          amount: 500,
        };

        prisma.player.findUnique.mockResolvedValue({
          id: 1,
          money: 1000,
        });

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should allow incoming transactions without balance check', async () => {
        mockReq.body = {
          amount: 1000,
        };

        prisma.player.findUnique.mockResolvedValue({
          id: 1,
          money: 100, // Low balance
        });

        const middleware = validateTransaction('receive'); // Not in checked list
        await middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('❌ Transaction Validation Failures', () => {
      test('should reject when amount is missing', async () => {
        mockReq.body = {};

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid transaction amount',
          }),
        );
      });

      test('should reject when amount is zero', async () => {
        mockReq.body = { amount: 0 };

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject when amount is negative', async () => {
        mockReq.body = { amount: -100 };

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject when insufficient funds', async () => {
        mockReq.body = { amount: 1500 };

        prisma.player.findUnique.mockResolvedValue({
          id: 1,
          money: 1000, // Not enough
        });

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Insufficient funds',
          }),
        );
      });

      test('should reject large transactions over 100000', async () => {
        mockReq.body = { amount: 150000 };

        prisma.player.findUnique.mockResolvedValue({
          id: 1,
          money: 200000, // Has the funds
        });

        const middleware = validateTransaction('purchase');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Transaction amount exceeds limit',
          }),
        );
      });

      test('should reject transfer to self', async () => {
        mockReq.body = {
          amount: 100,
          targetUserId: 1, // Same as req.user.id
        };

        prisma.player.findUnique.mockResolvedValue({
          id: 1,
          money: 1000,
        });

        const middleware = validateTransaction('transfer');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Cannot transfer to yourself',
          }),
        );
      });

      test('should reject transfer to non-existent user', async () => {
        mockReq.body = {
          amount: 100,
          targetUserId: 999,
        };

        prisma.player.findUnique
          .mockResolvedValueOnce({ id: 1, money: 1000 }) // Source user
          .mockResolvedValueOnce(null); // Target user not found

        const middleware = validateTransaction('transfer');
        await middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Target user not found',
          }),
        );
      });
    });
  });

  describe('validateTimestamp Middleware', () => {
    describe('✅ Valid Timestamps', () => {
      test('should accept current server time', () => {
        mockReq.body = {
          timestamp: new Date().toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.serverTimestamp).toBeInstanceOf(Date);
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      test('should accept timestamp within 5 minute window', () => {
        const validTimestamp = new Date(Date.now() - 4 * 60 * 1000); // 4 minutes ago
        mockReq.body = {
          timestamp: validTimestamp.toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should accept timestamp in future within tolerance', () => {
        const futureTimestamp = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes future
        mockReq.body = {
          timestamp: futureTimestamp.toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      test('should work without timestamp in request', () => {
        mockReq.body = {};

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.serverTimestamp).toBeInstanceOf(Date);
      });
    });

    describe('❌ Timestamp Manipulation Detection', () => {
      test('should reject timestamp more than 5 minutes in past', () => {
        const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        mockReq.body = {
          timestamp: oldTimestamp.toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid timestamp',
          }),
        );
        expect(mockNext).not.toHaveBeenCalled();
      });

      test('should reject timestamp more than 5 minutes in future', () => {
        const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes future
        mockReq.body = {
          timestamp: futureTimestamp.toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should reject very old timestamp (time travel exploit)', () => {
        const ancientTimestamp = new Date('2020-01-01');
        mockReq.body = {
          timestamp: ancientTimestamp.toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      test('should always set server timestamp regardless of client value', () => {
        mockReq.body = {
          timestamp: new Date('2020-01-01').toISOString(),
        };

        validateTimestamp(mockReq, mockRes, mockNext);

        // Even though validation fails, server timestamp should be set
        expect(mockReq.serverTimestamp).toBeInstanceOf(Date);
      });
    });
  });
});
