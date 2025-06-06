/**
 * 🧪 UNIT TEST: Horse History Controller - Competition History Retrieval
 *
 * This test validates the horse history controller's functionality for retrieving
 * and formatting horse competition history with comprehensive data processing.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Horse ID validation: positive integers only, reject negative/zero/non-numeric
 * - Competition history retrieval with chronological ordering (newest first)
 * - Data transformation: prizeWon → prize, statGains JSON parsing → statGain object
 * - JSON parsing validation: handle malformed statGains gracefully with error logging
 * - Empty history handling: return empty array with appropriate message
 * - Large ID support: handle large horse ID numbers (999999+)
 * - Database error handling: graceful error responses with logging
 * - Response formatting: consistent success/error structure with data/message/success
 * - Order preservation: maintain database query ordering in response
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. getHorseHistory() - Competition history retrieval with validation and formatting
 * 2. Horse ID validation (positive integers, reject invalid formats)
 * 3. JSON parsing for statGains field with error handling
 * 4. Data transformation (field renaming, object parsing)
 * 5. Database error handling with appropriate logging
 * 6. Edge cases: empty results, malformed data, large IDs
 * 7. Response consistency and message formatting
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Controller logic, validation rules, data transformation, JSON parsing
 * ✅ REAL: Error handling, response formatting, field mapping, order preservation
 * 🔧 MOCK: Result model database operations - external dependency
 * 🔧 MOCK: Logger calls - external dependency for audit trails
 *
 * 💡 TEST STRATEGY: Unit testing with mocked database to focus on controller
 *    business logic while ensuring predictable test outcomes for data processing
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the dependencies
const mockGetResultsByHorse = jest.fn();
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the modules
jest.unstable_mockModule(join(__dirname, '../models/resultModel.js'), () => ({
  getResultsByHorse: mockGetResultsByHorse,
}));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjss'), () => ({
  default: mockLogger,
}));

// Import the function to test after mocking
const { getHorseHistory } = await import(join(__dirname, '../controllers/horseController.js'));

describe('📚 UNIT: Horse History Controller - Competition History Retrieval', () => {
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
      const mockResults = [
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
      ];

      mockGetResultsByHorse.mockResolvedValue(mockResults);

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Found 2 competition results for horse 1',
        data: [
          {
            id: 1,
            showName: 'Autumn Challenge - Barrel Racing',
            discipline: 'Barrel Racing',
            placement: '1st',
            score: 162.4,
            prize: 1000,
            statGain: { stat: 'stamina', gain: 1 },
            runDate: new Date('2025-06-01'),
            createdAt: new Date('2025-06-01T10:00:00Z'),
          },
          {
            id: 2,
            showName: 'Harvest Gala - Dressage',
            discipline: 'Dressage',
            placement: null,
            score: 143.7,
            prize: 0,
            statGain: null,
            runDate: new Date('2025-05-25'),
            createdAt: new Date('2025-05-25T14:30:00Z'),
          },
        ],
      });
    });

    it('should return empty array when horse has no competition history', async () => {
      mockGetResultsByHorse.mockResolvedValue([]);

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Found 0 competition results for horse 1',
        data: [],
      });
    });

    it('should handle invalid horse ID (non-numeric)', async () => {
      req.params.id = 'invalid';

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    });

    it('should handle invalid horse ID (negative number)', async () => {
      req.params.id = '-1';

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    });

    it('should handle invalid horse ID (zero)', async () => {
      req.params.id = '0';

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockGetResultsByHorse.mockRejectedValue(dbError);

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error while retrieving horse history',
        data: null,
      });
    });

    it('should properly parse stat gains JSON', async () => {
      const mockResults = [
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
      ];

      mockGetResultsByHorse.mockResolvedValue(mockResults);

      await getHorseHistory(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Found 1 competition results for horse 1',
        data: [
          {
            id: 1,
            showName: 'Spring Classic',
            discipline: 'Racing',
            placement: '1st',
            score: 180.5,
            prize: 500,
            statGain: { stat: 'speed', gain: 1 },
            runDate: new Date('2025-05-15'),
            createdAt: new Date('2025-05-15T12:00:00Z'),
          },
        ],
      });
    });

    it('should handle malformed stat gains JSON gracefully', async () => {
      const mockResults = [
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
      ];

      mockGetResultsByHorse.mockResolvedValue(mockResults);

      await getHorseHistory(req, res);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error while retrieving horse history',
        data: null,
      });
    });

    it('should handle large horse ID numbers', async () => {
      req.params.id = '999999';
      mockGetResultsByHorse.mockResolvedValue([]);

      await getHorseHistory(req, res);

      expect(mockGetResultsByHorse).toHaveBeenCalledWith(999999);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Found 0 competition results for horse 999999',
        data: [],
      });
    });

    it('should maintain order from database query (newest first)', async () => {
      const mockResults = [
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
      ];

      mockGetResultsByHorse.mockResolvedValue(mockResults);

      await getHorseHistory(req, res);

      const responseData = res.json.mock.calls[0][0].data;
      expect(responseData).toHaveLength(2);
      expect(responseData[0].showName).toBe('Latest Show');
      expect(responseData[1].showName).toBe('Older Show');
    });
  });
});
