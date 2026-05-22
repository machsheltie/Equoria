/**
 * Admin SSE active-connection metrics endpoint — real-DB integration
 * (Equoria-fsuys, ADR-011 "connection-count monitoring is a future concern").
 *
 * GET /api/v1/admin/sse/metrics returns the current open-SSE-connection
 * gauge (total + distinct-user count + heaviest single user). This lets an
 * operator detect a connection leak or runaway fan-out. This suite proves:
 *   (a) admin sees a numeric snapshot,
 *   (b) the total INCREASES while an SSE stream is open and returns to
 *       baseline after disconnect (the gauge reflects reality, not a stub),
 *   (c) the endpoint is admin-gated (non-admin → 403).
 *
 * No mocks. Real Express app, real DB, real JWT. The SSE stream is opened
 * over raw http (same approach as eventStream.integration.test.mjs) so the
 * connection can stay open while the metric is read.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import http from 'node:http';
import app from '../../../app.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { userListenerCount } from '../../../services/eventBus.mjs';

const ROUTE = '/api/v1/admin/sse/metrics';

async function waitFor(predicate, { timeout = 4000, interval = 50 } = {}) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await predicate()) {
      return true;
    }
    if (Date.now() - start > timeout) {
      return false;
    }
    await new Promise(r => setTimeout(r, interval));
  }
}

describe('Admin SSE metrics endpoint (Equoria-fsuys)', () => {
  let server;
  let baseUrl;
  let streamUser;
  let streamToken;
  let adminToken;
  let nonAdminToken;
  const openReqs = new Set();

  beforeAll(async () => {
    await new Promise(resolve => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const s = await createTestUser({ username: `sse_metrics_stream_${Date.now()}` });
    streamUser = s.user;
    streamToken = s.token;
    const admin = await createTestUser({ username: `sse_metrics_admin_${Date.now()}` });
    adminToken = generateTestToken({ id: admin.user.id, role: 'admin' });
    const nonAdmin = await createTestUser({ username: `sse_metrics_user_${Date.now()}` });
    nonAdminToken = generateTestToken({ id: nonAdmin.user.id, role: 'user' });
  }, 120000);

  afterAll(async () => {
    for (const req of openReqs) {
      req.destroy();
    }
    openReqs.clear();
    await new Promise(r => setTimeout(r, 200));
    await cleanupTestData();
    await new Promise(resolve => server.close(resolve));
  }, 60000);

  function openStream(token) {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `${baseUrl}/api/v1/events/stream`,
        { headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` } },
        res => {
          res.setEncoding('utf8');
          res.on('data', () => {});
          resolve({
            res,
            close: () => {
              req.destroy();
              openReqs.delete(req);
            },
          });
        },
      );
      openReqs.add(req);
      req.on('error', err => {
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  }

  it('returns 403 for a non-admin user', async () => {
    const res = await request(app).get(ROUTE).set('Authorization', `Bearer ${nonAdminToken}`);
    expect(res.status).toBe(403);
  });

  it('admin reads a numeric snapshot that rises while a stream is open and falls after disconnect', async () => {
    const before = await request(app).get(ROUTE).set('Authorization', `Bearer ${adminToken}`);
    expect(before.status).toBe(200);
    expect(before.body.success).toBe(true);
    expect(typeof before.body.data.total).toBe('number');
    expect(typeof before.body.data.userCount).toBe('number');
    expect(typeof before.body.data.maxPerUser).toBe('number');
    const baseTotal = before.body.data.total;

    const stream = await openStream(streamToken);
    await waitFor(() => userListenerCount(streamUser.id) >= 1);

    const during = await request(app).get(ROUTE).set('Authorization', `Bearer ${adminToken}`);
    expect(during.status).toBe(200);
    expect(during.body.data.total).toBe(baseTotal + 1);
    expect(during.body.data.userCount).toBeGreaterThanOrEqual(1);
    expect(during.body.data.maxPerUser).toBeGreaterThanOrEqual(1);

    stream.close();
    // Disconnect cleanup decrements the gauge — proves it is a live gauge,
    // not a stub, and that a leak (stuck count) would be observable.
    const fellBack = await waitFor(async () => {
      const r = await request(app).get(ROUTE).set('Authorization', `Bearer ${adminToken}`);
      return r.body?.data?.total === baseTotal;
    });
    expect(fellBack).toBe(true);
  });
});
