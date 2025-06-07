/**
 * 🧪 INTEGRATION TEST: Horse Overview API - Real Database Integration
 *
 * This test validates the horse overview endpoint with real database operations
 * and minimal strategic mocking following the proven balanced mocking approach.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Horse overview data retrieval: Complete horse information with related data
 * - Training status calculation: Next training date based on 7-day cooldown
 * - Competition history: Most recent competition result display
 * - Data transformation: Proper API response formatting and field mapping
 * - Error handling: 404 for missing horses, validation for invalid IDs
 * - Optional field handling: Graceful handling of null/missing data
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. GET /api/horses/:id/overview - Complete horse overview endpoint
 * 2. Real database queries - Horse, competition, and training data retrieval
 * 3. Business logic validation - Training cooldown calculations
 * 4. Data transformation - API response formatting
 * 5. Error scenarios - Missing horses, invalid IDs
 * 6. Edge cases - Minimal data, null fields
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Database operations, business logic, API responses, data transformation
 * ✅ REAL: Training calculations, competition queries, error handling
 * 🔧 MOCK: Logger only (external dependency)
 *
 * 💡 TEST STRATEGY: Integration testing with real database to validate
 *    complete workflow and actual business logic implementation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';

// Strategic mocking: Only mock external dependencies
jest.mock('../../utils/logger.mjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('🏇 INTEGRATION: Horse Overview API - Real Database Integration', () => {
  let testHorse;
  let testUser;

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestHorse' } } },
    });
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestHorse' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestHorse' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-horse-overview' } },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'testhorseoverviewuser',
        email: 'test-horse-overview@example.com',
        password: 'hashedpassword',
        name: 'Test User',
        level: 5,
        xp: 150,
        money: 5000,
      },
    });

    // Create test horse with real data
    testHorse = await prisma.horse.create({
      data: {
        name: 'TestHorse Nova',
        age: 5,
        sex: 'Mare',
        breed: 'Thoroughbred',
        userId: testUser.id,
        dateOfBirth: new Date('2020-01-01'),
        healthStatus: 'Excellent',
        disciplineScores: {
          Dressage: 25,
          'Show Jumping': 10,
        },
        totalEarnings: 2200,
        tack: {
          saddleBonus: 5,
          bridleBonus: 3,
        },
        rider: {
          name: 'Jenna Black',
          bonusPercent: 0.08,
          penaltyPercent: 0,
        },
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.competitionResult.deleteMany({
      where: { horse: { name: { startsWith: 'TestHorse' } } },
    });
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestHorse' } } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestHorse' } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-horse-overview' } },
    });
  });

  describe('GET /api/horses/:id/overview', () => {
    it('should return complete horse overview data successfully', async () => {
      // Create training history (7 days ago, so next training is available now)
      const lastTrainingDate = new Date();
      lastTrainingDate.setDate(lastTrainingDate.getDate() - 7);

      await prisma.trainingLog.create({
        data: {
          horseId: testHorse.id,
          discipline: 'Dressage',
          sessionDate: lastTrainingDate,
          statGain: 5,
          xpGained: 5,
        },
      });

      // Create competition result
      await prisma.competitionResult.create({
        data: {
          horseId: testHorse.id,
          showName: 'Summer Invitational',
          discipline: 'Dressage',
          placement: '1st',
          score: 95.5,
          prizeWon: 1000,
          runDate: new Date('2025-06-01'),
        },
      });

      const response = await request(app).get(`/api/horses/${testHorse.id}/overview`).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Horse overview retrieved successfully');

      const { data } = response.body;

      // Verify horse basic info
      expect(data.id).toBe(testHorse.id);
      expect(data.name).toBe('TestHorse Nova');
      expect(data.age).toBe(5);

      // Verify discipline scores
      expect(data.disciplineScores).toEqual({
        Dressage: 25,
        'Show Jumping': 10,
      });

      // Verify next training date (should be null since 7 days have passed)
      expect(data.nextTrainingDate).toBeNull();

      // Verify earnings
      expect(data.earnings).toBe(2200);

      // Verify last show result exists
      expect(data.lastShowResult).toBeDefined();
      expect(data.lastShowResult.showName).toBe('Summer Invitational');
      expect(data.lastShowResult.placement).toBe('1st');

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
      const response = await request(app).get(`/api/horses/${testHorse.id}/overview`).expect(200);

      const { data } = response.body;
      expect(data.nextTrainingDate).toBeNull();
      expect(data.lastShowResult).toBeNull();
    });

    it('should calculate next training date correctly when horse has recent training', async () => {
      // Create recent training (3 days ago, so next training in 4 days)
      const lastTrainingDate = new Date();
      lastTrainingDate.setDate(lastTrainingDate.getDate() - 3);

      await prisma.trainingLog.create({
        data: {
          horseId: testHorse.id,
          discipline: 'Dressage',
          sessionDate: lastTrainingDate,
          statGain: 5,
          xpGained: 5,
        },
      });

      const expectedNextTraining = new Date(lastTrainingDate);
      expectedNextTraining.setDate(expectedNextTraining.getDate() + 7);

      const response = await request(app).get(`/api/horses/${testHorse.id}/overview`).expect(200);

      const { data } = response.body;
      expect(new Date(data.nextTrainingDate)).toEqual(expectedNextTraining);
    });

    it('should handle missing optional fields gracefully', async () => {
      // Create minimal horse with real data
      const minimalHorse = await prisma.horse.create({
        data: {
          name: 'TestHorse Minimal',
          age: 3,
          sex: 'Gelding',
          breed: 'Quarter Horse',
          userId: testUser.id,
          dateOfBirth: new Date('2022-01-01'),
          healthStatus: 'Good',
          disciplineScores: {},
          totalEarnings: 0,
          tack: {},
          rider: null,
        },
      });

      const response = await request(app).get(`/api/horses/${minimalHorse.id}/overview`).expect(200);

      const { data } = response.body;
      expect(data.name).toBe('TestHorse Minimal');
      expect(data.disciplineScores).toEqual({});
      expect(data.earnings).toBe(0);
      expect(data.tack).toEqual({});
      expect(data.rider).toBeNull();
    });
  });
});
