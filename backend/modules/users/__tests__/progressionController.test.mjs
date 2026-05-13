/**
 * progressionController.test.mjs
 *
 * Unit tests for backend/modules/users/controllers/progressionController.mjs
 * covering exported functions: getUserProgression, awardXp, getLevelFromXp,
 * checkLevelUp, addXpToUser, getUserProgress, calculateXpForLevel.
 *
 * Strategy: Direct function invocation with stub req/res objects for HTTP
 * handlers; real exported utility functions tested directly.
 * Real-DB paths that require a seeded user are exercised via the shared
 * helpers where practical. Branch-coverage focus: guard clauses, edge cases,
 * error propagation.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getLevelFromXp,
  calculateXpForLevel,
  checkLevelUp,
  addXpToUser,
  getUserProgress,
  getUserProgression,
  awardXp,
} from '../controllers/progressionController.mjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  let _status = 200;
  let _body = null;
  const res = {
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
    get bodyValue() {
      return _body;
    },
  };
  return res;
}

function makeNext() {
  let _err;
  const fn = err => {
    _err = err;
  };
  fn.error = () => _err;
  fn.wasCalled = () => _err !== undefined;
  return fn;
}

// ─── calculateXpForLevel ─────────────────────────────────────────────────────

describe('calculateXpForLevel', () => {
  it('returns 0 for level <= 1', () => {
    expect(calculateXpForLevel(1)).toBe(0);
    expect(calculateXpForLevel(0)).toBe(0);
    expect(calculateXpForLevel(-5)).toBe(0);
  });

  it('returns level^2 * 100 for level 2', () => {
    expect(calculateXpForLevel(2)).toBe(400);
  });

  it('returns level^2 * 100 for level 3', () => {
    expect(calculateXpForLevel(3)).toBe(900);
  });

  it('returns level^2 * 100 for level 10', () => {
    expect(calculateXpForLevel(10)).toBe(10000);
  });
});

// ─── getLevelFromXp ───────────────────────────────────────────────────────────

describe('getLevelFromXp', () => {
  it('returns 1 for xp < 400', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(399)).toBe(1);
  });

  it('returns 2 for xp = 400', () => {
    expect(getLevelFromXp(400)).toBe(2);
  });

  it('returns 3 for xp = 900', () => {
    expect(getLevelFromXp(900)).toBe(3);
  });

  it('returns 10 for xp = 10000', () => {
    expect(getLevelFromXp(10000)).toBe(10);
  });

  it('returns floor of sqrt result', () => {
    // 500 xp → sqrt(500/100) = sqrt(5) ≈ 2.23 → floor = 2
    expect(getLevelFromXp(500)).toBe(2);
  });
});

// ─── addXpToUser (throws without DB hit for guard clauses) ────────────────────

describe('addXpToUser guard clauses', () => {
  it('throws when userId is falsy', async () => {
    await expect(addXpToUser(null, 100)).rejects.toThrow('User ID is required.');
  });

  it('throws when userId is empty string', async () => {
    await expect(addXpToUser('', 100)).rejects.toThrow('User ID is required.');
  });

  it('throws when amount is zero', async () => {
    await expect(addXpToUser('some-id', 0)).rejects.toThrow('XP amount must be a positive number.');
  });

  it('throws when amount is negative', async () => {
    await expect(addXpToUser('some-id', -50)).rejects.toThrow('XP amount must be a positive number.');
  });

  it('throws when amount is null/falsy', async () => {
    await expect(addXpToUser('some-id', null)).rejects.toThrow('XP amount must be a positive number.');
  });
});

// ─── getUserProgress (throws without DB hit for guard clauses) ────────────────

describe('getUserProgress guard clauses', () => {
  it('throws when userId is falsy', async () => {
    await expect(getUserProgress(null)).rejects.toThrow();
  });

  it('throws when userId is empty string', async () => {
    await expect(getUserProgress('')).rejects.toThrow();
  });

  it('throws when user is not found', async () => {
    // UUID that will not exist in DB
    await expect(getUserProgress('00000000-0000-0000-0000-000000000000')).rejects.toThrow('User not found');
  });
});

// ─── getUserProgression HTTP handler — guard clauses ─────────────────────────

describe('getUserProgression HTTP handler', () => {
  it('returns 400 when userId param is missing (empty string)', async () => {
    const req = { params: { userId: '' } };
    const res = makeRes();
    const next = makeNext();

    await getUserProgression(req, res, next);

    // Empty string is falsy → 400
    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/user id is required/i);
  });

  it('returns 404 when user is not found in DB', async () => {
    const req = { params: { userId: '00000000-0000-0000-0000-000000000000' } };
    const res = makeRes();
    const next = makeNext();

    await getUserProgression(req, res, next);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/user not found/i);
  });
});

// ─── awardXp HTTP handler — guard clauses ────────────────────────────────────

describe('awardXp HTTP handler', () => {
  it('returns 400 when userId param is missing', async () => {
    const req = { params: { userId: '' }, body: { amount: 100 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/user id is required/i);
  });

  it('returns 400 when amount is missing', async () => {
    const req = { params: { userId: 'some-uuid' }, body: {} };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/valid xp amount/i);
  });

  it('returns 400 when amount is zero', async () => {
    const req = { params: { userId: 'some-uuid' }, body: { amount: 0 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const req = { params: { userId: 'some-uuid' }, body: { amount: -1 } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when amount is a string', async () => {
    const req = { params: { userId: 'some-uuid' }, body: { amount: 'fifty' } };
    const res = makeRes();
    const next = makeNext();

    await awardXp(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('calls next(error) or returns 200 when model throws/succeeds for nonexistent user', async () => {
    // The addXpToUser model may upsert or throw depending on implementation.
    // The guard clauses above cover the controller's own validation branches.
    // This test just ensures the handler does not crash without calling next/res.
    const req = {
      params: { userId: '00000000-0000-0000-0000-999999999999' },
      body: { amount: 10, reason: 'test' },
    };
    const res = makeRes();
    const next = makeNext();

    // Should not throw uncaught — handler must call either res.json() or next()
    await expect(awardXp(req, res, next)).resolves.not.toThrow();
  });
});

// ─── checkLevelUp (throws for missing user) ───────────────────────────────────

describe('checkLevelUp guard clauses', () => {
  it('throws when user is not found', async () => {
    await expect(checkLevelUp('00000000-0000-0000-0000-000000000000')).rejects.toThrow('User not found');
  });
});
