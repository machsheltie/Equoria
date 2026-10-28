/**
 * groomAssignmentService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * Pure-path tests (no DB fixture needed): getUserAssignments, ASSIGNMENT_CONFIG.
 *
 * DB-fixture branch coverage:
 *   getGroomAssignmentLimits — skillLevel fallback to 2 (pure), real groom path
 *   validateAssignmentEligibility — groom not found, horse not found, groom inactive, already assigned, at limit
 *   createAssignment — valid path, replacePrimary=true, NotFoundError for missing horse
 *   removeAssignment — not found, ownership mismatch, already inactive (no notes: Equoria-ekrab)
 *   getUserAssignments — no assignments (averageAssignmentsPerGroom=0 branch), with assignments + filters
 * calculateWeeklySalaryCosts went with the duplicate salary-costs and dashboard
 * lookups that read it (Equoria-a7f1p, owner ruling q151).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  ASSIGNMENT_CONFIG,
  getGroomAssignmentLimits,
  validateAssignmentEligibility,
  createAssignment,
  removeAssignment,
  getUserAssignments,
} from '../services/groomAssignmentService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Static import: under resetModules a per-test dynamic import yields a FRESH
// NotFoundError class, so instanceof against the service's thrown instance
// fails despite identical names (2026-08-18 hygiene-set migration).
import NotFoundError from '../../../errors/NotFoundError.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── Pure-path tests ───────────────────────────────────────────────────────────

describe('getUserAssignments — non-existent user', () => {
  it('returns empty assignments and zero stats for non-existent user', async () => {
    const result = await getUserAssignments('00000000-0000-0000-0000-000000000099');
    expect(result.assignments).toHaveLength(0);
    // averageAssignmentsPerGroom: Object.keys(assignmentsByGroom).length = 0 → ternary else branch = 0
    expect(result.stats.averageAssignmentsPerGroom).toBe(0);
    expect(result.stats.groomsWithAssignments).toBe(0);
  });
});

// Equoria-95yrv (owner, 2026-09-14): one cap and one rate for every groom. The
// per-skill caps (2/3/4/5) contradicted the ten-horse ruling outright, and the
// per-skill pay table they sat beside was never charged by anything.
describe('ASSIGNMENT_CONFIG export is correctly shaped', () => {
  // The owner ruling 2026-10-26 (q68) raised the cap from ten to twenty.
  // Owner ruling 2026-10-28 (q228) removed the per-horse rate: a groom costs their
  // star level's price, shown on the groom.
  it('publishes the twenty-horse cap, no per-horse rate, and nothing per-skill', () => {
    expect(ASSIGNMENT_CONFIG.MAX_HORSES_PER_GROOM).toBe(20);
    expect(ASSIGNMENT_CONFIG).not.toHaveProperty('FEE_PER_HORSE_PER_WEEK');
    expect(ASSIGNMENT_CONFIG).not.toHaveProperty('MAX_ASSIGNMENTS_BY_SKILL');
    expect(ASSIGNMENT_CONFIG).not.toHaveProperty('WEEKLY_SALARY_BY_SKILL');
    expect(ASSIGNMENT_CONFIG).not.toHaveProperty('SALARY_MULTIPLIERS');
  });
});

// ── DB fixture branch coverage ────────────────────────────────────────────────

describe('groomAssignmentService — DB fixture branch coverage (Equoria-jkht)', () => {
  let gasUser;
  let gasUser2; // second user for ownership mismatch tests
  let gasGroom; // active novice groom (max 2 assignments)
  let gasGroomInactive; // isActive=false → validateAssignmentEligibility 'Groom is not active'
  let gasHorse;
  let _gasHorse2; // second horse for additional assignments
  let gasHorse3; // third horse for the replace-existing test
  const gasCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gasUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gas-${ts}-${rand()}@test.com`,
        username: `gas${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GAS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    gasUser2 = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gas2-${ts}-${rand()}@test.com`,
        username: `gas2${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GAS2',
        lastName: 'Tester',
        money: 1000,
      },
    });

    gasGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GAS-Groom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        isActive: true,
        userId: gasUser.id,
      },
    });

    gasGroomInactive = await prisma.groom.create({
      data: {
        name: `TestFixture-GAS-GroomInactive-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        isActive: false,
        userId: gasUser.id,
      },
    });

    gasHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });

    _gasHorse2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-Horse2-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });

    gasHorse3 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-Horse3-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    // Equoria-1ohys: fail-loud, scoped cleanup. Each delete is scoped (by
    // userId or TestFixture- name-prefix) and registered on the tracker so a
    // cleanup failure REDS the suite instead of leaking rows into the canonical
    // DB (CLAUDE.md §2). FK order: groomAssignment (child) before groom/horse
    // before user (Horse.userId / Groom.userId Restrict).
    gasCleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: gasUser?.id } }), 'assignments-gasUser');
    gasCleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { userId: gasUser2?.id } }),
      'assignments-gasUser2',
    );
    gasCleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GAS-' } } }), 'grooms');
    gasCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GAS-' } } }), 'horses');
    gasCleanup.add(() => prisma.user.delete({ where: { id: gasUser?.id } }), 'gasUser');
    gasCleanup.add(() => prisma.user.delete({ where: { id: gasUser2?.id } }), 'gasUser2');
    await gasCleanup.run();
  }, 30000);

  // ── getGroomAssignmentLimits ──────────────────────────────────────────────

  it('getGroomAssignmentLimits: a novice groom may take twenty horses, like every groom', async () => {
    const limits = await getGroomAssignmentLimits(gasGroom);
    expect(limits.maxAssignments).toBe(20);
    expect(limits.currentAssignments).toBe(0);
    expect(limits.availableSlots).toBe(20);
    expect(limits.canTakeMore).toBe(true);
  });

  it('getGroomAssignmentLimits: an unrecognised skillLevel changes nothing', async () => {
    // Equoria-95yrv: there is no per-skill table left to fall back through.
    const fakeGroom = { id: 0, skillLevel: 'unknown' };
    const limits = await getGroomAssignmentLimits(fakeGroom);
    expect(limits.maxAssignments).toBe(20);
  });

  // ── validateAssignmentEligibility ────────────────────────────────────────

  it('validateAssignmentEligibility: groom not found (non-existent groomId)', async () => {
    const result = await validateAssignmentEligibility(999999999, gasHorse.id, gasUser.id);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Groom not found');
    expect(result.groom).toBeNull();
  });

  it('validateAssignmentEligibility: horse not found (non-existent horseId)', async () => {
    const result = await validateAssignmentEligibility(gasGroom.id, 999999999, gasUser.id);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Horse not found');
    expect(result.horse).toBeNull();
  });

  it('validateAssignmentEligibility: groom inactive → Groom is not active error', async () => {
    const result = await validateAssignmentEligibility(gasGroomInactive.id, gasHorse.id, gasUser.id);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Groom is not active');
  });

  it('validateAssignmentEligibility: valid groom + horse → valid=true', async () => {
    const result = await validateAssignmentEligibility(gasGroom.id, gasHorse.id, gasUser.id);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.groom.id).toBe(gasGroom.id);
    expect(result.horse.id).toBe(gasHorse.id);
  });

  // ── createAssignment ──────────────────────────────────────────────────────

  it('createAssignment: horse not found → throws NotFoundError', async () => {
    // non-existent horseId → horse=null → NotFoundError (not general Error)
    await expect(createAssignment(gasGroom.id, 999999999, gasUser.id)).rejects.toThrow(NotFoundError);
  });

  it('createAssignment: inactive groom + valid horse → throws general Error (line 169, Equoria-rr7)', async () => {
    // gasGroomInactive.isActive=false → validation.valid=false, validation.horse is set → line 169 throw new Error(...)
    await expect(createAssignment(gasGroomInactive.id, gasHorse.id, gasUser.id)).rejects.toThrow('Groom is not active');
  });

  it('createAssignment: valid path → returns success with assignment', async () => {
    const result = await createAssignment(gasGroom.id, gasHorse.id, gasUser.id);
    expect(result.success).toBe(true);
    expect(result.assignment).toBeDefined();
    expect(result.assignment.groomId).toBe(gasGroom.id);
    expect(result.assignment.foalId).toBe(gasHorse.id);
    expect(typeof result.message).toBe('string');
  });

  it('validateAssignmentEligibility: already assigned → error', async () => {
    // gasGroom is now assigned to gasHorse (from previous test)
    const result = await validateAssignmentEligibility(gasGroom.id, gasHorse.id, gasUser.id);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Groom is already assigned to this horse');
  });

  // Owner ruling 2026-10-28 (Equoria-ekrab): no priority level. "Replace existing
  // assignment" ends the horse's active groom assignments. Old contract: it ended
  // only priority-1 assignments, and only when the new one was priority 1.
  it('createAssignment: replacePrimary=true ends the existing assignment', async () => {
    // A DIFFERENT groom: the same groom fails validation (already assigned).
    const ts = Date.now();
    const masterGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GAS-Master-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'master',
        isActive: true,
        userId: gasUser.id,
      },
    });
    const masterGroom2 = await prisma.groom.create({
      data: {
        name: `TestFixture-GAS-Master2-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'master',
        isActive: true,
        userId: gasUser.id,
      },
    });
    await createAssignment(masterGroom.id, gasHorse3.id, gasUser.id);
    // Replacing ends masterGroom's assignment, then creates masterGroom2's.
    const result = await createAssignment(masterGroom2.id, gasHorse3.id, gasUser.id, {
      replacePrimary: true,
    });
    expect(result.success).toBe(true);
    // Verify masterGroom's assignment was deactivated
    const oldAssignment = await prisma.groomAssignment.findFirst({
      where: { groomId: masterGroom.id, foalId: gasHorse3.id },
    });
    expect(oldAssignment.isActive).toBe(false);
  });

  // ── removeAssignment ──────────────────────────────────────────────────────

  it('removeAssignment: assignment not found → throws', async () => {
    await expect(removeAssignment(999999999, gasUser.id)).rejects.toThrow('Assignment not found');
  });

  // Equoria-ekrab: assignments carry no notes; the removal reason is logged only.
  // Old contract: the reason was written into the assignment's notes.
  it('removeAssignment: valid removal ends the assignment', async () => {
    const activeAssignment = await prisma.groomAssignment.findFirst({
      where: { groomId: gasGroom.id, foalId: gasHorse.id, isActive: true },
    });
    const result = await removeAssignment(activeAssignment.id, gasUser.id, 'Test removal');
    expect(result.success).toBe(true);
    expect(result.assignment.isActive).toBe(false);
    expect(result.assignment.notes ?? null).toBeNull();
  });

  it('removeAssignment: already inactive → throws', async () => {
    const inactiveAssignment = await prisma.groomAssignment.findFirst({
      where: { groomId: gasGroom.id, foalId: gasHorse.id, isActive: false },
    });
    await expect(removeAssignment(inactiveAssignment.id, gasUser.id)).rejects.toThrow('Assignment is already inactive');
  });

  // ── getUserAssignments ────────────────────────────────────────────────────

  it('getUserAssignments: returns assignments with correct stats', async () => {
    const result = await getUserAssignments(gasUser.id);
    expect(Array.isArray(result.assignments)).toBe(true);
    expect(typeof result.stats.totalAssignments).toBe('number');
    expect(typeof result.stats.activeAssignments).toBe('number');
    // groomsWithAssignments > 0 → averageAssignmentsPerGroom ternary if-branch
    if (result.stats.groomsWithAssignments > 0) {
      expect(result.stats.averageAssignmentsPerGroom).toBeGreaterThan(0);
    }
  });

  it('getUserAssignments: includeInactive=true returns all assignments', async () => {
    const activeOnly = await getUserAssignments(gasUser.id, { includeInactive: false });
    const withInactive = await getUserAssignments(gasUser.id, { includeInactive: true });
    expect(withInactive.stats.totalAssignments).toBeGreaterThanOrEqual(activeOnly.stats.totalAssignments);
  });

  it('getUserAssignments: groomId filter narrows results', async () => {
    const result = await getUserAssignments(gasUser.id, { groomId: gasGroom.id });
    result.assignments.forEach(a => {
      expect(a.groom.id).toBe(gasGroom.id);
    });
  });

  // ── validateAssignmentEligibility — at-limit branch (line 117, Equoria-rr7) ─

  it('validateAssignmentEligibility: canTakeMore=false when groom is at max assignments (line 117)', async () => {
    // Equoria-95yrv: a fresh groom, horses to fill the cap, then one more (the owner ruling 2026-10-26 (q68) raised the cap from ten to twenty).
    const ts = Date.now();
    const limitGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GAS-LimitGroom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        isActive: true,
        userId: gasUser.id,
      },
    });
    const lh1 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-LH1-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });
    const lh2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-LH2-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });
    const lh3 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GAS-LH3-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gasUser.id,
      },
    });

    // Equoria-95yrv: the cap is TEN horses for every groom, not two for a novice,
    // so filling it takes ten. The eleventh is the one that must be refused, and
    // the refusal is now written for a player rather than for a log.
    const filler = [lh1, lh2];
    for (let i = filler.length; i < 20; i++) {
      const extra = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-GAS-LH-fill-${i}-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date(),
          age: 0,
          userId: gasUser.id,
        },
      });
      filler.push(extra);
    }
    for (const horse of filler) {
      await createAssignment(limitGroom.id, horse.id, gasUser.id);
    }

    // Now validate the assignment past the cap — it must be refused.
    const result = await validateAssignmentEligibility(limitGroom.id, lh3.id, gasUser.id);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => /already caring for 20 horses/i.test(e))).toBe(true);
  });

  // ── removeAssignment — ownership mismatch branch (line 271, Equoria-rr7) ────

  it('removeAssignment: ownership mismatch → throws Assignment not found (line 271)', async () => {
    // Find any active assignment belonging to gasUser; try to remove with gasUser2.id
    const activeAssignment = await prisma.groomAssignment.findFirst({
      where: { userId: gasUser.id, isActive: true },
    });
    if (activeAssignment) {
      // gasUser2 owns neither the groom nor the horse → ownership mismatch branch
      await expect(removeAssignment(activeAssignment.id, gasUser2.id)).rejects.toThrow('Assignment not found');
    } else {
      // Skip if no active assignments left — create a fresh one
      const ts = Date.now();
      const omGroom = await prisma.groom.create({
        data: {
          name: `TestFixture-GAS-OMGroom-${ts}`,
          speciality: 'general',
          personality: 'gentle',
          skillLevel: 'novice',
          isActive: true,
          userId: gasUser.id,
        },
      });
      const omHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-GAS-OMHorse-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date(),
          age: 0,
          userId: gasUser.id,
        },
      });
      const newAssignment = await prisma.groomAssignment.create({
        data: { groomId: omGroom.id, foalId: omHorse.id, userId: gasUser.id, isActive: true },
      });
      await expect(removeAssignment(newAssignment.id, gasUser2.id)).rejects.toThrow('Assignment not found');
    }
  });
});
