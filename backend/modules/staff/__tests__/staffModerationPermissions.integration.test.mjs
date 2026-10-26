/**
 * Moderation permission rules — real HTTP, real DB (Equoria-i1hgt).
 * Security gate: file-name token `Authz`.
 *
 * Owner ruling 2026-10-23 (q16/q17): only the owner appoints admins;
 * moderators and admins never act on another moderator or admin; nobody acts
 * on the owner; moderators may issue IP and device bans.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const staffApi = '/api/v1/staff';
const roles = `${staffApi}/roles`;
const tickets = `${staffApi}/tickets`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffperm');

const roleOf = async id => (await prisma.user.findUnique({ where: { id }, select: { role: true } })).role;
const ticketBody = target => ({
  targetType: 'user',
  targetId: target.id,
  category: 'Conduct',
  note: 'permission rule check',
});

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(
    () => prisma.staffTicketReply.deleteMany({ where: { ticket: { filedById: scope() } } }),
    'ticket replies',
  );
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);
beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

async function staffMember(role) {
  const user = await makeUser(role);
  return { user, device: await checkIn(user) };
}

const setRole = (actor, target, role) =>
  post(`${roles}/${target.id}`, actor.user, { role, reason: 'permission rule check' }, actor.device);

describe('Only the owner appoints admins (Equoria-i1hgt)', () => {
  // Owner ruling q76 (Equoria-i1hgt): only the owner manages ANY staff role, so an
  // admin is now stopped at the route guard, before the target is read. This
  // pinned adminAppointmentOwnerOnly while admins still managed moderators.
  it('refuses an admin appointing an admin with STAFF_CAPABILITY_REQUIRED', async () => {
    const admin = await staffMember('admin');
    const player = await makeUser('user');
    const res = await setRole(admin, player, 'admin');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    expect(await roleOf(player.id)).toBe('user');
  });

  it('lets the owner appoint a player to admin and records the change', async () => {
    const owner = await staffMember('owner');
    const player = await makeUser('user');
    const res = await setRole(owner, player, 'admin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: player.id, username: player.username, role: 'admin' });
    expect(await roleOf(player.id)).toBe('admin');
    const rows = await prisma.staffActionLog.findMany({ where: { targetId: player.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorRole: 'owner',
      capability: 'roles.manage',
      before: { role: 'user' },
      after: { role: 'admin' },
    });
  });

  it('lets the owner promote a moderator to admin', async () => {
    const owner = await staffMember('owner');
    const mod = await makeUser('moderator');
    const res = await setRole(owner, mod, 'admin');
    expect(res.status).toBe(200);
    expect(await roleOf(mod.id)).toBe('admin');
  });

  it('still refuses to change an admin or the owner, even for the owner', async () => {
    const owner = await staffMember('owner');
    const otherAdmin = await makeUser('admin');
    const res = await setRole(owner, otherAdmin, 'user');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('adminRoleNotChangeable');
    expect(await roleOf(otherAdmin.id)).toBe('admin');

    const self = await setRole(owner, owner.user, 'user');
    expect(self.status).toBe(403);
    expect(self.body.code).toBe('staffTargetOwner');
    expect(await roleOf(owner.user.id)).toBe('owner');
  });

  it('keeps a moderator out of the roles routes entirely', async () => {
    const mod = await staffMember('moderator');
    const player = await makeUser('user');
    const res = await setRole(mod, player, 'admin');
    expect(res.status).toBe(403);
  });
});

describe('Nobody acts on the owner; admins and moderators never on each other (Equoria-i1hgt)', () => {
  it('refuses an admin changing the owner role at the route guard (q76)', async () => {
    const admin = await staffMember('admin');
    const owner = await makeUser('owner');
    for (const role of ['user', 'moderator']) {
      const res = await setRole(admin, owner, role);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    }
    expect(await roleOf(owner.id)).toBe('owner');
  });

  it('refuses admin to admin at the route guard (q76; was staffTargetStaff)', async () => {
    const admin = await staffMember('admin');
    const other = await makeUser('admin');
    const res = await setRole(admin, other, 'user');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    expect(await roleOf(other.id)).toBe('admin');
  });

  it('refuses a moderator filing a conduct ticket about an admin, a moderator or the owner', async () => {
    const mod = await staffMember('moderator');
    for (const role of ['admin', 'moderator', 'owner']) {
      const target = await makeUser(role);
      const res = await post(tickets, mod.user, ticketBody(target), mod.device);
      expect({ role, status: res.status, message: res.body.message }).toEqual({
        role,
        status: 403,
        message: 'Tickets can only be about players',
      });
    }
  });

  it('still lets a moderator file a ticket about a player', async () => {
    const mod = await staffMember('moderator');
    const player = await makeUser('user');
    const res = await post(tickets, mod.user, ticketBody(player), mod.device);
    expect(res.status).toBe(201);
  });
});

describe('Moderators may issue IP and device bans (Equoria-i1hgt)', () => {
  it('reports ban.ip and ban.device among a checked-in moderator capabilities', async () => {
    const mod = await staffMember('moderator');
    const res = await get(`${staffApi}/me`, mod.user, mod.device);
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toEqual(expect.arrayContaining(['ban.ip', 'ban.device', 'ban.account']));
  });
});
