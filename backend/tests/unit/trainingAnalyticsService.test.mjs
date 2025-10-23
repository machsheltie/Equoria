/**
 * Training Analytics Service Tests
 *
 * Tests for simple training history tracking without optimization.
 * Focuses on training session logs, stat progression, facility impact,
 * and discipline training balance using TDD with NO MOCKING approach.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../db/index.mjs';
import { trainingAnalyticsService } from '../../services/trainingAnalyticsService.mjs';

describe('Training Analytics Service', () => {
  let testUser;
  let testHorse;
  let testBreed;
  let testTrainingHistory;

  beforeAll(async () => {
    // Create test user
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `training_test_user_${timestamp}`,
        email: `training_${timestamp}@test.com`,
        password: 'test_password',
        firstName: 'Training',
        lastName: 'Test',
      },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Training Test Breed',
        description: 'Test breed for training analytics',
      },
    });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Training Test Horse',
        user: { connect: { id: testUser.id } },
        age: 5,
        sex: 'stallion',
        dateOfBirth: new Date('2020-01-01'),
        breed: { connect: { id: testBreed.id } },
        speed: 60,
        stamina: 65,
        agility: 55,
        balance: 70,
        precision: 58,
        intelligence: 72,
        boldness: 66,
        flexibility: 54,
        obedience: 78,
        focus: 69,
      },
    });

    // Create test training history
    const disciplines = ['dressage', 'show_jumping', 'racing', 'cross_country'];
    testTrainingHistory = [];

    for (let i = 0; i < 12; i++) {
      const training = await prisma.trainingLog.create({
        data: {
          horseId: testHorse.id,
          discipline: disciplines[i % disciplines.length],
          trainedAt: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)), // Weekly training
        },
      });
      testTrainingHistory.push(training);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await prisma.trainingLog.deleteMany({
        where: { horseId: testHorse?.id },
      });
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
      if (testBreed) {
        await prisma.breed.delete({
          where: { id: testBreed.id },
        });
      }
    }
    await prisma.$disconnect();
  });

  describe('Training Session Log', () => {
    test('should provide complete training session history', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      expect(analytics).toBeDefined();
      expect(analytics.trainingHistory).toBeDefined();
      expect(Array.isArray(analytics.trainingHistory)).toBe(true);
      expect(analytics.trainingHistory.length).toBe(12);

      // Check training session data structure
      // eslint-disable-next-line prefer-destructuring
      const session = analytics.trainingHistory[0];
      expect(session.discipline).toBeDefined();
      expect(session.trainedAt).toBeDefined();
      expect(session.horseId).toBe(testHorse.id);
    });

    test('should order training history by date (most recent first)', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      const dates = analytics.trainingHistory.map(session => new Date(session.trainedAt));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    });
  });

  describe('Training Frequency Analysis', () => {
    test('should track training frequency and recent activity', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      expect(analytics.trainingFrequency).toBeDefined();
      expect(analytics.trainingFrequency.totalSessions).toBe(12);
      expect(analytics.trainingFrequency.sessionsPerDiscipline).toBeDefined();
      expect(typeof analytics.trainingFrequency.sessionsPerDiscipline).toBe('object');
      expect(Array.isArray(analytics.trainingFrequency.recentActivity)).toBe(true);
    });

    test('should calculate sessions per discipline correctly', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      const { sessionsPerDiscipline } = analytics.trainingFrequency;
      expect(sessionsPerDiscipline.dressage).toBe(3);
      expect(sessionsPerDiscipline.show_jumping).toBe(3);
      expect(sessionsPerDiscipline.racing).toBe(3);
      expect(sessionsPerDiscipline.cross_country).toBe(3);
    });
  });

  describe('Discipline Training Balance', () => {
    test('should show training distribution across disciplines', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      expect(analytics.disciplineBalance).toBeDefined();
      expect(typeof analytics.disciplineBalance).toBe('object');
      expect(analytics.disciplineBalance.dressage).toBeDefined();
      expect(analytics.disciplineBalance.show_jumping).toBeDefined();
      expect(analytics.disciplineBalance.racing).toBeDefined();
      expect(analytics.disciplineBalance.cross_country).toBeDefined();
    });

    test('should calculate training percentages correctly', async () => {
      const analytics = await trainingAnalyticsService.getTrainingHistory(testHorse.id);

      const balance = analytics.disciplineBalance;
      Object.values(balance).forEach(disciplineData => {
        expect(disciplineData.sessionCount).toBeDefined();
        expect(disciplineData.percentage).toBeDefined();
        expect(disciplineData.lastTrainingDate).toBeDefined();
        expect(disciplineData.firstTrainingDate).toBeDefined();
        expect(disciplineData.percentage).toBe(25); // 3 sessions out of 12 = 25%
      });
    });
  });


  describe('Error Handling', () => {
    test('should handle non-existent horse gracefully', async () => {
      await expect(trainingAnalyticsService.getTrainingHistory(99999))
        .rejects.toThrow('Horse not found');
    });

    test('should handle horse with no training history', async () => {
      const newHorse = await prisma.horse.create({
        data: {
          name: 'No Training Horse',
          user: { connect: { id: testUser.id } },
          age: 3,
          sex: 'mare',
          dateOfBirth: new Date('2022-01-01'),
          breed: { connect: { id: testBreed.id } },
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
        },
      });

      const analytics = await trainingAnalyticsService.getTrainingHistory(newHorse.id);

      expect(analytics).toBeDefined();
      expect(analytics.trainingHistory).toEqual([]);
      expect(analytics.disciplineBalance).toEqual({});
      expect(analytics.trainingFrequency.totalSessions).toBe(0);

      // Clean up
      await prisma.horse.delete({ where: { id: newHorse.id } });
    });
  });
});
