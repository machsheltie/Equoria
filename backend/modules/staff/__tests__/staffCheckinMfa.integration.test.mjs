/**
 * Staff check-in (email second factor) and the capability guard — real HTTP,
 * real DB (Equoria-puj1e.1, Task 3). Security gate: file-name token `Mfa`.
 *
 * Every request goes through app.mjs with real authenticateToken and real
 * CSRF (fetchCsrf). Codes are read back from the email service's own
 * non-production sink (EMAIL_CAPTURE_FILE), as the auth suites do; nothing is
 * mocked. Each rate-limit-sensitive case uses its own fixture user.
 *
 * The capability guard is exercised through GET /api/v1/staff/checkin/status,
 * the one route guarded by requireStaffCapability('log.view.own').
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import crypto from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const ME = '/api/v1/staff/me';
const STATUS = '/api/v1/staff/checkin/status';
const REQUEST = '/api/v1/staff/checkin/request';
const VERIFY = '/api/v1/staff/checkin/verify';

const uid = () => crypto.randomBytes(5).toString('hex');
const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const cleanup = createCleanupTracker();
const createdUserIds = [];
let captureFile = null;

async function makeUser(role, extra = {}) {
  const suffix = `${uid()}${uid()}`;
  const row = await prisma.user.create({
    data: {
      email: `staffmfa-${suffix}@test.com`,
      username: `staffmfa${suffix}`,
      password: 'not-a-real-hash',
      firstName: 'Staff',
      lastName: 'Checkin',
      role,
      settings: {},
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...extra,
    },
  });
  createdUserIds.push(row.id);
  return { ...row, token: generateTestToken({ id: row.id, email: row.email, role }) };
}

const cookiesFor = (user, device) =>
  device ? [`accessToken=${user.token}`, `staff_device=${device}`] : [`accessToken=${user.token}`];

const get = (url, user, device) => request(app).get(url).set('Origin', ORIGIN).set('Cookie', cookiesFor(user, device));

async function post(url, user, body = {}, device) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(user, device) });
  return request(app)
    .post(url)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

function capturedFor(email) {
  if (!existsSync(captureFile)) {
    return [];
  }
  return readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-checkin' && entry.to === email);
}

function latestCode(email) {
  const entries = capturedFor(email);
  const entry = entries[entries.length - 1];
  if (!entry) {
    throw new Error(`No staff-checkin email captured for ${email}`);
  }
  return entry.preview.match(/\b(\d{6})\b/)[1];
}

const wrongCodeFor = code => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

function deviceCookieFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find(c => c.startsWith('staff_device='));
  return raw ?? null;
}

/** Full real check-in for a user; returns the raw device token. */
async function checkIn(user) {
  expect((await post(REQUEST, user)).status).toBe(202);
  const res = await post(VERIFY, user, { code: latestCode(user.email) });
  expect(res.status).toBe(200);
  const cookie = deviceCookieFrom(res);
  expect(cookie).not.toBeNull();
  return cookie.split(';')[0].slice('staff_device='.length);
}

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => {
  captureFile = path.join(os.tmpdir(), `staff-checkin-mfa-${crypto.randomBytes(8).toString('hex')}.jsonl`);
  process.env.EMAIL_CAPTURE_FILE = captureFile;
});

afterEach(() => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
});

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
    expect(before.body.code).toBe('STAFF_CHECKIN_REQUIRED');

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
    expect(status.body).toEqual({ trusted: true, role: 'moderator' });
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
    expect(res.status).toBe(409);
    expect(capturedFor(mod.email)).toHaveLength(0);
    expect(await prisma.staffCheckinCode.count({ where: { userId: mod.id } })).toBe(0);
  });

  it("refuses one moderator's device cookie on another moderator's session", async () => {
    const owner = await makeUser('moderator');
    const other = await makeUser('moderator');
    const device = await checkIn(owner);

    const res = await get(STATUS, other, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CHECKIN_REQUIRED');
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
    expect(res.body.code).toBe('STAFF_CHECKIN_REQUIRED');
  });

  it('refuses staff tools once the staff email is no longer verified', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);
    await prisma.user.update({ where: { id: mod.id }, data: { emailVerified: false } });

    const res = await get(STATUS, mod, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_EMAIL_UNVERIFIED');
  });

  it('refuses an expired or revoked device', async () => {
    const mod = await makeUser('moderator');
    const device = await checkIn(mod);

    await prisma.staffTrustedDevice.updateMany({
      where: { userId: mod.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await get(STATUS, mod, device)).body.code).toBe('STAFF_CHECKIN_REQUIRED');

    await prisma.staffTrustedDevice.updateMany({
      where: { userId: mod.id },
      data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() },
    });
    expect((await get(STATUS, mod, device)).body.code).toBe('STAFF_CHECKIN_REQUIRED');
  });
});
