/**
 * Staff tickets — real HTTP, real DB (Equoria-puj1e.1, Task 6).
 * Security gate: file-name token `Authz`.
 *
 * Covers who may file, read, reply and change status; that a moderator sees
 * only their own tickets (another's reads as 404); that filing writes the
 * ticket, the admin bell and the log entry together; the admin email through
 * the real email service (EMAIL_CAPTURE_FILE sink), delivered from the email
 * outbox (STAFF-CR-10); that a real SMTP failure never costs the ticket or the
 * bell and leaves the email queued for a retry; and that a mail server that
 * accepts but never answers does not hold up the 201.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { _resetTransporter } from '../../../utils/emailService.mjs';
import { addReply } from '../services/staffTicketService.mjs';
import {
  ORIGIN,
  checkIn,
  cookiesFor,
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

const TICKETS = '/api/v1/staff/tickets';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffticket');
const { makeHorse, makePost, removeTargets } = createTargetFactory('StaffTicket');

// A ticket's horse, show or post must exist (STAFF-CR-07): the default
// subject is one real forum post, made in beforeAll.
let fixturePostId = null;
let fixtureOwner = null;

const goodTicket = (overrides = {}) => ({
  targetType: 'post',
  targetId: String(fixturePostId),
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

const SMTP_KEYS = ['NODE_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];

/**
 * File one ticket through the real email service in production mode, with
 * SMTP pointed at 127.0.0.1:<port>. The outbox delivery runs after the
 * response (STAFF-CR-10), so `whileProduction(res, elapsedMs)` runs before the
 * env is restored; it must wait for that delivery to finish.
 */
async function fileWithSmtpPort(mod, modDevice, port, whileProduction) {
  const csrf = await fetchCsrf(app, {
    origin: ORIGIN,
    extraCookies: cookiesFor(mod, modDevice),
  });
  const saved = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'production',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_USER: 'nobody',
    SMTP_PASS: 'nothing',
  });
  _resetTransporter();
  try {
    const started = Date.now();
    const res = await request(app)
      .post(TICKETS)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(goodTicket());
    await whileProduction(res, Date.now() - started);
    return res;
  } finally {
    for (const key of SMTP_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    _resetTransporter();
  }
}

// A local mail server that accepts connections and never says a word.
const silentSockets = new Set();
const silentSmtp = net.createServer(socket => {
  silentSockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => silentSockets.delete(socket));
});

beforeAll(async () => {
  await new Promise(resolve => silentSmtp.listen(0, '127.0.0.1', resolve));
});

afterAll(async () => {
  for (const socket of silentSockets) {
    socket.destroy();
  }
  await new Promise(resolve => silentSmtp.close(resolve));
});

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  // Test teardown of rows this suite created; replies cascade from tickets.
  cleanup.add(() => removeTicketEmails({ filedById: scope() }), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => removeTargets(), 'horses and posts');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

