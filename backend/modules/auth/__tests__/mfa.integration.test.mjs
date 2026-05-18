/**
 * 🧪 TOTP-based MFA Integration Tests (Equoria-2vwwh, OWASP A07)
 *
 * Real-DB integration. No mocks. Exercises the full opt-in MFA lifecycle:
 *   enroll → verify-enrollment → login-requires-TOTP → correct-TOTP-succeeds
 *   → wrong-TOTP-rejected → recovery-code-works-once → disable.
 *
 * Also asserts the non-MFA login path is UNCHANGED (beta-critical path):
 * a user without mfaEnabled still logs in with email+password alone.
 */

import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('TOTP MFA lifecycle (Equoria-2vwwh)', () => {
  let csrf;
  let user;
  let cookies; // session cookies for the enrolled user
  let secret;
  let recoveryCodes;

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  });

  afterAll(async () => {
    if (user?.id) {
      await cleanupTestUser(user.id);
    }
  });

  function authCookies(extra = []) {
    return [...csrf.cookieHeader, ...extra];
  }

  it('non-MFA user logs in with email+password alone (beta-critical path unchanged)', async () => {
    user = await createTestUser({ email: `mfatest-${Date.now()}@example.com` });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mfaRequired).toBeFalsy();
    expect(res.body.data.user.id).toBe(user.id);

    // Capture session cookies for authenticated MFA enroll calls.
    const setCookies = res.headers['set-cookie'] || [];
    cookies = setCookies.map(c => c.split(';')[0]);
  });

  it('enroll returns a secret + otpauth URL but does NOT enable MFA yet', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.secret).toBe('string');
    expect(res.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    secret = res.body.data.secret;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser.mfaEnabled).toBe(false);
    expect(dbUser.mfaSecret).toBeTruthy(); // staged but not active
  });

  it('verify-enrollment with a correct TOTP enables MFA and returns recovery codes once', async () => {
    const token = authenticator.generate(secret);

    const res = await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.recoveryCodes)).toBe(true);
    expect(res.body.data.recoveryCodes).toHaveLength(10);
    recoveryCodes = res.body.data.recoveryCodes;

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser.mfaEnabled).toBe(true);
    // Recovery codes persisted hashed (never plaintext).
    const stored = dbUser.mfaRecoveryCodes;
    expect(Array.isArray(stored)).toBe(true);
    expect(stored).toHaveLength(10);
    expect(stored[0].codeHash).not.toContain(recoveryCodes[0]);
  });

  it('verify-enrollment with a wrong TOTP is rejected (separate user, true reject path)', async () => {
    // A genuine wrong-token-during-enrollment rejection on a fresh user, so
    // the negative path is exercised independently of the already-enabled
    // 409 contract (which is asserted separately below).
    const wrongUser = await createTestUser({
      email: `mfawrong-${Date.now()}@example.com`,
    });
    try {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: wrongUser.email, password: wrongUser.plainPassword });
      const wuCookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]);

      const enroll = await request(app)
        .post('/api/v1/auth/mfa/enroll')
        .set('Cookie', authCookies(wuCookies))
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});
      expect(enroll.status).toBe(200);

      const reject = await request(app)
        .post('/api/v1/auth/mfa/verify-enrollment')
        .set('Cookie', authCookies(wuCookies))
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ token: '000000' });
      expect(reject.status).toBe(401);

      const dbWrong = await prisma.user.findUnique({ where: { id: wrongUser.id } });
      expect(dbWrong.mfaEnabled).toBe(false); // stayed disabled on wrong token
    } finally {
      await cleanupTestUser(wrongUser.id);
    }
  });

  it('re-enroll on an already-MFA-enabled account is rejected (409)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(409); // already enrolled/enabled
  });

  it('login now returns mfaRequired and does NOT issue session tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });

    expect(res.status).toBe(200);
    expect(res.body.data.mfaRequired).toBe(true);
    expect(typeof res.body.data.mfaChallengeToken).toBe('string');
    // No access/refresh cookies issued at this stage.
    const setCookies = res.headers['set-cookie'] || [];
    const hasAccess = setCookies.some(c => c.startsWith('accessToken='));
    expect(hasAccess).toBe(false);
  });

  it('mfa/challenge with a wrong TOTP is rejected (no tokens issued)', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });

    const challengeToken = loginRes.body.data.mfaChallengeToken;

    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, token: '000000' });

    expect(res.status).toBe(401);
    const setCookies = res.headers['set-cookie'] || [];
    expect(setCookies.some(c => c.startsWith('accessToken='))).toBe(false);
  });

  it('mfa/challenge with the correct TOTP issues session tokens', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });

    const challengeToken = loginRes.body.data.mfaChallengeToken;
    const totp = authenticator.generate(secret);

    const res = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, token: totp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user.id);
    const setCookies = res.headers['set-cookie'] || [];
    expect(setCookies.some(c => c.startsWith('accessToken='))).toBe(true);
  });

  it('a recovery code works once and is consumed (cannot be reused)', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    const challengeToken = loginRes.body.data.mfaChallengeToken;
    const code = recoveryCodes[0];

    const first = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: challengeToken, recoveryCode: code });
    expect(first.status).toBe(200);

    // Reuse the same code on a fresh challenge — must be rejected.
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    const second = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ mfaChallengeToken: loginRes2.body.data.mfaChallengeToken, recoveryCode: code });
    expect(second.status).toBe(401);
  });

  it('disable requires a valid current TOTP and clears MFA state', async () => {
    const totp = authenticator.generate(secret);

    const res = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Cookie', authCookies(cookies))
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ token: totp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser.mfaEnabled).toBe(false);
    expect(dbUser.mfaSecret).toBeNull();

    // Login is back to single-factor for this user.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.mfaRequired).toBeFalsy();
  });
});
