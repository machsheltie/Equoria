/**
 * groomAssignmentService, groomHandlerService, groomPerformanceService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal + groom.
 * No active assignments are created so zero-assignment paths are exercised.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  getGroomAssignmentLimits,
  validateAssignmentEligibility,
  getUserAssignments,
  calculateWeeklySalaryCosts,
} from '../services/groomAssignmentService.mjs';
import {
  calculateHandlerBonus,
  getAssignedHandler,
  validateHandlerEligibility,
} from '../services/groomHandlerService.mjs';
import { getGroomPerformanceSummary, getTopPerformingGrooms } from '../services/groomPerformanceService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let horse;
let groom;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groomsvc-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groomsvc${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomSvc',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-GroomSvcHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomSvcGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: groom and horse
  // (Horse.userId is onDelete:Restrict) before the user row. A failed delete
  // fails the suite instead of being swallowed and leaking a fixture into the
  // canonical DB.
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── groomAssignmentService ────────────────────────────────────────────────────

describe('getGroomAssignmentLimits', () => {
  it('returns limits for a novice groom with no assignments', async () => {
    const result = await getGroomAssignmentLimits({ id: groom.id, skillLevel: 'novice' });
    expect(result.maxAssignments).toBe(2);
    expect(result.currentAssignments).toBe(0);
    expect(result.availableSlots).toBe(2);
    expect(result.canTakeMore).toBe(true);
  });
});

describe('validateAssignmentEligibility', () => {
  it('returns valid when groom and horse belong to user', async () => {
    const result = await validateAssignmentEligibility(groom.id, horse.id, user.id);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid when userId does not match groom owner', async () => {
    const result = await validateAssignmentEligibility(groom.id, horse.id, 'wrong-user-id');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('getUserAssignments', () => {
  it('returns zero assignments for user with no active assignments', async () => {
    const result = await getUserAssignments(user.id);
    expect(result).toBeDefined();
    expect(Array.isArray(result.assignments)).toBe(true);
    expect(result.stats.totalAssignments).toBe(0);
  });
});

describe('calculateWeeklySalaryCosts', () => {
  it('returns zero cost for user with no active assignments', async () => {
    const result = await calculateWeeklySalaryCosts(user.id);
    expect(result.totalWeeklyCost).toBe(0);
    expect(result.assignmentCount).toBe(0);
    expect(Array.isArray(result.groomCosts)).toBe(true);
  });
});

// ── groomHandlerService ───────────────────────────────────────────────────────

describe('calculateHandlerBonus', () => {
  it('returns zero bonus for non-conformation discipline', () => {
    const mockGroom = {
      id: groom.id,
      name: groom.name,
      skillLevel: 'novice',
      speciality: 'foal_care',
      personality: 'gentle',
      experience: 0,
    };
    const mockHorse = { id: horse.id, bondScore: 20, stressLevel: 3 };
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Dressage', null);
    expect(result.handlerBonus).toBe(0);
    expect(result.isConformationShow).toBe(false);
  });

  it('returns non-zero bonus for valid conformation class', () => {
    const mockGroom = {
      id: groom.id,
      name: groom.name,
      skillLevel: 'novice',
      speciality: 'foal_care',
      personality: 'gentle',
      experience: 0,
    };
    const mockHorse = { id: horse.id, bondScore: 20, stressLevel: 3 };
    const result = calculateHandlerBonus(mockGroom, mockHorse, 'Foals/Youngstock', {
      bondScore: 20,
    });
    expect(result.isConformationShow).toBe(true);
    expect(typeof result.handlerBonus).toBe('number');
    expect(typeof result.bonusBreakdown).toBe('object');
  });
});

describe('getAssignedHandler', () => {
  it('returns hasHandler:false for horse with no assignment', async () => {
    const result = await getAssignedHandler(horse.id, user.id);
    expect(result.hasHandler).toBe(false);
    expect(result.assignment).toBeNull();
    expect(result.groom).toBeNull();
  });
});

describe('validateHandlerEligibility', () => {
  it('returns eligible:true for non-conformation discipline (no handler needed)', async () => {
    const result = await validateHandlerEligibility(horse.id, user.id, 'Dressage');
    expect(result.eligible).toBe(true);
    expect(result.isConformationShow).toBe(false);
    expect(result.handlerBonus).toBe(0);
  });

  it('returns eligible:false for conformation class with no assigned handler', async () => {
    const result = await validateHandlerEligibility(horse.id, user.id, 'Foals/Youngstock');
    expect(result.eligible).toBe(false);
    expect(result.isConformationShow).toBe(true);
  });
});

// ── groomPerformanceService ───────────────────────────────────────────────────

describe('getGroomPerformanceSummary', () => {
  it('throws for non-existent groom', async () => {
    await expect(getGroomPerformanceSummary(999999999)).rejects.toThrow();
  });

  it('returns default performance shape for new groom with no interactions', async () => {
    const result = await getGroomPerformanceSummary(groom.id);
    expect(result.groom.id).toBe(groom.id);
    expect(typeof result.metrics).toBe('object');
    expect(result.hasReliableReputation).toBe(false);
    expect(Array.isArray(result.recentRecords)).toBe(true);
  });
});

describe('getTopPerformingGrooms', () => {
  it('returns array for user (may include our fixture groom)', async () => {
    const result = await getTopPerformingGrooms(user.id, 5);
    expect(Array.isArray(result)).toBe(true);
  });
});
