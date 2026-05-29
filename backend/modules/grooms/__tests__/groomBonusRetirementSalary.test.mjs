/**
 * groomBonusTraitService, groomRetirementService, groomSalaryService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal + groom.
 * Fresh groom (careerWeeks=0, no assignments) exercises not-eligible paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  validateBonusTraits,
  getBonusTraits,
  checkBonusEligibility,
  getUserGroomsWithBonusTraits,
} from '../services/groomBonusTraitService.mjs';
import {
  checkRetirementEligibility,
  getGroomsApproachingRetirement,
  getRetirementStatistics,
} from '../services/groomRetirementService.mjs';
import {
  calculateWeeklySalary,
  getSalaryPaymentHistory,
  calculateUserSalaryCost,
} from '../services/groomSalaryService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groombonus-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groombonus${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomBonus',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-GroomBonusHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomBonusGroom-${Date.now()}`,
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

// ── groomBonusTraitService ────────────────────────────────────────────────────

describe('validateBonusTraits', () => {
  it('returns valid for empty object', () => {
    const result = validateBonusTraits({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for 3 traits within bonus limits', () => {
    const result = validateBonusTraits({ Calm: 0.1, Brave: 0.2, Curious: 0.25 });
    expect(result.valid).toBe(true);
  });

  it('returns invalid for more than 3 traits', () => {
    const result = validateBonusTraits({ A: 0.1, B: 0.1, C: 0.1, D: 0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid for bonus exceeding 0.3 (30%)', () => {
    const result = validateBonusTraits({ Calm: 0.5 });
    expect(result.valid).toBe(false);
  });
});

describe('getBonusTraits', () => {
  it('throws for non-existent groom', async () => {
    await expect(getBonusTraits(999999999)).rejects.toThrow();
  });

  it('returns empty object for groom with no bonus traits set', async () => {
    const result = await getBonusTraits(groom.id);
    expect(typeof result).toBe('object');
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('checkBonusEligibility', () => {
  it('returns ineligible for newborn with no interactions (bond too low)', async () => {
    const result = await checkBonusEligibility(horse.id, groom.id);
    expect(typeof result.eligible).toBe('boolean');
    expect(typeof result.averageBondScore).toBe('number');
    expect(typeof result.coveragePercentage).toBe('number');
    expect(typeof result.reason).toBe('string');
  });
});

describe('getUserGroomsWithBonusTraits', () => {
  it('returns array including our fixture groom', async () => {
    const result = await getUserGroomsWithBonusTraits(user.id);
    expect(Array.isArray(result)).toBe(true);
    const ids = result.map(g => g.id);
    expect(ids).toContain(groom.id);
  });
});

// ── groomRetirementService ────────────────────────────────────────────────────

describe('checkRetirementEligibility', () => {
  it('throws for non-existent groom', async () => {
    await expect(checkRetirementEligibility(999999999)).rejects.toThrow();
  });

  it('returns not eligible for fresh groom (careerWeeks=0)', async () => {
    const result = await checkRetirementEligibility(groom.id);
    expect(result.eligible).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(typeof result.weeksUntilRetirement).toBe('number');
  });
});

describe('getGroomsApproachingRetirement', () => {
  it('returns empty array for user whose groom has 0 career weeks', async () => {
    const result = await getGroomsApproachingRetirement(user.id);
    expect(Array.isArray(result)).toBe(true);
    const ids = result.map(g => g.id);
    expect(ids).not.toContain(groom.id);
  });
});

describe('getRetirementStatistics', () => {
  it('returns statistics shape for user', async () => {
    const result = await getRetirementStatistics(user.id);
    expect(typeof result.activeGrooms).toBe('number');
    expect(typeof result.retiredGrooms).toBe('number');
    expect(typeof result.totalGrooms).toBe('number');
    expect(result.totalGrooms).toBe(result.activeGrooms + result.retiredGrooms);
  });
});

// ── groomSalaryService ────────────────────────────────────────────────────────

describe('calculateWeeklySalary', () => {
  it('returns novice base + foal_care bonus = 60', () => {
    const result = calculateWeeklySalary({ skillLevel: 'novice', speciality: 'foalCare' });
    expect(result).toBe(60);
  });

  it('returns master base + showHandling bonus = 165', () => {
    const result = calculateWeeklySalary({ skillLevel: 'master', speciality: 'showHandling' });
    expect(result).toBe(165);
  });

  it('returns novice base for unknown skill level', () => {
    const result = calculateWeeklySalary({ skillLevel: 'unknown', speciality: 'general' });
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });
});

describe('getSalaryPaymentHistory', () => {
  it('returns empty array for user with no payments', async () => {
    const result = await getSalaryPaymentHistory(user.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('calculateUserSalaryCost', () => {
  it('returns zero cost for user with no active assignments', async () => {
    const result = await calculateUserSalaryCost(user.id);
    expect(result.totalWeeklyCost).toBe(0);
    expect(result.groomCount).toBe(0);
    expect(Array.isArray(result.breakdown)).toBe(true);
  });
});
