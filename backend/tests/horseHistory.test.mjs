/**
 * Unit Test: Horse History Controller — Competition History Retrieval
 *
 * Tests getHorseHistory() controller logic: ID validation, data transformation
 * (prizeWon → prize, statGains JSON parsing), error handling, response structure.
 *
 * Scope: controller validation + transformation logic.
 * Uses real resultModel (not mocked) — only the DB client (prisma) is mocked,
 * which is the permitted infrastructure boundary.
 *
 * Real behavior tested:
 * - Controller validates horse ID before calling the model
 * - resultModel.getResultsByHorse runs real validation logic
 * - Controller transforms result fields (prizeWon → prize, statGains → statGain)
 * - Malformed statGains JSON triggers 500 (defensive path)
 * - DB errors bubble up and produce 500 response
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';

// Permitted mock: DB client (infrastructure boundary only)
const mockPrisma = {
  competitionResult: { findMany: jest.fn() },
  $disconnect: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({
  default: mockPrisma,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Import the function to test after mocking
const { getHorseHistory } = await import('../controllers/horseController.mjs');

describe('Horse History Controller — Competition History Retrieval', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: { id: '1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('getHorseHistory', () => {
    it('should return horse competition history successfully', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([
        {
          id: 1,
          showName: 'Autumn Challenge - Barrel Racing',
          discipline: 'Barrel Racing',
          placement: '1st',
          score: 162.4,
          prizeWon: 1000,
          statGains: '{"stat":"stamina","gain":1}',
          runDate: new Date('2025-06-01'),
          createdAt: new Date('2025-06-01T10:00:00Z'),
        },
        {
          id: 2,
          showName: 'Harvest Gala - Dressage',
          discipline: 'Dressage',
          placement: null,
          score: 143.7,
          prizeWon: 0,
          statGains: null,
          runDate: new Date('2025-05-25'),
          createdAt: new Date('2025-05-25T14:30:00Z'),
        },
      ]);

      await getHorseHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.message).toContain('2');
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toMatchObject({
        id: 1,
        showName: 'Autumn Challenge - Barrel Racing',
        discipline: 'Barrel Racing',
        placement: '1st',
        score: 162.4,
        prize: 1000,
        statGain: { stat: 'stamina', gain: 1 },
      });
      expect(body.data[1]).toMatchObject({
        id: 2,
        prize: 0,
        statGain: null,
      });
    });

    it('should return empty array when horse has no competition history', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([]);

      await getHorseHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    it('should reject non-numeric horse ID with 400', async () => {
      req.params.id = 'invalid';

      await getHorseHistory(req, res);

      expect(mockPrisma.competitionResult.findMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0]).toMatchObject({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    });

    it('should reject negative horse ID with 400', async () => {
      req.params.id = '-1';

      await getHorseHistory(req, res);

      expect(mockPrisma.competitionResult.findMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject zero horse ID with 400', async () => {
      req.params.id = '0';

      await getHorseHistory(req, res);

      expect(mockPrisma.competitionResult.findMany).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle database errors gracefully with 500', async () => {
      mockPrisma.competitionResult.findMany.mockRejectedValueOnce(new Error('Database connection failed'));

      await getHorseHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json.mock.calls[0][0]).toMatchObject({
        success: false,
        message: 'Internal server error while retrieving horse history',
        data: null,
      });
    });

    it('should parse statGains JSON correctly', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([
        {
          id: 1,
          showName: 'Spring Classic',
          discipline: 'Racing',
          placement: '1st',
          score: 180.5,
          prizeWon: 500,
          statGains: '{"stat":"speed","gain":1}',
          runDate: new Date('2025-05-15'),
          createdAt: new Date('2025-05-15T12:00:00Z'),
        },
      ]);

      await getHorseHistory(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.data[0].statGain).toEqual({ stat: 'speed', gain: 1 });
    });

    it('should return 500 for malformed statGains JSON', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([
        {
          id: 1,
          showName: 'Spring Classic',
          discipline: 'Racing',
          placement: '1st',
          score: 180.5,
          prizeWon: 500,
          statGains: 'invalid json',
          runDate: new Date('2025-05-15'),
          createdAt: new Date('2025-05-15T12:00:00Z'),
        },
      ]);

      await getHorseHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json.mock.calls[0][0]).toMatchObject({
        success: false,
        message: 'Internal server error while retrieving horse history',
        data: null,
      });
    });

    it('should accept large horse ID numbers', async () => {
      req.params.id = '999999';
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([]);

      await getHorseHistory(req, res);

      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { horseId: 999999 } }),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should preserve order from database query (newest first)', async () => {
      mockPrisma.competitionResult.findMany.mockResolvedValueOnce([
        {
          id: 3,
          showName: 'Latest Show',
          discipline: 'Jumping',
          placement: '2nd',
          score: 155.0,
          prizeWon: 300,
          statGains: null,
          runDate: new Date('2025-06-10'),
          createdAt: new Date('2025-06-10T16:00:00Z'),
        },
        {
          id: 1,
          showName: 'Older Show',
          discipline: 'Dressage',
          placement: '1st',
          score: 170.0,
          prizeWon: 500,
          statGains: '{"stat":"agility","gain":1}',
          runDate: new Date('2025-05-20'),
          createdAt: new Date('2025-05-20T10:00:00Z'),
        },
      ]);

      await getHorseHistory(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.data[0].showName).toBe('Latest Show');
      expect(body.data[1].showName).toBe('Older Show');
    });
  });
});
