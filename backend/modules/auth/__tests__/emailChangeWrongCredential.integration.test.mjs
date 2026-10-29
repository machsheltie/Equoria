/**
 * Equoria-wkpns — a wrong password on the email-change request is a refusal
 * of that request, not an ended session.
 *
 * Old behaviour: POST /auth/email-change/request answered a wrong password, a
 * missing code and a wrong code with 401. The frontend HTTP client reads every
 * 401 from a protected endpoint as an expired access token, so it refreshed
 * and re-sent the request: one wrong code was recorded twice against the
 * 5-failure lockout (mfaLockoutService), which then locked after three tries.
 *
 * New contract (same choice as change-password, Equoria-9dtyj): a wrong
 * password is a coded 400, currentPasswordIncorrect.
 *
 * Owner ruling 2026-10-29 (q305): authenticator-app (TOTP) sign-in is removed.
 * Old contract: an account with a second factor also needed a one-time code
 * (mfaCodeRequired / passwordOrCodeIncorrect, a 5-failure lockout). New ruling:
 * the password alone decides; a leftover totpToken in the body changes nothing.
 *
 * Real DB, real auth middleware, real CSRF. The only
 * isolation is the outbound mail sink (EMAIL_CAPTURE_FILE), as in
 * emailChangeRecoveryIdentity.integration.test.mjs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const origin = 'http://localhost:3000';
const prefix = 'wkpns';
const password = 'CorrectHorse1!Battery';

const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const createdUserIds = [];
let captureFile = null;

async function makeUser() {
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

  it('a wrong password is currentPasswordIncorrect even when a code is sent', async () => {
    const user = await makeUser();

    const res = await requestChange(user, { password: 'NotMyPassword1!', totpToken: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'currentPasswordIncorrect' });
    expect(await pendingCount(user.id)).toBe(0);
  });

  it('the right password alone stages the change; a leftover code is ignored (q305)', async () => {
    const user = await makeUser();

    const res = await requestChange(user, { password, totpToken: '000000' });
    expect(res.status).toBe(200);
    expect(await pendingCount(user.id)).toBe(1);
  });
});
