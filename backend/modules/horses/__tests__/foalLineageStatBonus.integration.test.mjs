/**
 * Birth stats and the lineage stat bonus through real foaling (Equoria-fq9ob;
 * owner rulings 2026-10-20 Q1, 2026-10-21 Q6, 2026-10-28 q204/q247/q248).
 *
 * Before: createFoalFromPregnancy passed no stats, so every foal was born with all
 * 12 stats at 0 whatever its pedigree. Each stat is now the parents' average
 * varied by -10%..+10% (rounded, half up), plus 2% of that average when 3+
 * distinct ancestors share a most-competed discipline.
 *
 * The owner changed this file's contract on 2026-10-28 (q247): it used to pin a
 * base of 0, so the stored stat equalled the bonus. statRng fixes the variation
 * (0.5 gives a factor of exactly 1) where an exact value is asserted.
 *
 * Real database, real foaling service, no mocks. Fixtures are test-owned and
 * removed fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { horseStatNames as horseStats } from '../services/foalLineageStatBonus.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const dayMs = 24 * 60 * 60 * 1000;
const tag = randomBytes(4).toString('hex');
const prefix = `TestFixture-fq9ob-${tag}`;
const cleanup = createCleanupTracker();
const horseIds = [];
let owner;
let breed;
const showIds = [];

const zeroStats = () => Object.fromEntries(horseStats.map(stat => [stat, 0]));
const noVariation = { statRng: () => 0.5 };
const sireStats = { ...zeroStats(), precision: 100, speed: 100, stamina: 30, agility: 20, focus: 25 };
const damStats = { ...zeroStats(), precision: 100, speed: 50, stamina: 30, agility: 20, focus: 25 };
const parentAverage = () => Object.fromEntries(horseStats.map(stat => [stat, (sireStats[stat] + damStats[stat]) / 2]));

async function horse(label, data) {
  const row = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${prefix}-${label}`,
      dateOfBirth: gameCalendarDate(new Date(), -8 * 365),
      age: 8,
      breedId: breed.id,
      userId: owner.id,
      healthStatus: 'Good',
      ...data,
    }),
  });
  horseIds.push(row.id);
  return row;
}

// One show per result: a horse has at most one result per show.
async function results(horseId, discipline, count) {
  for (let i = 0; i < count; i++) {
    const show = await prisma.show.create({
      data: {
        name: `${prefix}-Show-${showIds.length + 1}`,
        discipline,
        levelMin: 1,
        levelMax: 20,
        entryFee: 10,
        prize: 100,
        runDate: new Date(),
      },
    });
    showIds.push(show.id);
    await prisma.competitionResult.create({
      data: {
        horseId,
        showId: show.id,
        score: 70,
        placement: 2,
        discipline,
        runDate: new Date(),
        showName: show.name,
      },
    });
  }
}

/** A sire and an in-foal dam whose three grandparents have the given results. */
async function family(label, grandparentResults) {
  const [gsire, gdam, damSire] = await Promise.all([
    horse(`${label}-GSire`, { sex: 'Stallion' }),
    horse(`${label}-GDam`, { sex: 'Mare' }),
    horse(`${label}-DamSire`, { sex: 'Stallion' }),
  ]);
  const grandparents = [gsire, gdam, damSire];
  for (let i = 0; i < grandparents.length; i++) {
    for (const [discipline, count] of Object.entries(grandparentResults[i] ?? {})) {
      await results(grandparents[i].id, discipline, count);
    }
  }
  const sire = await horse(`${label}-Sire`, {
    sex: 'Stallion',
    sireId: gsire.id,
    damId: gdam.id,
    ...sireStats,
  });
  const dam = await horse(`${label}-Dam`, {
    sex: 'Mare',
    sireId: damSire.id,
    ...damStats,
    inFoalSinceDate: new Date(Date.now() - 8 * dayMs),
    pregnancySireId: sire.id,
    pendingFoalName: `${prefix}-${label}-Foal`,
  });
  return { sire, dam };
}

async function foalStats(damId, options = {}) {
  const { foal } = await createFoalFromPregnancy({ damId, options });
  horseIds.push(foal.id);
  const select = Object.fromEntries(horseStats.map(stat => [stat, true]));
  return prisma.horse.findUnique({ where: { id: foal.id }, select });
}

beforeAll(async () => {
  breed = await prisma.breed.findUnique({ where: { name: 'Thoroughbred' } });
  if (!breed) {
    throw new Error('The seeded Thoroughbred breed is missing; refusing to skip.');
  }
  owner = await prisma.user.create({
    data: {
      email: `fq9ob-${tag}@test.invalid`,
      username: `fq9ob${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Lineage',
      lastName: 'Bonus',
      emailVerified: true,
      money: 1000,
      settings: {},
    },
  });
  const ownerId = owner.id;
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'competitionResults');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: ownerId } }), 'notifications');
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: ownerId, age: 0 } }), 'foals');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: ownerId } }), 'user');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('foaling: lineage stat bonus (Equoria-fq9ob)', () => {
  it('3 grandparents sharing a most-competed discipline: each stat is the parents’ average plus 2% of it', async () => {
    // The dam's sire ties Dressage with Racing, so he counts for Dressage too.
    const { dam } = await family('qualifies', [{ Dressage: 2 }, { Dressage: 1 }, { Dressage: 1, Racing: 1 }]);
    const stats = await foalStats(dam.id, noVariation);
    expect(stats.precision).toBe(102); // average 100, bonus 2
    expect(stats.speed).toBe(77); // average 75, bonus 1.5 -> 2
    expect(stats.stamina).toBe(31); // 30, bonus 0.6 -> 1
    expect(stats.agility).toBe(20); // 20, bonus 0.4 -> 0
    expect(stats.focus).toBe(26); // 25, bonus 0.5 rounds up -> 1
    expect(stats.boldness).toBe(0); // parents 0
  }, 60000);

  it('only 2 ancestors share it (the third has no results): the parents’ average, no bonus', async () => {
    const { dam } = await family('twoonly', [{ Dressage: 2 }, { Dressage: 1 }, {}]);
    expect(await foalStats(dam.id, noVariation)).toEqual(parentAverage());
  }, 60000);

  it('3 ancestors whose most-competed disciplines differ: the parents’ average, no bonus', async () => {
    const { dam } = await family('differ', [{ Dressage: 2 }, { Racing: 1 }, { Hunter: 3, Dressage: 1 }]);
    expect(await foalStats(dam.id, noVariation)).toEqual(parentAverage());
  }, 60000);

  it('the lowest variation roll gives 90% of the average, the highest close to 110% (q247)', async () => {
    const low = await family('low', [{}, {}, {}]);
    expect((await foalStats(low.dam.id, { statRng: () => 0 })).precision).toBe(90);
    const high = await family('high', [{}, {}, {}]);
    expect((await foalStats(high.dam.id, { statRng: () => 0.999999 })).precision).toBe(110);
  }, 60000);

  it('a foal born the ordinary way has every stat within 10% of its parents’ average, never all 0', async () => {
    const { dam } = await family('random', [{}, {}, {}]);
    const stats = await foalStats(dam.id);
    const average = parentAverage();
    for (const stat of horseStats) {
      expect(stats[stat]).toBeGreaterThanOrEqual(Math.round(average[stat] * 0.9));
      expect(stats[stat]).toBeLessThanOrEqual(Math.round(average[stat] * 1.1));
    }
    expect(stats).not.toEqual(zeroStats());
  }, 60000);
});
