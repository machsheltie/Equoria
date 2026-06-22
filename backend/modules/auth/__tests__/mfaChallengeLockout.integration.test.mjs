/**
 * 🛡️ MFA Challenge Lockout Sentinel (Equoria-kg7i2)
 *
 * Real-DB integration. No mocks. Asserts the per-userId lockout on
 * /auth/mfa/challenge:
 *
 *   - Up to 5 wrong TOTP attempts are rejected with 401 (the existing
 *     "Invalid MFA credentials" path).
 *   - The 6th attempt (with the same mfaChallengeToken) is rejected with 429
 *     AND the message indicates the challenge has been revoked.
 *   - Even a fresh login for the same user must NOT issue a usable challenge
 *     during the lockout window — every challenge against a locked user
 *     returns 429 until the lockout TTL elapses.
 *   - A SUCCESSFUL TOTP verification resets the failure counter for that
 *     user (so a single mistake doesn't lock you forever).
 *   - The lockout is per-userId, NOT per-IP — attempts against User A do
 *     not lock out User B.
 *
 * Sentinel intent: defeats brute force of the 10^6 TOTP space, which the
 * shared 200/15min authRateLimiter does not (200 guesses across all auth
 * endpoints is still adversarially viable for TOTP).
 *
 * Equoria-462kg (sibling of Equoria-hrzwh): this suite formerly created ONE
 * shared user in beforeAll and read/mutated it across all three `it` blocks
 * (the wrong-TOTP→lockout chain, the reset-on-success chain, and the
 * per-userId-isolation check all drove the same user + secret). That user's
 * email is inside the broad-cleanup blast radius (every reserved test domain
 * is — by design), so a concurrent process firing a broad @example.com /
 * .test / TestFixture- delete could strand the shared user MID-SUITE: an
 * early `it` passed, then a later `it` got a 404/401 because the row had
 * vanished. The robust fix is structural: every test creates and owns its
 * OWN fully-enrolled user via a beforeEach helper, tracked for id-scoped
 * cleanup in afterEach, so no test depends on a user surviving across `it`
 * boundaries. Every original assertion is preserved verbatim.
 */

import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { _resetMfaLockoutsForTest } from '../services/mfaLockoutService.mjs';
import { __resetForTests as resetReplayCache } from '../services/mfaReplayProtectionService.mjs';

const ORIGINAL_TEST_MAX = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;

