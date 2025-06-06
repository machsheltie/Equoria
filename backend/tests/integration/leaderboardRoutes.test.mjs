/**
 * Leaderboard Routes Integration Tests
 * Tests for leaderboard API endpoints integration with the database
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Create a mock prisma client - DEFINED BEFORE USAGE IN JEST.MOCK
const mockPrisma = {
  player: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    // Added user for consistency with other tests, might be needed by controller
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
  horse: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn(),
  },
  competitionResult: {
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  xpEvent: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  breed: {
    findMany: jest.fn(),
  },
  show: {
    count: jest.fn(),
  },
  $disconnect: jest.fn(),
};

// We need to mock dependencies before importing the controller
jest.unstable_mockModule('../../db/index.mjs', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock logger
jest.mock('../../utils/logger.mjs', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Now import controller after mocks are set up
import {
  getTopPlayersByLevel,
  getTopPlayersByXP,
  getTopHorsesByEarnings,
  getTopHorsesByPerformance,
  getTopPlayersByHorseEarnings,
  getRecentWinners,
  getLeaderboardStats,
} from '../../controllers/leaderboardController.mjs';

// Create a test express app
const app = express();
app.use(express.json());

// Mock auth middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-player-id-1' };
  next();
};

// Set up leaderboard routes
const router = express.Router();
router.get('/players/level', mockAuth, getTopPlayersByLevel);
router.get('/players/xp', mockAuth, getTopPlayersByXP);
router.get('/horses/earnings', mockAuth, getTopHorsesByEarnings);
router.get('/horses/performance', mockAuth, getTopHorsesByPerformance);
router.get('/players/horse-earnings', mockAuth, getTopPlayersByHorseEarnings);
router.get('/recent-winners', mockAuth, getRecentWinners);
router.get('/stats', mockAuth, getLeaderboardStats);
app.use('/api/leaderboard', router);
const configModule = await import('../../config/config.js');
const config = configModule.default || configModule;

describe('Leaderboard Routes Integration Tests', () => {
  let testToken;
  let testPlayer;
  let mockPlayers;
  let mockHorses;
  let mockCompetitionResults;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up test player data
    testPlayer = {
      id: 'test-player-id-1',
      name: 'Leaderboard Test Player',
      email: 'leaderboard@test.com',
      level: 8,
      xp: 75,
      money: 12000,
    };

    // Generate auth token for test player
    testToken = jwt.sign({ id: testPlayer.id, email: testPlayer.email }, config.jwtSecret, {
      expiresIn: '1h',
    });

    // Set up mock data
    mockPlayers = [
      {
        id: 'player-id-1',
        name: 'Top Player 1',
        level: 15,
        xp: 50,
        money: 25000,
      },
      {
        id: 'player-id-2',
        name: 'Top Player 2',
        level: 14,
        xp: 90,
        money: 18000,
      },
      {
        id: 'player-id-3',
        name: 'Top Player 3',
        level: 14,
        xp: 30,
        money: 21500,
      },
    ];

    mockHorses = [
      {
        id: 1,
        name: 'Champion',
        total_earnings: 45000,
        breed: { name: 'Thoroughbred' },
        player: { id: 'player-id-1', name: 'Top Player 1' },
      },
      {
        id: 2,
        name: 'Silver Star',
        total_earnings: 37500,
        breed: { name: 'Arabian' },
        player: { id: 'player-id-2', name: 'Top Player 2' },
      },
      {
        id: 3,
        name: 'Gold Rush',
        total_earnings: 32000,
        breed: { name: 'Andalusian' },
        player: { id: 'player-id-3', name: 'Top Player 3' },
      },
    ];

    mockCompetitionResults = [
      {
        id: 1,
        showName: 'Grand Prix Classic',
        discipline: 'Dressage',
        placement: '1st',
        prizeWon: 15000,
        score: 95.7,
        runDate: new Date('2025-05-15'),
        horse: {
          id: 1,
          name: 'Champion',
          breed: { name: 'Thoroughbred' },
          player: { id: 'player-id-1', name: 'Top Player 1' },
        },
      },
      {
        id: 2,
        showName: 'Regional Championship',
        discipline: 'Show Jumping',
        placement: '1st',
        prizeWon: 12000,
        score: 92.3,
        runDate: new Date('2025-05-10'),
        horse: {
          id: 2,
          name: 'Silver Star',
          breed: { name: 'Arabian' },
          player: { id: 'player-id-2', name: 'Top Player 2' },
        },
      },
      {
        id: 3,
        showName: 'Evening Classic',
        discipline: 'Cross Country',
        placement: '1st',
        prizeWon: 9000,
        score: 88.5,
        runDate: new Date('2025-05-05'),
        horse: {
          id: 3,
          name: 'Gold Rush',
          breed: { name: 'Andalusian' },
          player: { id: 'player-id-3', name: 'Top Player 3' },
        },
      },
    ];
  });

  afterAll(async () => {
    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('GET /api/leaderboard/players/level', () => {
    it('should return top players by level', async () => {
      // Set up mock response
      mockPrisma.user.findMany.mockResolvedValue(mockPlayers);

      const response = await request(app)
        .get('/api/leaderboard/players/level')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top players by level retrieved successfully');
      expect(response.body.data.rankings).toHaveLength(3);
      expect(response.body.data.rankings[0].name).toBe('Top Player 1');
      expect(response.body.data.rankings[0].level).toBe(15);

      // Verify database was called with correct parameters
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          level: true,
          xp: true,
          money: true,
        },
        orderBy: [{ level: 'desc' }, { xp: 'desc' }],
        take: 10,
        skip: 0,
      });
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app).get('/api/leaderboard/players/level').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No auth token provided');
    });
  });

  describe('GET /api/leaderboard/horses/earnings', () => {
    it('should return top horses by earnings', async () => {
      // Set up mock response
      mockPrisma.horse.findMany.mockResolvedValue(mockHorses);

      const response = await request(app)
        .get('/api/leaderboard/horses/earnings')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top horses by earnings retrieved successfully');
      expect(response.body.data.rankings).toHaveLength(3);
      expect(response.body.data.rankings[0].name).toBe('Champion');
      expect(response.body.data.rankings[0].earnings).toBe(45000);

      // Verify database was called with correct parameters
      expect(mockPrisma.horse.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          total_earnings: true,
          breed: {
            select: {
              name: true,
            },
          },
          player: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        where: {
          total_earnings: {
            gt: 0,
          },
        },
        orderBy: {
          total_earnings: 'desc',
        },
        take: 10,
        skip: 0,
      });
    });
  });

  describe('GET /api/leaderboard/recent-winners', () => {
    it('should return recent competition winners', async () => {
      // Set up mock response
      mockPrisma.competitionResult.findMany.mockResolvedValue(mockCompetitionResults);

      const response = await request(app)
        .get('/api/leaderboard/recent-winners')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Recent competition winners retrieved successfully');
      expect(response.body.data.winners).toHaveLength(3);
      expect(response.body.data.winners[0].horse.name).toBe('Champion');
      expect(response.body.data.winners[0].competition.discipline).toBe('Dressage');

      // Verify database was called with correct parameters
      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith({
        where: {
          placement: '1st',
        },
        select: {
          id: true,
          score: true,
          discipline: true,
          runDate: true,
          showName: true,
          prizeWon: true,
          horse: {
            select: {
              id: true,
              name: true,
              breed: {
                select: {
                  name: true,
                },
              },
              player: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          runDate: 'desc',
        },
        take: 20,
      });
    });

    it('should filter by discipline', async () => {
      // Set up mock response for filtered data
      const filteredResults = [mockCompetitionResults[0]];
      mockPrisma.competitionResult.findMany.mockResolvedValue(filteredResults);

      const response = await request(app)
        .get('/api/leaderboard/recent-winners')
        .query({ discipline: 'Dressage' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.data.winners).toHaveLength(1);
      expect(response.body.data.winners[0].competition.discipline).toBe('Dressage');
      expect(response.body.data.discipline).toBe('Dressage');

      // Verify database was called with correct parameters
      expect(mockPrisma.competitionResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            placement: '1st',
            discipline: 'Dressage',
          },
        }),
      );
    });
  });

  describe('GET /api/leaderboard/stats', () => {
    it('should return comprehensive leaderboard statistics', async () => {
      // Set up mock stats
      const mockStats = {
        playerCount: 120,
        horseCount: 350,
        showCount: 75,
        totalEarnings: 2500000,
        totalXp: 850000,
        avgLevel: 9.2,
      };

      mockPrisma.user.count.mockResolvedValue(mockStats.playerCount);
      mockPrisma.horse.count.mockResolvedValue(mockStats.horseCount);
      mockPrisma.show.count.mockResolvedValue(mockStats.showCount);
      mockPrisma.horse.aggregate.mockResolvedValue({
        _sum: { total_earnings: mockStats.totalEarnings },
      });
      mockPrisma.xpEvent.aggregate.mockResolvedValue({
        _sum: { amount: mockStats.totalXp },
      });
      mockPrisma.user.aggregate.mockResolvedValue({
        _avg: { level: mockStats.avgLevel },
      });

      // Mock top performers
      mockPrisma.user.findFirst.mockResolvedValue(mockPlayers[0]);
      mockPrisma.horse.findFirst.mockResolvedValue(mockHorses[0]);
      mockPrisma.competitionResult.count.mockResolvedValue(25);

      // Mock discipline stats
      mockPrisma.competitionResult.groupBy.mockResolvedValue([
        { discipline: 'Dressage', _count: { discipline: 30 } },
        { discipline: 'Show Jumping', _count: { discipline: 25 } },
        { discipline: 'Racing', _count: { discipline: 20 } },
      ]);

      const response = await request(app)
        .get('/api/leaderboard/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Leaderboard statistics retrieved successfully');

      const { data } = response.body;
      expect(data.overview.totalPlayers).toBe(mockStats.playerCount);
      expect(data.overview.totalHorses).toBe(mockStats.horseCount);
      expect(data.overview.totalPrizeMoney).toBe(mockStats.totalEarnings);
      expect(data.overview.averagePlayerLevel).toBe(mockStats.avgLevel);

      expect(data.topPerformers.topPlayer.name).toBe('Top Player 1');
      expect(data.topPerformers.topHorse.name).toBe('Champion');
      expect(data.disciplines).toHaveLength(3);
    });
  });
});
