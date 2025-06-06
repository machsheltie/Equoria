/**
 * Horse XP Integration Tests
 *
 * Testing Philosophy: Balanced Mocking Approach
 * - Strategic external dependency mocking only (database operations)
 * - Real business logic validation through integration testing
 * - Tests actual Horse XP system integration with competition system
 * - No over-mocking of internal business logic
 *
 * Integration Points Tested:
 * - Horse XP system core functionality
 * - Horse XP accumulation and stat point calculation
 * - Horse stat allocation system functions correctly
 *
 * Coverage:
 * - Horse XP model functions
 * - Stat point allocation workflow
 * - Horse XP history tracking
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prisma from '../db/index.mjs';

describe('🐎 INTEGRATION: Horse XP System - Core Functionality Integration', () => {
  let testHorseId;

  beforeAll(async () => {
    // Create a minimal test horse directly in database for XP testing
    const testHorse = await prisma.horse.create({
      data: {
        name: 'XP Test Horse',
        age: 5,
        dateOfBirth: new Date('2019-01-01'),
        sex: 'Female',
        speed: 75,
        stamina: 70,
        focus: 65,
        precision: 60,
        agility: 70,
        boldness: 55,
        balance: 60,
        flexibility: 50,
        obedience: 50,
        intelligence: 55,
        healthStatus: 'Excellent',
        stressLevel: 20,
        horseXp: 0,
        availableStatPoints: 0,
      },
    });
    testHorseId = testHorse.id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      if (testHorseId) {
        await prisma.horseXpEvent.deleteMany({
          where: { horseId: testHorseId },
        });
        await prisma.horse.delete({ where: { id: testHorseId } });
      }
    } catch (error) {
      console.warn('Cleanup error:', error.message);
    }
  });

  beforeEach(async () => {
    // Reset horse XP and stat points for each test
    await prisma.horse.update({
      where: { id: testHorseId },
      data: {
        horseXp: 0,
        availableStatPoints: 0,
      },
    });

    // Clean up any XP events
    await prisma.horseXpEvent.deleteMany({
      where: { horseId: testHorseId },
    });
  });

  describe('Competition Integration', () => {
    it('should award horse XP when horse places in competition', async () => {
      // Simulate a competition result by directly calling the horse XP model
      const { awardCompetitionXp } = await import('../models/horseXpModel.js');

      const result = await awardCompetitionXp(testHorseId, '1st', 'Dressage');

      expect(result.success).toBe(true);
      expect(result.xpAwarded).toBe(30); // 20 base + 10 for 1st place
      expect(result.currentXP).toBe(30);
      expect(result.statPointsGained).toBe(0); // Not enough for stat point yet

      // Verify horse was updated in database
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
      });

      expect(updatedHorse.horseXp).toBe(30);
      expect(updatedHorse.availableStatPoints).toBe(0);

      // Verify XP event was logged
      const xpEvents = await prisma.horseXpEvent.findMany({
        where: { horseId: testHorseId },
      });

      expect(xpEvents).toHaveLength(1);
      expect(xpEvents[0].amount).toBe(30);
      expect(xpEvents[0].reason).toBe('Competition: 1st place in Dressage');
    });

    it('should award stat points when horse reaches 100 XP', async () => {
      const { awardCompetitionXp } = await import('../models/horseXpModel.js');

      // Award enough XP to get stat points (100 XP = 1 stat point)
      const _result1 = await awardCompetitionXp(testHorseId, '1st', 'Racing');
      const _result2 = await awardCompetitionXp(testHorseId, '1st', 'Show Jumping');
      const result3 = await awardCompetitionXp(testHorseId, '2nd', 'Dressage');

      // Total: 30 + 30 + 27 = 87 XP (not enough yet)
      expect(result3.currentXP).toBe(87);
      expect(result3.statPointsGained).toBe(0);

      // One more competition to push over 100
      const result4 = await awardCompetitionXp(testHorseId, '3rd', 'Cross Country');

      // Total: 87 + 25 = 112 XP (should get 1 stat point)
      expect(result4.success).toBe(true);
      expect(result4.currentXP).toBe(112);
      expect(result4.statPointsGained).toBe(1);

      // Verify in database
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
      });

      expect(updatedHorse.horseXp).toBe(112);
      expect(updatedHorse.availableStatPoints).toBe(1);
    });
  });

  describe('Horse XP Model Integration', () => {
    it('should get horse XP status directly from model', async () => {
      // First, give the horse some XP
      const { addXpToHorse, getHorseXpStatus } = await import('../models/horseXpModel.js');
      await addXpToHorse(testHorseId, 150, 'Test XP');

      const result = await getHorseXpStatus(testHorseId);

      expect(result.success).toBe(true);
      expect(result.data.horseId).toBe(testHorseId);
      expect(result.data.horseName).toBe('XP Test Horse');
      expect(result.data.currentXP).toBe(150);
      expect(result.data.availableStatPoints).toBe(1); // 150 XP = 1 stat point
      expect(result.data.nextStatPointAt).toBe(200);
      expect(result.data.xpToNextStatPoint).toBe(50);
    });

    it('should allocate stat points directly via model', async () => {
      // Give horse some stat points
      const { addXpToHorse, allocateStatPoint } = await import('../models/horseXpModel.js');
      await addXpToHorse(testHorseId, 200, 'Test XP for stat allocation');

      // Get initial speed stat
      const initialHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { speed: true, availableStatPoints: true },
      });

      expect(initialHorse.availableStatPoints).toBe(2); // 200 XP = 2 stat points

      // Allocate 1 stat point to speed
      const result = await allocateStatPoint(testHorseId, 'speed');

      expect(result.success).toBe(true);
      expect(result.data.statName).toBe('speed');
      expect(result.data.newStatValue).toBe(initialHorse.speed + 1);
      expect(result.data.remainingStatPoints).toBe(1);

      // Verify in database
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { speed: true, availableStatPoints: true },
      });

      expect(updatedHorse.speed).toBe(initialHorse.speed + 1);
      expect(updatedHorse.availableStatPoints).toBe(1);
    });

    it('should get horse XP history directly from model', async () => {
      // Add some XP events
      const { addXpToHorse, getHorseXpHistory } = await import('../models/horseXpModel.js');
      await addXpToHorse(testHorseId, 50, 'First competition');
      await addXpToHorse(testHorseId, 30, 'Second competition');
      await addXpToHorse(testHorseId, 25, 'Third competition');

      const result = await getHorseXpHistory(testHorseId, 10, 0);

      expect(result.success).toBe(true);
      expect(result.data.events).toHaveLength(3);
      expect(result.data.count).toBe(3);
      expect(result.data.pagination.limit).toBe(10);
      expect(result.data.pagination.offset).toBe(0);
      expect(result.data.pagination.hasMore).toBe(false);

      // Events should be in reverse chronological order (newest first)
      const events = result.data.events;
      expect(events[0].amount).toBe(25); // Third competition (most recent)
      expect(events[1].amount).toBe(30); // Second competition
      expect(events[2].amount).toBe(50); // First competition (oldest)
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should complete full horse XP workflow: competition → XP → stat allocation', async () => {
      // Step 1: Horse starts with 0 XP
      let horse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { horseXp: true, availableStatPoints: true, speed: true },
      });

      expect(horse.horseXp).toBe(0);
      expect(horse.availableStatPoints).toBe(0);
      const initialSpeed = horse.speed;

      // Step 2: Simulate multiple competition placements to accumulate XP
      const { awardCompetitionXp, getHorseXpStatus, allocateStatPoint, getHorseXpHistory } =
        await import('../models/horseXpModel.js');

      await awardCompetitionXp(testHorseId, '1st', 'Racing'); // 30 XP
      await awardCompetitionXp(testHorseId, '2nd', 'Dressage'); // 27 XP
      await awardCompetitionXp(testHorseId, '1st', 'Show Jumping'); // 30 XP
      await awardCompetitionXp(testHorseId, '3rd', 'Cross Country'); // 25 XP
      // Total: 112 XP = 1 stat point

      // Step 3: Check XP status via model
      const xpStatusResult = await getHorseXpStatus(testHorseId);

      expect(xpStatusResult.success).toBe(true);
      expect(xpStatusResult.data.currentXP).toBe(112);
      expect(xpStatusResult.data.availableStatPoints).toBe(1);

      // Step 4: Allocate stat point via model
      const allocateResult = await allocateStatPoint(testHorseId, 'speed');

      expect(allocateResult.success).toBe(true);
      expect(allocateResult.data.newStatValue).toBe(initialSpeed + 1);
      expect(allocateResult.data.remainingStatPoints).toBe(0);

      // Step 5: Verify final state
      horse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { horseXp: true, availableStatPoints: true, speed: true },
      });

      expect(horse.horseXp).toBe(112);
      expect(horse.availableStatPoints).toBe(0);
      expect(horse.speed).toBe(initialSpeed + 1);

      // Step 6: Check XP history
      const historyResult = await getHorseXpHistory(testHorseId, 10, 0);

      expect(historyResult.success).toBe(true);
      expect(historyResult.data.events).toHaveLength(4);
      expect(historyResult.data.events.every(event => event.amount > 0)).toBe(true);
    });
  });
});
