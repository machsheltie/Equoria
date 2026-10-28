/**
 * The nightly foal pass never gives a foal a trait it does not carry
 * (owner ruling 2026-10-26, q98; Equoria-2d55z).
 *
 * The pass used to roll new trait names from the foal's bond score every night
 * (traitEvaluation.evaluateTraitRevelation) and append them. A horse now
 * carries a trait or it doesn't; only grooming and neglect days reveal or
 * switch off traits it carries. The pass still advances the development day.
 *
 * Real database; Math.random is pinned to 0 so the old roll would certainly
 * have fired for a fully bonded foal.
 */

import { describe, beforeAll, afterAll, afterEach, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import cronJobService from '../services/cronJobs.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

const RUN = randomBytes(5).toString('hex');

describe('nightly foal pass invents no traits (Equoria-2d55z)', () => {
  let user;
  const horseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `tf-noinvent-${RUN}`,
        email: `tf-noinvent-${RUN}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 60_000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    const ids = [...horseIds];
    cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: ids } } }), 'traitHistoryLog');
    cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: ids } } }), 'foalDevelopment');
    cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user?.id ?? 'none' } }), 'user');
    await cleanup.run();
  }, 60_000);

  it('a fully bonded foal gains no trait names, and its development day still advances', async () => {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-noinvent-${RUN}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -5),
        age: 0,
        userId: user.id,
        bondScore: 100,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['brave'] },
      },
      horseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay: 4 } });
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const loaded = await prisma.horse.findUnique({
      where: { id: foal.id },
      include: { foalDevelopment: true },
    });
    const result = await cronJobService.evaluateFoalTraits(loaded);

    expect(result.traitsRevealed).toBe(0);
    const after = await prisma.horse.findUnique({
      where: { id: foal.id },
      include: { foalDevelopment: true },
    });
    expect(after.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: ['brave'] });
    expect(after.foalDevelopment.currentDay).toBe(5);
    expect(await prisma.traitHistoryLog.count({ where: { horseId: foal.id } })).toBe(0);
  }, 60_000);
});
