/**
 * Ownership Validation Middleware Tests
 * Tests for requireOwnership middleware and ownership helper functions
 *
 * SECURITY: CWE-639 (Authorization Bypass Through User-Controlled Key)
 * SECURITY: TOCTOU (Time-of-Check-Time-of-Use) vulnerability prevention
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  requireOwnership,
  findOwnedResource,
  validateBatchOwnership,
} from '../../middleware/ownership.mjs';
import { mockRequest, mockResponse, mockNext } from '../setup.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// Mock Prisma client module
jest.mock('../../../packages/database/prismaClient.mjs');

// Manually assign mock functions to each resource type
// This ensures the mock functions have the proper prototype chain with .mockResolvedValue(), .mockClear(), etc.
prisma.horse = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.foal = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.groom = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.groomAssignment = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.breeding = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.competitionEntry = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

prisma.trainingSession = {
  findUnique: jest.fn(),
  findMany: jest.fn(),
};

describe('Ownership Middleware', () => {
  describe('requireOwnership()', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();

      // Default authenticated user
      req.user = { id: 'user-123' };
      req.params = { id: '1' };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    describe('Authentication validation', () => {
      it('should return 401 if user is not authenticated', async () => {
        req.user = null;

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Authentication required',
          status: 'fail',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 401 if user.id is missing', async () => {
        req.user = { id: null };

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Authentication required',
          status: 'fail',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 401 if user object is undefined', async () => {
        delete req.user;

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Resource ID validation', () => {
      it('should return 400 if resource ID is not a number', async () => {
        req.params.id = 'invalid';

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid horse ID',
          status: 'fail',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 404 if resource ID is negative (parseInt converts but DB query fails)', async () => {
        req.params.id = '-5';
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        // parseInt('-5') = -5 (valid number), but DB query for id: -5 returns null
        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 404 if resource ID is zero (parseInt converts but DB query fails)', async () => {
        req.params.id = '0';
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        // parseInt('0') = 0 (valid number), but DB query for id: 0 returns null
        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
      });

      it('should truncate decimal IDs (parseInt behavior)', async () => {
        req.params.id = '1.5';
        const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
        prisma.horse.findUnique.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        // parseInt('1.5') = 1 (truncates decimal), queries for id: 1
        expect(prisma.horse.findUnique).toHaveBeenCalledWith({
          where: { id: 1, userId: 'user-123' },
        });
        expect(next).toHaveBeenCalled();
      });
    });

    describe('Ownership validation - Horse', () => {
      it('should allow access to owned horse', async () => {
        const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
        prisma.horse.findUnique.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(prisma.horse.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req.horse).toBe(mockHorse);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should return 404 if horse does not exist', async () => {
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Horse not found',
          status: 'fail',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should return 404 if horse exists but not owned by user', async () => {
        // Single-query pattern: WHERE { id: 1, userId: 'user-123' } returns null
        // This prevents ownership disclosure attacks
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Horse not found',
          status: 'fail',
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should use custom idParam option', async () => {
        req.params = { horseId: '42' };
        const mockHorse = { id: 42, name: 'Lightning', userId: 'user-123' };
        prisma.horse.findUnique.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse', { idParam: 'horseId' });
        await middleware(req, res, next);

        expect(prisma.horse.findUnique).toHaveBeenCalledWith({
          where: {
            id: 42,
            userId: 'user-123',
          },
        });
        expect(req.horse).toBe(mockHorse);
        expect(next).toHaveBeenCalled();
      });

      it('should include relations when specified', async () => {
        const mockHorse = {
          id: 1,
          name: 'Thunder',
          userId: 'user-123',
          breed: { name: 'Thoroughbred' },
        };
        prisma.horse.findUnique.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse', { include: ['breed'] });
        await middleware(req, res, next);

        expect(prisma.horse.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
          include: {
            breed: true,
          },
        });
        expect(req.horse).toBe(mockHorse);
        expect(next).toHaveBeenCalled();
      });

      it('should include multiple relations', async () => {
        const mockHorse = {
          id: 1,
          name: 'Thunder',
          userId: 'user-123',
          breed: { name: 'Thoroughbred' },
          grooms: [],
        };
        prisma.horse.findUnique.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse', { include: ['breed', 'grooms'] });
        await middleware(req, res, next);

        expect(prisma.horse.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
          include: {
            breed: true,
            grooms: true,
          },
        });
        expect(next).toHaveBeenCalled();
      });
    });

    describe('Ownership validation - Other resource types', () => {
      it('should validate foal ownership', async () => {
        const mockFoal = { id: 1, name: 'Young Thunder', userId: 'user-123' };
        prisma.foal.findUnique.mockResolvedValue(mockFoal);

        const middleware = requireOwnership('foal');
        await middleware(req, res, next);

        expect(prisma.foal.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req.foal).toBe(mockFoal);
        expect(next).toHaveBeenCalled();
      });

      it('should validate groom ownership', async () => {
        const mockGroom = { id: 1, name: 'John', userId: 'user-123' };
        prisma.groom.findUnique.mockResolvedValue(mockGroom);

        const middleware = requireOwnership('groom');
        await middleware(req, res, next);

        expect(prisma.groom.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req.groom).toBe(mockGroom);
        expect(next).toHaveBeenCalled();
      });

      it('should validate groom-assignment ownership', async () => {
        const mockAssignment = { id: 1, groomId: 5, horseId: 10, userId: 'user-123' };
        prisma.groomAssignment.findUnique.mockResolvedValue(mockAssignment);

        const middleware = requireOwnership('groom-assignment');
        await middleware(req, res, next);

        expect(prisma.groomAssignment.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req['groom-assignment']).toBe(mockAssignment);
        expect(next).toHaveBeenCalled();
      });

      it('should validate breeding ownership', async () => {
        const mockBreeding = { id: 1, mareId: 5, stallionId: 6, userId: 'user-123' };
        prisma.breeding.findUnique.mockResolvedValue(mockBreeding);

        const middleware = requireOwnership('breeding');
        await middleware(req, res, next);

        expect(prisma.breeding.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req.breeding).toBe(mockBreeding);
        expect(next).toHaveBeenCalled();
      });

      it('should validate competition-entry ownership', async () => {
        const mockEntry = { id: 1, horseId: 5, competitionId: 10, userId: 'user-123' };
        prisma.competitionEntry.findUnique.mockResolvedValue(mockEntry);

        const middleware = requireOwnership('competition-entry');
        await middleware(req, res, next);

        expect(prisma.competitionEntry.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req['competition-entry']).toBe(mockEntry);
        expect(next).toHaveBeenCalled();
      });

      it('should validate training-session ownership', async () => {
        const mockSession = { id: 1, horseId: 5, sessionType: 'stamina', userId: 'user-123' };
        prisma.trainingSession.findUnique.mockResolvedValue(mockSession);

        const middleware = requireOwnership('training-session');
        await middleware(req, res, next);

        expect(prisma.trainingSession.findUnique).toHaveBeenCalledWith({
          where: {
            id: 1,
            userId: 'user-123',
          },
        });
        expect(req['training-session']).toBe(mockSession);
        expect(next).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        prisma.horse.findUnique.mockRejectedValue(new Error('Database connection error'));

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Ownership validation error',
          status: 'error', // 500 errors use 'error' status
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should handle invalid resource type', async () => {
        const middleware = requireOwnership('invalid-resource');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Invalid resource type: invalid-resource',
          status: 'error', // 500 errors use 'error' status
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should handle Prisma query errors', async () => {
        prisma.horse.findUnique.mockRejectedValue(new Error('Query failed'));

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('Required option', () => {
      it('should allow missing resource when required=false', async () => {
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse', { required: false });
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should block missing resource when required=true (default)', async () => {
        prisma.horse.findUnique.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('findOwnedResource()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return owned horse', async () => {
      const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
      prisma.horse.findUnique.mockResolvedValue(mockHorse);

      const result = await findOwnedResource('horse', 1, 'user-123');

      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 'user-123',
        },
      });
      expect(result).toBe(mockHorse);
    });

    it('should return null if horse not found', async () => {
      prisma.horse.findUnique.mockResolvedValue(null);

      const result = await findOwnedResource('horse', 999, 'user-123');

      expect(result).toBeNull();
    });

    it('should return null if horse not owned by user', async () => {
      // Single-query pattern returns null if not owned
      prisma.horse.findUnique.mockResolvedValue(null);

      const result = await findOwnedResource('horse', 1, 'different-user');

      expect(result).toBeNull();
    });

    it('should include relations when specified', async () => {
      const mockHorse = {
        id: 1,
        name: 'Thunder',
        userId: 'user-123',
        breed: { name: 'Thoroughbred' },
      };
      prisma.horse.findUnique.mockResolvedValue(mockHorse);

      const result = await findOwnedResource('horse', 1, 'user-123', { include: ['breed'] });

      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 'user-123',
        },
        include: {
          breed: true,
        },
      });
      expect(result).toBe(mockHorse);
    });

    it('should handle database errors', async () => {
      prisma.horse.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(findOwnedResource('horse', 1, 'user-123')).rejects.toThrow('Database error');
    });

    it('should work with different resource types', async () => {
      const mockGroom = { id: 5, name: 'John', userId: 'user-456' };
      prisma.groom.findUnique.mockResolvedValue(mockGroom);

      const result = await findOwnedResource('groom', 5, 'user-456');

      expect(prisma.groom.findUnique).toHaveBeenCalledWith({
        where: {
          id: 5,
          userId: 'user-456',
        },
      });
      expect(result).toBe(mockGroom);
    });
  });

  describe('validateBatchOwnership()', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return all owned horses', async () => {
      const mockHorses = [
        { id: 1, name: 'Thunder', userId: 'user-123' },
        { id: 2, name: 'Lightning', userId: 'user-123' },
        { id: 3, name: 'Storm', userId: 'user-123' },
      ];
      prisma.horse.findMany.mockResolvedValue(mockHorses);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 'user-123');

      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1, 2, 3] },
          userId: 'user-123',
        },
      });
      expect(result).toEqual(mockHorses);
      expect(result.length).toBe(3);
    });

    it('should return partial results if some horses not owned', async () => {
      const mockHorses = [
        { id: 1, name: 'Thunder', userId: 'user-123' },
        { id: 3, name: 'Storm', userId: 'user-123' },
      ];
      prisma.horse.findMany.mockResolvedValue(mockHorses);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 'user-123');

      expect(result.length).toBe(2); // Only 2 out of 3 owned
      expect(result).toEqual(mockHorses);
    });

    it('should return empty array if no horses owned', async () => {
      prisma.horse.findMany.mockResolvedValue([]);

      const result = await validateBatchOwnership('horse', [1, 2, 3], 'different-user');

      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('should include relations when specified', async () => {
      const mockHorses = [
        { id: 1, name: 'Thunder', userId: 'user-123', breed: { name: 'Thoroughbred' } },
      ];
      prisma.horse.findMany.mockResolvedValue(mockHorses);

      const result = await validateBatchOwnership('horse', [1], 'user-123', { include: ['breed'] });

      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [1] },
          userId: 'user-123',
        },
        include: {
          breed: true,
        },
      });
      expect(result).toEqual(mockHorses);
    });

    it('should handle database errors', async () => {
      prisma.horse.findMany.mockRejectedValue(new Error('Database error'));

      await expect(validateBatchOwnership('horse', [1, 2, 3], 'user-123')).rejects.toThrow(
        'Database error'
      );
    });

    it('should work with different resource types', async () => {
      const mockGrooms = [
        { id: 5, name: 'John', userId: 'user-456' },
        { id: 6, name: 'Jane', userId: 'user-456' },
      ];
      prisma.groom.findMany.mockResolvedValue(mockGrooms);

      const result = await validateBatchOwnership('groom', [5, 6], 'user-456');

      expect(prisma.groom.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [5, 6] },
          userId: 'user-456',
        },
      });
      expect(result).toEqual(mockGrooms);
    });

    it('should handle empty resource ID array', async () => {
      prisma.horse.findMany.mockResolvedValue([]);

      const result = await validateBatchOwnership('horse', [], 'user-123');

      expect(prisma.horse.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [] },
          userId: 'user-123',
        },
      });
      expect(result).toEqual([]);
    });
  });

  describe('Security tests', () => {
    let req, res, next;

    beforeEach(() => {
      req = mockRequest();
      res = mockResponse();
      next = mockNext();
      req.user = { id: 'user-123' };
      req.params = { id: '1' };

      // Reset mock call history but keep mock implementations
      prisma.horse.findUnique.mockClear();
    });

    it('should prevent ownership disclosure (CWE-639)', async () => {
      // Single-query pattern: WHERE { id: 1, userId: 'user-123' } returns null
      // This prevents attackers from enumerating resources
      prisma.horse.findUnique.mockResolvedValue(null);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      // Returns 404 regardless of whether horse exists but is owned by someone else
      // or horse doesn't exist at all
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Horse not found',
        status: 'fail', // 404 errors use 'fail' status (client error)
      });
    });

    it('should prevent TOCTOU vulnerabilities', async () => {
      const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
      prisma.horse.findUnique.mockResolvedValue(mockHorse);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      // Resource is fetched AND validated in single query
      // No race condition between check and use
      expect(prisma.horse.findUnique).toHaveBeenCalledTimes(1);
      expect(req.horse).toBe(mockHorse);
      expect(next).toHaveBeenCalled();
    });

    it('should use atomic ownership validation', async () => {
      const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
      prisma.horse.findUnique.mockResolvedValue(mockHorse);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      // Single query with both id AND userId in WHERE clause
      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 'user-123',
        },
      });
    });

    it('should prevent parameter tampering', async () => {
      // Attacker tries to access another user's horse
      req.params.id = '42'; // Horse owned by user-456
      prisma.horse.findUnique.mockResolvedValue(null); // Not owned by user-123

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    it('should validate user ID from token, not from request params', async () => {
      // Ensure user ID comes from authenticated token, not request
      req.params.userId = 'attacker-user'; // Should be ignored
      req.user = { id: 'user-123' }; // From token

      const mockHorse = { id: 1, name: 'Thunder', userId: 'user-123' };
      prisma.horse.findUnique.mockResolvedValue(mockHorse);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      // Uses user ID from req.user (token), not from params
      expect(prisma.horse.findUnique).toHaveBeenCalledWith({
        where: {
          id: 1,
          userId: 'user-123', // From token
        },
      });
      expect(next).toHaveBeenCalled();
    });
  });
});
