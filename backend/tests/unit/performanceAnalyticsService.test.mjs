/**
 * Performance Analytics Service Tests
 *
 * Tests for personal performance tracking and analytics without competitor analysis.
 * Focuses on individual horse performance metrics, win rates, discipline strengths,
 * and historical performance tracking using TDD with NO MOCKING approach.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../db/index.mjs';
import { performanceAnalyticsService } from '../../services/performanceAnalyticsService.mjs';

describe('Performance Analytics Service', () => {
  let testUser;
  let testHorse;
  let testBreed;
  let testShow;
  let testCompetitionResults;

  beforeAll(async () => {
    // Create test user
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `analytics_test_user_${timestamp}`,
        email: `analytics_${timestamp}@test.com`,
        password: 'test_password',
        firstName: 'Analytics',
        lastName: 'Test',
      },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Test Breed',
        description: 'Test breed for analytics',
      },
    });

    // Create test show
    testShow = await prisma.show.create({
      data: {
        name: `Test Show ${Date.now()}`,
        discipline: 'dressage',
        levelMin: 1,
        levelMax: 10,
        entryFee: 100,
        prize: 1000,
        runDate: new Date(),
      },
    });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Analytics Test Horse',
        user: { connect: { id: testUser.id } },
        age: 5,
        sex: 'stallion',
        dateOfBirth: new Date('2020-01-01'),
        breed: { connect: { id: testBreed.id } },
        speed: 75,
        stamina: 80,
        agility: 70,
        balance: 85,
        precision: 78,
        intelligence: 82,
        boldness: 76,
        flexibility: 74,
        obedience: 88,
        focus: 79,
      },
    });

    // Create test competition results for analytics
    const disciplines = ['dressage', 'show_jumping', 'racing', 'cross_country'];
    const placements = [1, 2, 3, 4, 5];

    testCompetitionResults = [];
    for (let i = 0; i < 20; i++) {
      const result = await prisma.competitionResult.create({
        data: {
          horseId: testHorse.id,
          showId: testShow.id,
          discipline: disciplines[i % disciplines.length],
          placement: placements[i % placements.length].toString(),
          score: Math.random() * 100,
          runDate: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)),
          showName: `Test Show ${i + 1}`,
          prizeWon: placements[i % placements.length] <= 3 ? 1000 - (placements[i % placements.length] * 200) : 0,
        },
      });
      testCompetitionResults.push(result);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await prisma.competitionResult.deleteMany({
        where: { horseId: testHorse?.id },
      });
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
      if (testShow) {
        await prisma.show.delete({
          where: { id: testShow.id },
        });
      }
      if (testBreed) {
        await prisma.breed.delete({
          where: { id: testBreed.id },
        });
      }
    }
    await prisma.$disconnect();
  });

  describe('Personal Performance Metrics', () => {
    test('should calculate overall win rate correctly', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics).toBeDefined();
      expect(analytics.overallWinRate).toBeDefined();
      expect(typeof analytics.overallWinRate).toBe('number');
      expect(analytics.overallWinRate).toBeGreaterThanOrEqual(0);
      expect(analytics.overallWinRate).toBeLessThanOrEqual(100);
    });

    test('should calculate win rate by discipline', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.disciplineWinRates).toBeDefined();
      expect(typeof analytics.disciplineWinRates).toBe('object');
      expect(analytics.disciplineWinRates.dressage).toBeDefined();
      expect(analytics.disciplineWinRates.show_jumping).toBeDefined();
      expect(analytics.disciplineWinRates.racing).toBeDefined();
      expect(analytics.disciplineWinRates.cross_country).toBeDefined();
    });

    test('should track placement trends over time', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.placementTrends).toBeDefined();
      expect(Array.isArray(analytics.placementTrends)).toBe(true);
      expect(analytics.placementTrends.length).toBeGreaterThan(0);

      // Check trend data structure
      // eslint-disable-next-line prefer-destructuring
      const trend = analytics.placementTrends[0];
      expect(trend.date).toBeDefined();
      expect(trend.placement).toBeDefined();
      expect(trend.discipline).toBeDefined();
    });

    test('should calculate performance consistency score', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.consistencyScore).toBeDefined();
      expect(typeof analytics.consistencyScore).toBe('number');
      expect(analytics.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(analytics.consistencyScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Historical Performance Tracking', () => {
    test('should provide complete competition history', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.competitionHistory).toBeDefined();
      expect(Array.isArray(analytics.competitionHistory)).toBe(true);
      expect(analytics.competitionHistory.length).toBe(20);

      // Check history data structure
      // eslint-disable-next-line prefer-destructuring
      const competition = analytics.competitionHistory[0];
      expect(competition.discipline).toBeDefined();
      expect(competition.placement).toBeDefined();
      expect(competition.prizeWon).toBeDefined();
      expect(competition.runDate).toBeDefined();
    });

    test('should track total earnings by discipline', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.earningsByDiscipline).toBeDefined();
      expect(typeof analytics.earningsByDiscipline).toBe('object');
      expect(analytics.earningsByDiscipline.dressage).toBeDefined();
      expect(analytics.earningsByDiscipline.show_jumping).toBeDefined();
      expect(analytics.earningsByDiscipline.racing).toBeDefined();
      expect(analytics.earningsByDiscipline.cross_country).toBeDefined();
    });

    test('should track performance improvement over time', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.performanceImprovement).toBeDefined();
      expect(typeof analytics.performanceImprovement).toBe('object');
      expect(analytics.performanceImprovement.recentAverage).toBeDefined();
      expect(analytics.performanceImprovement.historicalAverage).toBeDefined();
      expect(analytics.performanceImprovement.improvementTrend).toBeDefined();
    });
  });

  describe('Discipline Analysis', () => {
    test('should identify strongest disciplines', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.strongestDisciplines).toBeDefined();
      expect(Array.isArray(analytics.strongestDisciplines)).toBe(true);
      expect(analytics.strongestDisciplines.length).toBeGreaterThan(0);

      // Check discipline strength data
      // eslint-disable-next-line prefer-destructuring
      const discipline = analytics.strongestDisciplines[0];
      expect(discipline.name).toBeDefined();
      expect(discipline.winRate).toBeDefined();
      expect(discipline.averagePlacement).toBeDefined();
    });

    test('should identify weakest disciplines', async () => {
      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(testHorse.id);

      expect(analytics.weakestDisciplines).toBeDefined();
      expect(Array.isArray(analytics.weakestDisciplines)).toBe(true);
      expect(analytics.weakestDisciplines.length).toBeGreaterThan(0);

      // Check discipline weakness data
      // eslint-disable-next-line prefer-destructuring
      const discipline = analytics.weakestDisciplines[0];
      expect(discipline.name).toBeDefined();
      expect(discipline.winRate).toBeDefined();
      expect(discipline.averagePlacement).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent horse gracefully', async () => {
      await expect(performanceAnalyticsService.getPerformanceAnalytics(99999))
        .rejects.toThrow('Horse not found');
    });

    test('should handle horse with no competition history', async () => {
      const newHorse = await prisma.horse.create({
        data: {
          name: 'No History Horse',
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

      const analytics = await performanceAnalyticsService.getPerformanceAnalytics(newHorse.id);

      expect(analytics).toBeDefined();
      expect(analytics.overallWinRate).toBe(0);
      expect(analytics.competitionHistory).toEqual([]);

      // Clean up
      await prisma.horse.delete({ where: { id: newHorse.id } });
    });
  });
});
