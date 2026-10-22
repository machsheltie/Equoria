/**
 * Integration test: the live writers of Horse.epigeneticModifiers never erase
 * each other's work (Equoria-m1sf8).
 *
 * The two production writers (the player trait-discovery routes were removed
 * under Equoria-gu8jk; utils/traitDiscovery.revealTraits has no production
 * caller) are:
 *   A. the nightly foal-trait evaluation (services/jobs/impl/foalTraitEvaluation
 *      .evaluateFoalTraits), which appends revealed traits to positive /
 *      negative / hidden;
 *   B. the age-1 milestone in utils/horseAgingSystem.checkForMilestones (daily
 *      aging job and the admin age update), which records epigenetic_tags.
 * Both used to read the whole JSON object, change it in memory and write the
 * whole object back. Whichever wrote second erased the other: B's stale copy
 * dropped A's revealed traits, and A (which rebuilds the object from its three
 * arrays) dropped B's key even when nothing ran concurrently.
 *
 * HOW THE RACE IS FORCED: a second Prisma client holds the horse row
 * FOR UPDATE. A is started and observed queued on that lock (it has already
 * read the traits), then B is started and observed queued (it has read them
 * too). The barrier is released, so A writes first and B second, each from a
 * read taken before the other's write. Queue order is waited for, not slept for.
 *
 * Math.random is pinned to 0 so both writers certainly produce something; it
 * is the only thing replaced. Everything else is the real code against the
 * real database.
 */

import { describe, beforeAll, afterAll, afterEach, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma, { PrismaClient } from '../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../packages/database/dbPoolConfig.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import * as foalTraitImpl from '../services/jobs/impl/foalTraitEvaluation.mjs';
import { checkForMilestones } from '../utils/horseAgingSystem.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

const randHex = () => randomBytes(6).toString('hex');

const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

/** A service handle that re-enters the impl exactly as the CronJobService delegators do. */
function realService() {
  const service = {
    evaluateFoalTraits: f => foalTraitImpl.evaluateFoalTraits(service, f),
    advanceFoalDevelopmentDay: (id, day) => foalTraitImpl.advanceFoalDevelopmentDay(id, day),
    notifyTraitRevelation: (f, t, d) => foalTraitImpl.notifyTraitRevelation(f, t, d),
    logTraitRevelation: (...args) => foalTraitImpl.logTraitRevelation(...args),
    logAuditSummary: s => foalTraitImpl.logAuditSummary(s),
  };
  return service;
}

/** Hold the horse row FOR UPDATE on the barrier client until release(). */
async function armHorseBarrier(horseId) {
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });
  let failure = null;
  const barrier = { pid: null };
  const held = barrierClient
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        barrier.pid = Number(rows[0].pid);
        await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .catch(err => {
      failure = err;
    });
  barrier.release = async () => {
    release();
    await held;
    if (failure) {
      throw failure;
    }
  };
  await Promise.race([
    armed,
    held.then(() => {
      throw failure ?? new Error('barrier transaction ended before it was armed');
    }),
  ]);
  return barrier;
}

/** Resolves once `count` sessions are transitively blocked by the barrier session. */
async function waitForBlockedSessions(barrierPid, count, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await barrierClient.$queryRaw`
      WITH RECURSIVE chain AS (
        SELECT pid FROM pg_stat_activity WHERE pid = ${barrierPid}
        UNION
        SELECT a.pid
        FROM pg_stat_activity a
        JOIN chain c ON c.pid = ANY (pg_blocking_pids(a.pid))
      )
      SELECT (count(*) - 1)::int AS blocked FROM chain`;
    const seen = Number(rows[0].blocked);
    if (seen >= count) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${count} session(s) blocked by pid ${barrierPid}; saw ${seen}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

describe('INTEGRATION: epigeneticModifiers writers keep each other’s work (Equoria-m1sf8)', () => {
  let user;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-m1sf8-${randHex()}`,
        email: `tf-m1sf8-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    if (createdHorseIds.length) {
      cleanup.add(
        () => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: createdHorseIds } } }),
        'traitHistoryLog',
      );
      cleanup.add(
        () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdHorseIds } } }),
        'foalDevelopment',
      );
    }
    if (user) {
      cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    }
    cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
    if (user) {
      cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    }
    await cleanup.run();
    await barrierClient.$disconnect();
  }, 120000);

  async function makeFoal() {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-m1sf8-${randHex()}`,
        sex: 'Colt',
        // Lived ten whole days, so development day 2 is due tonight.
        dateOfBirth: gameCalendarDate(new Date(), -10),
        age: 0,
        userId: user.id,
        // Conditions under which day-2 positive traits are eligible.
        bondScore: 80,
        stressLevel: 10,
        // A task the age-1 milestone maps to an epigenetic tag.
        taskLog: { desensitization: 3 },
        daysGroomedInARow: 3,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay: 2 } });
    return foal;
  }

  const reload = foalId => prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });

  const revealedNames = mods => [...(mods?.positive ?? []), ...(mods?.negative ?? []), ...(mods?.hidden ?? [])];

  it('a reveal that commits while the age-1 milestone is writing survives it', async () => {
    const foal = await makeFoal();
    const snapshot = await reload(foal.id);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const barrier = await armHorseBarrier(foal.id);
    let evaluation;
    let milestone;
    try {
      // A first: it reads the traits inside its transaction, then queues.
      evaluation = foalTraitImpl.evaluateFoalTraits(realService(), snapshot);
      await waitForBlockedSessions(barrier.pid, 1);
      // B second: it reads the same traits, then queues behind A.
      milestone = checkForMilestones(foal.id, 0, 10);
      await waitForBlockedSessions(barrier.pid, 2);
    } finally {
      await barrier.release();
    }
    const [evalResult, milestoneResult] = await Promise.all([evaluation, milestone]);

    const revealed = revealedNames(evalResult.newTraits);
    expect(revealed.length).toBeGreaterThan(0);
    expect(milestoneResult.traitsAssigned.length).toBeGreaterThan(0);

    const after = await reload(foal.id);
    expect(revealedNames(after.epigeneticModifiers)).toEqual(expect.arrayContaining(revealed));
    expect(after.epigeneticModifiers.epigenetic_tags).toEqual(milestoneResult.traitsAssigned);
  }, 120000);

  it('a reveal written after the age-1 milestone keeps the milestone tags', async () => {
    const foal = await makeFoal();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const milestoneResult = await checkForMilestones(foal.id, 0, 10);
    expect(milestoneResult.traitsAssigned.length).toBeGreaterThan(0);

    const evalResult = await foalTraitImpl.evaluateFoalTraits(realService(), await reload(foal.id));
    const revealed = revealedNames(evalResult.newTraits);
    expect(revealed.length).toBeGreaterThan(0);

    const after = await reload(foal.id);
    expect(after.epigeneticModifiers.epigenetic_tags).toEqual(milestoneResult.traitsAssigned);
    expect(revealedNames(after.epigeneticModifiers)).toEqual(expect.arrayContaining(revealed));
  }, 120000);
});
