/**
 * Horse XP Controller Tests
 *
 * Tests controller endpoints with real DB fixtures and plain JS response capture.
 * No mocking of any kind.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prisma from '../db/index.mjs';
import { fixtureColor } from './helpers/fixtureColor.mjs';
import { clearAllCache } from '../utils/cacheHelper.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';
import { addXpToHorse } from '../models/horseXpModel.mjs';

const PREFIX = 'TestFixture-HorseXpCtrl-';
const USER_ID = 'test-user-horse-xp-ctrl';
const OTHER_USER_ID = 'test-other-user-xp-ctrl';

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
}

async function mkHorse(suffix, opts = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}${suffix}`,
      sex: 'Colt',
      dateOfBirth: new Date('2020-01-01'),
      age: 0,
      userId: opts.userId ?? USER_ID,
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
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
  await prisma.user.createMany({
    data: [
      {
        id: USER_ID,
        username: 'horsexpCtrlUser',
        email: 'horsexpctrl@example.com',
        password: 'TestPassword123!',
        firstName: 'Horse',
        lastName: 'XP',
        money: 5000,
      },
      {
        id: OTHER_USER_ID,
        username: 'otherXpUser',
        email: 'otherxpctrl@example.com',
        password: 'TestPassword123!',
        firstName: 'Other',
        lastName: 'User',
        money: 1000,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { in: [USER_ID, OTHER_USER_ID] } } });
});

beforeEach(async () => {
  try {
    await clearAllCache();
  } catch {
    // Redis may not be available in test environment
  }
});

describe('Horse XP Controller - API Endpoints', () => {
  describe('getHorseXpStatus', () => {
    it('should return horse XP status for authorized user', async () => {
      const horse = await mkHorse('Status1', { horseXp: 150, availableStatPoints: 1 });
      try {
        const req = { params: { horseId: String(horse.id) }, user: { id: USER_ID } };
        const res = makeRes();

        await horseXpController.getHorseXpStatus(req, res);

        expect(res._json).toEqual({
          success: true,
          data: {
            horseId: horse.id,
            horseName: horse.name,
            currentXP: 150,
            availableStatPoints: 1,
            nextStatPointAt: 200,
            xpToNextStatPoint: 50,
          },
        });
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should reject unauthorized access to another user horse with 404', async () => {
      const horse = await mkHorse('Status2', { userId: OTHER_USER_ID, horseXp: 150 });
      try {
        const req = { params: { horseId: String(horse.id) }, user: { id: USER_ID } };
        const res = makeRes();

        await horseXpController.getHorseXpStatus(req, res);

        expect(res._status).toBe(404);
        expect(res._json).toEqual({ success: false, error: 'Horse not found' });
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should handle horse not found', async () => {
      const req = { params: { horseId: '999999999' }, user: { id: USER_ID } };
      const res = makeRes();

      await horseXpController.getHorseXpStatus(req, res);

      expect(res._status).toBe(404);
      expect(res._json).toEqual({ success: false, error: 'Horse not found' });
    });
  });

  describe('allocateStatPoint', () => {
    it('should allocate stat point successfully', async () => {
      const horse = await mkHorse('AllocCtrl1', { availableStatPoints: 2, speed: 75 });
      try {
        const req = {
          params: { horseId: String(horse.id) },
          body: { statName: 'speed' },
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.allocateStatPoint(req, res);

        expect(res._json).toEqual({
          success: true,
          data: {
            statName: 'speed',
            newStatValue: 76,
            remainingStatPoints: 1,
          },
        });
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should validate stat name and return 400', async () => {
      const horse = await mkHorse('AllocCtrl2', { availableStatPoints: 1 });
      try {
        const req = {
          params: { horseId: String(horse.id) },
          body: { statName: 'invalidStat' },
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.allocateStatPoint(req, res);

        expect(res._status).toBe(400);
        expect(res._json).toEqual({
          success: false,
          error: expect.stringContaining('Invalid stat name'),
        });
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should require stat name in request body', async () => {
      const horse = await mkHorse('AllocCtrl3', { availableStatPoints: 1 });
      try {
        const req = {
          params: { horseId: String(horse.id) },
          body: {},
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.allocateStatPoint(req, res);

        expect(res._status).toBe(400);
        expect(res._json).toEqual({
          success: false,
          error: 'statName is required',
        });
      } finally {
        await rmHorse(horse.id);
      }
    });
  });

  describe('getHorseXpHistory', () => {
    it('should return horse XP history with pagination', async () => {
      const horse = await mkHorse('HistCtrl1');
      try {
        await addXpToHorse(horse.id, 30, 'Competition: 1st place in Dressage');
        await addXpToHorse(horse.id, 20, 'Training session');

        const req = {
          params: { horseId: String(horse.id) },
          query: { limit: '10', offset: '0' },
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.getHorseXpHistory(req, res);

        expect(res._json.success).toBe(true);
        expect(res._json.data.events.length).toBeGreaterThanOrEqual(2);
        expect(res._json.data.pagination).toMatchObject({ limit: 10, offset: 0 });
      } finally {
        await rmHorse(horse.id);
      }
    });
  });

  describe('awardXpToHorse', () => {
    it('should award XP to horse and return updated status', async () => {
      const horse = await mkHorse('AwardCtrl1', { horseXp: 50, availableStatPoints: 0 });
      try {
        const req = {
          params: { horseId: String(horse.id) },
          body: { amount: 50, reason: 'Competition participation' },
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.awardXpToHorse(req, res);

        expect(res._json.success).toBe(true);
        expect(res._json.data.currentXP).toBe(100);
        expect(res._json.data.xpGained).toBe(50);
        expect(res._json.data.statPointsGained).toBe(1);
        expect(res._json.data.availableStatPoints).toBe(1);
      } finally {
        await rmHorse(horse.id);
      }
    });

    it('should validate XP amount and return 400', async () => {
      const horse = await mkHorse('AwardCtrl2');
      try {
        const req = {
          params: { horseId: String(horse.id) },
          body: { amount: -10, reason: 'Test' },
          user: { id: USER_ID },
        };
        const res = makeRes();

        await horseXpController.awardXpToHorse(req, res);

        expect(res._status).toBe(400);
        expect(res._json).toEqual({
          success: false,
          error: 'XP amount must be a positive number',
        });
      } finally {
        await rmHorse(horse.id);
      }
    });
  });
});
