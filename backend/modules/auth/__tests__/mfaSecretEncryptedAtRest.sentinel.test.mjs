/**
 * 🔒 Sentinel — User.mfaSecret is encrypted at rest (Equoria-yi13v, OWASP A07)
 *
 * Real-DB integration, no mocks. Proves the defect this issue fixes is gone
 * and STAYS gone: after MFA enrollment the TOTP shared secret persisted in
 * the database MUST NOT be the plaintext base32 returned to the user. If a
 * future change reverts to plaintext storage (or breaks the encrypt-on-write
 * path), this test fails — that is its entire purpose (sentinel-positive).
 *
 * Kept as a standalone spec so the security invariant has an unambiguous
 * owning test that cannot be silently lost in an unrelated edit to the
 * broader MFA lifecycle suite.
 */

import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { isEncrypted, decryptField, encryptField } from '../../../utils/fieldEncryption.mjs';

describe('MFA secret at-rest encryption sentinel (Equoria-yi13v)', () => {
  let csrf;
  let user;
  let cookies;

  beforeAll(async () => {
    // Anonymous CSRF pair — valid only for unauthenticated mutations (login).
    csrf = await fetchCsrf(app);
  });

  afterAll(async () => {
    if (user?.id) {
      await cleanupTestUser(user.id);
    }
  });

  it('persists the TOTP secret as AES-256-GCM ciphertext, never plaintext base32', async () => {
    user = await createTestUser({ email: `mfaenc-${Date.now()}@example.com` });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ email: user.email, password: user.plainPassword });
    expect(loginRes.status).toBe(200);
    // Drop the login-piggybacked CSRF cookie (21R-AUTH-3 issueCsrfToken sets
    // one on the login response): forwarding it alongside the freshly fetched
    // pair below puts two csrf cookies on the request and cookie-parser keeps
    // the first, breaking the double-submit match against X-CSRF-Token.
    cookies = (loginRes.headers['set-cookie'] || [])
      .map(c => c.split(';')[0])
      .filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf='));

    // Equoria-plw0h: per-user CSRF binding — authenticated mutations need a
    // CSRF token ISSUED under the acting identity. Forward the accessToken
    // cookie on the token GET so issuance binds to this user's id; the
    // anonymous beforeAll token correctly 403s on /mfa/* (middleware doing
    // its job, not a flake).
    const accessCookie = cookies.find(c => c.startsWith('accessToken='));
    expect(accessCookie).toBeDefined();
    const authedCsrf = await fetchCsrf(app, { extraCookies: [accessCookie] });

    const enroll = await request(app)
      .post('/api/v1/auth/mfa/enroll')
      .set('Cookie', [...cookies, authedCsrf.csrfCookie])
      .set('X-CSRF-Token', authedCsrf.csrfToken)
      .send({});
    expect(enroll.status).toBe(200);
    const plaintextSecret = enroll.body.data.secret;
    expect(typeof plaintextSecret).toBe('string');

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    // Core invariant: the stored value is NOT the plaintext secret.
    expect(dbUser.mfaSecret).toBeTruthy();
    expect(dbUser.mfaSecret).not.toBe(plaintextSecret);
    expect(dbUser.mfaSecret.includes(plaintextSecret)).toBe(false);

    // It is a recognizable v1 envelope and round-trips back to the plaintext.
    expect(isEncrypted(dbUser.mfaSecret)).toBe(true);
    expect(decryptField(dbUser.mfaSecret)).toBe(plaintextSecret);

    // The decrypted secret still produces a valid TOTP (proves the round-trip
    // preserves the actual cryptographic material, not just the string).
    const token = authenticator.generate(decryptField(dbUser.mfaSecret));
    const verify = await request(app)
      .post('/api/v1/auth/mfa/verify-enrollment')
      .set('Cookie', [...cookies, authedCsrf.csrfCookie])
      .set('X-CSRF-Token', authedCsrf.csrfToken)
      .send({ token });
    expect(verify.status).toBe(200);
  });

  it('encryptField output for the same secret differs each call (random IV) yet both decrypt back', () => {
    const sample = authenticator.generateSecret();
    const a = encryptField(sample);
    const b = encryptField(sample);
    expect(a).not.toBe(b);
    expect(decryptField(a)).toBe(sample);
    expect(decryptField(b)).toBe(sample);
  });
});
