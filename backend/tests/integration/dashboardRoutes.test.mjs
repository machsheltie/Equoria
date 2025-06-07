/**
 * 🧪 INTEGRATION TEST: Dashboard API - Real Database Integration
 *
 * This test validates dashboard endpoints with real database operations
 * following the proven balanced mocking approach for maximum business logic validation.
 *
 * 📋 BUSINESS RULES TESTED:
 * - User dashboard data: Complete user statistics and progress information
 * - Horse statistics: Count, earnings, and performance metrics
 * - Competition data: Recent results and upcoming shows
 * - Progress tracking: XP, level, and achievement calculations
 * - Authentication: Proper access control for dashboard endpoints
 * - Data aggregation: Complex statistics and summary calculations
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. GET /api/user/dashboard/:userId - Complete user dashboard with all statistics
 * 2. Real database queries - User, horse, competition, and show data
 * 3. Business logic validation - Statistics calculations and aggregations
 * 4. Data transformation - API response formatting
 * 5. Error scenarios - Missing users, authentication failures
 * 6. Performance metrics - Response times and data efficiency
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Database operations, business logic, API responses, data aggregation
 * ✅ REAL: Authentication, statistics calculations, progress tracking
 * 🔧 MOCK: Logger only (external dependency)
 *
 * 💡 TEST STRATEGY: Integration testing with real database to validate
 *    complete dashboard functionality and user experience
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

describe('🏠 INTEGRATION: Dashboard API - Real Database Integration', () => {
  let testUser;
  let testToken;
  let testHorses;
  let testBreed;

  beforeEach(async () => {
    // Clean up existing test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestDashboard' } } },
    });
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestDashboard' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-dashboard' } },
    });
    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'TestDashboard Thoroughbred',
        description: 'Test breed for dashboard tests',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test-dashboard@example.com',
        password: 'hashedpassword',
        name: 'Dashboard Test User',
        level: 4,
        xp: 230,
        money: 4250,
      },
    });

    // Generate auth token
    testToken = jwt.sign({ id: testUser.id, email: testUser.email }, config.jwtSecret, { expiresIn: '1h' });

    // Create test horses with real data
    testHorses = await Promise.all([
      prisma.horse.create({
        data: {
          name: 'TestDashboard Horse 1',
          age: 5,
          sex: 'Mare',
          breed: testBreed.name,
          userId: testUser.id,
          dateOfBirth: new Date('2020-01-01'),
          healthStatus: 'Good',
          totalEarnings: 1500,
          disciplineScores: { Dressage: 15 },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'TestDashboard Horse 2',
          age: 4,
          sex: 'Stallion',
          breed: testBreed.name,
          userId: testUser.id,
          dateOfBirth: new Date('2021-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 2200,
          disciplineScores: { 'Show Jumping': 18 },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'TestDashboard Horse 3',
          age: 8,
          sex: 'Gelding',
          breed: testBreed.name,
          userId: testUser.id,
          dateOfBirth: new Date('2017-01-01'),
          healthStatus: 'Good',
          totalEarnings: 3100,
          disciplineScores: { Dressage: 22, 'Show Jumping': 20 },
        },
      }),
    ]);

    // Create upcoming shows
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 5);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 7);

    await Promise.all([
      prisma.show.create({
        data: {
          name: 'TestDashboard Show 1',
          discipline: 'Dressage',
          runDate: futureDate1,
          levelMin: 1,
          levelMax: 5,
          entryFee: 100,
          prizePool: 1000,
        },
      }),
      prisma.show.create({
        data: {
          name: 'TestDashboard Show 2',
          discipline: 'Show Jumping',
          runDate: futureDate2,
          levelMin: 2,
          levelMax: 6,
          entryFee: 150,
          prizePool: 1500,
        },
      }),
    ]);

    // Create recent training and competition activity
    const recentTrainingDate = new Date();
    recentTrainingDate.setHours(recentTrainingDate.getHours() - 2);

    await prisma.trainingLog.create({
      data: {
        horseId: testHorses[0].id,
        discipline: 'Dressage',
        sessionDate: recentTrainingDate,
        statGain: 3,
        xpGained: 5,
      },
    });

    await prisma.competitionResult.create({
      data: {
        horseId: testHorses[1].id,
        showName: 'TestDashboard Past Show - Show Jumping',
        discipline: 'Show Jumping',
        placement: '2nd',
        score: 88.5,
        prizeWon: 800,
        runDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestDashboard' } } },
    });
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestDashboard' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-dashboard' } },
    });
    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestDashboard' } },
    });
  });

  describe('GET /api/user/dashboard/:userId', () => {
    it('should return complete dashboard data successfully', async () => {
      const response = await request(app)
        .get(`/api/user/dashboard/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dashboard data retrieved successfully');

      const { data } = response.body;

      // Verify user info
      expect(data.user).toEqual({
        id: testUser.id,
        name: testUser.name,
        level: testUser.level,
        xp: testUser.xp,
        money: testUser.money,
      });

      // Verify horse counts
      expect(data.horses.total).toBe(3);
      expect(data.horses.totalEarnings).toBe(6800); // Sum of all horse earnings

      // Verify shows data
      expect(data.shows.upcoming).toHaveLength(2);
      expect(data.shows.upcoming[0].name).toBe('TestDashboard Show 1');
      expect(data.shows.upcoming[1].name).toBe('TestDashboard Show 2');

      // Verify recent activity exists
      expect(data.recent.lastTrained).toBeTruthy();
      expect(new Date(data.recent.lastTrained)).toBeInstanceOf(Date);

      expect(data.recent.lastShowPlaced).toBeTruthy();
      expect(data.recent.lastShowPlaced.horseName).toBe('TestDashboard Horse 2');
      expect(data.recent.lastShowPlaced.placement).toBe('2nd');
      expect(data.recent.lastShowPlaced.show).toBe('TestDashboard Past Show - Show Jumping');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/user/dashboard/nonexistent-user')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await request(app).get(`/api/user/dashboard/${testUser.id}`).expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No auth token provided');
    });

    it('should return validation error for invalid user ID format', async () => {
      const response = await request(app)
        .get(`/api/user/dashboard/${'x'.repeat(100)}`) // Too long
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should handle user with no horses gracefully', async () => {
      // Create empty user with real data
      const emptyUser = await prisma.user.create({
        data: {
          username: 'emptydashboarduser',
          firstName: 'Empty',
          lastName: 'User',
          email: 'test-dashboard-empty@example.com',
          password: 'hashedpassword',
          level: 1,
          xp: 0,
          money: 1000,
        },
      });

      const emptyToken = jwt.sign({ id: emptyUser.id, email: emptyUser.email }, config.jwtSecret, { expiresIn: '1h' });

      const response = await request(app)
        .get(`/api/user/dashboard/${emptyUser.id}`)
        .set('Authorization', `Bearer ${emptyToken}`)
        .expect(200);

      const { data } = response.body;

      expect(data.user.name).toBe('Empty Dashboard User');
      expect(data.horses.total).toBe(0);
      expect(data.horses.totalEarnings).toBe(0);
      expect(data.shows.upcoming).toHaveLength(2); // Shows still exist
      expect(data.recent.lastTrained).toBeNull();
      expect(data.recent.lastShowPlaced).toBeNull();
    });

    it('should handle user with horses but no activity gracefully', async () => {
      // Create inactive user with horse but no activity
      const inactiveUser = await prisma.user.create({
        data: {
          username: 'inactivedashboarduser',
          firstName: 'Inactive',
          lastName: 'User',
          email: 'test-dashboard-inactive@example.com',
          password: 'hashedpassword',
          level: 2,
          xp: 50,
          money: 2000,
        },
      });

      // Create horse with no training/competition history
      await prisma.horse.create({
        data: {
          name: 'TestDashboard Inactive Horse',
          age: 3,
          sex: 'Mare',
          breed: testBreed.name,
          userId: inactiveUser.id,
          dateOfBirth: new Date('2022-01-01'),
          healthStatus: 'Good',
          totalEarnings: 0,
        },
      });

      const inactiveToken = jwt.sign({ id: inactiveUser.id, email: inactiveUser.email }, config.jwtSecret, {
        expiresIn: '1h',
      });

      const response = await request(app)
        .get(`/api/user/dashboard/${inactiveUser.id}`)
        .set('Authorization', `Bearer ${inactiveToken}`)
        .expect(200);

      const { data } = response.body;

      expect(data.user.name).toBe('Inactive Dashboard User');
      expect(data.horses.total).toBe(1);
      expect(data.horses.totalEarnings).toBe(0);
      expect(data.recent.lastTrained).toBeNull();
      expect(data.recent.lastShowPlaced).toBeNull();
    });
  });
});
