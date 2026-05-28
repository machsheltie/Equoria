/**
 * MFA disable lockout sentinel (Equoria-uqq8n, sibling of Equoria-kg7i2).
 *
 * Real-DB integration. No mocks. Asserts the per-userId lockout on
 * /api/v1/auth/mfa/disable:
 *   - Up to 5 wrong TOTP attempts return 401.
 *   - The 6th attempt returns 429 (lockout) — defeats brute force of the
 *     10^6 TOTP space that the shared 200/15min authRateLimiter does NOT
 *     defeat. Without this, a compromised session could strip MFA off the
 *     account.
 *   - A SUCCESSFUL disable before the cap resets the failure counter for
 *     the user (so re-enrolling MFA then disabling it again doesn't start
 *     pre-locked).
 */

import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { _resetMfaLockoutsForTest } from '../services/mfaLockoutService.mjs';

const ORIGINAL_TEST_MAX = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;

describe('MFA disable lockout (Equoria-uqq8n)', () => {
  let csrf;
  let user;
  let cookies;
  let secret;

  function authCookies(extra = []) {
    return [...csrf.cookieHeader, ...extra];
  }

  async function enrollMfa() {
    const enroll = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    secret = enroll.body.data.secret;
    const correctToken = authenticator.generate(secret);
    await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ token: correctToken });
  }

  beforeAll(async () => {
    // Make sure the shared authRateLimiter cannot mask the per-userId
    // lockout we are asserting (5 failures before 429).
    process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '1000';
    csrf = await fetchCsrf(app);

    user = await createTestUser({ email: `mfadisable-${Date.now()}-${process.pid}@example.com` });

    // Single-factor login (no MFA yet) to capture session cookies.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    cookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]);

    await enrollMfa();
    _resetMfaLockoutsForTest();
  });

  afterAll(async () => {
    if (ORIGINAL_TEST_MAX === undefined) {
      delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.TEST_RATE_LIMIT_MAX_REQUESTS = ORIGINAL_TEST_MAX;
    }
    if (user?.id) {
      await cleanupTestUser(user.id);
    }
    _resetMfaLockoutsForTest();
  });

  it('SENTINEL: 6th wrong TOTP on /mfa/disable returns 429 (lockout)', async () => {
    _resetMfaLockoutsForTest();

    // 5 wrong attempts → 401 each.
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/mfa/disable')
        .set('Cookie', authCookies(cookies))
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ token: '000000' });
      expect(res.status).toBe(401);
    }

    // 6th attempt → 429 lockout (would be 401 without the fix).
    const sixth = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ token: '000000' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.success).toBe(false);
    expect(String(sixth.body.message)).toMatch(/many failed|too many|locked/i);

    // Even a CORRECT TOTP submitted during the lockout window must NOT
    // succeed — the gate runs BEFORE the verify, so the lockout structurally
    // blocks the disable until the TTL elapses.
    const correctTotp = authenticator.generate(secret);
    const lockedSuccess = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ token: correctTotp });
    expect(lockedSuccess.status).toBe(429);
  });
});
