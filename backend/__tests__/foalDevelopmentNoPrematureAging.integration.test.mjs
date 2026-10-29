/**
 * No premature foal aging — Equoria-3i34b (follow-up of Equoria-mwjst).
 *
 * Owner ruling 2026-10-06: "there is to be NO PREMATURE AGING" (after
 * 2026-10-05: "THEY MUST WAIT OUT THE FULL 7 DAY AGING PROCESS").
 *
 * The defect: the nightly trait pass (`evaluateFoalTraits`) ended every run by
 * advancing `FoalDevelopment.currentDay` one step, whatever the clock said. The
 * day gates epigenetic trait revelation (traitEvaluation minAge 1–6), and the
 * pass is reachable on demand through the admin `POST /api/admin/traits/evaluate`
 * (manualTraitEvaluation → evaluateDailyFoalTraits → evaluateFoalTraits) and by
 * any second fire of the cron. Each extra run aged every foal's development by a
 * day and re-rolled its reveals; a foal born minutes before the job ran was
 * advanced at once.
 *
 * The invariant this file locks: a development day is evaluated and advanced
 * only after it has fully elapsed — `currentDay` never exceeds the foal's age in
 * whole Eastern calendar days (getHorseAgeDays, Equoria-vdw5; Eastern game clock
 * per the owner's 2026-10-09 ruling — this file said UTC days before; the same
 * age the canonical enrichment day uses). Extra runs on the same day are no-ops, and the
 * advance itself refuses to move past the elapsed days whoever calls it.
 *
 * This file drives the per-foal pass the admin route and the cron both reach,
 * not the global admin route: that would evaluate every young foal in the shared
 * test database, including other suites' fixtures.
 *
 * Real database, real job functions. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import cronJobService from '../services/cronJobs.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

const PREFIX = `TestFixture-3i34b-${randomBytes(4).toString('hex')}`;
const createdFoalIds = [];
let owner;

/** A foal born `daysAgo` Eastern game days ago (date-only dob, written as production writes it) with a development record at `currentDay`. */
async function makeFoal(daysAgo, currentDay = 0) {
  const foal = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-${createdFoalIds.length}`,
      sex: 'Filly',
      age: 0,
      dateOfBirth: gameCalendarDate(new Date(), -daysAgo),
      bondScore: 50,
      user: { connect: { id: owner.id } },
    },
  });
  createdFoalIds.push(foal.id);
  await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay } });
  return foal;
}

function loadFoal(foalId) {
  return prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });
}

async function currentDayOf(foalId) {
  return (await prisma.foalDevelopment.findUnique({ where: { foalId } })).currentDay;
}

/** One nightly pass for one foal, exactly as evaluateDailyFoalTraits issues it. */
async function runPass(foalId) {
  return cronJobService.evaluateFoalTraits(await loadFoal(foalId));
}

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: PREFIX,
      email: `${PREFIX}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'No',
      lastName: 'Premature',
    },
  });
});

afterAll(async () => {
  // Fail-loud scoped cleanup in FK order (the foalDevelopmentDayAdvance
  // pattern): development rows, then the foals, then their owner.
  const cleanup = createCleanupTracker();
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'foalDevelopment',
  );
  cleanup.add(() => cleanupTestHorses(prisma, createdFoalIds), 'horses');
  if (owner) {
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
  }
  await cleanup.run();
}, 120000);

describe('no premature foal aging (Equoria-3i34b)', () => {
  it('a foal born today is not developed at all, however many times the pass runs', async () => {
    const foal = await makeFoal(0);
    const before = await loadFoal(foal.id);

    for (let i = 0; i < 3; i++) {
      const result = await runPass(foal.id);
      expect(result).toMatchObject({ traitsRevealed: 0, reason: 'dayNotElapsed' });
    }

    const after = await loadFoal(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(0);
    expect(after.epigeneticModifiers).toEqual(before.epigeneticModifiers);
  });

  it('an extra run on the same day — the admin trigger or a second cron fire — is a no-op', async () => {
    const foal = await makeFoal(1);

    await runPass(foal.id);
    expect(await currentDayOf(foal.id)).toBe(1);
    const afterFirst = await loadFoal(foal.id);

    const extra = await runPass(foal.id);
    expect(extra).toMatchObject({ traitsRevealed: 0, reason: 'dayNotElapsed' });
    const afterExtra = await loadFoal(foal.id);
    expect(afterExtra.foalDevelopment.currentDay).toBe(1);
    expect(afterExtra.epigeneticModifiers).toEqual(afterFirst.epigeneticModifiers);
  });

  it('the development day never runs ahead of the foal’s age in game days', async () => {
    const foal = await makeFoal(3);

    const days = [];
    for (let i = 0; i < 5; i++) {
      await runPass(foal.id);
      days.push(await currentDayOf(foal.id));
    }

    expect(days).toEqual([1, 2, 3, 3, 3]);
  });

  it('advanceFoalDevelopmentDay itself refuses to move a foal past its elapsed days', async () => {
    const newborn = await makeFoal(0);
    expect(await cronJobService.advanceFoalDevelopmentDay(newborn.id, 0)).toBe(0);
    expect(await currentDayOf(newborn.id)).toBe(0);

    const twoDaysOld = await makeFoal(2);
    expect(await cronJobService.advanceFoalDevelopmentDay(twoDaysOld.id, 0)).toBe(1);
    expect(await currentDayOf(twoDaysOld.id)).toBe(1);
  });

  it('two concurrent passes over the same due foal advance it once', async () => {
    const foal = await makeFoal(2);
    const snapshot = await loadFoal(foal.id);

    await Promise.all([cronJobService.evaluateFoalTraits(snapshot), cronJobService.evaluateFoalTraits(snapshot)]);

    expect(await currentDayOf(foal.id)).toBe(1);
  });
});
