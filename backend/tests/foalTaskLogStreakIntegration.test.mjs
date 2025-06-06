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

  beforeEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-integration',
        username: 'integrationuser',
        email: 'integration@example.com',
        password: 'testpassword',
        firstName: 'Integration',
        lastName: 'Tester',
        money: 1000,
      },
    });

    // Create test foal
    testFoal = await prisma.horse.create({
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

  afterEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Real-World Foal Development Scenarios', () => {
    it('should handle week 1 of foal care with enrichment tasks', async () => {
      // Day 1: First trust building session
      const day1 = new Date('2024-06-01T10:00:00Z');
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
      const day3 = new Date('2024-06-03T14:00:00Z');
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      careData = updateFoalCareData(foal, 'desensitization', day3);

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: careData,
      });

      // Day 4: Another trust building session
      const day4 = new Date('2024-06-04T11:00:00Z');
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
        lastGroomed: new Date('2024-06-05T12:00:00Z'),
        daysGroomedInARow: 5,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: initialData,
      });

      // Miss several days (break streak)
      const afterBreak = new Date('2024-06-10T12:00:00Z'); // 5 days later
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });
      const careData = updateFoalCareData(foal, 'showground_exposure', afterBreak);

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
      expect(foal.lastGroomed).toEqual(afterBreak);
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
        const careDate = new Date(`2024-06-0${i + 1}T12:00:00Z`);
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
      expect(traitPoints.crowd_ready).toBe(10); // showground_exposure: 2 * 5
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
      expect(traitPoints.show_calm).toBe(10);
    });
  });

  describe('Grace Period and Streak Maintenance', () => {
    it('should maintain streak within 2-day grace period', async () => {
      // Day 1: Initial care
      const day1 = new Date('2024-06-01T12:00:00Z');
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
      const day3 = new Date('2024-06-03T12:00:00Z');
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
        lastGroomed: new Date('2024-06-01T12:00:00Z'),
        daysGroomedInARow: 3,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: initialData,
      });

      // Care after grace period (4 days later)
      const afterGrace = new Date('2024-06-05T12:00:00Z');
      let foal = await prisma.horse.findUnique({ where: { id: testFoal.id } });

      const streakInfo = calculateStreakFromLastCareDate(foal.lastGroomed, afterGrace);
      expect(streakInfo.isStreakActive).toBe(false);
      expect(streakInfo.streakBroken).toBe(true);
      expect(streakInfo.daysSinceLastCare).toBe(4);

      const careData = updateFoalCareData(foal, 'early_touch', afterGrace);
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
        lastGroomed: new Date('2024-06-15T12:00:00Z'),
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
      const careSessions = [
        { task: 'trust_building', date: new Date('2024-06-01T10:00:00Z') },
        { task: 'trust_building', date: new Date('2024-06-02T11:00:00Z') },
        { task: 'desensitization', date: new Date('2024-06-03T12:00:00Z') },
        { task: 'early_touch', date: new Date('2024-06-04T13:00:00Z') },
        { task: 'trust_building', date: new Date('2024-06-05T14:00:00Z') },
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
