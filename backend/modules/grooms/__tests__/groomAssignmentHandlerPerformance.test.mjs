/**
 * groomAssignmentService, groomHandlerService unit tests
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
} from '../services/groomAssignmentService.mjs';
import { getAssignedHandler } from '../services/groomHandlerService.mjs';
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
      speciality: 'foalCare',
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
  it('returns the twenty-horse cap for a groom with no assignments', async () => {
    // Equoria-95yrv: one cap for every groom, whatever their skill; owner q68 (2026-10-26) set it to 20.
    const result = await getGroomAssignmentLimits({ id: groom.id, skillLevel: 'novice' });
    expect(result.maxAssignments).toBe(20);
    expect(result.currentAssignments).toBe(0);
    expect(result.availableSlots).toBe(20);
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

// ── groomHandlerService ───────────────────────────────────────────────────────

// Owner ruling 2026-10-28 q154 (Equoria-4fa7s): a show handler is the horse's
// groom and any groom may handle in any class. Old contract:
// calculateHandlerBonus and validateHandlerEligibility judged a groom per
// conformation class and priced per-discipline handler bonuses; they were
// removed with that ruling, and so were their tests here.

describe('getAssignedHandler', () => {
  it('returns hasHandler:false for horse with no assignment', async () => {
    const result = await getAssignedHandler(horse.id, user.id);
    expect(result.hasHandler).toBe(false);
    expect(result.assignment).toBeNull();
    expect(result.groom).toBeNull();
  });
});
