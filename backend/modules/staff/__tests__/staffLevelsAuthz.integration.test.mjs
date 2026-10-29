/**
 * Three staff levels — real HTTP, real DB (Equoria-4tleh).
 * Security gate: file-name token `Authz`.
 *
 * Owner ruling 2026-10-23: Owner (Head Admin), Admin, Moderator. Only Owner
 * and Admin may post News (the News route, Equoria-wbt8l, is not built yet;
 * the permission is exposed through GET /staff/me's capability list); only
 * the Owner sees hidden traits; moderators never.
 *
 * Every request passes real authenticateToken, CSRF, the staff check-in
 * (helpers/staffFixtures.mjs) and the real role and capability guards.
 * Nothing is mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  ORIGIN,
  checkIn,
  createTargetFactory,
  createUserFactory,
  get,
  post,
  removeTicketEmails,
  settledTicketEmails,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';

const staffApi = '/api/v1/staff';
const mePath = `${staffApi}/me`;
const rolesPath = `${staffApi}/roles`;
const ticketsPath = `${staffApi}/tickets`;
const cronStatus = '/api/v1/admin/cron/status';
const traitAnalytics = '/api/v1/admin/traits/analytics';
const horsesPath = '/api/v1/horses';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stafflevels');
const { makeHorse, makePost, removeTargets } = createTargetFactory('StaffLevels');

// Equoria-n256i (owner ruling q289): every caller holds a checked-in browser, so the
// admin gates below answer on role alone (admin tools need the staff check-in).
const bearer = async (req, user) =>
  req
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${user.token}`)
    .set('Cookie', await checkedInDeviceCookie(user.id));

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => removeTicketEmails({ filedById: scope() }), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  // Horses cascade-delete their TraitHistoryLog rows.
  cleanup.add(() => removeTargets(), 'horses and posts');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('GET /staff/me names each level and its permissions', () => {
  it('owner: role owner, may post News and see hidden traits', async () => {
    const owner = await makeUser('owner');
    const res = await get(mePath, owner);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('owner');
    expect(res.body.capabilities).toEqual(expect.arrayContaining(['news.post', 'traits.hidden.view']));
  });

  it('admin: may post News, may not see hidden traits', async () => {
    const admin = await makeUser('admin');
    const res = await get(mePath, admin);
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toContain('news.post');
    expect(res.body.capabilities).not.toContain('traits.hidden.view');
  });

  it('moderator: neither News nor hidden traits', async () => {
    const mod = await makeUser('moderator');
    const res = await get(mePath, mod);
    expect(res.status).toBe(200);
    expect(res.body.capabilities).not.toContain('news.post');
    expect(res.body.capabilities).not.toContain('traits.hidden.view');
  });

  it('a player gets the ordinary unknown-route 404', async () => {
    const player = await makeUser('user');
    const res = await get(mePath, player);
    expect(res.status).toBe(404);
  });
});

describe('the owner passes every admin gate', () => {
  it('admin router (requireRole admin): owner and admin 200, moderator and player 403', async () => {
    const owner = await makeUser('owner');
    const admin = await makeUser('admin');
    const mod = await makeUser('moderator');
    const player = await makeUser('user');

    expect((await bearer(request(app).get(cronStatus), owner)).status).toBe(200);
    expect((await bearer(request(app).get(cronStatus), admin)).status).toBe(200);
    expect((await bearer(request(app).get(cronStatus), mod)).status).toBe(403);
    expect((await bearer(request(app).get(cronStatus), player)).status).toBe(403);
  });

  it("an inline admin check: the owner may list another player's horses", async () => {
    const owner = await makeUser('owner');
    const player = await makeUser('user');
    const other = await makeUser('user');
    const horse = await makeHorse(other);

    const asOwner = await bearer(request(app).get(horsesPath).query({ userId: other.id }), owner);
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.data.map(h => h.id)).toContain(horse.id);

    // A player's userId override is ignored: they only ever see their own.
    const asPlayer = await bearer(request(app).get(horsesPath).query({ userId: other.id }), player);
    expect(asPlayer.status).toBe(200);
    expect(asPlayer.body.data.map(h => h.id)).not.toContain(horse.id);
  });

  it('staff roles: the owner manages moderators and is listed as owner', async () => {
    const owner = await makeUser('owner');
    const ownerDevice = await checkIn(owner);
    const player = await makeUser('user');

    const promoted = await post(
      `${rolesPath}/${player.id}`,
      owner,
      { role: 'moderator', reason: 'helps new riders' },
      ownerDevice,
    );
    expect(promoted.status).toBe(200);
    expect(promoted.body.role).toBe('moderator');

    const list = await get(rolesPath, owner, ownerDevice);
    expect(list.status).toBe(200);
    expect(list.body.staff).toEqual(expect.arrayContaining([expect.objectContaining({ id: owner.id, role: 'owner' })]));
  });

  it("an admin cannot change the owner's role", async () => {
    const owner = await makeUser('owner');
    const admin = await makeUser('admin');
    const adminDevice = await checkIn(admin);

    const res = await post(`${rolesPath}/${owner.id}`, admin, { role: 'user', reason: 'coup' }, adminDevice);
    expect(res.status).toBe(403);
    const row = await prisma.user.findUnique({ where: { id: owner.id }, select: { role: true } });
    expect(row.role).toBe('owner');
  });

  it("a moderator's ticket alerts the owner as well as the admin", async () => {
    const owner = await makeUser('owner');
    const admin = await makeUser('admin');
    const mod = await makeUser('moderator');
    const modDevice = await checkIn(mod);
    const subject = await makePost(await makeUser('user'));

    const res = await post(
      ticketsPath,
      mod,
      { targetType: 'post', targetId: String(subject.id), category: 'Needs the head admin', note: `n ${uid()}` },
      modDevice,
    );
    expect(res.status).toBe(201);
    await settledTicketEmails(res.body.ticket.id);

    for (const user of [owner, admin]) {
      const bells = await prisma.notification.findMany({ where: { userId: user.id, type: 'staffTicket' } });
      expect(bells).toHaveLength(1);
      expect(bells[0].payload).toMatchObject({ ticketId: res.body.ticket.id });
    }
  });
});

describe('hidden traits: the owner only (trait analytics)', () => {
  const source = `TestFixture-4tleh-${uid()}${uid()}`;

  beforeAll(async () => {
    const breeder = await makeUser('user');
    const horse = await makeHorse(breeder);
    await prisma.horse.update({
      where: { id: horse.id },
      data: { epigeneticModifiers: { positive: ['bold'], negative: [], hidden: ['nervous'] } },
    });
    for (const traitName of ['bold', 'nervous']) {
      await prisma.traitHistoryLog.create({
        data: { horseId: horse.id, traitName, sourceType: source, isEpigenetic: true, ageInDays: 5 },
      });
    }
  });

  const analytics = user => bearer(request(app).get(traitAnalytics).query({ sourceType: source }), user);

  it('the owner sees the hidden trait counted', async () => {
    const res = await analytics(await makeUser('owner'));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.byTraitName).toEqual({ bold: 1, nervous: 1 });
  });

  it('an admin sees only the revealed trait', async () => {
    const res = await analytics(await makeUser('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.byTraitName).toEqual({ bold: 1 });
    expect(JSON.stringify(res.body)).not.toContain('nervous');
  });

  it('a moderator and a player are refused', async () => {
    expect((await analytics(await makeUser('moderator'))).status).toBe(403);
    expect((await analytics(await makeUser('user'))).status).toBe(403);
  });
});
