// Temperament has no effect on training — real DB.
//
// Owner ruling 2026-10-21 (Stacey): "temperaments don't have any effect on
// discipline training gain. It is a standard +5 for the selected discipline."
// Old contract (Story 31D-2): TEMPERAMENT_TRAINING_MODIFIERS scaled the
// discipline gain and XP per temperament (e.g. Calm +10% score -> +6, Lazy
// -15% score -> +4, Stubborn -15% XP -> 4 XP), trainHorse() returned a
// temperamentEffects block, and Lazy + eagerLearner stacked multiplicatively.
// All of that is removed; these tests pin the new contract end-to-end.
//
// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): a real-DB
// integration test against the equoria_test database. Training never raises a
// horse stat (owner rulings 2026-10-19, 2026-10-21), so no RNG seam is needed.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import * as horsesModule from '../../horses/index.mjs';
import { trainHorse } from '../controllers/trainingController.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

// TEMPERAMENT_TYPES is part of the horses barrel's documented public API.
const { TEMPERAMENT_TYPES } = horsesModule;

const SUITE_PREFIX = 'tmod';

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Tmod',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
      money: 1000,
      level: 1,
      xp: 0,
    },
  });
}

async function createBreed() {
  return prisma.breed.create({
    data: { name: `${SUITE_PREFIX}-breed-${randomBytes(4).toString('hex')}` },
  });
}

async function createHorse(userId, breedId, overrides = {}) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: birthDateForAge(overrides.age ?? 5),
      age: overrides.age ?? 5,
      temperament: overrides.temperament ?? null,
      epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      disciplineScores: overrides.disciplineScores ?? {},
      trainingCooldown: null,
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      breed: { connect: { id: breedId } },
      user: { connect: { id: userId } },
    }),
  });
  await assignTestTrainer(horse); // a trainer is required to train (owner ruling 2026-10-26)
  return horse;
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.horseXpEvent.deleteMany({ where: { horseId: { in: horseIds } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.breed.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await cleanupTestTrainers();
}

describe('the horses module no longer offers temperament training modifiers', () => {
  it('exports neither the table nor the lookup', () => {
    expect(horsesModule).not.toHaveProperty('TEMPERAMENT_TRAINING_MODIFIERS');
    expect(horsesModule).not.toHaveProperty('getTemperamentTrainingModifiers');
  });

  it('the 12 temperaments include Willing and Driven, not Playful', () => {
    expect(TEMPERAMENT_TYPES).toHaveLength(12);
    expect(TEMPERAMENT_TYPES).toEqual(expect.arrayContaining(['Willing', 'Driven']));
    expect(TEMPERAMENT_TYPES).not.toContain('Playful');
  });
});

describe('trainHorse() — every temperament gains exactly +5 (real DB)', () => {
  let breed;

  beforeAll(async () => {
    await cleanupSuite();
    breed = await createBreed();
  });

  afterAll(cleanupSuite);

  // The temperaments whose old modifiers moved the gain or XP the most, plus
  // the two new ones and a horse with no temperament.
  it.each(['Calm', 'Lazy', 'Stubborn', 'Spirited', 'Willing', 'Driven', null])(
    '%s horse: discipline +5, user XP +5, no temperamentEffects',
    async temperament => {
      const user = await createUser();
      const horse = await createHorse(user.id, breed.id, {
        temperament,
        disciplineScores: { Dressage: 20 },
      });
      const userBefore = await prisma.user.findUnique({
        where: { id: user.id },
        select: { xp: true },
      });

      const result = await trainHorse(horse.id, 'Dressage');

      expect(result.success).toBe(true);
      expect(result.disciplineScoreIncrease).toBe(5);
      expect(result).not.toHaveProperty('temperamentEffects');

      const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(horseAfter.disciplineScores.Dressage).toBe(25);
      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { xp: true },
      });
      expect(userAfter.xp - userBefore.xp).toBe(5);
    },
  );
});
