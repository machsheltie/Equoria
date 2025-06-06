/**
 * Horse Overview Integration Tests
 * Tests the GET /api/horses/:id/overview endpoint
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database module BEFORE importing the app
jest.unstable_mockModule(join(__dirname, '../../db/index.js'), () => ({
  default: {
    horse: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    competitionResult: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    trainingLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock the trainingModel
jest.unstable_mockModule(join(__dirname, '../../models/trainingModel.mjs'), () => ({
  getAnyRecentTraining: jest.fn(),
  getHorseAge: jest.fn(),
  getLastTrainingDate: jest.fn(),
  logTrainingSession: jest.fn(),
}));

// Now import the app and the mocked modules
const app = (await import('../../app.mjs')).default;
const mockPrisma = (await import(join(__dirname, '../../db/index.mjs'))).default;
const { getAnyRecentTraining } = await import('../../models/trainingModel.mjs');

describe('Horse Overview Integration Tests', () => {
  let testHorse;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup test horse data
    testHorse = {
      id: 1,
      name: 'Nova',
      age: 5,
      trait: 'Dressage',
      disciplineScores: {
        Dressage: 25,
        'Show Jumping': 10,
      },
      total_earnings: 2200,
      tack: {
        saddleBonus: 5,
        bridleBonus: 3,
      },
      rider: {
        name: 'Jenna Black',
        bonusPercent: 0.08,
        penaltyPercent: 0,
      },
    };
  });

  afterAll(async () => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('GET /api/horses/:id/overview', () => {
    it('should return complete horse overview data successfully', async () => {
      // Mock horse data
      mockPrisma.horse.findUnique.mockResolvedValue(testHorse);

      // Mock most recent training (7 days ago, so next training is available now)
      const lastTrainingDate = new Date();
      lastTrainingDate.setDate(lastTrainingDate.getDate() - 7);
      getAnyRecentTraining.mockResolvedValue(lastTrainingDate);

      // Mock most recent competition result
      const mockCompetitionResult = {
        showName: 'Summer Invitational',
        placement: '1st',
        runDate: new Date('2025-06-01'),
      };
      mockPrisma.competitionResult.findFirst.mockResolvedValue(mockCompetitionResult);

      const response = await request(app).get('/api/horses/1/overview').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Horse overview retrieved successfully');

      const { data } = response.body;

      // Verify horse basic info
      expect(data.id).toBe(1);
      expect(data.name).toBe('Nova');
      expect(data.age).toBe(5);
      expect(data.trait).toBe('Dressage');

      // Verify discipline scores
      expect(data.disciplineScores).toEqual({
        Dressage: 25,
        'Show Jumping': 10,
      });

      // Verify next training date (should be null since 7 days have passed)
      expect(data.nextTrainingDate).toBeNull();

      // Verify earnings
      expect(data.earnings).toBe(2200);

      // Verify last show result
      expect(data.lastShowResult).toEqual({
        showName: 'Summer Invitational',
        placement: '1st',
        runDate: '2025-06-01T00:00:00.000Z',
      });

      // Verify rider info
      expect(data.rider).toEqual({
        name: 'Jenna Black',
        bonusPercent: 0.08,
        penaltyPercent: 0,
      });

      // Verify tack info
      expect(data.tack).toEqual({
        saddleBonus: 5,
        bridleBonus: 3,
      });
    });

    it('should return 404 for non-existent horse', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/horses/99999/overview').expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app).get('/api/horses/invalid/overview').expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle horse with no training history gracefully', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(testHorse);
      getAnyRecentTraining.mockResolvedValue(null);
      mockPrisma.competitionResult.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/horses/1/overview').expect(200);

      const { data } = response.body;
      expect(data.nextTrainingDate).toBeNull();
      expect(data.lastShowResult).toBeNull();
    });

    it('should calculate next training date correctly when horse has recent training', async () => {
      mockPrisma.horse.findUnique.mockResolvedValue(testHorse);

      // Mock recent training (3 days ago, so next training in 4 days)
      const lastTrainingDate = new Date();
      lastTrainingDate.setDate(lastTrainingDate.getDate() - 3);
      getAnyRecentTraining.mockResolvedValue(lastTrainingDate);

      const expectedNextTraining = new Date(lastTrainingDate);
      expectedNextTraining.setDate(expectedNextTraining.getDate() + 7);

      mockPrisma.competitionResult.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/horses/1/overview').expect(200);

      const { data } = response.body;
      expect(new Date(data.nextTrainingDate)).toEqual(expectedNextTraining);
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalHorse = {
        id: 1,
        name: 'Minimal Horse',
        age: 3,
        trait: null,
        disciplineScores: null,
        total_earnings: 0,
        tack: null,
        rider: null,
      };

      mockPrisma.horse.findUnique.mockResolvedValue(minimalHorse);
      getAnyRecentTraining.mockResolvedValue(null);
      mockPrisma.competitionResult.findFirst.mockResolvedValue(null);

      const response = await request(app).get('/api/horses/1/overview').expect(200);

      const { data } = response.body;
      expect(data.name).toBe('Minimal Horse');
      expect(data.trait).toBeNull();
      expect(data.disciplineScores).toEqual({});
      expect(data.earnings).toBe(0);
      expect(data.tack).toEqual({});
      expect(data.rider).toBeNull();
    });
  });
});
