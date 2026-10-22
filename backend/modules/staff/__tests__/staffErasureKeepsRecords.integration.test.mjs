/**
 * Erasing a former steward keeps the staff record (Equoria-2yugk).
 *
 * Owner ruling 2026-10-13: the staff log is permanent and complete without
 * being tied to the User row. Erasing an account keeps its log entries under
 * the account ID, and keeps its tickets and replies with the filer or author
 * cleared (shown as "a former steward").
 *
 * The defect: StaffActionLog.actor, StaffTicket.filedBy and
 * StaffTicketReply.author were onDelete Restrict, so eraseUserAccount failed
 * for any account that was ever staff.
 *
 * Real HTTP, real DB, real check-in (helpers/staffFixtures.mjs). Nothing mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../../users/index.mjs';
import {
  STAFF_API,
  checkIn,
  createTargetFactory,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
  removeTicketEmails,
  settledTicketEmails,
} from './helpers/staffFixtures.mjs';

const TICKETS = `${STAFF_API}/tickets`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffersure');
// A ticket's post must exist (STAFF-CR-07).
const { makePost, removeTargets } = createTargetFactory('StaffErasure');
const ticketIds = [];

const ticketBells = ticketId =>
  prisma.notification.findMany({
    where: { type: 'staffTicketUpdate', payload: { path: ['ticketId'], equals: ticketId } },
  });

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  // An erased filer leaves filedById null, so tickets are also scoped by id.
  cleanup.add(() => removeTicketEmails({ OR: [{ id: { in: ticketIds } }, { filedById: scope() }] }), 'ticket emails');
  cleanup.add(
    () =>
      prisma.staffTicket.deleteMany({
        where: { OR: [{ id: { in: ticketIds } }, { filedById: scope() }] },
      }),
    'tickets',
  );
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => removeTargets(), 'posts');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Erasing a former steward (Equoria-2yugk)', () => {
  it('erases the account and keeps its log entries, tickets and replies', async () => {
    const admin = await makeUser('admin');
    const mod = await makeUser('moderator');
    const otherMod = await makeUser('moderator');
    const adminDevice = await checkIn(admin);
    const modDevice = await checkIn(mod);
    const otherDevice = await checkIn(otherMod);

    const forumPost = await makePost(await makeUser('user'));

    // The moderator files a ticket, the admin replies, the moderator answers.
    const filed = await post(
      TICKETS,
      mod,
      { targetType: 'post', targetId: String(forumPost.id), category: 'Spam', note: 'Selling coins' },
      modDevice,
    );
    expect(filed.status).toBe(201);
    const ticketId = filed.body.ticket.id;
    ticketIds.push(ticketId);
    expect((await post(`${TICKETS}/${ticketId}/replies`, admin, { body: 'On it.' }, adminDevice)).status).toBe(201);
    expect((await post(`${TICKETS}/${ticketId}/replies`, mod, { body: 'Thanks.' }, modDevice)).status).toBe(201);

    const modLogBefore = await prisma.staffActionLog.findMany({
      where: { actorId: mod.id },
      orderBy: { id: 'asc' },
    });
    expect(modLogBefore.map(row => row.capability)).toEqual(
      expect.arrayContaining(['staff.checkin', 'ticket.file', 'ticket.reply']),
    );

    // The admin demotes them, then an operator erases the account.
    const demoted = await post(
      `${STAFF_API}/roles/${mod.id}`,
      admin,
      { role: 'user', reason: 'stepped down' },
      adminDevice,
    );
    expect(demoted.status).toBe(200);

    // The filing's post-commit email delivery finishes first. Erasure locks the
    // ticket's outbox rows (scrubTicketEmailFilerTx); a delivery that finds its
    // row locked leaves it to the scheduled job, which tests never run, so the
    // row would stay unsent and teardown would wait on it (Equoria-46v2s).
    const emails = await settledTicketEmails(ticketId);
    expect(emails.find(row => row.recipientId === admin.id)).toMatchObject({ status: 'sent', attempts: 1 });

    let erased;
    let failure;
    try {
      erased = await eraseUserAccount(mod.id);
    } catch (err) {
      failure = err;
    }
    expect(failure?.message).toBeUndefined();
    expect(erased).toEqual({ deleted: true });
    expect(await prisma.user.findUnique({ where: { id: mod.id } })).toBeNull();

    // Every log row the moderator wrote survives, still under their account ID.
    const modLogAfter = await prisma.staffActionLog.findMany({
      where: { id: { in: modLogBefore.map(row => row.id) } },
      orderBy: { id: 'asc' },
    });
    expect(modLogAfter).toHaveLength(modLogBefore.length);
    expect(modLogAfter.every(row => row.actorId === mod.id)).toBe(true);

    // The ticket and both replies survive; the filer and the author are cleared.
    const stored = await prisma.staffTicket.findUnique({
      where: { id: ticketId },
      include: { replies: { orderBy: { id: 'asc' } } },
    });
    expect(stored).not.toBeNull();
    expect(stored.filedById).toBeNull();
    expect(stored.replies.map(r => [r.body, r.authorId])).toEqual([
      ['On it.', admin.id],
      ['Thanks.', null],
    ]);

    // The admin still reads the ticket, with no filer and no author.
    const list = await get(`${TICKETS}?status=open`, admin, adminDevice);
    expect(list.status).toBe(200);
    const row = list.body.tickets.find(t => t.id === ticketId);
    expect(row).toBeDefined();
    expect(row.filedById).toBeNull();
    expect(row.filedBy).toBeNull();

    const thread = await get(`${TICKETS}/${ticketId}`, admin, adminDevice);
    expect(thread.status).toBe(200);
    expect(thread.body.ticket.filedBy).toBeNull();
    expect(thread.body.ticket.replies.map(r => r.author?.username ?? null)).toEqual([admin.username, null]);

    // A moderator who did not file it cannot see it or reply to it.
    expect((await get(`${TICKETS}/${ticketId}`, otherMod, otherDevice)).status).toBe(404);
    const otherList = await get(TICKETS, otherMod, otherDevice);
    expect(otherList.status).toBe(200);
    expect(otherList.body.tickets.map(t => t.id)).not.toContain(ticketId);
    expect((await post(`${TICKETS}/${ticketId}/replies`, otherMod, { body: 'Hi' }, otherDevice)).status).toBe(404);

    // The admin can still reply and mark it, and nobody is belled for a filer who is gone.
    const bellsBefore = (await ticketBells(ticketId)).length;
    expect((await post(`${TICKETS}/${ticketId}/replies`, admin, { body: 'Closing.' }, adminDevice)).status).toBe(201);
    expect((await post(`${TICKETS}/${ticketId}/status`, admin, { status: 'resolved' }, adminDevice)).status).toBe(200);
    expect(await ticketBells(ticketId)).toHaveLength(bellsBefore);
    expect(await prisma.staffTicketReply.count({ where: { ticketId } })).toBe(3);
  });

  it('still erases an account that was never staff', async () => {
    const player = await makeUser('user');

    expect(await eraseUserAccount(player.id)).toEqual({ deleted: true });
    expect(await prisma.user.findUnique({ where: { id: player.id } })).toBeNull();
  });
});
