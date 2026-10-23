/**
 * Foal Task Log and Streak Data Integration Test
 * Tests the integration between database storage and utility functions
 *
 * 🎯 FEATURES TESTED:
 * - Integration between database schema and utility functions
 * - Real-world foal care scenarios with task logging and streak tracking
 * - Streak calculation in practice
 * - Grace period handling and streak maintenance
 *
 * 🔧 DEPENDENCIES:
 * - Horse model with taskLog and lastGroomed fields
 * - foalTaskLogManager utility functions
 * - Prisma database operations
 *
 * 📋 BUSINESS RULES TESTED:
 * - Task log stores and retrieves task repetition counts correctly
 * - Streak data enables the streak bonus mechanics
 * - Grace period allows for missed days without breaking streaks
 * - Integration between daily task exclusivity and streak tracking
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (testing real integration between all systems)
 * - Real: Database operations, utility functions, business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  updateFoalCareData,
  getFoalCareSummary,
  calculateStreakFromLastCareDate,
} from '../../../utils/foalTaskLogManager.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

describe('Foal Task Log and Streak Data Integration', () => {
  let testUser, testFoal;
  const testUserId = 'test-user-integration';

  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate dates for integration test scenarios
  const day1 = new Date(referenceDate);
  day1.setHours(10, 0, 0, 0); // June 1st, 10:00 AM
  const day3 = new Date(referenceDate);
  day3.setDate(referenceDate.getDate() + 2);
  day3.setHours(14, 0, 0, 0); // June 3rd, 2:00 PM
  const day4 = new Date(referenceDate);
  day4.setDate(referenceDate.getDate() + 3);
  day4.setHours(11, 0, 0, 0); // June 4th, 11:00 AM
  const day5 = new Date(referenceDate);
  day5.setDate(referenceDate.getDate() + 4);
  day5.setHours(12, 0, 0, 0); // June 5th, 12:00 PM
  const day10 = new Date(referenceDate);
  day10.setDate(referenceDate.getDate() + 9);
  day10.setHours(12, 0, 0, 0); // June 10th, 12:00 PM
  const day15 = new Date(referenceDate);
  day15.setDate(referenceDate.getDate() + 14);
  day15.setHours(12, 0, 0, 0); // June 15th, 12:00 PM

  beforeEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await prisma.$transaction(async tx => {
      testUser = await tx.user.create({
        data: {
          id: testUserId,
          username: 'integrationuser',
          email: 'integration@example.com',
          password: 'TestPassword123!',
          firstName: 'Integration',
          lastName: 'Tester',
          money: 1000,
        },
      });

      testFoal = await tx.horse.create({
        data: {
          ...fixtureColor(),
          name: 'Test Foal Integration',
          sex: 'Filly',
          dateOfBirth: gameCalendarDate(new Date(), -180), // 6 months ago
          age: 180,
          user: {
            connect: { id: testUser.id },
          },
          bondScore: 30,
          taskLog: null,
          lastGroomed: null,
          daysGroomedInARow: 0,
        },
      });
    });
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  describe('Real-World Foal Development Scenarios', () => {
    it('should handle week 1 of foal care with enrichment tasks', async () => {
      // Day 1: First trust building session
      let careData = updateFoalCareData(
        { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 },
        'trustBuilding',
        day1,
      );

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Day 3: Desensitization session (2-day gap within grace period)
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      careData = updateFoalCareData(foal, 'desensitization', day3);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Day 4: Another trust building session
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      careData = updateFoalCareData(foal, 'trustBuilding', day4);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify final state
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      expect(foal.taskLog).toEqual({
        trustBuilding: 2,
        desensitization: 1,
      });
      expect(foal.daysGroomedInARow).toBe(2); // 2 consecutive care sessions (day 3 and 4)
      expect(foal.lastGroomed).toEqual(day4);
    });

    it('should handle streak break and recovery', async () => {
      // Build up a 5-day streak
      const initialData = {
        taskLog: { trustBuilding: 3, earlyTouch: 2 },
        lastGroomed: day5,
        daysGroomedInARow: 5,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: initialData,
      });

      // Miss several days (break streak)
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const careData = updateFoalCareData(foal, 'showgroundExposure', day10);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify streak reset but task log preserved
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      expect(foal.taskLog).toEqual({
        trustBuilding: 3,
        earlyTouch: 2,
        showgroundExposure: 1,
      });
      expect(foal.daysGroomedInARow).toBe(1); // Reset to 1
      expect(foal.lastGroomed).toEqual(day10);
    });

    // Old contract: the seventh day reported hasBurnoutImmunity. Owner ruling
    // 2026-10-23 (Equoria-0gl9o): there is no burnout; the streak stays.
    it('builds a 7-day care streak with no burnout immunity label', async () => {
      // Simulate 7 consecutive days of care
      const tasks = [
        'trustBuilding',
        'desensitization',
        'earlyTouch',
        'trustBuilding',
        'showgroundExposure',
        'earlyTouch',
        'trustBuilding',
      ];
      let currentData = { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 };

      for (let i = 0; i < 7; i++) {
        const careDate = new Date(referenceDate);
        careDate.setDate(referenceDate.getDate() + i);
        careDate.setHours(12, 0, 0, 0);
        currentData = updateFoalCareData(currentData, tasks[i], careDate);

        await prisma.horse.update({
          where: { id: testFoal.id },
          data: currentData,
        });
      }

      const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const summary = getFoalCareSummary(foal);

      expect(summary.consecutiveDaysOfCare).toBe(7);
      expect(summary).not.toHaveProperty('hasBurnoutImmunity');
      expect(summary.totalTaskCompletions).toBe(7);
      expect(summary.uniqueTasksCompleted).toBe(4); // trustBuilding, desensitization, earlyTouch, showgroundExposure
    });
  });

  describe('Grace Period and Streak Maintenance', () => {
    it('should maintain streak within 2-day grace period', async () => {
      // Day 1: Initial care
      let careData = updateFoalCareData(
        { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 },
        'trustBuilding',
        day1,
      );

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Day 3: Care within grace period (2-day gap)
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      const streakInfo = calculateStreakFromLastCareDate(foal.lastGroomed, day3);
      expect(streakInfo.isStreakActive).toBe(true);
      expect(streakInfo.isWithinGracePeriod).toBe(true);
      expect(streakInfo.daysSinceLastCare).toBe(2);

      careData = updateFoalCareData(foal, 'desensitization', day3);
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify streak continued
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      expect(foal.daysGroomedInARow).toBe(2);
    });

    it('should break streak beyond grace period', async () => {
      // Initial streak
      const initialData = {
        taskLog: { trustBuilding: 2 },
        lastGroomed: day1,
        daysGroomedInARow: 3,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: initialData,
      });

      // Care after grace period (4 days later)
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      const streakInfo = calculateStreakFromLastCareDate(foal.lastGroomed, day5);
      expect(streakInfo.isStreakActive).toBe(false);
      expect(streakInfo.streakBroken).toBe(true);
      expect(streakInfo.daysSinceLastCare).toBe(4);

      const careData = updateFoalCareData(foal, 'earlyTouch', day5);
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify streak reset
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      expect(foal.daysGroomedInARow).toBe(1); // Reset to 1
    });
  });

  describe('Care Summary Statistics', () => {
    it('should provide comprehensive care statistics', async () => {
      // Set up comprehensive foal data
      const foalData = {
        taskLog: {
          trustBuilding: 8,
          desensitization: 5,
          earlyTouch: 6,
          showgroundExposure: 3,
          hoofHandling: 2,
        },
        lastGroomed: day15,
        daysGroomedInARow: 12,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: foalData,
      });

      // Get comprehensive summary
      const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const summary = getFoalCareSummary(foal);

      expect(summary.totalTaskCompletions).toBe(24);
      expect(summary.uniqueTasksCompleted).toBe(5);
      expect(summary.consecutiveDaysOfCare).toBe(12);
      expect(summary.completedTaskTypes).toContain('trustBuilding');
      expect(summary.completedTaskTypes).toContain('desensitization');
      expect(summary.completedTaskTypes).toContain('earlyTouch');
      expect(summary.completedTaskTypes).toContain('showgroundExposure');
      expect(summary.completedTaskTypes).toContain('hoofHandling');
      expect(summary.lastCareDate).toEqual(foalData.lastGroomed);
    });
  });

  describe('Data Persistence and Integrity', () => {
    it('should maintain data integrity across multiple updates', async () => {
      // Perform multiple care sessions
      const session1Date = new Date(referenceDate);
      session1Date.setHours(10, 0, 0, 0);
      const session2Date = new Date(referenceDate);
      session2Date.setDate(referenceDate.getDate() + 1);
      session2Date.setHours(11, 0, 0, 0);
      const session3Date = new Date(referenceDate);
      session3Date.setDate(referenceDate.getDate() + 2);
      session3Date.setHours(12, 0, 0, 0);
      const session4Date = new Date(referenceDate);
      session4Date.setDate(referenceDate.getDate() + 3);
      session4Date.setHours(13, 0, 0, 0);
      const session5Date = new Date(referenceDate);
      session5Date.setDate(referenceDate.getDate() + 4);
      session5Date.setHours(14, 0, 0, 0);

      const careSessions = [
        { task: 'trustBuilding', date: session1Date },
        { task: 'trustBuilding', date: session2Date },
        { task: 'desensitization', date: session3Date },
        { task: 'earlyTouch', date: session4Date },
        { task: 'trustBuilding', date: session5Date },
      ];

      let currentData = { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 };

      for (const session of careSessions) {
        currentData = updateFoalCareData(currentData, session.task, session.date);

        await prisma.horse.update({
          where: { id: testFoal.id },
          data: currentData,
        });

        // Verify data persists correctly after each update
        const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
        expect(foal.taskLog).toEqual(currentData.taskLog);
        expect(foal.lastGroomed).toEqual(currentData.lastGroomed);
        expect(foal.daysGroomedInARow).toEqual(currentData.daysGroomedInARow);
      }

      // Verify final state
      const finalFoal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      expect(finalFoal.taskLog).toEqual({
        trustBuilding: 3,
        desensitization: 1,
        earlyTouch: 1,
      });
      expect(finalFoal.daysGroomedInARow).toBe(5);
    });
  });
});
