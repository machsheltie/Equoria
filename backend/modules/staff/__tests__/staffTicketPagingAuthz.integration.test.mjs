/**
 * Staff ticket and reply paging — real HTTP, real DB (STAFF-CR-03, STAFF-CR-09).
 * Security gate: file-name token `Authz`.
 *
 * The ticket list pages newest first on (createdAt, id) and hands back a
 * nextCursor; every page keeps the moderator's own-tickets rule and the status
 * filter. A thread returns its newest replies (shown oldest first) a bounded
 * page at a time, with a cursor for the earlier ones. Timestamps are seeded
 * with many ties, and with ids out of step with time, so a page boundary
 * falls inside a tie and only the full (createdAt, id) key keeps each row on
 * exactly one page.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkIn, createUserFactory, get, startEmailCapture, stopEmailCapture, uid } from './helpers/staffFixtures.mjs';

const TICKETS = '/api/v1/staff/tickets';
const LIST_PAGE = 100;
const REPLY_PAGE = 50;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stpaging');

let admin;
let mod;
let otherMod;
let adminDevice;
let modDevice;
let otherDevice;

beforeAll(async () => {
  const scope = () => ({ in: createdUserIds });
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
  otherMod = await makeUser('moderator');
  adminDevice = await checkIn(admin);
  modDevice = await checkIn(mod);
  otherDevice = await checkIn(otherMod);
  stopEmailCapture();
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

const BASE = Date.parse('2031-03-01T12:00:00.000Z');

/** Sort newest first on (createdAt, id): the list's own order. */
const newestFirst = (a, b) => b.createdAt - a.createdAt || b.id - a.id;
const oldestFirst = (a, b) => -newestFirst(a, b);

/** `count` tickets for `filer`; about seven share each timestamp, ids out of step with time. */
async function seedTickets(filer, count, status = i => (i % 3 === 0 ? 'open' : 'inProgress')) {
  const tag = `paging-${uid()}`;
  await prisma.staffTicket.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      filedById: filer.id,
      targetType: 'post',
      targetId: '1',
      category: tag,
      note: `n${i}`,
      status: status(i),
      createdAt: new Date(BASE - ((i * 31) % 33) * 1000),
    })),
  });
  return prisma.staffTicket.findMany({ where: { category: tag } });
}

/** Follow nextCursor to the end; returns every ticket seen and the page count. */
async function allPages(user, device, status) {
  const seen = [];
  let cursor = null;
  let pages = 0;
  do {
    const params = [];
    if (status) {
      params.push(`status=${status}`);
    }
    if (cursor) {
      params.push(`cursor=${encodeURIComponent(cursor)}`);
    }
    const res = await get(`${TICKETS}?${params.join('&')}`, user, device);
    expect(res.status).toBe(200);
    expect(res.body.tickets.length).toBeLessThanOrEqual(LIST_PAGE);
    seen.push(...res.body.tickets);
    cursor = res.body.nextCursor;
    pages += 1;
    if (pages > 50) {
      throw new Error('the cursor never ran out');
    }
  } while (cursor);
  return { seen, pages };
}

const idsOf = rows => rows.map(row => row.id);
const asRows = tickets => tickets.map(t => ({ id: t.id, createdAt: Date.parse(t.createdAt) }));

describe('The ticket list pages past 100 tickets', () => {
  let mine;
  let theirs;

  beforeAll(async () => {
    mine = await seedTickets(mod, 230);
    // The other moderator's tickets share the same timestamps and interleave.
    theirs = await seedTickets(otherMod, 45);
  });

  it("walks every one of a moderator's tickets exactly once, in order, and never another's", async () => {
    const { seen, pages } = await allPages(mod, modDevice);

    expect(pages).toBe(3);
    const ids = idsOf(seen);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort((a, b) => a - b)).toEqual(idsOf(mine).sort((a, b) => a - b));
    const theirIds = new Set(idsOf(theirs));
    expect(seen.some(t => theirIds.has(t.id))).toBe(false);
    expect(asRows(seen)).toEqual(asRows(seen).slice().sort(newestFirst));
  });

  it('keeps the status filter on every page', async () => {
    const { seen, pages } = await allPages(mod, modDevice, 'inProgress');

    const expected = mine.filter(t => t.status === 'inProgress');
    expect(expected.length).toBeGreaterThan(LIST_PAGE);
    expect(pages).toBe(2);
    expect(seen.every(t => t.status === 'inProgress')).toBe(true);
    expect(idsOf(seen).sort((a, b) => a - b)).toEqual(idsOf(expected).sort((a, b) => a - b));
  });

  it("lets the admin walk both moderators' tickets, each exactly once", async () => {
    const { seen } = await allPages(admin, adminDevice);

    const ids = idsOf(seen);
    expect(new Set(ids).size).toBe(ids.length);
    const all = new Set(ids);
    expect([...mine, ...theirs].every(t => all.has(t.id))).toBe(true);
    expect(asRows(seen)).toEqual(asRows(seen).slice().sort(newestFirst));
  });

  it("does not let another moderator's cursor widen what a moderator sees", async () => {
    const adminFirst = await get(TICKETS, admin, adminDevice);
    expect(adminFirst.body.nextCursor).toEqual(expect.any(String));

    const { seen } = await (async () => {
      const res = await get(
        `${TICKETS}?cursor=${encodeURIComponent(adminFirst.body.nextCursor)}`,
        otherMod,
        otherDevice,
      );
      expect(res.status).toBe(200);
      return { seen: res.body.tickets };
    })();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(t => t.filedById === otherMod.id)).toBe(true);
  });

  it('refuses a cursor it did not issue', async () => {
    for (const bad of ['nonsense', 'MjAzMS0wMy0wMVQxMjowMDowMC4wMDBafA', '%20']) {
      const res = await get(`${TICKETS}?cursor=${bad}`, mod, modDevice);
      expect(res.status).toBe(400);
    }
  });
});

