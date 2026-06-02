/**
 * clubLeadershipSseProducer.integration.test.mjs (Equoria-pwwuz, ADR-011)
 *
 * Real-DB integration coverage for the club leadership-transfer SSE producer
 * added to clubController.transferLeadership. No mocks: real Express app, real
 * prisma writes, real event bus, real notificationService. Mirrors the
 * forum-reply producer coverage (forumReplySseProducer.integration.test.mjs,
 * Equoria-pwwuz) and the DM 'message' producer coverage
 * (modules/events/__tests__/eventStream.integration.test.mjs, Equoria-lewrv).
 *
 * transferLeadership is the ONE club event with a single, well-defined
 * recipient: the member promoted to president by ANOTHER user's action
 * (analogous to a forum reply on your thread / a DM to you). The producer uses
 * createNotification, which writes a durable Notification DB row AND emits the
 * SSE frame, so this test asserts BOTH the live frame and the persisted row.
 *
 * Asserts:
 *   1. transferLeadership by the current president emits an
 *      `event: club_leadership_transferred` frame on the PROMOTED member's
 *      SSE stream;
 *   2. the PREVIOUS president does NOT receive it on their own stream
 *      (per-user isolation — the producer publishes to the new president only);
 *   3. a durable Notification row (type 'club_leadership_transferred') is
 *      persisted for the promoted member (createNotification source-of-truth).
 *
 * SSE is a long-lived streaming response; supertest's buffered model handles
 * it poorly, so the app runs on an ephemeral port and Node's raw http client
 * observes chunks as they arrive (same harness as forumReplySseProducer).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { userListenerCount } from '../../../services/eventBus.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
// Exercise the REAL leadership-transfer producer (real controller, real prisma,
// real bus, real notificationService).
import { transferLeadership } from '../controllers/clubController.mjs';

/** Poll until predicate true or timeout — avoids order-dependent fixed waits. */
async function waitFor(predicate, { timeout = 4000, interval = 50 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate()) {
      return true;
    }
    if (Date.now() - start > timeout) {
      return false;
    }
    await new Promise(r => setTimeout(r, interval));
  }
}

describe('INTEGRATION: club leadership-transfer SSE producer (Equoria-pwwuz)', () => {
  let server;
  let baseUrl;
  let president; // current president, initiates the transfer
  let presidentToken;
  let promoted; // member promoted to president
  let promotedToken;
  let club;
  const openReqs = new Set();
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    president = await prisma.user.create({
      data: {
        email: `pwwuz-pres-${randomBytes(4).toString('hex')}@test.com`,
        username: `pwwuzPres${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Club',
        lastName: 'President',
      },
    });
    promoted = await prisma.user.create({
      data: {
        email: `pwwuz-promoted-${randomBytes(4).toString('hex')}@test.com`,
        username: `pwwuzPromoted${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Club',
        lastName: 'Member',
      },
    });
    presidentToken = generateTestToken({ id: president.id, email: president.email, role: 'user' });
    promotedToken = generateTestToken({ id: promoted.id, email: promoted.email, role: 'user' });

    club = await prisma.club.create({
      data: {
        name: `TestFixture-pwwuz-club-${randomBytes(4).toString('hex')}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'TestFixture-pwwuz leadership transfer club',
        leaderId: president.id,
        members: {
          create: [
            { userId: president.id, role: 'president' },
            { userId: promoted.id, role: 'member' },
          ],
        },
      },
    });
  }, 60000);

  afterAll(async () => {
    for (const req of openReqs) {
      req.destroy();
    }
    openReqs.clear();
    await new Promise(r => setTimeout(r, 200));
    // Scoped, fail-loud cleanup (Equoria-1ohys) — only the rows this suite
    // created. FK order: notifications (FK to user) and memberships (FK to
    // club + user) before the club, club before the two users.
    cleanup.add(
      () => prisma.notification.deleteMany({ where: { userId: { in: [president.id, promoted.id] } } }),
      'notification',
    );
    cleanup.add(() => prisma.clubMembership.deleteMany({ where: { clubId: club.id } }), 'clubMembership');
    cleanup.add(() => prisma.club.deleteMany({ where: { id: club.id } }), 'club');
    cleanup.add(() => prisma.user.delete({ where: { id: president.id } }), 'user:president');
    cleanup.add(() => prisma.user.delete({ where: { id: promoted.id } }), 'user:promoted');
    await cleanup.run();
    await new Promise(resolve => server.close(resolve));
  }, 60000);

  function openStream(token) {
    return new Promise((resolve, reject) => {
      const headers = { Accept: 'text/event-stream', Authorization: `Bearer ${token}` };
      const req = http.get(`${baseUrl}/api/v1/events/stream`, { headers }, res => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', d => chunks.push(d));
        resolve({
          res,
          chunks,
          close: () => {
            req.destroy();
            openReqs.delete(req);
          },
        });
      });
      openReqs.add(req);
      req.on('error', err => {
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /** Invoke the real transferLeadership controller with a minimal req/res double. */
  async function doTransfer(actingUserId, newPresidentId) {
    const req = {
      params: { id: String(club.id) },
      body: { newPresidentId },
      user: { id: actingUserId },
    };
    let status = 200;
    let body;
    const res = {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    await transferLeadership(req, res);
    return { status, body };
  }

  it("emits 'club_leadership_transferred' to the promoted member, NOT the previous president, and persists a Notification row", async () => {
    const promotedStream = await openStream(promotedToken);
    const presidentStream = await openStream(presidentToken);
    await waitFor(() => userListenerCount(promoted.id) >= 1);
    await waitFor(() => userListenerCount(president.id) >= 1);

    try {
      const { status } = await doTransfer(president.id, promoted.id);
      expect(status).toBe(200);

      // The promoted member MUST receive the live frame.
      const promotedGot = await waitFor(() =>
        promotedStream.chunks.join('').includes('event: club_leadership_transferred'),
      );
      expect(promotedGot).toBe(true);
      expect(promotedStream.chunks.join('')).toContain(`"clubId":${club.id}`);

      // The previous president must NOT receive it on their own stream
      // (per-user isolation — single recipient is the new president only).
      await wait(400);
      expect(presidentStream.chunks.join('')).not.toContain('event: club_leadership_transferred');

      // createNotification is the source of truth: a durable Notification row
      // must exist for the promoted member with the correct type + payload.
      const rows = await prisma.notification.findMany({
        where: { userId: promoted.id, type: 'club_leadership_transferred' },
      });
      expect(rows.length).toBe(1);
      expect(rows[0].payload).toMatchObject({
        clubId: club.id,
        previousPresidentId: president.id,
      });
    } finally {
      promotedStream.close();
      presidentStream.close();
    }
  });
});
