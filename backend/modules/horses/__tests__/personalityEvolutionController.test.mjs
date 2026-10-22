/**
 * personalityEvolutionController.test.mjs
 *
 * Unit tests for backend/modules/horses/controllers/personalityEvolutionController.mjs
 * covering guard-clause and branch paths that don't require a seeded DB.
 *
 * Strategy: Direct function invocation with stub req/res objects.
 * The timeframe guard is testable without DB access. Ownership 404 paths use
 * non-existent IDs.
 *
 * Equoria-rr7 coverage sprint — module controller branches.
 * The evolveHorseTemperamentController and batchEvolvePersonalitiesController
 * cases were removed with those handlers (Equoria-gu8jk).
 *
 * Equoria-j5qui. OLD CONTRACT: each handler read `:entityType` ('groom' or
 * 'horse') and answered 400 "Invalid entity type" for anything else, and a
 * groom owner got triggers / stability / prediction / history for a groom's
 * personality evolution. NEW RULING (owner, 2026-10-22): groom personalities
 * never evolve. The handlers serve a horse (`:horseId`) only, so the
 * entity-type guard and every groom case are gone.
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

// Non-existent user/horse IDs to trigger the ownership 404
const NON_EXISTENT_ID = 999999999;
const NON_EXISTENT_USER_ID = '00000000-0000-0000-0000-000000000099';

const notOwnedReq = (query = undefined) => ({
  params: { horseId: String(NON_EXISTENT_ID) },
  ...(query ? { query } : {}),
  user: { id: NON_EXISTENT_USER_ID },
});

// ─── ownership 404 (all four handlers) ───────────────────────────────────────

describe.each([
  ['getEvolutionTriggersController', getEvolutionTriggersController, undefined],
  ['getPersonalityStabilityController', getPersonalityStabilityController, undefined],
  ['predictPersonalityEvolutionController', predictPersonalityEvolutionController, { timeframeDays: '30' }],
  ['getPersonalityEvolutionHistoryController', getPersonalityEvolutionHistoryController, undefined],
])('%s', (_name, handler, query) => {
  it('returns 404 for a horse that does not exist or is not yours', async () => {
    const res = makeRes();

    await handler(notOwnedReq(query ?? {}), res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toBe('Horse not found or you do not own this horse');
  });
});

// ─── predictPersonalityEvolutionController timeframe guard ───────────────────

describe('predictPersonalityEvolutionController timeframe guard', () => {
  it.each(['0', '366', 'abc', '-5'])('returns 400 when timeframeDays is %s', async timeframeDays => {
    const req = {
      params: { horseId: '1' },
      query: { timeframeDays },
      user: { id: NON_EXISTENT_USER_ID },
    };
    const res = makeRes();

    await predictPersonalityEvolutionController(req, res);

    expect(res.statusValue).toBe(400);
    expect(res.bodyValue.success).toBe(false);
    expect(res.bodyValue.message).toMatch(/invalid timeframe/i);
  });

  it('uses default timeframeDays of 30 when not provided', async () => {
    // No timeframeDays → defaults to 30 → valid, goes to the ownership check
    const res = makeRes();

    await predictPersonalityEvolutionController(notOwnedReq({}), res);

    expect(res.statusValue).toBe(404);
    expect(res.bodyValue.success).toBe(false);
  });
});

// applyPersonalityEvolutionEffectsController was removed under Equoria-bvddn.4
// (audit 2026-09-25): the route it backed answered 410 — it was commented
// "admin function" but had no role check, and the function it called
// (applyPersonalityEvolutionEffects) never wrote to the database anyway. See
// backend/modules/horses/__tests__/personalityEvolutionController.integration.test.mjs
// for the route-closure regression coverage.
