/**
 * Integration test (Equoria-3yxz): processFoalMilestoneEvaluations writes
 * MilestoneTraitLog rows automatically as foals cross developmental-window
 * boundaries — without requiring a manual POST /api/v1/milestones/evaluate-milestone.
 *
 * Pre-fix: MilestoneTraitLog stayed empty unless the user/admin explicitly
 * called the evaluate endpoint. The cron only ran processHorseBirthdays.
 *
 * Post-fix:
 *   - A foal whose developmentalWindows range has ended gets a
 *     MilestoneTraitLog row written for the matching milestoneType the night
 *     after (owner ruling 2026-11-03, q352, Equoria-gveno; it was written on
 *     the window's first day before that ruling).
 *   - Re-running the pass does NOT create duplicate rows.
 *   - A horse older than 1095 days (past the foal window cap) is skipped.
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { processFoalMilestoneEvaluations } from '../../../utils/horseAgingSystem.mjs';
import { developmentalWindows, milestoneTypes } from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const TAG = `3yxz-${randomBytes(4).toString('hex')}`;

/**
 * Build a dateOfBirth that places a foal at exactly `ageInDays` Eastern game
 * days old (the job's day model), whatever the hour the test runs.
 */
function dobForAge(ageInDays) {
  return gameCalendarDate(new Date(), -ageInDays);
}

describe('Equoria-3yxz: processFoalMilestoneEvaluations auto-writes MilestoneTraitLog', () => {
  const cleanup = createCleanupTracker();
  let user;
  let socializationFoal; // day 8 → SOCIALIZATION window (1-7) has just ended
  let trustHandlingFoal; // day 22 → trustHandling window (15-21) has just ended
  let agedHorse; // age 1200d → past the 1095-day cap, must be skipped

  beforeAll(async () => {
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
    cleanup.add(() => (user ? prisma.user.deleteMany({ where: { id: user.id } }) : undefined), 'user');

    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: '3YXZ',
        money: 5000,
      },
    });

    socializationFoal = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${TAG}-SocializationFoal`,
        sex: 'colt',
        dateOfBirth: dobForAge(8),
        age: 0,
        bondScore: 50,
        userId: user.id,
      }),
    });

    trustHandlingFoal = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${TAG}-TrustHandlingFoal`,
        sex: 'filly',
        dateOfBirth: dobForAge(22),
        age: 0,
        bondScore: 50,
        userId: user.id,
      }),
    });

    agedHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${TAG}-AgedHorse`,
        sex: 'colt',
        dateOfBirth: dobForAge(1200),
        age: 4,
        bondScore: 50,
        userId: user.id,
      }),
    });
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('writes MilestoneTraitLog for each foal whose developmental window has just ended', async () => {
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
    // day 8 → SOCIALIZATION window (1-7d) ended last night
    const expectedSocialization = milestoneTypes.SOCIALIZATION;
    expect(socializationLogs.map(l => l.milestoneType)).toContain(expectedSocialization);
    const window = developmentalWindows[expectedSocialization];
    expect(window.end).toBe(7);

    const trustLogs = await prisma.milestoneTraitLog.findMany({
      where: { horseId: trustHandlingFoal.id },
    });
    expect(trustLogs.length).toBeGreaterThanOrEqual(1);
    expect(trustLogs.map(l => l.milestoneType)).toContain(milestoneTypes.trustHandling);
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
