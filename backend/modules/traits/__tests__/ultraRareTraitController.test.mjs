/**
 * ultraRareTraitRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: definitions, horse traits, evaluate triggers.
 * Routes live under authRouter at /api/ultra-rare-traits.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `ultrarare-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `ultrarare${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'UltraRare',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-UltraRareHorse-${Date.now()}`,
      sex: 'Colt',
      dateOfBirth: new Date('2022-01-01'),
      age: 3,
      userId: user.id,
      healthStatus: 'Good',
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.ultraRareTraitEvent.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/ultra-rare-traits/definitions ───────────────────────────────────

describe('GET /api/ultra-rare-traits/definitions', () => {
  it('returns 200 with ultra-rare and exotic trait definitions', async () => {
    const res = await request(app)
      .get('/api/ultra-rare-traits/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.ultraRare).toBeDefined();
    expect(res.body.data.exotic).toBeDefined();
    expect(res.body.data.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/ultra-rare-traits/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/ultra-rare-traits/horse/:horseId ───────────────────────────────

describe('GET /api/ultra-rare-traits/horse/:horseId', () => {
  it('returns 200 with trait data for owned horse', async () => {
    const res = await request(app)
      .get(`/api/ultra-rare-traits/horse/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horse).toBeDefined();
    expect(res.body.data.horse.id).toBe(horse.id);
    expect(res.body.data.traits).toBeDefined();
    expect(res.body.data.traits.ultraRare).toBeDefined();
    expect(res.body.data.traits.exotic).toBeDefined();
    expect(typeof res.body.data.totalTraits).toBe('number');
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/ultra-rare-traits/horse/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/ultra-rare-traits/horse/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/ultra-rare-traits/evaluate/:horseId ───────────────────────────

describe('POST /api/ultra-rare-traits/evaluate/:horseId', () => {
  it('returns 200 when evaluating triggers for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/ultra-rare-traits/evaluate/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ evaluationContext: {} });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.ultraRareResults)).toBe(true);
    expect(Array.isArray(res.body.data.exoticResults)).toBe(true);
    expect(typeof res.body.data.totalTriggered).toBe('number');
  });

  it('returns 400 for invalid horseId', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/evaluate/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/evaluate/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/ultra-rare-traits/evaluate/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/ultra-rare-traits/effects/calculate ───────────────────────────

describe('POST /api/ultra-rare-traits/effects/calculate', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid effectType', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, effectType: 'invalid', baseValue: 50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when calculating stress effects for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, effectType: 'stress', baseValue: 50 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.effectType).toBe('stress');
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, effectType: 'stress', baseValue: 50 });

    expect(res.status).toBe(401);
  });
});
