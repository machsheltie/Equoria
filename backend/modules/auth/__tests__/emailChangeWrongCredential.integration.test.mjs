/**
 * Equoria-wkpns — a wrong password or one-time code on the email-change
 * request is a refusal of that request, not an ended session.
 *
 * Old behaviour: POST /auth/email-change/request answered a wrong password, a
 * missing code and a wrong code with 401. The frontend HTTP client reads every
 * 401 from a protected endpoint as an expired access token, so it refreshed
 * and re-sent the request: one wrong code was recorded twice against the
 * 5-failure lockout (mfaLockoutService), which then locked after three tries.
 *
 * New contract (same choice as change-password, Equoria-9dtyj): a coded 400.
 *  - no second factor, wrong password       -> currentPasswordIncorrect
 *  - second factor, code missing            -> mfaCodeRequired, checked before
 *    the password so it says nothing about whether the password was right
 *  - second factor, wrong password or code  -> passwordOrCodeIncorrect, one
 *    answer for both so the endpoint is never a password oracle that skips
 *    the second factor
 *
 * Real DB, real auth middleware, real CSRF, real lockout service. The only
 * isolation is the outbound mail sink (EMAIL_CAPTURE_FILE), as in
 * emailChangeRecoveryIdentity.integration.test.mjs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
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

const origin = 'http://localhost:3000';
const prefix = 'wkpns';
const password = 'CorrectHorse1!Battery';

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const createdUserIds = [];
let captureFile = null;

async function makeUser({ secret = null } = {}) {
  const suffix = uid();
  const row = await prisma.user.create({
    data: {
      email: `${prefix}-${suffix}@test.com`,
      username: `${prefix}${suffix}`,
      password: await bcrypt.hash(password, 4),
      firstName: 'Wrong',
      lastName: 'Credential',
      money: 100,
      role: 'user',
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
      mfaEnabled: secret !== null,
      mfaSecret: secret ? encryptField(secret) : null,
    },
  });
  createdUserIds.push(row.id);
  return row;
}

async function requestChange(user, body) {
  const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/auth/email-change/request')
    .set('Origin', origin)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ email: `${prefix}-new-${uid()}@test.com`, ...body });
}

/** A six-digit code that is not the one currently showing for `secret`. */
function wrongCode(secret) {
  const live = authenticator.generate(secret);
  return live === '000000' ? '111111' : '000000';
}

const pendingCount = userId => prisma.emailVerificationToken.count({ where: { userId } });

beforeAll(() => {
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'verification tokens',
  );
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => {
  captureFile = path.join(os.tmpdir(), `wkpns-emailchange-${randomBytes(8).toString('hex')}.jsonl`);
  process.env.EMAIL_CAPTURE_FILE = captureFile;
});

afterEach(() => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
});

describe('Equoria-wkpns — email-change refusals are coded 400s, never a 401', () => {
  it('a wrong password on an account without a second factor is currentPasswordIncorrect', async () => {
    const user = await makeUser();

    const res = await requestChange(user, { password: 'NotMyPassword1!' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'currentPasswordIncorrect' });
    expect(await pendingCount(user.id)).toBe(0);
  });

  it('a missing code is mfaCodeRequired whether or not the password was right', async () => {
    const user = await makeUser({ secret: authenticator.generateSecret() });

    const rightPassword = await requestChange(user, { password });
    const wrongPassword = await requestChange(user, { password: 'NotMyPassword1!' });

    expect(rightPassword.status).toBe(400);
    expect(wrongPassword.status).toBe(400);
    expect(rightPassword.body).toMatchObject({ success: false, code: 'mfaCodeRequired' });
    expect(wrongPassword.body).toEqual(rightPassword.body);
    expect(await pendingCount(user.id)).toBe(0);
  });

  it('a wrong password and a wrong code get the same answer on a second-factor account', async () => {
    const secret = authenticator.generateSecret();
    const user = await makeUser({ secret });

    const badPassword = await requestChange(user, {
      password: 'NotMyPassword1!',
      totpToken: authenticator.generate(secret),
    });
    const badCode = await requestChange(user, { password, totpToken: wrongCode(secret) });

    expect(badPassword.status).toBe(400);
    expect(badCode.status).toBe(400);
    expect(badCode.body).toMatchObject({ success: false, code: 'passwordOrCodeIncorrect' });
    expect(badPassword.body).toEqual(badCode.body);
    expect(await pendingCount(user.id)).toBe(0);
  });

  it('counts each wrong code exactly once: four misses still allow the right code', async () => {
    const secret = authenticator.generateSecret();
    const user = await makeUser({ secret });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const miss = await requestChange(user, { password, totpToken: wrongCode(secret) });
      expect(miss.status).toBe(400);
    }
    const ok = await requestChange(user, { password, totpToken: authenticator.generate(secret) });

    expect(ok.status).toBe(200);
    expect(await pendingCount(user.id)).toBe(1);
  });

  it('locks on the fifth wrong code, not before', async () => {
    const secret = authenticator.generateSecret();
    const user = await makeUser({ secret });

    const statuses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const miss = await requestChange(user, { password, totpToken: wrongCode(secret) });
      statuses.push(miss.status);
    }
    const afterLock = await requestChange(user, { password, totpToken: authenticator.generate(secret) });

    expect(statuses).toEqual([400, 400, 400, 400, 400]);
    expect(afterLock.status).toBe(429);
    expect(await pendingCount(user.id)).toBe(0);
  });
});
