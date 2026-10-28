/**
 * No scheduled job turns a foal's care pattern into a trait (Equoria-koxep).
 *
 * Owner rulings 2026-10-27 (q112-q118) and 2026-10-28 (q139): traits change only
 * through the nightly grooming-days reveal ladder in a foal's first 21 days
 * (modules/traits/services/traitRevealEngine.mjs). The weekly flag job
 * (Mondays 00:30) used to run the care-pattern evaluator over every horse under
 * 3, and its aloof rule fired on a foal nobody had touched: no interactions,
 * bond 0. That job is retired, and the admin-only POST /api/flags/batch-evaluate
 * went too (owner ruling 2026-10-28, q203), so nothing runs the evaluator.
 *
 * Real database for the foal; the registry check runs every scheduled job's
 * thunk against a recording stub, so no job does any work.
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import cronJobRegistry from '../../../services/jobs/index.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { runNightlyTraitReveal } from '../services/traitRevealEngine.mjs';

const RUN = randomBytes(5).toString('hex');

/** The method each scheduled job's thunk calls on the cron service. */
function scheduledMethods() {
  const called = [];
  const stub = new Proxy(
    {},
    {
      get: (_target, name) => () => {
        called.push(String(name));
        return Promise.resolve();
      },
    },
  );
  for (const job of cronJobRegistry) {
    job.run(stub);
  }
  return called;
}

let user;
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `tf-untouched-${RUN}`,
      email: `tf-untouched-${RUN}@example.com`,
      password: 'x',
      firstName: 'Test',
      lastName: 'Fixture',
    },
  });
}, 60_000);

afterAll(async () => {
  const cleanup = createCleanupTracker();
  const ids = [...horseIds];
  cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: ids } } }), 'traitHistoryLog');
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: ids } } }), 'foalDevelopment');
  cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id ?? 'none' } }), 'user');
  await cleanup.run();
}, 60_000);

describe('care patterns never write traits (Equoria-koxep)', () => {
  it('no scheduled job runs the weekly care-pattern flag evaluator', () => {
    const methods = scheduledMethods();
    expect(methods).not.toContain('evaluateWeeklyFlags');
    expect(cronJobRegistry.map(j => j.jobName)).not.toContain('weeklyFlagEvaluation');
    expect(cronJobService.evaluateWeeklyFlags).toBeUndefined();
  });

  it('an untouched foal that carries no trait comes out of every nightly trait pass unchanged', async () => {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-untouched-${RUN}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -10),
        age: 0,
        userId: user.id,
        bondScore: 0,
        epigeneticFlags: [],
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      horseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay: 0 } });

    // Every roll wins: if any pass could mint a trait, it would.
    await runNightlyTraitReveal({ horseIds: [foal.id], rng: () => 0 });
    const loaded = await prisma.horse.findUnique({
      where: { id: foal.id },
      include: { foalDevelopment: true },
    });
    await cronJobService.evaluateFoalTraits(loaded);

    const after = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(after.epigeneticFlags).toEqual([]);
    expect(after.epigeneticModifiers.positive).toEqual([]);
    expect(after.epigeneticModifiers.negative).toEqual([]);
    expect(after.epigeneticModifiers.hidden).toEqual([]);
    expect(await prisma.traitHistoryLog.count({ where: { horseId: foal.id } })).toBe(0);
  }, 60_000);
});
