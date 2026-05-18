/**
 * Training Model — real-DB tests
 *
 * Input validation tests don't touch the DB (throw before any Prisma call).
 * Happy-path and error-wrapping tests use real DB operations.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.test') });

const { default: prisma } = await import(join(__dirname, '../db/index.mjs'));
const { logTrainingSession, getLastTrainingDate, getHorseAge } = await import(
  join(__dirname, '../models/trainingModel.mjs')
);
const { getHorseAgeYears } = await import(join(__dirname, '../utils/horseAge.mjs'));

describe('Training Model', () => {
  let testUser = null;
  let testHorse = null;
  let breed = null;

  beforeAll(async () => {
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestFixture-TM-' } } },
    });
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TM-' } } });
    await prisma.user.deleteMany({ where: { email: 'training-model-test@fixture.test' } });

    testUser = await prisma.user.create({
      data: {
        email: 'training-model-test@fixture.test',
        username: 'trainingmodeltestuser',
        firstName: 'Training',
        lastName: 'Model',
        password: 'hashedpassword',
        money: 0,
        level: 1,
        xp: 0,
        settings: {},
      },
    });

    breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({ data: { name: 'TestFixture-TM-Breed', description: 'test' } });
    }

    testHorse = await prisma.horse.create({
      data: {
        name: 'TestFixture-TM-Horse',
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: testUser.id,
        breedId: breed.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.trainingLog.deleteMany({
      where: { horse: { name: { startsWith: 'TestFixture-TM-' } } },
    });
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TM-' } } });
    await prisma.user.deleteMany({ where: { email: 'training-model-test@fixture.test' } });
  });

  describe('logTrainingSession', () => {
    it('logs a training session with required fields', async () => {
      const result = await logTrainingSession({ horseId: testHorse.id, discipline: 'Show Jumping' });

      expect(result.id).toBeDefined();
      expect(result.horseId).toBe(testHorse.id);
      expect(result.discipline).toBe('Show Jumping');
      expect(Object.prototype.toString.call(result.trainedAt)).toBe('[object Date]');
    });

    it('throws if horseId is missing', async () => {
      await expect(logTrainingSession({ discipline: 'Racing' })).rejects.toThrow('Horse ID is required');
    });

    it('throws if discipline is missing', async () => {
      await expect(logTrainingSession({ horseId: testHorse.id })).rejects.toThrow('Discipline is required');
    });

    it('throws if horseId is not a positive integer', async () => {
      await expect(logTrainingSession({ horseId: -1, discipline: 'Racing' })).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
      await expect(logTrainingSession({ horseId: 0, discipline: 'Racing' })).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
      await expect(logTrainingSession({ horseId: 'invalid', discipline: 'Racing' })).rejects.toThrow(
        'Horse ID must be a positive integer',
      );
    });

    it('wraps DB errors in "Database error:" prefix', async () => {
      // non-existent horse triggers FK violation — tests error-wrapping path
      await expect(logTrainingSession({ horseId: 999999999, discipline: 'Racing' })).rejects.toThrow('Database error:');
    });
  });

  describe('getLastTrainingDate', () => {
    it('returns the most recent training date for horse and discipline', async () => {
      // Ensure at least one training log exists for this horse/discipline pair
      await logTrainingSession({ horseId: testHorse.id, discipline: 'Dressage' });

      const result = await getLastTrainingDate(testHorse.id, 'Dressage');

      expect(Object.prototype.toString.call(result)).toBe('[object Date]');
    });

    it('returns null if no training records found', async () => {
      const result = await getLastTrainingDate(testHorse.id, 'NonExistentDiscipline-xyz123');
      expect(result).toBeNull();
    });

    it('throws if horseId is not a positive integer', async () => {
      await expect(getLastTrainingDate(-1, 'Racing')).rejects.toThrow('Horse ID must be a positive integer');
      await expect(getLastTrainingDate(0, 'Racing')).rejects.toThrow('Horse ID must be a positive integer');
      await expect(getLastTrainingDate('invalid', 'Racing')).rejects.toThrow('Horse ID must be a positive integer');
    });

    it('throws if discipline is missing', async () => {
      await expect(getLastTrainingDate(testHorse.id, '')).rejects.toThrow('Discipline is required');
      await expect(getLastTrainingDate(testHorse.id, null)).rejects.toThrow('Discipline is required');
    });
  });

  describe('getHorseAge', () => {
    it('returns the canonical game-year age, not calendar-years (Equoria-ffsi)', async () => {
      const result = await getHorseAge(testHorse.id);

      // Equoria convention: 1 game-week (7 real days) = 1 game-year. The
      // training eligibility gate (age >= 3) MUST use game-years, not
      // calendar-years. A horse born 2018-01-01 is hundreds of game-years
      // old; the old /365.25 calendar math returned ~8. Assert game-years.
      const expectedGameYears = getHorseAgeYears(new Date('2018-01-01'));
      expect(result).toBe(expectedGameYears);

      // Sentinel: the calendar-year formula returns 0 for a horse born
      // 35 real days ago, yet it is canonically 5 game-years old (35 / 7).
      // If getHorseAge ever regresses to calendar math this fails.
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const youngHorse = await prisma.horse.create({
        data: {
          name: 'TestFixture-TM-Horse-35d',
          sex: 'Colt',
          dateOfBirth: thirtyFiveDaysAgo,
          age: 0,
          userId: testUser.id,
          breedId: breed.id,
        },
      });
      try {
        const youngAge = await getHorseAge(youngHorse.id);
        // 35 real days / 7 = 5 game-years. Calendar math: floor(35/365.25) = 0.
        expect(youngAge).toBe(5);
        expect(youngAge).not.toBe(0);
      } finally {
        await prisma.horse.deleteMany({
          where: { name: 'TestFixture-TM-Horse-35d' },
        });
      }
    });

    it('returns null if horse not found', async () => {
      const result = await getHorseAge(999999999);
      expect(result).toBeNull();
    });

    it('throws if horseId is not a positive integer', async () => {
      await expect(getHorseAge(-1)).rejects.toThrow('Horse ID must be a positive integer');
      await expect(getHorseAge(0)).rejects.toThrow('Horse ID must be a positive integer');
      await expect(getHorseAge('invalid')).rejects.toThrow('Horse ID must be a positive integer');
    });
  });

  describe('Integration', () => {
    it('handles multiple training sessions for same horse across different disciplines', async () => {
      await logTrainingSession({ horseId: testHorse.id, discipline: 'Cross Country' });
      await logTrainingSession({ horseId: testHorse.id, discipline: 'Racing' });

      const crossCountryDate = await getLastTrainingDate(testHorse.id, 'Cross Country');
      const racingDate = await getLastTrainingDate(testHorse.id, 'Racing');

      expect(Object.prototype.toString.call(crossCountryDate)).toBe('[object Date]');
      expect(Object.prototype.toString.call(racingDate)).toBe('[object Date]');
    });

    it('horse age is correct for training eligibility logic', async () => {
      const age = await getHorseAge(testHorse.id);
      // The test horse was born 2018-01-01 — at least 3 years old (eligible)
      expect(age).toBeGreaterThanOrEqual(3);
    });
  });
});
