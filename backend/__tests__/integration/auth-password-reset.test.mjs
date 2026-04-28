/**
 * Auth Password Reset — Integration Tests
 *
 * Covers the complete forgot-password → reset-password flow against the real
 * test database (equoria_test). No Prisma mocks — everything hits the actual
 * DB via the live Express app.
 *
 * Test strategy for token capture:
 *   `sendPasswordResetEmail` is an external email-dispatch side-effect
 *   (equivalent to an SMTP client call). Spying on it to intercept the raw
 *   token is the same class of isolation as mocking nodemailer — it does NOT
 *   mock business logic or DB operations. The controller still runs its full
 *   DB transaction before calling the email service.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';

// ── email service spy ────────────────────────────────────────────────────────
// We spy on the module-level export so the real function is replaced only for
// the duration of each test. All DB work in forgotPassword still executes.
import emailService from '../../utils/emailService.mjs';

import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';
describe('Auth — Password Reset Integration', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  const EMAIL_PREFIX = 'pwreset_int_';
  let capturedRawToken = null;

  beforeEach(async () => {
    capturedRawToken = null;

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
    jest.restoreAllMocks();
    capturedRawToken = null;
  });

  // ────────────────────────────────────────────────────────────────────────
  it('complete flow: forgot-password → reset-password → verify old/new passwords', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    // 1. Create a real test user directly in the DB
    const hashedOriginal = await bcrypt.hash(originalPassword, 10);
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

    // 2. Spy on sendPasswordResetEmail to capture the raw token.
    //    This replaces the SMTP side-effect only — no DB operations are affected.
    jest.spyOn(emailService, 'sendPasswordResetEmail').mockImplementation(async (_toEmail, rawToken, _userData) => {
      capturedRawToken = rawToken;
      return { success: true, messageId: 'spy-captured', preview: `http://localhost/reset?token=${rawToken}` };
    });

    // 3. Call forgotPassword via HTTP — runs full controller + DB transaction
    const forgotRes = await request(app)
      .post('/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.status).toBe('success');
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
      .post('/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.status).toBe('success');
    expect(resetRes.body.message).toMatch(/password reset successfully/i);

    // 5. Verify the old password no longer works
    const loginOldRes = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });

    expect(loginOldRes.status).toBe(401);

    // 6. Verify the new password works
    const loginNewRes = await request(app)
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: newPassword });

    expect(loginNewRes.status).toBe(200);
    expect(loginNewRes.body.data?.user?.email).toBe(email);
  });

  // ────────────────────────────────────────────────────────────────────────
  it('forgotPassword returns 200 for unknown email (no user enumeration)', async () => {
    const resetRes = await request(app)
      .post('/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email: `nonexistent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com` });

    // Must NOT reveal whether the account exists
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.status).toBe('success');
  });

  // ────────────────────────────────────────────────────────────────────────
  it('resetPassword rejects an invalid/nonexistent token with 400', async () => {
    const resetRes = await request(app)
      .post('/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: 'totally-fake-token-that-was-never-issued', newPassword: 'NewPass99!' });

    expect(resetRes.status).toBe(400);
  });

  // ────────────────────────────────────────────────────────────────────────
  it('resetPassword rejects a used token (prevents token replay)', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}replay_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    const hashedOriginal = await bcrypt.hash(originalPassword, 10);
    await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}replay_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'Replay',
        lastName: 'Test',
      },
    });

    jest.spyOn(emailService, 'sendPasswordResetEmail').mockImplementation(async (_toEmail, rawToken, _userData) => {
      capturedRawToken = rawToken;
      return { success: true, messageId: 'spy-captured', preview: '' };
    });

    await request(app).post('/auth/forgot-password').set('Origin', 'http://localhost:3000').send({ email });
    expect(capturedRawToken).not.toBeNull();

    // Use the token once — should succeed
    const firstReset = await request(app)
      .post('/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword });
    expect(firstReset.status).toBe(200);

    // Replay the same token — should be rejected
    const secondReset = await request(app)
      .post('/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: capturedRawToken, newPassword: 'AnotherPass3#' });
    expect(secondReset.status).toBe(400);
  });
});
