/**
 * 🧪 MFA Replay Protection — HTTP Integration (Equoria-y932s)
 *
 * Real-DB, real-app integration. Verifies the replay defence fires at the
 * HTTP boundary on /api/v1/auth/mfa/challenge — not just in the unit-tested
 * service. The defect (Equoria-y932s) was: otplib accepts the same 6-digit
 * code twice within the validity window. If the test passes, the
 * controller-level wiring of mfaReplayProtectionService is reaching the
 * decision the unit tests prove correct.
 *
 * Sentinel-positive: this test SHOULD FAIL if the
 * mfaReplayProtectionService.hasBeenUsed call is removed from
 * authController.mfaChallenge, because otplib would happily accept the
 * second request with the same code.
 */

import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { __resetForTests as resetReplayCache } from '../services/mfaReplayProtectionService.mjs';

describe('MFA TOTP replay protection at the HTTP boundary (Equoria-y932s)', () => {
  let user;
  let secret;

  afterAll(async () => {
    if (user?.id) {
      await cleanupTestUser(user.id);
    }
  });

  beforeEach(() => {
    // Clear the in-memory cache between tests so the suite is order-independent.
    resetReplayCache();
  });

  it('enrolls a fresh MFA user end-to-end', async () => {
    user = await createTestUser({ email: `mfareplay-${Date.now()}@example.com` });

    // Login (pre-MFA) to get session cookies. /auth/login is CSRF-exempt
    // (it must be reachable without a pre-existing session) so we use a
    // bare CSRF fetch for it.
    const csrfPre = await fetchCsrf(app);
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfPre.cookieHeader)
      .set('X-CSRF-Token', csrfPre.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    expect(loginRes.status).toBe(200);
    const sessionCookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]);
    const accessCookie = sessionCookies.find(c => c.startsWith('accessToken='));

    // Re-fetch CSRF WITH the accessToken cookie so /mfa/enroll's CSRF
    // double-submit cookie binds to the authenticated session (csrf-csrf
    // pattern — pyz4z avoidance).
    const csrfAuthed = await fetchCsrf(app, { extraCookies: [accessCookie] });

    const enroll = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', csrfAuthed.cookieHeader)
      .set('X-CSRF-Token', csrfAuthed.csrfToken)
      .send({});
    expect(enroll.status).toBe(200);
    secret = enroll.body.data.secret;

    // Verify-enrollment with a fresh TOTP (enables MFA).
    const verify = await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', csrfAuthed.cookieHeader)
      .set('X-CSRF-Token', csrfAuthed.csrfToken)
      .send({ token: authenticator.generate(secret) });
    expect(verify.status).toBe(200);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser.mfaEnabled).toBe(true);
  });

  it('SENTINEL: a TOTP code accepted once cannot be replayed on a fresh challenge within the window', async () => {
    // Reset the replay cache so the verify-enrollment TOTP from the previous
    // test does not pre-pollute and accidentally satisfy this test for the
    // wrong reason (false positive).
    resetReplayCache();

    // /auth/login is CSRF-exempt; bare CSRF fetch is OK for the login step.
    const csrfLogin = await fetchCsrf(app);

    // Login (post-MFA) — gets the mfaChallengeToken.
    const loginRes1 = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfLogin.cookieHeader)
      .set('X-CSRF-Token', csrfLogin.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    expect(loginRes1.body.data.mfaRequired).toBe(true);
    const challengeToken1 = loginRes1.body.data.mfaChallengeToken;

    // Generate ONE code and use it.
    const code = authenticator.generate(secret);

    // /mfa/challenge is a public second-factor endpoint (no auth cookie),
    // so the same csrf-double-submit pair works without extraCookies.
    const first = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrfLogin.cookieHeader)
      .set('X-CSRF-Token', csrfLogin.csrfToken)
      .send({ mfaChallengeToken: challengeToken1, token: code });
    expect(first.status).toBe(200); // first use succeeds

    // Fresh login → fresh challenge token, SAME 6-digit code reused.
    const csrfLogin2 = await fetchCsrf(app);
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrfLogin2.cookieHeader)
      .set('X-CSRF-Token', csrfLogin2.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    expect(loginRes2.body.data.mfaRequired).toBe(true);
    const challengeToken2 = loginRes2.body.data.mfaChallengeToken;

    const replay = await request(app)
      .post('/api/v1/auth/mfa/challenge')
      .set('Cookie', csrfLogin2.cookieHeader)
      .set('X-CSRF-Token', csrfLogin2.csrfToken)
      .send({ mfaChallengeToken: challengeToken2, token: code });

    // The defect under test: WITHOUT replay protection, this is 200 because
    // otplib still accepts the code within its time-step window.
    // WITH replay protection: 401.
    expect(replay.status).toBe(401);

    // No session tokens issued on the replayed request.
    const setCookies = replay.headers['set-cookie'] || [];
    expect(setCookies.some(c => c.startsWith('accessToken='))).toBe(false);
  });
});
