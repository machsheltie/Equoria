/**
 * 🔒 UNIT TESTS: Ownership Validation
 *
 * Tests for single-query ownership validation middleware including:
 * - Owned resources (should allow access)
 * - Not owned resources (should return 404)
 * - Non-existent resources (should return 404)
 * - Invalid resource IDs
 * - Batch ownership validation
 *
 * @module __tests__/unit/security/ownership-checks
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockUser, createMockHorse, createMockGroom } from '../../factories/index.mjs';

const prismaPath = '../../../../packages/database/prismaClient.mjs';
const prisma = {
  horse: {
    findFirst: jest.fn(),
    findUnique: jest.fn(), // Some logic might still use it
    findMany: jest.fn(),
  },
  groom: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  groomAssignment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  competitionResult: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  trainingLog: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock(prismaPath, () => ({
  default: prisma,
}), { virtual: true });

let moduleExports;
let requireOwnership, findOwnedResource, validateBatchOwnership;

beforeAll(async () => {
  moduleExports = await import('../../../middleware/ownership.mjs');
  ({ requireOwnership, findOwnedResource, validateBatchOwnership } = moduleExports);
});

describe('Ownership Validation Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: createMockUser({ id: 'user-1' }),
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('Owned Resource Scenarios', () => {
    it('should allow access to owned horse', async () => {
      const horse = createMockHorse({ id: 1, ownerId: 'user-1' });
      prisma.horse.findFirst.mockResolvedValue(horse);

      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse).toEqual(horse);
      expect(prisma.horse.findFirst).toHaveBeenCalledWith({
        where: { id: 1, ownerId: 'user-1' },
      });
    });

    it('should allow access to owned groom', async () => {
      const groom = createMockGroom({ id: 5, userId: 'user-1' });
      prisma.groom.findFirst.mockResolvedValue(groom);

      req.params.id = '5';
      const middleware = requireOwnership('groom');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.groom).toEqual(groom);
      expect(prisma.groom.findFirst).toHaveBeenCalledWith({
        where: { id: 5, userId: 'user-1' },
      });
    });

    it('should attach resource to request object and validatedResources', async () => {
      const horse = createMockHorse({ id: 10, ownerId: 'user-1', name: 'TestHorse' });
      prisma.horse.findFirst.mockResolvedValue(horse);

      req.params.id = '10';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(req.horse).toBeDefined();
      expect(req.validatedResources.horse).toEqual(horse);
      expect(req.horse.name).toBe('TestHorse');
    });

    it('should work with custom idParam', async () => {
      const horse = createMockHorse({ id: 20, ownerId: 'user-1' });
      prisma.horse.findFirst.mockResolvedValue(horse);

      req.params.horseId = '20';
      const middleware = requireOwnership('horse', { idParam: 'horseId' });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse.id).toBe(20);
    });
  });

  describe('Not Owned Resource Scenarios', () => {
    it('should return 404 for horse owned by different user', async () => {
      prisma.horse.findFirst.mockResolvedValue(null);

      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Horse not found',
        status: expect.anything(),
      });
    });

    it('should return 404 for groom owned by different user', async () => {
      prisma.groom.findFirst.mockResolvedValue(null);

      req.params.id = '5';
      const middleware = requireOwnership('groom');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Groom not found',
        status: expect.anything(),
      });
    });
  });

  describe('Resource Type Validation', () => {
    it('should handle training-session resource type (maps to trainingLog)', async () => {
      const session = { id: 1, horse: { ownerId: 'user-1' }, type: 'SPEED' };
      prisma.trainingLog.findFirst.mockResolvedValue(session);

      req.params.id = '1';
      const middleware = requireOwnership('training-session');

      await middleware(req, res, next);

      expect(prisma.trainingLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 1,
          horse: { ownerId: 'user-1' }
        }
      }));
    });

    it('should handle competition-entry resource type (maps to competitionResult)', async () => {
      const entry = { id: 1, horse: { ownerId: 'user-1' }, status: 'ENTERED' };
      prisma.competitionResult.findFirst.mockResolvedValue(entry);

      req.params.id = '1';
      const middleware = requireOwnership('competition-entry');

      await middleware(req, res, next);

      expect(prisma.competitionResult.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 1,
          horse: { ownerId: 'user-1' }
        }
      }));
    });
  });

  describe('findOwnedResource Helper Function', () => {
    it('should find owned horse using ownerId', async () => {
      const horse = createMockHorse({ id: 1, ownerId: 'user-1' });
      prisma.horse.findFirst.mockResolvedValue(horse);

      const result = await findOwnedResource('horse', 1, 'user-1');

      expect(result).toEqual(horse);
      expect(prisma.horse.findFirst).toHaveBeenCalledWith({
        where: { id: 1, ownerId: 'user-1' },
      });
    });

    it('should find owned groom using userId', async () => {
      const groom = createMockGroom({ id: 5, userId: 'user-1' });
      prisma.groom.findFirst.mockResolvedValue(groom);

      const result = await findOwnedResource('groom', 5, 'user-1');

      expect(result).toEqual(groom);
      expect(prisma.groom.findFirst).toHaveBeenCalledWith({
        where: { id: 5, userId: 'user-1' },
      });
    });
  });

  describe('validateBatchOwnership Helper Function', () => {
    it('should validate ownership of multiple horses using ownerId', async () => {
      const horses = [
        createMockHorse({ id: 1, ownerId: 'user-1' }),
        createMockHorse({ id: 2, ownerId: 'user-1' }),
      ];
      prisma.horse.findMany.mockResolvedValue(horses);

      const result = await validateBatchOwnership('horse', [1, 2], 'user-1');

      expect(result).toEqual(horses);
      expect(prisma.horse.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: { in: [1, 2] },
          ownerId: 'user-1',
        },
      }));
    });
  });
});