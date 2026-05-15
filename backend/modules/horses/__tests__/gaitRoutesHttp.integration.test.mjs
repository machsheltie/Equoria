/**
 * gaitRoutesHttp.integration.test.mjs
 *
 * HTTP-level integration test for GET /api/v1/horses/:id/gaits (Equoria-2zia).
 *
 * Story 31C.3 shipped the endpoint with controller-direct unit tests
 * (gaitApiEndpoint.test.mjs) that construct synthetic req/res objects and
 * call getGaits() directly. That bypassed the route's middleware stack:
 *   - queryRateLimiter
 *   - validateHorseId           (covers AC#4 — 400 on invalid id)
 *   - requireOwnership('horse') (covers AC#3 — IDOR contract, 404 on missing)
 *
 * This file is the parallel of conformationRoutesHttp.integration.test.mjs
 * (Equoria-4sgw) for the gait endpoint — full bound-route coverage via
 * supertest, real auth, real DB, no bypass headers.
 *
 * Ownership contract (CWE-639 — IDOR existence disclosure):
 *   requireOwnership('horse') returns 404 for BOTH "horse not found" AND
 *   "horse exists but is owned by another user". The response shape must
 *   not distinguish the two cases (see backend/middleware/ownership.mjs).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

// ── Fixtures ───────────────────────────────────────────────────────────────
let ownerA;
let tokenA;
let ownerB;
let gaitedHorse;
let nonGaitedHorse;
let legacyHorse;
let horseOwnedByB;

const FIXTURE_PREFIX = 'TestFixture-gait-http';

// Realistic gaitScores JSONB for a gaited breed (e.g. American Saddlebred).
// The endpoint is breed-agnostic — it returns whatever JSONB is on the row —
// so the fixture's `gaiting` array is what proves the response envelope.
function makeGaitedScores() {
  return {
    walk: 72,
    trot: 78,
    canter: 75,
    gallop: 80,
    gaiting: [
      { name: 'Slow Gait', score: 85 },
      { name: 'Rack', score: 88 },
    ],
  };
}

// gaitScores for a non-gaited breed: the `gaiting` slot is explicitly null.
function makeNonGaitedScores() {
  return {
    walk: 70,
    trot: 72,
    canter: 71,
    gallop: 74,
    gaiting: null,
  };
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  // Two users — A is the owner; B is used to assert the IDOR contract.
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
  // tokenB intentionally unused — IDOR test exercises A's token against
  // a horse owned by B; we never authenticate as B in this suite.

  gaitedHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Gaited-${tag}`,
    userId: ownerA.id,
    gaitScores: makeGaitedScores(),
  });

  nonGaitedHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-NonGaited-${tag}`,
    userId: ownerA.id,
    gaitScores: makeNonGaitedScores(),
  });

  legacyHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Legacy-${tag}`,
    userId: ownerA.id,
    gaitScores: null,
  });

  horseOwnedByB = await createTestHorse({
    name: `${FIXTURE_PREFIX}-OwnerB-${tag}`,
    userId: ownerB.id,
    gaitScores: makeGaitedScores(),
  });
}, 120000);

afterAll(async () => {
  // Delegate to the shared cleanup helper (tracks IDs from createTestHorse/
  // createTestUser). DO NOT call prisma.$disconnect() — global teardown owns
  // the shared client (Equoria-6ksu 2nd iteration lesson).
  await cleanupTestData();
});

// ── GET /api/v1/horses/:id/gaits ───────────────────────────────────────────

describe('GET /api/v1/horses/:id/gaits (HTTP chain)', () => {
  it('returns 200 + full envelope + gaiting array for a gaited owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${gaitedHorse.id}/gaits`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.horseId).toBe(gaitedHorse.id);
    expect(res.body.data.horseName).toBe(gaitedHorse.name);
    expect(typeof res.body.data.breedId).toBe('number');

    const { gaitScores } = res.body.data;
    for (const slot of ['walk', 'trot', 'canter', 'gallop']) {
      expect(gaitScores).toHaveProperty(slot);
      expect(typeof gaitScores[slot]).toBe('number');
    }
    expect(Array.isArray(gaitScores.gaiting)).toBe(true);
    expect(gaitScores.gaiting.length).toBe(2);
    for (const entry of gaitScores.gaiting) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('score');
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.score).toBe('number');
    }
  });

  it('returns 200 with gaiting:null for a non-gaited owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${nonGaitedHorse.id}/gaits`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.gaitScores.gaiting).toBeNull();
    for (const slot of ['walk', 'trot', 'canter', 'gallop']) {
      expect(typeof res.body.data.gaitScores[slot]).toBe('number');
    }
  });

  it('returns 200 with data:null for a legacy (no-gaitScores) owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${legacyHorse.id}/gaits`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toMatch(/no gait scores available/i);
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get(`/api/v1/horses/${gaitedHorse.id}/gaits`).set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when the Authorization header is malformed/bogus', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${gaitedHorse.id}/gaits`)
      .set('Authorization', 'Bearer not-a-real-token-at-all')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 (NOT 403) when user A queries user B's horse (CWE-639 — no existence leak)", async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseOwnedByB.id}/gaits`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/horse not found/i);
  });

  it('returns 404 for a horse ID that does not exist', async () => {
    const nonExistentId = 2_000_000_000;
    const res = await request(app)
      .get(`/api/v1/horses/${nonExistentId}/gaits`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/horse not found/i);
  });

  it('returns 400 for a malformed (non-numeric) horse ID', async () => {
    const res = await request(app)
      .get('/api/v1/horses/not-a-number/gaits')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
