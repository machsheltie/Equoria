/**
 * 🧪 TOTP-based MFA Integration Tests (Equoria-2vwwh, OWASP A07)
 *
 * Real-DB integration. No mocks. Exercises the full opt-in MFA lifecycle:
 *   enroll → verify-enrollment → login-requires-TOTP → correct-TOTP-succeeds
 *   → wrong-TOTP-rejected → recovery-code-works-once → disable.
 *
 * Also asserts the non-MFA login path is UNCHANGED (beta-critical path):
 * a user without mfaEnabled still logs in with email+password alone.
 *
 * Equoria-hrzwh: this suite formerly created ONE shared user in the first test
 * and mutated it across the enroll→verify→disable chain. That user's email is
 * inside the broad-cleanup blast radius (every reserved test domain is — by
 * design), so a concurrent process firing a broad @example.com / .test / .local
 * / TestFixture- delete could strand the shared user MID-SUITE: the enroll/
 * verify tests passed, then a later test 404'd because the row had vanished
 * (the DoD-8 RUN-3 flake). Moving the email "out of the radius" is impossible
 * (no reserved test pattern escapes it). The robust fix is structural: every
 * test creates and owns its OWN user (a fresh enabled-MFA user per test for the
 * post-enablement behaviors), so no test depends on a user surviving across
 * `it` boundaries. id-scoped cleanup in afterEach. The within-test window is
 * seconds and is the same exposure any real-DB integration test carries; the
 * cross-test stranding that caused the 404 is eliminated.
 */

import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { __resetForTests as resetReplayCache } from '../services/mfaReplayProtectionService.mjs';

