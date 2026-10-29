/**
 * Finding 9 (Equoria-6p398.11) — the recovery-address change needs a surface,
 * and a surface needs a truthful read.
 *
 * `POST /auth/email-change/request` (Finding 5) refuses without a current
 * password. (It once also asked for a TOTP from accounts with a second factor
 * and this read reported `secondFactorRequired`; authenticator-app sign-in was
 * removed, owner ruling 2026-10-29, q305.) A staged change is invisible: reload the
 * settings surface and nothing says a letter is waiting, so the honest
 * four-state contract cannot be met.
 *
 * This suite pins `GET /api/v1/auth/email-change/status`: session-gated, read
 * only, and reporting facts about the caller's OWN account only — its confirmed
 * address and the single live pending replacement if one exists.
 *
 * FAILING TEST FIRST: the route does not exist, so every case below answers
 * 404 against unpatched code.
 *
 * Real DB, real auth, real CSRF, real token rows. The only isolation is the
 * outbound email provider (`EMAIL_CAPTURE_FILE`, the same real service sink the
 * Finding 5 suite uses) so the staged confirmation link can be read back.
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
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { VERIFICATION_RESEND_COOLDOWN_MS } from '../services/emailVerificationService.mjs';
import { maskEmailAddress } from '../../../utils/emailIdentityPolicy.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'f9ecstatus';
const PASSWORD = 'CorrectHorse1!';
const STATUS_URL = '/api/v1/auth/email-change/status';

const uid = () => randomBytes(5).toString('hex');

const cleanup = createCleanupTracker();
const createdUserIds = [];

let user;
let token;
let captureFile = null;

async function makeUser(extra = {}) {
  const suffix = `${uid()}${uid()}`;
  const row = await prisma.user.create({
    data: {
      email: `${PREFIX}-${suffix}@test.com`,
      username: `${PREFIX}${suffix}`,
      password: await bcrypt.hash(PASSWORD, 4),
      firstName: 'Status',
      lastName: 'Reader',
      money: 100,
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...extra,
    },
  });
  createdUserIds.push(row.id);
  return row;
}

beforeAll(async () => {
  user = await makeUser();
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

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
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => {
  captureFile = path.join(os.tmpdir(), `f9-ecstatus-${randomBytes(8).toString('hex')}.jsonl`);
  process.env.EMAIL_CAPTURE_FILE = captureFile;
});

afterEach(() => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
});

function capturedToken(kind) {
  if (!existsSync(captureFile)) {
    throw new Error(`No capture file at ${captureFile}`);
  }
  const entries = readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === kind);
  const entry = entries[entries.length - 1];
  if (!entry) {
    throw new Error(`No "${kind}" email captured in ${captureFile}`);
  }
  return new URL(entry.preview).searchParams.get('token');
}

async function authedSend(method, url, body, actingToken = token) {
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

const readStatus = (actingToken = token) =>
  request(app).get(STATUS_URL).set('Origin', ORIGIN).set('Authorization', `Bearer ${actingToken}`);

const requestChange = (body, actingToken) => authedSend('post', '/api/v1/auth/email-change/request', body, actingToken);

const confirmChange = rawToken =>
  request(app)
    .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(rawToken ?? '')}`)
    .set('Origin', ORIGIN);

/** Move this suite user's request rows back so the resend cooldown lapses. */
async function ageChangeRequestsPastCooldown() {
  await prisma.$executeRawUnsafe(
    `UPDATE email_verification_tokens
     SET "createdAt" = "createdAt" - interval '30 minutes'
     WHERE "userId" = $1`,
    user.id,
  );
}

