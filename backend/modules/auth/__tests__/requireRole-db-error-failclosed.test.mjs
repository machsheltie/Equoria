/**
 * requireRole DB-error fail-closed sentinel — Equoria-f8bp / Equoria-d9n5
 *
 * Verifies that when the lazy DB lookup inside requireRole() throws (e.g. DB
 * temporarily unavailable), the middleware returns HTTP 500 with a clear
 * "Role verification unavailable" message instead of silently falling through
 * to the role-check and returning a misleading 403 "Insufficient permissions".
 *
 * Pattern mirrors bypassHeaderHardening.test.mjs (structural assertion) and
 * passwordChangedAt-cache.test.mjs (req/res/next direct-invocation, real DB).
 *
 * Two tests:
 *   1. Structural: auth.mjs catch block contains the 500 response and does NOT
 *      contain a bare catch-then-fall-through pattern for requireRole.
 *   2. Behavioural: direct invocation with a synthetic req whose .user.id is a
 *      UUID that does not exist in the real DB — prisma.user.findUnique returns
 *      null (not an error) so this validates the "no-record" code path
 *      (req.user.role stays undefined → 403 for a non-existent user is
 *      correct). A separate structural test covers the throw path because
 *      forcing a real DB connection failure in a test suite is impractical
 *      without mocking, and CLAUDE.md prohibits Prisma mocks.
 *
 * @module modules/auth/__tests__/requireRole-db-error-failclosed
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { requireRole } from '../../../middleware/auth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTH_SRC = readFileSync(join(__dirname, '../../../middleware/auth.mjs'), 'utf8');

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

// ─── 1. Structural sentinel ───────────────────────────────────────────────────

describe('auth.mjs requireRole — structural: DB-error catch block returns 500 (Equoria-f8bp)', () => {
  it('auth.mjs requireRole catch block contains 500 + fail-closed return, not a silent fall-through', () => {
    // The requireRole function is in the source between the two export const lines.
    // We find the requireRole block and verify it contains our sentinel response.
    const requireRoleStart = AUTH_SRC.indexOf('export const requireRole');
    expect(requireRoleStart).toBeGreaterThan(-1);

    // Find the section after the requireRole declaration up to the next top-level export.
    const afterRequireRole = AUTH_SRC.slice(requireRoleStart);
    const nextExport = afterRequireRole.indexOf('\nexport const ', 1);
    const requireRoleBlock = nextExport > -1 ? afterRequireRole.slice(0, nextExport) : afterRequireRole;

    // Must contain the 500 response inside the catch block.
    expect(requireRoleBlock).toContain('res.status(500)');
    expect(requireRoleBlock).toContain('Role verification unavailable');

    // The return statement must be present (fail-closed — not fall-through).
    // We verify the catch block has `return res.status(500)` and not just a bare log.
    expect(requireRoleBlock).toContain('return res.status(500)');

    // The block must NOT contain a naked catch that only logs and does nothing else
    // before closing its brace. We check that the catch-for-lookupError section
    // does not end with just the logger call (no `return`).
    // We do this by asserting the logger.error line appears BEFORE the return (order check).
    const loggerIndex = requireRoleBlock.indexOf('[auth] requireRole DB lookup failed');
    const returnIndex = requireRoleBlock.indexOf('return res.status(500)');
    expect(loggerIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(-1);
    expect(loggerIndex).toBeLessThan(returnIndex);
  });

  it('auth.mjs requireRole catch block message is "Role verification unavailable. Please retry."', () => {
    expect(AUTH_SRC).toContain('Role verification unavailable. Please retry.');
  });

  it('auth.mjs requireRole catch block returns 500 status code (not 403)', () => {
    // Verify the fail-closed response is 500 and not 403 in the requireRole lookupError catch.
    // There are two `catch (lookupError)` blocks in auth.mjs — one in authenticateToken
    // (passwordChangedAt check) and one in requireRole. Find the requireRole one by
    // locating it AFTER the requireRole export declaration.
    const requireRoleStart = AUTH_SRC.indexOf('export const requireRole');
    expect(requireRoleStart).toBeGreaterThan(-1);

    const requireRoleSection = AUTH_SRC.slice(requireRoleStart);
    const lookupErrorStart = requireRoleSection.indexOf('} catch (lookupError) {');
    expect(lookupErrorStart).toBeGreaterThan(-1);

    // Extract ~800 chars after the lookupError catch open brace (comment is long).
    const catchRegion = requireRoleSection.slice(lookupErrorStart, lookupErrorStart + 800);

    // Must include status(500) — fail-closed.
    expect(catchRegion).toContain('status(500)');

    // Must NOT say status(403) in this region (that would be the wrong code).
    expect(catchRegion).not.toContain('status(403)');

    // Must NOT be just a logging statement without a return.
    // Confirm `return` appears in this catch region.
    expect(catchRegion).toContain('return');
  });
});

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
