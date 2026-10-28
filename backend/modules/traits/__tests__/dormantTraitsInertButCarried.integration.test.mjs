/**
 * A dormant trait is revealed, inactive and still carried (Equoria-nrto5).
 *
 * Owner ruling 2026-10-22 recorded on Equoria-q4uem.17: a revealed trait made
 * inactive becomes revealed + dormant, never hidden or deleted again; a trait is
 * carried and inheritable for life. Owner ruling 2026-10-19: a trait that is not
 * active has no effect. Dormant traits live in epigeneticModifiers.dormant
 * (no schema change), next to positive / negative (revealed + active) and
 * hidden (carried, unrevealed).
 *
 * Real database and the real foaling service; the birth rolls are seeded.
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../../horses/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { calculateTraitCompetitionImpact } from '../../../utils/traitCompetitionImpact.mjs';

const RUN = randomBytes(4).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;
// The birth pipeline's seeded generator draws 0.0486 first with this seed, so
// the first inheritance roll (25%, q138) succeeds.
const winningInheritanceSeed = 21;

let user;
let breedId;
const cleanup = createCleanupTracker();
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tf-dormant-${RUN}@test.com`,
      username: `tf-dormant-${RUN}`,
      password: 'x',
      firstName: 'Test',
      lastName: 'Fixture',
      money: 0,
    },
  });
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'nrto5 test breed' },
  });
  breedId = breed.id;
}, 60_000);

afterAll(async () => {
  if (user) {
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: horseIds } } }), 'traitHistory');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id, age: 0 } }), 'foals');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'users');
  }
  await cleanup.run();
}, 60_000);

describe('dormant traits have no effect (Equoria-nrto5)', () => {
  it('a dormant trait changes no competition score; the same trait active does', () => {
    const dormant = calculateTraitCompetitionImpact(
      { id: 1, epigeneticModifiers: { positive: [], negative: [], hidden: [], dormant: ['resilient'] } },
      'Dressage',
      100,
    );
    expect(dormant.totalScoreModifier).toBe(0);
    expect(dormant.appliedTraits).toEqual([]);

    const active = calculateTraitCompetitionImpact(
      { id: 1, epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [], dormant: [] } },
      'Dressage',
      100,
    );
    expect(active.totalScoreModifier).not.toBe(0);
  });
});

describe('dormant traits are still carried (Equoria-nrto5)', () => {
  it("a foal can inherit its dam's dormant trait, and is born with it hidden", async () => {
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-dormant-Sire-${RUN}`,
        sex: 'Stallion',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
        age: 5,
        breedId,
        userId: user.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-dormant-Dam-${RUN}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
        age: 5,
        breedId,
        userId: user.id,
        healthStatus: 'Excellent',
        lastVettedDate: gameCalendarDate(new Date(), 0),
        lastFedDate: new Date(),
        inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
        pregnancySireId: sire.id,
        pregnancyFeedingsByTier: {},
        epigeneticModifiers: { positive: [], negative: [], hidden: [], dormant: ['brave'] },
      },
    });

    horseIds.push(sire.id, dam.id);
    const { foal } = await createFoalFromPregnancy({
      damId: dam.id,
      options: { rng: () => 0.99, epigeneticSeed: winningInheritanceSeed },
    });

    horseIds.push(foal.id);
    const born = await prisma.horse.findUnique({ where: { id: foal.id } });
    expect(born.epigeneticModifiers.hidden).toContain('brave');
    expect(born.epigeneticModifiers.positive).not.toContain('brave');
  }, 60_000);
});
