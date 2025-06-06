/**
 * Burnout Immunity & Trait Integration Test Suite
 * Tests the complete workflow from burnout immunity to trait milestone evaluation
 *
 * 🎯 FEATURES TESTED:
 * - Burnout immunity grace period (2-day buffer)
 * - Streak tracking with grace period logic
 * - Trait milestone evaluation with streak bonuses
 * - Complete foal development workflow
 * - Integration between groom bonding and trait systems
 *
 * 🔧 DEPENDENCIES:
 * - groomBondingSystem.mjs  (burnout immunity logic)
 * - traitEvaluation.mjs  (trait milestone evaluation)
 * - epigeneticTraits.mjs  (trait definitions)
 * - taskInfluenceConfig.mjs  (task-trait mapping)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Grace period: Up to 2 days missed before streak reset
 * - Burnout immunity: Triggered at 7+ consecutive days
 * - Streak bonus: +10 points for trait evaluation when immunity achieved
 * - Trait assignment: Based on task history and streak bonuses
 * - Per-horse tracking: Each horse has independent streak and traits
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Date manipulation, random number generation
 * - Real: All business logic, streak calculations, trait evaluation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the logger import
jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Import the functions after mocking
const {
  updateConsecutiveDays,
  checkBurnoutImmunity,
  updateStreakTracking: _updateStreakTracking,
} = await import(join(__dirname, '../utils/groomBondingSystem.mjs'));

const { evaluateEpigeneticTagsFromFoalTasks } = await import(
  join(__dirname, '../utils/traitEvaluation.mjs')
);

const { getTraitMetadata } = await import(join(__dirname, '../utils/epigeneticTraits.mjs'));

const { GROOM_CONFIG } = await import(join(__dirname, '../config/groomConfig.mjs'));

describe('Burnout Immunity & Trait Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete Foal Development Workflow', () => {
    it('should demonstrate full workflow from consistent care to trait rewards', () => {
      // Scenario: Player consistently cares for foal with occasional gaps

      // Week 1: Perfect care (7 days)
      let streak = 0;
      for (let day = 1; day <= 7; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }

      expect(streak).toBe(7);

      // Check burnout immunity achievement
      const immunityCheck = checkBurnoutImmunity(streak);
      expect(immunityCheck.immunityGranted).toBe(true);
      expect(immunityCheck.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);

      // Week 2: Miss 2 days (within grace period), then resume
      const gracePeriodResult = updateConsecutiveDays(streak, false, 2);
      expect(gracePeriodResult.newConsecutiveDays).toBe(7); // Preserved
      expect(gracePeriodResult.wasReset).toBe(false);

      // Resume care
      const resumeResult = updateConsecutiveDays(gracePeriodResult.newConsecutiveDays, true);
      streak = resumeResult.newConsecutiveDays;
      expect(streak).toBe(8);

      // Continue for 3 more days
      for (let day = 1; day <= 3; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }

      expect(streak).toBe(11); // 7 + 1 (resume) + 3 = 11 days

      // Simulate task log from consistent care
      const taskLog = {
        trust_building: 8, // 8 days of trust building
        desensitization: 6, // 6 days of desensitization
        early_touch: 5, // 5 days of early touch
        showground_exposure: 3, // 3 days of showground exposure
      };

      // Mock random to ensure trait assignment
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // Low roll = traits assigned

      // Evaluate traits with streak bonus (11 days >= 7)
      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

      // Should get multiple traits due to consistent care + streak bonus
      expect(assignedTraits.length).toBeGreaterThan(2);
      expect(assignedTraits).toContain('bonded'); // From trust_building
      expect(assignedTraits).toContain('resilient'); // From trust_building
      expect(assignedTraits).toContain('confident'); // From desensitization + showground_exposure

      // Verify all assigned traits have proper metadata
      assignedTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);
        expect(metadata).not.toBeNull();
        expect(metadata.description).toBeDefined();
        expect(metadata.type).toBe('positive');
      });
    });

    it('should handle streak loss and recovery scenario', () => {
      // Scenario: Player builds streak, loses it, then rebuilds

      // Build initial streak to 6 days (almost immunity)
      let streak = 0;
      for (let day = 1; day <= 6; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }

      expect(streak).toBe(6);

      // Check immunity status (not yet achieved)
      let immunityCheck = checkBurnoutImmunity(streak);
      expect(immunityCheck.immunityGranted).toBe(false);
      expect(immunityCheck.daysToImmunity).toBe(1);

      // Miss 3 days (beyond grace period) - streak resets
      const lossResult = updateConsecutiveDays(streak, false, 3);
      expect(lossResult.newConsecutiveDays).toBe(0);
      expect(lossResult.wasReset).toBe(true);

      // Rebuild streak from scratch
      streak = 0;
      for (let day = 1; day <= 8; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }

      expect(streak).toBe(8);

      // Now has immunity
      immunityCheck = checkBurnoutImmunity(streak);
      expect(immunityCheck.immunityGranted).toBe(true);

      // Task log reflects the rebuild period
      const taskLog = {
        trust_building: 8, // Rebuilt over 8 days
        desensitization: 4, // Some variety
        early_touch: 6, // Consistent handling
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Medium roll

      // Evaluate with new streak bonus
      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

      expect(assignedTraits.length).toBeGreaterThan(0);
      expect(assignedTraits).toContain('bonded');
      expect(assignedTraits).toContain('resilient');
    });

    it('should demonstrate per-horse independent tracking', () => {
      // Scenario: Multiple horses with different care patterns

      // Horse A: Consistent care, achieves immunity
      let horseA_streak = 0;
      for (let day = 1; day <= 10; day++) {
        const result = updateConsecutiveDays(horseA_streak, true);
        horseA_streak = result.newConsecutiveDays;
      }

      // Horse B: Inconsistent care, within grace period
      let horseB_streak = 5;
      const horseBResult = updateConsecutiveDays(horseB_streak, false, 2); // 2-day gap
      horseB_streak = horseBResult.newConsecutiveDays;

      // Horse C: Lost streak, starting over
      let horseC_streak = 0;
      for (let day = 1; day <= 3; day++) {
        const result = updateConsecutiveDays(horseC_streak, true);
        horseC_streak = result.newConsecutiveDays;
      }

      // Verify independent tracking
      expect(horseA_streak).toBe(10); // Full streak
      expect(horseB_streak).toBe(5); // Preserved in grace period
      expect(horseC_streak).toBe(3); // New streak

      // Check immunity status for each
      const immunityA = checkBurnoutImmunity(horseA_streak);
      const immunityB = checkBurnoutImmunity(horseB_streak);
      const immunityC = checkBurnoutImmunity(horseC_streak);

      expect(immunityA.immunityGranted).toBe(true);
      expect(immunityB.immunityGranted).toBe(false);
      expect(immunityC.immunityGranted).toBe(false);

      // Different task logs for each horse
      const taskLogA = { trust_building: 10, desensitization: 8 };
      const taskLogB = { early_touch: 5, showground_exposure: 3 };
      const taskLogC = { trust_building: 3 };

      jest.spyOn(Math, 'random').mockReturnValue(0.15);

      // Evaluate traits independently
      const traitsA = evaluateEpigeneticTagsFromFoalTasks(taskLogA, horseA_streak);
      const traitsB = evaluateEpigeneticTagsFromFoalTasks(taskLogB, horseB_streak);
      const traitsC = evaluateEpigeneticTagsFromFoalTasks(taskLogC, horseC_streak);

      // Horse A should get more traits due to immunity bonus
      expect(traitsA.length).toBeGreaterThanOrEqual(traitsB.length);
      expect(traitsA.length).toBeGreaterThanOrEqual(traitsC.length);

      // Each should have appropriate traits for their care
      expect(traitsA).toContain('bonded');
      expect(traitsA).toContain('confident');
    });
  });

  describe('Grace Period Edge Cases', () => {
    it('should handle exactly 2-day grace period with trait evaluation', () => {
      // Build streak to immunity
      let streak = 7;

      // Miss exactly 2 days (boundary case)
      const gracePeriodResult = updateConsecutiveDays(streak, false, 2);
      expect(gracePeriodResult.newConsecutiveDays).toBe(7);
      expect(gracePeriodResult.wasReset).toBe(false);

      // Resume and continue
      const resumeResult = updateConsecutiveDays(gracePeriodResult.newConsecutiveDays, true);
      streak = resumeResult.newConsecutiveDays;
      expect(streak).toBe(8);

      // Task log with moderate activity
      const taskLog = {
        trust_building: 6,
        early_touch: 4,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      // Should still get streak bonus
      const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);
      expect(traits.length).toBeGreaterThan(0);
    });

    it('should handle 3-day gap (beyond grace period)', () => {
      // Build streak to immunity
      let streak = 8;

      // Miss 3 days (beyond grace period)
      const lossResult = updateConsecutiveDays(streak, false, 3);
      expect(lossResult.newConsecutiveDays).toBe(0);
      expect(lossResult.wasReset).toBe(true);

      // Start rebuilding
      const rebuildResult = updateConsecutiveDays(0, true);
      streak = rebuildResult.newConsecutiveDays;
      expect(streak).toBe(1);

      // Task log shows gap in care
      const taskLog = {
        trust_building: 5, // Less activity due to gap
        early_touch: 2,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.4);

      // Should get fewer traits without streak bonus
      const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);
      expect(traits.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Trait Assignment with Streak Bonuses', () => {
    it('should demonstrate streak bonus impact on trait assignment', () => {
      const taskLog = {
        trust_building: 5,
        desensitization: 3,
      };

      // Without streak bonus (< 7 days)
      jest.spyOn(Math, 'random').mockReturnValue(0.4); // Medium-high roll
      const traitsWithoutBonus = evaluateEpigeneticTagsFromFoalTasks(taskLog, 3);

      // With streak bonus (>= 7 days)
      jest.spyOn(Math, 'random').mockReturnValue(0.4); // Same roll
      const traitsWithBonus = evaluateEpigeneticTagsFromFoalTasks(taskLog, 10);

      // Streak bonus should result in more traits assigned
      expect(traitsWithBonus.length).toBeGreaterThanOrEqual(traitsWithoutBonus.length);
    });

    it('should validate trait metadata for all assigned traits', () => {
      const taskLog = {
        trust_building: 8,
        desensitization: 6,
        early_touch: 5,
        showground_exposure: 4,
        sponge_bath: 3,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.1); // Low roll = many traits

      const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(taskLog, 10);

      // Verify all traits have proper structure
      assignedTraits.forEach(trait => {
        const metadata = getTraitMetadata(trait);

        expect(metadata).not.toBeNull();
        expect(metadata.name).toBe(trait);
        expect(metadata.description).toMatch(/^[A-Z].*\.$/); // Proper format
        expect(['epigenetic', 'bond', 'situational']).toContain(metadata.category);
        expect(metadata.type).toBe('positive'); // All foal traits are positive
      });
    });
  });

  describe('Real-World Player Scenarios', () => {
    it('should handle casual player with weekend-only care', () => {
      // Casual player: cares on weekends, misses weekdays
      let streak = 0;

      // Weekend 1: 2 days
      for (let day = 1; day <= 2; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }
      expect(streak).toBe(2);

      // Miss 5 weekdays (beyond grace period)
      const weekdayResult = updateConsecutiveDays(streak, false, 5);
      expect(weekdayResult.wasReset).toBe(true);
      streak = 0;

      // Weekend 2: Start over
      for (let day = 1; day <= 2; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }
      expect(streak).toBe(2);

      // Limited task log due to infrequent care
      const taskLog = {
        trust_building: 4,
        early_touch: 2,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Should get some traits but not many
      const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);
      expect(traits.length).toBeLessThanOrEqual(2);
    });

    it('should handle dedicated player with consistent daily care', () => {
      // Dedicated player: daily care for 2 weeks
      let streak = 0;

      for (let day = 1; day <= 14; day++) {
        const result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
      }

      expect(streak).toBe(14);

      // Check immunity
      const immunity = checkBurnoutImmunity(streak);
      expect(immunity.immunityGranted).toBe(true);

      // Extensive task log from daily care
      const taskLog = {
        trust_building: 14,
        desensitization: 10,
        early_touch: 12,
        showground_exposure: 8,
        sponge_bath: 6,
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.2);

      // Should get many traits
      const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);
      expect(traits.length).toBeGreaterThan(3);

      // Should include key development traits
      expect(traits).toContain('bonded');
      expect(traits).toContain('resilient');
      expect(traits).toContain('confident');
    });
  });
});
