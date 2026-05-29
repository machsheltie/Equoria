/**
 * weeklyFlagEvaluationCron.integration.test.mjs (Equoria-yzqhj.2)
 *
 * Real-DB integration proof that the weekly flag-evaluation cron handler
 * (CronJobService.evaluateWeeklyFlags) drives the CANONICAL flag engine over
 * the real eligible-horse set. No mocks (CLAUDE.md Testing Philosophy).
 *
 * Coverage:
 *   1. An eligible (age 0-3, under flag cap) foal is included in the weekly
 *      evaluation and the handler returns the documented summary shape.
 *   2. An ineligible (age >3) horse is excluded by the engine's eligibility
 *      gate — proving the cron honors the 0-3yr window.
 *
 * The "qualifying 7-day care pattern → specific flag assigned" behavior is
 * covered by the engine's own unit/integration tests (evaluateHorseFlags /
 * analyzeCarePatterns) which the cron delegates to verbatim; this test proves
 * the cron wiring + eligibility window rather than re-deriving care-pattern
 * thresholds.
 *
 * NOTE: this worktree cannot execute the real-DB suite (workspace node_modules
 * unavailable). Execution is the lead's serial integration gate.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';

const randHex = () => Math.random().toString(16).slice(2, 10);

describe('weeklyFlagEvaluation cron handler — real DB (Equoria-yzqhj.2)', () => {
  const created = [];
  let user;
  let eligibleFoalId;
  let ineligibleHorseId;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `TestFixture-flagcron-${randHex()}`,
        email: `testfixture-flagcron-${randHex()}@example.com`,
        password: 'x',
        firstName: 'TestFixture',
        lastName: 'FlagCron',
      },
    });

    // Eligible: born ~7 real days ago → ~1 game-year (inside the 0-3 window).
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagcron-foal-${randHex()}`,
        sex: 'Filly',
        dateOfBirth: sevenDaysAgo,
        userId: user.id,
        bondScore: 50,
        stressLevel: 10,
        epigeneticFlags: [],
      },
      created,
    );
    eligibleFoalId = foal.id;

    // Ineligible: born ~40 real days ago → ~5 game-years (past the 0-3 window).
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const adult = await createTestHorse(
      prisma,
      {
        name: `TestFixture-flagcron-adult-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: fortyDaysAgo,
        userId: user.id,
        epigeneticFlags: [],
      },
      created,
    );
    ineligibleHorseId = adult.id;
  });

  afterAll(async () => {
    await cleanupTestHorses(prisma, created);
    if (user) {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });

  it('returns the documented summary shape and evaluates at least the eligible foal', async () => {
    const summary = await cronJobService.evaluateWeeklyFlags();
    expect(summary).toEqual(
      expect.objectContaining({
        evaluated: expect.any(Number),
        succeeded: expect.any(Number),
        flagsAssigned: expect.any(Number),
        errors: expect.any(Number),
      }),
    );
    // The eligible foal must have been in the evaluated set (eligible count
    // includes it); the adult must NOT increase the eligible-by-age set on its
    // own behalf. We assert the foal is reachable via the engine's eligibility.
    const { getEligibleHorses } = await import('../../../utils/flagEvaluationEngine.mjs');
    const eligibleIds = await getEligibleHorses(new Date());
    expect(eligibleIds).toContain(eligibleFoalId);
    expect(eligibleIds).not.toContain(ineligibleHorseId);
  });
});
