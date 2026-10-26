/**
 * Player conduct: warn, freeze, ban, IP and device bans: real HTTP, real DB
 * (Equoria-w47x7 / Equoria-puj1e.2, owner ruling q77).
 * Security gate: file-name token `Authz`.
 *
 * Rules pinned here:
 *  - moderators, admins and the owner may warn, freeze and ban (account, IP, device);
 *  - nobody acts on the owner or on themselves; a moderator or admin never acts on
 *    another moderator or admin (only the owner can);
 *  - a frozen or banned account cannot sign in, refresh or make any request;
 *  - a banned IP or device cannot sign in or sign up;
 *  - every action writes the staff log, and a refusal changes nothing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestUser } from '../../../tests/helpers/authHelper.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  preparePost,
  raceUnderLock,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const API = '/api/v1/staff';
const conduct = id => `${API}/conduct/${id}`;
const PASSWORD = 'Passw0rd!Test12';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('conduct');
const issuedBy = () => ({ issuedById: { in: createdUserIds } });

let passwordHash;
let mod;
let admin;
let owner;
let modB;
let adminB;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.conductBlock.deleteMany({ where: issuedBy() }), 'conduct blocks');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  // conduct_records and login_sightings go with their users (ON DELETE CASCADE).
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  passwordHash = await bcrypt.hash(PASSWORD, 4);
  startEmailCapture();
  const staff = async role => {
    const user = await makeUser(role);
    return { user, device: await checkIn(user) };
  };
  mod = await staff('moderator');
  modB = await staff('moderator');
  admin = await staff('admin');
  adminB = await staff('admin');
  owner = await staff('owner');
  stopEmailCapture();
}, 120_000);

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

const makePlayer = (extra = {}) => makeUser('user', { password: passwordHash, ...extra });
const octet = () => crypto.randomInt(1, 254);
const freshIp = () => `203.0.${octet()}.${octet()}`;

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

const act = (actor, target, action, body = {}) =>
  post(`${conduct(target.id)}/${action}`, actor.user, { reason: 'conduct rule check', ...body }, actor.device);

const ACTIONS = [
  ['warn', 'warn', {}],
  ['freeze', 'freeze', { days: 3 }],
  ['ban/account', 'ban.account', {}],
  ['ban/ip', 'ban.ip', {}],
  ['ban/device', 'ban.device', {}],
];

const recordsFor = id => prisma.conductRecord.findMany({ where: { userId: id }, orderBy: { id: 'asc' } });
const logFor = (id, capability) =>
  prisma.staffActionLog.findMany({
    where: { targetId: id, ...(capability ? { capability } : {}) },
    orderBy: { id: 'asc' },
  });

describe('Who may reach the conduct routes', () => {
  it('answers a player with the ordinary 404 on every route', async () => {
    const player = await makePlayer();
    const other = await makePlayer();
    for (const [action] of ACTIONS) {
      const res = await post(`${conduct(other.id)}/${action}`, player, { reason: 'x', days: 1 });
      expect({ action, status: res.status }).toEqual({ action, status: 404 });
    }
    expect((await get(conduct(other.id), player)).status).toBe(404);
    expect(await recordsFor(other.id)).toEqual([]);
  });

  it('lists the conduct capabilities for a moderator, an admin and the owner', async () => {
    for (const actor of [mod, admin, owner]) {
      const res = await get(`${API}/me`, actor.user, actor.device);
      expect(res.body.capabilities).toEqual(
        expect.arrayContaining(['warn', 'freeze', 'ban.account', 'ban.ip', 'ban.device']),
      );
    }
  });
});

describe('Nobody acts on the owner, on themselves, or (below the owner) on staff', () => {
  const cases = [
    // [actor, target, expected code]
    ['moderator', () => mod, () => owner, 'staffTargetOwner'],
    ['admin', () => admin, () => owner, 'staffTargetOwner'],
    ['owner', () => owner, () => owner, 'staffTargetOwner'],
    ['moderator', () => mod, () => modB, 'staffTargetStaff'],
    ['moderator', () => mod, () => admin, 'staffTargetStaff'],
    ['admin', () => admin, () => mod, 'staffTargetStaff'],
    ['admin', () => admin, () => adminB, 'staffTargetStaff'],
    ['moderator', () => mod, () => mod, 'staffTargetSelf'],
    ['admin', () => admin, () => admin, 'staffTargetSelf'],
  ];
  it.each(cases)(
    'refuses a %s acting on the target with the exact code (%#)',
    async (_role, actorOf, targetOf, code) => {
      const actor = actorOf();
      const target = targetOf();
      const recordsBefore = (await recordsFor(target.user.id)).length;
      for (const [action, , extra] of ACTIONS) {
        const res = await act(actor, target.user, action, extra);
        expect({ action, status: res.status, code: res.body.code }).toEqual({ action, status: 403, code });
        expect(res.body.message).not.toContain(code);
      }
      expect((await recordsFor(target.user.id)).length).toBe(recordsBefore);
      expect(await logFor(target.user.id, 'warn')).toEqual([]);
      expect(await prisma.user.findUnique({ where: { id: target.user.id }, select: { role: true } })).toEqual({
        role: target.user.role,
      });
    },
  );

  it('lets the owner warn an admin and a moderator', async () => {
    for (const target of [admin, modB]) {
      const res = await act(owner, target.user, 'warn');
      expect(res.status).toBe(200);
    }
  });
});

describe('Warn', () => {
  it('records the warning, tells the player, and writes one log entry', async () => {
    const player = await makePlayer();
    const res = await act(mod, player, 'warn', { reason: '  rude in the forum  ' });
    expect(res.status).toBe(200);
    const [record] = await recordsFor(player.id);
    expect(record).toMatchObject({
      kind: 'warning',
      reason: 'rude in the forum',
      issuedById: mod.user.id,
      issuedByRole: 'moderator',
    });
    const bells = await prisma.notification.findMany({ where: { userId: player.id, type: 'conductWarning' } });
    expect(bells).toHaveLength(1);
    expect(bells[0].payload).toEqual({ reason: 'rude in the forum' });
    const rows = await logFor(player.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: mod.user.id,
      actorRole: 'moderator',
      capability: 'warn',
      targetType: 'player',
      outcome: 'succeeded',
    });
    // A warning does not stop the player signing in.
    expect((await login(player)).res.status).toBe(200);
  });

  it('refuses a missing reason with conductReasonRequired and an unknown player with conductTargetNotFound', async () => {
    const player = await makePlayer();
    for (const body of [{ reason: '' }, { reason: '   ' }, { reason: 42 }, {}]) {
      const res = await post(`${conduct(player.id)}/warn`, mod.user, body, mod.device);
      expect({ body, status: res.status, code: res.body.code }).toEqual({
        body,
        status: 400,
        code: 'conductReasonRequired',
      });
    }
    const missing = await post(`${conduct('no-such-user')}/warn`, mod.user, { reason: 'x' }, mod.device);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('conductTargetNotFound');
    expect(await recordsFor(player.id)).toEqual([]);
  });
});

describe('Freeze', () => {
  it.each([1, 3, 7])('freezes for %i day(s), ends on time, and ends the sessions', async days => {
    const player = await makePlayer();
    const { res: signedIn } = await login(player);
    expect(signedIn.status).toBe(200);
    expect(await prisma.refreshToken.count({ where: { userId: player.id } })).toBeGreaterThan(0);

    const before = Date.now();
    const res = await act(admin, player, 'freeze', { days });
    expect(res.status).toBe(200);
    const [record] = await recordsFor(player.id);
    expect(record).toMatchObject({ kind: 'freeze', freezeDays: days });
    expect(record.endsAt.getTime() - before).toBeGreaterThanOrEqual(days * 86_400_000 - 1000);
    expect(record.endsAt.getTime() - before).toBeLessThan(days * 86_400_000 + 60_000);
    expect(await prisma.refreshToken.count({ where: { userId: player.id } })).toBe(0);
    const rows = await logFor(player.id, 'freeze');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorRole: 'admin', after: expect.objectContaining({ kind: 'freeze', days }) });
  });

  it('refuses any other length with conductFreezeLength', async () => {
    const player = await makePlayer();
    for (const days of [0, 2, 30, '3', null, undefined]) {
      const res = await act(mod, player, 'freeze', { days });
      expect({ days, status: res.status, code: res.body.code }).toEqual({
        days,
        status: 400,
        code: 'conductFreezeLength',
      });
    }
    expect(await recordsFor(player.id)).toEqual([]);
  });

  it('refuses a second freeze, and a freeze on a banned account, with exact codes', async () => {
    const player = await makePlayer();
    expect((await act(mod, player, 'freeze', { days: 1 })).status).toBe(200);
    const again = await act(modB, player, 'freeze', { days: 7 });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('conductAlreadyFrozen');
    expect(await recordsFor(player.id)).toHaveLength(1);

    expect((await act(mod, player, 'ban/account')).status).toBe(200);
    const onBanned = await act(mod, player, 'freeze', { days: 1 });
    expect(onBanned.status).toBe(409);
    expect(onBanned.body.code).toBe('conductAlreadyBanned');
  });

  it('lets exactly one of two stewards freeze at once, with one record and one log entry', async () => {
    const player = await makePlayer();
    const starters = [
      await preparePost(`${conduct(player.id)}/freeze`, mod.user, { days: 3, reason: 'race a' }, mod.device),
      await preparePost(`${conduct(player.id)}/freeze`, modB.user, { days: 7, reason: 'race b' }, modB.device),
    ];
    const results = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${player.id} FOR UPDATE`,
      starters,
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409).body.code).toBe('conductAlreadyFrozen');
    expect(await recordsFor(player.id)).toHaveLength(1);
    expect(await logFor(player.id, 'freeze')).toHaveLength(1);
  }, 60_000);
});

describe('Ban account', () => {
  it('bans, ends the sessions, logs, and refuses a second ban', async () => {
    const player = await makePlayer();
    expect((await login(player)).res.status).toBe(200);
    const res = await act(mod, player, 'ban/account', { reason: 'selling coins' });
    expect(res.status).toBe(200);
    expect(await recordsFor(player.id)).toEqual([expect.objectContaining({ kind: 'ban', reason: 'selling coins' })]);
    expect(await prisma.refreshToken.count({ where: { userId: player.id } })).toBe(0);
    expect(await logFor(player.id, 'ban.account')).toHaveLength(1);

    const again = await act(admin, player, 'ban/account');
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('conductAlreadyBanned');
    expect(await recordsFor(player.id)).toHaveLength(1);
  });

  it('lets exactly one of two stewards ban at once', async () => {
    const player = await makePlayer();
    const starters = [
      await preparePost(`${conduct(player.id)}/ban/account`, mod.user, { reason: 'race a' }, mod.device),
      await preparePost(`${conduct(player.id)}/ban/account`, admin.user, { reason: 'race b' }, admin.device),
    ];
    const results = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${player.id} FOR UPDATE`,
      starters,
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await recordsFor(player.id)).toHaveLength(1);
    expect(await logFor(player.id, 'ban.account')).toHaveLength(1);
  }, 60_000);
});

describe('A frozen or banned account cannot sign in or act', () => {
  it('refuses a frozen sign-in with the end date, then lets the player back in when it ends', async () => {
    const player = await makePlayer();
    expect((await act(mod, player, 'freeze', { days: 3 })).status).toBe(200);
    const { res } = await login(player);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('accountFrozen');
    const [record] = await recordsFor(player.id);
    expect(res.body.until).toBe(record.endsAt.toISOString());
    expect(res.body.message).toMatch(/^Your account is frozen until .+ \d{4} at .+ Eastern\.$/);
    expect(res.body.message).not.toContain('accountFrozen');
    expect(res.headers['set-cookie'] || []).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^accessToken=/)]),
    );

    await prisma.conductRecord.update({ where: { id: record.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    expect((await login(player)).res.status).toBe(200);
  });

  it('refuses a banned sign-in with accountBanned', async () => {
    const player = await makePlayer();
    expect((await act(mod, player, 'ban/account')).status).toBe(200);
    const { res } = await login(player);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('accountBanned');
    expect(res.body.message).toBe('This account has been banned.');
  });

  it('answers a wrong password with the ordinary 401, never revealing the account is banned', async () => {
    const player = await makePlayer();
    expect((await act(mod, player, 'ban/account')).status).toBe(200);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: player.email, password: 'Wrong-Passw0rd!' });
    expect(res.status).toBe(401);
  });

  it('stops a session already open, on the very next request, and refuses a refresh', async () => {
    const player = await makePlayer();
    const { res: signedIn } = await login(player);
    expect(signedIn.status).toBe(200);
    const cookies = signedIn.headers['set-cookie'].map(c => c.split(';')[0]);
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    const profile = () =>
      request(app).get('/api/v1/auth/profile').set('Origin', 'http://localhost:3000').set('Cookie', cookies);
    expect((await profile()).status).toBe(200);

    expect((await act(mod, player, 'freeze', { days: 1 })).status).toBe(200);
    const blocked = await profile();
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('accountFrozen');

    const refresh = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [refreshCookie])
      .send({});
    expect(refresh.status).toBeGreaterThanOrEqual(401);
    expect(refresh.status).toBeLessThan(500);
  });
});

describe('IP and device bans', () => {
  it('bans the IP a player signed in from: other accounts and new signups from it are refused', async () => {
    const target = await makePlayer();
    const bystander = await makePlayer();
    const { ip } = await login(target);
    const res = await act(mod, target, 'ban/ip', { reason: 'ban evasion' });
    expect(res.status).toBe(200);
    expect(await prisma.conductBlock.findMany({ where: { kind: 'ip', value: ip } })).toEqual([
      expect.objectContaining({ issuedById: mod.user.id, sourceUserId: target.id, reason: 'ban evasion' }),
    ]);
    const rows = await logFor(target.id, 'ban.ip');
    expect(rows).toHaveLength(1);
    expect(rows[0].targetType).toBe('playerIp');

    const blocked = await login(bystander, { ip });
    expect(blocked.res.status).toBe(403);
    expect(blocked.res.body.code).toBe('accessBlocked');
    expect(blocked.res.body.message).toBe('This connection can no longer be used to sign in or create an account.');

    const signup = createTestUser();
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-Forwarded-For', ip)
      .send(signup);
    expect(registered.status).toBe(403);
    expect(registered.body.code).toBe('accessBlocked');
    expect(await prisma.user.findUnique({ where: { email: signup.email } })).toBeNull();

    expect((await login(bystander, { ip: freshIp() })).res.status).toBe(200);
  });

  it('bans the device a player signed in from, whatever the IP', async () => {
    const target = await makePlayer();
    const bystander = await makePlayer();
    const { device } = await login(target);
    expect(device).toMatch(/^[0-9a-f]{64}$/);
    expect((await act(modB, target, 'ban/device')).status).toBe(200);
    const stored = await prisma.conductBlock.findMany({ where: { kind: 'device', sourceUserId: target.id } });
    expect(stored).toHaveLength(1);
    // Only a hash of the cookie is kept.
    expect(stored[0].value).toBe(crypto.createHash('sha256').update(device).digest('hex'));
    expect(await logFor(target.id, 'ban.device')).toHaveLength(1);

    const blocked = await login(bystander, { device });
    expect(blocked.res.status).toBe(403);
    expect(blocked.res.body.code).toBe('accessBlocked');
    expect((await login(bystander)).res.status).toBe(200);
  });

  it('refuses a ban when the player has never been seen signing in (conductNoSighting)', async () => {
    const target = await makePlayer();
    for (const action of ['ban/ip', 'ban/device']) {
      const res = await act(mod, target, action);
      expect({ action, status: res.status, code: res.body.code }).toEqual({
        action,
        status: 409,
        code: 'conductNoSighting',
      });
    }
    expect(await logFor(target.id)).toEqual([]);
  });

  it('refuses to ban a connection a steward signs in from (conductBlockHitsStaff)', async () => {
    const target = await makePlayer();
    const { ip, device } = await login(target);
    const staffer = await makeUser('moderator');
    const hash = crypto.createHash('sha256').update(device).digest('hex');
    await prisma.loginSighting.createMany({
      data: [
        { userId: staffer.id, ipAddress: ip, deviceHash: crypto.randomBytes(16).toString('hex') },
        { userId: staffer.id, ipAddress: freshIp(), deviceHash: hash },
      ],
    });
    for (const action of ['ban/ip', 'ban/device']) {
      const res = await act(mod, target, action);
      expect({ action, status: res.status, code: res.body.code }).toEqual({
        action,
        status: 409,
        code: 'conductBlockHitsStaff',
      });
    }
    expect(await prisma.conductBlock.count({ where: { sourceUserId: target.id } })).toBe(0);
  });

  it('refuses a second ban of the same IP (conductAlreadyBlocked), and lets exactly one of two racing succeed', async () => {
    const first = await makePlayer();
    const { ip } = await login(first);
    expect((await act(mod, first, 'ban/ip')).status).toBe(200);
    const sameIp = await makePlayer();
    await login(sameIp, { ip });
    // sameIp's login is refused now; give it the sighting directly.
    await prisma.loginSighting.create({
      data: { userId: sameIp.id, ipAddress: ip, deviceHash: crypto.randomBytes(16).toString('hex') },
    });
    const dup = await act(modB, sameIp, 'ban/ip');
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('conductAlreadyBlocked');

    // Two stewards, two accounts on one new IP: the unique ban lets one through.
    const raceIp = freshIp();
    const a = await makePlayer();
    const b = await makePlayer();
    for (const p of [a, b]) {
      await prisma.loginSighting.create({
        data: { userId: p.id, ipAddress: raceIp, deviceHash: crypto.randomBytes(16).toString('hex') },
      });
    }
    const starters = [
      await preparePost(`${conduct(a.id)}/ban/ip`, mod.user, { reason: 'race a' }, mod.device),
      await preparePost(`${conduct(b.id)}/ban/ip`, modB.user, { reason: 'race b' }, modB.device),
    ];
    const results = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${a.id}, ${b.id}) ORDER BY id FOR UPDATE`,
      starters,
    );
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409).body.code).toBe('conductAlreadyBlocked');
    expect(await prisma.conductBlock.count({ where: { kind: 'ip', value: raceIp } })).toBe(1);
  }, 60_000);

  it('records where a player signs in from, once per address and device', async () => {
    const player = await makePlayer();
    const ip = freshIp();
    const first = await login(player, { ip });
    await login(player, { ip, device: first.device });
    const sightings = await prisma.loginSighting.findMany({ where: { userId: player.id } });
    expect(sightings).toHaveLength(1);
    expect(sightings[0].ipAddress).toBe(ip);
    expect(sightings[0].lastSeenAt.getTime()).toBeGreaterThanOrEqual(sightings[0].firstSeenAt.getTime());
  });
});

describe('The conduct record', () => {
  it('shows standing and entries to a moderator, and never an IP or device', async () => {
    const player = await makePlayer();
    await login(player);
    expect((await act(mod, player, 'warn')).status).toBe(200);
    expect((await act(mod, player, 'freeze', { days: 1 })).status).toBe(200);
    const res = await get(conduct(player.id), mod.user, mod.device);
    expect(res.status).toBe(200);
    expect(res.body.player).toEqual({ id: player.id, username: player.username, role: 'user' });
    expect(res.body.standing.state).toBe('frozen');
    expect(res.body.records.map(r => r.kind)).toEqual(['freeze', 'warning']);
    expect(JSON.stringify(res.body)).not.toMatch(/ipAddress|deviceHash|203\.0\./);

    const clean = await makePlayer();
    expect((await get(conduct(clean.id), mod.user, mod.device)).body.standing).toEqual({ state: 'good' });
    expect((await get(conduct('no-such-user'), mod.user, mod.device)).body.code).toBe('conductTargetNotFound');
  });

  it('finds a player by username for a moderator, and answers 404 for an unknown one', async () => {
    const player = await makePlayer();
    const found = await post(`${API}/conduct/lookup`, mod.user, { username: player.username }, mod.device);
    expect(found.status).toBe(200);
    expect(found.body).toEqual({ id: player.id, username: player.username, role: 'user' });
    const missing = await post(
      `${API}/conduct/lookup`,
      mod.user,
      { username: `nobody${crypto.randomBytes(6).toString('hex')}` },
      mod.device,
    );
    expect(missing.status).toBe(404);
    expect((await post(`${API}/conduct/lookup`, mod.user, { username: 42 }, mod.device)).status).toBe(400);
  });
});
