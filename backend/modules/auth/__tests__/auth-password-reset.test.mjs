/**
 * Auth Password Reset — Integration Tests
 *
 * Covers the complete forgot-password → reset-password flow against the real
 * test database (equoria_test). No Prisma mocks — everything hits the actual
 * DB via the live Express app.
 *
 * Test strategy for token capture:
 *   In non-production mode, sendPasswordResetEmail writes the resetUrl to
 *   EMAIL_CAPTURE_FILE via captureEmailPreview(). Tests set that env var to a
 *   per-test temp JSONL file, call forgot-password, then read the file to
 *   extract the raw token from the preview URL — no spy or mock needed.
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { randomBytes } from 'node:crypto';

describe('Auth — Password Reset Integration', () => {
  let __csrf__;
  let captureFile = null;

  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  const EMAIL_PREFIX = 'pwreset_int_';

  beforeEach(async () => {
    // Each test gets a fresh capture file so concurrent or back-to-back tests
    // don't see each other's email payloads.
    captureFile = path.join(os.tmpdir(), `pwreset-${randomBytes(8).toString('hex')}.jsonl`);
    process.env.EMAIL_CAPTURE_FILE = captureFile;

    // Clean up any leftover test users from prior runs
    const users = await prisma.user.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const ids = users.map(u => u.id);
    if (ids.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      // Clean up password_reset_tokens via raw SQL (no Prisma model for this table)
      await prisma.$executeRawUnsafe('DELETE FROM password_reset_tokens WHERE "userId" = ANY($1::text[])', ids);
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  afterEach(() => {
    delete process.env.EMAIL_CAPTURE_FILE;
    if (captureFile && existsSync(captureFile)) {
      unlinkSync(captureFile);
    }
    captureFile = null;
  });

  function readCapturedResetToken() {
    const lines = readFileSync(captureFile, 'utf-8').trim().split('\n').filter(Boolean);
    const entries = lines.map(l => JSON.parse(l)).filter(e => e.kind === 'password-reset');
    const entry = entries[entries.length - 1];
    if (!entry) {
      throw new Error(`No password-reset email captured in ${captureFile}`);
    }
    const url = new URL(entry.preview);
    return url.searchParams.get('token');
  }

  // ────────────────────────────────────────────────────────────────────────
  it('complete flow: forgot-password → reset-password → verify old/new passwords', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    // 1. Create a real test user directly in the DB
    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    const user = await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'Reset',
        lastName: 'Test',
      },
    });
    expect(user.id).toBeTruthy();

    // 2. Call forgotPassword via HTTP — runs full controller + DB transaction
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.success).toBe(true);

    // 3. Extract raw token from the email capture file
    const capturedRawToken = readCapturedResetToken();
    expect(capturedRawToken).not.toBeNull();
    expect(typeof capturedRawToken).toBe('string');
    expect(capturedRawToken.length).toBeGreaterThan(16);

    // DIAGNOSTIC: check what's actually in the password_reset_tokens table
    let diagRows;
    try {
      diagRows = await prisma.$queryRawUnsafe(
        'SELECT "tokenHash", "userId", "usedAt", "expiresAt" FROM password_reset_tokens WHERE "userId" = $1',
        user.id,
      );
    } catch (e) {
      diagRows = `ERROR: ${e.message}`;
    }

    console.log('[DIAG] password_reset_tokens rows for user:', JSON.stringify(diagRows));

    // Compute the hash of the captured token so we can verify it matches
    const crypto = await import('crypto');
    const expectedHash = crypto.default.createHash('sha256').update(capturedRawToken).digest('hex');

    console.log(
      '[DIAG] capturedRawToken length:',
      capturedRawToken?.length,
      'expectedHash:',
      expectedHash?.slice(0, 16),
      '...',
    );

    // 4. Call resetPassword with the captured raw token
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.message).toMatch(/password reset successfully/i);

    // 5. Verify the old password no longer works
    const loginOldRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });

    expect(loginOldRes.status).toBe(401);

    // 6. Verify the new password works
    const loginNewRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: newPassword });

    expect(loginNewRes.status).toBe(200);
    expect(loginNewRes.body.data?.user?.email).toBe(email);
  });

  // ────────────────────────────────────────────────────────────────────────
  it('forgotPassword returns 200 for unknown email (no user enumeration)', async () => {
    const resetRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email: `nonexistent_${randomBytes(8).toString('hex')}@example.com` });

    // Must NOT reveal whether the account exists
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────
  it('resetPassword rejects an invalid/nonexistent token with 400', async () => {
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: 'totally-fake-token-that-was-never-issued', newPassword: 'NewPass99!' });

    expect(resetRes.status).toBe(400);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Equoria-blku — CWE-613 sentinel-positive for the resetPassword path.
  // Mirrors the changePassword sentinel at session-lifecycle.test.mjs:766-789.
  // The middleware-level check (authenticateToken) rejects access-token JWTs
  // whose `iat` predates `User.passwordChangedAt`. Both changePassword and
  // resetPassword stamp passwordChangedAt; this test proves the resetPassword
  // path actually invalidates a pre-reset access token (Equoria-39r5).
  //
  // Sentinel-positive verification: removing
  //   `passwordChangedAt: new Date()` from authController.resetPassword
  // makes this assertion fail (the original access token would still be
  // accepted). Verified once at write time and pasted into bd notes.
  it('CWE-613: resetPassword invalidates pre-reset access tokens (sentinel)', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}cwe613_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    // 1. Create the user with a hashed password matching the login payload.
    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}cwe613_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'CWE613',
        lastName: 'Reset',
      },
    });

    // 2. Login to obtain a real access-token cookie. This is the cookie
    //    whose iat must end up older than the post-reset passwordChangedAt.
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();

    // 3. Call forgot-password; token is captured via EMAIL_CAPTURE_FILE
    await request(app).post('/api/v1/auth/forgot-password').set('Origin', 'http://localhost:3000').send({ email });
    const capturedRawToken = readCapturedResetToken();
    expect(capturedRawToken).not.toBeNull();

    // 4. Sleep across the JWT iat second-boundary. JWT iat is second-precision
    //    and the middleware compares with `iat < floor(passwordChangedAt/1000)`.
    //    Without this delay, a sub-second test run could leave login.iat in
    //    the same second as resetPassword.passwordChangedAt and the strong
    //    401 assertion below would not fire deterministically.
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 5. Reset the password — stamps passwordChangedAt = now.
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword });
    expect(resetRes.status).toBe(200);

    // 6. Strong CWE-613 assertion: the pre-reset access-token cookies must
    //    now be rejected by authenticateToken (iat older than passwordChangedAt).
    //    Supertest does not auto-apply Set-Cookie clears from the reset
    //    response, so resending the original cookies exercises the exact
    //    "stolen access token survives password reset" attack scenario.
    const profileRes = await request(app)
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .expect(401);
    expect(profileRes.body).toMatchObject({
      success: false,
      status: 'error',
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  it('resetPassword rejects a used token (prevents token replay)', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}replay_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}replay_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'Replay',
        lastName: 'Test',
      },
    });

    await request(app).post('/api/v1/auth/forgot-password').set('Origin', 'http://localhost:3000').send({ email });
    const capturedRawToken = readCapturedResetToken();
    expect(capturedRawToken).not.toBeNull();

    // Use the token once — should succeed
    const firstReset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword });
    expect(firstReset.status).toBe(200);

    // Replay the same token — should be rejected
    const secondReset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword: 'AnotherPass3#' });
    expect(secondReset.status).toBe(400);
  });

  // ────────────────────────────────────────────────────────────────────────
  // Equoria-8fdv — sentinel-positive for the EXPIRED-token guard.
  // authController.resetPassword filters with `AND "expiresAt" > NOW()`
  // (authController.mjs ~842). Plant a token row whose expiresAt is in the
  // past and assert the reset is rejected AND the password is unchanged.
  // This FAILS if the `expiresAt > NOW()` clause is removed from the guard.
  it('resetPassword rejects an expired token with 400 and does not change the password', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}expired_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const attemptedNewPassword = 'ShouldNotApply9@';

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    const user = await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}expired_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'Expired',
        lastName: 'Test',
      },
    });

    // Issue a raw token and insert a matching row that is ALREADY expired.
    // hashPasswordResetToken is sha256(token).hex (authController.mjs:52-54).
    const rawToken = randomBytes(32).toString('hex');
    const crypto = await import('crypto');
    const tokenHash = crypto.default.createHash('sha256').update(rawToken).digest('hex');
    await prisma.$executeRawUnsafe(
      `INSERT INTO password_reset_tokens
         ("tokenHash", "userId", email, "expiresAt", "ipAddress", "userAgent")
       VALUES ($1, $2, $3, NOW() - INTERVAL '1 hour', $4, $5)`,
      tokenHash,
      user.id,
      email,
      '127.0.0.1',
      'jest-expired-token-test',
    );

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: rawToken, newPassword: attemptedNewPassword });

    expect(resetRes.status).toBe(400);

    // Password MUST be unchanged — the original still logs in, the
    // attempted new one does not.
    const loginOld = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });
    expect(loginOld.status).toBe(200);

    const loginAttempted = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: attemptedNewPassword });
    expect(loginAttempted.status).toBe(401);

    // The expired token must remain unused (never consumed).
    const rows = await prisma.$queryRawUnsafe(
      'SELECT "usedAt" FROM password_reset_tokens WHERE "tokenHash" = $1',
      tokenHash,
    );
    expect(rows[0]?.usedAt).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Equoria-8fdv — sentinel-positive for PASSWORD-VALIDATION failure.
  // authRoutes.mjs ~107-114 enforces newPassword length/complexity before
  // the controller runs. A valid unused token + a too-short newPassword
  // must 400 with a validation message AND must NOT mark the token used
  // (the request is rejected at validation, before the controller's
  // token-consume transaction). FAILS if the body('newPassword') rule is
  // removed from the route.
  it('resetPassword rejects a weak newPassword with 400 and leaves the token unused', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}weakpw_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}weakpw_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'WeakPw',
        lastName: 'Test',
      },
    });

    // Real flow: get a genuine, valid, unused token via forgot-password.
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email });
    const capturedRawToken = readCapturedResetToken();
    expect(capturedRawToken).not.toBeNull();

    const crypto = await import('crypto');
    const tokenHash = crypto.default
      .createHash('sha256')
      .update(capturedRawToken)
      .digest('hex');

    // Too short to satisfy the min:8 / complexity rule.
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword: 'short' });

    expect(resetRes.status).toBe(400);
    expect(JSON.stringify(resetRes.body)).toMatch(/password/i);

    // The valid token must NOT have been consumed by the rejected request.
    const rows = await prisma.$queryRawUnsafe(
      'SELECT "usedAt" FROM password_reset_tokens WHERE "tokenHash" = $1',
      tokenHash,
    );
    expect(rows[0]?.usedAt).toBeNull();

    // And the original password still works (nothing changed).
    const loginOld = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });
    expect(loginOld.status).toBe(200);
  });
});
