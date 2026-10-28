/**
 * INTEGRATION TEST: every horse waits the full week between trainings (Equoria-fjgzp)
 *
 * Owner ruling (equoria-training-fee-once-per-weekly-session, 2026-10-22):
 * one training per horse per week. Old contract: an `intelligent` horse
 * (trait effect trainingTimeReduction 0.1) wrote a 5-day cooldown. The trait
 * carries no cooldown effect any more.
 *
 * Real train path, real DB, scoped fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

afterAll(() => cleanupTestTrainers(), 60000);

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env.test') });

const { default: prisma } = await import(join(__dirname, '../../../../packages/database/prismaClient.mjs'));
const { createTestHorse, cleanupTestHorses } = await import(
  join(__dirname, '../../../__tests__/helpers/createTestHorse.mjs')
);
const { trainHorse } = await import(join(__dirname, '../controllers/trainingController.mjs'));

const SUFFIX = randomBytes(6).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;

describe('INTEGRATION: training cooldown is seven days whatever the horse traits (Equoria-fjgzp)', () => {
  const createdHorseIds = [];
  let testUser;
  let breed;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `testfixture-fjgzp-${SUFFIX}@example.com`,
        username: `tffjgzp${SUFFIX}`,
        firstName: 'Cooldown',
        lastName: 'Neutral',
        password: 'hashedpassword',
        money: 1000,
        level: 1,
        xp: 0,
        settings: { theme: 'light' },
      },
    });
    breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: { name: `TestFixture-fjgzp-breed-${SUFFIX}`, description: 'cooldown test breed' },
      });
    }
  });

  afterAll(async () => {
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: createdHorseIds } } });
    await prisma.horseXpEvent.deleteMany({ where: { horseId: { in: createdHorseIds } } });
    await cleanupTestHorses(prisma, createdHorseIds);
    await prisma.xpEvent.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  async function cooldownDaysAfterTraining(label, positiveTraits) {
    const fiveYearsAgo = birthDateForAge(5);
    const horse = await createTestHorse(
      prisma,
      {
        name: `TestFixture-fjgzp-${label}-${SUFFIX}`,
        age: 5,
        breedId: breed.id,
        userId: testUser.id,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        healthStatus: 'Excellent',
        lastFedDate: new Date(),
        trainingCooldown: null,
        disciplineScores: {},
        epigeneticModifiers: { positive: positiveTraits, negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await assignTestTrainer(horse);
    const before = Date.now();
    const result = await trainHorse(horse.id, 'Dressage');
    expect(result.success).toBe(true);
    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { trainingCooldown: true } });
    return (row.trainingCooldown.getTime() - before) / dayMs;
  }

  it('an intelligent horse waits the same seven days as a horse with no trait', async () => {
    const plain = await cooldownDaysAfterTraining('plain', []);
    const intelligent = await cooldownDaysAfterTraining('intelligent', ['intelligent']);
    expect(plain).toBeGreaterThan(6.9);
    expect(plain).toBeLessThan(7.1);
    expect(intelligent).toBeGreaterThan(6.9);
    expect(intelligent).toBeLessThan(7.1);
  });
});
