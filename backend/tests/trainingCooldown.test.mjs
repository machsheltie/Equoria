/**
 * Training Cooldown System — tests
 *
 * Pure functions (canTrain, getCooldownTimeRemaining, formatCooldown) are tested
 * with plain JS objects — no DB needed.
 * setCooldown() calls prisma.horse.update and is tested against the real DB.
 */

import { describe, beforeAll, afterAll, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from './helpers/fixtureColor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.test') });

const { default: prisma } = await import(join(__dirname, '../db/index.mjs'));
const { canTrain, getCooldownTimeRemaining, setCooldown, formatCooldown } = await import(
  join(__dirname, '../utils/trainingCooldown.mjs')
);

describe('Training Cooldown System', () => {
  let dbHorse = null;
  let breed = null;
  let testUser = null;

  beforeAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-Cooldown-' } } });
    await prisma.user.deleteMany({ where: { email: 'cooldown-test@fixture.test' } });

    testUser = await prisma.user.create({
      data: {
        email: 'cooldown-test@fixture.test',
        username: 'cooldowntestuser',
        firstName: 'Cooldown',
        lastName: 'Tester',
        password: 'hashedpassword',
        money: 0,
        level: 1,
        xp: 0,
        settings: {},
      },
    });

    breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({ data: { name: 'TestFixture-Cooldown-Breed', description: 'test' } });
    }

    dbHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'TestFixture-Cooldown-Horse',
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: testUser.id,
        breedId: breed.id,
        trainingCooldown: null,
      },
    });
  });

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-Cooldown-' } } });
    await prisma.user.deleteMany({ where: { email: 'cooldown-test@fixture.test' } });
  });

  beforeEach(async () => {
    // Reset the DB horse's cooldown before each test that may have set it
    if (dbHorse) {
      await prisma.horse.update({
        where: { id: dbHorse.id },
        data: { trainingCooldown: null },
      });
    }
  });

  describe('canTrain', () => {
    it('returns true for horse with no cooldown', () => {
      expect(canTrain({ trainingCooldown: null })).toBe(true);
    });

    it('returns true for horse with cooldown in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(canTrain({ trainingCooldown: pastDate })).toBe(true);
    });

    it('returns false for horse with cooldown in the future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(canTrain({ trainingCooldown: futureDate })).toBe(false);
    });

    it('throws for null horse', () => {
      expect(() => canTrain(null)).toThrow('Horse object is required');
    });

    it('throws for undefined horse', () => {
      expect(() => canTrain()).toThrow('Horse object is required');
    });
  });

  describe('getCooldownTimeRemaining', () => {
    it('returns null when no cooldown', () => {
      expect(getCooldownTimeRemaining({ trainingCooldown: null })).toBeNull();
    });

    it('returns null when cooldown is in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(getCooldownTimeRemaining({ trainingCooldown: pastDate })).toBeNull();
    });

    it('returns positive ms when cooldown is in the future', () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const remaining = getCooldownTimeRemaining({ trainingCooldown: futureDate });
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('returns approximately correct time remaining', () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 30);
      const remaining = getCooldownTimeRemaining({ trainingCooldown: futureDate });
      const expectedMs = 30 * 60 * 1000;
      expect(remaining).toBeGreaterThan(expectedMs - 1000);
      expect(remaining).toBeLessThanOrEqual(expectedMs);
    });

    it('throws for null horse', () => {
      expect(() => getCooldownTimeRemaining(null)).toThrow('Horse object is required');
    });

    it('throws for undefined horse', () => {
      expect(() => getCooldownTimeRemaining()).toThrow('Horse object is required');
    });
  });

  describe('setCooldown', () => {
    it('sets cooldown 7 days in the future', async () => {
      const beforeTime = new Date();
      const result = await setCooldown(dbHorse.id);
      const afterTime = new Date();

      expect(result.trainingCooldown).toBeDefined();

      const cooldownDate = new Date(result.trainingCooldown);
      const expectedMinDate = new Date(beforeTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expectedMaxDate = new Date(afterTime.getTime() + 7 * 24 * 60 * 60 * 1000);

      expect(cooldownDate.getTime()).toBeGreaterThanOrEqual(expectedMinDate.getTime() - 60000);
      expect(cooldownDate.getTime()).toBeLessThanOrEqual(expectedMaxDate.getTime() + 60000);
    });

    it('returns updated horse with relations included', async () => {
      const result = await setCooldown(dbHorse.id);

      expect(result.id).toBe(dbHorse.id);
      expect(result.name).toBe(dbHorse.name);
      expect(result.trainingCooldown).toBeDefined();
      // breed relation is included in the result
      expect(result.breed).toBeDefined();
    });

    it('throws for non-existent horse ID', async () => {
      await expect(setCooldown(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
    });

    it('throws for null horse ID', async () => {
      await expect(setCooldown(null)).rejects.toThrow('Horse ID is required');
    });

    it('throws for undefined horse ID', async () => {
      await expect(setCooldown()).rejects.toThrow('Horse ID is required');
    });

    it('throws for invalid string horse ID', async () => {
      await expect(setCooldown('invalid')).rejects.toThrow('Horse ID must be a valid positive integer');
    });

    it('throws for negative horse ID', async () => {
      await expect(setCooldown(-1)).rejects.toThrow('Horse ID must be a valid positive integer');
    });

    it('throws for zero horse ID', async () => {
      await expect(setCooldown(0)).rejects.toThrow('Horse ID must be a valid positive integer');
    });

    it('accepts string horse ID that parses to a valid integer', async () => {
      const result = await setCooldown(dbHorse.id.toString());
      expect(result.id).toBe(dbHorse.id);
      expect(result.trainingCooldown).toBeDefined();
    });
  });

  describe('formatCooldown', () => {
    it('returns "Ready to train" for null', () => {
      expect(formatCooldown(null)).toBe('Ready to train');
    });

    it('returns "Ready to train" for zero', () => {
      expect(formatCooldown(0)).toBe('Ready to train');
    });

    it('returns "Ready to train" for negative ms', () => {
      expect(formatCooldown(-1000)).toBe('Ready to train');
    });

    it('formats minutes correctly', () => {
      expect(formatCooldown(5 * 60 * 1000)).toBe('5 minute(s) remaining');
    });

    it('formats hours and minutes correctly', () => {
      expect(formatCooldown(2 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe('2 hour(s), 5 minute(s) remaining');
    });

    it('formats days and hours correctly', () => {
      expect(formatCooldown(3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)).toBe('3 day(s), 2 hour(s) remaining');
    });

    it('formats exactly 7 days correctly', () => {
      expect(formatCooldown(7 * 24 * 60 * 60 * 1000)).toBe('7 day(s), 0 hour(s) remaining');
    });
  });

  describe('Integration', () => {
    it('completes full training cooldown workflow', async () => {
      const freshHorse = { trainingCooldown: null };
      expect(canTrain(freshHorse)).toBe(true);
      expect(getCooldownTimeRemaining(freshHorse)).toBeNull();

      const result = await setCooldown(dbHorse.id);

      expect(canTrain(result)).toBe(false);

      const timeRemaining = getCooldownTimeRemaining(result);
      expect(timeRemaining).toBeGreaterThan(0);

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(timeRemaining).toBeLessThanOrEqual(sevenDaysMs);
      expect(timeRemaining).toBeGreaterThan(sevenDaysMs - 60000);

      const formatted = formatCooldown(timeRemaining);
      expect(formatted).toContain('day(s)');
      expect(formatted).toContain('remaining');
    });

    it('horse returned from setCooldown is usable by pure cooldown functions', async () => {
      const updatedHorse = await setCooldown(dbHorse.id);
      expect(canTrain(updatedHorse)).toBe(false);
      expect(getCooldownTimeRemaining(updatedHorse)).toBeGreaterThan(0);
    });
  });
});
