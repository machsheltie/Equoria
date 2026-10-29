/**
 * Integration test: each foal development day is evaluated exactly once
 * (Equoria-mwjst, Codex Sol review 2026-10-20 findings 1-3).
 *
 * 1. Day 6 is the last development day. Once it has been evaluated the foal is
 *    finished (owner ruling 2026-10-20: a separate "finished" marker, the day
 *    stays 6) and later nightly runs never roll it again.
 * 2. Two concurrent passes over the same foal claim the day once: the day
 *    moves forward by one.
 *
 * Owner ruling 2026-10-26 (q98, Equoria-2d55z): the pass no longer rolls or
 * records traits (it used to invent them), so the former "one set of reveals /
 * history rows / notification" and "a failed reveal write rolls back the claim"
 * cases are gone. Carried traits are revealed by
 * modules/traits/services/traitRevealEngine.mjs, whose lock, write and history
 * rows share one transaction (traitRevealEngine.integration.test.mjs).
 *
 * Math.random is pinned so a reveal is certain (0) or impossible (0.99); it is
 * the only thing replaced. Everything else is the real job against the real
 * database.
 */

import { describe, beforeAll, afterAll, afterEach, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import * as foalTraitImpl from '../services/jobs/impl/foalTraitEvaluation.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

const randHex = () => randomBytes(6).toString('hex');

/** A service handle that re-enters the impl exactly as the CronJobService delegators do. */
function realService(overrides = {}) {
  const service = {
    evaluateFoalTraits: f => foalTraitImpl.evaluateFoalTraits(service, f),
    advanceFoalDevelopmentDay: (id, day) => foalTraitImpl.advanceFoalDevelopmentDay(id, day),
    notifyTraitRevelation: (f, t, d) => foalTraitImpl.notifyTraitRevelation(f, t, d),
    logTraitRevelation: (...args) => foalTraitImpl.logTraitRevelation(...args),
    logAuditSummary: s => foalTraitImpl.logAuditSummary(s),
    ...overrides,
  };
  return service;
}

describe('INTEGRATION: a foal development day is evaluated once (Equoria-mwjst)', () => {
  let user;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `tf-dayonce-${randHex()}`,
        email: `tf-dayonce-${randHex()}@example.com`,
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
  }, 120000);

  async function makeFoal(currentDay) {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-dayonce-${randHex()}`,
        sex: 'Colt',
        // Lived ten whole days, so every development day 0-6 is due.
        dateOfBirth: gameCalendarDate(new Date(), -10),
        age: 0,
        userId: user.id,
        // Conditions under which day-0..6 positive traits are eligible.
        bondScore: 80,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay } });
    return foal;
  }

  const reload = foalId => prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });

  const revealedNames = horse => {
    const mods = horse.epigeneticModifiers ?? {};
    return [...(mods.positive ?? []), ...(mods.negative ?? []), ...(mods.hidden ?? [])];
  };

  it('evaluates day 6 once, marks the foal finished, and never rolls it again', async () => {
    const foal = await makeFoal(6);
    const service = realService();

    // First run: day 6 is due; no reveal tonight.
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    await foalTraitImpl.evaluateFoalTraits(service, await reload(foal.id));

    const afterFirst = await reload(foal.id);
    expect(afterFirst.foalDevelopment.currentDay).toBe(6);
    // Prisma's Date is from another realm than Jest's, so check the value, not the constructor.
    expect(afterFirst.foalDevelopment.finalDayEvaluatedAt).not.toBeNull();
    expect(Number.isFinite(new Date(afterFirst.foalDevelopment.finalDayEvaluatedAt).getTime())).toBe(true);

    // A later run where any roll would succeed must not roll at all.
    Math.random.mockReturnValue(0);
    const second = await foalTraitImpl.evaluateFoalTraits(service, afterFirst);

    expect(second).toEqual({ traitsRevealed: 0, reason: 'developmentComplete' });
    const afterSecond = await reload(foal.id);
    expect(revealedNames(afterSecond)).toEqual([]);
    expect(await prisma.traitHistoryLog.count({ where: { horseId: foal.id } })).toBe(0);
  }, 60000);

  it('two concurrent passes over the same day claim it once and add no traits', async () => {
    const foal = await makeFoal(2);
    const snapshot = await reload(foal.id);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const results = await Promise.all([
      foalTraitImpl.evaluateFoalTraits(realService(), snapshot),
      foalTraitImpl.evaluateFoalTraits(realService(), snapshot),
    ]);

    const after = await reload(foal.id);
    expect(after.foalDevelopment.currentDay).toBe(3);
    // One pass moved the day 2 -> 3; the other found it already claimed at 2.
    expect(results.map(r => r.currentDay).sort()).toEqual([2, 3]);
    expect(results.every(r => r.traitsRevealed === 0)).toBe(true);
    expect(revealedNames(after)).toEqual([]);
    expect(await prisma.traitHistoryLog.count({ where: { horseId: foal.id } })).toBe(0);
  }, 60000);
});
