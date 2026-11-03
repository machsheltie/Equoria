/**
 * The steward check-in cookie's name (Equoria-pjvp8.7) — real HTTP, real DB.
 *
 * Owner ruling 2026-10-21/22: Equoria names are camelCase, so the cookie is
 * `staffDevice`. Orchestrator ruling 2026-10-29: read both names for a while,
 * then retire the old one, so no steward has to check in again. This suite pins
 * the "read both" step:
 *   - a real check-in sets `staffDevice` and clears the old `staff_device`;
 *   - a browser that still holds only the old `staff_device` stays checked in on
 *     every guard that reads the cookie (/me, the capability guard, the admin
 *     check-in guard);
 *   - the new name is trusted the same way.
 *
 * Nothing is mocked; trusted devices are real rows scoped to this suite's users.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  hashDeviceToken,
  legacyStaffDeviceCookie,
  staffDeviceCookie,
  trustedDeviceTtlMs,
} from '../services/staffCheckinService.mjs';
import {
  ORIGIN,
  createUserFactory,
  latestCode,
  post,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const me = '/api/v1/staff/me';
const ownLog = '/api/v1/staff/log';
const adminRoute = '/api/v1/admin/sse/metrics';
// The old name is the service's own constant, so this suite adds no second
// snake_case spelling of it.
const oldName = legacyStaffDeviceCookie;
const newName = staffDeviceCookie;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffcookie');

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

/** A real trusted-device row for the user; returns its raw token. */
async function trustedDevice(user) {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await prisma.staffTrustedDevice.create({
    data: {
      userId: user.id,
      tokenHash: hashDeviceToken(rawToken),
      expiresAt: new Date(Date.now() + trustedDeviceTtlMs),
    },
  });
  return rawToken;
}

const getWith = (url, user, cookieName, rawToken) =>
  request(app)
    .get(url)
    .set('Origin', ORIGIN)
    .set('Cookie', [`accessToken=${user.token}`, `${cookieName}=${rawToken}`]);

describe('steward check-in cookie name (Equoria-pjvp8.7)', () => {
  it('the cookie is staffDevice; the old name is the pre-phase-6 one', () => {
    expect(newName).toBe('staffDevice');
    expect(oldName).not.toBe(newName);
    expect(oldName.toLowerCase().replace(/[^a-z]/g, '')).toBe('staffdevice');
  });

  it('a check-in sets staffDevice on the whole API and clears the old staff_device', async () => {
    const mod = await makeUser('moderator');
    expect((await post('/api/v1/staff/checkin/request', mod)).status).toBe(202);
    const verified = await post('/api/v1/staff/checkin/verify', mod, { code: latestCode(mod.email) });
    expect(verified.status).toBe(200);

    const setCookies = verified.headers['set-cookie'] || [];
    const current = setCookies.find(c => c.startsWith(`${newName}=`));
    expect(current).toMatch(/Path=\/api\/v1(;|$)/);
    expect(current).toMatch(/HttpOnly/i);
    expect(current).toMatch(/Max-Age=2592000/);
    const rawToken = current.split(';')[0].slice(`${newName}=`.length);
    expect(rawToken.length).toBeGreaterThan(0);

    // The old name is emptied at both paths it ever lived on.
    for (const pathPattern of [/Path=\/api\/v1(;|$)/, /Path=\/api\/v1\/staff(;|$)/]) {
      expect(setCookies).toEqual(
        expect.arrayContaining([expect.stringMatching(new RegExp(`^${oldName}=;.*${pathPattern.source}`))]),
      );
    }
    // No old-name cookie carries a token.
    expect(setCookies.filter(c => c.startsWith(`${oldName}=`) && !c.startsWith(`${oldName}=;`))).toEqual([]);

    const meAfter = await getWith(me, mod, newName, rawToken);
    expect(meAfter.status).toBe(200);
    expect(meAfter.body.trusted).toBe(true);
  });

  it.each([
    ['the old name', oldName],
    ['the new name', newName],
  ])('a moderator holding only %s stays checked in', async (_label, cookieName) => {
    const mod = await makeUser('moderator');
    const rawToken = await trustedDevice(mod);

    const meRes = await getWith(me, mod, cookieName, rawToken);
    expect(meRes.status).toBe(200);
    expect(meRes.body.trusted).toBe(true);

    const logRes = await getWith(ownLog, mod, cookieName, rawToken);
    expect(logRes.status).toBe(200);
  });

  it.each([
    ['the old name', oldName],
    ['the new name', newName],
  ])('an admin holding only %s passes the admin check-in guard', async (_label, cookieName) => {
    const admin = await makeUser('admin');
    const rawToken = await trustedDevice(admin);

    const res = await getWith(adminRoute, admin, cookieName, rawToken);
    expect(res.status).toBe(200);
  });

  it('a cookie under any other name is not a check-in', async () => {
    const mod = await makeUser('moderator');
    const rawToken = await trustedDevice(mod);

    const meRes = await getWith(me, mod, 'staffDeviceX', rawToken);
    expect(meRes.status).toBe(200);
    expect(meRes.body.trusted).toBe(false);

    const logRes = await getWith(ownLog, mod, 'staffDeviceX', rawToken);
    expect(logRes.status).toBe(403);
    expect(logRes.body.code).toBe('staffCheckinRequired');
  });
});
