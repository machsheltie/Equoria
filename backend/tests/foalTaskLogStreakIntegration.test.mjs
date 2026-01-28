/**
 * Foal Task Log and Streak Data Integration Test
 * Tests the integration between database storage and utility functions
 *
 * 🎯 FEATURES TESTED:
 * - Integration between database schema and utility functions
 * - Real-world foal care scenarios with task logging and streak tracking
 * - Task influence mapping integration with task log storage
 * - Streak calculation and burnout immunity in practice
 * - Grace period handling and streak maintenance
 *
 * 🔧 DEPENDENCIES:
 * - Horse model with taskLog and lastGroomed fields
 * - foalTaskLogManager utility functions
 * - taskInfluenceConfig for trait evaluation
 * - Prisma database operations
 *
 * 📋 BUSINESS RULES TESTED:
 * - Task log stores and retrieves task repetition counts correctly
 * - Streak data enables burnout immunity and bonus mechanics
 * - Grace period allows for missed days without breaking streaks
 * - Task history supports trait evaluation and development tracking
 * - Integration between daily task exclusivity and streak tracking
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (testing real integration between all systems)
 * - Real: Database operations, utility functions, business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../db/index.mjs';
import {
  updateFoalCareData,
  getFoalCareSummary,
  calculateStreakFromLastCareDate,
} from '../utils/foalTaskLogManager.mjs';
import { calculateTraitPoints } from '../config/taskInfluenceConfig.mjs';

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
    await prisma.horse.deleteMany({ where: { ownerId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await prisma.$transaction(async (tx) => {
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
          name: 'Test Foal Integration',
          sex: 'Filly',
          dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
          age: 180,
          user: {
            connect: { id: testUser.id },
          },
          bondScore: 30,
          stressLevel: 15,
          taskLog: null,
          lastGroomed: null,
          daysGroomedInARow: 0,
        },
      });
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({ where: { ownerId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('Real-World Foal Development Scenarios', () => {
    it('should handle week 1 of foal care with enrichment tasks', async () => {
      // Day 1: First trust building session
      let careData = updateFoalCareData(
        { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 },
        'trust_building',
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
      careData = updateFoalCareData(foal, 'trust_building', day4);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify final state
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      expect(foal.taskLog).toEqual({
        trust_building: 2,
        desensitization: 1,
      });
      expect(foal.daysGroomedInARow).toBe(2); // 2 consecutive care sessions (day 3 and 4)
      expect(foal.lastGroomed).toEqual(day4);
    });

    it('should handle streak break and recovery', async () => {
      // Build up a 5-day streak
      const initialData = {
        taskLog: { trust_building: 3, early_touch: 2 },
        lastGroomed: day5,
        daysGroomedInARow: 5,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: initialData,
      });

      // Miss several days (break streak)
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const careData = updateFoalCareData(foal, 'showground_exposure', day10);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Verify streak reset but task log preserved
      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      expect(foal.taskLog).toEqual({
        trust_building: 3,
        early_touch: 2,
        showground_exposure: 1,
      });
      expect(foal.daysGroomedInARow).toBe(1); // Reset to 1
      expect(foal.lastGroomed).toEqual(day10);
    });

    it('should achieve burnout immunity after 7 consecutive days', async () => {
      // Simulate 7 consecutive days of care
      const tasks = [
        'trust_building',
        'desensitization',
        'early_touch',
        'trust_building',
        'showground_exposure',
        'early_touch',
        'trust_building',
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

      // Verify burnout immunity achieved
      const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const summary = getFoalCareSummary(foal);

      expect(summary.consecutiveDaysOfCare).toBe(7);
      expect(summary.hasBurnoutImmunity).toBe(true);
      expect(summary.totalTaskCompletions).toBe(7);
      expect(summary.uniqueTasksCompleted).toBe(4); // trust_building, desensitization, early_touch, showground_exposure
    });
  });

  describe('Task Log and Trait Evaluation Integration', () => {
    it('should support trait point calculation from stored task log', async () => {
      // Store comprehensive task log
      const taskLog = {
        trust_building: 5,
        desensitization: 3,
        early_touch: 4,
        showground_exposure: 2,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      // Calculate trait points from stored data
      const foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const traitPoints = calculateTraitPoints(foal.taskLog);

      // Verify trait development
      expect(traitPoints.bonded).toBe(25); // trust_building: 5 * 5
      expect(traitPoints.resilient).toBe(25); // trust_building: 5 * 5
      expect(traitPoints.confident).toBe(25); // desensitization(3) + showground_exposure(2) = 5 * 5
      expect(traitPoints.calm).toBe(20); // early_touch: 4 * 5
      expect(traitPoints.crowdReady).toBe(10); // showground_exposure: 2 * 5
    });

    it('should track task progression over time', async () => {
      // Week 1: Enrichment focus
      let taskLog = { trust_building: 3, desensitization: 2 };
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      let traitPoints = calculateTraitPoints(foal.taskLog);

      // Early development should focus on foundational traits
      expect(traitPoints.bonded).toBe(15);
      expect(traitPoints.confident).toBe(10);

      // Week 3: Add grooming tasks
      taskLog = {
        trust_building: 5,
        desensitization: 3,
        early_touch: 3,
        hoof_handling: 2,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      traitPoints = calculateTraitPoints(foal.taskLog);

      // Later development should include handling traits
      expect(traitPoints.bonded).toBe(25);
      expect(traitPoints.calm).toBe(15);
      expect(traitPoints.showCalm).toBe(10);
    });
  });

  describe('Grace Period and Streak Maintenance', () => {
    it('should maintain streak within 2-day grace period', async () => {
      // Day 1: Initial care
      let careData = updateFoalCareData(
        { taskLog: null, lastGroomed: null, daysGroomedInARow: 0 },
        'trust_building',
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
        taskLog: { trust_building: 2 },
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

      const careData = updateFoalCareData(foal, 'early_touch', day5);
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
          trust_building: 8,
          desensitization: 5,
          early_touch: 6,
          showground_exposure: 3,
          hoof_handling: 2,
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
      expect(summary.hasBurnoutImmunity).toBe(true);
      expect(summary.completedTaskTypes).toContain('trust_building');
      expect(summary.completedTaskTypes).toContain('desensitization');
      expect(summary.completedTaskTypes).toContain('early_touch');
      expect(summary.completedTaskTypes).toContain('showground_exposure');
      expect(summary.completedTaskTypes).toContain('hoof_handling');
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
        { task: 'trust_building', date: session1Date },
        { task: 'trust_building', date: session2Date },
        { task: 'desensitization', date: session3Date },
        { task: 'early_touch', date: session4Date },
        { task: 'trust_building', date: session5Date },
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
        trust_building: 3,
        desensitization: 1,
        early_touch: 1,
      });
      expect(finalFoal.daysGroomedInARow).toBe(5);
    });
  });
});
