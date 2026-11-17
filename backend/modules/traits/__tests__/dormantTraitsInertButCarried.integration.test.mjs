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
 * Owner ruling 2026-11-17 (q355): a trait inherited from a parent on which it
 * was revealed but dormant is born revealed but dormant on the foal: players
 * see it, it does nothing, and grooming can still switch it on in the reveal
 * window. Old contract (q98): such a foal was born with the trait HIDDEN; the
 * first foaling test below asserted that and now asserts q355.
 *
 * Real database and the real foaling service; the birth rolls are seeded.
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../../horses/index.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { calendarDateDayIndex, gameCalendarDate, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { calculateTraitCompetitionImpact } from '../../../utils/traitCompetitionImpact.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { traitRevealSettings } from '../config/traitRevealSettings.mjs';
import { evaluateHorseTraitReveal } from '../services/traitRevealEngine.mjs';

const RUN = randomBytes(4).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;
// The birth pipeline's seeded generator draws 0.0486 first with this seed, so
// the first inheritance roll (25%, q138) succeeds.
const winningInheritanceSeed = 21;

/** Birth trait rolls that return `draws` in order, then always lose. */
const scriptedRolls = draws => {
  const queue = [...draws];
  return () => (queue.length > 0 ? queue.shift() : 0.99);
};

/** A stallion and an in-foal mare with the given epigenetic modifiers. */
async function makeParents(label, sireModifiers, damModifiers) {
  const sire = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-${label}-Sire-${RUN}`,
      sex: 'Stallion',
      dateOfBirth: gameCalendarDate(new Date(), -5 * 365),
      age: 5,
      breedId,
      userId: user.id,
      epigeneticModifiers: sireModifiers,
    }),
  });
  const dam = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-${label}-Dam-${RUN}`,
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
      epigeneticModifiers: damModifiers,
    }),
  });
  horseIds.push(sire.id, dam.id);
  return { sire, dam };
}

async function foalOf(dam, options) {
  const { foal } = await createFoalFromPregnancy({ damId: dam.id, options: { rng: () => 0.99, ...options } });
  horseIds.push(foal.id);
  return prisma.horse.findUnique({ where: { id: foal.id } });
}

let user;
let breedId;
const cleanup = createCleanupTracker();
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
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
  it("a foal can inherit its dam's dormant trait, and is born with it revealed and dormant (q355)", async () => {
    const { dam } = await makeParents(
      'dormant',
      { positive: [], negative: [], hidden: [] },
      { positive: [], negative: [], hidden: [], dormant: ['resilient'] },
    );
    const born = await foalOf(dam, { epigeneticSeed: winningInheritanceSeed });

    // Players see it: revealed, switched off.
    expect(born.epigeneticModifiers.dormant).toEqual(['resilient']);
    expect(born.epigeneticModifiers.hidden).not.toContain('resilient');
    expect(born.epigeneticModifiers.positive).not.toContain('resilient');
    // It does nothing (resilient is the one trait with a competition modifier).
    const impact = calculateTraitCompetitionImpact(born, 'Dressage', 100);
    expect(impact.totalScoreModifier).toBe(0);
    expect(impact.appliedTraits).toEqual([]);

    // Grooming can still switch it on inside the reveal window: 13 groomed days open the
    // rare (12-day) gate. The foal is days old, far under 3.
    const birthDay = calendarDateDayIndex(born.dateOfBirth);
    const result = await evaluateHorseTraitReveal(born.id, {
      settings: traitRevealSettings,
      rng: () => 0,
      now: new Date(startOfGameDayIndex(birthDay + 13).getTime() + 12 * 3_600_000),
      readGroomedDays: async (_client, _id, fromDay, toDay) =>
        new Set(Array.from({ length: toDay - fromDay + 1 }, (_, i) => fromDay + i)),
    });
    expect(result.changes.map(c => [c.trait, c.change])).toEqual([['resilient', 'reactivated']]);
    const switchedOn = await prisma.horse.findUnique({ where: { id: born.id } });
    expect(switchedOn.epigeneticModifiers.positive).toEqual(['resilient']);
    expect(switchedOn.epigeneticModifiers.dormant).toEqual([]);
    expect(calculateTraitCompetitionImpact(switchedOn, 'Dressage', 100).totalScoreModifier).not.toBe(0);
  }, 60_000);

  it("a sire's dormant trait he passes on is born revealed and dormant (q355)", async () => {
    const { dam } = await makeParents(
      'sireDormant',
      { positive: [], negative: [], hidden: [], dormant: ['fearful'] },
      { positive: [], negative: [], hidden: [] },
    );
    const born = await foalOf(dam, { traitRng: scriptedRolls([0]) });

    expect(born.epigeneticModifiers.dormant).toEqual(['fearful']);
    expect(born.epigeneticModifiers.hidden).not.toContain('fearful');
    expect(born.epigeneticModifiers.negative).not.toContain('fearful');
  }, 60_000);

  it('dormant on the sire, hidden on the dam, only the dam passes it: born hidden (q354)', async () => {
    const { dam } = await makeParents(
      'damPasses',
      { positive: [], negative: [], hidden: [], dormant: ['brave'] },
      { positive: [], negative: [], hidden: ['brave'] },
    );
    // Sire's roll first (loses), then the dam's (wins).
    const born = await foalOf(dam, { traitRng: scriptedRolls([0.99, 0]) });

    expect(born.epigeneticModifiers.hidden).toEqual(['brave']);
    expect(born.epigeneticModifiers.dormant).toEqual([]);
  }, 60_000);
});
