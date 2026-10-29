/**
 * Durable staff-ticket email — real HTTP, real DB, real email service
 * (STAFF-CR-10).
 *
 * Filing writes one email-outbox row per admin in the ticket's transaction.
 * After commit the filing kicks a delivery; the scheduled worker delivers
 * whatever that kick did not (a restart, a dead mail server), retries with
 * backoff, and gives up as `failed` after maxAttempts. A worker that dies
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
import net from 'node:net';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { _resetTransporter } from '../../../utils/emailService.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { eraseUserAccount } from '../../users/index.mjs';
import {
  FAILED_RETENTION_MS,
  FORMER_STEWARD,
  LEASE_MS as leaseMs,
  MAX_ATTEMPTS as maxAttempts,
  runBudgetMs,
  SENT_RETENTION_MS,
  claimDueEmails,
  enqueueTicketEmailsTx,
  purgeSettledEmails,
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
const erasedFilerTickets = [];

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
const refusedSmtp = { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'nobody', SMTP_PASS: 'nothing' };

// A local "Google" that accepts connections and never answers.
const googleSockets = new Set();
const silentGoogle = http.createServer(() => {});
silentGoogle.on('connection', socket => {
  googleSockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => googleSockets.delete(socket));
});

// An SMTP server that accepts connections and never sends its greeting.
const smtpSockets = new Set();
const silentSmtp = net.createServer(socket => {
  smtpSockets.add(socket);
  socket.on('error', () => {});
  socket.on('close', () => smtpSockets.delete(socket));
});

// A second client holds the race tests' row locks (rowLockBarrier.mjs).
const barrierClient = createBarrierClient();

async function staffPair() {
  const admin = await makeUser('admin');
  const mod = await makeUser('moderator');
  // Check-in codes travel through the test-mode capture sink.
  await checkIn(admin);
  return { admin, mod, modDevice: await checkIn(mod) };
}

const outboxRow = key => prisma.emailOutbox.findUnique({ where: { idempotencyKey: key } });
const justAfter = date => new Date(date.getTime() + 1000);
/** A fixed test clock. */
const at = date => () => date;

/**
 * File one ticket while SMTP refuses: the kick's first attempt fails. Returns
 * this admin's row (an admin another suite left behind gets one too).
 */
