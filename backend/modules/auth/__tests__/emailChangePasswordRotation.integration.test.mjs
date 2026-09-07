/**
 * Finding 5 fix round 1 (Equoria-6p398.5) — rotating the password kills a
 * pending recovery-address change.
 *
 * The gap this closes: fresh authentication is satisfied by the current
 * password, so someone who phishes it can stage an address change. The
 * confirmation link then lives for 24 hours. If the victim rescues the account
 * the ordinary way — change the password, or reset it from the emailed link —
 * the attacker's link previously still committed, AND `confirmEmailChange`
 * would go on to revoke the victim's own outstanding reset proofs. Rotating the
 * credential must invalidate what that credential bought.
 *
 * Real DB, real auth, real CSRF, real token rows. The only isolation is the
 * outbound provider's existing EMAIL_CAPTURE_FILE preview sink.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'f5pwrot';
const PASSWORD = 'CorrectHorse1!';

const uid = () => randomBytes(5).toString('hex');
const sha256 = value => createHash('sha256').update(value).digest('hex');

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
      firstName: 'Rotation',
      lastName: 'Victim',
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
  captureFile = path.join(os.tmpdir(), `f5-pwrot-${randomBytes(8).toString('hex')}.jsonl`);
  process.env.EMAIL_CAPTURE_FILE = captureFile;
});

afterEach(() => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
});

function readCaptured(kind) {
  if (!existsSync(captureFile)) {
    return [];
  }
  return readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === kind);
}

function capturedToken(kind) {
  const entries = readCaptured(kind);
  const entry = entries[entries.length - 1];
  if (!entry) {
    throw new Error(`No "${kind}" email captured in ${captureFile}`);
  }
  return new URL(entry.preview).searchParams.get('token');
}

async function authedSend(method, url, body, actingToken) {
  const csrf = await fetchCsrf(app, {
    origin: ORIGIN,
    extraCookies: [`accessToken=${actingToken}`],
  });
  const agent = request(app);
  return agent[method](url)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${actingToken}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

const confirmChange = rawToken =>
  request(app)
    .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(rawToken)}`)
    .set('Origin', ORIGIN);

const readUser = id =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, emailVerified: true },
  });

/** Stage a pending change for `user` and return its raw confirmation token. */
async function stageChange(user, actingToken) {
  const target = `${PREFIX}-attacker-${uid()}@test.com`;
  const res = await authedSend(
    'post',
    '/api/v1/auth/email-change/request',
    { email: target, password: PASSWORD },
    actingToken,
  );
  expect(res.status).toBe(200);
  return { target, rawToken: capturedToken('email-change') };
}

describe('Finding 5 — a password rotation cancels a pending recovery-address change', () => {
  it('POST /auth/change-password revokes the staged change; its link can no longer commit', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const { target, rawToken } = await stageChange(user, token);
    expect(
      (await prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(rawToken) } })).usedAt,
    ).toBeNull();

    const changed = await authedSend(
      'post',
      '/api/v1/auth/change-password',
      { oldPassword: PASSWORD, newPassword: 'RescuedPass9!x' },
      token,
    );
    expect(changed.status).toBe(200);

    // The staged token is revoked in the SAME transaction as the rotation.
    const revoked = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    expect(revoked.usedAt).not.toBeNull();

    // And the attacker's link is dead.
    const attempt = await confirmChange(rawToken);
    expect(attempt.status).toBe(400);

    const after = await readUser(user.id);
    expect(after.email).toBe(user.email);
    expect(after.email).not.toBe(target);
    expect(after.emailVerified).toBe(true);
  }, 60_000);

  it('POST /auth/reset-password revokes the staged change, and the victim keeps their own recovery', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const { target, rawToken } = await stageChange(user, token);

    // The victim rescues the account through the ordinary recovery flow.
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', ORIGIN)
      .send({ email: user.email });
    expect(forgot.status).toBe(200);
    const resetToken = capturedToken('password-reset');

    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', ORIGIN)
      .send({ token: resetToken, newPassword: 'RescuedPass9!x' });
    expect(reset.status).toBe(200);

    const revoked = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    expect(revoked.usedAt).not.toBeNull();

    const attempt = await confirmChange(rawToken);
    expect(attempt.status).toBe(400);

    const after = await readUser(user.id);
    expect(after.email).toBe(user.email);
    expect(after.email).not.toBe(target);

    // Recovery still reaches the victim's own address after the rescue — the
    // attacker's confirmation can no longer run and revoke their reset proofs.
    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email: user.email });
    const resets = readCaptured('password-reset');
    expect(resets[resets.length - 1].to).toBe(user.email);
  }, 60_000);

  it('the rotation leaves an unrelated signup-verification token alone', async () => {
    const user = await makeUser();
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // A signup-purpose token for the account's OWN (confirmed) address.
    const signupRaw = randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: sha256(signupRaw),
        userId: user.id,
        email: user.email,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const changed = await authedSend(
      'post',
      '/api/v1/auth/change-password',
      { oldPassword: PASSWORD, newPassword: 'RescuedPass9!x' },
      token,
    );
    expect(changed.status).toBe(200);

    // Only PENDING CHANGES are revoked; verifying your own address is not a
    // pending change and must survive a password rotation.
    const untouched = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(signupRaw) },
    });
    expect(untouched.usedAt).toBeNull();
  }, 60_000);
});
