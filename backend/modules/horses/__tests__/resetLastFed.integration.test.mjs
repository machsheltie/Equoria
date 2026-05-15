/**
 * resetLastFed.integration.test.mjs — Equoria-4sqr
 *
 * Tests the owner-scoped POST /api/v1/horses/:id/reset-last-fed endpoint
 * used by feed-system-phase-b E2E test 2 to satisfy both the critical-health
 * breeding gate (Equoria-2e7e) and the same-day feed gate.
 *
 * Coverage:
 *   - 200 with default days=1 rewinds lastFedDate by 1 day for an owned horse
 *   - 200 with explicit days=2 rewinds by 2 days
 *   - 400 for negative days
 *   - 400 for days > 30
 *   - 401 when no Authorization header
 *   - 404 when querying another user's horse (IDOR contract)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-reset-last-fed';

let ownerA;
let tokenA;
let ownerB;
let horseA;
let horseB;
let csrf;

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-A-${tag}`,
    email: `${FIXTURE_PREFIX}-A-${tag}@example.com`,
  });
  ownerA = a.user;
  tokenA = a.token;

  const b = await createTestUser({
    username: `${FIXTURE_PREFIX}-B-${tag}`,
    email: `${FIXTURE_PREFIX}-B-${tag}@example.com`,
  });
  ownerB = b.user;

  horseA = await createTestHorse({
    name: `${FIXTURE_PREFIX}-HorseA-${tag}`,
    userId: ownerA.id,
    lastFedDate: new Date(),
  });

  horseB = await createTestHorse({
    name: `${FIXTURE_PREFIX}-HorseB-${tag}`,
    userId: ownerB.id,
    lastFedDate: new Date(),
  });

  // Fetch a real CSRF token + cookie pair for state-mutating requests.
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('POST /api/v1/horses/:id/reset-last-fed (Equoria-4sqr)', () => {
  it('default days=1 rewinds lastFedDate by 1 day for the owner', async () => {
    const before = new Date();
    const res = await request(app)
      .post(`/api/v1/horses/${horseA.id}/reset-last-fed`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.lastFedDate).toBeTruthy();
    const newLastFed = new Date(res.body.data.lastFedDate);
    expect(Number.isNaN(newLastFed.getTime())).toBe(false);
    // Should be at least 23h before "before" (rewound 1 day).
    const diffMs = before.getTime() - newLastFed.getTime();
    expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('explicit days=2 rewinds by 2 days', async () => {
    const before = new Date();
    const res = await request(app)
      .post(`/api/v1/horses/${horseA.id}/reset-last-fed`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ days: 2 });

    expect(res.status).toBe(200);
    if (!res.body.data?.lastFedDate) {
      console.error('Unexpected response body:', JSON.stringify(res.body));
    }
    expect(res.body.data?.lastFedDate).toBeTruthy();
    const newLastFed = new Date(res.body.data.lastFedDate);
    const diffMs = before.getTime() - newLastFed.getTime();
    expect(diffMs).toBeGreaterThan(47 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(49 * 60 * 60 * 1000);
  });

  it('returns 400 for negative days', async () => {
    const res = await request(app)
      .post(`/api/v1/horses/${horseA.id}/reset-last-fed`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ days: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/days must be/i);
  });

  it('returns 400 for days > 30', async () => {
    const res = await request(app)
      .post(`/api/v1/horses/${horseA.id}/reset-last-fed`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ days: 100 });

    expect(res.status).toBe(400);
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app)
      .post(`/api/v1/horses/${horseA.id}/reset-last-fed`)
      .set('Origin', 'http://localhost:3000')
      .send({});

    expect(res.status).toBe(401);
  });

  it("returns 404 when user A targets user B's horse (IDOR contract)", async () => {
    const res = await request(app)
      .post(`/api/v1/horses/${horseB.id}/reset-last-fed`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // Silence "unused after fixture creation" lint noise.
  it('ownerB exists (fixture sanity)', () => {
    expect(ownerB).toBeTruthy();
  });
});
