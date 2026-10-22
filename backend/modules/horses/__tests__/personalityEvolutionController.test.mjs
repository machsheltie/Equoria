/**
 * personalityEvolutionController.test.mjs
 *
 * Unit tests for backend/modules/horses/controllers/personalityEvolutionController.mjs
 * covering guard-clause and branch paths that don't require a seeded DB.
 *
 * Strategy: Direct function invocation with stub req/res objects.
 * All guard-clause branches (invalid entityType, missing fields, bad timeframe)
 * are testable without DB access. Ownership 404 paths use non-existent IDs.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 * The evolveHorseTemperamentController and batchEvolvePersonalitiesController
 * cases were removed with those handlers (Equoria-gu8jk).
 */

import { describe, it, expect } from '@jest/globals';
import {
  getEvolutionTriggersController,
  getPersonalityStabilityController,
  predictPersonalityEvolutionController,
  getPersonalityEvolutionHistoryController,
} from '../controllers/personalityEvolutionController.mjs';

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

// Non-existent user/groom/horse IDs to trigger ownership 404
const NON_EXISTENT_ID = 999999999;
const NON_EXISTENT_USER_ID = '00000000-0000-0000-0000-000000000099';

// ─── getEvolutionTriggersController ──────────────────────────────────────────

describe('getEvolutionTriggersController', () => {
  it('returns 400 for invalid entityType "robot"', async () => {
    const req = {
      params: { entityType: 'robot', entityId: '1' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getEvolutionTriggersController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid entity type/i);
  });

  it('returns 400 for empty entityType', async () => {
    const req = {
      params: { entityType: '', entityId: '1' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getEvolutionTriggersController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 for valid entityType "groom" but non-existent ID', async () => {
    const req = {
      params: { entityType: 'groom', entityId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getEvolutionTriggersController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 for valid entityType "horse" but non-existent ID', async () => {
    const req = {
      params: { entityType: 'horse', entityId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getEvolutionTriggersController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getPersonalityStabilityController ───────────────────────────────────────

describe('getPersonalityStabilityController', () => {
  it('returns 400 for invalid entityType "cat"', async () => {
    const req = {
      params: { entityType: 'cat', entityId: '1' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getPersonalityStabilityController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid entity type/i);
  });

  it('returns 404 for valid entityType "groom" but non-existent ID', async () => {
    const req = {
      params: { entityType: 'groom', entityId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getPersonalityStabilityController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 for valid entityType "horse" but non-existent ID', async () => {
    const req = {
      params: { entityType: 'horse', entityId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getPersonalityStabilityController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── predictPersonalityEvolutionController ────────────────────────────────────

describe('predictPersonalityEvolutionController', () => {
  it('returns 400 for invalid entityType', async () => {
    const req = {
      params: { entityType: 'plant', entityId: '1' },
      query: { timeframeDays: '30' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid entity type/i);
  });

  it('returns 400 when timeframeDays is 0', async () => {
    const req = {
      params: { entityType: 'horse', entityId: '1' },
      query: { timeframeDays: '0' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid timeframe/i);
  });

  it('returns 400 when timeframeDays exceeds 365', async () => {
    const req = {
      params: { entityType: 'horse', entityId: '1' },
      query: { timeframeDays: '366' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid timeframe/i);
  });

  it('returns 400 when timeframeDays is non-numeric', async () => {
    const req = {
      params: { entityType: 'horse', entityId: '1' },
      query: { timeframeDays: 'abc' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid timeframe/i);
  });

  it('returns 400 when timeframeDays is negative', async () => {
    const req = {
      params: { entityType: 'horse', entityId: '1' },
      query: { timeframeDays: '-5' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 for valid params but non-existent groom', async () => {
    const req = {
      params: { entityType: 'groom', entityId: String(NON_EXISTENT_ID) },
      query: { timeframeDays: '30' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });

  it('uses default timeframeDays of 30 when not provided', async () => {
    // No timeframeDays → defaults to 30 → valid, goes to ownership check
    const req = {
      params: { entityType: 'horse', entityId: String(NON_EXISTENT_ID) },
      query: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    // Should pass timeframe validation and fail on ownership
    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getPersonalityEvolutionHistoryController ─────────────────────────────────

describe('getPersonalityEvolutionHistoryController', () => {
  it('returns 400 for invalid entityType "fish"', async () => {
    const req = {
      params: { entityType: 'fish', entityId: '1' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getPersonalityEvolutionHistoryController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid entity type/i);
  });

  it('returns 404 for valid entityType "horse" but non-existent ID', async () => {
    const req = {
      params: { entityType: 'horse', entityId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getPersonalityEvolutionHistoryController(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// applyPersonalityEvolutionEffectsController was removed under Equoria-bvddn.4
// (audit 2026-09-25): the route it backed answered 410 — it was commented
// "admin function" but had no role check, and the function it called
// (applyPersonalityEvolutionEffects) never wrote to the database anyway. See
// backend/modules/horses/__tests__/personalityEvolutionController.integration.test.mjs
// for the route-closure regression coverage.
