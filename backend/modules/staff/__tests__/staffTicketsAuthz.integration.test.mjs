/**
 * Staff tickets — real HTTP, real DB (Equoria-puj1e.1, Task 6).
 * Security gate: file-name token `Authz`.
 *
 * Covers who may file, read, reply and change status; that a moderator sees
 * only their own tickets (another's reads as 404); that filing writes the
 * ticket, the admin bell and the log entry together; the admin email through
 * the real email service (EMAIL_CAPTURE_FILE sink); and that a real SMTP
 * failure never costs the ticket or the bell.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { _resetTransporter } from '../../../utils/emailService.mjs';
import {
  ORIGIN,
  checkIn,
  cookiesFor,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const TICKETS = '/api/v1/staff/tickets';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffticket');

const goodTicket = (overrides = {}) => ({
  targetType: 'post',
  targetId: `post-${uid()}`,
  category: 'Needs the admin',
  note: `private note ${uid()}`,
  ...overrides,
});

async function fixtureStaff() {
  const admin = await makeUser('admin');
  const mod = await makeUser('moderator');
  const otherMod = await makeUser('moderator');
  return {
    admin,
    mod,
    otherMod,
    adminDevice: await checkIn(admin),
    modDevice: await checkIn(mod),
    otherDevice: await checkIn(otherMod),
  };
}

const bells = (userId, type) => prisma.notification.findMany({ where: { userId, type }, orderBy: { id: 'asc' } });

function ticketEmailsFor(email) {
  const file = process.env.EMAIL_CAPTURE_FILE;
  if (!file || !existsSync(file)) {
    return [];
  }
  return readFileSync(file, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-ticket' && entry.to === email);
}

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  // Test teardown of rows this suite created; replies cascade from tickets.
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Filing a ticket', () => {
  it('creates the ticket, the admin bell, the log entry and the email together', async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    const body = goodTicket({ category: '  Needs the admin  ' });

    const res = await post(TICKETS, mod, body, modDevice);

    expect(res.status).toBe(201);
    const { ticket } = res.body;
    expect(ticket).toMatchObject({
      filedById: mod.id,
      targetType: body.targetType,
      targetId: body.targetId,
      category: 'Needs the admin',
      note: body.note,
      status: 'open',
    });

    const adminBells = await bells(admin.id, 'staff_ticket');
    expect(adminBells).toHaveLength(1);
    expect(adminBells[0].payload).toEqual({ ticketId: ticket.id, category: 'Needs the admin' });

    const log = await prisma.staffActionLog.findMany({ where: { actorId: mod.id } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'ticket.file',
      targetType: 'ticket',
      targetId: String(ticket.id),
      reason: 'Needs the admin',
      outcome: 'succeeded',
    });

    const emails = ticketEmailsFor(admin.email);
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('A steward has filed a ticket');
    expect(emails[0].preview).toContain(`#${ticket.id}`);
    expect(emails[0].preview).toContain('Needs the admin');
    expect(emails[0].preview).toContain(mod.username);
    expect(JSON.stringify(emails[0])).not.toContain(body.note);
  });

  it('keeps the ticket and the bell and still answers 201 when SMTP really fails', async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    const csrf = await fetchCsrf(app, {
      origin: ORIGIN,
      extraCookies: cookiesFor(mod, modDevice),
    });
    // Real email service, real nodemailer transport, real refused connection:
    // production mode with an SMTP host that nothing listens on.
    const saved = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: 'production',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1',
      SMTP_USER: 'nobody',
      SMTP_PASS: 'nothing',
    });
    _resetTransporter();
    let res;
    try {
      res = await request(app)
        .post(TICKETS)
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send(goodTicket());
    } finally {
      for (const key of ['NODE_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']) {
        if (saved[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = saved[key];
        }
      }
      _resetTransporter();
    }

    expect(res.status).toBe(201);
    expect(await prisma.staffTicket.count({ where: { id: res.body.ticket.id } })).toBe(1);
    expect(await bells(admin.id, 'staff_ticket')).toHaveLength(1);
    expect(ticketEmailsFor(admin.email)).toHaveLength(0);
  });

  it('refuses an admin (no ticket.file), a player, and a moderator without a trusted browser', async () => {
    const { admin, adminDevice, mod } = await fixtureStaff();
    const player = await makeUser('player');

    const asAdmin = await post(TICKETS, admin, goodTicket(), adminDevice);
    expect(asAdmin.status).toBe(403);
    expect(asAdmin.body.code).toBe('STAFF_CAPABILITY_REQUIRED');

    expect((await post(TICKETS, player, goodTicket())).status).toBe(404);

    const noDevice = await post(TICKETS, mod, goodTicket());
    expect(noDevice.status).toBe(403);
    expect(noDevice.body.code).toBe('STAFF_CHECKIN_REQUIRED');

    expect(await prisma.staffTicket.count({ where: { filedById: mod.id } })).toBe(0);
  });

  it.each([
    ['unknown targetType', { targetType: 'planet' }],
    ['missing targetType', { targetType: undefined }],
    ['blank targetId', { targetId: '   ' }],
    ['overlong targetId', { targetId: 'x'.repeat(65) }],
    ['blank category', { category: '' }],
    ['overlong category', { category: 'c'.repeat(41) }],
    ['blank note', { note: ' ' }],
    ['overlong note', { note: 'n'.repeat(2001) }],
    ['non-string note', { note: 42 }],
  ])('rejects %s with 400 and files nothing', async (_label, override) => {
    const { mod, modDevice } = await fixtureStaff();

    const res = await post(TICKETS, mod, goodTicket(override), modDevice);

    expect(res.status).toBe(400);
    expect(await prisma.staffTicket.count({ where: { filedById: mod.id } })).toBe(0);
  });
});

describe('Reading tickets', () => {
  it("lets a moderator see only their own and reads another moderator's as 404", async () => {
    const { admin, mod, otherMod, adminDevice, modDevice, otherDevice } = await fixtureStaff();
    const mine = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;
    const theirs = (await post(TICKETS, otherMod, goodTicket(), otherDevice)).body.ticket;

    const list = await get(TICKETS, mod, modDevice);
    expect(list.status).toBe(200);
    const ids = list.body.tickets.map(t => t.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);

    expect((await get(`${TICKETS}/${mine.id}`, mod, modDevice)).status).toBe(200);
    expect((await get(`${TICKETS}/${theirs.id}`, mod, modDevice)).status).toBe(404);

    const adminList = await get(TICKETS, admin, adminDevice);
    const adminIds = adminList.body.tickets.map(t => t.id);
    expect(adminIds).toEqual(expect.arrayContaining([mine.id, theirs.id]));
    expect((await get(`${TICKETS}/${theirs.id}`, admin, adminDevice)).status).toBe(200);
  });

  it('filters by status, rejects a bad status, and treats a malformed id as 404', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;
    await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'resolved' }, adminDevice);

    const resolved = await get(`${TICKETS}?status=resolved`, mod, modDevice);
    expect(resolved.body.tickets.map(t => t.id)).toContain(ticket.id);
    const open = await get(`${TICKETS}?status=open`, mod, modDevice);
    expect(open.body.tickets.map(t => t.id)).not.toContain(ticket.id);

    expect((await get(`${TICKETS}?status=bogus`, mod, modDevice)).status).toBe(400);
    expect((await get(`${TICKETS}/abc`, mod, modDevice)).status).toBe(404);
    expect((await get(`${TICKETS}/99999999999`, mod, modDevice)).status).toBe(404);
  });

  it('refuses a player and an unchecked-in moderator', async () => {
    const { mod } = await fixtureStaff();
    const player = await makeUser('player');

    expect((await get(TICKETS, player)).status).toBe(404);
    const res = await get(TICKETS, mod);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CHECKIN_REQUIRED');
  });
});

describe('Replies', () => {
  it('lets the admin reply and bells the filer, and the filer reply bells the admins only', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    const adminReply = await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: ' On it. ' }, adminDevice);
    expect(adminReply.status).toBe(201);
    expect(adminReply.body.reply).toMatchObject({ authorId: admin.id, body: 'On it.' });
    const filerBells = await bells(mod.id, 'staff_ticket_update');
    expect(filerBells).toHaveLength(1);
    expect(filerBells[0].payload).toEqual({ ticketId: ticket.id });

    const modReply = await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: 'Thanks.' }, modDevice);
    expect(modReply.status).toBe(201);
    const adminUpdates = await bells(admin.id, 'staff_ticket_update');
    expect(adminUpdates).toHaveLength(1);
    expect(adminUpdates[0].payload).toEqual({ ticketId: ticket.id });
    expect(await bells(mod.id, 'staff_ticket_update')).toHaveLength(1);
    // Only filing emails the admin.
    expect(ticketEmailsFor(admin.email)).toHaveLength(1);

    const thread = await get(`${TICKETS}/${ticket.id}`, mod, modDevice);
    expect(thread.body.ticket.replies.map(r => r.body)).toEqual(['On it.', 'Thanks.']);
  });

  it('answers 404 to another moderator, and 400 to an empty or overlong reply', async () => {
    const { mod, otherMod, modDevice, otherDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    const stranger = await post(`${TICKETS}/${ticket.id}/replies`, otherMod, { body: 'Hi' }, otherDevice);
    expect(stranger.status).toBe(404);
    expect(await prisma.staffTicketReply.count({ where: { ticketId: ticket.id } })).toBe(0);

    expect((await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: '  ' }, modDevice)).status).toBe(400);
    expect((await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: 'r'.repeat(2001) }, modDevice)).status).toBe(
      400,
    );
  });
});

describe('Status changes', () => {
  it('refuses a moderator, even on their own ticket', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    const res = await post(`${TICKETS}/${ticket.id}/status`, mod, { status: 'resolved' }, modDevice);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    expect((await prisma.staffTicket.findUnique({ where: { id: ticket.id } })).status).toBe('open');
  });

  it('lets the admin resolve: status saved, filer belled, change logged with before and after', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    const res = await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'in_progress' }, adminDevice);
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('in_progress');
    const second = await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'resolved' }, adminDevice);
    expect(second.body.ticket.status).toBe('resolved');

    const filerBells = await bells(mod.id, 'staff_ticket_update');
    expect(filerBells.map(b => b.payload)).toEqual([
      { ticketId: ticket.id, status: 'in_progress' },
      { ticketId: ticket.id, status: 'resolved' },
    ]);

    const log = await prisma.staffActionLog.findMany({
      where: { actorId: admin.id, capability: 'ticket.resolve' },
      orderBy: { id: 'asc' },
    });
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({
      targetType: 'ticket',
      targetId: String(ticket.id),
      before: { status: 'in_progress' },
      after: { status: 'resolved' },
    });
  });

  it('rejects an unknown status with 400 and an unknown ticket with 404', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    expect((await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'closed' }, adminDevice)).status).toBe(400);
    expect((await post(`${TICKETS}/2147483647/status`, admin, { status: 'resolved' }, adminDevice)).status).toBe(404);
    expect((await prisma.staffTicket.findUnique({ where: { id: ticket.id } })).status).toBe('open');
  });
});
