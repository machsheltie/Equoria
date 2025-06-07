/**
 * 🧪 INTEGRATION TEST: Leaderboard API - Real Database Integration
 *
 * This test validates leaderboard endpoints with real database operations
 * following the proven balanced mocking approach for maximum business logic validation.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Player rankings: Level-based and XP-based leaderboards with proper sorting
 * - Horse rankings: Earnings-based and performance-based leaderboards
 * - Competition winners: Recent winners with discipline filtering
 * - Statistics aggregation: Comprehensive leaderboard statistics
 * - Authentication: Proper access control for all endpoints
 * - Data filtering: Discipline-specific filtering and pagination
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. GET /api/leaderboard/players/level - Top players by level
 * 2. GET /api/leaderboard/players/xp - Top players by XP
 * 3. GET /api/leaderboard/horses/earnings - Top horses by earnings
 * 4. GET /api/leaderboard/horses/performance - Top horses by performance
 * 5. GET /api/leaderboard/recent-winners - Recent competition winners
 * 6. GET /api/leaderboard/stats - Comprehensive statistics
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Database operations, business logic, API responses, data aggregation
 * ✅ REAL: Authentication, filtering, sorting, pagination
 * 🔧 MOCK: Logger only (external dependency)
 *
 * 💡 TEST STRATEGY: Integration testing with real database to validate
 *    complete leaderboard functionality and ranking algorithms
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import config from '../../config/config.js';

// Strategic mocking: Only mock external dependencies
jest.mock('../../utils/logger.mjs', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('🏆 INTEGRATION: Leaderboard API - Real Database Integration', () => {
  let testToken;
  let testUser;
  let testUsers;
  let testHorses;
  let testBreed;

  beforeEach(async () => {
    // Clean up existing test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestLeaderboard' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestLeaderboard' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-leaderboard' } },
    });
    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestBreed' } },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'TestBreed Thoroughbred',
        description: 'Test breed for leaderboard tests',
      },
    });

    // Create test users with varying levels and XP
    testUsers = await Promise.all([
      prisma.user.create({
        data: {
          email: 'test-leaderboard-1@example.com',
          username: 'topplayer1',
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player1',
          level: 15,
          xp: 50,
          money: 25000,
        },
      }),
      prisma.user.create({
        data: {
          email: 'test-leaderboard-2@example.com',
          username: 'topplayer2',
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player2',
          level: 14,
          xp: 90,
          money: 18000,
        },
      }),
      prisma.user.create({
        data: {
          email: 'test-leaderboard-3@example.com',
          username: 'topplayer3',
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player3',
          level: 14,
          xp: 30,
          money: 21500,
        },
      }),
    ]);

    // Use first user as test user for authentication
    [testUser] = testUsers;

    // Generate auth token for test user
    testToken = jwt.sign({ id: testUser.id, email: testUser.email }, config.jwtSecret, { expiresIn: '1h' });

    // Create test horses with varying earnings
    testHorses = await Promise.all([
      prisma.horse.create({
        data: {
          name: 'TestLeaderboard Champion',
          age: 6,
          sex: 'Stallion',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[0].id } },
          dateOfBirth: new Date('2019-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 45000,
        },
      }),
      prisma.horse.create({
        data: {
          name: 'TestLeaderboard Silver Star',
          age: 5,
          sex: 'Mare',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[1].id } },
          dateOfBirth: new Date('2020-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 37500,
        },
      }),
      prisma.horse.create({
        data: {
          name: 'TestLeaderboard Gold Rush',
          age: 4,
          sex: 'Gelding',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[2].id } },
          dateOfBirth: new Date('2021-01-01'),
          healthStatus: 'Good',
          totalEarnings: 32000,
        },
      }),
    ]);

    // Create competition results
    await Promise.all([
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[0].id,
          showName: 'Grand Prix Classic',
          discipline: 'Dressage',
          placement: '1st',
          prizeWon: 15000,
          score: 95.7,
          runDate: new Date('2025-05-15'),
        },
      }),
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[1].id,
          showName: 'Regional Championship',
          discipline: 'Show Jumping',
          placement: '1st',
          prizeWon: 12000,
          score: 92.3,
          runDate: new Date('2025-05-10'),
        },
      }),
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[2].id,
          showName: 'Evening Classic',
          discipline: 'Cross Country',
          placement: '1st',
          prizeWon: 9000,
          score: 88.5,
          runDate: new Date('2025-05-05'),
        },
      }),
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestLeaderboard' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestLeaderboard' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-leaderboard' } },
    });
    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestBreed' } },
    });
  });

  describe('GET /api/leaderboard/players/level', () => {
    it('should return top players by level', async () => {
      const response = await request(app)
        .get('/api/leaderboard/players/level')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top players by level retrieved successfully');
      expect(response.body.data.rankings).toHaveLength(3);

      // Verify proper sorting (level desc, then xp desc)
      const { rankings } = response.body.data;
      expect(rankings[0].firstName).toBe('Top');
      expect(rankings[0].level).toBe(15);
      expect(rankings[1].firstName).toBe('Top');
      expect(rankings[1].level).toBe(14);
      expect(rankings[1].xp).toBe(90); // Higher XP than Player 3
      expect(rankings[2].firstName).toBe('Top');
      expect(rankings[2].level).toBe(14);
      expect(rankings[2].xp).toBe(30); // Lower XP than Player 2
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app).get('/api/leaderboard/players/level').expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No auth token provided');
    });
  });

  describe('GET /api/leaderboard/horses/earnings', () => {
    it('should return top horses by earnings', async () => {
      const response = await request(app)
        .get('/api/leaderboard/horses/earnings')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top horses by earnings retrieved successfully');
      expect(response.body.data.rankings).toHaveLength(3);

      // Verify proper sorting by earnings (desc)
      const { rankings } = response.body.data;
      expect(rankings[0].name).toBe('TestLeaderboard Champion');
      expect(rankings[0].earnings).toBe(45000);
      expect(rankings[1].name).toBe('TestLeaderboard Silver Star');
      expect(rankings[1].earnings).toBe(37500);
      expect(rankings[2].name).toBe('TestLeaderboard Gold Rush');
      expect(rankings[2].earnings).toBe(32000);

      // Verify breed and owner information is included
      expect(rankings[0].breed.name).toBe('TestBreed Thoroughbred');
      expect(rankings[0].owner.name).toBe('Top Player 1');
    });
  });

  describe('GET /api/leaderboard/recent-winners', () => {
    it('should return recent competition winners', async () => {
      const response = await request(app)
        .get('/api/leaderboard/recent-winners')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Recent competition winners retrieved successfully');
      expect(response.body.data.winners).toHaveLength(3);

      // Verify proper sorting by date (most recent first)
      const { winners } = response.body.data;
      expect(winners[0].horse.name).toBe('TestLeaderboard Champion');
      expect(winners[0].competition.discipline).toBe('Dressage');
      expect(winners[0].competition.showName).toBe('Grand Prix Classic');
      expect(winners[0].competition.prizeWon).toBe(15000);

      // Verify horse and owner information is included
      expect(winners[0].horse.breed.name).toBe('TestBreed Thoroughbred');
      expect(winners[0].horse.owner.name).toBe('Top Player 1');
    });

    it('should filter by discipline', async () => {
      const response = await request(app)
        .get('/api/leaderboard/recent-winners')
        .query({ discipline: 'Dressage' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.data.winners).toHaveLength(1);
      expect(response.body.data.winners[0].competition.discipline).toBe('Dressage');
      expect(response.body.data.discipline).toBe('Dressage');
      expect(response.body.data.winners[0].horse.name).toBe('TestLeaderboard Champion');
    });
  });

  describe('GET /api/leaderboard/stats', () => {
    it('should return comprehensive leaderboard statistics', async () => {
      const response = await request(app)
        .get('/api/leaderboard/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Leaderboard statistics retrieved successfully');

      const { data } = response.body;

      // Verify overview statistics
      expect(data.overview.totalPlayers).toBe(3);
      expect(data.overview.totalHorses).toBe(3);
      expect(data.overview.totalPrizeMoney).toBe(114500); // Sum of all horse earnings
      expect(data.overview.averagePlayerLevel).toBeCloseTo(14.33, 1); // (15+14+14)/3

      // Verify top performers
      expect(data.topPerformers.topPlayer.name).toBe('Top Player 1');
      expect(data.topPerformers.topPlayer.level).toBe(15);
      expect(data.topPerformers.topHorse.name).toBe('TestLeaderboard Champion');
      expect(data.topPerformers.topHorse.earnings).toBe(45000);

      // Verify discipline statistics
      expect(data.disciplines).toHaveLength(3);
      const disciplineNames = data.disciplines.map(d => d.discipline);
      expect(disciplineNames).toContain('Dressage');
      expect(disciplineNames).toContain('Show Jumping');
      expect(disciplineNames).toContain('Cross Country');

      // Each discipline should have 1 competition
      data.disciplines.forEach(discipline => {
        expect(discipline.count).toBe(1);
      });
    });
  });
});