describe('A ticket thread pages its replies', () => {
  let ticket;
  let replies;

  beforeAll(async () => {
    ticket = await prisma.staffTicket.create({
      data: { filedById: mod.id, targetType: 'post', targetId: '1', category: 'Long thread', note: 'n' },
    });
    await prisma.staffTicketReply.createMany({
      data: Array.from({ length: 120 }, (_, i) => ({
        ticketId: ticket.id,
        authorId: i % 2 === 0 ? mod.id : admin.id,
        body: `reply ${i}`,
        // About nine share each timestamp, ids out of step with time.
        createdAt: new Date(BASE + ((i * 37) % 13) * 1000),
      })),
    });
    replies = await prisma.staffTicketReply.findMany({ where: { ticketId: ticket.id } });
  });

  async function wholeThread(user, device) {
    const pages = [];
    let before = null;
    do {
      const res = await get(
        `${TICKETS}/${ticket.id}${before ? `?before=${encodeURIComponent(before)}` : ''}`,
        user,
        device,
      );
      expect(res.status).toBe(200);
      expect(res.body.ticket.replies.length).toBeLessThanOrEqual(REPLY_PAGE);
      pages.push(res.body.ticket.replies);
      before = res.body.olderRepliesCursor;
      if (pages.length > 20) {
        throw new Error('the reply cursor never ran out');
      }
    } while (before);
    return pages;
  }

  it('returns the newest 50 first, oldest first within the page, then each earlier page once', async () => {
    const pages = await wholeThread(mod, modDevice);

    expect(pages.map(page => page.length)).toEqual([50, 50, 20]);
    const expected = asRows(replies).sort(oldestFirst);
    expect(asRows(pages[0])).toEqual(expected.slice(70));
    // Shown in reading order: earliest page first.
    const thread = pages.slice().reverse().flat();
    expect(asRows(thread)).toEqual(expected);
    expect(new Set(idsOf(thread)).size).toBe(120);
    // The author (or former steward) still comes with each reply.
    expect(pages[0][0].author).toEqual(expect.objectContaining({ id: expect.any(String) }));
  });

  it('pages the same way for the admin', async () => {
    const pages = await wholeThread(admin, adminDevice);
    expect(pages.flat()).toHaveLength(120);
  });

  it('answers 404 to another moderator, with or without a cursor', async () => {
    const first = await get(`${TICKETS}/${ticket.id}`, mod, modDevice);
    expect((await get(`${TICKETS}/${ticket.id}`, otherMod, otherDevice)).status).toBe(404);
    const cursor = encodeURIComponent(first.body.olderRepliesCursor);
    expect((await get(`${TICKETS}/${ticket.id}?before=${cursor}`, otherMod, otherDevice)).status).toBe(404);
  });

  it('refuses a reply cursor it did not issue', async () => {
    expect((await get(`${TICKETS}/${ticket.id}?before=nonsense`, mod, modDevice)).status).toBe(400);
  });

  it('gives a short thread no cursor', async () => {
    const short = await prisma.staffTicket.create({
      data: { filedById: mod.id, targetType: 'post', targetId: '1', category: 'Short', note: 'n' },
    });
    const res = await get(`${TICKETS}/${short.id}`, mod, modDevice);
    expect(res.status).toBe(200);
    expect(res.body.ticket.replies).toEqual([]);
    expect(res.body.olderRepliesCursor).toBeNull();
  });
});
