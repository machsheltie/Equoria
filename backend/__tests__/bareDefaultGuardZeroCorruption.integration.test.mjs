/**
 * bareDefaultGuardZeroCorruption.integration.test.mjs (Equoria-4maxb)
 *
 * Migration 20260530130000_507mt made 19 Horse stat/counter columns NOT NULL
 * with default 0 (bondScore 0 = unbonded, stats 0 = undeveloped). A bare `||` guard with a non-zero fallback on one of those
 * columns silently rewrites a legitimate 0:
 *
 *   horse.horseXp     || 100   -> a horse with no XP is read as experienced
 *   horse.bondScore   || 50    -> an unbonded horse is read as neutral-50
 *   stallion.speed    || 50    -> an undeveloped stat is read as average
 *
 * REAL-DB behavioural arm: a horse row planted with 0 (not null, not
 * undefined — the state where broken and fixed readers differ) flows through
 * the live readers and must come out as 0.
 *
 * Sibling unit arms live beside their services:
 *   modules/traits/__tests__/traitDiscovery.test.mjs
 *   modules/horses/__tests__/enhancedMilestoneEvaluationSystem.test.mjs
 *   modules/traits/__tests__/applyEpigeneticTraitsAtBirthUnit.test.mjs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { checkDiscoveryConditions } from '../utils/traitDiscovery.mjs';
import { gameCalendarDate } from '../utils/gameTime.mjs';

describe('Equoria-4maxb — legitimate 0 on NOT NULL Horse columns survives the live readers', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  let userId;
  let calmUnbondedId;

  beforeAll(async () => {
    const uniq = randomBytes(8).toString('hex');
    // Scoped, fail-loud cleanup: horses (by the ids this suite created) before
    // the user (Horse.userId is onDelete:Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');

    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `4maxb-${uniq}@example.com`,
        username: `4maxb-${uniq}`,
        password: 'irrelevant-hash',
        firstName: 'Zero',
        lastName: 'Semantics',
        money: 1000,
      },
    });
    userId = user.id;

    const fiveYearsAgo = gameCalendarDate(new Date(), -5 * 365);

    const calmUnbonded = await createTestHorse(
      prisma,
      {
        name: `TestFixture-4maxb-calm-${uniq}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        userId,
        bondScore: 0,
      },
      horseIds,
    );
    calmUnbondedId = calmUnbonded.id;
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the planted state is a stored 0, not null and not undefined', async () => {
    const stored = await prisma.horse.findUnique({
      where: { id: calmUnbondedId },
      select: { bondScore: true },
    });
    expect(stored).toEqual({ bondScore: 0 });
  });

  it('trait discovery reads an unbonded (bondScore 0) horse as unbonded', async () => {
    // Equoria-tpofm: getDiscoveryProgress (whose `horse.bondScore || 50`
    // promoted 0 into neutral-50) was deleted with no caller left. The live
    // reader is checkDiscoveryConditions, behind GET /traits/discovery-status,
    // fed the stored row exactly as the controller feeds it.
    const stored = await prisma.horse.findUnique({ where: { id: calmUnbondedId } });
    const conditions = await checkDiscoveryConditions(stored);

    const met = conditions.map(c => c.name);
    // Unbonded: no bond-based discovery may fire.
    expect(met).not.toContain('highBond');
    expect(met).not.toContain('perfectCare');
  }, 30000);
});
