/**
 * Shared real-HTTP fixtures for staff integration suites (Equoria-puj1e.1).
 *
 * Staff users are real rows; check-in goes through the real routes, with the
 * code read back from the email service's own non-production sink
 * (EMAIL_CAPTURE_FILE). Nothing is mocked.
 */

import crypto from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { expect } from '@jest/globals';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { whenTicketEmailKicksFinish } from '../../services/ticketEmailOutbox.mjs';
import { testHorseData } from '../../../../__tests__/helpers/createTestHorse.mjs';

export const ORIGIN = 'http://localhost:3000';
export const STAFF_API = '/api/v1/staff';

export const uid = () => crypto.randomBytes(5).toString('hex');
export const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

let captureFile = null;

/** Point the email sink at a fresh file. Call from beforeEach. */
export function startEmailCapture() {
  captureFile = path.join(
    os.tmpdir(),
    `staff-checkin-${crypto.randomBytes(8).toString('hex')}.jsonl`,
  );
  process.env.EMAIL_CAPTURE_FILE = captureFile;
}

/** Remove the sink file. Call from afterEach. */
export function stopEmailCapture() {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
}

/**
 * Fixture-user factory. `createdUserIds` is the array to scope cleanup by.
 * @param {string} prefix e.g. 'staffmfa'
 */
