/**
 * Durable staff-ticket email — real HTTP, real DB, real email service
 * (STAFF-CR-10).
 *
 * Filing writes one email-outbox row per admin in the ticket's transaction.
 * After commit the filing kicks a delivery; the scheduled worker delivers
 * whatever that kick did not (a restart, a dead mail server), retries with
 * backoff, and gives up as `failed` after MAX_ATTEMPTS. A worker that dies
 * mid-send leaves its row claimed until the lease runs out; one later worker
 * then takes it, and the email goes once.
 *
 * Failing transports are real: production mode with SMTP on a refused port,
 * or the Gmail API pointed at a local server that never answers. Delivery in
 * test mode reaches the email service's own EMAIL_CAPTURE_FILE sink. Nothing
 * is mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import http from 'node:http';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { _resetTransporter } from '../../../utils/emailService.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import {
  LEASE_MS,
  MAX_ATTEMPTS,
  claimDueEmails,
  enqueueTicketEmailsTx,
  runEmailOutbox,
} from '../services/ticketEmailOutbox.mjs';
import {
  STAFF_API,
  capturedTicketEmailsFor,
  checkIn,
  createTargetFactory,
  createUserFactory,
  preparePost,
  removeTicketEmails,
  settledTicketEmails,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const TICKETS = `${STAFF_API}/tickets`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stoutbox');
const { makePost, removeTargets } = createTargetFactory('StaffOutbox');

let fixturePostId = null;

const goodTicket = () => ({
  targetType: 'post',
  targetId: String(fixturePostId),
  category: 'Needs the admin',
  note: `private note ${uid()}`,
});

const MAIL_KEYS = [
  'NODE_ENV',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_OAUTH_URL',
  'GMAIL_API_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

/** Run fn with the real email service in production mode on the given transport. */
async function withMail(values, fn) {
  const saved = Object.fromEntries(MAIL_KEYS.map(key => [key, process.env[key]]));
  for (const key of MAIL_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, { NODE_ENV: 'production', ...values });
  _resetTransporter();
  try {
    return await fn();
  } finally {
    for (const key of MAIL_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    _resetTransporter();
  }
}

// SMTP on a port nothing listens on: every send is a real ECONNREFUSED.
const REFUSED_SMTP = { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'nobody', SMTP_PASS: 'nothing' };

// A local "Google" that accepts connections and never answers.
const googleSockets = new Set();
const silentGoogle = http.createServer(() => {});
silentGoogle.on('connection', socket => {
  googleSockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => googleSockets.delete(socket));
});

async function staffPair() {
  const admin = await makeUser('admin');
  const mod = await makeUser('moderator');
  // Check-in codes travel through the test-mode capture sink.
  await checkIn(admin);
  return { admin, mod, modDevice: await checkIn(mod) };
}

const outboxRow = key => prisma.emailOutbox.findUnique({ where: { idempotencyKey: key } });
const justAfter = date => new Date(date.getTime() + 1000);

/**
 * File one ticket while SMTP refuses: the kick's first attempt fails. Returns
 * this admin's row (an admin another suite left behind gets one too).
 */
async function fileWhileSmtpRefuses(admin, mod, modDevice) {
  const send = await preparePost(TICKETS, mod, goodTicket(), modDevice);
  return withMail(REFUSED_SMTP, async () => {
    const res = await send();
    expect(res.status).toBe(201);
    const rows = await settledTicketEmails(res.body.ticket.id);
    const mine = rows.filter(row => row.recipientId === admin.id);
    expect(mine).toHaveLength(1);
    return { ticket: res.body.ticket, row: mine[0] };
  });
}

beforeAll(async () => {
  await new Promise(resolve => silentGoogle.listen(0, '127.0.0.1', resolve));
  const scope = () => ({ in: createdUserIds });
  // Test teardown of rows this suite created.
  cleanup.add(() => removeTicketEmails({ filedById: scope() }), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: { filedById: scope() } }), 'tickets');
  cleanup.add(() => prisma.emailOutbox.deleteMany({ where: { recipientId: scope() } }), 'outbox');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => removeTargets(), 'posts');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  fixturePostId = (await makePost(await makeUser('user'))).id;
});

