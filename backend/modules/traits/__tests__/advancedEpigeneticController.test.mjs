/**
 * advancedEpigeneticRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers all 15 horse-specific epigenetic analysis endpoints.
 * Routes are mounted at '/' in authRouter so paths are /api/horses/:id/<endpoint>.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
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
      email: `advepi-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `advepi${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'AdvEpi',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-AdvEpiHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// Shared auth/ownership guards — test once, apply to representative endpoints

describe('Auth and ownership guards (representative)', () => {
  it('returns 401 without auth on GET /environmental-analysis', async () => {
    const res = await request(app).get(`/api/horses/${horse.id}/environmental-analysis`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-owned horse on GET /environmental-analysis', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/environmental-analysis')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── GET endpoints ────────────────────────────────────────────────────────────

describe('GET /api/horses/:id/environmental-analysis', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/environmental-analysis`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/horses/:id/environmental-triggers', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/environmental-triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/environmental-triggers')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/horses/:id/trigger-thresholds', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/trigger-thresholds`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/environmental-forecast', () => {
  it('returns 200 for owned horse with default days', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/environmental-forecast`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid days param', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/environmental-forecast?days=999`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/horses/:id/trait-interactions', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/trait-interactions`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/trait-matrix', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/trait-matrix`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/trait-stability', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/trait-stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/developmental-windows', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/developmental-windows`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/developmental-milestones', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/developmental-milestones`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/developmental-forecast', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/developmental-forecast`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/horses/:id/critical-period-analysis', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/critical-period-analysis`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST endpoints ───────────────────────────────────────────────────────────

describe('POST /api/horses/:id/trait-expression-probability', () => {
  it('returns 400 when traitName is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid traitName for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/999999999/trait-expression-probability')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/horses/:id/evaluate-trait-opportunity', () => {
  it('returns 400 when required fields missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/evaluate-trait-opportunity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid body for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/evaluate-trait-opportunity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm', windowName: 'imprinting' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/horses/:id/window-sensitivity', () => {
  it('returns 400 when windowName is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/window-sensitivity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid windowName for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/window-sensitivity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ windowName: 'imprinting' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/horses/:id/coordinate-development', () => {
  it('returns 200 for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/coordinate-development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/999999999/coordinate-development')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/coordinate-development`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(401);
  });
});
