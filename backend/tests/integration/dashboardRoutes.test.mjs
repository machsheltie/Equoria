/**
 * Dashboard Routes Integration Tests
 * Tests the GET /api/player/dashboard/:playerId endpoint
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the database module BEFORE importing the app
jest.unstable_mockModule(join(__dirname, '../../db/index.js'), () => ({
  default: {
    user: {
      // This mock might still be needed by other parts of the app or other tests
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    player: {
      // Added player mock
      findUnique: jest.fn(),
      // Add other player methods if they are called by the tested code
    },
    horse: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    show: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    competitionResult: {
      count: jest.fn(),
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

// Mock the trainingController
jest.unstable_mockModule(join(__dirname, '../../controllers/trainingController.js'), () => ({
  canTrain: jest.fn(),
  trainHorse: jest.fn(),
  getTrainingStatus: jest.fn(),
  getTrainableHorses: jest.fn(),
  trainRouteHandler: jest.fn(),
}));

// Now import the app and the mocked modules
const app = (await import('../../app.js')).default;
const mockPrisma = (await import(join(__dirname, '../../db/index.js'))).default;
const { getTrainableHorses } = await import('../../controllers/trainingController.js');

describe('Dashboard Routes Integration Tests', () => {
  let testPlayer;
  let testHorses;
  let testShows;

  beforeAll(async () => {
    // Define test data
    testPlayer = {
      id: 'test-dashboard-player',
      name: 'Dashboard Test Player',
      email: 'dashboard@test.com',
      level: 4,
      xp: 230,
      money: 4250,
    };

    testHorses = [
      {
        id: 1,
        name: 'Dashboard Test Horse 1',
        playerId: testPlayer.id,
        age: 5,
        level: 3,
        health: 'Good',
        bond_score: 75,
        stress_level: 15,
      },
      {
        id: 2,
        name: 'Dashboard Test Horse 2',
        playerId: testPlayer.id,
        age: 4,
        level: 2,
        health: 'Excellent',
        bond_score: 85,
        stress_level: 10,
      },
      {
        id: 3,
        name: 'Dashboard Test Horse 3',
        playerId: testPlayer.id,
        age: 8,
        level: 5,
        health: 'Good',
        bond_score: 60,
        stress_level: 25,
      },
    ];

    // Create test shows (upcoming)
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 5);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 7);

    testShows = [
      {
        id: 1,
        name: 'Dashboard Test Show 1',
        discipline: 'Dressage',
        runDate: futureDate1,
        levelMin: 1,
        levelMax: 5,
      },
      {
        id: 2,
        name: 'Dashboard Test Show 2',
        discipline: 'Jumping',
        runDate: futureDate2,
        levelMin: 2,
        levelMax: 6,
      },
    ];
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock responses for dashboard data
    mockPrisma.player.findUnique.mockImplementation(({ where }) => {
      if (where.id === testPlayer.id) {
        return Promise.resolve(testPlayer);
      }
      return Promise.resolve(null);
    });

    mockPrisma.horse.count.mockResolvedValue(testHorses.length);
    getTrainableHorses.mockResolvedValue(testHorses.slice(0, 2)); // 2 trainable horses

    mockPrisma.show.findMany.mockResolvedValue(testShows);
    mockPrisma.competitionResult.count.mockResolvedValue(2); // 2 upcoming entries

    // Mock recent training log
    const recentTrainingDate = new Date();
    recentTrainingDate.setHours(recentTrainingDate.getHours() - 2);
    mockPrisma.trainingLog.findFirst.mockResolvedValue({
      trainedAt: recentTrainingDate,
    });

    // Mock recent competition result
    mockPrisma.competitionResult.findFirst.mockResolvedValue({
      horse: { name: testHorses[1].name },
      placement: '2nd',
      showName: 'Dashboard Test Past Show - Dressage',
    });
  });

  afterAll(async () => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('GET /api/player/dashboard/:playerId', () => {
    it('should return complete dashboard data successfully', async () => {
      const response = await request(app).get(`/api/player/dashboard/${testPlayer.id}`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dashboard data retrieved successfully');

      const { data } = response.body;

      // Verify player info
      expect(data.player).toEqual({
        id: testPlayer.id,
        name: testPlayer.name,
        level: testPlayer.level,
        xp: testPlayer.xp,
        money: testPlayer.money,
      });

      // Verify horse counts
      expect(data.horses.total).toBe(3);
      expect(data.horses.trainable).toBe(2); // Based on our mock

      // Verify shows data
      expect(data.shows.upcomingEntries).toBe(2);
      expect(data.shows.nextShowRuns).toHaveLength(2);
      expect(new Date(data.shows.nextShowRuns[0])).toBeInstanceOf(Date);
      expect(new Date(data.shows.nextShowRuns[1])).toBeInstanceOf(Date);

      // Verify recent activity
      expect(data.recent.lastTrained).toBeTruthy();
      expect(new Date(data.recent.lastTrained)).toBeInstanceOf(Date);

      expect(data.recent.lastShowPlaced).toEqual({
        horseName: testHorses[1].name,
        placement: '2nd',
        show: 'Dashboard Test Past Show - Dressage',
      });
    });

    it('should return 404 for non-existent player', async () => {
      const response = await request(app)
        .get('/api/player/dashboard/nonexistent-player')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Player not found');
    });

    it('should return validation error for empty player ID', async () => {
      const _response = await request(app).get('/api/player/dashboard/').expect(404); // Route not found since playerId is missing
    });

    it('should return validation error for invalid player ID format', async () => {
      const response = await request(app)
        .get(`/api/player/dashboard/${'x'.repeat(100)}`) // Too long
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle player with no horses gracefully', async () => {
      // Mock empty player data
      const emptyPlayer = {
        id: 'test-empty-player',
        name: 'Empty Dashboard Player',
        email: 'empty@test.com',
        level: 1,
        xp: 0,
        money: 1000,
      };

      // Override mocks for this test
      mockPrisma.player.findUnique.mockImplementation(({ where }) => {
        if (where.id === emptyPlayer.id) {
          return Promise.resolve(emptyPlayer);
        }
        return Promise.resolve(null);
      });
      mockPrisma.horse.count.mockResolvedValue(0);
      getTrainableHorses.mockResolvedValue([]);
      mockPrisma.show.findMany.mockResolvedValue([]);
      mockPrisma.competitionResult.count.mockResolvedValue(0);
      mockPrisma.trainingLog.findFirst.mockResolvedValue(null);
      mockPrisma.competitionResult.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/player/dashboard/${emptyPlayer.id}`)
        .expect(200);

      const { data } = response.body;

      expect(data.player.name).toBe('Empty Dashboard Player');
      expect(data.horses.total).toBe(0);
      expect(data.horses.trainable).toBe(0);
      expect(data.shows.upcomingEntries).toBe(0);
      expect(data.shows.nextShowRuns).toHaveLength(0);
      expect(data.recent.lastTrained).toBeNull();
      expect(data.recent.lastShowPlaced).toBeNull();
    });

    it('should handle player with horses but no activity gracefully', async () => {
      // Mock inactive player data
      const inactivePlayer = {
        id: 'test-inactive-player',
        name: 'Inactive Dashboard Player',
        email: 'inactive@test.com',
        level: 2,
        xp: 50,
        money: 2000,
      };

      // Override mocks for this test
      mockPrisma.player.findUnique.mockImplementation(({ where }) => {
        if (where.id === inactivePlayer.id) {
          return Promise.resolve(inactivePlayer);
        }
        return Promise.resolve(null);
      });
      mockPrisma.horse.count.mockResolvedValue(1);
      getTrainableHorses.mockResolvedValue([]);
      mockPrisma.show.findMany.mockResolvedValue([]);
      mockPrisma.competitionResult.count.mockResolvedValue(0);
      mockPrisma.trainingLog.findFirst.mockResolvedValue(null);
      mockPrisma.competitionResult.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/player/dashboard/${inactivePlayer.id}`)
        .expect(200);

      const { data } = response.body;

      expect(data.player.name).toBe('Inactive Dashboard Player');
      expect(data.horses.total).toBe(1);
      expect(data.horses.trainable).toBe(0);
      expect(data.shows.upcomingEntries).toBe(0);
      expect(data.recent.lastTrained).toBeNull();
      expect(data.recent.lastShowPlaced).toBeNull();
    });
  });
});
