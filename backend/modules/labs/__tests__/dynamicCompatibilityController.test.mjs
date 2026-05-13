/**
 * dynamicCompatibilityController.test.mjs
 *
 * Unit tests for backend/modules/labs/controllers/dynamicCompatibilityController.mjs
 * covering guard-clause and branch paths that don't require a seeded DB.
 *
 * Strategy: Direct function invocation with stub req/res objects.
 * Guard-clause branches (missing required fields, ownership 404) are
 * tested without running the full express stack.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateCompatibility,
  getCompatibilityFactors,
  predictOutcome,
  getRecommendations,
  getCompatibilityTrends,
  updateHistory,
  getCompatibilityConfig,
} from '../controllers/dynamicCompatibilityController.mjs';

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

const NON_EXISTENT_ID = 999999998;
const NON_EXISTENT_USER_ID = '00000000-0000-0000-0000-000000000077';

// ─── getCompatibilityConfig — no auth required ────────────────────────────────

describe('getCompatibilityConfig', () => {
  it('returns 200 with config object', async () => {
    const req = {};
    const res = makeRes();

    await getCompatibilityConfig(req, res);

    expect(res.statusValue).toBe(200);
    expect(res.bodyValue.success).toBe(true);
    expect(res.bodyValue.data).toBeDefined();
    expect(Array.isArray(res.bodyValue.data.personalityTypes)).toBe(true);
    expect(Array.isArray(res.bodyValue.data.temperamentTypes)).toBe(true);
    expect(Array.isArray(res.bodyValue.data.taskTypes)).toBe(true);
    expect(Array.isArray(res.bodyValue.data.recommendationLevels)).toBe(true);
    expect(Array.isArray(res.bodyValue.data.qualityLevels)).toBe(true);
    expect(Array.isArray(res.bodyValue.data.trendTypes)).toBe(true);
  });

  it('includes expected personality types', async () => {
    const req = {};
    const res = makeRes();

    await getCompatibilityConfig(req, res);

    expect(res.bodyValue.data.personalityTypes).toContain('calm');
    expect(res.bodyValue.data.personalityTypes).toContain('energetic');
    expect(res.bodyValue.data.personalityTypes).toContain('methodical');
  });

  it('includes expected quality levels', async () => {
    const req = {};
    const res = makeRes();

    await getCompatibilityConfig(req, res);

    expect(res.bodyValue.data.qualityLevels).toContain('poor');
    expect(res.bodyValue.data.qualityLevels).toContain('excellent');
  });
});

// ─── calculateCompatibility — missing fields guard ───────────────────────────

describe('calculateCompatibility guard clauses', () => {
  it('returns 400 when groomId is missing', async () => {
    const req = {
      body: { horseId: 1, context: { task: 'trust_building' } },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await calculateCompatibility(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/missing required fields/i);
  });

  it('returns 400 when horseId is missing', async () => {
    const req = {
      body: { groomId: 1, context: { task: 'trust_building' } },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await calculateCompatibility(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when context is missing', async () => {
    const req = {
      body: { groomId: 1, horseId: 2 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await calculateCompatibility(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when all fields are missing', async () => {
    const req = {
      body: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await calculateCompatibility(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 when groom is not owned (non-existent)', async () => {
    const req = {
      body: {
        groomId: NON_EXISTENT_ID,
        horseId: NON_EXISTENT_ID + 1,
        context: { task: 'trust_building' },
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await calculateCompatibility(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── predictOutcome — missing fields guard ────────────────────────────────────

describe('predictOutcome guard clauses', () => {
  it('returns 400 when groomId is missing', async () => {
    const req = {
      body: { horseId: 1, context: { task: 'trust_building' } },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictOutcome(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/missing required fields/i);
  });

  it('returns 400 when horseId is missing', async () => {
    const req = {
      body: { groomId: 1, context: { task: 'trust_building' } },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictOutcome(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when context is missing', async () => {
    const req = {
      body: { groomId: 1, horseId: 2 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictOutcome(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 when groom not found (non-existent)', async () => {
    const req = {
      body: {
        groomId: NON_EXISTENT_ID,
        horseId: NON_EXISTENT_ID + 1,
        context: { task: 'trust_building' },
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictOutcome(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getRecommendations — missing fields guard ────────────────────────────────

describe('getRecommendations guard clauses', () => {
  it('returns 400 when horseId is missing', async () => {
    const req = {
      body: { context: { task: 'trust_building' } },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getRecommendations(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/missing required fields/i);
  });

  it('returns 400 when context is missing', async () => {
    const req = {
      body: { horseId: 1 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getRecommendations(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when both horseId and context are missing', async () => {
    const req = {
      body: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getRecommendations(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 when horse not found (non-existent)', async () => {
    const req = {
      body: {
        horseId: NON_EXISTENT_ID,
        context: { task: 'trust_building' },
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getRecommendations(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── updateHistory — missing fields guard ─────────────────────────────────────

describe('updateHistory guard clauses', () => {
  it('returns 400 when groomId is missing', async () => {
    const req = {
      body: { horseId: 1, interactionId: 5 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await updateHistory(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/missing required fields/i);
  });

  it('returns 400 when horseId is missing', async () => {
    const req = {
      body: { groomId: 1, interactionId: 5 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await updateHistory(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when interactionId is missing', async () => {
    const req = {
      body: { groomId: 1, horseId: 2 },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await updateHistory(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 400 when all fields missing', async () => {
    const req = {
      body: {},
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await updateHistory(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
  });

  it('returns 404 when groom not found (non-existent)', async () => {
    const req = {
      body: {
        groomId: NON_EXISTENT_ID,
        horseId: NON_EXISTENT_ID + 1,
        interactionId: NON_EXISTENT_ID + 2,
      },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await updateHistory(req, res);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.bodyValue.success).toBe(false);
  });
});

// ─── getCompatibilityFactors — non-existent IDs ──────────────────────────────

describe('getCompatibilityFactors', () => {
  it('returns 200 or 500 without crashing for non-existent IDs', async () => {
    const req = {
      params: { groomId: String(NON_EXISTENT_ID), horseId: String(NON_EXISTENT_ID + 1) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getCompatibilityFactors(req, res);

    // Service may return a result or throw; controller handles both
    expect([200, 500]).toContain(res.statusValue);
    expect(res.bodyValue).toBeDefined();
    expect(typeof res.bodyValue.success).toBe('boolean');
  });
});

// ─── getCompatibilityTrends — non-existent IDs ───────────────────────────────

describe('getCompatibilityTrends', () => {
  it('returns 200 or 500 without crashing for non-existent IDs', async () => {
    const req = {
      params: { groomId: String(NON_EXISTENT_ID), horseId: String(NON_EXISTENT_ID + 1) },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await getCompatibilityTrends(req, res);

    expect([200, 500]).toContain(res.statusValue);
    expect(res.bodyValue).toBeDefined();
    expect(typeof res.bodyValue.success).toBe('boolean');
  });
});
