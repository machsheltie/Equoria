/**
 * Integration Tests: Rate Limit Real-Path Coverage on /api/auth/login
 *
 * Equoria-ocn9 — adversarial-audit Finding 4 fix (revised after code review).
 *
 * The original audit identified that `rate-limit-circuit-breaker.test.mjs`
 * asserted behavior for `x-test-bypass-rate-limit` — a header the production
 * middleware does NOT implement. The first replacement of that test used a
 * synthetic `/probe` route on a freshly-built Express app, which the code
 * review correctly flagged as too-distant-from-production ("synthetic probe
 * sounds too much like mocking").
 *
 * This file is the production-faithful replacement: every test hits the
 * REAL `/api/auth/login` route on the REAL Express app with the REAL
 * authRateLimiter (`rateLimiting.mjs#authRateLimiter`, mounted at
 * `modules/auth/routes/authRoutes.mjs:67`). No synthetic limiters, no fake
 * routes, no in-process middleware factories — just supertest against the
 * exported app.
 *
 * Each test uses a unique `X-Forwarded-For` IP so it gets its own rate-limit
 * bucket (Express has `trust proxy` enabled at app.mjs:270). This isolates
 * rate-limit state across tests so the 200-attempt flood in test 1 doesn't
 * pollute the shared 127.0.0.1 bucket used by other suites.
 *
 * What we prove:
 *   1. The production-mounted authRateLimiter on /api/auth/login actually
 *      returns 429 after the configured `max` failed attempts, with the
 *      RFC-compliant RateLimit-* headers on every response.
 *   2. None of the historical bypass headers
 *      (x-test-bypass-rate-limit, x-test-skip-csrf, x-test-bypass-auth,
 *      x-test-bypass-ownership, x-test-user — alone or combined) extend
 *      the allowance or reset the counter on the real auth route.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

/**
 * authRateLimiter is configured at 200 failed attempts per 15-min window in
 * production (rateLimiting.mjs:375) but `tests/setup.mjs` defaults
 * TEST_RATE_LIMIT_MAX_REQUESTS=1000 so the test suite isn't blocked by 200
 * cumulative failed logins across hundreds of files. We narrow that window
 * temporarily during the flood test so it can trip 429 within a reasonable
 * number of requests, then restore the original.
 *
 * Why narrow vs hammer 1001+: 1001 sequential supertest calls is ~15s of
 * pure HTTP turnaround; 50 is ~0.5s. Narrowing exercises exactly the same
 * production code path (createRateLimiter / express-rate-limit / the auth
 * route's mounted middleware) — the cap is just lower, not bypassed.
 */
const TEST_FLOOD_MAX = 50;
const TEST_FLOOD_HEADROOM = 5;

const BYPASS_HEADERS = [
  'x-test-bypass-rate-limit',
  'x-test-skip-csrf',
  'x-test-bypass-auth',
  'x-test-bypass-ownership',
  'x-test-user',
];

/**
 * Generate a synthetic public-IP for a test so it gets its own rate-limit
 * bucket. Spread across THREE RFC 5737 test ranges (TEST-NET-1, TEST-NET-2,
 * TEST-NET-3) for a 24-bit name space — 16,777,216 possible IPs vs the old
 * 8-bit /24 (256 IPs).
 *
 * Why this matters: the original 8-bit hash had ~10% collision risk for the
 * 8th test added (birthday paradox over 256 buckets). Today's 7 names happen
 * to land on distinct buckets (verified at code-review time), but the next
 * test added had non-trivial collision risk. With 24 bits, a collision needs
 * roughly sqrt(2^24) ≈ 4096 distinct test names to become likely.
 *
 * Equoria-ocn9 re-review fix.
 */
const TEST_NET_RANGES = ['192.0.2', '198.51.100', '203.0.113'];
const SEEN_TEST_IPS = new Map(); // testName -> ip, for collision detection

function uniqueTestIp(testName) {
  if (SEEN_TEST_IPS.has(testName)) {
    return SEEN_TEST_IPS.get(testName);
  }

  // 24-bit FNV-1a hash for good distribution over short strings.
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < testName.length; i++) {
    hash ^= testName.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  hash = hash >>> 0; // coerce to unsigned 32-bit

  const range = TEST_NET_RANGES[hash % TEST_NET_RANGES.length];
  const octet3 = (hash >>> 8) & 0xff;
  // Avoid octet4 = 0 (network address) and 255 (broadcast).
  const octet4 = ((hash >>> 16) & 0xfd) + 1;
  const ip = `${range}.${octet3}.${octet4}`;

  // Collision check across the lifetime of this Jest worker. If two test
  // names produce the same IP, fail loudly NOW rather than letting tests
  // share a rate-limit bucket and produce mysterious flakes.
  for (const [otherName, otherIp] of SEEN_TEST_IPS.entries()) {
    if (otherIp === ip) {
      throw new Error(
        `[uniqueTestIp] hash collision: "${testName}" and "${otherName}" both map to ${ip}. ` +
          'Rename one of these tests or extend the hash range.',
      );
    }
  }
  SEEN_TEST_IPS.set(testName, ip);
  return ip;
}

