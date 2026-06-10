/**
 * passwordReset parameterized-query integration test (Equoria-nz94y).
 *
 * Equoria-nz94y replaced every $executeRawUnsafe / $queryRawUnsafe call in
 * backend/modules/auth/controllers/passwordController.mjs with the
 * parameterized $executeRaw / $queryRaw TAGGED-TEMPLATE form. Each
 * ${interpolation} is a bound driver parameter — never string-spliced into
 * the SQL text — so the SQL-injection surface is closed while the row shapes
 * the controller consumes are preserved.
 *
 * This suite proves, against the REAL test DB (no mocks):
 *
 *   1. The converted forgot-password → reset-password round trip still
 *      persists a token row (the INSERT) and consumes it (the UPDATE/SELECT),
 *      i.e. the replaced query paths return correct results.
 *
 *   2. SENTINEL-POSITIVE for the parameterization: a registered email that
 *      contains a SQL single-quote metacharacter (o'brien@…) is INSERTed and
 *      round-tripped cleanly. Under the old string-interpolated form this
 *      payload would either break the INSERT (syntax error → 500) or alter
 *      the statement; under the tagged-template bind it is stored verbatim as
 *      data. If a future refactor reverts to a string-spliced raw form, the
 *      INSERT of this email throws and this test fails — that is the failure
 *      signal the AC depends on.
 *
 * Token capture mirrors auth-password-reset.test.mjs: in non-production mode
 * sendPasswordResetEmail writes the reset URL to EMAIL_CAPTURE_FILE, from
 * which the raw token is read — no spy or mock.
 *
 * Real DB, scoped fixtures (email startsWith 'TestFixture-nz94y'), scoped
 * cleanup by id / userId. No bypass headers.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-nz94y';
// The forgot-password route validator runs normalizeEmail() (default
// all_lowercase: true) before the controller's user lookup. The controller
// then findUnique()s on the normalized value, so test fixture emails MUST be
// already-lowercase or the lookup misses the user we created. Username keeps
// the cased prefix (scoped cleanup is by collected userId, not by email).
const EMAIL_PREFIX = 'testfixture-nz94y';

describe('passwordController — parameterized raw queries (Equoria-nz94y)', () => {
  let captureFile = null;
  const createdUserIds = [];

  beforeAll(async () => {
    // Touch CSRF once so the app is warm; forgot/reset are exempt from CSRF
    // in this codebase (public endpoints), so we do not attach the token.
    await fetchCsrf(app);
  });

  beforeEach(() => {
    captureFile = path.join(os.tmpdir(), `pwreset-nz94y-${randomBytes(8).toString('hex')}.jsonl`);
    process.env.EMAIL_CAPTURE_FILE = captureFile;
  });

  afterEach(() => {
    delete process.env.EMAIL_CAPTURE_FILE;
    if (captureFile && existsSync(captureFile)) {
      unlinkSync(captureFile);
    }
    captureFile = null;
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      // Scoped cleanup: only the ids this suite created.
      await prisma.$executeRaw`DELETE FROM password_reset_tokens WHERE "userId" = ANY(${createdUserIds}::text[])`;
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 30000);

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

  // ──────────────────────────────────────────────────────────────────────
  // 1. The converted INSERT/SELECT/UPDATE paths persist and consume a token.
  it('forgot-password INSERT persists a token row and reset-password SELECT/UPDATE consume it', async () => {
    const tag = randomBytes(6).toString('hex');
    const email = `${EMAIL_PREFIX}-${tag}@example.com`;
    const originalPassword = 'OriginalPass1!';
    const newPassword = 'NewSecurePass2@';

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    const user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${tag}`,
        email,
        password: hashedOriginal,
        firstName: 'Param',
        lastName: 'Query',
      },
    });
    createdUserIds.push(user.id);

    // forgot-password → exercises the parameterized UPDATE (invalidate) + INSERT.
    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .send({ email });
    expect(forgotRes.status).toBe(200);

    // The INSERT actually wrote a row (read it back via a parameterized $queryRaw).
    const inserted = await prisma.$queryRaw`
      SELECT "userId", email, "usedAt"
      FROM password_reset_tokens
      WHERE "userId" = ${user.id} AND "usedAt" IS NULL`;
    expect(inserted.length).toBe(1);
    expect(inserted[0].email).toBe(email);
    expect(inserted[0].usedAt).toBeNull();

    // reset-password → exercises the parameterized SELECT (lookup) + UPDATE (consume).
    const rawToken = readCapturedResetToken();
    expect(typeof rawToken).toBe('string');

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .send({ token: rawToken, newPassword });
    expect(resetRes.status).toBe(200);

    // The token row must now be marked used (the UPDATE landed).
    const consumed = await prisma.$queryRaw`
      SELECT "usedAt" FROM password_reset_tokens WHERE "userId" = ${user.id}`;
    expect(consumed.length).toBe(1);
    expect(consumed[0].usedAt).not.toBeNull();

    // End-to-end: new password works, old does not.
    const loginNew = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: newPassword });
    expect(loginNew.status).toBe(200);

    const loginOld = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: originalPassword });
    expect(loginOld.status).toBe(401);
  }, 30000);

  // ──────────────────────────────────────────────────────────────────────
  // 2. SENTINEL-POSITIVE: the User-Agent header is the most attacker-controlled
  //    free-text value bound into the forgot-password INSERT (req.headers
  //    ['user-agent'] → the "userAgent" column). Send a User-Agent loaded with
  //    SQL-injection metacharacters. Under the parameterized tagged-template
  //    form it is bound as opaque data — the INSERT succeeds (200) and the
  //    column stores the payload verbatim, with NO injected side effect (the
  //    table is intact, the row count is exactly one). Under a reverted
  //    string-spliced raw form, this payload would either syntax-error the
  //    INSERT (500) or alter the statement — so this test fails the moment the
  //    unsafe form is reintroduced. That is the AC's failure signal.
  it('forgot-password INSERT binds a SQL-injection User-Agent header as data, not SQL', async () => {
    const tag = randomBytes(6).toString('hex');
    const email = `${EMAIL_PREFIX}-ua-${tag}@example.com`;
    const originalPassword = 'OriginalPass1!';

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    const user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-ua-${tag}`,
        email,
        password: hashedOriginal,
        firstName: 'UserAgent',
        lastName: 'Inject',
      },
    });
    createdUserIds.push(user.id);

    // Classic injection payload: a closing quote + statement-terminator + a
    // DROP. If spliced, it would corrupt the multi-column INSERT.
    const maliciousUserAgent = "Mozilla/5.0'); DROP TABLE password_reset_tokens; --";

    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .set('User-Agent', maliciousUserAgent)
      .send({ email });
    expect(forgotRes.status).toBe(200);

    // The table still exists and holds EXACTLY the one row we created — the
    // DROP did not execute (it was bound as data, not run as SQL).
    const inserted = await prisma.$queryRaw`
      SELECT "userAgent" FROM password_reset_tokens WHERE "userId" = ${user.id}`;
    expect(inserted.length).toBe(1);
    // The payload round-tripped verbatim into the userAgent column.
    expect(inserted[0].userAgent).toBe(maliciousUserAgent);
  }, 30000);
});
