/**
 * Staff ticket status changes — real HTTP, real DB (STAFF-CR-08).
 * Security gate: file-name token `Authz`.
 *
 * Owner ruling (b), 2026-10-13: the admin may move a ticket from any status
 * to any other, including reopening a resolved or declined ticket and skipping
 * a step. Only a change to the status it already has is refused, and that
 * refusal writes no log row and rings no bell. Two simultaneous changes give
 * exactly one winner, one log row and one bell.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
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

const TICKETS = '/api/v1/staff/tickets';
const STATUSES = ['open', 'inProgress', 'resolved', 'declined'];

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stticketst');

let admin;
let mod;
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
  mod = await makeUser('moderator');
  adminDevice = await checkIn(admin);
  stopEmailCapture();
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** A ticket filed by the moderator, already at `status`. */
const ticketAt = status =>
  prisma.staffTicket.create({
    data: {
      filedById: mod.id,
      targetType: 'post',
      targetId: '1',
      category: 'Status fixture',
      note: `note ${uid()}`,
      status,
    },
  });

const setStatus = (ticket, status) => post(`${TICKETS}/${ticket.id}/status`, admin, { status }, adminDevice);

async function trail(ticket) {
  const [logRows, bells] = await Promise.all([
    prisma.staffActionLog.findMany({
      where: { capability: 'ticket.resolve', targetId: String(ticket.id) },
      orderBy: { id: 'asc' },
    }),
    prisma.notification.findMany({
      where: { userId: mod.id, type: 'staffTicketUpdate' },
      orderBy: { id: 'asc' },
    }),
  ]);
  return {
    logRows,
    bells: bells.filter(bell => bell.payload?.ticketId === ticket.id),
  };
}

describe('Any status may become any other status', () => {
  const edges = STATUSES.flatMap(from => STATUSES.filter(to => to !== from).map(to => [from, to]));

  it.each(edges)('allows %s -> %s with one log row and one bell', async (from, to) => {
    const ticket = await ticketAt(from);

    const res = await setStatus(ticket, to);

    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe(to);
    const { logRows, bells } = await trail(ticket);
    expect(logRows).toHaveLength(1);
    expect(logRows[0]).toMatchObject({ before: { status: from }, after: { status: to } });
    expect(bells.map(bell => bell.payload)).toEqual([{ ticketId: ticket.id, status: to }]);
  });

  it('reopens a resolved ticket and then declines it', async () => {
    const ticket = await ticketAt('resolved');

    expect((await setStatus(ticket, 'open')).status).toBe(200);
    expect((await setStatus(ticket, 'declined')).status).toBe(200);

    const { logRows } = await trail(ticket);
    expect(logRows.map(row => [row.before.status, row.after.status])).toEqual([
      ['resolved', 'open'],
      ['open', 'declined'],
    ]);
  });
});

describe('A change to the status the ticket already has', () => {
  it.each(STATUSES)('refuses %s -> the same status with 409 and writes no log row and no bell', async status => {
    const ticket = await ticketAt(status);

    const res = await setStatus(ticket, status);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      message: 'The ticket already has that status.',
      code: 'SAME_STATUS',
    });
    expect((await prisma.staffTicket.findUnique({ where: { id: ticket.id } })).status).toBe(status);
    const { logRows, bells } = await trail(ticket);
    expect(logRows).toHaveLength(0);
    expect(bells).toHaveLength(0);
  });
});

describe('Two simultaneous status changes', () => {
  it.each([
    ['resolved', 'declined'],
    ['resolved', 'resolved'],
  ])('open -> %s racing open -> %s: one winner, one log row, one bell', async (first, second) => {
    const ticket = await ticketAt('open');
    const sendFirst = await preparePost(`${TICKETS}/${ticket.id}/status`, admin, { status: first }, adminDevice);
    const sendSecond = await preparePost(`${TICKETS}/${ticket.id}/status`, admin, { status: second }, adminDevice);

    // Both read the ticket as open, then queue on its row behind the holder.
    const responses = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM staff_tickets WHERE id = ${ticket.id} FOR UPDATE`,
      [sendFirst, sendSecond],
    );

    const statuses = responses.map(res => res.status).sort();
    expect(statuses).toEqual([200, 409]);
    const winner = responses.find(res => res.status === 200).body.ticket.status;
    expect((await prisma.staffTicket.findUnique({ where: { id: ticket.id } })).status).toBe(winner);
    const { logRows, bells } = await trail(ticket);
    expect(logRows).toHaveLength(1);
    expect(logRows[0]).toMatchObject({ before: { status: 'open' }, after: { status: winner } });
    expect(bells.map(bell => bell.payload)).toEqual([{ ticketId: ticket.id, status: winner }]);
  });
});
