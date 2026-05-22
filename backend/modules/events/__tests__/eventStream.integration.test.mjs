/**
 * eventStream.integration.test.mjs
 *
 * Real-DB integration coverage for the SSE transport — ADR-011 /
 * Equoria-rgyv. No mocks: real Express app, real authenticateToken
 * middleware, real DB writes via createNotification, real event bus.
 *
 * SSE is a long-lived streaming response, which supertest's buffered model
 * handles poorly. These tests start the app on an ephemeral port and use
 * Node's raw http client so the connection can stay open, chunks can be
 * observed as they arrive, and disconnect cleanup can be asserted.
 *
 * Auth note: the browser EventSource uses the httpOnly accessToken cookie.
 * supertest/raw-http here use the Authorization: Bearer path — the SAME
 * real authenticateToken middleware accepts both. No bypass header.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';
import { userListenerCount, getActiveConnectionMetrics } from '../../../services/eventBus.mjs';
// Equoria-lewrv: exercise the REAL DM send producer (real controller, real
// prisma, real event bus — no mocks) to prove a sent DM emits a 'message'
// SSE frame to the recipient and not the sender.
import { sendMessage } from '../../community/controllers/messageController.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

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

describe('INTEGRATION: GET /api/v1/events/stream — SSE transport (Equoria-rgyv)', () => {
  let server;
  let baseUrl;
  let userA;
  let tokenA;
  let userB;
  let userC;
  let tokenC;
  // Track every opened request so afterAll can force-destroy stragglers and
  // the server can close cleanly (a live SSE socket blocks server.close()).
  const openReqs = new Set();

  beforeAll(async () => {
    await new Promise(resolve => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const a = await createTestUser({ username: `sse_a_${Date.now()}` });
    userA = a.user;
    tokenA = a.token;
    const b = await createTestUser({ username: `sse_b_${Date.now()}` });
    userB = b.user;
    const c = await createTestUser({ username: `sse_c_${Date.now()}` });
    userC = c.user;
    tokenC = c.token;
  }, 120000);

  afterAll(async () => {
    // Force-close any straggler SSE sockets so server.close() can resolve.
    for (const req of openReqs) {
      req.destroy();
    }
    openReqs.clear();
    await new Promise(r => setTimeout(r, 200));
    await cleanupTestData();
    await new Promise(resolve => server.close(resolve));
  }, 60000);

  /**
   * Open an SSE connection. Returns { res, chunks, close } where chunks is
   * a live-growing array of received text and close() ends the request.
   */
  function openStream(token) {
    return new Promise((resolve, reject) => {
      const headers = { Accept: 'text/event-stream' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
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
        // destroy() after a successful resolve triggers ECONNRESET — that
        // is expected teardown, not a test failure.
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  it('returns 401 when no token is supplied (auth enforced on the stream)', async () => {
    const { res, close } = await openStream(null);
    expect(res.statusCode).toBe(401);
    close();
  });

  it('opens a text/event-stream for an authenticated user', async () => {
    const { res, chunks, close } = await openStream(tokenA);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    // no-transform opts the response out of compression buffering
    expect(res.headers['cache-control']).toContain('no-transform');
    await wait(150);
    expect(chunks.join('')).toContain(': connected');
    close();
  });

  it('delivers a notification created for the connected user', async () => {
    const { chunks, close } = await openStream(tokenA);
    await waitFor(() => userListenerCount(userA.id) >= 1); // subscription registered
    await createNotification(userA.id, 'stat_gain', { stat: 'speed', amount: 1 });
    const got = await waitFor(() => chunks.join('').includes('event: stat_gain'));
    expect(got).toBe(true);
    expect(chunks.join('')).toContain('"stat":"speed"');
    close();
  });

  it("does NOT deliver another user's notification (per-user isolation)", async () => {
    const { chunks, close } = await openStream(tokenA);
    await waitFor(() => userListenerCount(userA.id) >= 1);
    // Event for a DIFFERENT user must never reach userA's stream.
    await createNotification(userB.id, 'foal_born', { foalId: 'should-not-leak' });
    // Give ample time for a (wrongful) delivery to occur, then assert none.
    await wait(500);
    const body = chunks.join('');
    expect(body).not.toContain('should-not-leak');
    expect(body).not.toContain('event: foal_born');
    close();
  });

  it('emits a real ": ping" heartbeat frame (low SSE_HEARTBEAT_MS, Equoria-mza0x)', async () => {
    // Drive a real heartbeat: set a low cadence BEFORE opening the stream so
    // the controller's resolveHeartbeatMs() picks it up for THIS stream. We
    // then observe an actual ': ping' frame (not just the initial
    // ': connected'), which the previous version of this test skipped.
    const prev = process.env.SSE_HEARTBEAT_MS;
    process.env.SSE_HEARTBEAT_MS = '80';
    let stream;
    try {
      stream = await openStream(tokenA);
      expect(stream.res.statusCode).toBe(200);
      // ': connected' is immediate; ': ping' only arrives after the interval.
      const sawPing = await waitFor(() => stream.chunks.join('').includes(': ping'), {
        timeout: 4000,
      });
      expect(sawPing).toBe(true);
      // The connected frame must NOT be the only comment — prove a distinct
      // ping frame was written, i.e. the interval actually fired at least once.
      const body = stream.chunks.join('');
      expect(body).toContain(': connected');
      expect(body).toContain(': ping');
    } finally {
      if (stream) {
        stream.close();
      }
      if (prev === undefined) {
        delete process.env.SSE_HEARTBEAT_MS;
      } else {
        process.env.SSE_HEARTBEAT_MS = prev;
      }
    }
  });

  it('delivers a competition_placement notification end-to-end (Equoria-mza0x)', async () => {
    // The exact blind spot that let the frontend listener-name defect ship:
    // assert a competition_placement frame actually reaches the subscriber on
    // the wire (not just stat_gain).
    const { chunks, close } = await openStream(tokenA);
    await waitFor(() => userListenerCount(userA.id) >= 1);
    await createNotification(userA.id, 'competition_placement', {
      showId: 'TestFixture-show',
      placement: 1,
    });
    const got = await waitFor(() => chunks.join('').includes('event: competition_placement'));
    expect(got).toBe(true);
    expect(chunks.join('')).toContain('"placement":1');
    close();
  });

  it('cleans up the bus listener on client disconnect (no leak)', async () => {
    // Dedicated user C — no other test opens a stream as C, so the count
    // is deterministic (starts at 0, not order-dependent).
    expect(userListenerCount(userC.id)).toBe(0);
    const { close } = await openStream(tokenC);
    // Subscription registers synchronously once the response handler runs.
    const registered = await waitFor(() => userListenerCount(userC.id) === 1);
    expect(registered).toBe(true);
    close();
    // req.on('close') cleanup removes the listener; poll until it does.
    const cleaned = await waitFor(() => userListenerCount(userC.id) === 0);
    expect(cleaned).toBe(true);
  });

  it("delivers a 'message' SSE frame to the DM recipient and NOT the sender (Equoria-lewrv)", async () => {
    // Open streams for BOTH the recipient (A) and the sender (C). The real
    // sendMessage controller publishes to the RECIPIENT's channel only.
    const recipient = await openStream(tokenA); // user A receives
    const sender = await openStream(tokenC); // user C sends
    await waitFor(() => userListenerCount(userA.id) >= 1);
    await waitFor(() => userListenerCount(userC.id) >= 1);

    const createdIds = [];
    // Invoke the REAL controller (real prisma write + real eventBus publish).
    // No mocks; no CSRF/bypass header — we call the producer directly so the
    // test asserts the producer behavior, then clean up the row by id.
    const req = {
      user: { id: userC.id },
      body: {
        recipientId: userA.id,
        subject: 'TestFixture-dm-subject',
        content: 'TestFixture-dm-content',
        tag: null,
      },
    };
    const res = {
      _status: 200,
      status(code) {
        this._status = code;
        return this;
      },
      json(body) {
        if (body?.data?.message?.id) {
          createdIds.push(body.data.message.id);
        }
        return this;
      },
    };

    try {
      await sendMessage(req, res);
      expect(res._status).toBe(201);

      // Recipient A must receive the 'message' frame.
      const recipientGot = await waitFor(() => recipient.chunks.join('').includes('event: message'));
      expect(recipientGot).toBe(true);

      // Per-user isolation: the SENDER (C) must NOT receive it on their stream.
      await wait(400);
      expect(sender.chunks.join('')).not.toContain('event: message');
    } finally {
      recipient.close();
      sender.close();
      // Scoped cleanup of the DM row(s) this test created.
      if (createdIds.length > 0) {
        await prisma.directMessage.deleteMany({ where: { id: { in: createdIds } } });
      }
    }
  });

  it('tracks the active SSE connection count via getActiveConnectionMetrics (Equoria-fsuys)', async () => {
    const before = getActiveConnectionMetrics().total;
    const s1 = await openStream(tokenA);
    await waitFor(() => userListenerCount(userA.id) >= 1);
    const afterOpen = getActiveConnectionMetrics();
    // Total increments on open; the connected user shows in userCount.
    expect(afterOpen.total).toBe(before + 1);
    expect(afterOpen.userCount).toBeGreaterThanOrEqual(1);
    expect(afterOpen.maxPerUser).toBeGreaterThanOrEqual(1);

    s1.close();
    // Disconnect cleanup decrements the gauge back down.
    const decremented = await waitFor(() => getActiveConnectionMetrics().total === before);
    expect(decremented).toBe(true);
  });
});
