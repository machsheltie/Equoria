/**
 * Burnout Immunity & Trait Integration Tests
 *
 * Tests the complete workflow integrating groomBondingSystem streak logic
 * with trait milestone evaluation.
 *
 * updateConsecutiveDays / checkBurnoutImmunity are pure functions — all
 * assertions on them are fully deterministic.
 *
 * evaluateEpigeneticTagsFromFoalTasks uses Math.random() internally.
 * Assertions on its output are limited to structural guarantees (always
 * returns an array, no duplicates, any assigned traits have valid metadata).
 * Assertions that require a specific random outcome have been removed.
 *
 * No mocks of any kind.
 */

import { describe, it, expect } from '@jest/globals';
import { updateConsecutiveDays, checkBurnoutImmunity } from '../utils/groomBondingSystem.mjs';
import { evaluateEpigeneticTagsFromFoalTasks } from '../utils/traitEvaluation.mjs';
import { getTraitMetadata } from '../utils/epigeneticTraits.mjs';
import { GROOM_CONFIG } from '../config/groomConfig.mjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildStreak(days) {
  let streak = 0;
  for (let i = 0; i < days; i++) {
    streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
  }
  return streak;
}

// ─── Complete Foal Development Workflow ──────────────────────────────────────

describe('Complete Foal Development Workflow', () => {
  it('builds streak to 7 and grants burnout immunity', () => {
    const streak = buildStreak(7);

    expect(streak).toBe(7);

    const immunity = checkBurnoutImmunity(streak);
    expect(immunity.immunityGranted).toBe(true);
    expect(immunity.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
  });

  it('preserves streak within 2-day grace period and increments on resume', () => {
    const streak = buildStreak(7);

    const gracePeriodResult = updateConsecutiveDays(streak, false, 2);
    expect(gracePeriodResult.newConsecutiveDays).toBe(7);
    expect(gracePeriodResult.wasReset).toBe(false);

    const resumeResult = updateConsecutiveDays(gracePeriodResult.newConsecutiveDays, true);
    expect(resumeResult.newConsecutiveDays).toBe(8);
  });

  it('reaches streak 11 after 7-day build + 1 resume + 3 more days', () => {
    let streak = buildStreak(7);

    streak = updateConsecutiveDays(streak, false, 2).newConsecutiveDays; // grace → still 7
    streak = updateConsecutiveDays(streak, true).newConsecutiveDays; // resume → 8

    for (let i = 0; i < 3; i++) {
      streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
    }

    expect(streak).toBe(11);
  });

  it('trait evaluation after full workflow returns an array with no duplicates', () => {
    const streak = buildStreak(11);

    const taskLog = {
      trust_building: 8,
      desensitization: 6,
      early_touch: 5,
      showground_exposure: 3,
    };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('any assigned traits have valid metadata with correct type', () => {
    const streak = buildStreak(11);
    const taskLog = { trust_building: 8, desensitization: 6 };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

    for (const trait of traits) {
      const metadata = getTraitMetadata(trait);
      expect(metadata).not.toBeNull();
      expect(metadata.description).toBeDefined();
      expect(metadata.type).toBe('positive');
    }
  });
});

// ─── Streak Loss and Recovery ─────────────────────────────────────────────────

describe('Streak Loss and Recovery', () => {
  it('streak of 6 has daysToImmunity = 1 and immunityGranted = false', () => {
    const streak = buildStreak(6);

    expect(streak).toBe(6);

    const immunity = checkBurnoutImmunity(streak);
    expect(immunity.immunityGranted).toBe(false);
    expect(immunity.daysToImmunity).toBe(1);
  });

  it('3-day gap beyond grace period resets streak to 0', () => {
    const streak = buildStreak(6);

    const lossResult = updateConsecutiveDays(streak, false, 3);
    expect(lossResult.newConsecutiveDays).toBe(0);
    expect(lossResult.wasReset).toBe(true);
  });

  it('rebuilds to 8 and achieves immunity after streak loss', () => {
    const streak = buildStreak(8);

    expect(streak).toBe(8);

    const immunity = checkBurnoutImmunity(streak);
    expect(immunity.immunityGranted).toBe(true);
  });

  it('trait evaluation after rebuild returns an array with no duplicates', () => {
    const streak = buildStreak(8);
    const taskLog = { trust_building: 8, desensitization: 4, early_touch: 6 };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });
});

// ─── Per-Horse Independent Tracking ──────────────────────────────────────────

describe('Per-Horse Independent Tracking', () => {
  it('tracks three horses with different care patterns independently', () => {
    const horseA_streak = buildStreak(10);

    let horseB_streak = 5;
    horseB_streak = updateConsecutiveDays(horseB_streak, false, 2).newConsecutiveDays;

    const horseC_streak = buildStreak(3);

    expect(horseA_streak).toBe(10);
    expect(horseB_streak).toBe(5);
    expect(horseC_streak).toBe(3);
  });

  it('reports correct immunity status for each independently-tracked horse', () => {
    const immunityA = checkBurnoutImmunity(10);
    const immunityB = checkBurnoutImmunity(5);
    const immunityC = checkBurnoutImmunity(3);

    expect(immunityA.immunityGranted).toBe(true);
    expect(immunityB.immunityGranted).toBe(false);
    expect(immunityC.immunityGranted).toBe(false);
  });

  it('evaluates traits independently for each horse and all results are arrays without duplicates', () => {
    const taskLogA = { trust_building: 10, desensitization: 8 };
    const taskLogB = { early_touch: 5, showground_exposure: 3 };
    const taskLogC = { trust_building: 3 };

    const traitsA = evaluateEpigeneticTagsFromFoalTasks(taskLogA, 10);
    const traitsB = evaluateEpigeneticTagsFromFoalTasks(taskLogB, 5);
    const traitsC = evaluateEpigeneticTagsFromFoalTasks(taskLogC, 3);

    for (const result of [traitsA, traitsB, traitsC]) {
      expect(Array.isArray(result)).toBe(true);
      expect(new Set(result).size).toBe(result.length);
    }
  });
});

// ─── Grace Period Edge Cases ──────────────────────────────────────────────────

describe('Grace Period Edge Cases', () => {
  it('exactly 2-day gap preserves streak of 7 (boundary case)', () => {
    const gracePeriodResult = updateConsecutiveDays(7, false, 2);

    expect(gracePeriodResult.newConsecutiveDays).toBe(7);
    expect(gracePeriodResult.wasReset).toBe(false);
  });

  it('resume after 2-day gap increments streak to 8', () => {
    const streak = updateConsecutiveDays(7, true).newConsecutiveDays;

    expect(streak).toBe(8);
  });

  it('trait evaluation after grace-period resume returns an array without duplicates', () => {
    const taskLog = { trust_building: 6, early_touch: 4 };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, 8);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('3-day gap resets streak of 8 to 0 (beyond grace period)', () => {
    const lossResult = updateConsecutiveDays(8, false, 3);

    expect(lossResult.newConsecutiveDays).toBe(0);
    expect(lossResult.wasReset).toBe(true);
  });

  it('first day of rebuild after reset sets streak to 1', () => {
    const rebuildResult = updateConsecutiveDays(0, true);

    expect(rebuildResult.newConsecutiveDays).toBe(1);
  });
});

// ─── Trait Assignment with Streak Bonuses ────────────────────────────────────

describe('Trait Assignment with Streak Bonuses', () => {
  it('trait evaluation at streak 3 (no bonus) returns an array without duplicates', () => {
    const taskLog = { trust_building: 5, desensitization: 3 };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 3);

    expect(Array.isArray(result)).toBe(true);
    expect(new Set(result).size).toBe(result.length);
  });

  it('trait evaluation at streak 10 (with bonus) returns an array without duplicates', () => {
    const taskLog = { trust_building: 5, desensitization: 3 };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 10);

    expect(Array.isArray(result)).toBe(true);
    expect(new Set(result).size).toBe(result.length);
  });

  it('all assigned traits from rich task log have valid metadata', () => {
    const taskLog = {
      trust_building: 8,
      desensitization: 6,
      early_touch: 5,
      showground_exposure: 4,
      sponge_bath: 3,
    };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, 10);

    for (const trait of traits) {
      const metadata = getTraitMetadata(trait);
      expect(metadata).not.toBeNull();
      expect(metadata.name).toBe(trait);
      expect(typeof metadata.description).toBe('string');
      expect(['epigenetic', 'bond', 'situational']).toContain(metadata.category);
      expect(metadata.type).toBe('positive');
    }
  });
});

// ─── Real-World Player Scenarios ─────────────────────────────────────────────

describe('Real-World Player Scenarios', () => {
  it('casual player: 2-day weekends lose streak after 5 weekdays (beyond grace period)', () => {
    let streak = buildStreak(2);
    expect(streak).toBe(2);

    const weekdayResult = updateConsecutiveDays(streak, false, 5);
    expect(weekdayResult.wasReset).toBe(true);
    expect(weekdayResult.newConsecutiveDays).toBe(0);
  });

  it('casual player: weekend restart returns array from limited task log', () => {
    const streak = buildStreak(2);
    const taskLog = { trust_building: 4, early_touch: 2 };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('dedicated player: 14-day streak achieves immunity', () => {
    const streak = buildStreak(14);

    expect(streak).toBe(14);

    const immunity = checkBurnoutImmunity(streak);
    expect(immunity.immunityGranted).toBe(true);
  });

  it('dedicated player: extensive task log returns array without duplicates and all traits have metadata', () => {
    const taskLog = {
      trust_building: 14,
      desensitization: 10,
      early_touch: 12,
      showground_exposure: 8,
      sponge_bath: 6,
    };

    const traits = evaluateEpigeneticTagsFromFoalTasks(taskLog, 14);

    expect(Array.isArray(traits)).toBe(true);
    expect(new Set(traits).size).toBe(traits.length);

    for (const trait of traits) {
      const metadata = getTraitMetadata(trait);
      expect(metadata).not.toBeNull();
      expect(metadata.type).toBe('positive');
    }
  });
});
