import { describe, it, expect, jest } from '@jest/globals';
import { sessionCleanup, sessionTimeout, sessionConcurrencyLimit } from '../../../middleware/sessionManagement.mjs';

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('sessionManagement middleware', () => {
  describe('sessionTimeout', () => {
    it('allows when no session', () => {
      const req = { session: undefined };
      const res = mockRes();
      const next = jest.fn();
      sessionTimeout(1000)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('blocks expired session', () => {
      const req = { session: { createdAt: Date.now() - 2000, sessionId: 'abc', userId: 'u1' } };
      const res = mockRes();
      const next = jest.fn();
      sessionTimeout(1000)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(440);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Session expired',
        status: 'error',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('refreshes active session', () => {
      const req = { session: { createdAt: Date.now(), sessionId: 'abc', userId: 'u1' } };
      const res = mockRes();
      const next = jest.fn();
      sessionTimeout(1000)(req, res, next);
      expect(req.session.lastActivity).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sessionConcurrencyLimit', () => {
    it('allows when no limit set', () => {
      const req = { session: { userId: 'u1', sessionId: 's1' } };
      const res = mockRes();
      const next = jest.fn();
      sessionConcurrencyLimit()(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows when maxSessions is 0 (limit disabled)', () => {
      // Branch coverage on sessionManagement.mjs:50 — `!maxSessions` truthy
      // path. With maxSessions=0 the limit is effectively off and the
      // middleware should pass through without inspecting the store.
      const req = { session: { userId: 'u1', sessionId: 's1' } };
      const res = mockRes();
      const next = jest.fn();
      sessionConcurrencyLimit(0)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows when req.session is missing', () => {
      // Branch coverage on `!req.session` truthy path.
      const req = {};
      const res = mockRes();
      const next = jest.fn();
      sessionConcurrencyLimit(2)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows when req.session.userId is missing', () => {
      // Branch coverage on `!req.session.userId` truthy path.
      const req = { session: { sessionId: 's1' } };
      const res = mockRes();
      const next = jest.fn();
      sessionConcurrencyLimit(2)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks when concurrency exceeded', () => {
      const store = new Map([['u1', ['s1', 's2']]]);
      const req = { session: { userId: 'u1', sessionId: 's3' } };
      const res = mockRes();
      const next = jest.fn();
      sessionConcurrencyLimit(2, store)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Maximum concurrent sessions exceeded',
        status: 'error',
      });
      expect(next).not.toHaveBeenCalled();
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
      const res = mockRes();
      const next = jest.fn();
      sessionCleanup(1000, store)(req, res, next);
      expect(store.has('s1')).toBe(false);
      expect(store.has('s2')).toBe(true);
      expect(next).toHaveBeenCalled();
    });
  });
});