describe('TOTP MFA lifecycle (Equoria-2vwwh)', () => {
  let csrf; // anonymous CSRF for the public login calls

  // Equoria-hrzwh: every user this suite creates is tracked here and deleted
  // id-scoped in afterEach. No user outlives the test that made it.
  const createdUserIds = [];

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  });

  afterEach(async () => {
    // id-scoped cleanup (never the broad email matcher) of every user created
    // by the test that just ran.
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop();
      await cleanupTestUser(id);
    }
  });

  /**
   * Create a fresh user and log it in. Returns the per-user session context:
   * { user, cookies, userCsrf }. The user id is tracked for id-scoped cleanup.
   *
   * Equoria-plw0h: CSRF is per-user-session-bound, so after login we re-fetch
   * the CSRF token under the authenticated session (the anonymous `csrf` can no
   * longer validate this user's authenticated mutations).
   */
  async function createLoggedInUser() {
    const email = `mfatest-${Date.now()}-${randomBytes(4).toString('hex')}@example.com`;
    const user = await createTestUser({ email });
    createdUserIds.push(user.id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });

    const cookies = (loginRes.headers['set-cookie'] || []).map(c => c.split(';')[0]);
    const userCsrf = await fetchCsrf(app, { extraCookies: cookies });
    return { user, cookies, userCsrf, loginRes };
  }

  function authCookies(ctx) {
    return [...ctx.userCsrf.cookieHeader, ...ctx.cookies];
  }

  /**
   * Drive a logged-in context all the way to MFA-enabled: enroll, then
   * verify-enrollment with a correct TOTP. Returns { secret, recoveryCodes }.
   */
  async function enableMfa(ctx) {
    const enroll = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', authCookies(ctx))
      .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
      .send({});
    const secret = enroll.body.data.secret;

    // Equoria-y932s: clear replay cache so the verify TOTP is not later rejected
    // as a replay if a subsequent TOTP lands in the same 30s window.
    resetReplayCache();
    const verify = await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', authCookies(ctx))
      .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
      .send({ token: authenticator.generate(secret) });

    return { secret, recoveryCodes: verify.body.data.recoveryCodes };
  }

  /** Create a fresh, fully MFA-enabled user context. */
  async function setupEnabledMfaUser() {
    const ctx = await createLoggedInUser();
    const { secret, recoveryCodes } = await enableMfa(ctx);
    return { ...ctx, secret, recoveryCodes };
  }

  // ── Enrollment flow — each test creates and drives its own fresh user ──────
  describe('enrollment flow', () => {
    it('non-MFA user logs in with email+password alone (beta-critical path unchanged)', async () => {
      const ctx = await createLoggedInUser();

      expect(ctx.loginRes.status).toBe(200);
      expect(ctx.loginRes.body.success).toBe(true);
      expect(ctx.loginRes.body.data.mfaRequired).toBeFalsy();
      expect(ctx.loginRes.body.data.user.id).toBe(ctx.user.id);
    });

    it('enroll returns a secret + otpauth URL but does NOT enable MFA yet', async () => {
      const ctx = await createLoggedInUser();

      const res = await request(app)
        .post('/api/v1/auth/mfa/enroll')
        .set('Cookie', authCookies(ctx))
        .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.secret).toBe('string');
      expect(res.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

      const dbUser = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      expect(dbUser.mfaEnabled).toBe(false);
      expect(dbUser.mfaSecret).toBeTruthy(); // staged but not active
    });

    it('verify-enrollment with a correct TOTP enables MFA and returns recovery codes once', async () => {
      const ctx = await createLoggedInUser();
      const { secret, recoveryCodes } = await enableMfa(ctx);

      expect(Array.isArray(recoveryCodes)).toBe(true);
      expect(recoveryCodes).toHaveLength(10);

      const dbUser = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      expect(dbUser.mfaEnabled).toBe(true);
      // Recovery codes persisted hashed (never plaintext).
      const stored = dbUser.mfaRecoveryCodes;
      expect(Array.isArray(stored)).toBe(true);
      expect(stored).toHaveLength(10);
      expect(stored[0].codeHash).not.toContain(recoveryCodes[0]);
      // Secret was actually used to enable (sanity that enableMfa drove a real flow).
      expect(typeof secret).toBe('string');
    });

    it('verify-enrollment with a wrong TOTP is rejected (true reject path, stays disabled)', async () => {
      const ctx = await createLoggedInUser();

      const enroll = await request(app)
        .post('/api/v1/auth/mfa/enroll')
        .set('Cookie', authCookies(ctx))
        .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
        .send({});
      expect(enroll.status).toBe(200);

      const reject = await request(app)
        .post('/api/v1/auth/mfa/verify-enrollment')
        .set('Cookie', authCookies(ctx))
        .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
        .send({ token: '000000' });
      expect(reject.status).toBe(401);

      const dbUser = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      expect(dbUser.mfaEnabled).toBe(false); // stayed disabled on wrong token
    });
  });

  // ── Enabled-MFA behaviors — fresh ENABLED user per test ────────────────────
  describe('enabled-MFA behaviors', () => {
    let ctx;

    beforeEach(async () => {
      ctx = await setupEnabledMfaUser();
    });

    it('re-enroll on an already-MFA-enabled account is rejected (409)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/mfa/enroll')
        .set('Cookie', authCookies(ctx))
        .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
        .send({});
      expect(res.status).toBe(409); // already enrolled/enabled
    });

    it('login now returns mfaRequired and does NOT issue session tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });

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
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });

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
      // Equoria-y932s: clear replay cache so a TOTP generated here (potentially
      // in the same 30s window as the verify-enrollment TOTP) is not rejected.
      resetReplayCache();

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });

      const challengeToken = loginRes.body.data.mfaChallengeToken;
      const totp = authenticator.generate(ctx.secret);

      const res = await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: challengeToken, token: totp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(ctx.user.id);
      const setCookies = res.headers['set-cookie'] || [];
      expect(setCookies.some(c => c.startsWith('accessToken='))).toBe(true);
    });

    it('a recovery code works once and is consumed (cannot be reused)', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });
      const challengeToken = loginRes.body.data.mfaChallengeToken;
      const code = ctx.recoveryCodes[0];

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
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });
      const second = await request(app)
        .post('/api/v1/auth/mfa/challenge')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ mfaChallengeToken: loginRes2.body.data.mfaChallengeToken, recoveryCode: code });
      expect(second.status).toBe(401);
    });

    it('disable requires a valid current TOTP and clears MFA state', async () => {
      // Equoria-y932s: clear replay cache so this TOTP (potentially in the
      // same 30s window as the enable TOTP) is not rejected.
      resetReplayCache();
      const totp = authenticator.generate(ctx.secret);

      const res = await request(app)
        .post('/api/v1/auth/mfa/disable')
        .set('Cookie', authCookies(ctx))
        .set('X-CSRF-Token', ctx.userCsrf.csrfToken)
        .send({ token: totp });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbUser = await prisma.user.findUnique({ where: { id: ctx.user.id } });
      expect(dbUser.mfaEnabled).toBe(false);
      expect(dbUser.mfaSecret).toBeNull();

      // Login is back to single-factor for this user.
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: ctx.user.email, password: ctx.user.plainPassword });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.mfaRequired).toBeFalsy();
    });
  });
});
