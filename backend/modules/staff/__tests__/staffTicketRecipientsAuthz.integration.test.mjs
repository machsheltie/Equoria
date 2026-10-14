/**
 * Who hears about a ticket — real HTTP, real DB (STAFF-CR-11).
 * Security gate: file-name token `Authz`.
 *
 * A filer who is no longer a moderator gets no staff bells: the recipient is
 * chosen from the filer's current role, read inside the reply or status
 * transaction after the ticket row is held, so a demotion that lands while
 * the change waits is seen. Demotion itself deletes the account's unread
 * staff-ticket bells in the role-change transaction; read bells and every
 * other kind of notification are left alone.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  STAFF_API,
  checkIn,
  createUserFactory,
  post,
  preparePost,
  raceUnderLock,
  startEmailCapture,
  stopEmailCapture,
  uid,
  removeTicketEmails,
} from './helpers/staffFixtures.mjs';

const TICKETS = `${STAFF_API}/tickets`;
const STAFF_BELLS = ['staff_ticket', 'staff_ticket_update'];

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stbellto');

let admin;
let adminDevice;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => removeTicketEmails({ filedById: scope() }), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  startEmailCapture();
  admin = await makeUser('admin');
  adminDevice = await checkIn(admin);
  stopEmailCapture();
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

async function filedTicket() {
  const mod = await makeUser('moderator');
  const ticket = await prisma.staffTicket.create({
    data: {
      filedById: mod.id,
      targetType: 'post',
      targetId: '1',
      category: 'Recipient fixture',
      note: `note ${uid()}`,
    },
  });
  return { mod, ticket };
}

const demotePath = mod => `${STAFF_API}/roles/${mod.id}`;
const demote = mod => post(demotePath(mod), admin, { role: 'user', reason: 'Stepping down' }, adminDevice);

const staffBells = userId => prisma.notification.findMany({ where: { userId, type: { in: STAFF_BELLS } } });

describe('A filer who is no longer a moderator', () => {
  it('gets no bell for a status change or an admin reply', async () => {
    const { mod, ticket } = await filedTicket();
    expect((await demote(mod)).status).toBe(200);

    const status = await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'resolved' }, adminDevice);
    const reply = await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: 'Closed.' }, adminDevice);

    expect(status.status).toBe(200);
    expect(reply.status).toBe(201);
    expect(await staffBells(mod.id)).toEqual([]);
    // The changes themselves still stand and are logged.
    expect(
      await prisma.staffActionLog.count({
        where: { actorId: admin.id, targetType: 'ticket', targetId: String(ticket.id) },
      }),
    ).toBe(2);
  });

  it('still gets bells while a moderator', async () => {
    const { mod, ticket } = await filedTicket();

    await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'in_progress' }, adminDevice);
    await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: 'Looking.' }, adminDevice);

    expect(await staffBells(mod.id)).toHaveLength(2);
  });

  it.each([
    ['a status change', ticket => [`${TICKETS}/${ticket.id}/status`, { status: 'resolved' }]],
    ['an admin reply', ticket => [`${TICKETS}/${ticket.id}/replies`, { body: 'Done.' }]],
  ])('gets no bell from %s that waited while the demotion committed', async (_label, request) => {
    const { mod, ticket } = await filedTicket();
    const [url, body] = request(ticket);
    const sendChange = await preparePost(url, admin, body, adminDevice);
    const sendDemotion = await preparePost(demotePath(mod), admin, { role: 'user', reason: 'Gone' }, adminDevice);

    // The change queues on the held ticket row; the demotion does not touch
    // that row, so it commits first. The change then reads the filer fresh.
    const [change, demotion] = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM staff_tickets WHERE id = ${ticket.id} FOR UPDATE`,
      [sendChange, sendDemotion],
    );

    expect(demotion.status).toBe(200);
    expect([200, 201]).toContain(change.status);
    expect((await prisma.user.findUnique({ where: { id: mod.id } })).role).toBe('user');
    expect(await staffBells(mod.id)).toEqual([]);
  });
});

describe('Demotion', () => {
  it("deletes the account's unread staff bells and keeps read ones and other notifications", async () => {
    const { mod, ticket } = await filedTicket();
    await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'in_progress' }, adminDevice);
    await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: 'Looking.' }, adminDevice);
    const unread = await staffBells(mod.id);
    expect(unread).toHaveLength(2);
    const read = await prisma.notification.create({
      data: { userId: mod.id, type: 'staff_ticket_update', payload: { ticketId: ticket.id }, isRead: true },
    });
    const unrelated = await prisma.notification.create({
      data: { userId: mod.id, type: 'foal_born', payload: { horseId: 1 } },
    });
    // Another account's unread staff bell is not touched.
    const adminBell = await prisma.notification.create({
      data: { userId: admin.id, type: 'staff_ticket', payload: { ticketId: ticket.id } },
    });

    expect((await demote(mod)).status).toBe(200);

    const left = await prisma.notification.findMany({ where: { userId: mod.id }, orderBy: { id: 'asc' } });
    expect(left.map(n => n.id).sort()).toEqual([read.id, unrelated.id].sort());
    expect(await prisma.notification.findUnique({ where: { id: adminBell.id } })).not.toBeNull();
  });

  it('leaves the bells in place when the demotion is refused', async () => {
    const { mod, ticket } = await filedTicket();
    await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: 'Looking.' }, adminDevice);
    expect((await demote(mod)).status).toBe(200);
    await prisma.user.update({ where: { id: mod.id }, data: { role: 'moderator' } });
    const bell = await prisma.notification.create({
      data: { userId: mod.id, type: 'staff_ticket_update', payload: { ticketId: ticket.id } },
    });

    // No reason: refused before any write.
    const refused = await post(demotePath(mod), admin, { role: 'user' }, adminDevice);

    expect(refused.status).toBe(400);
    expect(await prisma.notification.findUnique({ where: { id: bell.id } })).not.toBeNull();
  });
});