/** Restore the suite user to a known verified identity between scenarios. */
async function resetIdentity(email) {
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
  await prisma.$executeRawUnsafe('DELETE FROM password_reset_tokens WHERE "userId" = $1', user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  user = { ...user, email };
  token = generateTestToken({ id: user.id, email, role: 'user' });
}

describe('Finding 9 — GET /api/v1/auth/email-change/status', () => {
  it('refuses an unauthenticated read', async () => {
    const res = await request(app).get(STATUS_URL).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('reports the confirmed address and no pending change', async () => {
    await resetIdentity(user.email);

    const res = await readStatus();

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.emailVerified).toBe(true);
    // Owner ruling 2026-10-29 (q305): no second factor exists, so the flag is gone.
    expect(res.body.data).not.toHaveProperty('secondFactorRequired');
    expect(res.body.data.pending).toBeNull();
  });

  it('reports the live pending replacement while the confirmed address stays put', async () => {
    await resetIdentity(user.email);
    const replacement = `${PREFIX}-pending-${uid()}@test.com`;

    const staged = await requestChange({ email: replacement, password: PASSWORD });
    expect(staged.status).toBe(200);

    const res = await readStatus();

    expect(res.status).toBe(200);
    // The confirmed identity has NOT moved — that is the whole point of staging.
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.pending).not.toBeNull();
    // MASKED, never in full: this read must not be a clear-text copy of an
    // address the player may not have finished proving she controls.
    const [localPart] = replacement.split('@');
    expect(res.body.data.pending.maskedEmail).toBe(`${localPart[0]}***@test.com`);
    expect(res.body.data.pending.email).toBeUndefined();
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(replacement);
    expect(body).not.toContain(localPart);
    // The raw token is never echoed back to a session-authenticated reader.
    expect(body).not.toContain('ec1_');
    expect(Number.isNaN(Date.parse(res.body.data.pending.expiresAt))).toBe(false);
    expect(new Date(res.body.data.pending.expiresAt).getTime()).toBeGreaterThan(Date.now());
    // The resend window comes from the row's own createdAt plus the backend's
    // constant, so no client has to hardcode five minutes.
    const tokenRow = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    expect(new Date(res.body.data.pending.resendAvailableAt).getTime()).toBe(
      tokenRow.createdAt.getTime() + VERIFICATION_RESEND_COOLDOWN_MS,
    );
  });

  it('stops reporting a pending change once it is confirmed', async () => {
    await resetIdentity(user.email);
    const replacement = `${PREFIX}-confirmed-${uid()}@test.com`;

    const staged = await requestChange({ email: replacement, password: PASSWORD });
    expect(staged.status).toBe(200);
    const rawToken = capturedToken('email-change');

    const confirmed = await confirmChange(rawToken);
    expect(confirmed.status).toBe(200);

    // Equoria-8p6e6: confirming ends every earlier session, so the pre-change
    // token is only accepted when both land in the same second. Sign in again
    // with a token whose claim still names the OLD address: the endpoint must
    // read the account row, not the JWT claim.
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const res = await readStatus();
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(replacement);
    expect(res.body.data.pending).toBeNull();

    await resetIdentity(replacement);
  });

  it('does not report an expired pending change as still waiting', async () => {
    await resetIdentity(user.email);
    await ageChangeRequestsPastCooldown();
    const replacement = `${PREFIX}-expired-${uid()}@test.com`;

    const staged = await requestChange({ email: replacement, password: PASSWORD });
    expect(staged.status).toBe(200);

    // Age only the clock: the row, its hash and its address are untouched.
    await prisma.$executeRawUnsafe(
      `UPDATE email_verification_tokens
       SET "expiresAt" = NOW() - interval '1 minute'
       WHERE "userId" = $1`,
      user.id,
    );

    const res = await readStatus();
    expect(res.status).toBe(200);
    expect(res.body.data.pending).toBeNull();
  });

  it('never reports another account’s pending change', async () => {
    await resetIdentity(user.email);
    const other = await makeUser();
    const otherToken = generateTestToken({ id: other.id, email: other.email, role: 'user' });
    const otherReplacement = `${PREFIX}-other-${uid()}@test.com`;

    const staged = await requestChange({ email: otherReplacement, password: PASSWORD }, otherToken);
    expect(staged.status).toBe(200);

    const mine = await readStatus();
    expect(mine.status).toBe(200);
    expect(mine.body.data.pending).toBeNull();
    expect(JSON.stringify(mine.body)).not.toContain(otherReplacement);

    const theirs = await readStatus(otherToken);
    expect(theirs.status).toBe(200);
    expect(theirs.body.data.pending.maskedEmail).toBe(`${otherReplacement[0]}***@test.com`);
  });
});

describe('Finding 9 — maskEmailAddress', () => {
  it('keeps the first character of the local part and the whole domain', () => {
    expect(maskEmailAddress('jasmine@example.com')).toBe('j***@example.com');
    // Case is normalized first, so the mask is stable however it was typed.
    expect(maskEmailAddress('  Jasmine@Example.COM ')).toBe('j***@example.com');
  });

  it('does not leak a plus-address tag, which often carries the real account name', () => {
    // `jasmine+equoria@` would otherwise advertise both the identity and what
    // the address was filed under.
    expect(maskEmailAddress('jasmine+equoria@example.com')).toBe('j***@example.com');
    expect(maskEmailAddress('a+b+c@example.com')).toBe('a***@example.com');
  });

  it('masks a non-ASCII local part by code point, never by UTF-16 unit', () => {
    // Built from code points so this file stays ASCII and no editor or tool can
    // silently re-encode the characters under test.
    const uUmlaut = String.fromCodePoint(0xfc);
    expect(maskEmailAddress(`${uUmlaut}nicorn@example.com`)).toBe(`${uUmlaut}***@example.com`);

    // Astral plane (U+1F40E HORSE): slicing by UTF-16 unit would emit a lone
    // surrogate here, which is not a character at all.
    const horse = String.fromCodePoint(0x1f40e);
    expect(horse.length).toBe(2); // two UTF-16 units, one code point
    expect(maskEmailAddress(`${horse}mare@example.com`)).toBe(`${horse}***@example.com`);
  });

  it('reveals nothing for a shape it does not recognise', () => {
    expect(maskEmailAddress('@example.com')).toBe('***');
    expect(maskEmailAddress('jasmine@')).toBe('***');
    expect(maskEmailAddress('jasmine')).toBe('***');
  });

  it('returns null when there was no address at all', () => {
    expect(maskEmailAddress('')).toBeNull();
    expect(maskEmailAddress('   ')).toBeNull();
    expect(maskEmailAddress(null)).toBeNull();
    expect(maskEmailAddress(undefined)).toBeNull();
    expect(maskEmailAddress(42)).toBeNull();
  });
});
