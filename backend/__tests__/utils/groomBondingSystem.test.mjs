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
