/**
 * Staff check-in (email second factor) and the capability guard — real HTTP,
 * real DB (Equoria-puj1e.1, Task 3). Security gate: file-name token `Mfa`.
 *
 * Every request goes through app.mjs with real authenticateToken and real
 * CSRF (fetchCsrf). Codes are read back from the email service's own
 * non-production sink (EMAIL_CAPTURE_FILE), as the auth suites do; nothing is
 * mocked. Each rate-limit-sensitive case uses its own fixture user.
 *
 * The capability guard is exercised through GET /api/v1/staff/log, guarded by
 * requireStaffCapability('log.view.own'). Fixtures live in
 * helpers/staffFixtures.mjs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import app from '../../../app.mjs';
import { buildRouters } from '../../../app/routers.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  ORIGIN,
  capturedFor,
  checkIn,
  createUserFactory,
  deviceCookieFrom,
  get,
  latestCode,
  post,
  sha256,
  startEmailCapture,
  stopEmailCapture,
  uid,
  wrongCodeFor,
} from './helpers/staffFixtures.mjs';

const ME = '/api/v1/staff/me';
const STATUS = '/api/v1/staff/log';
const REQUEST = '/api/v1/staff/checkin/request';
const VERIFY = '/api/v1/staff/checkin/verify';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffmfa');

const cookiesFor = (user, device) =>
  device ? [`accessToken=${user.token}`, `staff_device=${device}`] : [`accessToken=${user.token}`];

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

describe('Staff check-in and capability guard (Equoria-puj1e.1)', () => {
  it('answers a player with the ordinary unknown-route 404 on every staff path', async () => {
    const player = await makeUser('user');
    const unmounted = await get(`/api/v1/no-such-route-${uid()}`, player);
    expect(unmounted.status).toBe(404);

    for (const res of [
      await get(ME, player),
      await get(STATUS, player),
      await post(REQUEST, player),
      await post(VERIFY, player, { code: '123456' }),
    ]) {
      expect(res.status).toBe(404);
      expect(Object.keys(res.body).sort()).toEqual(Object.keys(unmounted.body).sort());
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(unmounted.body.message);
      expect(res.body.code).toBeUndefined();
    }
    expect(capturedFor(player.email)).toHaveLength(0);
    expect(await prisma.staffCheckinCode.count({ where: { userId: player.id } })).toBe(0);
  });

  it('refuses an anonymous caller before any staff logic', async () => {
    const res = await request(app).get(ME).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('requires check-in, then trusts the browser after a real email code', async () => {
    const mod = await makeUser('moderator');

    const before = await get(STATUS, mod);
    expect(before.status).toBe(403);
    expect(before.body.code).toBe('staffCheckinRequired');

    const meBefore = await get(ME, mod);
    expect(meBefore.status).toBe(200);
    expect(meBefore.body).toEqual({
      role: 'moderator',
      capabilities: expect.arrayContaining(['warn', 'ticket.file', 'log.view.own']),
      trusted: false,
    });
    expect(meBefore.body.capabilities).not.toContain('roles.manage');

    const requested = await post(REQUEST, mod);
    expect(requested.status).toBe(202);
    expect(requested.body).toEqual({ sent: true });

    const code = latestCode(mod.email);
    expect(code).toMatch(/^\d{6}$/);
    const entry = capturedFor(mod.email).at(-1);
    expect(entry.preview).toBe(`Your Steward's Office code is ${code}. It expires in 10 minutes.`);

    const row = await prisma.staffCheckinCode.findFirst({ where: { userId: mod.id } });
    expect(row.codeHash).not.toContain(code);
    const ttl = row.expiresAt.getTime() - row.createdAt.getTime();
    expect(ttl).toBeGreaterThan(9.9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);

    const verified = await post(VERIFY, mod, { code });
    expect(verified.status).toBe(200);
    const cookie = deviceCookieFrom(verified);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/staff(;|$)/);
    expect(cookie).toMatch(/Max-Age=2592000/);
    const rawToken = cookie.split(';')[0].slice('staff_device='.length);
    expect(Buffer.from(rawToken, 'base64url')).toHaveLength(32);

    const devices = await prisma.staffTrustedDevice.findMany({ where: { userId: mod.id } });
    expect(devices).toHaveLength(1);
    expect(devices[0].tokenHash).toBe(sha256(rawToken));
    expect(devices[0].tokenHash).not.toBe(rawToken);

    const meAfter = await get(ME, mod, rawToken);
    expect(meAfter.status).toBe(200);
    expect(meAfter.body.trusted).toBe(true);

    const status = await get(STATUS, mod, rawToken);
    expect(status.status).toBe(200);
    // The verified check-in itself is the one entry in the moderator's own log.
    expect(status.body.entries).toHaveLength(1);
    expect(status.body.entries[0]).toMatchObject({
      actorId: mod.id,
      capability: 'staff.checkin',
      targetId: String(devices[0].id),
    });
    expect(status.body.nextCursor).toBeNull();
  });

  it('logs one staff.checkin row per verified check-in, naming the new device', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    expect((await post(VERIFY, mod, { code: latestCode(mod.email) })).status).toBe(200);

    const device = await prisma.staffTrustedDevice.findFirst({ where: { userId: mod.id } });
    const rows = await prisma.staffActionLog.findMany({ where: { actorId: mod.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorRole: 'moderator',
      capability: 'staff.checkin',
      targetType: 'device',
      targetId: String(device.id),
      reason: null,
      outcome: 'succeeded',
    });
  });

  it('writes no check-in log row for a wrong code, an exhausted code, or a reused code', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    const code = latestCode(mod.email);
    expect((await post(VERIFY, mod, { code: wrongCodeFor(code) })).status).toBe(400);
    expect(await prisma.staffActionLog.count({ where: { actorId: mod.id } })).toBe(0);

    expect((await post(VERIFY, mod, { code })).status).toBe(200);
    expect((await post(VERIFY, mod, { code })).status).toBe(400);
    expect(await prisma.staffActionLog.count({ where: { actorId: mod.id, capability: 'staff.checkin' } })).toBe(1);
  });

  it('burns a code after five wrong guesses, even for the right code', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    const code = latestCode(mod.email);

    for (let i = 0; i < 5; i += 1) {
      const res = await post(VERIFY, mod, { code: wrongCodeFor(code) });
      expect(res.status).toBe(400);
    }
    const res = await post(VERIFY, mod, { code });
    expect(res.status).toBe(400);
    expect(deviceCookieFrom(res)).toBeNull();
    expect(await prisma.staffTrustedDevice.count({ where: { userId: mod.id } })).toBe(0);
    const row = await prisma.staffCheckinCode.findFirst({ where: { userId: mod.id } });
    expect(row.attempts).toBe(5);
    expect(row.usedAt).toBeNull();
  });

  it('never lets parallel wrong guesses exceed the five-attempt cap', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    const code = latestCode(mod.email);

    const csrfs = await Promise.all(
      Array.from({ length: 8 }, () => fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(mod) })),
    );
    const results = await Promise.all(
      csrfs.map(csrf =>
        request(app)
          .post(VERIFY)
          .set('Origin', ORIGIN)
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.csrfToken)
          .send({ code: wrongCodeFor(code) }),
      ),
    );
    expect(results.every(r => r.status === 400)).toBe(true);
    const row = await prisma.staffCheckinCode.findFirst({ where: { userId: mod.id } });
    expect(row.attempts).toBe(5);
    expect((await post(VERIFY, mod, { code })).status).toBe(400);
  });

  it('refuses a code that was already used', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    const code = latestCode(mod.email);
    expect((await post(VERIFY, mod, { code })).status).toBe(200);

    const again = await post(VERIFY, mod, { code });
    expect(again.status).toBe(400);
    expect(deviceCookieFrom(again)).toBeNull();
    expect(await prisma.staffTrustedDevice.count({ where: { userId: mod.id } })).toBe(1);
  });

  it('refuses an expired code', async () => {
    const mod = await makeUser('moderator');
    expect((await post(REQUEST, mod)).status).toBe(202);
    const code = latestCode(mod.email);
    await prisma.staffCheckinCode.updateMany({
      where: { userId: mod.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await post(VERIFY, mod, { code });
    expect(res.status).toBe(400);
    expect(await prisma.staffTrustedDevice.count({ where: { userId: mod.id } })).toBe(0);
  });

  it('allows three code requests per 15 minutes and refuses the fourth with 429', async () => {
    const mod = await makeUser('moderator');
    for (let i = 0; i < 3; i += 1) {
      expect((await post(REQUEST, mod)).status).toBe(202);
    }
    const fourth = await post(REQUEST, mod);
    expect(fourth.status).toBe(429);
    expect(await prisma.staffCheckinCode.count({ where: { userId: mod.id } })).toBe(3);
    expect(capturedFor(mod.email)).toHaveLength(3);
  });

  it('refuses a code to a moderator whose email is unverified, and sends nothing', async () => {
    const mod = await makeUser('moderator', { emailVerified: false, emailVerifiedAt: null });
    const res = await post(REQUEST, mod);
    // Owner ruling q248 (Equoria-voasj): an unconfirmed account, staff included,
    // is refused at the door before any staff route runs.
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('emailNotVerified');
    expect(capturedFor(mod.email)).toHaveLength(0);
    expect(await prisma.staffCheckinCode.count({ where: { userId: mod.id } })).toBe(0);
  });

  it("refuses one moderator's device cookie on another moderator's session", async () => {
    const owner = await makeUser('moderator');
    const other = await makeUser('moderator');
    const device = await checkIn(owner);

    const res = await get(STATUS, other, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffCheckinRequired');
    expect((await get(ME, other, device)).body.trusted).toBe(false);
  });

  it('answers 404 on the next request once the role is revoked in the DB', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);
    expect((await get(STATUS, mod, device)).status).toBe(200);

    await prisma.user.update({ where: { id: mod.id }, data: { role: 'user' } });

    expect((await get(STATUS, mod, device)).status).toBe(404);
    expect((await get(ME, mod, device)).status).toBe(404);
  });

  it('asks again after a password change newer than the device', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);
    expect((await get(STATUS, mod, device)).status).toBe(200);

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.staffTrustedDevice.updateMany({
      where: { userId: mod.id },
      data: { createdAt: new Date(hourAgo.getTime() - 60 * 60 * 1000) },
    });
    await prisma.user.update({ where: { id: mod.id }, data: { passwordChangedAt: hourAgo } });
    // A session issued after the password change, so authentication itself passes.
    const fresh = { ...mod, token: generateTestToken({ id: mod.id, email: mod.email, role: 'moderator' }) };

    const res = await get(STATUS, fresh, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffCheckinRequired');
  });

  it('refuses staff tools once the staff email is no longer verified', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);
    await prisma.user.update({ where: { id: mod.id }, data: { emailVerified: false } });

    const res = await get(STATUS, mod, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('staffEmailUnverified');
  });

  it('refuses an expired or revoked device', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);

    await prisma.staffTrustedDevice.updateMany({
      where: { userId: mod.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await get(STATUS, mod, device)).body.code).toBe('staffCheckinRequired');

    await prisma.staffTrustedDevice.updateMany({
      where: { userId: mod.id },
      data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
    });
    expect((await get(STATUS, mod, device)).body.code).toBe('staffCheckinRequired');
  });
});

// STAFF-CR-05: an unmatched /api/v1/staff/* path must end inside the staff
// router with the app's ordinary 404, never fall through to the /api/v1
// authRouter where a '/'-mounted router could serve /staff/... unguarded.
describe('Unknown staff paths end in the ordinary 404 (STAFF-CR-05)', () => {
  // Per-request measurements (clocks incl. x-timestamp, rate-limit counters, memory and timing
  // probes) and values derived from the differing URL (content-length, etag,
  // x-response-size) are excluded; everything else, including which headers
  // are present, must match exactly.
  const VOLATILE =
    /^(date|etag|content-length|ratelimit.*|x-ratelimit.*|x-response-time|x-request-id|x-timestamp|x-memory-.*|x-processing-time|x-response-size)$/;
  const shape = (res, url) => ({
    status: res.status,
    body: res.text.split(url).join('<path>'),
    headerNames: Object.keys(res.headers).sort(),
    headers: Object.entries(res.headers)
      .filter(([name]) => !VOLATILE.test(name))
      .sort(([a], [b]) => a.localeCompare(b)),
  });

  it('answers an unknown staff path exactly like any unknown /api/v1 path, signed in or anonymous', async () => {
    const player = await makeUser('user');
    const staffUrl = `/api/v1/staff/does-not-exist-${uid()}`;
    const otherUrl = `/api/v1/nothing-here-${uid()}`;
    const signedInStaff = shape(await get(staffUrl, player), staffUrl);
    expect(signedInStaff.status).toBe(404);
    expect(signedInStaff).toEqual(shape(await get(otherUrl, player), otherUrl));

    const anon = url => request(app).get(url).set('Origin', ORIGIN);
    expect(shape(await anon(staffUrl), staffUrl)).toEqual(shape(await anon(otherUrl), otherUrl));
  });

  it('a /staff route planted on a router mounted at / on the authRouter cannot be reached', async () => {
    // Real routers from buildRouters(), mounted staff-first as app.mjs does.
    // That order is what check-staff-routes-mount pins in app.mjs: no router
    // or handler covering /api/v1/staff (authRouter at /api/v1 included) may
    // come before app.use('/api/v1/staff', staffRouter); only publicRouter at
    // '/' does, and its paths are pinned not to cover /api/v1/staff. This mini
    // app reproduces that order; the planted router is test-only.
    const { authRouter, staffRouter } = buildRouters();
    const planted = express.Router();
    planted.get('/staff/planted', (req, res) => res.json({ leaked: true }));
    planted.get('/control/planted', (req, res) => res.json({ leaked: true }));
    authRouter.use('/', planted);
    const mini = express();
    mini.use(cookieParser());
    mini.use('/api/v1/staff', staffRouter);
    mini.use('/api/v1', authRouter);

    const player = await makeUser('user');
    const hit = url =>
      request(mini)
        .get(url)
        .set('Origin', ORIGIN)
        .set('Cookie', [`accessToken=${player.token}`]);

    // The planting works: the same router serves its non-staff path.
    expect((await hit('/api/v1/control/planted')).body).toEqual({ leaked: true });

    const res = await hit('/api/v1/staff/planted');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
      path: '/api/v1/staff/planted',
      method: 'GET',
    });
  });
});
