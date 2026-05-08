/**
 * trainingRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: check-eligibility, train, status (single + all disciplines), trainable.
 * Routes are mounted at /api/training in authRouter.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `training-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `training${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Training',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-TrainingHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── POST /api/training/check-eligibility ────────────────────────────────────

describe('POST /api/training/check-eligibility', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when discipline is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with eligibility data for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/check-eligibility')
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
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/check-eligibility')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/training/train ─────────────────────────────────────────────────

describe('POST /api/training/train', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when discipline is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseId does not belong to user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, discipline: 'Dressage' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 or 400 when training owned horse in valid discipline', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/train')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect([200, 400]).toContain(res.status);
    expect(res.body.success).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/training/train')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, discipline: 'Dressage' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/training/status/:horseId/:discipline ───────────────────────────

describe('GET /api/training/status/:horseId/:discipline', () => {
  it('returns 200 with training status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/training/status/${horse.id}/Dressage`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/training/status/999999999/Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/training/status/${horse.id}/Dressage`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/training/status/:horseId ───────────────────────────────────────

describe('GET /api/training/status/:horseId', () => {
  it('returns 200 with status for all disciplines for owned horse', async () => {
    const res = await request(app)
      .get(`/api/training/status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data).toBe('object');
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/training/status/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/training/status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/training/trainable/:userId ──────────────────────────────────────

describe('GET /api/training/trainable/:userId', () => {
  it('returns 200 with trainable horses for own user', async () => {
    const res = await request(app)
      .get(`/api/training/trainable/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 when accessing another user trainable horses', async () => {
    const res = await request(app)
      .get('/api/training/trainable/a0000000-0000-4000-8000-000000000001')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/training/trainable/${user.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
