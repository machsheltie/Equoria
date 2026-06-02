/**
 * ultraRareTraitRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: definitions, horse traits, evaluate triggers.
 * Routes live under authRouter at /api/v1/ultra-rare-traits (authRouter is
 * mounted at /api/v1 in backend/app.mjs:290; ultraRareTraitRoutes at
 * /ultra-rare-traits in backend/app/routers.mjs:178). The canonical path is
 * therefore /api/v1/ultra-rare-traits — the unversioned /api/... form 404s.
 *
 * Equoria-jh1sz: migrated all stale unversioned callers to the
 * /api/v1 prefix, and bound the CSRF token to the test user on the
 * authenticated POST mutations. These requests authenticate via
 * Authorization: Bearer, so csrfProtection resolves sessionIdentifier to
 * req.user.id; a CSRF token issued via bare fetchCsrf(app) (no bound user)
 * resolves to the salt fallback and 403s. fetchCsrf(app, {
 * extraCookies: [`accessToken=${token}`] }) binds issuance to the same user
 * the mutation runs as. The 401-no-auth POST is left with a bare fetchCsrf
 * because authenticateToken rejects before csrfProtection ever runs.
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
      email: `ultrarare-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `ultrarare${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'UltraRare',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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

// ─── GET /api/v1/ultra-rare-traits/definitions ───────────────────────────────────

describe('GET /api/v1/ultra-rare-traits/definitions', () => {
  it('returns 200 with ultra-rare and exotic trait definitions', async () => {
    const res = await request(app)
      .get('/api/v1/ultra-rare-traits/definitions')
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
    const res = await request(app).get('/api/v1/ultra-rare-traits/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/ultra-rare-traits/horse/:horseId ───────────────────────────────

describe('GET /api/v1/ultra-rare-traits/horse/:horseId', () => {
  it('returns 200 with trait data for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/ultra-rare-traits/horse/${horse.id}`)
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
      .get('/api/v1/ultra-rare-traits/horse/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/ultra-rare-traits/horse/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/ultra-rare-traits/evaluate/:horseId ───────────────────────────

describe('POST /api/v1/ultra-rare-traits/evaluate/:horseId', () => {
  it('returns 200 when evaluating triggers for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/ultra-rare-traits/evaluate/${horse.id}`)
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
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/ultra-rare-traits/evaluate/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/ultra-rare-traits/evaluate/999999999')
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
      .post(`/api/v1/ultra-rare-traits/evaluate/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/ultra-rare-traits/effects/calculate ───────────────────────────

describe('POST /api/v1/ultra-rare-traits/effects/calculate', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid effectType', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, effectType: 'invalid', baseValue: 50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when calculating stress effects for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/ultra-rare-traits/effects/calculate')
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
      .post('/api/v1/ultra-rare-traits/effects/calculate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, effectType: 'stress', baseValue: 50 });

    expect(res.status).toBe(401);
  });
});
