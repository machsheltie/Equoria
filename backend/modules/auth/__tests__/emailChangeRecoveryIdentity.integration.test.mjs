/**
 * Finding 5 (Equoria-6p398.5) — email changes are changes to account recovery
 * identity.
 *
 * FAILING TEST FIRST: every assertion below MUST fail against the un-patched
 * code, where `PUT /api/v1/auth/profile` replaced `User.email` outright while
 * keeping `emailVerified`/`emailVerifiedAt`, with only a session + CSRF token.
 *
 * Real DB, real auth, real CSRF, real token rows. The ONLY isolation is the
 * outbound email provider: `emailService` writes its preview payload to
 * `EMAIL_CAPTURE_FILE` in non-production (a real service sink, not a bypass),
 * so the raw confirmation token is read back from that file exactly as the
 * password-reset suite does. No mocked Prisma, no fabricated verification.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { encryptField } from '../../../utils/fieldEncryption.mjs';

const ORIGIN = 'http://localhost:3000';
const PREFIX = 'f5emailid';
const PASSWORD = 'CorrectHorse1!';

const uid = () => randomBytes(5).toString('hex');
const sha256 = value => createHash('sha256').update(value).digest('hex');

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
      firstName: 'Recovery',
      lastName: 'Identity',
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

  // Scoped, fail-loud cleanup in FK order. Only rows this suite created.
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
  captureFile = path.join(os.tmpdir(), `f5-emailchange-${randomBytes(8).toString('hex')}.jsonl`);
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

const requestChange = (body, actingToken) => authedSend('post', '/api/v1/auth/email-change/request', body, actingToken);

const confirmChange = rawToken =>
  request(app)
    .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(rawToken ?? '')}`)
    .set('Origin', ORIGIN);

const readUser = id =>
  prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, emailVerified: true, emailVerifiedAt: true },
  });

/**
 * Shift the suite user's existing email-change request rows back in time so the
 * resend cooldown no longer applies. Real rows, real predicate — only the clock
 * is moved, which is what "five minutes later" means. Used where a scenario
 * genuinely needs two consecutive requests.
 */
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
    data: { email, emailVerified: true, emailVerifiedAt: new Date(), mfaEnabled: false, mfaSecret: null },
  });
  user = { ...user, email };
  token = generateTestToken({ id: user.id, email, role: 'user' });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — PUT /api/v1/auth/profile cannot move the recovery address', () => {
  it('rejects a changed email supplied with only a session + CSRF token, leaving identity untouched', async () => {
    const before = await readUser(user.id);
    const hijack = `${PREFIX}-hijack-${uid()}@test.com`;

    const res = await authedSend('put', '/api/v1/auth/profile', { email: hijack });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/confirm/i);

    const after = await readUser(user.id);
    expect(after.email).toBe(before.email);
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerifiedAt).not.toBeNull();
    expect(after.emailVerifiedAt.getTime()).toBe(before.emailVerifiedAt.getTime());
  });

  it('still updates non-identity profile fields (bio) without any fresh-auth proof', async () => {
    const res = await authedSend('put', '/api/v1/auth/profile', { bio: 'A quiet barn at dusk.' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.bio).toBe('A quiet barn at dusk.');
  });

  it('treats a same-email request as a no-op and does NOT reset verification', async () => {
    const before = await readUser(user.id);

    const res = await authedSend('put', '/api/v1/auth/profile', {
      email: before.email.toUpperCase(),
      bio: 'Same address, different case.',
    });

    expect(res.status).toBe(200);
    const after = await readUser(user.id);
    expect(after.email).toBe(before.email);
    expect(after.emailVerified).toBe(true);
    expect(after.emailVerifiedAt.getTime()).toBe(before.emailVerifiedAt.getTime());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — fresh authentication gates the change request', () => {
  it('rejects a wrong password and stages nothing', async () => {
    const target = `${PREFIX}-wrongpw-${uid()}@test.com`;
    const res = await requestChange({ email: target, password: 'NotMyPassword9!' });

    expect(res.status).toBe(401);
    const pending = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(pending).toHaveLength(0);
    expect(readCaptured('email-change')).toHaveLength(0);
  });

  it('rejects a missing password', async () => {
    const res = await requestChange({ email: `${PREFIX}-nopw-${uid()}@test.com` });
    expect(res.status).toBe(400);
  });

  it('rejects a same-address request without staging a pending change', async () => {
    const res = await requestChange({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(400);
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(0);
  });

  it('rejects an address already owned by another account', async () => {
    const other = await makeUser();
    const res = await requestChange({ email: other.email, password: PASSWORD });
    expect(res.status).toBe(409);
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(0);
  });

  it('requires a valid TOTP step-up when the account has MFA enabled', async () => {
    const secret = authenticator.generateSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaSecret: encryptField(secret) },
    });
    const target = `${PREFIX}-mfa-${uid()}@test.com`;

    try {
      const withoutTotp = await requestChange({ email: target, password: PASSWORD });
      expect(withoutTotp.status).toBe(401);
      expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);

      const withTotp = await requestChange({
        email: target,
        password: PASSWORD,
        totpToken: authenticator.generate(secret),
      });
      expect(withTotp.status).toBe(200);
      expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(1);
    } finally {
      await resetIdentity(user.email);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — staged pending address, confirmed identity stays active', () => {
  it('stages the replacement, keeps the confirmed identity live, then commits on confirmation', async () => {
    const originalEmail = user.email;
    const replacement = `${PREFIX}-new-${uid()}@test.com`;

    const req = await requestChange({ email: replacement, password: PASSWORD });
    expect(req.status).toBe(200);
    expect(req.body.data.pendingEmail).toBe(replacement);

    // Confirmed identity is untouched while the change is pending.
    const staged = await readUser(user.id);
    expect(staged.email).toBe(originalEmail);
    expect(staged.emailVerified).toBe(true);

    // The pending row carries the exact normalized destination, hashed at rest.
    const rawToken = capturedToken('email-change');
    const row = await prisma.emailVerificationToken.findFirst({ where: { userId: user.id } });
    expect(row.email).toBe(replacement);
    expect(row.tokenHash).toBe(sha256(rawToken));
    expect(row.tokenHash).not.toContain(rawToken);
    expect(row.usedAt).toBeNull();

    // Delivery went to the replacement address, not the confirmed one.
    const delivered = readCaptured('email-change');
    expect(delivered[delivered.length - 1].to).toBe(replacement);

    // Before confirmation password recovery still targets the CONFIRMED identity.
    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email: replacement });
    expect(readCaptured('password-reset')).toHaveLength(0);

    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email: originalEmail });
    const beforeReset = readCaptured('password-reset');
    expect(beforeReset).toHaveLength(1);
    expect(beforeReset[0].to).toBe(originalEmail);

    // Confirm.
    const confirm = await confirmChange(rawToken);
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.email).toBe(replacement);

    const committed = await readUser(user.id);
    expect(committed.email).toBe(replacement);
    expect(committed.emailVerified).toBe(true);
    expect(committed.emailVerifiedAt).not.toBeNull();

    // The consumed token is one-time.
    const consumed = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    expect(consumed.usedAt).not.toBeNull();
    const replay = await confirmChange(rawToken);
    expect(replay.status).toBe(400);

    // Obsolete password-reset proofs delivered to the old address are revoked.
    const liveResets = await prisma.$queryRawUnsafe(
      'SELECT id FROM password_reset_tokens WHERE "userId" = $1 AND "usedAt" IS NULL',
      user.id,
    );
    expect(liveResets).toHaveLength(0);

    // After the change, password recovery targets the REPLACEMENT identity.
    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email: originalEmail });
    expect(readCaptured('password-reset')).toHaveLength(1); // unchanged — old address is gone

    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email: replacement });
    const afterReset = readCaptured('password-reset');
    expect(afterReset).toHaveLength(2);
    expect(afterReset[afterReset.length - 1].to).toBe(replacement);

    await resetIdentity(originalEmail);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — token misuse matrix', () => {
  it('a signup-verification token cannot confirm a pending email change', async () => {
    const replacement = `${PREFIX}-purpose-${uid()}@test.com`;
    const req = await requestChange({ email: replacement, password: PASSWORD });
    expect(req.status).toBe(200);

    // A bare signup-purpose token for this same account.
    const signupRaw = randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: sha256(signupRaw),
        userId: user.id,
        email: user.email,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const res = await confirmChange(signupRaw);
    expect(res.status).toBe(400);
    expect((await readUser(user.id)).email).toBe(user.email);

    await resetIdentity(user.email);
  });

  it('an email-change token cannot be redeemed at GET /auth/verify-email', async () => {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: false, emailVerifiedAt: null },
    });
    const replacement = `${PREFIX}-crosspurpose-${uid()}@test.com`;
    const req = await requestChange({ email: replacement, password: PASSWORD });
    expect(req.status).toBe(200);
    const rawToken = capturedToken('email-change');

    const res = await request(app)
      .get(`/api/v1/auth/verify-email?token=${encodeURIComponent(rawToken)}`)
      .set('Origin', ORIGIN);
    expect(res.status).toBeGreaterThanOrEqual(400);

    const after = await readUser(user.id);
    expect(after.email).toBe(user.email);
    expect(after.emailVerified).toBe(false);

    await resetIdentity(user.email);
  });

  it('a superseded pending address cannot confirm after a newer request', async () => {
    const firstTarget = `${PREFIX}-first-${uid()}@test.com`;
    const secondTarget = `${PREFIX}-second-${uid()}@test.com`;

    expect((await requestChange({ email: firstTarget, password: PASSWORD })).status).toBe(200);
    const firstRaw = capturedToken('email-change');
    // Fix round 1 added a resend cooldown; this scenario is about supersession,
    // not throttling, so move the clock rather than weaken either assertion.
    await ageChangeRequestsPastCooldown();
    expect((await requestChange({ email: secondTarget, password: PASSWORD })).status).toBe(200);
    const secondRaw = capturedToken('email-change');
    expect(secondRaw).not.toBe(firstRaw);

    const stale = await confirmChange(firstRaw);
    expect(stale.status).toBe(400);
    expect((await readUser(user.id)).email).toBe(user.email);

    const ok = await confirmChange(secondRaw);
    expect(ok.status).toBe(200);
    expect((await readUser(user.id)).email).toBe(secondTarget);

    await resetIdentity(user.email);
  }, 30_000);

  it('a token for the previous address cannot re-take the account after the identity moves', async () => {
    const originalEmail = user.email;
    const replacement = `${PREFIX}-moved-${uid()}@test.com`;

    // A signup-verification token outstanding for the ORIGINAL address.
    const oldAddressRaw = randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
      data: {
        tokenHash: sha256(oldAddressRaw),
        userId: user.id,
        email: originalEmail,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    expect((await requestChange({ email: replacement, password: PASSWORD })).status).toBe(200);
    const rawToken = capturedToken('email-change');
    expect((await confirmChange(rawToken)).status).toBe(200);

    // Identity moved. The old-address proof must be dead on both surfaces.
    expect((await confirmChange(oldAddressRaw)).status).toBe(400);
    const verifyRes = await request(app)
      .get(`/api/v1/auth/verify-email?token=${encodeURIComponent(oldAddressRaw)}`)
      .set('Origin', ORIGIN);
    expect(verifyRes.status).toBeGreaterThanOrEqual(400);

    expect((await readUser(user.id)).email).toBe(replacement);
    await resetIdentity(originalEmail);
  }, 30_000);

  it("another account's pending token cannot move this account", async () => {
    const victimEmail = user.email;
    const attacker = await makeUser();
    const attackerToken = generateTestToken({ id: attacker.id, email: attacker.email, role: 'user' });
    const attackerTarget = `${PREFIX}-attacker-${uid()}@test.com`;

    expect((await requestChange({ email: attackerTarget, password: PASSWORD }, attackerToken)).status).toBe(200);
    const attackerRaw = capturedToken('email-change');

    const res = await confirmChange(attackerRaw);
    expect(res.status).toBe(200); // it confirms the ATTACKER's own change
    expect(res.body.data.email).toBe(attackerTarget);

    expect((await readUser(user.id)).email).toBe(victimEmail);
    expect((await readUser(attacker.id)).email).toBe(attackerTarget);
  }, 30_000);

  it('an expired pending token cannot confirm', async () => {
    const replacement = `${PREFIX}-expired-${uid()}@test.com`;
    expect((await requestChange({ email: replacement, password: PASSWORD })).status).toBe(200);
    const rawToken = capturedToken('email-change');

    await prisma.emailVerificationToken.update({
      where: { tokenHash: sha256(rawToken) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const res = await confirmChange(rawToken);
    expect(res.status).toBe(400);
    expect((await readUser(user.id)).email).toBe(user.email);

    await resetIdentity(user.email);
  });

  it('an unknown token cannot confirm', async () => {
    const res = await confirmChange(randomBytes(32).toString('hex'));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — concurrent confirmations and duplicate-address conflicts', () => {
  it('two simultaneous confirmations of the same token leave exactly one coherent identity', async () => {
    const originalEmail = user.email;
    const replacement = `${PREFIX}-race-${uid()}@test.com`;
    expect((await requestChange({ email: replacement, password: PASSWORD })).status).toBe(200);
    const rawToken = capturedToken('email-change');

    const [a, b] = await Promise.all([confirmChange(rawToken), confirmChange(rawToken)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 400]);

    const after = await readUser(user.id);
    expect(after.email).toBe(replacement);
    expect(after.emailVerified).toBe(true);

    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows.every(r => r.usedAt !== null)).toBe(true);

    await resetIdentity(originalEmail);
  }, 60_000);

  it('a duplicate destination confirmed by a rival account is rejected with no partial state', async () => {
    const contested = `${PREFIX}-contested-${uid()}@test.com`;
    const rival = await makeUser();
    const rivalToken = generateTestToken({ id: rival.id, email: rival.email, role: 'user' });

    expect((await requestChange({ email: contested, password: PASSWORD })).status).toBe(200);
    const ourRaw = capturedToken('email-change');
    expect((await requestChange({ email: contested, password: PASSWORD }, rivalToken)).status).toBe(200);
    const rivalRaw = capturedToken('email-change');

    expect((await confirmChange(ourRaw)).status).toBe(200);
    expect((await readUser(user.id)).email).toBe(contested);

    const loser = await confirmChange(rivalRaw);
    expect(loser.status).toBe(409);

    const rivalAfter = await readUser(rival.id);
    expect(rivalAfter.email).toBe(rival.email);
    // Rolled back cleanly: the losing token is still un-consumed and retryable.
    const rivalRow = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(rivalRaw) },
    });
    expect(rivalRow.usedAt).toBeNull();

    await resetIdentity(user.email);
  }, 60_000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Finding 5 — the confirmed address is told, and the endpoint is throttled', () => {
  it('notifies the CURRENT confirmed address at request time, with no token in the notice', async () => {
    const replacement = `${PREFIX}-notice-${uid()}@test.com`;
    const res = await requestChange({ email: replacement, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.noticeDelivered).toBe(true);

    const notices = readCaptured('email-change-notice');
    expect(notices).toHaveLength(1);
    // Addressed to the address that is still the live recovery identity.
    expect(notices[0].to).toBe(user.email);
    expect(notices[0].pendingEmail).toBe(replacement);
    // Information only — it carries no confirmation link, so it can never be
    // used to approve the change it is warning about.
    expect(notices[0].preview).toBeUndefined();
    expect(JSON.stringify(notices[0])).not.toContain('ec1_');

    await resetIdentity(user.email);
  }, 30_000);

  it('rejects a second request inside the resend cooldown, with retryAfter and no extra mail', async () => {
    const first = `${PREFIX}-cool1-${uid()}@test.com`;
    const second = `${PREFIX}-cool2-${uid()}@test.com`;

    expect((await requestChange({ email: first, password: PASSWORD })).status).toBe(200);
    const mailAfterFirst = readCaptured('email-change').length;

    // The route's authRateLimiter is configured skipSuccessfulRequests, so it
    // counts nothing here; this cooldown is the actual ceiling on outbound mail
    // and token-row growth.
    const throttled = await requestChange({ email: second, password: PASSWORD });
    expect(throttled.status).toBe(429);
    expect(throttled.body.success).toBe(false);
    expect(throttled.body.retryAfter).toBeGreaterThan(0);
    expect(String(throttled.body.message)).toMatch(/wait/i);

    // No second link was minted and no second message went out.
    expect(readCaptured('email-change')).toHaveLength(mailAfterFirst);
    const rows = await prisma.emailVerificationToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(first);

    await resetIdentity(user.email);
  }, 30_000);

  it('caps the number of live pending changes even when the cooldown has elapsed', async () => {
    // Seed the cap's worth of live pending-change rows in exactly the shape the
    // flow writes, then age them so the cooldown is not what does the rejecting.
    for (let i = 0; i < 5; i += 1) {
      await prisma.emailVerificationToken.create({
        data: {
          tokenHash: sha256(`ec1_${randomBytes(32).toString('hex')}`),
          userId: user.id,
          email: `${PREFIX}-cap${i}-${uid()}@test.com`,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
    }
    await ageChangeRequestsPastCooldown();

    const res = await requestChange({
      email: `${PREFIX}-capover-${uid()}@test.com`,
      password: PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/maximum pending email changes/i);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(5);

    await resetIdentity(user.email);
  }, 30_000);
});
