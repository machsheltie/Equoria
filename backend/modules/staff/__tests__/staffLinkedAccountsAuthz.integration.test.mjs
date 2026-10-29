/**
 * Linked accounts and busy addresses: real HTTP, real DB (Equoria-x5n89,
 * owner rulings q123-q126, 2026-10-27).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - the Owner and Admins see which accounts share a device with a player;
 *    a Moderator is refused with staffCapabilityRequired, and a plain player
 *    gets the ordinary staff-surface 404 (the surface is not disclosed);
 *  - every account counts, staff included (q126), and only the 90-day window;
 *  - an internet address seen with more than four accounts is flagged; four is
 *    not; an old sighting does not count. A flag never blocks anyone (q123);
 *  - the same two views refuse a Moderator and a player.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import crypto from 'node:crypto';
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
const linked = id => `${API}/conduct/${id}/linked-accounts`;
const flagged = `${API}/flagged-addresses`;
const dayMs = 24 * 60 * 60 * 1000;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('linked');
let mod;
let admin;
let owner;
let player;

const octet = () => crypto.randomInt(1, 254);
const freshIp = () => `203.0.${octet()}.${octet()}`;
const freshDevice = () => sha256(crypto.randomBytes(16).toString('hex'));
const sight = (user, { deviceHash = freshDevice(), ipAddress = freshIp(), lastSeenAt = new Date() } = {}) =>
  prisma.loginSighting.create({ data: { userId: user.id, deviceHash, ipAddress, lastSeenAt } });

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  // login_sightings go with their users (ON DELETE CASCADE).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  startEmailCapture();
  const staff = async role => {
    const user = await makeUser(role);
    return { user, device: await checkIn(user) };
  };
  mod = await staff('moderator');
  admin = await staff('admin');
  owner = await staff('owner');
  stopEmailCapture();
  player = await makeUser('user');
}, 120_000);

afterAll(() => cleanup.run(), 60_000);

describe('accounts sharing a device with a player', () => {
  it('lists them for an Admin and for the Owner, staff accounts included', async () => {
    const target = await makeUser('user');
    const sibling = await makeUser('user');
    const moderatorAlt = await makeUser('moderator');
    const stranger = await makeUser('user');
    const device = freshDevice();
    await sight(target, { deviceHash: device });
    await sight(sibling, { deviceHash: device });
    await sight(moderatorAlt, { deviceHash: device });
    await sight(stranger); // a different device
    for (const viewer of [admin, owner]) {
      const res = await get(linked(target.id), viewer.user, viewer.device);
      expect(res.status).toBe(200);
      const names = res.body.accounts.map(a => a.username).sort();
      expect(names).toEqual([sibling.username, moderatorAlt.username].sort());
      expect(res.body.accounts.find(a => a.username === moderatorAlt.username).role).toBe('moderator');
      expect(res.body.player.username).toBe(target.username);
    }
  });

  it('ignores sightings older than 90 days and reports a player with none as empty', async () => {
    const target = await makeUser('user');
    const old = await makeUser('user');
    const device = freshDevice();
    await sight(target, { deviceHash: device });
    await sight(old, { deviceHash: device, lastSeenAt: new Date(Date.now() - 91 * dayMs) });
    const res = await get(linked(target.id), admin.user, admin.device);
    expect(res.body.accounts).toEqual([]);
    const none = await get(linked((await makeUser('user')).id), admin.user, admin.device);
    expect(none.body.accounts).toEqual([]);
  });

  it('never shows the device hash itself', async () => {
    const target = await makeUser('user');
    const other = await makeUser('user');
    const device = freshDevice();
    await sight(target, { deviceHash: device });
    await sight(other, { deviceHash: device });
    const res = await get(linked(target.id), owner.user, owner.device);
    expect(JSON.stringify(res.body)).not.toContain(device);
  });

  it('answers 404 for an unknown player', async () => {
    expect((await get(linked('no-such-user'), admin.user, admin.device)).status).toBe(404);
  });

  it('refuses a Moderator with the capability code and a player with the ordinary 404', async () => {
    const res = await get(linked(player.id), mod.user, mod.device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(capabilityRequiredCode);
    expect((await get(linked(player.id), player)).status).toBe(404);
  });
});

describe('busy internet addresses', () => {
  async function accountsOnAddress(ip, count, opts = {}) {
    const made = [];
    for (let i = 0; i < count; i += 1) {
      const user = await makeUser('user');
      await sight(user, { ipAddress: ip, ...opts });
      made.push(user);
    }
    return made;
  }

  it('flags an address with five accounts, naming them, and not one with four', async () => {
    const busyIp = freshIp();
    const quietIp = freshIp();
    const five = await accountsOnAddress(busyIp, 5);
    await accountsOnAddress(quietIp, 4);
    for (const viewer of [admin, owner]) {
      const res = await get(flagged, viewer.user, viewer.device);
      expect(res.status).toBe(200);
      const row = res.body.addresses.find(a => a.ipAddress === busyIp);
      expect(row.accountCount).toBe(5);
      expect(row.accounts.map(a => a.username).sort()).toEqual(five.map(u => u.username).sort());
      expect(res.body.addresses.some(a => a.ipAddress === quietIp)).toBe(false);
    }
  });

  it('counts one account once however many devices it used, and skips old sightings', async () => {
    const ip = freshIp();
    const four = await accountsOnAddress(ip, 4);
    await sight(four[0], { ipAddress: ip }); // same account, another device
    const oldUser = await makeUser('user');
    await sight(oldUser, { ipAddress: ip, lastSeenAt: new Date(Date.now() - 91 * dayMs) });
    const res = await get(flagged, admin.user, admin.device);
    expect(res.body.addresses.some(a => a.ipAddress === ip)).toBe(false);
    await sight(await makeUser('user'), { ipAddress: ip });
    const after = await get(flagged, admin.user, admin.device);
    expect(after.body.addresses.find(a => a.ipAddress === ip).accountCount).toBe(5);
  });

  it('refuses a Moderator and a player', async () => {
    const res = await get(flagged, mod.user, mod.device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(capabilityRequiredCode);
    expect((await get(flagged, player)).status).toBe(404);
  });
});
