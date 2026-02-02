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

import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import { createMockUser, createMockHorse, createMockGroom } from '../../factories/index.mjs';

// Create mock state object on globalThis for access from factory
globalThis.ownershipTestMockState = {
  horseFindFirst: null,
  horseFindUnique: null,
  horseFindMany: null,
  groomFindFirst: null,
  groomFindUnique: null,
  groomFindMany: null,
  groomAssignmentFindFirst: null,
  groomAssignmentFindUnique: null,
  groomAssignmentFindMany: null,
  competitionResultFindFirst: null,
  competitionResultFindUnique: null,
  competitionResultFindMany: null,
  trainingLogFindFirst: null,
  trainingLogFindUnique: null,
  trainingLogFindMany: null,
};

// Alias for easier access in tests
const mockState = globalThis.ownershipTestMockState;

// Mock Prisma client module - factory implementations read from globalThis
// This allows tests to mutate mockState and have mocks return current values
const prismaPath = '../../../../packages/database/prismaClient.mjs';

// Get references to the mocks for test assertions (must be done after mock is created)
let mockHorseFindFirst, mockHorseFindUnique, mockHorseFindMany;
let mockGroomFindFirst, mockGroomFindUnique, mockGroomFindMany;
let mockGroomAssignmentFindFirst, mockGroomAssignmentFindUnique, mockGroomAssignmentFindMany;
let mockCompetitionResultFindFirst, mockCompetitionResultFindUnique, mockCompetitionResultFindMany;
let mockTrainingLogFindFirst, mockTrainingLogFindUnique, mockTrainingLogFindMany;

let moduleExports;
let requireOwnership, findOwnedResource, validateBatchOwnership;
let prisma;

beforeAll(async () => {
  await jest.unstable_mockModule(prismaPath, () => ({
    default: {
      horse: {
        findFirst: jest.fn(async () => globalThis.ownershipTestMockState.horseFindFirst),
        findUnique: jest.fn(async () => globalThis.ownershipTestMockState.horseFindUnique),
        findMany: jest.fn(async () => globalThis.ownershipTestMockState.horseFindMany),
      },
      groom: {
        findFirst: jest.fn(async () => globalThis.ownershipTestMockState.groomFindFirst),
        findUnique: jest.fn(async () => globalThis.ownershipTestMockState.groomFindUnique),
        findMany: jest.fn(async () => globalThis.ownershipTestMockState.groomFindMany),
      },
      groomAssignment: {
        findFirst: jest.fn(async () => globalThis.ownershipTestMockState.groomAssignmentFindFirst),
        findUnique: jest.fn(async () => globalThis.ownershipTestMockState.groomAssignmentFindUnique),
        findMany: jest.fn(async () => globalThis.ownershipTestMockState.groomAssignmentFindMany),
      },
      competitionResult: {
        findFirst: jest.fn(async () => globalThis.ownershipTestMockState.competitionResultFindFirst),
        findUnique: jest.fn(async () => globalThis.ownershipTestMockState.competitionResultFindUnique),
        findMany: jest.fn(async () => globalThis.ownershipTestMockState.competitionResultFindMany),
      },
      trainingLog: {
        findFirst: jest.fn(async () => globalThis.ownershipTestMockState.trainingLogFindFirst),
        findUnique: jest.fn(async () => globalThis.ownershipTestMockState.trainingLogFindUnique),
        findMany: jest.fn(async () => globalThis.ownershipTestMockState.trainingLogFindMany),
      },
    },
  }));

  // Import the middleware module
  moduleExports = await import('../../../middleware/ownership.mjs');
  ({ requireOwnership, findOwnedResource, validateBatchOwnership } = moduleExports);

  // Import the mocked Prisma client to get mock references
  const prismaModule = await import(prismaPath);
  prisma = prismaModule.default;

  // Extract mock function references for test assertions
  mockHorseFindFirst = prisma.horse.findFirst;
  mockHorseFindUnique = prisma.horse.findUnique;
  mockHorseFindMany = prisma.horse.findMany;
  mockGroomFindFirst = prisma.groom.findFirst;
  mockGroomFindUnique = prisma.groom.findUnique;
  mockGroomFindMany = prisma.groom.findMany;
  mockGroomAssignmentFindFirst = prisma.groomAssignment.findFirst;
  mockGroomAssignmentFindUnique = prisma.groomAssignment.findUnique;
  mockGroomAssignmentFindMany = prisma.groomAssignment.findMany;
  mockCompetitionResultFindFirst = prisma.competitionResult.findFirst;
  mockCompetitionResultFindUnique = prisma.competitionResult.findUnique;
  mockCompetitionResultFindMany = prisma.competitionResult.findMany;
  mockTrainingLogFindFirst = prisma.trainingLog.findFirst;
  mockTrainingLogFindUnique = prisma.trainingLog.findUnique;
  mockTrainingLogFindMany = prisma.trainingLog.findMany;

  // Set up mock implementations to read from mockState dynamically
  // This allows tests to mutate mockState and have mocks return the current value
  mockHorseFindFirst.mockImplementation(async () => mockState.horseFindFirst);
  mockHorseFindUnique.mockImplementation(async () => mockState.horseFindUnique);
  mockHorseFindMany.mockImplementation(async () => mockState.horseFindMany);
  mockGroomFindFirst.mockImplementation(async () => mockState.groomFindFirst);
  mockGroomFindUnique.mockImplementation(async () => mockState.groomFindUnique);
  mockGroomFindMany.mockImplementation(async () => mockState.groomFindMany);
  mockGroomAssignmentFindFirst.mockImplementation(async () => mockState.groomAssignmentFindFirst);
  mockGroomAssignmentFindUnique.mockImplementation(async () => mockState.groomAssignmentFindUnique);
  mockGroomAssignmentFindMany.mockImplementation(async () => mockState.groomAssignmentFindMany);
  mockCompetitionResultFindFirst.mockImplementation(async () => mockState.competitionResultFindFirst);
  mockCompetitionResultFindUnique.mockImplementation(async () => mockState.competitionResultFindUnique);
  mockCompetitionResultFindMany.mockImplementation(async () => mockState.competitionResultFindMany);
  mockTrainingLogFindFirst.mockImplementation(async () => mockState.trainingLogFindFirst);
  mockTrainingLogFindUnique.mockImplementation(async () => mockState.trainingLogFindUnique);
  mockTrainingLogFindMany.mockImplementation(async () => mockState.trainingLogFindMany);
});