export function createUserFactory(prefix) {
  const createdUserIds = [];
  async function makeUser(role, extra = {}) {
    const suffix = `${uid()}${uid()}`;
    const row = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@test.com`,
        username: `${prefix}${suffix}`,
        password: 'not-a-real-hash',
        firstName: 'Staff',
        lastName: 'Fixture',
        role,
        settings: {},
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ...extra,
      },
    });
    createdUserIds.push(row.id);
    return { ...row, token: generateTestToken({ id: row.id, email: row.email, role }) };
  }
  return { makeUser, createdUserIds };
}

/**
 * Real horse, show and forum-post rows for ticket targets (STAFF-CR-07).
 * `owner` is an ordinary user row; `removeTargets` deletes only what this
 * factory made and must run before that owner is deleted.
 */
export function createTargetFactory(prefix) {
  const made = { horse: [], show: [], thread: [] };
  async function makeHorse(owner) {
    const row = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-${prefix}-${uid()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        userId: owner.id,
      }),
    });
    made.horse.push(row.id);
    return row;
  }
  async function makeShow() {
    const row = await prisma.show.create({
      data: {
        name: `TestFixture-${prefix}-${uid()}${uid()}`,
        discipline: 'Dressage',
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        prize: 100,
        entryFee: 10,
        levelMin: 1,
        levelMax: 10,
        status: 'open',
      },
    });
    made.show.push(row.id);
    return row;
  }
  async function makePost(owner) {
    const thread = await prisma.forumThread.create({
      data: { section: 'general', title: `TestFixture-${prefix}-${uid()}`, authorId: owner.id },
    });
    made.thread.push(thread.id);
    return prisma.forumPost.create({
      data: { threadId: thread.id, authorId: owner.id, content: 'fixture post' },
    });
  }
  async function removeTargets() {
    // Posts cascade from their threads.
    await prisma.forumThread.deleteMany({ where: { id: { in: made.thread } } });
    await prisma.horse.deleteMany({ where: { id: { in: made.horse } } });
    await prisma.show.deleteMany({ where: { id: { in: made.show } } });
  }
  return { makeHorse, makeShow, makePost, removeTargets };
}

export const cookiesFor = (user, device) =>
  device ? [`accessToken=${user.token}`, `staff_device=${device}`] : [`accessToken=${user.token}`];

export const get = (url, user, device) =>
  request(app).get(url).set('Origin', ORIGIN).set('Cookie', cookiesFor(user, device));

export async function post(url, user, body = {}, device) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(user, device) });
  return request(app)
    .post(url)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

export function capturedFor(email) {
  if (!captureFile || !existsSync(captureFile)) {
    return [];
  }
  return readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-checkin' && entry.to === email);
}

/** Staff-ticket alerts the email service captured for this address. */
export function capturedTicketEmailsFor(email) {
  if (!captureFile || !existsSync(captureFile)) {
    return [];
  }
  return readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-ticket' && entry.to === email);
}

/**
 * A ticket's email-outbox rows once the post-commit delivery has finished
 * (STAFF-CR-10): none still waiting for its first attempt or mid-send.
 *
 * A filing mails every verified admin and owner in the database, one row at a
 * time, and under load each row can take a second or more (Equoria-8iy6k), so
 * no fixed deadline can say when that loop is done. Called without a timeout,
 * this waits for the deliveries themselves to finish
 * (whenTicketEmailKicksFinish) and then checks the rows once: a row still
 * unsettled after its delivery ended is a real defect and fails at once, with
 * no clock involved. A caller that is deliberately holding a delivery open
 * (the silent mail server) passes a short timeout and gets the polling wait.
 */
export async function settledTicketEmails(ticketId, timeoutMs = null) {
  if (timeoutMs === null) {
    await whenTicketEmailKicksFinish();
  }
  const deadline = timeoutMs === null ? null : Date.now() + timeoutMs;
  for (;;) {
    const rows = await prisma.emailOutbox.findMany({
      where: { idempotencyKey: { startsWith: `staffTicket:${ticketId}:` } },
      orderBy: { id: 'asc' },
    });
    const inFlight = rows.some(
      row => row.status === 'sending' || (row.status === 'pending' && row.attempts === 0),
    );
    if (!inFlight) {
      return rows;
    }
    if (deadline === null) {
      throw new Error(`ticket ${ticketId} email left unsettled after its delivery finished`);
    }
    if (Date.now() > deadline) {
      throw new Error(`ticket ${ticketId} email still in flight after ${timeoutMs} ms`);
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

/**
 * Test teardown: the outbox rows of the tickets matching `ticketWhere`,
 * whoever they were addressed to (an admin left by another suite included).
 * Waits first for each ticket's post-commit delivery to finish, so nothing of
 * it runs after the suite. Run it before those tickets are deleted.
 */
export async function removeTicketEmails(ticketWhere) {
  const tickets = await prisma.staffTicket.findMany({ where: ticketWhere, select: { id: true } });
  for (const ticket of tickets) {
    await settledTicketEmails(ticket.id);
  }
  await prisma.emailOutbox.deleteMany({
    where: { OR: tickets.map(t => ({ idempotencyKey: { startsWith: `staffTicket:${t.id}:` } })) },
  });
}

export function latestCode(email) {
  const entry = capturedFor(email).at(-1);
  if (!entry) {
    throw new Error(`No staff-checkin email captured for ${email}`);
  }
  return entry.preview.match(/\b(\d{6})\b/)[1];
}

export const wrongCodeFor = code => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

export function deviceCookieFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find(c => c.startsWith('staff_device='));
  return raw ?? null;
}

/** Full real check-in for a user; returns the raw device token. */
export async function checkIn(user) {
  expect((await post(`${STAFF_API}/checkin/request`, user)).status).toBe(202);
  const res = await post(`${STAFF_API}/checkin/verify`, user, { code: latestCode(user.email) });
  expect(res.status).toBe(200);
  const cookie = deviceCookieFrom(res);
  expect(cookie).not.toBeNull();
  return cookie.split(';')[0].slice('staff_device='.length);
}

/**
 * Fetch a CSRF pair now and return a thunk that sends the POST later, so
 * racing requests leave together instead of each waiting on its CSRF fetch.
 */
export async function preparePost(url, user, body = {}, device) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(user, device) });
  return () =>
    request(app)
      .post(url)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
}

/**
 * Race requests against the real database. `lock(tx)` takes row locks in a
 * real transaction; the starters are then launched one at a time, each only
 * once every earlier one has either settled or is queued on a lock
 * (pg_stat_activity). When all are settled or queued the holder commits and
 * releases them together. The holder polls inside its own transaction (the
 * test pool has three connections, which the queued requests may hold).
 * @param {(tx: object) => Promise<unknown>} lock
 * @param {Array<() => Promise<object>>} starters each sends one request
 * @returns {Promise<object[]>} the responses, in starter order
 */
export async function raceUnderLock(lock, starters, timeoutMs = 20_000) {
  const tracked = [];
  await prisma.$transaction(
    async tx => {
      await lock(tx);
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        // pg_stat_activity is snapshotted once per transaction; refresh it.
        await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
        // Count only the sessions queued behind THIS holder, directly or behind
        // another queued starter. Any lock wait in the database would also
        // count a wait from another Jest worker's test, letting a starter run
        // to completion before the next one leaves (Equoria-8kbfl).
        const [{ n }] = await tx.$queryRaw`
          WITH RECURSIVE queued(pid) AS (
            SELECT pid FROM pg_stat_activity
            WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))
            UNION
            SELECT a.pid FROM pg_stat_activity a
            JOIN queued q ON q.pid = ANY(pg_blocking_pids(a.pid))
          )
          SELECT count(*)::int AS n FROM queued`;
        const settled = tracked.filter(t => t.settled).length;
        if (n + settled >= tracked.length) {
          if (tracked.length === starters.length) {
            return;
          }
          const send = starters[tracked.length];
          const state = { settled: false };
          // A supertest request is thenable but not a Promise.
          state.done = Promise.resolve(send()).finally(() => {
            state.settled = true;
          });
          tracked.push(state);
        } else if (Date.now() > deadline) {
          throw new Error(`only ${n} queued and ${settled} settled of ${tracked.length} started`);
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    },
    { timeout: timeoutMs + 10_000 },
  );
  return Promise.all(tracked.map(t => t.done));
}
