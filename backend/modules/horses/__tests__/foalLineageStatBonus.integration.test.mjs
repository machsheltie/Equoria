/**
 * Lineage stat bonus through real foaling (Equoria-fq9ob; owner rulings
 * 2026-10-20 Q1, 2026-10-21 Q6, 2026-10-28).
 *
 * Before: createFoalFromPregnancy passed no stats, so every foal was born with all
 * 12 stats at 0 whatever its pedigree. Now a foal whose lineage has 3+ distinct
 * ancestors sharing a most-competed discipline gets 2% of its parents' average on
 * each stat. The base inheritance formula is not decided, so the base is 0 and the
 * stored stat equals the bonus.
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

const dayMs = 24 * 60 * 60 * 1000;
const tag = randomBytes(4).toString('hex');
const prefix = `TestFixture-fq9ob-${tag}`;
const cleanup = createCleanupTracker();
const horseIds = [];
let owner;
let breed;
const showIds = [];

const zeroStats = () => Object.fromEntries(horseStats.map(stat => [stat, 0]));

async function horse(label, data) {
  const row = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${prefix}-${label}`,
      dateOfBirth: gameCalendarDate(new Date(), -8 * 365),
      age: 8,
      breedId: breed.id,
      userId: owner.id,
      healthStatus: 'Good',
      ...data,
    },
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
  const sireStats = { ...zeroStats(), precision: 100, speed: 100, stamina: 30, agility: 20, focus: 25 };
  const damStats = { ...zeroStats(), precision: 100, speed: 50, stamina: 30, agility: 20, focus: 25 };
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

async function foalStats(damId) {
  const { foal } = await createFoalFromPregnancy({ damId });
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
  it('3 grandparents sharing a most-competed discipline: each stat gets 2% of the parents’ average', async () => {
    // The dam's sire ties Dressage with Racing, so he counts for Dressage too.
    const { dam } = await family('qualifies', [{ Dressage: 2 }, { Dressage: 1 }, { Dressage: 1, Racing: 1 }]);
    const stats = await foalStats(dam.id);
    expect(stats.precision).toBe(2); // average 100
    expect(stats.speed).toBe(2); // average 75 -> 1.5
    expect(stats.stamina).toBe(1); // 30 -> 0.6
    expect(stats.agility).toBe(0); // 20 -> 0.4
    expect(stats.focus).toBe(1); // 25 -> 0.5, rounds up
    expect(stats.boldness).toBe(0); // parents 0
  }, 60000);

  it('only 2 ancestors share it (the third has no results): no bonus', async () => {
    const { dam } = await family('twoonly', [{ Dressage: 2 }, { Dressage: 1 }, {}]);
    expect(await foalStats(dam.id)).toEqual(zeroStats());
  }, 60000);

  it('3 ancestors whose most-competed disciplines differ: no bonus', async () => {
    const { dam } = await family('differ', [{ Dressage: 2 }, { Racing: 1 }, { Hunter: 3, Dressage: 1 }]);
    expect(await foalStats(dam.id)).toEqual(zeroStats());
  }, 60000);
});
