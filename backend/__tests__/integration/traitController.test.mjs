/**
 * traitController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getTraitDefinitions, getTraitCompetitionEffects, getHorseTraits,
 * getDiscoveryStatus, discoverTraits.
 * Routes live under authRouter at /api/traits.
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
      email: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `tc${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TC',
      lastName: 'Tester',
      money: 1000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-TraitHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2021-06-01'),
      age: 3,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/traits/definitions ─────────────────────────────────────────────

describe('GET /api/traits/definitions', () => {
  it('returns 200 with trait definitions object', async () => {
    const res = await request(app)
      .get('/api/traits/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('traits');
    expect(res.body.data).toHaveProperty('count');
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  it('filters to positive traits when type=positive', async () => {
    const res = await request(app)
      .get('/api/traits/definitions?type=positive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.filter).toBe('positive');
  });

  it('returns 400 for invalid type query param', async () => {
    const res = await request(app)
      .get('/api/traits/definitions?type=unknown')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/traits/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/traits/competition-effects ─────────────────────────────────────

describe('GET /api/traits/competition-effects', () => {
  it('returns 200 with competition effects', async () => {
    const res = await request(app)
      .get('/api/traits/competition-effects')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/traits/competition-effects').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/traits/horse/:horseId ──────────────────────────────────────────

describe('GET /api/traits/horse/:horseId', () => {
  it('returns 200 with horse traits for owned horse', async () => {
    const res = await request(app)
      .get(`/api/traits/horse/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
    expect(res.body.data).toHaveProperty('traits');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/traits/horse/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/traits/horse/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/traits/discovery-status/:horseId ────────────────────────────────

describe('GET /api/traits/discovery-status/:horseId', () => {
  it('returns 200 with discovery status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/traits/discovery-status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/traits/discovery-status/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/traits/discovery-status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/traits/discover/:horseId ──────────────────────────────────────

describe('POST /api/traits/discover/:horseId', () => {
  it('returns 200 or result for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/traits/discover/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // Either 200 (traits discovered / already discovered) or 4xx (horse too young, etc.)
    // Just confirm it's not 401 or 500
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(500);
  });

  it('returns 400 for non-numeric horseId', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/traits/discover/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/traits/discover/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
