/**
 * trainingRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: check-eligibility, train, status (single + all disciplines), trainable.
 * Routes are mounted at /api/v1/training (authRouter is mounted at /api/v1 in
 * app.mjs; authRouter.use('/training', trainingRoutes) in app/routers.mjs).
 * Equoria-opxio: unversioned /api/* mounts were removed (Equoria-4bs3s) —
 * /api/v1/training is the only reachable surface.
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
// Equoria-1ohys: fail-loud scoped cleanup — a failed delete must turn the suite
// RED so leaked fixtures don't silently pollute the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `training-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `training${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Training',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TrainingHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  // Equoria-1ohys: scoped, FK-ordered, fail-loud cleanup. Horse references the
  // user (Horse.userId, Restrict) so the horse must be deleted BEFORE the user.
  // The two deletes previously carried silent no-op catch arms that masked
  // cleanup failures; they now fail loud through the tracker.
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  await cleanup.run();
}, 30000);

// ─── POST /api/v1/training/check-eligibility ────────────────────────────────────

describe('POST /api/v1/training/check-eligibility', () => {
  it('returns 400 when horseId is missing', async () => {
    // Equoria-opxio: per-user CSRF binding — issue the token under the same
    // accessToken so resolveSessionIdentifier (csrf.mjs) binds to req.user.id,
    // matching the authenticated mutation. Plain fetchCsrf(app) would resolve
    // CSRF_SESSION_SALT and 403 the Bearer-authenticated request.
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when discipline is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with eligibility data for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    // No Bearer token here — anonymous CSRF (CSRF_SESSION_SALT) is correct;
    // the request resolves the same identifier on both sides. authenticateToken
    // rejects with 401 before the handler runs.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/training/train ─────────────────────────────────────────────────

describe('POST /api/v1/training/train', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when discipline is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseId does not belong to user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, discipline: 'Dressage' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 or 400 when training owned horse in valid discipline', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect([200, 400]).toContain(res.status);
    expect(res.body.success).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    // No Bearer token — anonymous CSRF is correct; auth rejects with 401.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/training/train')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/training/status/:horseId/:discipline ───────────────────────────

describe('GET /api/v1/training/status/:horseId/:discipline', () => {
  it('returns 200 with training status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/training/status/${horse.id}/Dressage`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/training/status/999999999/Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/training/status/${horse.id}/Dressage`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/training/status/:horseId ───────────────────────────────────────

describe('GET /api/v1/training/status/:horseId', () => {
  it('returns 200 with status for all disciplines for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/training/status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data).toBe('object');
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/training/status/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/training/status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/training/trainable/:userId ──────────────────────────────────────

describe('GET /api/v1/training/trainable/:userId', () => {
  it('returns 200 with trainable horses for own user', async () => {
    const res = await request(app)
      .get(`/api/v1/training/trainable/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 when accessing another user trainable horses', async () => {
    const res = await request(app)
      .get('/api/v1/training/trainable/a0000000-0000-4000-8000-000000000001')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/training/trainable/${user.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
