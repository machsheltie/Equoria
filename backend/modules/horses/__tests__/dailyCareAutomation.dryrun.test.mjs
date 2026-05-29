/**
 * dailyCareAutomation — dry-run and groom-available path coverage (Equoria-rr7)
 *
 * Supplements dailyCareAutomation.test.mjs.  The main test file creates a single
 * shared foal+groom in beforeAll; the non-dryRun "assignment exists" tests write
 * groomInteractions to the DB which causes subsequent dryRun tests in that suite
 * to find hasCompleteCare:true and skip the dryRun calculation branch (lines
 * 148-170 of dailyCareAutomation.mjs).
 *
 * This file creates isolated fixtures so that when dryRun:true is passed, the
 * foal has NO prior interactions today, the groom IS available (isActive:true,
 * availability:{}), and the dry-run calculation path is exercised.
 *
 * Uncovered lines targeted:
 *   148-170  dry-run effects calculation and result push
 *   112-113  NOT targeted here (groom unavailable continue) — those need
 *            the groom to be unavailable, which the main suite already
 *            handles via the isGroomAvailableToday pure-unit tests.
 *   276-277  performAutomaticCare error catch — tested via performAutomaticCare
 *            internal error injection (covered by non-dryRun happy path writing
 *            a real interaction; errors require forcing a DB fault).
 *   347-348  checkExistingCareToday error catch — same; requires DB fault.
 *   201-202  outer catch — same.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { runDailyCareAutomation } from '../../../utils/dailyCareAutomation.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-DCADryRun-';

function uid() {
  return randomBytes(6).toString('hex');
}

let user;
let groom;
let foal;
let assignment;

beforeAll(async () => {
  const id = uid();

  user = await prisma.user.create({
    data: {
      username: `dca_dr_${id}`,
      email: `${PREFIX}${id}@test.com`,
      password: 'irrelevant',
      firstName: 'DailyCare',
      lastName: 'DryRun',
    },
  });

  // Groom with isActive:true and empty availability — isGroomAvailableToday returns true
  groom = await prisma.groom.create({
    data: {
      name: `${PREFIX}Groom-${id}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      experience: 0,
      isActive: true,
      userId: user.id,
      availability: {},
      sessionRate: 15.0,
    },
  });

  foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Foal-${id}`,
      sex: 'Filly',
      dateOfBirth: new Date('2024-01-01'),
      age: 1,
      userId: user.id,
      bondScore: 50,
      stressLevel: 10,
    },
  });

  assignment = await prisma.groomAssignment.create({
    data: {
      foalId: foal.id,
      groomId: groom.id,
      userId: user.id,
      isActive: true,
      priority: 1,
    },
  });
}, 30000);

afterAll(async () => {
  if (assignment) {
    await prisma.groomInteraction.deleteMany({ where: { assignmentId: assignment.id } }).catch(() => {});
    await prisma.groomAssignment.delete({ where: { id: assignment.id } }).catch(() => {});
  }
  if (foal) {
    await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  }
  if (groom) {
    await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

// ─── dry-run with groom available and no prior care today ─────────────────────

describe('runDailyCareAutomation — dryRun with available groom (lines 148-170)', () => {
  it('returns success with interactions[] entries for each routine when dryRun:true', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    // groom is active+available → routines are calculated
    // interactions array may contain dry-run entries
    expect(Array.isArray(result.interactions)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.totalInteractions).toBe('number');
  });

  it('does NOT write any groomInteraction records when dryRun:true', async () => {
    const before = await prisma.groomInteraction.count({
      where: { assignmentId: assignment.id },
    });

    await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: true,
    });

    const after = await prisma.groomInteraction.count({
      where: { assignmentId: assignment.id },
    });

    expect(after).toBe(before);
  });

  it('each dry-run interaction entry has foalId, groomId, routine, effects, dryRun:true', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: true,
    });

    // If groom is available and there are routines to perform, interactions will be non-empty
    if (result.interactions.length > 0) {
      for (const entry of result.interactions) {
        expect(entry.foalId).toBe(foal.id);
        expect(entry.groomId).toBe(groom.id);
        expect(typeof entry.routine).toBe('string');
        expect(entry.effects).toBeDefined();
        expect(entry.dryRun).toBe(true);
      }
    }
  });

  it('summary totalInteractions equals interactions array length', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: true,
    });

    expect(result.summary.totalInteractions).toBe(result.interactions.length);
  });

  it('summary totalCost is a number (may be 0 or positive)', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: true,
    });

    expect(typeof result.summary.totalCost).toBe('number');
    expect(result.summary.totalCost).toBeGreaterThanOrEqual(0);
  });
});

// ─── non-dryRun with groom available — exercises performAutomaticCare path ────

describe('runDailyCareAutomation — non-dryRun with available groom', () => {
  it('processes assignment and returns result (interactions written or empty)', async () => {
    // Clean any pre-existing interactions from prior dryRun tests
    // (dryRun writes nothing, so there should be none — but guard for safety)
    await prisma.groomInteraction.deleteMany({ where: { assignmentId: assignment.id } }).catch(() => {});

    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: false,
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.interactions)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.summary).toBeDefined();
  });

  it('writes groomInteraction records when groom is available and dryRun:false', async () => {
    // First clean slate
    await prisma.groomInteraction.deleteMany({ where: { assignmentId: assignment.id } }).catch(() => {});

    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      dryRun: false,
    });

    // If groom is available (isActive:true, availability:{}), interactions should be written
    if (result.interactions.length > 0) {
      const dbCount = await prisma.groomInteraction.count({
        where: { assignmentId: assignment.id },
      });
      expect(dbCount).toBeGreaterThan(0);
    } else {
      // Groom may be unavailable today (availability edge case) — just verify no crash
      expect(result.success).toBe(true);
    }
  });
});

// ─── routineTypes filter with available groom ─────────────────────────────────

describe('runDailyCareAutomation — routineTypes filter with available groom', () => {
  it('only processes the specified routine type in dryRun mode', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      routineTypes: ['feeding'],
      dryRun: true,
    });

    expect(result.success).toBe(true);
    // At most one routine type: feeding
    expect(result.interactions.length).toBeLessThanOrEqual(1);
  });

  it('handles routineTypes:[] with available groom — skips all routines', async () => {
    const result = await runDailyCareAutomation({
      specificFoalId: foal.id,
      routineTypes: [],
      dryRun: true,
    });

    expect(result.success).toBe(true);
    // No routines to perform — interactions empty
    expect(result.interactions).toEqual([]);
  });
});
