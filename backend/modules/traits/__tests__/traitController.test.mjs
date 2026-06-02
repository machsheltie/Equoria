/**
 * traitController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getTraitDefinitions, getTraitCompetitionEffects, getHorseTraits,
 * getDiscoveryStatus, discoverTraits.
 * Routes live under authRouter (mounted at /api/v1) at /api/v1/traits.
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

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tc-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `tc${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TC',
      lastName: 'Tester',
      money: 1000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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

// ─── GET /api/v1/traits/definitions ──────────────────────────────────────────

describe('GET /api/v1/traits/definitions', () => {
  it('returns 200 with trait definitions object', async () => {
    const res = await request(app)
      .get('/api/v1/traits/definitions')
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
      .get('/api/v1/traits/definitions?type=positive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.filter).toBe('positive');
  });

  it('returns 400 for invalid type query param', async () => {
    const res = await request(app)
      .get('/api/v1/traits/definitions?type=unknown')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/traits/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/traits/competition-effects ──────────────────────────────────

describe('GET /api/v1/traits/competition-effects', () => {
  it('returns 200 with competition effects', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-effects')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/traits/competition-effects').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/traits/horse/:horseId ───────────────────────────────────────

describe('GET /api/v1/traits/horse/:horseId', () => {
  it('returns 200 with horse traits for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/horse/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
    expect(res.body.data).toHaveProperty('traits');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/v1/traits/horse/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/traits/horse/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/traits/discovery-status/:horseId ─────────────────────────────

describe('GET /api/v1/traits/discovery-status/:horseId', () => {
  it('returns 200 with discovery status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/discovery-status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/v1/traits/discovery-status/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/traits/discovery-status/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/traits/discover/:horseId ───────────────────────────────────

describe('POST /api/v1/traits/discover/:horseId', () => {
  it('returns 200 or result for owned horse', async () => {
    // Per-user CSRF (Equoria-plw0h): authenticated mutation binds the issued
    // token to the same user via the accessToken cookie so the validate-time
    // sessionIdentifier (req.user.id from the Bearer header) matches.
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/traits/discover/${horse.id}`)
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
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/traits/discover/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/traits/discover/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