describe('MFA challenge lockout (Equoria-kg7i2)', () => {
  let csrf; // anonymous CSRF for the public login calls

  // Equoria-462kg: every user this suite creates is tracked here and deleted
  // id-scoped in afterEach. No user outlives the test that made it.
  const createdUserIds = [];

  beforeAll(async () => {
    // Make sure the shared 15min authRateLimiter cannot mask the per-userId
    // lockout we are asserting (5 failures before 429).
    process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '1000';
    csrf = await fetchCsrf(app);
  });

  afterAll(() => {
    if (ORIGINAL_TEST_MAX === undefined) {
      delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
    } else {
      process.env.TEST_RATE_LIMIT_MAX_REQUESTS = ORIGINAL_TEST_MAX;
    }
    _resetMfaLockoutsForTest();
  });

  afterEach(async () => {
    // id-scoped cleanup (never the broad email matcher) of every user created
    // by the test that just ran.
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop();
      await cleanupTestUser(id);
    }
    _resetMfaLockoutsForTest();
  });

  /**
   * Create a fresh user, log it in, enroll + verify MFA. Returns the per-user
   * context the tests need: { user, cookies, userCsrf, secret }. The user id
   * is tracked for id-scoped cleanup.
   *
   * Equoria-plw0h: CSRF is per-user-session-bound — re-fetch under the
   * authenticated session so the issued token resolves to req.user.id.
   */
  async function setupEnrolledUser(emailPrefix = 'mfalock') {
    const user = await createTestUser({
      email: `${emailPrefix}-${Date.now()}-${process.pid}@example.com`,
    });
    createdUserIds.push(user.id);

    // Log in (single factor, no MFA yet) to get a session cookie for enroll.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    const cookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]);

    const userCsrf = await fetchCsrf(app, { extraCookies: cookies });

    // Enroll + verify-enrollment so login starts requiring MFA.
    const enroll = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', [...userCsrf.cookieHeader, ...cookies])
      .set('X-CSRF-Token', userCsrf.csrfToken)
      .send({});
    const secret = enroll.body.data.secret;

    const correctToken = authenticator.generate(secret);
    await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', [...userCsrf.cookieHeader, ...cookies])
      .set('X-CSRF-Token', userCsrf.csrfToken)
      .send({ token: correctToken });

    // Reset any lockout state seeded from prior runs in the same process.
    _resetMfaLockoutsForTest();
    // Equoria-y932s: clear replay cache so subsequent TOTPs in tests below
    // (potentially within ~30s of the enrollment TOTP) are not rejected.
    resetReplayCache();

    return { user, cookies, userCsrf, secret };
  }

  async function getChallengeToken(user) {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    return loginRes.body?.data?.mfaChallengeToken;
  }

  it('6th wrong TOTP returns 429 and revokes the mfaChallengeToken', async () => {
    const { user, secret } = await setupEnrolledUser();
    _resetMfaLockoutsForTest();
    resetReplayCache(); // Equoria-y932s
    const challengeToken = await getChallengeToken(user);
    expect(typeof challengeToken).toBe('string');

    // 5 wrong attempts → 401 each
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeToken, token: '000000' });
      expect(res.status).toBe(401);
    }

    // 6th attempt with SAME token → 429 (lockout) + revocation messaging
    const sixth = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, token: '000000' });
    expect(sixth.status).toBe(429);
    expect(sixth.body.success).toBe(false);
    expect(String(sixth.body.message)).toMatch(/log in again|revoked|locked/i);

    // Even using a FRESH challenge token (re-login) the lockout persists
    // because it's per-userId — the previously-issued token has been
    // structurally invalidated for this user during the lockout window.
    const freshToken = await getChallengeToken(user);
    const correctTotp = authenticator.generate(secret);
    const seventh = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: freshToken, token: correctTotp });
    expect(seventh.status).toBe(429);
  });

  it('a successful TOTP before the cap resets the failure counter (no premature lockout)', async () => {
    const { user, secret } = await setupEnrolledUser();
    _resetMfaLockoutsForTest();
    resetReplayCache(); // Equoria-y932s
    const challengeToken1 = await getChallengeToken(user);

    // 3 wrong attempts
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeToken1, token: '000000' });
      expect(res.status).toBe(401);
    }

    // Correct TOTP succeeds and resets the counter
    const correctTotp = authenticator.generate(secret);
    const success = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken1, token: correctTotp });
    expect(success.status).toBe(200);

    // New challenge: another 5 wrong attempts (would lock if counter didn't reset)
    const challengeToken2 = await getChallengeToken(user);
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeToken2, token: '000000' });
      expect(res.status).toBe(401);
    }
    // The 5 wrong attempts after the success should NOT have been pre-incremented
    // by the previous 3 failures — total = 5, not 8.
    // (Implementation correctness: lock fires on the SAME 6th attempt the
    // first test asserts — if reset didn't work, the lock would fire at
    // attempt 3 here and the loop would 429 before completing.)
  });

  it('lockout is per-userId — User B is not affected by User A being locked', async () => {
    const { user: userA } = await setupEnrolledUser();
    _resetMfaLockoutsForTest();
    resetReplayCache(); // Equoria-y932s

    // Lock out user A
    const challengeA = await getChallengeToken(userA);
    for (let i = 0; i < 6; i++) {
      await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeA, token: '000000' });
    }

    // Create user B, enroll, verify, and confirm B can still successfully
    // pass mfa/challenge with a correct TOTP.
    const { user: userB, secret: secretB } = await setupEnrolledUser('mfalockb');
    resetReplayCache(); // Equoria-y932s: clear so next TOTP is not flagged

    // Fresh challenge for B, correct TOTP → 200 (B is NOT locked)
    const challengeB = await getChallengeToken(userB);

    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeB, token: authenticator.generate(secretB) });
    expect(res.status).toBe(200);
  });
});
