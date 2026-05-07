/**
 * farrierController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getFarrierServices, bookFarrierService.
 * Routes live under authRouter at /api/farrier.
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
      email: `farrier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `farrier${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Farrier',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-FarrierHorse-${Date.now()}`,
      sex: 'Rig',
      dateOfBirth: new Date('2017-01-01'),
      age: 8,
      userId: user.id,
      healthStatus: 'Good',
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/farrier/services ────────────────────────────────────────────────

describe('GET /api/farrier/services', () => {
  it('returns 200 with list of farrier services', async () => {
    const res = await request(app)
      .get('/api/farrier/services')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('cost');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/farrier/services').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/farrier/book-service ──────────────────────────────────────────

describe('POST /api/farrier/book-service', () => {
  it('returns 200 when booking a valid service for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'hoof-trim' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.horse).toBeDefined();
    expect(res.body.data.service).toBeDefined();
  });

  it('returns 404 for an invalid serviceId', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'nonexistent-service' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, serviceId: 'hoof-trim' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'hoof-trim' });

    expect(res.status).toBe(401);
  });
});
