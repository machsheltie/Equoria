/**
 * Equoria-8p6e6 (owner ruling, Equoria-6p398.11) — confirming a recovery-address
 * change terminates the account's sessions.
 *
 * Why: the email address is the account-RECOVERY control. A session stolen
 * before the change must not outlive the owner reclaiming the address, and a
 * hijacker's address change must not outlive the owner taking the account back.
 * Confirmation, not request, is the trigger: at request time the actor has not
 * yet proven to be the legitimate owner.
 *
 * Finding on "keep the confirming session": `GET /auth/email-change/confirm` is
 * PUBLIC (authRoutes.mjs; the link is opened from the replacement mailbox,
 * frequently on another device) and reads no session at all, so the confirming
 * request carries no session identity. "Keep this one, drop the rest" is
 * therefore vacuous and the correct behaviour is to invalidate ALL sessions —
 * refresh tokens (deleted) and live access tokens (passwordChangedAt stamp, the
 * CWE-613 mechanism the password paths already use). This suite asserts exactly
 * that, including that a request which happens to present a session cookie does
 * not keep it.
 *
 * Real DB, real auth middleware, real refresh endpoint, real token rows. Only
 * the outbound mail provider's EMAIL_CAPTURE_FILE preview sink is used.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTokenPair } from '../../../utils/tokenRotationService.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'ecsessrev';
const PASSWORD = 'CorrectHorse1!';

const uid = () => randomBytes(5).toString('hex');

const cleanup = createCleanupTracker();
const createdUserIds = [];
let captureFile = null;

async function makeUser() {
  const suffix = `${uid()}${uid()}`;
  const row = await prisma.user.create({
    data: {
      email: `${PREFIX}-${suffix}@test.com`,
      username: `${PREFIX}${suffix}`,
      password: await bcrypt.hash(PASSWORD, 4),
      firstName: 'Session',
      lastName: 'Owner',
      money: 100,
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  createdUserIds.push(row.id);
  return row;
}

beforeAll(() => {
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'verification tokens',
  );
  cleanup.add(
    () =>
      prisma.$executeRawUnsafe('DELETE FROM password_reset_tokens WHERE "userId" = ANY($1::text[])', createdUserIds),
    'password reset tokens',
  );
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => {
  captureFile = path.join(os.tmpdir(), `ecsessrev-${randomBytes(8).toString('hex')}.jsonl`);
  process.env.EMAIL_CAPTURE_FILE = captureFile;
});

afterEach(() => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
});

function capturedChangeToken() {
  if (!existsSync(captureFile)) {
    throw new Error(`No mail captured in ${captureFile}`);
  }
  const entries = readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'email-change');
  const entry = entries[entries.length - 1];
  if (!entry) {
    throw new Error('No "email-change" email captured');
  }
  return new URL(entry.preview).searchParams.get('token');
}

async function authedSend(method, url, body, accessToken) {
  const csrf = await fetchCsrf(app, {
    origin: ORIGIN,
    extraCookies: [`accessToken=${accessToken}`],
  });
  const agent = request(app);
  return agent[method](url)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const refreshWith = refreshTokenValue =>
  request(app)
    .post('/api/v1/auth/refresh-token')
    .set('Origin', ORIGIN)
    .set('Cookie', `refreshToken=${refreshTokenValue}`);

const readStatus = accessToken =>
  request(app)
    .get('/api/v1/auth/email-change/status')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${accessToken}`);

/**
 * Two independent live sessions (two token families) for one account.
 *
 * The access tokens are signed with `iat` 30s in the past. The CWE-613 cut-off
 * floors passwordChangedAt to whole seconds and compares it with the token's
 * second-resolution `iat` (middleware/auth.mjs), so a token minted in the same
 * wall-clock second as the confirmation legitimately survives that one second.
 * A real session is minutes old by the time its owner confirms an address
 * change; back-dating makes the test model that instead of a sub-second race.
 */
async function openTwoSessions(user) {
  const sessionA = await createTokenPair(user.id, undefined, 'user');
  const sessionB = await createTokenPair(user.id, undefined, 'user');
  const aged = secondsAgo =>
    generateTestToken({
      id: user.id,
      email: user.email,
      role: 'user',
      iat: Math.floor(Date.now() / 1000) - secondsAgo,
    });
  return {
    sessionA: { ...sessionA, accessToken: aged(30) },
    sessionB: { ...sessionB, accessToken: aged(31) },
  };
}

