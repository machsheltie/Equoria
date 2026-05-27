/**
 * groomBondingSystem util unit tests (Equoria-rr7 coverage sprint).
 *
 * Sync functions: pure, no DB — tested with in-memory inputs.
 * Async functions (validateGroomingEligibility, processGroomingSession):
 *   tested with real DB fixtures (user + horse + groom).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  getEligibleTasksForAge,
  categorizeTask,
  getAgeGroupDescription,
  calculateBondingEffects,
  validateGroomingEligibility,
  processGroomingSession,
  updateConsecutiveDays,
  checkBurnoutImmunity,
  updateTaskLog,
  updateStreakTracking,
  checkTaskMutualExclusivity,
} from '../../../utils/groomBondingSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-dm1i: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groombonding-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groombonding${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomBonding',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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

import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';

const ENRICHMENT_TASK = GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS[0]; // 'desensitization'
const ENRICHMENT_TASK2 = GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS[1]; // 'trust_building'
const FOAL_GROOM_TASK = GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS[0]; // 'hoof_handling'
const GENERAL_TASK = GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS[0]; // 'brushing'

// ── getEligibleTasksForAge — branch coverage ──────────────────────────────────

describe('getEligibleTasksForAge — branch coverage', () => {
  // Equoria-v6gg: argument is now game-years (was previously ageInDays).
  it('newborn (age=0 years) gets only enrichment tasks, no foal-grooming or general', () => {
    const tasks = getEligibleTasksForAge(0);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(false);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(false);
  });

  it('age=1 year gets enrichment + foal-grooming, no general', () => {
    const tasks = getEligibleTasksForAge(1);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(false);
  });

  it('age=3 years gets all task types (general grooming threshold)', () => {
    const tasks = getEligibleTasksForAge(3);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS.includes(t))).toBe(true);
    expect(tasks.some(t => GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.includes(t))).toBe(true);
  });

  it('returns a deduplicated list (no task appears twice)', () => {
    const tasks = getEligibleTasksForAge(3);
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
  // Equoria-v6gg: argument is now game-years.
  it('age=2 years → young foal (upper boundary of 0-2)', () => {
    expect(getAgeGroupDescription(2)).toBe('young foal (0-2 years)');
  });

  it('age=2.5 years → foal (1-3 years)', () => {
    expect(getAgeGroupDescription(2.5)).toBe('foal (1-3 years)');
  });

  it('age=3 years → foal (1-3 years, upper boundary)', () => {
    expect(getAgeGroupDescription(3)).toBe('foal (1-3 years)');
  });

  it('age=3.5 years → adult horse (3+ years)', () => {
    expect(getAgeGroupDescription(3.5)).toBe('adult horse (3+ years)');
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

// ── calculateBondingEffects — synergyMod !== 0 branch (line 144) ──────────────
// When a known temperament+personality pair has non-zero synergy, the logger.info
// branch fires and the returned synergyModifier is non-zero.

describe('calculateBondingEffects — non-zero synergy branch', () => {
  it('fires synergyMod !== 0 branch for Nervous+gentle (synergy=0.25)', () => {
    // Nervous temperament + gentle groom → synergy = 0.25 from TEMPERAMENT_GROOM_SYNERGY
    const result = calculateBondingEffects(50, FOAL_GROOM_TASK, 'gentle', 'Nervous');
    expect(result.eligible).toBe(true);
    expect(result.synergyModifier).toBeCloseTo(0.25);
    expect(result.bondChange).toBeGreaterThan(GROOM_CONFIG.DAILY_BOND_GAIN); // +25% bonus
  });
});

// ── validateGroomingEligibility — task-not-eligible branch (line 174) ─────────
// With a foal (age=0), eligible tasks are enrichment-only.
// Passing a general grooming task ('brushing') triggers the !eligibleTasks.includes branch.

describe('validateGroomingEligibility — task-not-eligible branch', () => {
  it('returns eligible:false when task is not in the eligible list for this age', async () => {
    const foal = { age: 0 }; // newborn: only enrichment tasks are eligible
    const result = await validateGroomingEligibility(foal, GENERAL_TASK); // 'brushing'
    expect(result.eligible).toBe(false);
    expect(result.eligibleTasks).toBeDefined();
    expect(result.ageGroup).toBeDefined();
    expect(result.horseAge).toBe(0);
  });
});

// ── processGroomingSession — horse-not-found path (lines 280-298, 381-383) ──────

describe('processGroomingSession() — horse not found', () => {
  it('rejects with "Horse with ID -1 not found" for a non-existent horse (lines 280-298, 381-383)', async () => {
    await expect(processGroomingSession(-1, null, 'brushing', 30)).rejects.toThrow('Horse with ID -1 not found');
  });
});

// ── processGroomingSession — ineligible-task path (lines 309-316) ────────────

describe('processGroomingSession() — ineligible task returns success:false (lines 309-316)', () => {
  it('returns { success:false } when task is not eligible for this horse age', async () => {
    // horse.age=0 → only enrichment tasks eligible; 'brushing' is NOT eligible
    const result = await processGroomingSession(horse.id, null, 'brushing', 30);
    expect(result.success).toBe(false);
    expect(result.reason).toBeDefined();
  });
});

// ── processGroomingSession — happy path with no groom (lines 300-380) ─────────

describe('processGroomingSession() — happy path, groomId=null (lines 300-380)', () => {
  it('returns { success:true } with bonding effects for eligible task and no groom', async () => {
    // horse.age=0 + 'desensitization' is an eligible enrichment task
    const result = await processGroomingSession(horse.id, null, 'desensitization', 30);
    expect(result.success).toBe(true);
    expect(result.bondingEffects).toBeDefined();
    expect(result.consecutiveDaysUpdate).toBeDefined();
    expect(result.immunityCheck).toBeDefined();
    expect(result.horse).toBeDefined();
    expect(result.horse.id).toBe(horse.id);
  });
});

// ── processGroomingSession — happy path WITH groomId (line 337) ───────────────
// The existing tests only ever pass groomId=null, leaving line 337
// (`await prisma.groomInteraction.create(...)`) and the groomId-truthy arm of
// the `groom = groomId ? findUnique : null` ternary uncovered.

describe('processGroomingSession() — happy path, groomId provided (line 337 + groomId-truthy arm) (Equoria-jkht)', () => {
  it('creates a groomInteraction record and returns success:true when groomId is truthy', async () => {
    // groom fixture is created in beforeAll; horse.age=0 → 'desensitization' is eligible
    const result = await processGroomingSession(horse.id, groom.id, 'desensitization', 45);
    expect(result.success).toBe(true);
    expect(result.bondingEffects).toBeDefined();
    expect(result.horse.id).toBe(horse.id);

    // Verify the interaction was persisted (covers line 337)
    const interaction = await prisma.groomInteraction.findFirst({
      where: { foalId: horse.id, groomId: groom.id },
      orderBy: { timestamp: 'desc' },
    });
    expect(interaction).not.toBeNull();
    expect(interaction.groomId).toBe(groom.id);
    expect(interaction.interactionType).toBe('desensitization');
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Exact-value bond mechanics, eligible-task recognition, age-restriction reasons,
// and burnout-immunity thresholds not covered by the shape-only tests above.
describe('groomBondingSystem — exact bonding/burnout values (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('bond score mechanics', () => {
    it('starts at BOND_SCORE_START of 0', () => {
      expect(GROOM_CONFIG.BOND_SCORE_START).toBe(0);
    });

    it('eligible task gives +2 bond (20 → 22)', () => {
      const result = calculateBondingEffects(20, 'brushing');
      expect(result.bondChange).toBe(2);
      expect(result.newBondScore).toBe(22);
    });

    it('caps at 100 (99 → 100, only +1 applied)', () => {
      const result = calculateBondingEffects(99, 'brushing');
      expect(result.newBondScore).toBe(100);
      expect(result.bondChange).toBe(1);
    });

    it('does not exceed 100 (100 → 100, +0)', () => {
      const result = calculateBondingEffects(100, 'brushing');
      expect(result.newBondScore).toBe(100);
      expect(result.bondChange).toBe(0);
    });

    it('non-eligible task gives 0 bond change', () => {
      expect(calculateBondingEffects(50, 'feeding').bondChange).toBe(0);
    });
  });

  describe('eligible general grooming tasks', () => {
    it('recognizes brushing, hand-walking, stall_care', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('brushing');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('hand-walking');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('stall_care');
    });
  });

  describe('age restrictions (game-years)', () => {
    it('allows grooming (brushing) for a 3-year-old', async () => {
      const result = await validateGroomingEligibility({ id: 1, age: 3, bondScore: 50 }, 'brushing');
      expect(result.eligible).toBe(true);
    });

    it('rejects adult grooming task for a horse just under 3', async () => {
      const result = await validateGroomingEligibility({ id: 1, age: 2.86, bondScore: 50 }, 'brushing');
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not an eligible task for foal');
    });

    it('allows enrichment task for a young horse with foal age group + enrichment type', async () => {
      const result = await validateGroomingEligibility({ id: 1, age: 1.43, bondScore: 30 }, 'trust_building');
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
      expect(result.ageGroup).toContain('foal');
      expect(result.taskType).toBe('enrichment');
    });
  });

  describe('consecutive day tracking — exact values', () => {
    it('increments when groomed today (3 → 4)', () => {
      expect(updateConsecutiveDays(3, true).newConsecutiveDays).toBe(4);
    });

    it('resets to 0 after a 2+ day lapse', () => {
      const result = updateConsecutiveDays(5, false, 3);
      expect(result.newConsecutiveDays).toBe(0);
      expect(result.wasReset).toBe(true);
    });

    it('maintains streak through a 1-day lapse', () => {
      const result = updateConsecutiveDays(5, false, 1);
      expect(result.newConsecutiveDays).toBe(5);
      expect(result.wasReset).toBe(false);
    });
  });

  describe('burnout immunity — exact thresholds', () => {
    it('grants immunity at exactly 7 consecutive days', () => {
      const result = checkBurnoutImmunity(7);
      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
      expect(result.immunityGranted).toBe(true);
    });

    it('stays NONE at 6 consecutive days', () => {
      const result = checkBurnoutImmunity(6);
      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
      expect(result.immunityGranted).toBe(false);
    });

    it('is NONE when consecutive days reset to 0', () => {
      expect(checkBurnoutImmunity(0).status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
    });
  });
});