async function fileWhileSmtpRefuses(admin, mod, modDevice) {
  const send = await preparePost(TICKETS, mod, goodTicket(), modDevice);
  return withMail(refusedSmtp, async () => {
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
  await new Promise(resolve => silentSmtp.listen(0, '127.0.0.1', resolve));
  const scope = () => ({ in: createdUserIds });
  // Test teardown of rows this suite created.
  const tickets = () => ({ OR: [{ filedById: scope() }, { id: { in: erasedFilerTickets } }] });
  cleanup.add(() => removeTicketEmails(tickets()), 'ticket emails');
  cleanup.add(() => prisma.staffTicket.deleteMany({ where: tickets() }), 'tickets');
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
  for (const socket of smtpSockets) {
    socket.destroy();
  }
  await new Promise(resolve => silentSmtp.close(resolve));
  await barrierClient.$disconnect();
  await cleanup.run();
}, 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

// First in the file, while the outbox holds none of this suite's rows. It
// reproduces the old defect only while the outbox is otherwise empty (as in a
// targeted run); on a busier table the planner picks a safe plan either way.
describe('one claim takes one row (Equoria-7ykaq)', () => {
  it("claims exactly one of a kick's due rows when the statistics say the table holds about one row", async () => {
    // The planner state that stranded ticket emails: statistics taken while
    // the outbox held one row. The old UPDATE ... FROM (subquery) then
    // re-ran the subquery for each row and one claim took all of them.
    const lone = await makeUser('admin');
    // No real ticket; a negative id never matches one. The rows go with
    // their recipients in the outbox teardown.
    const ticketId = -(Date.now() % 1_000_000_000);
    await prisma.$transaction(tx =>
      enqueueTicketEmailsTx(tx, [lone], { ticketId, category: 'Claim', filedBy: 'Test' }),
    );
    await prisma.$executeRawUnsafe('ANALYZE email_outbox');

    const admins = [];
    for (let i = 0; i < 6; i += 1) {
      admins.push(await makeUser('admin'));
    }
    const keys = await prisma.$transaction(tx =>
      enqueueTicketEmailsTx(tx, admins, { ticketId: ticketId - 1, category: 'Claim', filedBy: 'Test' }),
    );

    const claimed = await claimDueEmails({ now: new Date(Date.now() + 1000), keys });

    expect(claimed).toHaveLength(1);
    const rows = await prisma.emailOutbox.findMany({ where: { idempotencyKey: { in: keys } }, orderBy: { id: 'asc' } });
    expect(rows.map(row => row.status)).toEqual(['sending', 'pending', 'pending', 'pending', 'pending', 'pending']);
    expect(rows.slice(1).every(row => row.attempts === 0 && row.claimedAt === null)).toBe(true);
  });
});

describe('Ticket email outbox (STAFF-CR-10)', () => {
  it('commits the email with the ticket, and the scheduled worker sends what the kick could not', async () => {
    const { admin, mod, modDevice } = await staffPair();

    const { ticket, row } = await fileWhileSmtpRefuses(admin, mod, modDevice);

    expect(row).toMatchObject({
      recipientId: admin.id,
      templateKey: 'staffTicket',
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
    const summary = await cronJobService.deliverEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys });
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
    const insideLease = new Date(claimedAt.getTime() + leaseMs - 1000);
    expect((await runEmailOutbox({ clock: at(insideLease), keys })).claimed).toBe(0);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);

    // After the lease two workers race for it; exactly one sends.
    const afterLease = new Date(claimedAt.getTime() + leaseMs + 1000);
    const runs = await Promise.all([
      runEmailOutbox({ clock: at(afterLease), keys }),
      runEmailOutbox({ clock: at(afterLease), keys }),
    ]);
    expect(runs.reduce((total, run) => total + run.sent, 0)).toBe(1);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(1);
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 2 });

    // Later runs find nothing to do.
    const muchLater = new Date(afterLease.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect((await runEmailOutbox({ clock: at(muchLater), keys })).claimed).toBe(0);
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(1);

    // The same ticket and recipient never get a second row.
    await prisma.$transaction(tx => enqueueTicketEmailsTx(tx, [{ id: admin.id }], row.payload));
    expect(await prisma.emailOutbox.count({ where: { idempotencyKey: row.idempotencyKey } })).toBe(1);
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('ends a permanently failing email as failed after maxAttempts, keeping the ticket and the bell', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { ticket, row: first } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    const keys = [first.idempotencyKey];

    await withMail(refusedSmtp, async () => {
      let row = first;
      let summary = null;
      while (row.status === 'pending') {
        summary = await runEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys });
        row = await outboxRow(first.idempotencyKey);
      }
      expect(summary).toMatchObject({ claimed: 1, sent: 0, failed: 1 });
      expect(row).toMatchObject({ status: 'failed', attempts: maxAttempts, sentAt: null });
      expect(row.lastError).toMatch(/ECONNREFUSED/);

      // A failed email stays failed.
      const muchLater = new Date(row.updatedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect((await runEmailOutbox({ clock: at(muchLater), keys })).claimed).toBe(0);
    });

    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
    expect(await prisma.staffTicket.count({ where: { id: ticket.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: admin.id, type: 'staffTicket' } })).toBe(1);
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
            where: { idempotencyKey: { startsWith: `staffTicket:${res.body.ticket.id}:` } },
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

  // STAFF-RR-02 (Equoria-dqvg7): a worker that dies between claim and send has
  // not tried to send, so the retake resumes that attempt instead of using one up.
  it('still delivers after a worker dies before sending, maxAttempts times over', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    const keys = [row.idempotencyKey];

    let claimAt = justAfter(row.nextAttemptAt);
    for (let crash = 0; crash < maxAttempts; crash += 1) {
      expect(await claimDueEmails({ now: claimAt, keys })).toHaveLength(1);
      claimAt = new Date(claimAt.getTime() + leaseMs + 1000);
    }
    // One send was tried (the kick's); the second attempt never reached one.
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sending', attempts: 2 });

    const summary = await runEmailOutbox({ clock: at(claimAt), keys });
    expect(summary).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'sent', attempts: 2 });
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(1);
  });

  // STAFF-RR-08 (Equoria-bq0oi): a slow mail server cannot keep a run going past
  // its budget; what it did not reach stays due for the next run.
  it('stops claiming once the run budget is spent, leaving the rest due', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const rows = [];
    for (let i = 0; i < 3; i += 1) {
      rows.push((await fileWhileSmtpRefuses(admin, mod, modDevice)).row);
    }
    const keys = rows.map(row => row.idempotencyKey);
    const start = justAfter(new Date(Math.max(...rows.map(row => row.nextAttemptAt.getTime()))));
    // Every reading is two minutes after the last, as if each send were slow.
    let readings = 0;
    const clock = () => new Date(start.getTime() + readings++ * 2 * 60 * 1000);

    const summary = await withMail(refusedSmtp, () => runEmailOutbox({ clock, keys, budgetMs: runBudgetMs }));

    // Claim at 0, backoff at 2 min, next claim would be at 4 min: past budget.
    expect(summary).toMatchObject({ claimed: 1, retrying: 1 });
    const after = await Promise.all(keys.map(outboxRow));
    expect(after.filter(row => row.attempts === 2)).toHaveLength(1);
    const untouched = after.filter(row => row.attempts === 1);
    expect(untouched).toHaveLength(2);
    for (const row of untouched) {
      expect(row.status).toBe('pending');
      expect(row.nextAttemptAt.getTime()).toBeLessThan(start.getTime());
    }
    // The scheduled run's budget leaves room for one in-flight send in its 5-minute period.
    expect(runBudgetMs).toBeLessThanOrEqual(3 * 60 * 1000);
  });

  // STAFF-RR-08 / STAFF-RR-06: an SMTP server that never greets is given up on
  // in seconds (nodemailer's own default waits 30 s for the greeting and
  // 10 minutes on an idle socket).
  it('gives up on an SMTP server that never answers within seconds', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    const silent = { ...refusedSmtp, SMTP_PORT: String(silentSmtp.address().port) };

    const started = Date.now();
    const summary = await withMail(silent, () =>
      runEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys: [row.idempotencyKey] }),
    );

    expect(Date.now() - started).toBeLessThan(20_000);
    expect(summary).toMatchObject({ claimed: 1, retrying: 1 });
    expect((await outboxRow(row.idempotencyKey)).lastError).toMatch(/greeting|timeout/i);
  }, 40_000);

  // STAFF-RR-06 (Equoria-aexiz): the recipient is re-read under a lock that
  // role and email changes also need, so a change in flight is waited for.
  describe('a role or email change in flight when the email comes due', () => {
    /** Hold `change` uncommitted, start the delivery, see it wait, then commit. */
    async function deliverDuring(change, row) {
      const barrier = await openRowLockBarrier(barrierClient, change);
      const delivery = runEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys: [row.idempotencyKey] });
      try {
        await waitForBlockedSessions(barrierClient, barrier.pid, 1, 5000);
      } finally {
        await barrier.release();
      }
      return delivery;
    }

    it('cancels instead of mailing an admin whose demotion was committing', async () => {
      const { admin, mod, modDevice } = await staffPair();
      const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);

      const summary = await deliverDuring(
        tx => tx.user.update({ where: { id: admin.id }, data: { role: 'moderator' } }),
        row,
      );

      expect(summary).toMatchObject({ claimed: 1, sent: 0, cancelled: 1 });
      expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
    });

    it('mails the new address, never the old one, when an email change was committing', async () => {
      const { admin, mod, modDevice } = await staffPair();
      const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);
      const newEmail = `moved-${uid()}@example.com`;

      const summary = await deliverDuring(
        tx => tx.user.update({ where: { id: admin.id }, data: { email: newEmail } }),
        row,
      );

      expect(summary).toMatchObject({ claimed: 1, sent: 1 });
      expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
      expect(capturedTicketEmailsFor(newEmail)).toHaveLength(1);
    });
  });

  it('cancels an email whose recipient is no longer an admin when it comes due', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const { row } = await fileWhileSmtpRefuses(admin, mod, modDevice);

    await prisma.user.update({ where: { id: admin.id }, data: { role: 'moderator' } });
    const summary = await runEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys: [row.idempotencyKey] });

    expect(summary).toMatchObject({ claimed: 1, sent: 0, cancelled: 1 });
    expect(await outboxRow(row.idempotencyKey)).toMatchObject({ status: 'cancelled', sentAt: null });
    expect(capturedTicketEmailsFor(admin.email)).toHaveLength(0);
  });

  it('reads the clock afresh for each claim and each backoff, so a slow run never hands out a stale lease', async () => {
    const { admin, mod, modDevice } = await staffPair();
    const first = (await fileWhileSmtpRefuses(admin, mod, modDevice)).row;
    const second = (await fileWhileSmtpRefuses(admin, mod, modDevice)).row;
    const keys = [first.idempotencyKey, second.idempotencyKey];

    // Each reading is two minutes after the last, as if every send were slow
    // (less than the 5-minute retry wait, so the first row is not due again).
    const start = justAfter(second.nextAttemptAt > first.nextAttemptAt ? second.nextAttemptAt : first.nextAttemptAt);
    const readings = [];
    const clock = () => {
      const reading = new Date(start.getTime() + readings.length * 2 * 60 * 1000);
      readings.push(reading);
      return reading;
    };

    const summary = await withMail(refusedSmtp, () => runEmailOutbox({ clock, keys }));
    expect(summary).toMatchObject({ claimed: 2, retrying: 2 });

    // Reading order: claim 1, backoff 1, claim 2, backoff 2. The second
    // attempt waits 5 minutes from the moment it failed.
    const retryWait = 5 * 60 * 1000;
    const a = await outboxRow(first.idempotencyKey);
    const b = await outboxRow(second.idempotencyKey);
    expect(readings).toHaveLength(4);
    expect(a).toMatchObject({ status: 'pending', attempts: 2 });
    expect(b).toMatchObject({ status: 'pending', attempts: 2 });
    expect(a.claimedAt.getTime()).toBe(readings[0].getTime());
    expect(a.nextAttemptAt.getTime()).toBe(readings[1].getTime() + retryWait);
    expect(b.claimedAt.getTime()).toBe(readings[2].getTime());
    expect(b.nextAttemptAt.getTime()).toBe(readings[3].getTime() + retryWait);
  });

  it('deletes sent and cancelled emails 30 days after they settle and failed ones after 90, and nothing sooner', async () => {
    const { admin } = await staffPair();
    const now = new Date();
    const sentCutoff = now.getTime() - SENT_RETENTION_MS;
    const failedCutoff = now.getTime() - FAILED_RETENTION_MS;
    const tag = uid();
    const make = (name, status, updatedAt) =>
      prisma.emailOutbox.create({
        data: {
          idempotencyKey: `retention:${tag}:${name}`,
          recipientId: admin.id,
          templateKey: 'staffTicket',
          payload: { ticketId: 1, category: 'retention', filedBy: 'nobody' },
          status,
          updatedAt: new Date(updatedAt),
        },
      });
    const rows = {
      sentOld: await make('sentOld', 'sent', sentCutoff - 1),
      sentAtCutoff: await make('sentAtCutoff', 'sent', sentCutoff),
      cancelledOld: await make('cancelledOld', 'cancelled', sentCutoff - 1),
      cancelledAtCutoff: await make('cancelledAtCutoff', 'cancelled', sentCutoff),
      failedPastSentWindow: await make('failedPastSentWindow', 'failed', sentCutoff - 1),
      failedOld: await make('failedOld', 'failed', failedCutoff - 1),
      failedAtCutoff: await make('failedAtCutoff', 'failed', failedCutoff),
      pendingAncient: await make('pendingAncient', 'pending', failedCutoff - 1),
      sendingAncient: await make('sendingAncient', 'sending', failedCutoff - 1),
    };
    const remaining = async () =>
      (
        await prisma.emailOutbox.findMany({
          where: { idempotencyKey: { startsWith: `retention:${tag}:` } },
          select: { idempotencyKey: true },
        })
      )
        .map(row => row.idempotencyKey.split(':')[2])
        .sort();
    const kept = [
      'cancelledAtCutoff',
      'failedAtCutoff',
      'failedPastSentWindow',
      'pendingAncient',
      'sendingAncient',
      'sentAtCutoff',
    ];

    const summary = await purgeSettledEmails(now);
    expect(summary.emailsDeleted).toBeGreaterThanOrEqual(3);
    expect(await remaining()).toEqual(kept);

    // Idempotent: the same clock deletes nothing more of these.
    await purgeSettledEmails(now);
    expect(await remaining()).toEqual(kept);
    expect(Object.keys(rows)).toHaveLength(9);
  });

  it('purges old emails in the nightly staff retention job', async () => {
    const { admin } = await staffPair();
    const key = `retention:${uid()}:job`;
    await prisma.emailOutbox.create({
      data: {
        idempotencyKey: key,
        recipientId: admin.id,
        templateKey: 'staffTicket',
        payload: { ticketId: 1, category: 'retention', filedBy: 'nobody' },
        status: 'sent',
        updatedAt: new Date(Date.now() - SENT_RETENTION_MS - 60 * 60 * 1000),
      },
    });

    const summary = await cronJobService.purgeStaleStaffCheckins();

    expect(summary.emailsDeleted).toBeGreaterThanOrEqual(1);
    expect(await outboxRow(key)).toBeNull();
  });

  it("stops naming an erased filer in their tickets' emails, leaving other filers' emails alone", async () => {
    const { admin, mod, modDevice } = await staffPair();
    const other = await makeUser('moderator');
    const otherDevice = await checkIn(other);
    const { ticket, row } = await fileWhileSmtpRefuses(admin, mod, modDevice);
    // Erasure clears filedById, so teardown finds this ticket by id.
    erasedFilerTickets.push(ticket.id);
    const { row: otherRow } = await fileWhileSmtpRefuses(admin, other, otherDevice);
    expect(row.payload.filedBy).toBe(mod.username);

    expect(await eraseUserAccount(mod.id)).toEqual({ deleted: true });

    const scrubbed = await outboxRow(row.idempotencyKey);
    expect(scrubbed.payload).toEqual({ ticketId: ticket.id, category: 'Needs the admin', filedBy: FORMER_STEWARD });
    expect(scrubbed.updatedAt.getTime()).toBe(row.updatedAt.getTime());
    expect(JSON.stringify(scrubbed)).not.toContain(mod.username);
    expect((await outboxRow(otherRow.idempotencyKey)).payload.filedBy).toBe(other.username);

    // The erased filer's ticket email still goes, naming a former steward.
    await runEmailOutbox({ clock: at(justAfter(row.nextAttemptAt)), keys: [row.idempotencyKey] });
    const [email] = capturedTicketEmailsFor(admin.email);
    expect(email.preview).toContain(FORMER_STEWARD);
    expect(email.preview).not.toContain(mod.username);
  });
});
