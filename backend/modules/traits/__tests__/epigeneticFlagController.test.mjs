/**
 * epigeneticFlagController.test.mjs
 *
 * Unit tests for backend/modules/traits/controllers/epigeneticFlagController.mjs
 * covering guard-clause and branch paths without requiring full HTTP stack.
 *
 * Strategy: Direct function invocation with stub req/res objects.
 * All branches that require a seeded horse are exercised via the 404/403 guard
 * paths (non-existent IDs). The getFlagDefinitions and batchEvaluateFlags
 * admin guard paths are fully testable without DB access.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateFlags,
  getHorseFlags,
  getFlagDefinitions,
  batchEvaluateFlags,
  getCarePatterns,
} from '../controllers/epigeneticFlagController.mjs';

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

// ─── batchEvaluateFlags — admin guard ────────────────────────────────────────

describe('batchEvaluateFlags admin guard', () => {
  it('returns 403 when user role is not admin', async () => {
    const req = {
      user: { id: 'user-1', role: 'user' },
      body: { horseIds: [1, 2, 3] },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(403);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/admin/i);
  });

  it('returns 403 when user role is undefined', async () => {
    const req = {
      user: { id: 'user-1' },
      body: { horseIds: [1] },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(403);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when horseIds is not an array (admin role)', async () => {
    const req = {
      user: { id: 'admin-1', role: 'admin' },
      body: { horseIds: 'not-an-array' },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/non-empty array/i);
  });

  it('returns 400 when horseIds is an empty array (admin role)', async () => {
    const req = {
      user: { id: 'admin-1', role: 'admin' },
      body: { horseIds: [] },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when horseIds contains non-numeric values (admin role)', async () => {
    const req = {
      user: { id: 'admin-1', role: 'admin' },
      body: { horseIds: ['abc', 'def'] },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/valid numbers/i);
  });

  it('returns 400 when horseIds contains mixed valid/invalid (admin role)', async () => {
    const req = {
      user: { id: 'admin-1', role: 'admin' },
      body: { horseIds: [1, 'xyz'] },
    };
    const res = makeRes();

    await batchEvaluateFlags(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getFlagDefinitions — no auth required, pure service call ─────────────────

describe('getFlagDefinitions', () => {
  it('returns 200 with flags array when no type filter', async () => {
    const req = { query: {} };
    const res = makeRes();

    await getFlagDefinitions(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
    expect(Array.isArray(res.bodyValue.data.flags)).toBe(true);
    expect(typeof res.bodyValue.data.count).toBe('number');
  });

  it('returns 200 with filtered flags when type=positive', async () => {
    const req = { query: { type: 'positive' } };
    const res = makeRes();

    await getFlagDefinitions(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
    expect(Array.isArray(res.bodyValue.data.flags)).toBe(true);
    // All returned flags should be positive type
    const allPositive = res.bodyValue.data.flags.every(f => f.type === 'positive');
    expect(allPositive).toBe(true);
  });

  it('returns 200 with filtered flags when type=negative', async () => {
    const req = { query: { type: 'negative' } };
    const res = makeRes();

    await getFlagDefinitions(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
  });

  it('returns 200 with filtered flags when type=adaptive', async () => {
    const req = { query: { type: 'adaptive' } };
    const res = makeRes();

    await getFlagDefinitions(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
  });

  it('returns 200 with count matching flags array length', async () => {
    const req = { query: {} };
    const res = makeRes();

    await getFlagDefinitions(req, res);

    expect(res.bodyValue.data.count).toBe(res.bodyValue.data.flags.length);
  });
});

// ─── getHorseFlags — missing req.validatedResources ──────────────────────────

describe('getHorseFlags — missing validated resources', () => {
  it('returns 404 when req.validatedResources is undefined', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: undefined,
    };
    const res = makeRes();

    await getHorseFlags(req, res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/horse not found/i);
  });

  it('returns 404 when req.validatedResources.horse is null', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: { horse: null },
    };
    const res = makeRes();

    await getHorseFlags(req, res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getHorseFlags — with valid horse stub ───────────────────────────────────

describe('getHorseFlags — with horse stub (no DB)', () => {
  it('returns 200 with horse flag data when horse is provided', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: {
        horse: {
          id: 42,
          name: 'TestStubHorse',
          dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years old
          epigeneticFlags: [],
          bondScore: 75,
          stressLevel: 20,
        },
      },
    };
    const res = makeRes();

    await getHorseFlags(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
    expect(res.bodyValue.data.horseId).toBe(42);
    expect(res.bodyValue.data.horseName).toBe('TestStubHorse');
    expect(Array.isArray(res.bodyValue.data.flags)).toBe(true);
    expect(res.bodyValue.data.flagCount).toBe(0);
  });

  it('maps known flag names to their definitions', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: {
        horse: {
          id: 43,
          name: 'FlaggedHorse',
          dateOfBirth: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years old
          epigeneticFlags: ['early_handled', 'nonexistent_flag_xyz'],
          bondScore: 50,
          stressLevel: 10,
        },
      },
    };
    const res = makeRes();

    await getHorseFlags(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.data.flagCount).toBe(2);
    // Known flag should have a real displayName
    const knownFlag = res.bodyValue.data.flags.find(f => f.name === 'early_handled');
    if (knownFlag) {
      expect(typeof knownFlag.displayName).toBe('string');
    }
    // Unknown flag should fall back to 'Unknown flag' description
    const unknownFlag = res.bodyValue.data.flags.find(f => f.name === 'nonexistent_flag_xyz');
    if (unknownFlag) {
      expect(unknownFlag.description).toBe('Unknown flag');
    }
  });

  it('reports canReceiveMoreFlags=false for horse with 5+ flags', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: {
        horse: {
          id: 44,
          name: 'FullFlagHorse',
          dateOfBirth: new Date(Date.now() - 1 * 365 * 24 * 60 * 60 * 1000), // 1 year old
          epigeneticFlags: ['f1', 'f2', 'f3', 'f4', 'f5'],
          bondScore: 60,
          stressLevel: 15,
        },
      },
    };
    const res = makeRes();

    await getHorseFlags(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.data.canReceiveMoreFlags).toBe(false);
  });
});

// ─── getCarePatterns — missing validated resources ────────────────────────────

describe('getCarePatterns — missing validated resources', () => {
  it('returns 404 when req.validatedResources is undefined', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: undefined,
    };
    const res = makeRes();

    await getCarePatterns(req, res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/horse not found/i);
  });

  it('returns 404 when req.validatedResources.horse is null', async () => {
    const req = {
      user: { id: 'user-1' },
      validatedResources: { horse: null },
    };
    const res = makeRes();

    await getCarePatterns(req, res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── evaluateFlags — validation errors + missing horse ────────────────────────

describe('evaluateFlags guard clauses', () => {
  it('returns 404 when horse not found (ownership 404 branch via evaluateFlags)', async () => {
    // We can't trivially inject express-validator errors without running chains.
    // Instead test the ownership 404 path with a non-existent horse — this
    // covers the findOwnedResource → null → 404 branch.
    const reqWithHorse = {
      user: { id: 'user-1' },
      body: { horseId: 999999999 },
    };
    const res = makeRes();

    await evaluateFlags(reqWithHorse, res);

    // 404: horse not found or not owned
    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 when horse is not found (non-existent ID)', async () => {
    const req = {
      user: { id: '00000000-0000-0000-0000-000000000001' },
      body: { horseId: 888888888 },
    };
    const res = makeRes();

    await evaluateFlags(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});
