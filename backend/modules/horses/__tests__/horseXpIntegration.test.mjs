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
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Owner ruling C15 (2026-10-16; Equoria-576c0 B13): 1,000 Horse Points per stat
// allocation. Old contract: 100. The point amounts below are the old scenarios at
// the new scale; every assertion keeps its meaning.

describe('🐎 INTEGRATION: Horse XP System - Core Functionality Integration', () => {
  let testHorseId;

  beforeAll(async () => {
    // Create a minimal test horse directly in database for XP testing
    const testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'XP Test Horse',
        age: 5,
        dateOfBirth: new Date('2019-01-01'),
        sex: 'Mare',
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
        await prisma.horse.deleteMany({ where: { id: testHorseId } });
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
    it('should award stat points when horse reaches 1,000 Horse Points', async () => {
      // Setup re-seeded via the live addXpToHorse (the dead awardCompetitionXp was
      // removed, Equoria-576c0 B1); same amounts as before, assertions unchanged.
      const { addXpToHorse } = await import('../services/horseXpModelService.mjs');

      // Award enough points for a stat point (1,000 points = 1 stat point)
      await addXpToHorse(testHorseId, 300, 'Test seed: competition 1');
      await addXpToHorse(testHorseId, 300, 'Test seed: competition 2');
      const result3 = await addXpToHorse(testHorseId, 270, 'Test seed: competition 3');

      // Total: 300 + 300 + 270 = 870 points (not enough yet)
      expect(result3.currentXP).toBe(870);
      expect(result3.statPointsGained).toBe(0);

      // One more competition to push over 1,000
      const result4 = await addXpToHorse(testHorseId, 250, 'Test seed: competition 4');

      // Total: 870 + 250 = 1120 points (should get 1 stat point)
      expect(result4.success).toBe(true);
      expect(result4.currentXP).toBe(1120);
      expect(result4.statPointsGained).toBe(1);

      // Verify in database
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
      });

      expect(updatedHorse.horseXp).toBe(1120);
      expect(updatedHorse.availableStatPoints).toBe(1);
    });
  });

  describe('Horse XP Model Integration', () => {
    it('should get horse XP status directly from model', async () => {
      // First, give the horse some XP
      const { addXpToHorse, getHorseXpStatus } = await import('../services/horseXpModelService.mjs');
      await addXpToHorse(testHorseId, 1500, 'Test XP');

      const result = await getHorseXpStatus(testHorseId);

      expect(result.success).toBe(true);
      expect(result.data.horseId).toBe(testHorseId);
      expect(result.data.horseName).toBe('XP Test Horse');
      expect(result.data.currentXP).toBe(1500);
      expect(result.data.availableStatPoints).toBe(1); // 1500 points = 1 stat point
      expect(result.data.nextStatPointAt).toBe(2000);
      expect(result.data.xpToNextStatPoint).toBe(500);
    });

    it('should allocate stat points directly via model', async () => {
      // Give horse some stat points
      const { addXpToHorse, allocateStatPoint } = await import('../services/horseXpModelService.mjs');
      await addXpToHorse(testHorseId, 2000, 'Test XP for stat allocation');

      // Get initial speed stat
      const initialHorse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { speed: true, availableStatPoints: true },
      });

      expect(initialHorse.availableStatPoints).toBe(2); // 2000 points = 2 stat points

      // Allocate 1 stat point to speed
      const result = await allocateStatPoint(testHorseId, 'speed');

      expect(result.success).toBe(true);
      expect(result.statName).toBe('speed');
      expect(result.newStatValue).toBe(initialHorse.speed + 1);
      expect(result.remainingStatPoints).toBe(1);

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
      const { addXpToHorse, getHorseXpHistory } = await import('../services/horseXpModelService.mjs');
      await addXpToHorse(testHorseId, 50, 'First competition');
      await addXpToHorse(testHorseId, 30, 'Second competition');
      await addXpToHorse(testHorseId, 25, 'Third competition');

      const result = await getHorseXpHistory(testHorseId, 10, 0);

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.offset).toBe(0);
      expect(result.pagination.hasMore).toBe(false);

      // Events should be in reverse chronological order (newest first)
      const { events } = result;
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
      // Setup re-seeded via the live addXpToHorse (the dead awardCompetitionXp was
      // removed, Equoria-576c0 B1); same amounts as before, assertions unchanged.
      const { addXpToHorse, getHorseXpStatus, allocateStatPoint, getHorseXpHistory } =
        await import('../services/horseXpModelService.mjs');

      await addXpToHorse(testHorseId, 300, 'Test seed: competition 1'); // 300 points
      await addXpToHorse(testHorseId, 270, 'Test seed: competition 2'); // 270 points
      await addXpToHorse(testHorseId, 300, 'Test seed: competition 3'); // 300 points
      await addXpToHorse(testHorseId, 250, 'Test seed: competition 4'); // 250 points
      // Total: 1120 points = 1 stat point

      // Step 3: Check XP status via model
      const xpStatusResult = await getHorseXpStatus(testHorseId);

      expect(xpStatusResult.success).toBe(true);
      expect(xpStatusResult.data.currentXP).toBe(1120);
      expect(xpStatusResult.data.availableStatPoints).toBe(1);

      // Step 4: Allocate stat point via model
      const allocateResult = await allocateStatPoint(testHorseId, 'speed');

      expect(allocateResult.success).toBe(true);
      expect(allocateResult.newStatValue).toBe(initialSpeed + 1);
      expect(allocateResult.remainingStatPoints).toBe(0);

      // Step 5: Verify final state
      horse = await prisma.horse.findUnique({
        where: { id: testHorseId },
        select: { horseXp: true, availableStatPoints: true, speed: true },
      });

      expect(horse.horseXp).toBe(1120);
      expect(horse.availableStatPoints).toBe(0);
      expect(horse.speed).toBe(initialSpeed + 1);

      // Step 6: Check XP history
      const historyResult = await getHorseXpHistory(testHorseId, 10, 0);

      expect(historyResult.success).toBe(true);
      expect(historyResult.events).toHaveLength(4);
      expect(historyResult.events.every(event => event.amount > 0)).toBe(true);
    });
  });
});
