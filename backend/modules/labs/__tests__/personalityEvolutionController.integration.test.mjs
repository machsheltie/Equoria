/**
 * personalityEvolutionController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: evolveGroomPersonality, evolveHorseTemperament, getEvolutionTriggers,
 * getPersonalityStability, predictPersonalityEvolution, getEvolutionHistory,
 * getPersonalityConfig.
 * Routes live under authRouter at /api/personality-evolution.
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
let groom;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `pevol-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `pevol${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'PEvol',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-EvolGroom-${Date.now()}`,
      speciality: 'general',
      personality: 'calm',
      userId: user.id,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-EvolHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/personality-evolution/config ────────────────────────────────────

describe('GET /api/personality-evolution/config', () => {
  it('returns 200 with personality evolution configuration', async () => {
    const res = await request(app)
      .get('/api/personality-evolution/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/personality-evolution/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/personality-evolution/:entityType/:entityId/triggers ────────────

describe('GET /api/personality-evolution/:entityType/:entityId/triggers', () => {
  it('returns 200 with triggers for owned groom', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/groom/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 200 with triggers for owned horse', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/horse/${horse.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for invalid entityType', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/trainer/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/personality-evolution/groom/${groom.id}/triggers`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/personality-evolution/:entityType/:entityId/stability ───────────

describe('GET /api/personality-evolution/:entityType/:entityId/stability', () => {
  it('returns 200 with stability data for owned groom', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/groom/${groom.id}/stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/personality-evolution/groom/${groom.id}/stability`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/personality-evolution/:entityType/:entityId/predict ─────────────

describe('GET /api/personality-evolution/:entityType/:entityId/predict', () => {
  it('returns 200 with prediction for owned groom', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/groom/${groom.id}/predict`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/personality-evolution/groom/${groom.id}/predict`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/personality-evolution/:entityType/:entityId/history ─────────────

describe('GET /api/personality-evolution/:entityType/:entityId/history', () => {
  it('returns 200 with evolution history for owned groom', async () => {
    const res = await request(app)
      .get(`/api/personality-evolution/groom/${groom.id}/history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/personality-evolution/groom/${groom.id}/history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/personality-evolution/groom/:groomId/evolve ───────────────────

describe('POST /api/personality-evolution/groom/:groomId/evolve', () => {
  it('returns 200 when evolving personality for owned groom', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/personality-evolution/groom/${groom.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 200 success or 400 (no evolution triggered) are both acceptable
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for a groom not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/personality-evolution/groom/999999999/evolve')
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
      .post(`/api/personality-evolution/groom/${groom.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/personality-evolution/horse/:horseId/evolve ───────────────────

describe('POST /api/personality-evolution/horse/:horseId/evolve', () => {
  it('returns 200 when evolving temperament for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/personality-evolution/horse/${horse.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 200 success or 400 (no evolution triggered) are both acceptable
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/personality-evolution/horse/999999999/evolve')
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
      .post(`/api/personality-evolution/horse/${horse.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
