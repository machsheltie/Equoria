/**
 * A cancelled staff check-in code stays cancelled (owner ruling 2026-10-28, q261,
 * Equoria-8pzlg). Real HTTP, real DB. Security gate: file-name token `Mfa`.
 *
 * Any password or email change cancels every check-in code sent before it,
 * including one issued in the same millisecond, and a server clock set back
 * afterwards must never bring a cancelled code (or a checked-in browser) back.
 *
 * The clock cases record the change through the real retirement function with
 * the time the server clock read then, and store the code's issue time as it
 * read then; the check-in itself runs on the real clock, which is behind both.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { checkinRequiredCode } from '../middleware/requireStaffCapability.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { retireStaffCheckinCodesTx } from '../services/staffChallengeRetirement.mjs';
import {
  ORIGIN,
  checkIn,
  createUserFactory,
  get,
  latestCode,
  post,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const staffApi = '/api/v1/staff';
const REQUEST = `${staffApi}/checkin/request`;
const VERIFY = `${staffApi}/checkin/verify`;
const PASSWORD = 'CorrectHorse1!';
const newPassword = 'RescuedPass9!x';
const MINUTE = 60 * 1000;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stretire');

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

const makeModerator = async () => makeUser('moderator', { password: await bcrypt.hash(PASSWORD, 4) });

/** A session issued now, after any password change, so authentication passes. */
const freshSession = user => ({
  ...user,
  token: generateTestToken({ id: user.id, email: user.email, role: 'moderator' }),
});

async function requestCode(user) {
  expect((await post(REQUEST, user)).status).toBe(202);
  const row = await prisma.staffCheckinCode.findFirst({
    where: { userId: user.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return { code: latestCode(user.email), row };
}

/** Store the code's issue time as the clock read when it was sent. */
const issuedAt = (row, at) =>
  prisma.staffCheckinCode.update({
    where: { id: row.id },
    data: { createdAt: at, expiresAt: new Date(at.getTime() + 10 * MINUTE) },
  });

/** A verified-email change recorded at `at`, cancelling codes as the real paths do. */
async function emailChangedAt(user, at) {
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: at } });
  await retireStaffCheckinCodesTx(prisma, user.id, at);
}

async function expectRefused(user, code) {
  const res = await post(VERIFY, user, { code });
  expect(res.status).toBe(400);
  expect(await prisma.staffTrustedDevice.count({ where: { userId: user.id } })).toBe(0);
}

describe('A cancelled check-in code never comes back (q261)', () => {
  it('stays refused after the server clock is set back behind the cancellation', async () => {
    const mod = await makeModerator();
    const { code, row } = await requestCode(mod);
    const now = Date.now();
    // Sent while the clock read now+6m; the email change landed at now+5m
    // (the clock had been corrected back a minute); the check-in runs at now.
    await issuedAt(row, new Date(now + 6 * MINUTE));
    await emailChangedAt(mod, new Date(now + 5 * MINUTE));

    await expectRefused(mod, code);
  }, 60_000);

  it('refuses a code sent in the same millisecond as the change, before it', async () => {
    const mod = await makeModerator();
    const { code, row } = await requestCode(mod);
    const at = new Date(Date.now() - MINUTE);
    await issuedAt(row, at);
    await emailChangedAt(mod, at);

    await expectRefused(mod, code);
  }, 60_000);

  it('a password change cancels every unused code, an already expired one included', async () => {
    const mod = await makeModerator();
    const { row } = await requestCode(mod);
    await prisma.staffCheckinCode.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - MINUTE) },
    });

    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${mod.token}`] });
    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${mod.token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ oldPassword: PASSWORD, newPassword });
    expect(changed.status).toBe(200);

    const after = await prisma.staffCheckinCode.findUnique({ where: { id: row.id } });
    expect(after.retiredAt).not.toBeNull();
    expect(after.usedAt).toBeNull();
  }, 60_000);

  it('a password change revokes the checked-in browser, so a clock set back cannot revive it', async () => {
    const mod = await makeModerator();
    const device = await checkIn(mod);
    expect((await get(`${staffApi}/log`, mod, device)).status).toBe(200);

    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${mod.token}`] });
    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${mod.token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ oldPassword: PASSWORD, newPassword });
    expect(changed.status).toBe(200);

    const rows = await prisma.staffTrustedDevice.findMany({ where: { userId: mod.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).not.toBeNull();
    // The browser checked in while the clock read a minute ahead of the change.
    const changedAt = (await prisma.user.findUnique({ where: { id: mod.id } })).passwordChangedAt;
    await prisma.staffTrustedDevice.update({
      where: { id: rows[0].id },
      data: { createdAt: new Date(changedAt.getTime() + MINUTE) },
    });

    const refused = await get(`${staffApi}/log`, freshSession(mod), device);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe(checkinRequiredCode);
  }, 60_000);
});
