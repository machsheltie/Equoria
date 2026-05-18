/**
 * Horse XP System Tests
 *
 * Tests real business logic via horseXpModel.mjs against the actual DB.
 * No mocking of any kind.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../db/index.mjs';
import { fixtureColor } from './helpers/fixtureColor.mjs';
import {
  addXpToHorse,
  allocateStatPoint,
  getHorseXpHistory,
  awardCompetitionXp,
  validateStatName,
} from '../models/horseXpModel.mjs';

const PREFIX = 'TestFixture-HorseXpSys-';
const USER_ID = 'test-user-horse-xp-sys';

async function mkHorse(suffix, opts = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
      age: 0,
      userId: USER_ID,
      horseXp: opts.horseXp ?? 0,
      availableStatPoints: opts.availableStatPoints ?? 0,
      ...(opts.speed !== undefined && { speed: opts.speed }),
    },
  });
}

async function rmHorse(horseId) {
  await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
}

beforeAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
  await prisma.user.create({
    data: {
      id: USER_ID,
      username: 'horsexpSysUser',
      email: 'horsexpsys@example.com',
      password: 'TestPassword123!',
      firstName: 'Horse',
      lastName: 'XP',
      money: 5000,
    },
  });
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: USER_ID } });
});

describe('Horse XP System - Core Business Logic', () => {
  describe('addXpToHorse', () => {
    it('should add XP to horse and calculate available stat points correctly', async () => {
      const horse = await mkHorse('AddXp1', { horseXp: 50, availableStatPoints: 0 });
      try {
        const result = await addXpToHorse(horse.id, 100, 'Competition participation');

        expect(result.success).toBe(true);
        expect(result.currentXP).toBe(150);
        expect(result.availableStatPoints).toBe(1);
        expect(result.xpGained).toBe(100);
        expect(result.statPointsGained).toBe(1);
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should handle multiple stat points correctly (200+ XP)', async () => {
      const horse = await mkHorse('AddXp2', { horseXp: 50, availableStatPoints: 0 });
      try {
        const result = await addXpToHorse(horse.id, 200, 'Major competition win');

        expect(result.success).toBe(true);
        expect(result.currentXP).toBe(250);
        expect(result.availableStatPoints).toBe(2);
        expect(result.statPointsGained).toBe(2);
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should preserve existing stat points when adding XP', async () => {
      const horse = await mkHorse('AddXp3', { horseXp: 150, availableStatPoints: 1 });
      try {
        const result = await addXpToHorse(horse.id, 100, 'Training session');

        expect(result.success).toBe(true);
        expect(result.availableStatPoints).toBe(2);
        expect(result.statPointsGained).toBe(1);
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should handle validation errors for null horse ID', async () => {
      const result = await addXpToHorse(null, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Horse ID is required');
    });

    it('should handle horse not found error', async () => {
      const result = await addXpToHorse(999999999, 100, 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Horse not found');
    });
  });

  describe('allocateStatPoint', () => {
    it('should allocate stat point and decrease available points', async () => {
      const horse = await mkHorse('AllocStat1', { availableStatPoints: 2, speed: 75 });
      try {
        const result = await allocateStatPoint(horse.id, 'speed');

        expect(result.success).toBe(true);
        expect(result.newStatValue).toBe(76);
        expect(result.remainingStatPoints).toBe(1);
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should reject allocation when no stat points available', async () => {
      const horse = await mkHorse('AllocStat2', { availableStatPoints: 0 });
      try {
        const result = await allocateStatPoint(horse.id, 'speed');

        expect(result.success).toBe(false);
        expect(result.error).toContain('No stat points available');
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should reject invalid stat names without a DB call', async () => {
      const result = await allocateStatPoint(1, 'invalidStat');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid stat name');
    });

    it('should accept all valid stat names via validateStatName', () => {
      const validStats = [
        'speed',
        'stamina',
        'agility',
        'balance',
        'precision',
        'intelligence',
        'boldness',
        'flexibility',
        'obedience',
        'focus',
      ];

      for (const stat of validStats) {
        expect(validateStatName(stat)).toBe(true);
      }
    });
  });

  describe('getHorseXpHistory', () => {
    it('should retrieve horse XP events with proper filtering', async () => {
      const horse = await mkHorse('XpHistory1');
      try {
        await addXpToHorse(horse.id, 50, 'Competition: 1st place');
        await addXpToHorse(horse.id, 25, 'Training session');

        const result = await getHorseXpHistory(horse.id, { limit: 10 });

        expect(result.success).toBe(true);
        expect(result.events.length).toBeGreaterThanOrEqual(2);
        expect(result.events[0]).toHaveProperty('amount');
        expect(result.events[0]).toHaveProperty('reason');
        expect(result.pagination.limit).toBe(10);
      } finally {
        await rmHorse(horse.id);
      }
    });
  });
});

describe('Horse XP System - Integration with Competition System', () => {
  describe('Competition XP Awards', () => {
    it('should award horse XP based on competition performance', async () => {
      const horse = await mkHorse('CompXp1', { horseXp: 0, availableStatPoints: 0 });
      try {
        const expectedXP = 20 + 10; // 20 base + 10 for 1st place

        const result = await awardCompetitionXp(horse.id, '1st', 'Dressage');

        expect(result.success).toBe(true);
        expect(result.xpAwarded).toBe(expectedXP);
        expect(result.currentXP).toBe(expectedXP);
      } finally {
        await rmHorse(horse.id);
      }
    });
  });
});
