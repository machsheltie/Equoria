/**
 * Foal Routes — Auth Enforcement & Rate Limiting (REAL DB)
 *
 * Tests HTTP layer concerns: authentication enforcement and rate limiting on
 * /api/foals/* endpoints.
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of db + prismaClient + logger to a real-DB
 * integration test against the canonical equoria DB.
 *
 * Notes:
 *   - File still lives under tests/unit/ for path/co-location reasons; it is
 *     functionally an integration test under the no-mocks doctrine.
 *   - Rate limit tests verify the 429 response on the Nth+1 request regardless
 *     of what status previous requests returned, since foalRateLimiter counts
 *     ALL requests (skipSuccessfulRequests: false, skipFailedRequests: false).
 *     Each rate-limit test uses a fresh user so per-user counters don't bleed.
 *   - Hardcoded NON_EXISTENT_HORSE_ID is used where the test only cares about
 *     auth/rate-limit behaviour, not the controller's success path.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Replaces the prior per-user
// `prisma.user.delete(...)` with a silent no-op catch arm in afterAll — a
// swallowed delete would leak fixture users into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

const ts = randomBytes(8).toString('hex');
const NON_EXISTENT_HORSE_ID = 999_999_999;

let app;
let testUser;
let rateLimitActivityUser;
let rateLimitRecordUser;
let authToken;
let activityToken;
let recordToken;

// Per-suite fail-loud cleanup queue; drained in afterAll (Equoria-1ohys).
const cleanup = createCleanupTracker();

const buildToken = ({ id, email }) => jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: '1h' });

beforeAll(async () => {
  process.env.TEST_RATE_LIMIT_WINDOW_MS = '10000';
  process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '2';

  const hashed = await bcrypt.hash('TestPass123!', 1);

  // Equoria-1ohys: register scoped, fail-loud deletes for the 3 fixture users.
  // These users own no horses (no Horse.userId Restrict to order around), so a
  // plain id-scoped user delete is the correct teardown. Registered before the
  // creates so a throw on a later create still removes the earlier users.
  cleanup.add(
    () =>
      prisma.user.deleteMany({
        where: { id: { in: [testUser?.id, rateLimitActivityUser?.id, rateLimitRecordUser?.id].filter(Boolean) } },
      }),
    'fixture users',
  );

  testUser = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `foalAuthTest_${ts}`,
      email: `foalAuthTest_${ts}@test.com`,
      password: hashed,
      firstName: 'Foal',
      lastName: 'AuthTest',
    },
  });
  rateLimitActivityUser = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `foalAuthRLA_${ts}`,
      email: `foalAuthRLA_${ts}@test.com`,
      password: hashed,
      firstName: 'RL',
      lastName: 'Activity',
    },
  });
  rateLimitRecordUser = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `foalAuthRLE_${ts}`,
      email: `foalAuthRLE_${ts}@test.com`,
      password: hashed,
      firstName: 'RL',
      lastName: 'Record',
    },
  });

  authToken = buildToken(testUser);
  activityToken = buildToken(rateLimitActivityUser);
  recordToken = buildToken(rateLimitRecordUser);

  const { authenticateToken } = await import('../../middleware/auth.mjs');
  const { foalRateLimiter } = await import('../../middleware/rateLimiting.mjs');
  const { default: foalRoutes } = await import('../../modules/breeding/routes/foalRoutes.mjs');

  app = express();
  app.use(express.json());
  app.use(authenticateToken);
  app.use('/api/foals', foalRateLimiter, foalRoutes);
});

afterAll(async () => {
  // Env teardown first — harmless, and must happen regardless of cleanup outcome.
  delete process.env.TEST_RATE_LIMIT_WINDOW_MS;
  delete process.env.TEST_RATE_LIMIT_MAX_REQUESTS;
  // Equoria-1ohys: drain the fixture-user deletes fail-loud. A failed scoped
  // delete now fails the suite instead of being swallowed.
  await cleanup.run();
});

describe('Foal routes auth enforcement (real DB)', () => {
  it('rejects unauthenticated access to foal development', async () => {
    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/development`)
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  // Equoria-fr2kg: the unauthenticated enrichment and activity cases pointed
  // at POST /enrichment and POST /activity, which were removed (owner ruling
  // 2026-10-14/15: foal enrichment is the groom's job). They then probed
  // POST /reveal-traits and GET /activities. Equoria-gu8jk removed
  // POST /reveal-traits too (owner ruling 2026-10-20: players never reveal
  // traits), so the first case now probes the foal record read (GET /:foalId),
  // with the same 401 + message assertions.
  it('rejects unauthenticated access to the foal record', async () => {
    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}`)
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  it('rejects unauthenticated access to the foal activity log', async () => {
    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/activities`)
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Access token is required');
  });

  // Equoria-mwjst: the 'rejects unauthenticated access to advance-day' case
  // was removed with the route itself (owner ruling 2026-10-05: no advance
  // day). Router-level authenticateToken still answers 401 for that path,
  // so the case could only re-prove auth, never anything about the route.

  // Equoria-fr2kg: the two rate-limit cases drove POST /activity and POST
  // /enrichment, both removed. They then drove GET /activities and POST
  // /reveal-traits; Equoria-gu8jk removed POST /reveal-traits, so the second
  // case now drives the foal record read (GET /:foalId) with the same 429 +
  // message assertions, so foalRateLimiter coverage is kept, not lost.
  it('rate limits the foal activity log — 429 on Nth+1 request', async () => {
    // First two requests count toward the per-user limit (any status is fine
    // — controller may 404 on the bogus horse id, that's not the contract).
    await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/activities`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${activityToken}`);

    await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/activities`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${activityToken}`);

    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/activities`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${activityToken}`)
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rate limits the foal record read — 429 on Nth+1 request', async () => {
    await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${recordToken}`);

    await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${recordToken}`);

    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${recordToken}`)
      .expect(429);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Foal action limit exceeded');
  });

  it('rejects access to foal development when horse does not exist (proxy for not-owned)', async () => {
    // The ownership check uses prisma.horse.findFirst({ id, userId }). When
    // no row matches, the controller returns 404 — same code path as
    // "horse exists but is owned by someone else." We use a non-existent
    // ID rather than seeding+abandoning a real horse.
    const response = await request(app)
      .get(`/api/foals/${NON_EXISTENT_HORSE_ID}/development`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Foal not found');
  });
});