afterAll(async () => {
  for (const socket of googleSockets) {
    socket.destroy();
  }
  await new Promise(resolve => silentGoogle.close(resolve));
  await cleanup.run();
}, 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Ticket email outbox (STAFF-CR-10)', () => {
  it('commits the email with the ticket, and the scheduled worker sends what the kick could not', async () => {
    const { admin, mod, modDevice } = await staffPair();

    const { ticket, row } = await fileWhileSmtpRefuses(admin, mod, modDevice);

    expect(row).toMatchObject({
      recipientId: admin.id,
      templateKey: 'staff_ticket',
      status: 'pending',
      attempts: 1,
      sentAt: null,
    });
    expect(row.payload).toEqual({ ticketId: ticket.id, category: 'Needs the admin', filedBy: mod.username });
    expect(row.lastError).toMatch(/ECONNREFUSED/);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);

    // Not yet due: the worker leaves it alone.
    const keys = [row.idempotencyKey];
    expect((await cronJobService.deliverEmailOutbox({ keys })).claimed).toBe(0);

    // Due, and the mail service is back: the scheduled job's worker sends it.
    const summary = await cronJobService.deliverEmailOutbox({ now: justAfter(row.nextAttemptAt), keys });
    expect(summary).toMatchObject({ claimed: 1, sent: 1, failed: 0 });

    const sent = await outboxRow(row.idempotencyKey);
    expect(sent).toMatchObject({ status: 'sent', attempts: 2, lastError: null });
    expect(sent.sentAt).not.toBeNull();
    const emails = capturedTicketEmailsFor(admin.email);
    expect(emails).toHaveLength(1);
    expect(emails[0].preview).toContain(`#${ticket.id}`);
    expect(emails[0].preview).toContain(mod.username);
  });

  it('retries a worker that died mid-send once its lease runs out, and the email goes exactly once', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    const keys = [row.idempotencyKey];

    // A worker claims the row and the process dies before it can send.
    const claimedAt = justAfter(row.nextAttemptAt);
    expect(await claimDueEmails({ now: claimedAt, keys })).toHaveLength(1);
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sending', attempts: 2 });

    // Inside the lease no other worker touches it.
    const insideLease = new Date(claimedAt.getTime() + LEASE_MS - 1000);
    expect((await runEmailOutbox({ now: insideLease, keys })).claimed).toBe(0);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);

    // After the lease two workers race for it; exactly one sends.
    const afterLease = new Date(claimedAt.getTime() + LEASE_MS + 1000);
    const runs = await Promise.all([
      runEmailOutbox({ now: afterLease, keys }),
      runEmailOutbox({ now: afterLease, keys }),
    ]);
    expect(runs.reduce((total, run) => total + run.sent, 0)).toBe(1);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(1);
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 3 });

    // Later runs find nothing to do.
    const muchLater = new Date(afterLease.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect((await runEmailOutbox({ now: muchLater, keys })).claimed).toBe(0);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(1);

    // The same ticket and recipient never get a second row.
    await prisma.$transaction(tx => enqueueTicketEmailsTx(tx, [{ id: admin.id }], row.payload));
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey: row.idempotencyKey } })).toBe(1);
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 3 });
  });

  it('ends a permanently failing email as failed after MAX_ATTEMPTS, keeping the ticket and the bell', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { ticket, row: first } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    const keys = [first.idempotencyKey];

    await withMail(REFUSED_SMTP, async () => {
      let row = first;
      let summary = null;
      while (row.status === 'pending') {
        summary = await runEmailOutbox({ now: justAfter(row.nextAttemptAt), keys });
        row = await outboxRow(first.idempotencyKey);
      }
      expect(summary).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
      expect(row).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS, sentAt: null });
      expect(row.lastError).toMatch(/ECONNREFUSED/);

      // A failed email stays failed.
      const muchLater = new Date(row.updatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect((await runEmailOutbox({ now: muchLater, keys })).claimed).toBe(0);
    });

    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
    expect(await prisma.staffTicket.count({ where: { id: ticket.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: admin.id, type: 'staff_ticket' } })).toBe(1);
  });

  it('answers 201 while the Gmail API never answers, and the stuck send is retried later', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const send = await preparePost(TICKETS, mod, goodTicket(), modDevice);
    const baseUrl = `http://127.0.0.1:${silentGoogle.address().port}`;

    await withMail(
      {
        GMAIL_CLIENT_ID: 'client-id',
        GMAIL_CLIENT_SECRET: 'client-secret',
        GMAIL_REFRESH_TOKEN: 'refresh-token',
        GMAIL_OAUTH_URL: `${baseUrl}/token`,
        GMAIL_API_URL: baseUrl,
      },
      async () => {
        const started = Date.now();
        const res = await send();
        const elapsed = Date.now() - started;

        expect(res.status).toBe(201);
        // The Gmail transport waits 15s per stage; the response did not.
        expect(elapsed).toBeLessThan(5_000);
        expect(await prisma.staffTicket.count({ where: { id: res.body.ticket.id } })).toBe(1);

        // The send really reached "Google" and is waiting on it.
        for (let tries = 0; googleSockets.size === 0 && tries < 100; tries += 1) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        expect(googleSockets.size).toBeGreaterThan(0);
        const ticketRows = () =>
          prisma.emailOutbox.findMany({
            where: { idempotencyKey: { startsWith: `staff_ticket:${res.body.ticket.id}:` } },
          });
        expect((await ticketRows()).filter(r => r.status === 'sending')).toHaveLength(1);

        // Hang up on every send until each gives up; the rows wait for a retry.
        const inFlight = rows => rows.some(r => r.status === 'sending' || r.attempts === 0);
        let rows = await ticketRows();
        for (let tries = 0; inFlight(rows) && tries < 400; tries += 1) {
          for (const socket of googleSockets) {
            socket.destroy();
          }
          await new Promise(resolve => setTimeout(resolve, 25));
          rows = await ticketRows();
        }
        const row = rows.find(r => r.recipientId === admin.id);
        expect(row).toMatchObject({ status: 'pending', attempts: 1 });
        expect(row.lastError).toEqual(expect.any(String));
      },
    );
  });

  it('cancels an email whose recipient is no longer an admin when it comes due', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);

    await prisma.user.update({ where: { id: admin.id }, data: { role: 'moderator' } });
    const summary = await runEmailOutbox({ now: justAfter(row.nextAttemptAt), keys: [row.idempotencyKey] });

    expect(summary).toMatchObject({ claimed: 1, sent: 0, cancelled: 1 });
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'cancelled', sentAt: null });
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
  });
});
