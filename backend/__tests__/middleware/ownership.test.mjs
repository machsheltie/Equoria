/**
 * Ownership Validation Middleware Tests
 * Tests for requireOwnership middleware and ownership helper functions
 *
 * SECURITY: CWE-639 (Authorization Bypass Through User-Controlled Key)
 * SECURITY: TOCTOU (Time-of-Check-Time-of-Use) vulnerability prevention
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { mockRequest, mockResponse, mockNext } from '../setup.mjs';

const prismaPath = '../../../packages/database/prismaClient.mjs';
const prisma = {
  horse: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
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
  moduleExports = await import('../../middleware/ownership.mjs');
  ({ requireOwnership, findOwnedResource, validateBatchOwnership } = moduleExports);
});

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
    });

    describe('Ownership validation - Horse', () => {
      it('should allow access to owned horse', async () => {
        const mockHorse = { id: 1, name: 'Thunder', ownerId: 'user-123' };
        prisma.horse.findFirst.mockResolvedValue(mockHorse);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(prisma.horse.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            ownerId: 'user-123',
          },
        }));
        expect(req.horse).toBe(mockHorse);
        expect(next).toHaveBeenCalled();
      });

      it('should return 404 if horse does not exist', async () => {
        prisma.horse.findFirst.mockResolvedValue(null);

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Horse not found',
          status: 'fail',
        });
      });
    });

    describe('Ownership validation - Other resource types', () => {
      it('should validate foal ownership', async () => {
        const mockFoal = { id: 1, name: 'Young Thunder', ownerId: 'user-123' };
        prisma.horse.findFirst.mockResolvedValue(mockFoal);

        const middleware = requireOwnership('foal');
        await middleware(req, res, next);

        expect(prisma.horse.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            ownerId: 'user-123',
          },
        }));
        expect(req.foal).toBe(mockFoal);
        expect(next).toHaveBeenCalled();
      });

      it('should validate groom ownership', async () => {
        const mockGroom = { id: 1, name: 'John', userId: 'user-123' };
        prisma.groom.findFirst.mockResolvedValue(mockGroom);

        const middleware = requireOwnership('groom');
        await middleware(req, res, next);

        expect(prisma.groom.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            userId: 'user-123',
          },
        }));
        expect(req.groom).toBe(mockGroom);
        expect(next).toHaveBeenCalled();
      });

      it('should validate groom-assignment ownership', async () => {
        const mockAssignment = { id: 1, groomId: 5, horseId: 10, userId: 'user-123' };
        prisma.groomAssignment.findFirst.mockResolvedValue(mockAssignment);

        const middleware = requireOwnership('groom-assignment');
        await middleware(req, res, next);

        expect(prisma.groomAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            userId: 'user-123',
          },
        }));
        expect(req['groom-assignment']).toBe(mockAssignment);
        expect(next).toHaveBeenCalled();
      });

      it('should validate breeding ownership (maps to horse)', async () => {
        const mockBreeding = { id: 1, ownerId: 'user-123' };
        prisma.horse.findFirst.mockResolvedValue(mockBreeding);

        const middleware = requireOwnership('breeding');
        await middleware(req, res, next);

        expect(prisma.horse.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            ownerId: 'user-123',
          },
        }));
        expect(req.breeding).toBe(mockBreeding);
        expect(next).toHaveBeenCalled();
      });

      it('should validate competition-entry ownership (maps to competitionResult)', async () => {
        const mockEntry = { id: 1, horse: { ownerId: 'user-123' } };
        prisma.competitionResult.findFirst.mockResolvedValue(mockEntry);

        const middleware = requireOwnership('competition-entry');
        await middleware(req, res, next);

        expect(prisma.competitionResult.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            horse: { ownerId: 'user-123' }
          },
        }));
        expect(req['competition-entry']).toBe(mockEntry);
        expect(next).toHaveBeenCalled();
      });

      it('should validate training-session ownership (maps to trainingLog)', async () => {
        const mockSession = { id: 1, horse: { ownerId: 'user-123' } };
        prisma.trainingLog.findFirst.mockResolvedValue(mockSession);

        const middleware = requireOwnership('training-session');
        await middleware(req, res, next);

        expect(prisma.trainingLog.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: {
            id: 1,
            horse: { ownerId: 'user-123' }
          },
        }));
        expect(req['training-session']).toBe(mockSession);
        expect(next).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        prisma.horse.findFirst.mockRejectedValue(new Error('Database connection error'));

        const middleware = requireOwnership('horse');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Ownership validation error',
        }));
      });
    });
  });

  describe('findOwnedResource()', () => {
    it('should return owned horse', async () => {
      const mockHorse = { id: 1, name: 'Thunder', ownerId: 'user-123' };
      prisma.horse.findFirst.mockResolvedValue(mockHorse);

      const result = await findOwnedResource('horse', 1, 'user-123');

      expect(prisma.horse.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 1,
          ownerId: 'user-123',
        },
      }));
      expect(result).toBe(mockHorse);
    });
  });

  describe('validateBatchOwnership()', () => {
    it('should return all owned horses', async () => {
      const mockHorses = [
        { id: 1, name: 'Thunder', ownerId: 'user-123' },
        { id: 2, name: 'Lightning', ownerId: 'user-123' },
      ];
      prisma.horse.findMany.mockResolvedValue(mockHorses);

      const result = await validateBatchOwnership('horse', [1, 2], 'user-123');

      expect(prisma.horse.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: { in: [1, 2] },
          ownerId: 'user-123',
        },
      }));
      expect(result).toEqual(mockHorses);
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
    });

    it('should prevent ownership disclosure (CWE-639)', async () => {
      prisma.horse.findFirst.mockResolvedValue(null);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Horse not found',
      }));
    });

    it('should prevent TOCTOU vulnerabilities by using atomic single query', async () => {
      const mockHorse = { id: 1, name: 'Thunder', ownerId: 'user-123' };
      prisma.horse.findFirst.mockResolvedValue(mockHorse);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      expect(prisma.horse.findFirst).toHaveBeenCalledTimes(1);
      expect(req.horse).toBe(mockHorse);
      expect(next).toHaveBeenCalled();
    });

    it('should validate user ID from token, not from request params', async () => {
      req.params.userId = 'attacker-user';
      req.user = { id: 'user-123' };

      const mockHorse = { id: 1, name: 'Thunder', ownerId: 'user-123' };
      prisma.horse.findFirst.mockResolvedValue(mockHorse);

      const middleware = requireOwnership('horse');
      await middleware(req, res, next);

      expect(prisma.horse.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 1,
          ownerId: 'user-123',
        },
      }));
    });
  });
});