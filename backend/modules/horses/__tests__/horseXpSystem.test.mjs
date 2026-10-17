/**
 * Horse XP System Tests
 *
 * Tests real business logic via horseXpModel.mjs against the actual DB.
 * No mocking of any kind.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
  addXpToHorse,
  allocateStatPoint,
  getHorseXpHistory,
  validateStatName,
  HORSE_POINTS_PER_STAT_POINT as P,
} from '../services/horseXpModelService.mjs';
// Owner ruling C15 (2026-10-16; Equoria-576c0 B13): 1,000 Horse Points per stat
// allocation. Old contract: 100. The point amounts below are the old scenarios at
// the new scale; every assertion keeps its meaning.

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
      const horse = await mkHorse('AddXp1', { horseXp: P / 2, availableStatPoints: 0 });
      const result = await addXpToHorse(horse.id, P, 'Competition participation');

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(1.5 * P);
      expect(result.availableStatPoints).toBe(1);
      expect(result.xpGained).toBe(P);
      expect(result.statPointsGained).toBe(1);
    });

    it('should handle multiple stat points correctly (200+ XP)', async () => {
      const horse = await mkHorse('AddXp2', { horseXp: P / 2, availableStatPoints: 0 });
      const result = await addXpToHorse(horse.id, 2 * P, 'Major competition win');

      expect(result.success).toBe(true);
      expect(result.currentXP).toBe(2.5 * P);
      expect(result.availableStatPoints).toBe(2);
      expect(result.statPointsGained).toBe(2);
    });

    it('should preserve existing stat points when adding XP', async () => {
      const horse = await mkHorse('AddXp3', { horseXp: 1.5 * P, availableStatPoints: 1 });
      const result = await addXpToHorse(horse.id, P, 'Training session');

      expect(result.success).toBe(true);
      expect(result.availableStatPoints).toBe(2);
      expect(result.statPointsGained).toBe(1);
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
      const result = await allocateStatPoint(horse.id, 'speed');

      expect(result.success).toBe(true);
      expect(result.newStatValue).toBe(76);
      expect(result.remainingStatPoints).toBe(1);
    });

    it('should reject allocation when no stat points available', async () => {
      const horse = await mkHorse('AllocStat2', { availableStatPoints: 0 });
      const result = await allocateStatPoint(horse.id, 'speed');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No stat points available');
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
      await addXpToHorse(horse.id, 50, 'Competition: 1st place');
      await addXpToHorse(horse.id, 25, 'Training session');

      const result = await getHorseXpHistory(horse.id, { limit: 10 });

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThanOrEqual(2);
      expect(result.events[0]).toHaveProperty('amount');
      expect(result.events[0]).toHaveProperty('reason');
      expect(result.pagination.limit).toBe(10);
    });
  });
});