beforeAll(async () => {
  fixtureOwner = await makeUser('user');
  fixturePostId = (await makePost(fixtureOwner)).id;
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

    const adminBells = await bells(admin.id, 'staffTicket');
    expect(adminBells).toHaveLength(1);
    expect(adminBells[0].payload).toEqual({ ticketId: ticket.id, category: 'Needs the admin' });

    const log = await prisma.staffActionLog.findMany({ where: { actorId: mod.id, capability: 'ticket.file' } });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      capability: 'ticket.file',
      targetType: 'ticket',
      targetId: String(ticket.id),
      reason: 'Needs the admin',
      outcome: 'succeeded',
    });

    // The email is queued with the ticket and delivered from the outbox.
    const queued = (await settledTicketEmails(ticket.id)).filter(row => row.recipientId === admin.id);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ templateKey: 'staffTicket', status: 'sent', attempts: 1 });
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

    // Real email service, real nodemailer transport, real refused connection:
    // production mode with an SMTP port that nothing listens on.
    let row = null;
    const res = await fileWithSmtpPort(mod, modDevice, 1, async filed => {
      const rows = await settledTicketEmails(filed.body.ticket.id);
      row = rows.find(entry => entry.recipientId === admin.id);
    });

    expect(res.status).toBe(201);
    expect(await prisma.staffTicket.count({ where: { id: res.body.ticket.id } })).toBe(1);
    expect(await bells(admin.id, 'staffTicket')).toHaveLength(1);
    // The delivery was really attempted and really failed; the email waits in
    // the outbox for the worker's retry.
    expect(row).toMatchObject({ status: 'pending', attempts: 1, sentAt: null });
    expect(row.lastError).toMatch(/ECONNREFUSED/);
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('answers 201 while the admin email is still stuck on a silent mail server', async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    // Earlier tests' admins step down, so this admin's email is the only one
    // the filing sends and the first to reach the silent server.
    await prisma.user.updateMany({
      where: { id: { in: createdUserIds, not: admin.id }, role: 'admin' },
      data: { role: 'moderator' },
    });

    let elapsed = null;
    let reached = 0;
    let sending = null;
    let row = null;
    const res = await fileWithSmtpPort(mod, modDevice, silentSmtp.address().port, async (filed, ms) => {
      elapsed = ms;
      // The send really reached the mail server and is waiting on it.
      for (let tries = 0; silentSockets.size === 0 && tries < 50; tries += 1) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      reached = silentSockets.size;
      sending = await prisma.emailOutbox.count({
        where: {
          idempotencyKey: { startsWith: `staffTicket:${filed.body.ticket.id}:` },
          recipientId: admin.id,
          status: 'sending',
        },
      });
      // Hang up on every waiting send until each gives up, so nothing outlives the test.
      for (let tries = 0; row === null && tries < 400; tries += 1) {
        for (const socket of silentSockets) {
          socket.destroy();
        }
        try {
          row = (await settledTicketEmails(filed.body.ticket.id, 25)).find(r => r.recipientId === admin.id);
        } catch {
          // still in flight
        }
      }
    });

    expect(res.status).toBe(201);
    expect(await prisma.staffTicket.count({ where: { id: res.body.ticket.id } })).toBe(1);
    expect(await bells(admin.id, 'staffTicket')).toHaveLength(1);
    // nodemailer waits 30s for a greeting; the response did not.
    expect(elapsed).toBeLessThan(10_000);
    // The delivery was still on the wire after the 201, then waited for a retry.
    expect(reached).toBeGreaterThan(0);
    expect(sending).toBe(1);
    expect(row).toMatchObject({ status: 'pending', attempts: 1, sentAt: null });
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
    const filerBells = await bells(mod.id, 'staffTicketUpdate');
    expect(filerBells).toHaveLength(1);
    expect(filerBells[0].payload).toEqual({ ticketId: ticket.id });

    const modReply = await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: 'Thanks.' }, modDevice);
    expect(modReply.status).toBe(201);
    const adminUpdates = await bells(admin.id, 'staffTicketUpdate');
    expect(adminUpdates).toHaveLength(1);
    expect(adminUpdates[0].payload).toEqual({ ticketId: ticket.id });
    expect(await bells(mod.id, 'staffTicketUpdate')).toHaveLength(1);
    // Only filing emails the admin (delivered from the outbox after the 201).
    await settledTicketEmails(ticket.id);
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

  it('writes exactly one ticket.reply log row per reply, with the ticket id and no reply text', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;
    const secret = `reply-text-${uid()}`;

    expect((await post(`${TICKETS}/${ticket.id}/replies`, admin, { body: secret }, adminDevice)).status).toBe(201);

    const rows = await prisma.staffActionLog.findMany({
      where: { capability: 'ticket.reply', targetId: String(ticket.id) },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: admin.id,
      actorRole: 'admin',
      targetType: 'ticket',
      reason: null,
      before: null,
      after: null,
      outcome: 'succeeded',
    });
    expect(JSON.stringify(rows[0])).not.toContain(secret);

    expect((await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: 'Thanks.' }, modDevice)).status).toBe(201);
    const after = await prisma.staffActionLog.findMany({
      where: { capability: 'ticket.reply', targetId: String(ticket.id) },
    });
    expect(after.map(r => r.actorId).sort()).toEqual([admin.id, mod.id].sort());
  });

  it('writes no log row for a refused reply', async () => {
    const { mod, otherMod, modDevice, otherDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    expect((await post(`${TICKETS}/${ticket.id}/replies`, otherMod, { body: 'Hi' }, otherDevice)).status).toBe(404);
    expect((await post(`${TICKETS}/${ticket.id}/replies`, mod, { body: '  ' }, modDevice)).status).toBe(400);
    expect(
      await prisma.staffActionLog.count({ where: { capability: 'ticket.reply', targetId: String(ticket.id) } }),
    ).toBe(0);
  });

  it('rolls the reply back when its log write fails: no reply, no bell, no log row', async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    const ticket = (await post(TICKETS, mod, goodTicket(), modDevice)).body.ticket;

    // A real staff row whose role reads as valid for the visibility check and
    // then as missing for the log entry, so the real log insert fails after
    // the real reply insert, inside the same real transaction.
    let reads = 0;
    const staff = {
      id: admin.id,
      get role() {
        reads += 1;
        return reads === 1 ? 'admin' : undefined;
      },
    };

    await expect(addReply(staff, ticket.id, 'This must not stay.')).rejects.toMatchObject({
      name: 'PrismaClientValidationError',
    });

    expect(reads).toBeGreaterThan(1);
    expect(await prisma.staffTicketReply.count({ where: { ticketId: ticket.id } })).toBe(0);
    expect(await bells(mod.id, 'staffTicketUpdate')).toHaveLength(0);
    expect(
      await prisma.staffActionLog.count({ where: { capability: 'ticket.reply', targetId: String(ticket.id) } }),
    ).toBe(0);
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

    const res = await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'inProgress' }, adminDevice);
    expect(res.status).toBe(200);
    expect(res.body.ticket.status).toBe('inProgress');
    const second = await post(`${TICKETS}/${ticket.id}/status`, admin, { status: 'resolved' }, adminDevice);
    expect(second.body.ticket.status).toBe('resolved');

    const filerBells = await bells(mod.id, 'staffTicketUpdate');
    expect(filerBells.map(b => b.payload)).toEqual([
      { ticketId: ticket.id, status: 'inProgress' },
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
      before: { status: 'inProgress' },
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

describe('Naming the player by username or ID', () => {
  const aboutPlayer = (fields = {}) => ({
    targetType: 'user',
    category: 'Needs the admin',
    note: `private note ${uid()}`,
    ...fields,
  });

  it('files by username and stores that account id', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const player = await makeUser('user');

    const res = await post(TICKETS, mod, aboutPlayer({ targetUsername: `  ${player.username}  ` }), modDevice);

    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ targetType: 'user', targetId: player.id });
    const stored = await prisma.staffTicket.findUnique({ where: { id: res.body.ticket.id } });
    expect(stored.targetId).toBe(player.id);
  });

  it('files by account id as before, and accepts a name and id that agree', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const player = await makeUser('user');

    const byId = await post(TICKETS, mod, aboutPlayer({ targetId: player.id }), modDevice);
    const both = await post(
      TICKETS,
      mod,
      aboutPlayer({ targetId: player.id, targetUsername: player.username }),
      modDevice,
    );

    expect(byId.status).toBe(201);
    expect(byId.body.ticket.targetId).toBe(player.id);
    expect(both.status).toBe(201);
    expect(both.body.ticket.targetId).toBe(player.id);
  });

  it('matches the username exactly as stored: a different case is not that player', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const player = await makeUser('user');

    const res = await post(TICKETS, mod, aboutPlayer({ targetUsername: player.username.toUpperCase() }), modDevice);

    expect(res.status).toBe(404);
  });

  it('refuses a name and id that point to different players, and neither', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const one = await makeUser('user');
    const two = await makeUser('user');
    const before = await prisma.staffTicket.count({ where: { filedById: mod.id } });

    const clash = await post(TICKETS, mod, aboutPlayer({ targetId: one.id, targetUsername: two.username }), modDevice);
    const neither = await post(TICKETS, mod, aboutPlayer(), modDevice);

    expect(clash.status).toBe(400);
    expect(clash.body.message).toBe('The name and ID point to different players');
    expect(neither.status).toBe(400);
    expect(await prisma.staffTicket.count({ where: { filedById: mod.id } })).toBe(before);
  });

  it('answers 404 with the same body for an unknown name and an unknown id', async () => {
    const { mod, modDevice } = await fixtureStaff();

    const byName = await post(TICKETS, mod, aboutPlayer({ targetUsername: `nobody${uid()}` }), modDevice);
    const byId = await post(TICKETS, mod, aboutPlayer({ targetId: `nobody${uid()}` }), modDevice);

    expect(byName.status).toBe(404);
    expect(byId.status).toBe(404);
    expect(byName.body).toEqual({
      success: false,
      message: 'No player by that name or ID',
      code: 'NO_PLAYER',
    });
    expect(byId.body).toEqual(byName.body);
  });

  it('refuses a username for any target but a player', async () => {
    const { mod, modDevice } = await fixtureStaff();
    const res = await post(
      TICKETS,
      mod,
      goodTicket({ targetType: 'horse', targetId: '345', targetUsername: 'someone' }),
      modDevice,
    );
    expect(res.status).toBe(400);
  });

  // Owner ruling 2026-10-13 replaced "allows a staff account as the subject":
  // tickets may name players only. staffTicketTargetsAuthz covers every case.
  it('refuses a staff account as the subject', async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    const res = await post(TICKETS, mod, aboutPlayer({ targetUsername: admin.username }), modDevice);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_A_PLAYER');
  });

  it('shows the current username in the list and the thread, and "former player" data when erased', async () => {
    const { admin, mod, adminDevice, modDevice } = await fixtureStaff();
    const player = await makeUser('user');
    const other = await makeUser('user');
    const filed = (await post(TICKETS, mod, aboutPlayer({ targetId: player.id }), modDevice)).body.ticket;
    const second = (await post(TICKETS, mod, aboutPlayer({ targetId: other.id }), modDevice)).body.ticket;
    const realHorse = await makeHorse(fixtureOwner);
    const horse = (
      await post(TICKETS, mod, goodTicket({ targetType: 'horse', targetId: String(realHorse.id) }), modDevice)
    ).body.ticket;

    const renamed = `renamed${uid()}`;
    await prisma.user.update({ where: { id: player.id }, data: { username: renamed } });

    const list = (await get(TICKETS, admin, adminDevice)).body.tickets;
    expect(list.find(t => t.id === filed.id).targetUsername).toBe(renamed);
    expect(list.find(t => t.id === second.id).targetUsername).toBe(other.username);
    expect(list.find(t => t.id === horse.id)).not.toHaveProperty('targetUsername');

    const thread = await get(`${TICKETS}/${filed.id}`, admin, adminDevice);
    expect(thread.body.ticket.targetUsername).toBe(renamed);

    // An account that is gone: null, which the page shows as "a former player".
    await prisma.staffTicket.update({ where: { id: second.id }, data: { targetId: `gone-${uid()}` } });
    const after = (await get(`${TICKETS}/${second.id}`, admin, adminDevice)).body.ticket;
    expect(after.targetUsername).toBeNull();
  });
});
