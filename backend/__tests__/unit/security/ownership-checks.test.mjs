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

import { requireOwnership, findOwnedResource, validateBatchOwnership } from '../../../middleware/ownership.mjs';
import { createMockUser, createMockHorse, createMockGroom } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// Mock Prisma
jest.mock('../../../../packages/database/prismaClient.mjs', () => ({
  horse: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  groom: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  foal: {
    findUnique: jest.fn(),
  },
  trainingSession: {
    findUnique: jest.fn(),
  },
  competitionEntry: {
    findUnique: jest.fn(),
  },
}));

describe('Ownership Validation Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: createMockUser({ id: 1 }),
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
      const horse = createMockHorse({ id: 1, userId: 1 });
      prisma.horse.findUnique.mockResolvedValue(horse);

      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse).toEqual(horse);
      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
    });

    it('should allow access to owned groom', async () => {
      const groom = createMockGroom({ id: 5, userId: 1 });
      prisma.groom.findUnique.mockResolvedValue(groom);

      req.params.id = '5';
      const middleware = requireOwnership('groom');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.groom).toEqual(groom);
    });

    it('should attach resource to request object', async () => {
      const horse = createMockHorse({ id: 10, userId: 1, name: 'TestHorse' });
      prisma.horse.findUnique.mockResolvedValue(horse);

      req.params.id = '10';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(req.horse).toBeDefined();
      expect(req.horse.name).toBe('TestHorse');
      expect(req.horse.userId).toBe(1);
    });

    it('should work with custom idParam', async () => {
      const horse = createMockHorse({ id: 20, userId: 1 });
      prisma.horse.findUnique.mockResolvedValue(horse);

      req.params.horseId = '20'; // Custom param name
      const middleware = requireOwnership('horse', { idParam: 'horseId' });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse.id).toBe(20);
    });

    it('should include relations when specified', async () => {
      const horse = createMockHorse({
        id: 1,
        userId: 1,
        traits: { strength: 50 },
      });
      prisma.horse.findUnique.mockResolvedValue(horse);

      req.params.id = '1';
      const middleware = requireOwnership('horse', {
        include: ['traits'],
      });

      await middleware(req, res, next);

      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        include: { traits: true },
      });
      expect(req.horse.traits).toBeDefined();
    });
  });

  describe('Not Owned Resource Scenarios', () => {
    it('should return 404 for horse owned by different user', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

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
      prisma.groom.findUnique.mockResolvedValue(null);

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

    it('should not disclose ownership information in error message', async () => {
      // Security: Should return same error for "not owned" as "doesn't exist"
      prisma.horse.findUnique.mockResolvedValue(null);

      req.params.id = '999';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Horse not found', // Generic message
        status: expect.anything(),
      });
    });

    it('should query with both id AND userId in WHERE clause', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

      req.user.id = 42;
      req.params.id = '10';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: {
          id: 10,
          userId: 42, // Both conditions in single query
        },
      });
    });
  });

  describe('Non-Existent Resource Scenarios', () => {
    it('should return 404 for non-existent horse', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

      req.params.id = '99999';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Horse not found',
        status: expect.anything(),
      });
    });

    it('should return 404 for non-existent foal', async () => {
      prisma.foal.findUnique.mockResolvedValue(null);

      req.params.id = '1';
      const middleware = requireOwnership('foal');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should allow null resource when required=false', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

      req.params.id = '1';
      const middleware = requireOwnership('horse', { required: false });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse).toBeUndefined();
    });
  });

  describe('Invalid Resource ID Scenarios', () => {
    it('should return 400 for non-numeric ID', async () => {
      req.params.id = 'abc';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid horse ID',
        status: expect.anything(),
      });
    });

    it('should return 400 for negative ID', async () => {
      req.params.id = '-5';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for decimal ID', async () => {
      req.params.id = '1.5';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for ID with special characters', async () => {
      req.params.id = '1; DROP TABLE horses;';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 when user not authenticated', async () => {
      req.user = null;
      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
        status: expect.anything(),
      });
    });

    it('should return 401 when user.id is missing', async () => {
      req.user = { email: 'test@example.com' }; // Missing id
      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('findOwnedResource Helper Function', () => {
    it('should find owned resource', async () => {
      const horse = createMockHorse({ id: 1, userId: 1 });
      prisma.horse.findUnique.mockResolvedValue(horse);

      const result = await findOwnedResource('horse', 1, 1);

      expect(result).toEqual(horse);
      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
    });

    it('should return null for not owned resource', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

      const result = await findOwnedResource('horse', 1, 2);

      expect(result).toBeNull();
    });

    it('should include relations when specified', async () => {
      const horse = createMockHorse({ id: 1, userId: 1, traits: {} });
      prisma.horse.findUnique.mockResolvedValue(horse);

      const result = await findOwnedResource('horse', 1, 1, {
        include: ['traits'],
      });

      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
        include: { traits: true },
      });
    });

    it('should handle database errors gracefully', async () => {
      prisma.horse.findUnique.mockRejectedValue(new Error('Database connection lost'));

      await expect(findOwnedResource('horse', 1, 1)).rejects.toThrow('Database connection lost');
    });
  });

  describe('validateBatchOwnership Helper Function', () => {
    it('should validate ownership of multiple resources', async () => {
      const horses = [
        createMockHorse({ id: 1, userId: 1 }),
        createMockHorse({ id: 2, userId: 1 }),
        createMockHorse({ id: 3, userId: 1 }),
      ];
      prisma.horse.findMany.mockResolvedValue(horses);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 1);

      expect(result).toEqual(horses);
      expect(result.length).toBe(3);
      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2, 3] },
          userId: 1,
        },
      });
    });

    it('should return partial results when some resources not owned', async () => {
      // User 1 owns horses 1 and 3, but not 2
      const horses = [
        createMockHorse({ id: 1, userId: 1 }),
        createMockHorse({ id: 3, userId: 1 }),
      ];
      prisma.horse.findMany.mockResolvedValue(horses);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 1);

      expect(result.length).toBe(2); // Only 2 of 3 horses owned
      expect(result.map(h => h.id)).toEqual([1, 3]);
    });

    it('should return empty array when no resources owned', async () => {
      prisma.horse.findMany.mockResolvedValue([]);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 2);

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should handle empty resource ID array', async () => {
      prisma.horse.findMany.mockResolvedValue([]);

      const result = await validateBatchOwnership('horse', [], 1);

      expect(result).toEqual([]);
    });

    it('should include relations when specified', async () => {
      const horses = [createMockHorse({ id: 1, userId: 1, traits: {} })];
      prisma.horse.findMany.mockResolvedValue(horses);

      await validateBatchOwnership('horse', [1], 1, {
        include: ['traits'],
      });

      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1] },
          userId: 1,
        },
        include: { traits: true },
      });
    });
  });

  describe('Resource Type Validation', () => {
    it('should handle training-session resource type', async () => {
      const session = { id: 1, userId: 1, type: 'SPEED' };
      prisma.trainingSession.findUnique.mockResolvedValue(session);

      req.params.id = '1';
      const middleware = requireOwnership('training-session');

      await middleware(req, res, next);

      expect(prisma.trainingSession.findUnique).toHaveBeenCalled();
    });

    it('should handle competition-entry resource type', async () => {
      const entry = { id: 1, userId: 1, status: 'ENTERED' };
      prisma.competitionEntry.findUnique.mockResolvedValue(entry);

      req.params.id = '1';
      const middleware = requireOwnership('competition-entry');

      await middleware(req, res, next);

      expect(prisma.competitionEntry.findUnique).toHaveBeenCalled();
    });

    it('should return 500 for invalid resource type', async () => {
      req.params.id = '1';
      const middleware = requireOwnership('invalid-resource-type');

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid resource type: invalid-resource-type',
        status: expect.anything(),
      });
    });
  });

  describe('Performance Validation', () => {
    it('should use single query for ownership check', async () => {
      const horse = createMockHorse({ id: 1, userId: 1 });
      prisma.horse.findUnique.mockResolvedValue(horse);

      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      // Verify only ONE database call
      expect(prisma.horse.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should use single query with IN clause for batch validation', async () => {
      const horses = [
        createMockHorse({ id: 1, userId: 1 }),
        createMockHorse({ id: 2, userId: 1 }),
      ];
      prisma.horse.findMany.mockResolvedValue(horses);

      await validateBatchOwnership('horse', [1, 2], 1);

      // Verify only ONE database call with IN clause
      expect(prisma.horse.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2] },
          userId: 1,
        },
      });
    });
  });
});
