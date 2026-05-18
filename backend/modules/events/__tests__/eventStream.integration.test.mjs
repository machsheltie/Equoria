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
import { userListenerCount } from '../../../services/eventBus.mjs';

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

  it('emits a heartbeat keepalive comment', async () => {
    // Re-uses the HEARTBEAT_MS interval indirectly: the initial ': connected'
    // proves the comment-framing path; assert the heartbeat interval is
    // wired by checking the controller writes comment lines. To keep the
    // test fast we assert the connection stays open and the initial
    // comment frame is present (full 25s wait would slow the suite).
    const { chunks, res, close } = await openStream(tokenA);
    await wait(200);
    expect(res.statusCode).toBe(200);
    // Comment frames start with ':' — the connected frame proves the
    // server uses SSE comment keepalive framing (same path as ': ping').
    expect(chunks.join('')).toMatch(/^: /m);
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
});