describe('Ownership Validation Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock state to prevent test pollution
    mockState.horseFindFirst = null;
    mockState.horseFindUnique = null;
    mockState.horseFindMany = null;
    mockState.groomFindFirst = null;
    mockState.groomFindUnique = null;
    mockState.groomFindMany = null;
    mockState.groomAssignmentFindFirst = null;
    mockState.groomAssignmentFindUnique = null;
    mockState.groomAssignmentFindMany = null;
    mockState.competitionResultFindFirst = null;
    mockState.competitionResultFindUnique = null;
    mockState.competitionResultFindMany = null;
    mockState.trainingLogFindFirst = null;
    mockState.trainingLogFindUnique = null;
    mockState.trainingLogFindMany = null;

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
      const horse = createMockHorse({ id: 1, userId: 'user-1' });
      mockState.horseFindFirst = horse;

      req.params.id = '1';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse).toEqual(horse);
      expect(mockHorseFindFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 'user-1' }, // Matches schema field
      });
    });

    it('should allow access to owned groom', async () => {
      const groom = createMockGroom({ id: 5, userId: 'user-1' });
      mockState.groomFindFirst = groom;

      req.params.id = '5';
      const middleware = requireOwnership('groom');

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.groom).toEqual(groom);
      expect(mockGroomFindFirst).toHaveBeenCalledWith({
        where: { id: 5, userId: 'user-1' },
      });
    });

    it('should attach resource to request object and validatedResources', async () => {
      const horse = createMockHorse({ id: 10, userId: 'user-1', name: 'TestHorse' });
      mockState.horseFindFirst = horse;

      req.params.id = '10';
      const middleware = requireOwnership('horse');

      await middleware(req, res, next);

      expect(req.horse).toBeDefined();
      expect(req.validatedResources.horse).toEqual(horse);
      expect(req.horse.name).toBe('TestHorse');
    });

    it('should work with custom idParam', async () => {
      const horse = createMockHorse({ id: 20, userId: 'user-1' });
      mockState.horseFindFirst = horse;

      req.params.horseId = '20';
      const middleware = requireOwnership('horse', { idParam: 'horseId' });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.horse.id).toBe(20);
    });
  });

  describe('Not Owned Resource Scenarios', () => {
    it('should return 404 for horse owned by different user', async () => {
      mockState.horseFindFirst = null;

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
      mockState.groomFindFirst = null;

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
      const session = { id: 1, horse: { userId: 'user-1' }, type: 'SPEED' };
      mockState.trainingLogFindFirst = session;

      req.params.id = '1';
      const middleware = requireOwnership('training-session');

      await middleware(req, res, next);

      expect(mockTrainingLogFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 1,
            horse: { userId: 'user-1' }, // Matches schema field
          },
        }),
      );
    });

    it('should handle competition-entry resource type (maps to competitionResult)', async () => {
      const entry = { id: 1, horse: { userId: 'user-1' }, status: 'ENTERED' };
      mockState.competitionResultFindFirst = entry;

      req.params.id = '1';
      const middleware = requireOwnership('competition-entry');

      await middleware(req, res, next);

      expect(mockCompetitionResultFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 1,
            horse: { userId: 'user-1' }, // Matches schema field
          },
        }),
      );
    });
  });

  describe('findOwnedResource Helper Function', () => {
    it('should find owned horse using userId', async () => {
      const horse = createMockHorse({ id: 1, userId: 'user-1' });
      mockState.horseFindFirst = horse;

      const result = await findOwnedResource('horse', 1, 'user-1');

      expect(result).toEqual(horse);
      expect(mockHorseFindFirst).toHaveBeenCalledWith({
        where: { id: 1, userId: 'user-1' }, // Matches schema field
      });
    });

    it('should find owned groom using userId', async () => {
      const groom = createMockGroom({ id: 5, userId: 'user-1' });
      mockState.groomFindFirst = groom;

      const result = await findOwnedResource('groom', 5, 'user-1');

      expect(result).toEqual(groom);
      expect(mockGroomFindFirst).toHaveBeenCalledWith({
        where: { id: 5, userId: 'user-1' },
      });
    });
  });

  describe('validateBatchOwnership Helper Function', () => {
    it('should validate ownership of multiple horses using userId', async () => {
      const horses = [createMockHorse({ id: 1, userId: 'user-1' }), createMockHorse({ id: 2, userId: 'user-1' })];
      mockState.horseFindMany = horses;

      const result = await validateBatchOwnership('horse', [1, 2], 'user-1');

      expect(result).toEqual(horses);
      expect(mockHorseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: [1, 2] },
            userId: 'user-1', // Matches schema field
          },
        }),
      );
    });
  });
});