describe('Equoria-8p6e6 — confirming an email change terminates the other sessions', () => {
  it('both live sessions die when the change is confirmed from the emailed link (confirm is unauthenticated, so none is kept)', async () => {
    const user = await makeUser();
    const { sessionA, sessionB } = await openTwoSessions(user);

    // Precondition: both sessions are genuinely live before the change.
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(2);
    expect((await readStatus(sessionA.accessToken)).status).toBe(200);
    expect((await readStatus(sessionB.accessToken)).status).toBe(200);

    const target = `${PREFIX}-new-${uid()}@test.com`;
    const staged = await authedSend(
      'post',
      '/api/v1/auth/email-change/request',
      { email: target, password: PASSWORD },
      sessionA.accessToken,
    );
    expect(staged.status).toBe(200);

    // REQUEST must not kill anything: the actor is not yet proven the owner.
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(2);
    expect((await readStatus(sessionB.accessToken)).status).toBe(200);

    // Confirm from the mailbox link, with no session at all.
    const confirmed = await request(app)
      .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(capturedChangeToken())}`)
      .set('Origin', ORIGIN);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.email).toBe(target);

    // The non-confirming session's refresh token is rejected...
    expect((await refreshWith(sessionB.refreshToken)).status).toBe(401);
    // ...and so is the other one: the confirming request carried no session.
    expect((await refreshWith(sessionA.refreshToken)).status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);

    // Access tokens minted before the change are dead too (not just refresh).
    expect((await readStatus(sessionA.accessToken)).status).toBe(401);
    expect((await readStatus(sessionB.accessToken)).status).toBe(401);
  }, 60_000);

  it('a confirm request that presents a session cookie does not keep that session', async () => {
    const user = await makeUser();
    const { sessionA, sessionB } = await openTwoSessions(user);

    const staged = await authedSend(
      'post',
      '/api/v1/auth/email-change/request',
      { email: `${PREFIX}-new-${uid()}@test.com`, password: PASSWORD },
      sessionA.accessToken,
    );
    expect(staged.status).toBe(200);

    const confirmed = await request(app)
      .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(capturedChangeToken())}`)
      .set('Origin', ORIGIN)
      .set('Cookie', `accessToken=${sessionA.accessToken}; refreshToken=${sessionA.refreshToken}`);
    expect(confirmed.status).toBe(200);

    expect((await refreshWith(sessionA.refreshToken)).status).toBe(401);
    expect((await refreshWith(sessionB.refreshToken)).status).toBe(401);
  }, 60_000);

  it('a fresh login with the new address works after the revocation', async () => {
    const user = await makeUser();
    const { sessionA } = await openTwoSessions(user);
    const target = `${PREFIX}-new-${uid()}@test.com`;

    const staged = await authedSend(
      'post',
      '/api/v1/auth/email-change/request',
      { email: target, password: PASSWORD },
      sessionA.accessToken,
    );
    expect(staged.status).toBe(200);
    const confirmed = await request(app)
      .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(capturedChangeToken())}`)
      .set('Origin', ORIGIN);
    expect(confirmed.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: target, password: PASSWORD });
    expect(login.status).toBe(200);

    // The new session is live: its own refresh token still rotates.
    const cookies = login.headers['set-cookie'] || [];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    const newRefresh = refreshCookie.split(';')[0].slice('refreshToken='.length);
    expect((await refreshWith(newRefresh)).status).toBe(200);
  }, 60_000);

  it('a failed confirmation (spent link) revokes nothing', async () => {
    const user = await makeUser();
    const { sessionA, sessionB } = await openTwoSessions(user);

    const bogus = await request(app)
      .get('/api/v1/auth/email-change/confirm?token=not-a-real-token')
      .set('Origin', ORIGIN);
    expect(bogus.status).toBeGreaterThanOrEqual(400);

    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(2);
    expect((await readStatus(sessionA.accessToken)).status).toBe(200);
    expect((await refreshWith(sessionB.refreshToken)).status).toBe(200);
  }, 60_000);
});
