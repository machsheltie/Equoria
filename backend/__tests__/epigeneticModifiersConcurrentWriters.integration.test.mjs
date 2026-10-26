/**
 * Integration test: the live writers of Horse.epigeneticModifiers never erase
 * each other's work (Equoria-m1sf8).
 *
 * The two production writers (the player trait-discovery routes were removed
 * under Equoria-gu8jk; utils/traitDiscovery.revealTraits has no production
 * caller) are:
 *   A. the trait reveal engine (modules/traits/services/traitRevealEngine
 *      .evaluateHorseTraitReveal), which moves carried traits between positive /
 *      negative / hidden. (Owner ruling 2026-10-26, q98, Equoria-2d55z: it
 *      replaced the nightly foal-trait evaluation, which appended invented
 *      traits and was writer A here before.)
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
 * Math.random is pinned to 0 so the milestone certainly produces tags; the
 * engine gets a winning rng, complete test settings and an empty grooming
 * history (its injectable reader), so it certainly reveals. Everything else is
 * the real code against the real database.
 */

import { describe, beforeAll, afterAll, afterEach, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock, horseRowLock } from './helpers/rowLockBarrier.mjs';
import { evaluateHorseTraitReveal } from '../modules/traits/services/traitRevealEngine.mjs';
import { ageOneTagsKey, checkForMilestones } from '../utils/horseAgingSystem.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

const randHex = () => randomBytes(6).toString('hex');

const barrierClient = createBarrierClient();

const byRarity = n => ({ common: n, uncommon: n, rare: n, ultraRare: n, legendary: n });
// Test values only; the owner has not ruled the real numbers.
const revealSettings = {
  revealDays: { positive: byRarity(1), negative: byRarity(1) },
  switchOffDays: { positive: byRarity(1), negative: byRarity(1) },
  dailyChance: byRarity(1),
  lastDayOfLife: 21,
  traitRarity: { fearful: 'common' },
};

/** Writer A: one engine run over the foal's neglected days. */
const runReveal = foalId =>
  evaluateHorseTraitReveal(foalId, {
    settings: revealSettings,
    rng: () => 0,
    readGroomedDays: async () => new Set(),
  });

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
        // Lived ten whole days, so the engine has days to evaluate.
        dateOfBirth: gameCalendarDate(new Date(), -10),
        age: 0,
        userId: user.id,
        // A task the age-1 milestone maps to an epigenetic tag.
        taskLog: { desensitization: 3 },
        daysGroomedInARow: 3,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['fearful'] },
      },
      createdHorseIds,
    );
    return foal;
  }

  const reload = foalId => prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });

  const revealedNames = changes => changes.map(c => c.trait);

  it('a reveal that commits while the age-1 milestone is writing survives it', async () => {
    const foal = await makeFoal();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const barrier = await holdLock(barrierClient, horseRowLock(foal.id));
    let evaluation;
    let milestone;
    try {
      // A first: it reads the traits inside its transaction, then queues.
      evaluation = runReveal(foal.id);
      await barrier.waitForQueued(1);
      // B second: it reads the same traits, then queues behind A.
      milestone = checkForMilestones(foal.id, 0, 10);
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [evalResult, milestoneResult] = await Promise.all([evaluation, milestone]);

    expect(revealedNames(evalResult.changes)).toEqual(['fearful']);
    expect(milestoneResult.traitsAssigned.length).toBeGreaterThan(0);

    const after = await reload(foal.id);
    expect(after.epigeneticModifiers.negative).toEqual(['fearful']);
    expect(after.epigeneticModifiers[ageOneTagsKey]).toEqual(milestoneResult.traitsAssigned);
  }, 120000);

  it('a reveal written after the age-1 milestone keeps the milestone tags', async () => {
    const foal = await makeFoal();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const milestoneResult = await checkForMilestones(foal.id, 0, 10);
    expect(milestoneResult.traitsAssigned.length).toBeGreaterThan(0);

    const evalResult = await runReveal(foal.id);
    expect(revealedNames(evalResult.changes)).toEqual(['fearful']);

    const after = await reload(foal.id);
    expect(after.epigeneticModifiers[ageOneTagsKey]).toEqual(milestoneResult.traitsAssigned);
    expect(after.epigeneticModifiers.negative).toEqual(['fearful']);
  }, 120000);
});
