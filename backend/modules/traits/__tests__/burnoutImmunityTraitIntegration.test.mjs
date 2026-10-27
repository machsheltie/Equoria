/**
 * Care Streak & Trait Integration Tests
 *
 * Tests the complete workflow integrating groomBondingSystem streak logic
 * with trait milestone evaluation.
 *
 * Owner ruling 2026-10-23 (Equoria-0gl9o): there is no burnout. The "burnout
 * immunity" label (checkBurnoutImmunity, BURNOUT_STATUS, Horse.burnoutStatus)
 * is gone; the care streak and its 2-day grace period stay. (The file keeps
 * its historical name.)
 *
 * updateConsecutiveDays is a pure function — all assertions on it are fully
 * deterministic.
 *
 * evaluateEpigeneticTagsFromFoalTasks uses Math.random() internally.
 * Assertions on its output are limited to structural guarantees (always
 * returns an array, no duplicates, any assigned traits have valid metadata).
 * Assertions that require a specific random outcome have been removed.
 *
 * No mocks of any kind.
 */

import { describe, it, expect } from '@jest/globals';
import { updateConsecutiveDays } from '../../../utils/groomBondingSystem.mjs';
import { evaluateEpigeneticTagsFromFoalTasks } from '../../../utils/traitEvaluation.mjs';
import { getTraitMetadata } from '../../../utils/epigeneticTraits.mjs';
import taskTraitInfluenceMap from '../../../config/taskInfluenceConfig.mjs';

// Owner ruling 2026-10-27 (q117) replaced the trait roster. The age-1 tag
// generator still draws from the legacy task map, which names traits the
// roster removed (bonded, calm, showCalm, ...); re-keying it is Equoria-qw4kp.
// Until then a tag is checked against the task map it comes from, and a tag
// that IS on the roster must carry roster metadata.
const taskMapTraits = new Set(Object.values(taskTraitInfluenceMap).flatMap(i => i.traits));
function expectValidTag(trait) {
  expect(taskMapTraits.has(trait)).toBe(true);
  const metadata = getTraitMetadata(trait);
  if (metadata) {
    expect(metadata.name).toBe(trait);
    expect(metadata.category).toBe('epigenetic');
  }
}

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
  it('builds streak to 7', () => {
    expect(buildStreak(7)).toBe(7);
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
      expectValidTag(trait);
    }
  });
});

// ─── Streak Loss and Recovery ─────────────────────────────────────────────────

describe('Streak Loss and Recovery', () => {
  it('builds streak to 6', () => {
    expect(buildStreak(6)).toBe(6);
  });

  it('3-day gap beyond grace period resets streak to 0', () => {
    const streak = buildStreak(6);

    const lossResult = updateConsecutiveDays(streak, false, 3);
    expect(lossResult.newConsecutiveDays).toBe(0);
    expect(lossResult.wasReset).toBe(true);
  });

  it('rebuilds to 8 after streak loss', () => {
    let streak = updateConsecutiveDays(buildStreak(6), false, 3).newConsecutiveDays;
    for (let i = 0; i < 8; i++) {
      streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
    }
    expect(streak).toBe(8);
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
    const horseAStreak = buildStreak(10);

    let horseBStreak = 5;
    horseBStreak = updateConsecutiveDays(horseBStreak, false, 2).newConsecutiveDays;

    const horseCStreak = buildStreak(3);

    expect(horseAStreak).toBe(10);
    expect(horseBStreak).toBe(5);
    expect(horseCStreak).toBe(3);
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
      expectValidTag(trait);
    }
  });
});

// ─── Real-World Player Scenarios ─────────────────────────────────────────────

describe('Real-World Player Scenarios', () => {
  it('casual player: 2-day weekends lose streak after 5 weekdays (beyond grace period)', () => {
    const streak = buildStreak(2);
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

  it('dedicated player: 14-day streak', () => {
    expect(buildStreak(14)).toBe(14);
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
      expectValidTag(trait);
    }
  });
});
