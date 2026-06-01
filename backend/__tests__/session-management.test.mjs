import { describe, it, expect } from '@jest/globals';
import { sessionCleanup, sessionTimeout, sessionConcurrencyLimit } from '../middleware/sessionManagement.mjs';

function makeTracked(returnValue) {
  const calls = [];
  const fn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  fn.mock = { calls };
  return fn;
}

function buildMockRes() {
  const res = {};
  res.status = makeTracked(res);
  res.json = makeTracked(res);
  return res;
}

describe('sessionManagement middleware', () => {
  describe('sessionTimeout', () => {
    it('allows when no session', () => {
      const req = { session: undefined };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionTimeout(1000)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('blocks expired session', () => {
      const req = { session: { createdAt: Date.now() - 2000, sessionId: 'abc', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionTimeout(1000)(req, res, next);
      expect(res.status.mock.calls[0]?.[0]).toBe(440);
      expect(res.json.mock.calls[0]?.[0]).toEqual({
        success: false,
        message: 'Session expired',
        status: 'error',
      });
      expect(next.mock.calls.length).toBe(0);
    });

    it('refreshes active session', () => {
      const req = { session: { createdAt: Date.now(), sessionId: 'abc', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionTimeout(1000)(req, res, next);
      expect(req.session.lastActivity).toBeDefined();
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('uses default timeoutMs when called without arg', () => {
      // Branch coverage on sessionTimeout's default-arg branch (line 20):
      // `timeoutMs = SESSION_TIMEOUT_MS`. Default is 30 minutes; a fresh
      // session is well under that window, so it passes through.
      const req = { session: { createdAt: Date.now(), sessionId: 'abc', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionTimeout()(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(res.status.mock.calls.length).toBe(0);
    });

    it('falls back to Date.now() when createdAt is missing', () => {
      // Branch coverage on line 26: `req.session.createdAt || Date.now()`.
      // When createdAt is undefined, the fallback (Date.now()) kicks in.
      // A session with no createdAt is treated as just-created → never
      // expired → next() with lastActivity stamped.
      const req = { session: { sessionId: 'abc', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionTimeout(1000)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(req.session.lastActivity).toBeDefined();
      expect(res.status.mock.calls.length).toBe(0);
    });
  });

  describe('sessionConcurrencyLimit', () => {
    it('allows when no limit set', () => {
      const req = { session: { userId: 'u1', sessionId: 's1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit()(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('allows when maxSessions is 0 (limit disabled)', () => {
      // Branch coverage on sessionManagement.mjs:50 — `!maxSessions` truthy
      // path. With maxSessions=0 the limit is effectively off and the
      // middleware should pass through without inspecting the store.
      const req = { session: { userId: 'u1', sessionId: 's1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(0)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(res.status.mock.calls.length).toBe(0);
    });

    it('allows when req.session is missing', () => {
      // Branch coverage on `!req.session` truthy path.
      const req = {};
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(2)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(res.status.mock.calls.length).toBe(0);
    });

    it('allows when req.session.userId is missing', () => {
      // Branch coverage on `!req.session.userId` truthy path.
      const req = { session: { sessionId: 's1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(2)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(res.status.mock.calls.length).toBe(0);
    });

    it('blocks when concurrency exceeded', () => {
      const store = new Map([['u1', ['s1', 's2']]]);
      const req = { session: { userId: 'u1', sessionId: 's3' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(2, store)(req, res, next);
      expect(res.status.mock.calls[0]?.[0]).toBe(403);
      expect(res.json.mock.calls[0]?.[0]).toEqual({
        success: false,
        message: 'Maximum concurrent sessions exceeded',
        status: 'error',
      });
      expect(next.mock.calls.length).toBe(0);
    });

    it('appends new session under limit and continues', () => {
      // Branch coverage on line 63 — `!sessions.includes(req.session.sessionId)`
      // where the session is NOT in the store but the limit is not exceeded.
      // The middleware should append the sessionId and pass through.
      const store = new Map([['u1', ['s1']]]);
      const req = { session: { userId: 'u1', sessionId: 's2' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(2, store)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(store.get('u1')).toEqual(['s1', 's2']);
    });

    it('does not append duplicate sessionId already in store', () => {
      // Branch coverage on line 63 — `!sessions.includes` falsy branch.
      // The session IS in the store (re-request from same browser tab).
      // Middleware should pass through without modifying the store.
      const store = new Map([['u1', ['s1', 's2']]]);
      const req = { session: { userId: 'u1', sessionId: 's1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionConcurrencyLimit(2, store)(req, res, next);
      expect(next.mock.calls.length).toBeGreaterThan(0);
      expect(store.get('u1')).toEqual(['s1', 's2']);
    });
  });

  describe('sessionCleanup', () => {
    it('removes expired sessions and continues', () => {
      const now = Date.now();
      const store = new Map([
        ['s1', { userId: 'u1', lastActivity: now - 2000 }],
        ['s2', { userId: 'u2', lastActivity: now }],
      ]);
      const req = { session: { sessionId: 's2', userId: 'u2' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      expect(store.has('s1')).toBe(false);
      expect(store.has('s2')).toBe(true);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('uses session.createdAt fallback when lastActivity is missing', () => {
      // Branch coverage on line 78: `session.lastActivity || session.createdAt || now`
      // Session has only createdAt — middleware uses that for the age check.
      const now = Date.now();
      const store = new Map([['s1', { userId: 'u1', createdAt: now - 2000 }]]);
      const req = { session: { sessionId: 's1', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      // Expired by createdAt (2s old, 1s timeout) — should be removed
      // (then re-added by the trailing block that registers req.session).
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('uses now as ultimate fallback when both lastActivity and createdAt are missing', () => {
      // Branch coverage on line 78: third `|| now` fallback.
      const store = new Map([['s1', { userId: 'u1' }]]);
      const req = { session: { sessionId: 's1', userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      // Treated as just-created (now - now = 0) — not expired.
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('does not register store entry when req.session is missing', () => {
      // Branch coverage on line 84: `req.session && ...` falsy path.
      // No req.session → cleanup runs but no new entry is added.
      const now = Date.now();
      const store = new Map([['s1', { userId: 'u1', lastActivity: now - 2000 }]]);
      const req = {};
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      expect(store.has('s1')).toBe(false);
      expect(store.size).toBe(0);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('does not register store entry when req.session.sessionId is missing', () => {
      // Branch coverage on line 84: `req.session.sessionId` falsy.
      const store = new Map();
      const req = { session: { userId: 'u1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      expect(store.size).toBe(0);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });

    it('does not register store entry when req.session.userId is missing', () => {
      // Branch coverage on line 84: `req.session.userId` falsy.
      const store = new Map();
      const req = { session: { sessionId: 's1' } };
      const res = buildMockRes();
      const next = makeTracked(undefined);
      sessionCleanup(1000, store)(req, res, next);
      expect(store.size).toBe(0);
      expect(next.mock.calls.length).toBeGreaterThan(0);
    });
  });
});
