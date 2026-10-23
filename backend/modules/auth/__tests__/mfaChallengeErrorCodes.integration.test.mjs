/**
 * POST /api/v1/auth/mfa/challenge gives each refusal a stable `code`
 * (Equoria-3f4vw).
 *
 * Before: a wrong TOTP and an expired/invalid challenge both answered a bare 401,
 * so the second-factor form could not tell the player which remedy applied (retype
 * the code vs log in again). The codes carry nothing the caller does not already
 * know: a player who just typed a code knows whether it was wrong, and a client
 * holding the challenge token can see it expired. The lockout (429) keeps its
 * status and gains MFA_LOCKED.
 *
 * Real DB, no mocks; every user is created per test and deleted by id.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { _resetMfaLockoutsForTest } from '../services/mfaLockoutService.mjs';
import { __resetForTests as resetReplayCache } from '../services/mfaReplayProtectionService.mjs';

const ORIGINAL_TEST_MAX = process.env.TEST_RATE_LIMIT_MAX_REQUESTS;

describe('MFA challenge error codes (Equoria-3f4vw)', () => {
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

  it('a wrong TOTP answers 401 with MFA_CODE_INCORRECT', async () => {
    const { user } = await setupEnrolledUser('mfacode');
    const challengeToken = await getChallengeToken(user);

    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, token: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('MFA_CODE_INCORRECT');
  });

  it('a garbage challenge token answers 401 with MFA_CHALLENGE_EXPIRED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: 'not-a-jwt', token: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MFA_CHALLENGE_EXPIRED');
  });

  it('an expired challenge token answers 401 with MFA_CHALLENGE_EXPIRED', async () => {
    const { user } = await setupEnrolledUser('mfaexp');
    const expired = jwt.sign({ type: 'mfa_challenge', userId: user.id }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });

    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: expired, token: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MFA_CHALLENGE_EXPIRED');
  });

  it('the sixth wrong TOTP answers 429 with MFA_LOCKED', async () => {
    const { user } = await setupEnrolledUser('mfalocked');
    const challengeToken = await getChallengeToken(user);
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeToken, token: '000000' });
    }

    const sixth = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, token: '000000' });

    expect(sixth.status).toBe(429);
    expect(sixth.body.code).toBe('MFA_LOCKED');
  });
});
