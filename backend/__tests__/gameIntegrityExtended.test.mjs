/**
 * Extended tests for gameIntegrity middleware — covers validateBreeding,
 * validateTraining, and validateTransaction (all missing from existing coverage).
 *
 * Key context:
 * - validateBreeding/validateTraining use obsolete Horse schema fields (playerId,
 *   ownerId, health_status, last_bred_date, stud_status). Once IDs are provided,
 *   the Prisma query fails with a schema validation error → catch → 500.
 *   Only the early-return 400 paths (missing params) are reliably testable.
 * - validateTransaction uses prisma.player which no longer exists. Same pattern:
 *   only the early 400 path (invalid amount) is reliably testable without a live
 *   Player table.
 *
 * Equoria-rr7 coverage sprint.
 */

import { describe, it, expect } from '@jest/globals';
import { validateBreeding, validateTraining, validateTransaction } from '../middleware/gameIntegrity.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq({ body = {}, user = { id: 'test-user-1' }, params = {} } = {}) {
  return { body, user, params };
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
  let _called = false;
  const fn = () => {
    _called = true;
  };
  fn.wasCalled = () => _called;
  return fn;
}

// ─── validateBreeding ─────────────────────────────────────────────────────────

describe('validateBreeding', () => {
  it('returns 400 when both sireId and damId are missing', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.success).toBe(false);
    expect(res.jsonValue.message).toMatch(/sire.*dam|required/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when sireId is missing but damId is present', async () => {
    const req = makeReq({ body: { damId: 2 } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when damId is missing but sireId is present', async () => {
    const req = makeReq({ body: { sireId: 1 } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 4xx or 5xx when both IDs are present (schema mismatch or not found)', async () => {
    // The Horse schema does not have playerId, ownerId, last_bred_date,
    // stud_status, or health_status. The Prisma query either throws a
    // validation error (→ 500) or returns null (→ 404). Both are valid.
    const req = makeReq({ body: { sireId: 999999991, damId: 999999992 } });
    const res = makeRes();
    const next = makeNext();

    await validateBreeding(req, res, next);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.jsonValue.success).toBe(false);
    expect(next.wasCalled()).toBe(false);
  });
});

// ─── validateTraining ─────────────────────────────────────────────────────────

describe('validateTraining', () => {
  it('returns 400 when both horseId and discipline are missing', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/horse.*discipline|required/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when horseId is missing but discipline is present', async () => {
    const req = makeReq({ body: { discipline: 'Dressage' } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when discipline is missing but horseId is present', async () => {
    const req = makeReq({ body: { horseId: 1 } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 4xx or 5xx when horseId and discipline are present (schema mismatch or not found)', async () => {
    // The Horse select in validateTraining includes playerId, ownerId,
    // health_status which do not exist in the current schema. Query will
    // either throw (500) or return null (404).
    const req = makeReq({ body: { horseId: 999999993, discipline: 'Dressage' } });
    const res = makeRes();
    const next = makeNext();

    await validateTraining(req, res, next);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.jsonValue.success).toBe(false);
    expect(next.wasCalled()).toBe(false);
  });
});

// ─── validateTransaction ─────────────────────────────────────────────────────

describe('validateTransaction', () => {
  it('returns 400 when amount is absent', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: {} });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(res.jsonValue.message).toMatch(/invalid.*amount|amount/i);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when amount is 0', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: 0 } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: -100 } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 400 for transfer type with amount = 0', async () => {
    const middleware = validateTransaction('transfer');
    const req = makeReq({ body: { amount: 0, targetUserId: 'other-user' } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect(res.statusValue).toBe(400);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 4xx or 5xx when amount is valid but Player model does not exist', async () => {
    // prisma.player does not exist in the current schema (Player model was
    // removed in migration 20250526021657). Accessing prisma.player throws,
    // which is caught and returned as 500.
    const middleware = validateTransaction('purchase');
    const req = makeReq({ body: { amount: 500 } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect([404, 500]).toContain(res.statusValue);
    expect(res.jsonValue.success).toBe(false);
    expect(next.wasCalled()).toBe(false);
  });

  it('returns 4xx or 5xx for deposit type with valid amount', async () => {
    // Deposit type skips the funds check but still queries prisma.player
    const middleware = validateTransaction('deposit');
    const req = makeReq({ body: { amount: 1000 } });
    const res = makeRes();
    const next = makeNext();

    await middleware(req, res, next);

    expect([404, 500]).toContain(res.statusValue);
    expect(next.wasCalled()).toBe(false);
  });
});
