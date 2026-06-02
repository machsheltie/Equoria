/**
 * Integration test (Equoria-3yxz): processFoalMilestoneEvaluations writes
 * MilestoneTraitLog rows automatically as foals cross developmental-window
 * boundaries — without requiring a manual POST /api/v1/milestones/evaluate-milestone.
 *
 * Pre-fix: MilestoneTraitLog stayed empty unless the user/admin explicitly
 * called the evaluate endpoint. The cron only ran processHorseBirthdays.
 *
 * Post-fix:
 *   - A foal whose age (in days) falls inside a DEVELOPMENTAL_WINDOWS range
 *     gets a MilestoneTraitLog row written for the matching milestoneType.
 *   - Re-running the pass does NOT create duplicate rows.
 *   - A horse older than 1095 days (past the foal window cap) is skipped.
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processFoalMilestoneEvaluations } from '../../../utils/horseAgingSystem.mjs';
import { DEVELOPMENTAL_WINDOWS, MILESTONE_TYPES } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TAG = `3yxz-${randomBytes(4).toString('hex')}`;

/**
 * Build a dateOfBirth that places a foal at exactly `ageInDays` old.
 */
function dobForAge(ageInDays) {
  const d = new Date();
  d.setDate(d.getDate() - ageInDays);
  return d;
}

describe('Equoria-3yxz: processFoalMilestoneEvaluations auto-writes MilestoneTraitLog', () => {
  const cleanup = createCleanupTracker();
  let user;
  let socializationFoal; // age 3 → SOCIALIZATION window (1-7)
  let trustHandlingFoal; // age 18 → TRUST_HANDLING window (15-21)
  let agedHorse; // age 1200d → past the 1095-day cap, must be skipped

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: '3YXZ',
        money: 5000,
      },
    });

    socializationFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-SocializationFoal`,
        sex: 'colt',
        dateOfBirth: dobForAge(3),
        age: 0,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });

    trustHandlingFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-TrustHandlingFoal`,
        sex: 'filly',
        dateOfBirth: dobForAge(18),
        age: 0,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });

    agedHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-AgedHorse`,
        sex: 'colt',
        dateOfBirth: dobForAge(1200),
        age: 4,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });

    // FK-order scoped cleanup (Equoria-n7qa3). All three horses are owned by
    // `user` and Horse.userId is onDelete:Restrict (schema:282), so the horse
    // rows (and their milestone logs) must be deleted BEFORE the user. Tasks
    // read the live ids at run() time; fail-loud so a real leak reds afterAll.
    const horseIds = () => [socializationFoal?.id, trustHandlingFoal?.id, agedHorse?.id].filter(Boolean);
    cleanup.add(
      () => prisma.milestoneTraitLog.deleteMany({ where: { horseId: { in: horseIds() } } }),
      'milestoneTraitLog',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds() } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('writes MilestoneTraitLog for each foal currently inside a developmental window', async () => {
    // Sanity: no rows exist beforehand.
    const pre = await prisma.milestoneTraitLog.count({
      where: { horseId: { in: [socializationFoal.id, trustHandlingFoal.id] } },
    });
    expect(pre).toBe(0);

    const result = await processFoalMilestoneEvaluations({
      // The pass searches by dateOfBirth >= last 30 days; both foals match.
    });

    expect(result.milestonesEvaluated).toBeGreaterThanOrEqual(2);

    const socializationLogs = await prisma.milestoneTraitLog.findMany({
      where: { horseId: socializationFoal.id },
    });
    expect(socializationLogs.length).toBeGreaterThanOrEqual(1);
    // age 3d → SOCIALIZATION window (1-7d)
    const expectedSocialization = MILESTONE_TYPES.SOCIALIZATION;
    expect(socializationLogs.map(l => l.milestoneType)).toContain(expectedSocialization);
    const window = DEVELOPMENTAL_WINDOWS[expectedSocialization];
    expect(window.start).toBeLessThanOrEqual(3);
    expect(window.end).toBeGreaterThanOrEqual(3);

    const trustLogs = await prisma.milestoneTraitLog.findMany({
      where: { horseId: trustHandlingFoal.id },
    });
    expect(trustLogs.length).toBeGreaterThanOrEqual(1);
    expect(trustLogs.map(l => l.milestoneType)).toContain(MILESTONE_TYPES.TRUST_HANDLING);
  }, 60000);

  it('is idempotent — re-running the pass does not duplicate rows', async () => {
    const before = await prisma.milestoneTraitLog.count({
      where: { horseId: { in: [socializationFoal.id, trustHandlingFoal.id] } },
    });
    expect(before).toBeGreaterThanOrEqual(2);

    // Scope the re-run to THIS suite's foals via specificHorseId.
    // processFoalMilestoneEvaluations({}) is a GLOBAL pass over every foal <30d
    // old; the canonical DB holds other suites' foals (CLAUDE.md Rule 3 — a test
    // must not assume its data dominates), so a global milestonesEvaluated count
    // is polluted. Per-foal scoping proves the real idempotency contract.
    for (const foal of [socializationFoal, trustHandlingFoal]) {
      const second = await processFoalMilestoneEvaluations({ specificHorseId: foal.id });
      // Already evaluated on the first pass → this foal's milestones are skipped.
      expect(second.milestonesEvaluated).toBe(0);
      expect(second.milestonesSkipped).toBeGreaterThanOrEqual(1);
    }

    const after = await prisma.milestoneTraitLog.count({
      where: { horseId: { in: [socializationFoal.id, trustHandlingFoal.id] } },
    });
    expect(after).toBe(before);
  }, 60000);

  it('does not write a MilestoneTraitLog for horses past the foal cap (>= 1095 days)', async () => {
    // The aged horse was born 1200 days ago; the 30-day birth-cutoff filter
    // in processFoalMilestoneEvaluations already excludes it, so no row should
    // ever exist for it.
    const logs = await prisma.milestoneTraitLog.findMany({
      where: { horseId: agedHorse.id },
    });
    expect(logs).toHaveLength(0);
  }, 30000);
});
