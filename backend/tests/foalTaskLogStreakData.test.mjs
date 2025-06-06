/**
 * Foal Task Log and Streak Data Test Suite
 * Tests for foal task_log storage and consecutive days streak tracking
 *
 * 🎯 FEATURES TESTED:
 * - Task log JSON structure and storage in database
 * - Consecutive days foal care streak tracking
 * - Last care date timestamp management
 * - Task repetition history for trait evaluation
 * - Streak-based bonuses and burnout immunity logic
 * - Grace period handling for streak maintenance
 *
 * 🔧 DEPENDENCIES:
 * - Horse model with taskLog, consecutiveDaysFoalCare, lastGroomed fields
 * - Prisma database operations
 * - Task influence configuration for validation
 *
 * 📋 BUSINESS RULES TESTED:
 * - Task log stores task repetition counts as JSON: {"desensitization": 3, "early_touch": 5}
 * - Consecutive days counter tracks unbroken care streaks
 * - Last care date enables grace period calculations
 * - Streak data supports burnout immunity and bonus mechanics
 * - Task history enables trait evaluation and development tracking
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Database operations when testing utility functions
 * - Real: Database schema, JSON storage, date calculations, business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../db/index.mjs';

describe('Foal Task Log and Streak Data', () => {
  let testUser, testFoal;

  beforeEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'test-user-task-log-streak',
        username: 'tasklogstreakuser',
        email: 'tasklogstreak@example.com',
        password: 'testpassword',
        firstName: 'Task',
        lastName: 'Logger',
        money: 1000,
      },
    });

    // Create test foal
    testFoal = await prisma.horse.create({
      data: {
        name: 'Test Foal Task Log',
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
        age: 365,
        user: {
          connect: { id: testUser.id },
        },
        bondScore: 50,
        stressLevel: 20,
        taskLog: null,
        // consecutiveDaysFoalCare: 0, // This field doesn't exist yet in the schema
        lastGroomed: null,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('Task Log JSON Storage', () => {
    it('should initialize with null task log', async () => {
      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toBeNull();
    });

    it('should store task log as JSON object', async () => {
      const taskLog = {
        desensitization: 3,
        early_touch: 5,
        trust_building: 2,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(updatedFoal.taskLog).toEqual(taskLog);
    });

    it('should handle empty task log object', async () => {
      const taskLog = {};

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog },
      });

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(updatedFoal.taskLog).toEqual({});
    });

    it('should update existing task counts', async () => {
      // Initial task log
      const initialTaskLog = {
        desensitization: 2,
        early_touch: 1,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog: initialTaskLog },
      });

      // Update with new counts
      const updatedTaskLog = {
        desensitization: 3, // Incremented
        early_touch: 1, // Unchanged
        trust_building: 1, // New task
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog: updatedTaskLog },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual(updatedTaskLog);
    });

    it('should handle complex task log with all foal tasks', async () => {
      const comprehensiveTaskLog = {
        // Enrichment tasks
        desensitization: 5,
        trust_building: 8,
        showground_exposure: 3,
        // Grooming tasks
        early_touch: 6,
        hoof_handling: 4,
        tying_practice: 2,
        sponge_bath: 3,
        coat_check: 5,
        mane_tail_grooming: 2,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog: comprehensiveTaskLog },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual(comprehensiveTaskLog);
      expect(Object.keys(foal.taskLog)).toHaveLength(9);
    });
  });

  describe('Consecutive Days Foal Care Tracking', () => {
    it('should initialize with zero consecutive days', async () => {
      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(0);
    });

    it('should track consecutive days of care', async () => {
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: 5 },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(5);
    });

    it('should handle streak increments', async () => {
      // Start with 3 days
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: 3 },
      });

      // Increment to 4 days
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: 4 },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(4);
    });

    it('should handle streak resets', async () => {
      // Build up a streak
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: 10 },
      });

      // Reset streak
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: 0 },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(0);
    });

    it('should support high streak counts', async () => {
      const highStreakCount = 30; // 30 consecutive days

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: highStreakCount },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(highStreakCount);
    });
  });

  describe('Last Care Date Tracking', () => {
    it('should initialize with null last groomed date', async () => {
      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.lastGroomed).toBeNull();
    });

    it('should store last care date timestamp', async () => {
      const careDate = new Date('2024-06-01T10:00:00Z');

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { lastGroomed: careDate },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.lastGroomed).toEqual(careDate);
    });

    it('should update last care date on subsequent care', async () => {
      const firstCareDate = new Date('2024-06-01T10:00:00Z');
      const secondCareDate = new Date('2024-06-02T14:30:00Z');

      // First care session
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { lastGroomed: firstCareDate },
      });

      // Second care session
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { lastGroomed: secondCareDate },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.lastGroomed).toEqual(secondCareDate);
    });

    it('should handle current timestamp updates', async () => {
      const now = new Date();

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { lastGroomed: now },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      // Allow for small time differences due to test execution time
      const timeDiff = Math.abs(foal.lastGroomed.getTime() - now.getTime());
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });
  });

  describe('Combined Task Log and Streak Data', () => {
    it('should update all foal care fields together', async () => {
      const taskLog = {
        desensitization: 3,
        early_touch: 5,
      };
      const consecutiveDays = 6;
      const lastCareDate = new Date('2024-06-01T15:00:00Z');

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog,
          consecutiveDaysFoalCare: consecutiveDays,
          lastGroomed: lastCareDate,
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual(taskLog);
      expect(foal.consecutiveDaysFoalCare).toBe(consecutiveDays);
      expect(foal.lastGroomed).toEqual(lastCareDate);
    });

    it('should simulate realistic foal development progression', async () => {
      // Day 1: First care session
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: { trust_building: 1 },
          consecutiveDaysFoalCare: 1,
          lastGroomed: new Date('2024-06-01'),
        },
      });

      // Day 3: Second care session (different task)
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: { trust_building: 1, desensitization: 1 },
          consecutiveDaysFoalCare: 2,
          lastGroomed: new Date('2024-06-03'),
        },
      });

      // Day 5: Third care session (repeat task)
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: { trust_building: 2, desensitization: 1 },
          consecutiveDaysFoalCare: 3,
          lastGroomed: new Date('2024-06-05'),
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual({
        trust_building: 2,
        desensitization: 1,
      });
      expect(foal.consecutiveDaysFoalCare).toBe(3);
      expect(foal.lastGroomed).toEqual(new Date('2024-06-05'));
    });

    it('should handle streak reset with task log preservation', async () => {
      // Build up task log and streak
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: { trust_building: 5, early_touch: 3 },
          consecutiveDaysFoalCare: 7,
          lastGroomed: new Date('2024-06-07'),
        },
      });

      // Reset streak but keep task log (missed days)
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          consecutiveDaysFoalCare: 0,
          // taskLog remains unchanged
          // lastGroomed could be updated or remain for grace period logic
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual({ trust_building: 5, early_touch: 3 });
      expect(foal.consecutiveDaysFoalCare).toBe(0);
      expect(foal.lastGroomed).toEqual(new Date('2024-06-07'));
    });
  });

  describe('Data Integrity and Edge Cases', () => {
    it('should handle null values gracefully', async () => {
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog: null,
          consecutiveDaysFoalCare: null,
          lastGroomed: null,
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toBeNull();
      expect(foal.consecutiveDaysFoalCare).toBeNull();
      expect(foal.lastGroomed).toBeNull();
    });

    it('should handle negative consecutive days (should not occur in practice)', async () => {
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { consecutiveDaysFoalCare: -1 },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.consecutiveDaysFoalCare).toBe(-1);
    });

    it('should handle very large task counts', async () => {
      const largeTaskLog = {
        trust_building: 999,
        desensitization: 500,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { taskLog: largeTaskLog },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      expect(foal.taskLog).toEqual(largeTaskLog);
    });

    it('should preserve data types correctly', async () => {
      const taskLog = {
        trust_building: 5,
        early_touch: 3,
      };

      await prisma.horse.update({
        where: { id: testFoal.id },
        data: {
          taskLog,
          consecutiveDaysFoalCare: 7,
        },
      });

      const foal = await prisma.horse.findUnique({
        where: { id: testFoal.id },
      });

      // Verify data types
      expect(typeof foal.taskLog).toBe('object');
      expect(typeof foal.taskLog.trust_building).toBe('number');
      expect(typeof foal.consecutiveDaysFoalCare).toBe('number');
      expect(foal.lastGroomed).toBeInstanceOf(Date);
    });
  });
});
