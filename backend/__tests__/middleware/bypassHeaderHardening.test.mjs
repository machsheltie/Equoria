/**
 * bypassHeaderHardening.test.mjs
 *
 * Story 21S-2: defence in depth — `x-test-skip-csrf` and
 * `x-test-bypass-rate-limit` headers MUST be no-ops when NODE_ENV is
 * `beta` or `production`, even if upstream test conditions accidentally
 * evaluate true.
 *
 * Pure unit tests — no DB, no app boot. We import the bypass-decision
 * helpers via the middleware modules and exercise them through a
 * synthetic request object.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { applyCsrfProtection } from '../../middleware/csrf.mjs';
import { createRateLimiter } from '../../middleware/rateLimiting.mjs';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_JEST_WORKER_ID = process.env.JEST_WORKER_ID;

describe('UNIT: bypass header hardening for NODE_ENV=beta and production (21S-2)', () => {
  // Per CodeRabbit feedback (2026-04-20): restoring undefined values by
  // assignment turns them into the string "undefined" — delete the key instead.
  const restoreEnv = () => {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
    if (ORIGINAL_JEST_WORKER_ID === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = ORIGINAL_JEST_WORKER_ID;
    }
  };
  beforeEach(restoreEnv);
  afterAll(restoreEnv);

  describe('CSRF middleware (applyCsrfProtection)', () => {
    /** Build a minimal POST request that would normally pass through the
     *  bypass branch when JEST_WORKER_ID is set. */
    function makeMutationRequest() {
      return {
        method: 'POST',
        headers: { 'x-test-skip-csrf': 'true' },
        cookies: {},
        signedCookies: {},
        body: {},
        session: {},
      };
    }

    function makeRes() {
      let statusCode = 200;
      let body;
      return {
        status: code => {
          statusCode = code;
          return { json: b => (body = b) };
        },
        json: b => (body = b),
        get statusCode() {
          return statusCode;
        },
        get body() {
          return body;
        },
      };
    }

    it('honors the bypass header in test (Jest) when JEST_WORKER_ID is set', () => {
      process.env.NODE_ENV = 'test';
      // JEST_WORKER_ID is already set by Jest
      let nextCalled = false;
      applyCsrfProtection(makeMutationRequest(), makeRes(), () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it('REJECTS the bypass header when NODE_ENV=beta (defence in depth)', () => {
      process.env.NODE_ENV = 'beta';
      // JEST_WORKER_ID still set by Jest — proves the NODE_ENV gate wins
      let nextCalled = false;
      const res = makeRes();
      applyCsrfProtection(makeMutationRequest(), res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('REJECTS the bypass header when NODE_ENV=production (defence in depth)', () => {
      process.env.NODE_ENV = 'production';
      let nextCalled = false;
      const res = makeRes();
      applyCsrfProtection(makeMutationRequest(), res, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Rate-limit middleware (shouldBypassRequest via createRateLimiter)', () => {
    /** Internal `shouldBypassRequest` is not exported. We test indirectly: a
     *  rate-limited request that would normally bypass via header must NOT
     *  bypass under NODE_ENV=beta. We rely on observable behavior: when bypass
     *  fires, `skip` returns true and the limiter's count does not increment.
     *  Here we reach into the limiter via the express-rate-limit `skip` option
     *  by introspecting the function returned. */

    /** Drives one request through the limiter and resolves with observable
     *  outcome once EITHER next() fires OR res.status(...) is called. This
     *  eliminates the setTimeout race previously flagged by CodeRabbit
     *  (2026-04-20). */
    function runOnce(limiter, req) {
      return new Promise(resolve => {
        let status;
        let nextCalled = false;
        const finish = () => resolve({ status, nextCalled });
        const res = {
          status: c => {
            status = c;
            return { json: () => finish(), send: () => finish() };
          },
          statusCode: 200,
          setHeader: () => undefined,
          getHeader: () => undefined,
          json: () => undefined,
          end: () => finish(),
        };
        limiter(req, res, () => {
          nextCalled = true;
          finish();
        });
      });
    }

    it('honors the bypass header when NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        keyPrefix: 'rl:unit-test',
        useEnvOverride: false,
      });
      // Drive max+1 requests — bypass must let every single one call next()
      // and never call res.status(429).
      const req = { headers: { 'x-test-bypass-rate-limit': 'true' }, ip: '127.0.0.1' };
      let sawLimit = false;
      let nextCount = 0;
      for (let i = 0; i < 5; i++) {
        const outcome = await runOnce(limiter, req);
        if (outcome.nextCalled) {
          nextCount += 1;
        }
        if (outcome.status === 429) {
          sawLimit = true;
        }
      }
      expect(nextCount).toBe(5);
      expect(sawLimit).toBe(false);
    });

    it('REFUSES to honor the bypass header under NODE_ENV=beta', async () => {
      process.env.NODE_ENV = 'beta';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        keyPrefix: 'rl:unit-beta',
        useEnvOverride: false,
      });
      const req = { headers: { 'x-test-bypass-rate-limit': 'true' }, ip: '127.0.0.2' };
      // First request consumes the single-slot budget.
      const first = await runOnce(limiter, req);
      expect(first.nextCalled).toBe(true);
      // Second request must be rate-limited (bypass header refused).
      const second = await runOnce(limiter, req);
      expect(second.nextCalled).toBe(false);
      expect(second.status).toBe(429);
    });

    it('REFUSES to honor the bypass header under NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        keyPrefix: 'rl:unit-prod',
        useEnvOverride: false,
      });
      const req = { headers: { 'x-test-bypass-rate-limit': 'true' }, ip: '127.0.0.3' };
      const first = await runOnce(limiter, req);
      expect(first.nextCalled).toBe(true);
      const second = await runOnce(limiter, req);
      expect(second.nextCalled).toBe(false);
      expect(second.status).toBe(429);
    });
  });
});
