/**
 * A player's sign-in history and the accounts seen with them: real HTTP, real DB
 * (Equoria-puj1e.4, owner ruling q102: login IP and device records kept 90 days).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - a real sign-in records the address and device, and the Owner and Admins
 *    then see it in the player's history; the device hash itself is never shown,
 *    devices are numbered per player in the order first used;
 *  - only the 90-day window is shown;
 *  - accounts that signed in from one of the player's addresses are listed with
 *    the addresses they share; an account that signed in on the same device is
 *    listed by the same-device view;
 *  - a Moderator is refused with staffCapabilityRequired, and a plain player
 *    gets the ordinary staff-surface 404 (the surface is not disclosed);
 *  - an unknown player answers 404.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { capabilityRequiredCode } from '../middleware/requireStaffCapability.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  sha256,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const API = '/api/v1/staff';
const historyOf = id => `${API}/conduct/${id}/login-history`;
const linkedTo = id => `${API}/conduct/${id}/linked-accounts`;
const PASSWORD = 'Passw0rd!Test12';
const dayMs = 24 * 60 * 60 * 1000;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('loginhist');
let passwordHash;
let mod;
let admin;
let owner;

const octet = () => crypto.randomInt(1, 254);
const freshIp = () => `198.18.${octet()}.${octet()}`;
const freshDevice = () => sha256(crypto.randomBytes(16).toString('hex'));
const sight = (user, { deviceHash = freshDevice(), ipAddress = freshIp(), at = new Date() } = {}) =>
  prisma.loginSighting.create({
    data: { userId: user.id, deviceHash, ipAddress, firstSeenAt: at, lastSeenAt: at },
  });
const makePlayer = () => makeUser('user', { password: passwordHash });

/** A real sign-in. Returns the response and the device cookie the game issued. */
async function login(player, { ip = freshIp(), device } = {}) {
  const req = request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').set('X-Forwarded-For', ip);
  if (device) {
    req.set('Cookie', [`equoriaDevice=${device}`]);
  }
  const res = await req.send({ email: player.email, password: PASSWORD });
  const raw = (res.headers['set-cookie'] || []).find(c => c.startsWith('equoriaDevice='));
  const issued = raw ? raw.split(';')[0].slice('equoriaDevice='.length) : device;
  return { res, ip, device: issued };
}

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  // login_sightings go with their users (ON DELETE CASCADE).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  startEmailCapture();
  const staff = async role => {
    const user = await makeUser(role);
    return { user, device: await checkIn(user) };
  };
  mod = await staff('moderator');
  admin = await staff('admin');
  owner = await staff('owner');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);

describe('a player sign-in history', () => {
  it('shows a real sign-in to an Admin and to the Owner', async () => {
    const player = await makePlayer();
    const signIn = await login(player);
    expect(signIn.res.status).toBe(200);
    expect(signIn.device).toBeTruthy();

    const stored = await prisma.loginSighting.findMany({ where: { userId: player.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ ipAddress: signIn.ip, deviceHash: sha256(signIn.device) });

    for (const viewer of [admin, owner]) {
      const res = await get(historyOf(player.id), viewer.user, viewer.device);
      expect(res.status).toBe(200);
      expect(res.body.player).toEqual({ id: player.id, username: player.username, role: 'user' });
      expect(res.body.sightings).toHaveLength(1);
      expect(res.body.sightings[0]).toMatchObject({ ipAddress: signIn.ip, device: 1 });
      expect(JSON.stringify(res.body)).not.toContain(stored[0].deviceHash);
      expect(JSON.stringify(res.body)).not.toContain(signIn.device);
    }
  });

  it('numbers devices in the order first used, lists latest first, and keeps to 90 days', async () => {
    const player = await makePlayer();
    const laptop = freshDevice();
    const phone = freshDevice();
    const home = freshIp();
    const away = freshIp();
    const now = Date.now();
    await sight(player, { deviceHash: laptop, ipAddress: home, at: new Date(now - 10 * dayMs) });
    await sight(player, { deviceHash: phone, ipAddress: away, at: new Date(now - 2 * dayMs) });
    await sight(player, { deviceHash: laptop, ipAddress: away, at: new Date(now - dayMs) });
    await sight(player, { ipAddress: freshIp(), at: new Date(now - 91 * dayMs) });

    const res = await get(historyOf(player.id), admin.user, admin.device);
    expect(res.status).toBe(200);
    expect(res.body.sightings.map(s => [s.ipAddress, s.device])).toEqual([
      [away, 1],
      [away, 2],
      [home, 1],
    ]);
    for (const hash of [laptop, phone]) {
      expect(JSON.stringify(res.body)).not.toContain(hash);
    }
  });

  it('answers 404 for an unknown player', async () => {
    expect((await get(historyOf('no-such-user'), admin.user, admin.device)).status).toBe(404);
  });
});

describe('likely the same player', () => {
  it('lists accounts seen on the same address, with the shared addresses, staff included', async () => {
    const player = await makePlayer();
    const sibling = await makePlayer();
    const moderatorAlt = await makeUser('moderator');
    const stranger = await makePlayer();
    const old = await makePlayer();
    const { ip } = await login(player);
    await login(sibling, { ip });
    await sight(moderatorAlt, { ipAddress: ip });
    await sight(stranger);
    await sight(old, { ipAddress: ip, at: new Date(Date.now() - 91 * dayMs) });

    const res = await get(historyOf(player.id), owner.user, owner.device);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.sameAddress.map(a => [a.username, a]));
    expect(Object.keys(byName).sort()).toEqual([sibling.username, moderatorAlt.username].sort());
    expect(byName[sibling.username]).toMatchObject({ id: sibling.id, role: 'user', sharedAddresses: [ip] });
    expect(byName[moderatorAlt.username].role).toBe('moderator');
  });

  it('lists an account that signed in on the same device', async () => {
    const player = await makePlayer();
    const alt = await makePlayer();
    const first = await login(player);
    const second = await login(alt, { device: first.device });
    expect(second.res.status).toBe(200);

    const res = await get(linkedTo(player.id), admin.user, admin.device);
    expect(res.status).toBe(200);
    expect(res.body.accounts.map(a => a.username)).toEqual([alt.username]);
    expect(res.body.accounts[0].sharedDevices).toBe(1);
  });

  it('lists nobody for a player who shares nothing', async () => {
    const player = await makePlayer();
    await login(player);
    const res = await get(historyOf(player.id), admin.user, admin.device);
    expect(res.body.sameAddress).toEqual([]);
  });
});

describe('who may read it', () => {
  it('refuses a Moderator with the capability code and a player with the ordinary 404', async () => {
    const target = await makePlayer();
    await sight(target);
    const refused = await get(historyOf(target.id), mod.user, mod.device);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe(capabilityRequiredCode);
    expect(JSON.stringify(refused.body)).not.toContain('sightings');

    const player = await makePlayer();
    expect((await get(historyOf(target.id), player)).status).toBe(404);
  });
});