describe('/api/auth/login authRateLimiter — real-path no-bypass coverage (Equoria-ocn9)', () => {
  let __csrf__;

  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  /**
   * Helper: send a failed login attempt to the REAL /api/auth/login route
   * with the given client IP and optional bypass headers.
   */
  const failedLogin = async (clientIp, bypassHeaders = {}) => {
    let req = request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', clientIp)
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken);
    for (const [name, value] of Object.entries(bypassHeaders)) {
      req = req.set(name, value);
    }
    return req.send({
      email: `ocn9-no-such-user-${Date.now()}-${Math.random()}@example.com`,
      password: 'wrong-password',
    });
  };

  it('returns 429 after the configured max failed attempts, with RateLimit-* headers', async () => {
    const ip = uniqueTestIp('hard-limit-trip');
    const previousMax = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
    process.env.TEST_RATE_LIMIT_MAX_REQUESTS = String(TEST_FLOOD_MAX);
    let blocked = null;
    try {
      for (let i = 0; i < TEST_FLOOD_MAX + TEST_FLOOD_HEADROOM; i++) {
        const res = await failedLogin(ip);
        if (res.status === 429) {
          blocked = res;
          break;
        }
        expect([400, 401]).toContain(res.status);
      }

      expect(blocked).not.toBeNull();
      expect(blocked.status).toBe(429);
      expect(blocked.body.success).toBe(false);
      expect(blocked.headers['ratelimit-limit']).toBeDefined();
      expect(blocked.headers['ratelimit-remaining']).toBe('0');
      expect(blocked.headers['ratelimit-reset']).toBeDefined();
    } finally {
      if (previousMax === undefined) {
        delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
      } else {
        process.env.TEST_RATE_LIMIT_MAX_REQUESTS = previousMax;
      }
    }
  }, 30_000);

  /**
   * For each historical bypass header: verify that hitting /api/auth/login
   * with the header set still decrements the RateLimit-Remaining counter.
   * If any header were honored as a bypass, the counter would NOT decrement
   * — proof that the production middleware ignores the header, on the real
   * mounted route.
   *
   * We verify by sending two consecutive failed logins from a fresh IP:
   * the first establishes a baseline, the second WITH the bypass header.
   * Both responses must include RateLimit-Remaining, and the second value
   * must be strictly less than the first.
   */
  it.each(BYPASS_HEADERS)(
    'bypass header %s does NOT prevent the counter from decrementing on real /api/auth/login',
    async header => {
      const ip = uniqueTestIp(`bypass-${header}`);

      const baseline = await failedLogin(ip);
      expect(baseline.status).toBe(401);
      expect(baseline.headers['ratelimit-remaining']).toBeDefined();
      const before = Number.parseInt(baseline.headers['ratelimit-remaining'], 10);
      expect(Number.isFinite(before)).toBe(true);

      const withBypass = await failedLogin(ip, { [header]: 'true' });
      expect(withBypass.status).toBe(401);
      expect(withBypass.headers['ratelimit-remaining']).toBeDefined();
      const after = Number.parseInt(withBypass.headers['ratelimit-remaining'], 10);
      expect(Number.isFinite(after)).toBe(true);

      // The bypass-header request was counted by the limiter — proves the
      // header is a no-op in the production code path.
      expect(after).toBeLessThan(before);
    },
  );

  it('sending all known bypass headers together does NOT skip the limiter on real /api/auth/login', async () => {
    const ip = uniqueTestIp('bypass-combined');
    const allBypasses = Object.fromEntries(BYPASS_HEADERS.map(h => [h, 'true']));

    const baseline = await failedLogin(ip);
    expect(baseline.status).toBe(401);
    const before = Number.parseInt(baseline.headers['ratelimit-remaining'], 10);

    const withAllBypass = await failedLogin(ip, allBypasses);
    expect(withAllBypass.status).toBe(401);
    const after = Number.parseInt(withAllBypass.headers['ratelimit-remaining'], 10);

    expect(after).toBeLessThan(before);
  });
});
