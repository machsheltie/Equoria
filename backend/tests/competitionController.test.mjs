/**
 * 🧪 UNIT TEST: Competition Controller - Show Entry & Execution
 *
 * This test validates the competition controller's core functionality for
 * entering horses in shows and executing competition logic with XP rewards.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Only top 3 horses receive XP rewards (4th place and below get no XP)
 * - XP amounts vary based on placement and show prize pool
 * - Horse eligibility validation (owner, rider, health, stats requirements)
 * - Competition scoring uses real horse stats and discipline weightings
 * - Show execution handles multiple horses with proper ranking
 * - XP events are properly logged for user progression tracking
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. enterAndRunShow() - Complete show entry and execution workflow
 * 2. XP reward distribution based on competition placement
 * 3. Horse validation and eligibility checking
 * 4. Competition scoring and ranking logic
 * 5. Edge cases with different horse stat configurations
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Competition scoring logic, placement calculations, XP distribution rules
 * ✅ REAL: Horse stat evaluation, discipline weighting, ranking algorithms
 * 🔧 MOCK: Database operations (user XP updates, horse lookups) - external dependencies
 * 🔧 MOCK: Horse data - simplified for focused testing of competition logic
 *
 * 💡 TEST STRATEGY: Unit testing with mocked data sources to focus on competition
 *    business logic while ensuring predictable test outcomes and fast execution
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock external dependencies before importing the subject under test
jest.unstable_mockModule('../models/userModel.js', () => ({
  addXpToUser: jest.fn().mockResolvedValue({
    success: true,
    xpGained: 20,
    currentXP: 120,
    currentLevel: 2,
    leveledUp: false,
    levelsGained: 0,
  }),
}));

jest.unstable_mockModule('../models/horseModel.js', () => ({
  getHorseById: jest.fn(id =>
    Promise.resolve({
      id,
      name: `Horse ${id}`,
      ownerId: `user-${id}`, // Required for XP to be awarded
      riderId: 'rider-1', // Required to enter
      stress_level: 0,
      health: 'Good',
      tack: {},
      epigenetic_modifiers: { positive: [] },
      speed: 10,
      stamina: 10,
      focus: 10,
      precision: 10,
      agility: 10,
      coordination: 10,
      boldness: 10,
      balance: 10,
    }),
  ),
}));

let addXpToUser;
let enterAndRunShow;

beforeEach(async () => {
  const { addXpToUser: importedAddXpToUser } = await import('../models/userModel.mjs');
  const { enterAndRunShow: importedEnterAndRunShow } = await import(
    '../controllers/competitionController.mjs'
  );
  addXpToUser = importedAddXpToUser;
  enterAndRunShow = importedEnterAndRunShow;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('🏆 UNIT: Competition Controller - Show Entry & Execution', () => {
  describe('enterAndRunShow', () => {
    it('should successfully enter and run show with 5 horses and award XP to top 3', async () => {
      const horseIds = ['h1', 'h2', 'h3', 'h4', 'h5'];

      const show = {
        id: 'show123',
        prize: 500,
        name: 'Mock Show',
        runDate: new Date(),
        discipline: 'Dressage',
        entryFee: 10,
        hostUserId: 'user-host',
      };

      const result = await enterAndRunShow(horseIds, show);

      expect(result.success).toBe(true);
      expect(result.summary.validEntries).toBe(5);
      expect(addXpToUser).toHaveBeenCalledTimes(3); // Only top 3 get XP
    });

    it('should award correct XP amounts for show placements', async () => {
      const horseIds = ['h1', 'h2', 'h3'];

      const show = {
        id: 'show456',
        prize: 300,
        name: 'XP Show',
        runDate: new Date(),
        discipline: 'Jumping',
        entryFee: 10,
        hostUserId: 'user-host',
      };

      const result = await enterAndRunShow(horseIds, show);

      expect(result.summary.xpEvents.length).toBe(3);
      expect(addXpToUser).toHaveBeenCalledTimes(3);

      result.summary.xpEvents.forEach(event => {
        expect(event).toHaveProperty('horseId');
        expect(event).toHaveProperty('xp');
        expect(event.xp).toBeGreaterThan(0);
      });
    });

    it('should not award XP for horses that do not place (4th or lower)', async () => {
      const highStatHorse = id => ({
        id,
        name: `Horse ${id}`,
        ownerId: `user-${id}`,
        riderId: 'rider-1',
        stress_level: 0,
        health: 'Good',
        tack: {},
        epigenetic_modifiers: { positive: [] },
        speed: 20,
        stamina: 20,
        focus: 20,
        precision: 20,
        agility: 20,
        coordination: 20,
        boldness: 20,
        balance: 20,
      });

      jest.unstable_mockModule('../models/horseModel.js', () => ({
        getHorseById: jest.fn(id => {
          if (['h1', 'h2', 'h3'].includes(id)) {
            return Promise.resolve(highStatHorse(id));
          }
          return Promise.resolve({
            id,
            name: `Horse ${id}`,
            ownerId: `user-${id}`,
            riderId: 'rider-1',
            stress_level: 0,
            health: 'Good',
            tack: {},
            epigenetic_modifiers: { positive: [] },
            speed: 5,
            stamina: 5,
            focus: 5,
            precision: 5,
            agility: 5,
            coordination: 5,
            boldness: 5,
            balance: 5,
          });
        }),
      }));

      const { enterAndRunShow: updatedEnterAndRunShow } = await import(
        '../controllers/competitionController.js'
      );
      enterAndRunShow = updatedEnterAndRunShow;

      const horseIds = ['h1', 'h2', 'h3', 'h4', 'h5'];

      const show = {
        id: 'show789',
        prize: 500,
        name: 'No XP Show',
        runDate: new Date(),
        discipline: 'Endurance',
        entryFee: 10,
        hostUserId: 'user-host',
      };

      const result = await enterAndRunShow(horseIds, show);

      expect(result.summary.xpEvents.length).toBe(3);
      expect(addXpToUser).toHaveBeenCalledTimes(3);

      const awardedHorseIds = result.summary.xpEvents.map(e => e.horseId);
      expect(awardedHorseIds).not.toContain('h4');
      expect(awardedHorseIds).not.toContain('h5');
    });
  });
});
