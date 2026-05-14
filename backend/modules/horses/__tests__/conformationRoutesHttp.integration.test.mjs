/**
 * conformationRoutesHttp.integration.test.mjs
 *
 * HTTP-level integration tests for the /conformation endpoints (Equoria-4sgw).
 *
 * Spawned from Equoria-16kl verification: the controllers had unit coverage
 * (conformationApiEndpoints.test.mjs) and the middleware chain (queryRateLimiter
 * + validateHorseId + requireOwnership('horse')) had its own unit tests, but
 * no test exercised the full route-binding stack via supertest. This file
 * closes that gap.
 *
 * Routes covered:
 *   GET /api/v1/horses/:id/conformation
 *   GET /api/v1/horses/:id/conformation/analysis
 *
 * Real database. Real auth. Real CSRF middleware in the chain (these are GETs
 * so no token is required). No bypass headers. ES modules. Fixtures prefixed
 * with `TestFixture-` for safe cleanup.
 *
 * Ownership contract under test (CWE-639 — IDOR existence disclosure):
 *   requireOwnership('horse') returns 404 for BOTH "horse not found" AND
 *   "horse exists but belongs to another user" — the response shape must
 *   not distinguish the two cases. See backend/middleware/ownership.mjs:150-163.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { CONFORMATION_REGIONS } from '../services/conformationService.mjs';

// ── Fixtures ───────────────────────────────────────────────────────────────
let ownerA;
let tokenA;
let ownerB;
let tokenB;
let horseWithConformation;
let legacyHorse;
let horseOwnedByB;

const FIXTURE_PREFIX = 'TestFixture-conformation-http';

/** Build a uniform 8-region conformation-scores object. */
function makeScores(value) {
  const out = Object.fromEntries(CONFORMATION_REGIONS.map(r => [r, value]));
  out.overallConformation = value;
  return out;
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  // Two users: A (owner) and B (foreign user attempting IDOR).
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
  tokenB = b.token;

  // Horse with real conformation scores, owned by A.
  horseWithConformation = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Scored-${tag}`,
    userId: ownerA.id,
    conformationScores: makeScores(75),
  });

  // Legacy horse (no conformation scores), owned by A.
  legacyHorse = await createTestHorse({
    name: `${FIXTURE_PREFIX}-Legacy-${tag}`,
    userId: ownerA.id,
    conformationScores: null,
  });

  // Horse owned by B — used to assert the IDOR / existence-disclosure contract.
  horseOwnedByB = await createTestHorse({
    name: `${FIXTURE_PREFIX}-OwnerB-${tag}`,
    userId: ownerB.id,
    conformationScores: makeScores(60),
  });
}, 120000);

afterAll(async () => {
  // Delegate to the shared cleanup helper — it tracks the IDs we created via
  // createTestHorse/createTestUser. DO NOT call prisma.$disconnect() here:
  // global teardown owns the shared client (see CLAUDE.md lesson from
  // Equoria-6ksu 2nd iteration).
  await cleanupTestData();
});

// ── GET /api/v1/horses/:id/conformation ────────────────────────────────────

describe('GET /api/v1/horses/:id/conformation (HTTP chain)', () => {
  it('returns 200 + all 8 regions + overall for an owned horse with scores', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseWithConformation.id}/conformation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.horseId).toBe(horseWithConformation.id);
    expect(res.body.data.horseName).toBe(horseWithConformation.name);

    const scores = res.body.data.conformationScores;
    for (const region of CONFORMATION_REGIONS) {
      expect(scores).toHaveProperty(region);
      expect(typeof scores[region]).toBe('number');
    }
    expect(scores).toHaveProperty('overallConformation');
    expect(typeof scores.overallConformation).toBe('number');
  });

  it('returns 200 with data:null for a legacy (no-scores) owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${legacyHorse.id}/conformation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseWithConformation.id}/conformation`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when the Authorization header is malformed/bogus', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseWithConformation.id}/conformation`)
      .set('Authorization', 'Bearer not-a-real-token-at-all')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 (NOT 403) when user A queries user B's horse (CWE-639 — no existence leak)", async () => {
    // This is the IDOR contract: requireOwnership must NOT distinguish
    // "horse exists but belongs to someone else" from "horse does not exist".
    // Both cases must produce identical 404 responses so an attacker cannot
    // enumerate which IDs exist.
    const res = await request(app)
      .get(`/api/v1/horses/${horseOwnedByB.id}/conformation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    // The message must not reveal that the horse exists under another owner.
    expect(res.body.message).toMatch(/horse not found/i);
  });

  it('returns 404 for a horse ID that does not exist', async () => {
    // Use an ID well beyond any real fixture but inside int4 range.
    const nonExistentId = 2_000_000_000;
    const res = await request(app)
      .get(`/api/v1/horses/${nonExistentId}/conformation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/horse not found/i);
  });

  it('returns 400 for a malformed (non-numeric) horse ID', async () => {
    const res = await request(app)
      .get('/api/v1/horses/not-a-number/conformation')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /api/v1/horses/:id/conformation/analysis ───────────────────────────

describe('GET /api/v1/horses/:id/conformation/analysis (HTTP chain)', () => {
  it('returns 200 + per-region + overall percentile analysis for an owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseWithConformation.id}/conformation/analysis`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.horseId).toBe(horseWithConformation.id);
    expect(res.body.data).toHaveProperty('breedName');
    expect(res.body.data).toHaveProperty('breedMeanAvailable');
    expect(res.body.data).toHaveProperty('totalHorsesInBreed');

    const { analysis, overallConformation } = res.body.data;
    for (const region of CONFORMATION_REGIONS) {
      expect(analysis).toHaveProperty(region);
      expect(analysis[region]).toHaveProperty('score');
      expect(analysis[region]).toHaveProperty('breedMean');
      expect(analysis[region]).toHaveProperty('percentile');
      expect(typeof analysis[region].percentile).toBe('number');
      expect(analysis[region].percentile).toBeGreaterThanOrEqual(0);
      expect(analysis[region].percentile).toBeLessThanOrEqual(100);
    }

    expect(overallConformation).toHaveProperty('score');
    expect(overallConformation).toHaveProperty('breedMean');
    expect(overallConformation).toHaveProperty('percentile');
  });

  it('returns 200 with data:null for a legacy (no-scores) owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${legacyHorse.id}/conformation/analysis`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 when unauthenticated on the analysis endpoint', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseWithConformation.id}/conformation/analysis`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 when user A queries user B's horse via analysis (CWE-639)", async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horseOwnedByB.id}/conformation/analysis`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/horse not found/i);
  });

  it('returns 400 for a malformed horse ID on analysis endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/horses/abc/conformation/analysis')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
