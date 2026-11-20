/**
 * requireRole role checks — Equoria-f8bp / Equoria-d9n5
 *
 * Pattern mirrors passwordChangedAt-cache.test.mjs (req/res/next
 * direct-invocation, real DB).
 *
 * Behavioural: direct invocation with a synthetic req whose .user.id is a
 * UUID that does not exist in the real DB — prisma.user.findUnique returns
 * null (not an error) so this validates the "no-record" code path
 * (req.user.role stays undefined → 403 for a non-existent user is correct),
 * plus the role-already-on-req paths.
 *
 * @module modules/auth/__tests__/requireRole-db-error-failclosed
 */

import { describe, it, expect } from '@jest/globals';
import { requireRole } from '../../../middleware/auth.mjs';

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeReqRes(userOverrides = {}) {
  const req = {
    user: {
      id: 'a0000000-0000-0000-0000-000000000001',
      ...userOverrides,
    },
    method: 'GET',
    path: '/api/test',
    ip: '127.0.0.1',
  };
  const res = {
    _status: null,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  const next = (() => {
    const calls = [];
    const fn = (...args) => calls.push(args);
    fn.calls = calls;
    return fn;
  })();
  return { req, res, next };
}

// ─── 2. Behavioural: no-record path (DB returns null) → 403 ──────────────────

describe('requireRole — behavioural: non-existent user ID → 403 (Equoria-f8bp)', () => {
  it('user not in DB returns 403 Insufficient permissions (null record, no DB error)', async () => {
    // UUID that cannot exist in the real DB — prisma.user.findUnique returns null.
    // This exercises the null-record branch: req.user.role stays undefined → 403.
    // (This is the CORRECT behavior for a legitimately non-existent user, distinct
    // from the DB-error path which must return 500.)
    const { req, res, next } = makeReqRes({
      id: '00000000-dead-beef-0000-000000000000',
    });

    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next.calls.length).toBe(0);
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({
      success: false,
      message: 'Insufficient permissions',
    });
  });

  it('user with matching role in req.user skips DB lookup and calls next()', async () => {
    // req.user.role already set → DB lookup is skipped entirely → next() called.
    const { req, res, next } = makeReqRes({ role: 'admin' });

    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next.calls.length).toBe(1);
    expect(res._status).toBeNull(); // No response written
  });

  it('user with non-matching role in req.user (no DB lookup needed) → 403', async () => {
    const { req, res, next } = makeReqRes({ role: 'user' });

    const middleware = requireRole('admin');
    await middleware(req, res, next);

    expect(next.calls.length).toBe(0);
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({
      success: false,
      message: 'Insufficient permissions',
    });
  });
});
