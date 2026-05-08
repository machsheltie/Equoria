/**
 * Integration tests for progressionController — HTTP handlers and direct functions.
 * Equoria-rr7 coverage sprint.
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../db/index.mjs';
import {
  getUserProgression,
  awardXp,
  checkLevelUp,
  addXpToUser,
  getUserProgress,
} from '../../modules/users/controllers/progressionController.mjs';

const PREFIX = 'TestFixture-Progression-';

function uid() {
  return randomBytes(6).toString('hex');
}

function makeRes() {
  let _status = 200;
  let _body = null;
  return {
    status(code) {
      _status = code;
      return this;
    },
    json(body) {
      _body = body;
      return this;
    },
    get statusValue() {
      return _status;
    },
    get jsonValue() {
      return _body;
    },
  };
}

function makeNext() {
  let _error = null;
  const fn = err => {
    _error = err;
  };
  fn.getError = () => _error;
  return fn;
}

let user;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      id: `${PREFIX}${uid()}`,
      username: `prog_${uid()}`,
      email: `${PREFIX}${uid()}@test.com`,
      password: 'irrelevant',
      firstName: 'Prog',
      lastName: 'Tester',
      level: 1,
      xp: 0,
      money: 1000,
    },
  });
}, 30000);

afterAll(async () => {
  if (user) {
    await prisma.xpEvent.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

// ─── getUserProgression ───────────────────────────────────────────────────────

describe('getUserProgression', () => {
  it('returns 200 with progression data for a valid user', async () => {
    const req = { params: { userId: user.id } };
    const res = makeRes();
    const next = makeNext();

    await getUserProgression(req, res, next);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.success).toBe(true);
    expect(res.jsonValue.data.currentLevel).toBe(1);
    expect(typeof res.jsonValue.data.currentXp).toBe('number');
    expect(typeof res.jsonValue.data.xpForNextLevel).toBe('number');
    expect(typeof res.jsonValue.data.progressPercentage).toBe('number');
  });

  it('returns 404 when user does not exist', async () => {
    const req = { params: { userId: `${PREFIX}nonexistent-${uid()}` } };
    const res = makeRes();
    const next = makeNext();

    await getUserProgression(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(res.jsonValue.success).toBe(false);
  });

  it('returns 400 when userId is missing', async () => {
    const req = { params: {} };
    const res = makeRes();
    const next = makeNext();

    await getUserProgression(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
  });

  it('progressPercentage is clamped between 0 and 100', async () => {
    const req = { params: { userId: user.id } };
    const res = makeRes();
    await getUserProgression(req, res, makeNext());

    const pct = res.jsonValue.data.progressPercentage;
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });
});

// ─── awardXp ─────────────────────────────────────────────────────────────────

describe('awardXp', () => {
  it('returns 200 and awards XP to a valid user', async () => {
    const req = { params: { userId: user.id }, body: { amount: 10, reason: 'test award' } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(200);
    expect(res.jsonValue.success).toBe(true);
    expect(res.jsonValue.data).toBeDefined();
  });

  it('returns 400 when userId is missing', async () => {
    const req = { params: {}, body: { amount: 10 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
    expect(res.jsonValue.message).toMatch(/User ID/i);
  });

  it('returns 400 when amount is missing', async () => {
    const req = { params: { userId: user.id }, body: {} };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
  });

  it('returns 400 when amount is zero', async () => {
    const req = { params: { userId: user.id }, body: { amount: 0 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const req = { params: { userId: user.id }, body: { amount: -5 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
  });

  it('returns 400 when amount is a string', async () => {
    const req = { params: { userId: user.id }, body: { amount: 'ten' } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
  });
});

// ─── checkLevelUp ────────────────────────────────────────────────────────────

describe('checkLevelUp', () => {
  it('returns leveledUp: false when user xp is below level threshold', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { xp: 0, level: 1 } });
    const result = await checkLevelUp(user.id);

    expect(result.leveledUp).toBe(false);
    expect(result.currentLevel).toBe(1);
  });

  it('returns leveledUp: true when xp exceeds current level threshold', async () => {
    // Set user to xp=400 but level=1 — should trigger level up to 2
    await prisma.user.update({ where: { id: user.id }, data: { xp: 400, level: 1 } });
    const result = await checkLevelUp(user.id);

    expect(result.leveledUp).toBe(true);
    expect(result.oldLevel).toBe(1);
    expect(result.newLevel).toBe(2);
    expect(result.levelsGained).toBe(1);
  });

  it('throws when user does not exist', async () => {
    await expect(checkLevelUp(`${PREFIX}no-such-user`)).rejects.toThrow('User not found');
  });
});

// ─── addXpToUser ─────────────────────────────────────────────────────────────

describe('addXpToUser (progressionController wrapper)', () => {
  it('throws when userId is falsy', async () => {
    await expect(addXpToUser('', 10)).rejects.toThrow('User ID is required.');
  });

  it('throws when amount is zero or negative', async () => {
    await expect(addXpToUser(user.id, 0)).rejects.toThrow('XP amount must be a positive number.');
    await expect(addXpToUser(user.id, -1)).rejects.toThrow('XP amount must be a positive number.');
  });

  it('returns result with success: true for valid inputs', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { xp: 0, level: 1 } });
    const result = await addXpToUser(user.id, 5);

    expect(result.success).toBe(true);
    expect(result.xpGained).toBe(5);
  });
});

// ─── getUserProgress ─────────────────────────────────────────────────────────

describe('getUserProgress', () => {
  it('throws when userId is falsy', async () => {
    await expect(getUserProgress('')).rejects.toThrow();
  });

  it('throws when user does not exist', async () => {
    await expect(getUserProgress(`${PREFIX}no-such-user`)).rejects.toThrow('User not found.');
  });

  it('returns valid progress object for existing user', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { xp: 0, level: 1 } });
    const result = await getUserProgress(user.id);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe(user.id);
    expect(typeof result.level).toBe('number');
    expect(typeof result.xp).toBe('number');
    expect(typeof result.money).toBe('number');
  });
});
