/**
 * traitDiscoveryRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: conditions, progress, check-conditions, discovery-status.
 * (POST discover/batch, discover/:horseId and batch-discover were removed by
 * Equoria-gu8jk — players never reveal traits.)
 * Routes are mounted at /api/v1/trait-discovery in authRouter (app/routers.mjs).
 * Equoria-e0arf: migrated off the stale unversioned /api/v1/trait-discovery
 * (removed by 4bs3s) to the canonical /api/v1 mount, and bound per-user CSRF
 * (Equoria-plw0h) on the authenticated mutations via the accessToken cookie.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A silent no-op catch arm on the
// afterAll deletes leaks fixture rows into the canonical DB (CLAUDE.md §2) and
// keeps the suite green while a leak trips downstream sentinels. The tracker
// runs every registered scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traitdisc-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `traitdisc${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TraitDisc',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TraitDiscHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });

  // FK order: horse(s) before user (Horse.userId is onDelete: Restrict).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/trait-discovery/conditions ────────────────────────────────────

describe('GET /api/v1/trait-discovery/conditions', () => {
  it('returns 200 with conditions list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/trait-discovery/conditions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.conditions)).toBe(true);
    expect(res.body.data.conditions.length).toBeGreaterThan(0);
    expect(typeof res.body.data.totalConditions).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/trait-discovery/conditions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/trait-discovery/progress/:horseId ─────────────────────────────

describe('GET /api/v1/trait-discovery/progress/:horseId', () => {
  it('returns 200 with progress for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/trait-discovery/progress/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/trait-discovery/progress/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/trait-discovery/progress/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/trait-discovery/check-conditions/:horseId ────────────────────

describe('POST /api/v1/trait-discovery/check-conditions/:horseId', () => {
  it('returns 200 with conditions for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/trait-discovery/check-conditions/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.conditions)).toBe(true);
  });

  it('returns 404 for horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/trait-discovery/check-conditions/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // No auth → authenticateToken rejects with 401 BEFORE csrfProtection runs
    // (authRouter mounts authenticateToken before csrfProtection in routers.mjs),
    // so this case carries no accessToken and no CSRF pair on purpose.
    const res = await request(app).post(`/api/v1/trait-discovery/check-conditions/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/trait-discovery/discovery-status/:horseId ─────────────────────

describe('GET /api/v1/trait-discovery/discovery-status/:horseId', () => {
  it('returns 200 with discovery status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/trait-discovery/discovery-status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/trait-discovery/discovery-status/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/trait-discovery/discovery-status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
