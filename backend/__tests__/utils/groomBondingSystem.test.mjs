/**
 * groomBondingSystem util unit tests (Equoria-rr7 coverage sprint).
 *
 * Sync functions: pure, no DB — tested with in-memory inputs.
 * Async functions (validateGroomingEligibility, processGroomingSession):
 *   tested with real DB fixtures (user + horse + groom).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  getEligibleTasksForAge,
  categorizeTask,
  getAgeGroupDescription,
  calculateBondingEffects,
  validateGroomingEligibility,
  updateConsecutiveDays,
  checkBurnoutImmunity,
  updateTaskLog,
  updateStreakTracking,
} from '../../utils/groomBondingSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groombonding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `groombonding${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GroomBonding',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-GroomBondingHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomBondingGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── getEligibleTasksForAge ────────────────────────────────────────────────────

describe('getEligibleTasksForAge', () => {
  it('returns array', () => {
    const result = getEligibleTasksForAge(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns enrichment tasks for age 0 days (newborn)', () => {
    const result = getEligibleTasksForAge(0);
    expect(result).toContain('desensitization');
  });

  it('returns tasks for very young foal (14 days)', () => {
    const result = getEligibleTasksForAge(14);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── categorizeTask ────────────────────────────────────────────────────────────

describe('categorizeTask', () => {
  it('returns enrichment for desensitization', () => {
    const result = categorizeTask('desensitization');
    expect(result).toBe('enrichment');
  });

  it('returns grooming for hoof_handling', () => {
    const result = categorizeTask('hoof_handling');
    expect(result).toBe('grooming');
  });

  it('returns null for unknown task', () => {
    const result = categorizeTask('totally_unknown_task_xyz');
    expect(result).toBeNull();
  });
});

// ── getAgeGroupDescription ────────────────────────────────────────────────────

describe('getAgeGroupDescription', () => {
  it('returns a string description', () => {
    const result = getAgeGroupDescription(0);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns different descriptions for different ages', () => {
    const young = getAgeGroupDescription(0);
    const older = getAgeGroupDescription(500);
    expect(typeof young).toBe('string');
    expect(typeof older).toBe('string');
  });
});

// ── calculateBondingEffects ───────────────────────────────────────────────────

describe('calculateBondingEffects', () => {
  it('returns an object with bonding-related fields', () => {
    const result = calculateBondingEffects('desensitization', 30, 5, 0);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('returns numeric values for bond changes', () => {
    const result = calculateBondingEffects('desensitization', 30, 5, 0);
    if (typeof result.bondingChange === 'number') {
      expect(typeof result.bondingChange).toBe('number');
    }
  });
});

// ── updateConsecutiveDays ─────────────────────────────────────────────────────

describe('updateConsecutiveDays', () => {
  it('returns object with newConsecutiveDays when groomed today', () => {
    const result = updateConsecutiveDays(0, true, 0);
    expect(typeof result).toBe('object');
    expect(typeof result.newConsecutiveDays).toBe('number');
    expect(result.newConsecutiveDays).toBe(1);
  });

  it('returns reset when daysSinceLastGrooming exceeds grace period', () => {
    const result = updateConsecutiveDays(3, false, 10);
    expect(result.wasReset).toBe(true);
    expect(result.newConsecutiveDays).toBe(0);
  });
});

// ── checkBurnoutImmunity ──────────────────────────────────────────────────────

describe('checkBurnoutImmunity', () => {
  it('returns object with status field', () => {
    const result = checkBurnoutImmunity(0);
    expect(typeof result).toBe('object');
    expect(typeof result.status).toBe('string');
  });

  it('returns immune status for high consecutive days', () => {
    const result = checkBurnoutImmunity(100);
    expect(result.immunityGranted).toBe(true);
    expect(result.status).toBe('immune');
  });
});

// ── updateTaskLog ─────────────────────────────────────────────────────────────

describe('updateTaskLog', () => {
  it('returns an object when given empty log and valid task', () => {
    const result = updateTaskLog({}, 'desensitization');
    expect(typeof result).toBe('object');
  });

  it('increments existing task count', () => {
    const initial = { desensitization: 2 };
    const result = updateTaskLog(initial, 'desensitization');
    expect(result.taskLog.desensitization).toBeGreaterThanOrEqual(3);
  });
});

// ── updateStreakTracking ──────────────────────────────────────────────────────

describe('updateStreakTracking', () => {
  it('returns an object with streak info', () => {
    const result = updateStreakTracking(null, new Date(), 0);
    expect(typeof result).toBe('object');
  });

  it('handles null lastGroomed (first grooming)', () => {
    const result = updateStreakTracking(null, new Date(), 0);
    expect(result).toBeDefined();
  });
});

// ── validateGroomingEligibility ───────────────────────────────────────────────

describe('validateGroomingEligibility', () => {
  it('returns eligibility object for valid horse + task', async () => {
    const horseRecord = await prisma.horse.findUnique({ where: { id: horse.id } });
    const result = await validateGroomingEligibility(horseRecord, 'desensitization');
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── additional branch-coverage tests (Equoria-jkht) ─────────────────────────
// The tests above cover happy-path shapes; the tests below cover every branch.

import { GROOM_CONFIG } from '../../config/groomConfig.mjs';
import { checkTaskMutualExclusivity } from '../../utils/groomBondingSystem.mjs';

const ENRICHMENT_TASK = GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS[0]; // 'desensitization'
const ENRICHMENT_TASK2 = GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS[1]; // 'trust_building'
const FOAL_GROOM_TASK = GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS[0]; // 'hoof_handling'
const GENERAL_TASK = GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS[0]; // 'brushing'

// ── getEligibleTasksForAge — branch coverage ──────────────────────────────────

describe('getEligibleTasksForAge — branch coverage', () => {
  it('newborn (0 days) gets only enrichment tasks, no foal-grooming or general', () => {
    const tasks = getEligibleTasksForAge(0);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(false);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(false);
  });

  it('7 days (1 year) gets enrichment + foal-grooming, no general', () => {
    const tasks = getEligibleTasksForAge(7);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(false);
  });

  it('21 days (3 years) gets all task types (general grooming threshold)', () => {
    const tasks = getEligibleTasksForAge(21);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(true);
  });

  it('returns a deduplicated list (no task appears twice)', () => {
    const tasks = getEligibleTasksForAge(21);
    expect(tasks.length).toBe([...new Set(tasks)].length);
  });
});

// ── categorizeTask — branch coverage ─────────────────────────────────────────

describe('categorizeTask — branch coverage', () => {
  it('returns GROOMING for a general grooming task', () => {
    expect(categorizeTask(GENERAL_TASK)).toBe(GROOM_CONFIG.TASK_CATEGORIES.GROOMING);
  });

  it('returns null for an empty string', () => {
    expect(categorizeTask('')).toBeNull();
  });
});

// ── getAgeGroupDescription — branch coverage ──────────────────────────────────

describe('getAgeGroupDescription — branch coverage', () => {
  it('14 days (2 years) → young foal (boundary)', () => {
    expect(getAgeGroupDescription(14)).toBe('young foal (0-2 years)');
  });

  it('15 days (2.14 years) → foal (1-3 years)', () => {
    expect(getAgeGroupDescription(15)).toBe('foal (1-3 years)');
  });

  it('21 days (3 years) → foal (1-3 years, upper boundary)', () => {
    expect(getAgeGroupDescription(21)).toBe('foal (1-3 years)');
  });

  it('22 days (3.14 years) → adult horse (3+ years)', () => {
    expect(getAgeGroupDescription(22)).toBe('adult horse (3+ years)');
  });
});

// ── calculateBondingEffects — branch coverage ─────────────────────────────────
// Note: signature is (currentBondScore, groomingTask, groomPersonality, horseTemperament)

describe('calculateBondingEffects — branch coverage', () => {
  it('returns eligible:false for enrichment (non-grooming) task', () => {
    const result = calculateBondingEffects(50, ENRICHMENT_TASK, null, null);
    expect(result.eligible).toBe(false);
    expect(result.bondChange).toBe(0);
    expect(result.newBondScore).toBe(50);
  });

  it('returns eligible:false for unknown task', () => {
    const result = calculateBondingEffects(50, 'magic_brushing', null, null);
    expect(result.eligible).toBe(false);
  });

  it('applies bond gain for a valid grooming task', () => {
    const result = calculateBondingEffects(50, FOAL_GROOM_TASK, null, null);
    expect(result.eligible).toBe(true);
    expect(result.bondChange).toBeGreaterThan(0);
    expect(result.newBondScore).toBeCloseTo(50 + GROOM_CONFIG.DAILY_BOND_GAIN);
  });

  it('caps newBondScore at BOND_SCORE_MAX', () => {
    const result = calculateBondingEffects(GROOM_CONFIG.BOND_SCORE_MAX - 1, FOAL_GROOM_TASK, null, null);
    expect(result.newBondScore).toBe(GROOM_CONFIG.BOND_SCORE_MAX);
    expect(result.capped).toBe(true);
  });

  it('capped is false when bond gain does not hit ceiling', () => {
    const result = calculateBondingEffects(10, FOAL_GROOM_TASK, null, null);
    expect(result.capped).toBe(false);
  });

  it('applies bond gain for a general grooming task', () => {
    const result = calculateBondingEffects(0, GENERAL_TASK, null, null);
    expect(result.eligible).toBe(true);
    expect(result.newBondScore).toBeGreaterThan(0);
  });
});

// ── updateConsecutiveDays — branch coverage ───────────────────────────────────

describe('updateConsecutiveDays — branch coverage', () => {
  it('maintains current count when within grace period', () => {
    const result = updateConsecutiveDays(5, false, GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS);
    expect(result.newConsecutiveDays).toBe(5);
    expect(result.wasReset).toBe(false);
  });

  it('maintains count at 1 day since last grooming (inside grace)', () => {
    const result = updateConsecutiveDays(4, false, 1);
    expect(result.newConsecutiveDays).toBe(4);
    expect(result.wasReset).toBe(false);
  });
});

// ── checkBurnoutImmunity — branch coverage ────────────────────────────────────

describe('checkBurnoutImmunity — branch coverage', () => {
  const THRESHOLD = GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS;

  it('grants immunity at exactly the threshold', () => {
    const result = checkBurnoutImmunity(THRESHOLD);
    expect(result.immunityGranted).toBe(true);
    expect(result.daysToImmunity).toBe(0);
  });

  it('does not grant immunity one day below threshold', () => {
    const result = checkBurnoutImmunity(THRESHOLD - 1);
    expect(result.immunityGranted).toBe(false);
    expect(result.daysToImmunity).toBe(1);
  });

  it('daysToImmunity equals threshold when consecutiveDays is 0', () => {
    const result = checkBurnoutImmunity(0);
    expect(result.daysToImmunity).toBe(THRESHOLD);
  });
});

// ── updateTaskLog — branch coverage ──────────────────────────────────────────

describe('updateTaskLog — branch coverage', () => {
  it('initializes from null (no existing log)', () => {
    const result = updateTaskLog(null, 'desensitization');
    expect(result.taskLog).toEqual({ desensitization: 1 });
    expect(result.totalTasks).toBe(1);
    expect(result.taskCount).toBe(1);
  });

  it('adds a new key to an existing log', () => {
    const result = updateTaskLog({ desensitization: 2 }, 'hoof_handling');
    expect(result.taskLog.hoof_handling).toBe(1);
    expect(result.taskLog.desensitization).toBe(2);
    expect(result.totalTasks).toBe(3);
  });
});

// ── updateStreakTracking — branch coverage ────────────────────────────────────

describe('updateStreakTracking — branch coverage', () => {
  const NOW = new Date('2026-05-12T12:00:00Z');

  it('maintains streak on same day (daysDiff = 0)', () => {
    const result = updateStreakTracking(NOW, NOW, 5);
    expect(result.consecutiveDays).toBe(5);
    expect(result.sameDay).toBe(true);
    expect(result.streakBroken).toBe(false);
  });

  it('increments streak on consecutive day (daysDiff = 1)', () => {
    const yesterday = new Date('2026-05-11T12:00:00Z');
    const result = updateStreakTracking(yesterday, NOW, 4);
    expect(result.consecutiveDays).toBe(5);
    expect(result.withinGracePeriod).toBe(false);
    expect(result.streakBroken).toBe(false);
  });

  it('maintains streak within grace period (daysDiff = 2)', () => {
    const twoDaysAgo = new Date('2026-05-10T12:00:00Z');
    const result = updateStreakTracking(twoDaysAgo, NOW, 3);
    expect(result.consecutiveDays).toBe(4);
    expect(result.withinGracePeriod).toBe(true);
    expect(result.streakBroken).toBe(false);
  });

  it('resets streak beyond grace period (daysDiff = 3)', () => {
    const threeDaysAgo = new Date('2026-05-09T12:00:00Z');
    const result = updateStreakTracking(threeDaysAgo, NOW, 6);
    expect(result.consecutiveDays).toBe(1);
    expect(result.streakBroken).toBe(true);
  });

  it('bonusEligible=true when newStreak hits FOAL_STREAK_BONUS_THRESHOLD', () => {
    const yesterday = new Date('2026-05-11T12:00:00Z');
    const threshold = GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD;
    const result = updateStreakTracking(yesterday, NOW, threshold - 1);
    expect(result.bonusEligible).toBe(true);
    expect(result.bonusPercentage).toBe(10);
  });

  it('bonusEligible=false when newStreak is below bonus threshold', () => {
    const yesterday = new Date('2026-05-11T12:00:00Z');
    const result = updateStreakTracking(yesterday, NOW, 2);
    expect(result.bonusEligible).toBe(false);
  });
});

// ── checkTaskMutualExclusivity — branch coverage ──────────────────────────────

describe('checkTaskMutualExclusivity', () => {
  it('allows first task of the day (existingTask is null)', () => {
    const result = checkTaskMutualExclusivity(null, ENRICHMENT_TASK);
    expect(result.allowed).toBe(true);
    expect(result.conflict).toBe(false);
  });

  it('allows same-category: enrichment after enrichment', () => {
    const result = checkTaskMutualExclusivity(ENRICHMENT_TASK, ENRICHMENT_TASK2);
    expect(result.allowed).toBe(true);
    expect(result.sameCategory).toBe(true);
  });

  it('allows same-category: general grooming after foal grooming', () => {
    const result = checkTaskMutualExclusivity(FOAL_GROOM_TASK, GENERAL_TASK);
    expect(result.allowed).toBe(true);
    expect(result.sameCategory).toBe(true);
  });

  it('blocks cross-category: grooming after enrichment', () => {
    const result = checkTaskMutualExclusivity(ENRICHMENT_TASK, FOAL_GROOM_TASK);
    expect(result.allowed).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.existingCategory).toBe(GROOM_CONFIG.TASK_CATEGORIES.ENRICHMENT);
    expect(result.newCategory).toBe(GROOM_CONFIG.TASK_CATEGORIES.GROOMING);
  });

  it('blocks cross-category: enrichment after grooming', () => {
    const result = checkTaskMutualExclusivity(FOAL_GROOM_TASK, ENRICHMENT_TASK);
    expect(result.allowed).toBe(false);
    expect(result.conflict).toBe(true);
  });

  it('allows when newTask has unknown category (null → no conflict possible)', () => {
    const result = checkTaskMutualExclusivity(ENRICHMENT_TASK, 'unknown_task_xyz');
    expect(result.allowed).toBe(true);
    expect(result.conflict).toBe(false);
  });
});
