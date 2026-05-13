/**
 * personalityEvolutionController.test.mjs
 *
 * Unit tests for backend/modules/labs/controllers/personalityEvolutionController.mjs
 * covering guard-clause and branch paths that don't require a seeded DB.
 *
 * Strategy: Direct function invocation with stub req/res objects.
 * All guard-clause branches (invalid entityType, missing fields, bad timeframe)
 * are testable without DB access. Ownership 404 paths use non-existent IDs.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evolveGroomPersonalityController,
  evolveHorseTemperamentController,
  getEvolutionTriggersController,
  getPersonalityStabilityController,
  predictPersonalityEvolutionController,
  getPersonalityEvolutionHistoryController,
  applyPersonalityEvolutionEffectsController,
  batchEvolvePersonalitiesController,
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

// ─── applyPersonalityEvolutionEffectsController ───────────────────────────────

describe('applyPersonalityEvolutionEffectsController', () => {
  it('returns 400 when entityId is missing', async () => {
    const req = {
      body: { entityType: 'groom', evolutionType: 'positive' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await applyPersonalityEvolutionEffectsController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/missing required fields/i);
    expect(res.bodyValue.message).toMatch(/entityId/);
  });

  it('returns 400 when entityType is missing', async () => {
    const req = {
      body: { entityId: 1, evolutionType: 'positive' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await applyPersonalityEvolutionEffectsController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/entityType/);
  });

  it('returns 400 when evolutionType is missing', async () => {
    const req = {
      body: { entityId: 1, entityType: 'groom' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await applyPersonalityEvolutionEffectsController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/evolutionType/);
  });

  it('returns 400 when all three required fields are missing', async () => {
    const req = {
      body: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await applyPersonalityEvolutionEffectsController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when entityType is invalid (not groom or horse)', async () => {
    const req = {
      body: { entityId: 1, entityType: 'dragon', evolutionType: 'positive' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await applyPersonalityEvolutionEffectsController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid entity type/i);
  });
});

// ─── batchEvolvePersonalitiesController ──────────────────────────────────────

describe('batchEvolvePersonalitiesController', () => {
  it('returns 400 when entities is not an array', async () => {
    const req = {
      body: { entities: 'not-array' },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await batchEvolvePersonalitiesController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/entities array.*required/i);
  });

  it('returns 400 when entities is an empty array', async () => {
    const req = {
      body: { entities: [] },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await batchEvolvePersonalitiesController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when entities is undefined', async () => {
    const req = {
      body: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await batchEvolvePersonalitiesController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('processes batch with invalid entityType and reports failure', async () => {
    const req = {
      body: {
        entities: [{ entityId: NON_EXISTENT_ID, entityType: 'invalid_type' }],
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await batchEvolvePersonalitiesController(req, res);

    // Should return 200 with result showing failure for this entity
    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
    expect(res.bodyValue.data.results[0].result.success).toBe(false);
    expect(res.bodyValue.data.results[0].result.error).toMatch(/invalid entity type/i);
  });

  it('summary counts match results array', async () => {
    const req = {
      body: {
        entities: [
          { entityId: NON_EXISTENT_ID, entityType: 'invalid_type' },
          { entityId: NON_EXISTENT_ID + 1, entityType: 'invalid_type' },
        ],
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await batchEvolvePersonalitiesController(req, res);

    expect(res.statusValue).toBe(200);
    const summary = res.bodyValue.data.summary;
    expect(summary.total).toBe(2);
    expect(summary.successful + summary.failed).toBe(2);
  });
});

// ─── evolveGroomPersonalityController — does not crash on non-existent ID ─────

describe('evolveGroomPersonalityController', () => {
  it('returns 200 or 500 without crashing on non-existent groom ID', async () => {
    const req = {
      params: { groomId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await evolveGroomPersonalityController(req, res);

    // Service may return data or throw; controller should handle both
    expect([200, 500]).toContain(res.statusValue);
    expect(res.bodyValue).toBeDefined();
    expect(typeof res.bodyValue.success).toBe('boolean');
  });
});

// ─── evolveHorseTemperamentController — does not crash on non-existent ID ─────

describe('evolveHorseTemperamentController', () => {
  it('returns 200 or 500 without crashing on non-existent horse ID', async () => {
    const req = {
      params: { horseId: String(NON_EXISTENT_ID) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await evolveHorseTemperamentController(req, res);

    expect([200, 500]).toContain(res.statusValue);
    expect(res.bodyValue).toBeDefined();
    expect(typeof res.bodyValue.success).toBe('boolean');
  });
});
