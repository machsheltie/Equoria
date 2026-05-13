/**
 * traitCompetitionController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: analyzeHorseTraitImpact, compareTraitImpactAcrossDisciplines,
 * getDisciplineRecommendations.
 * Routes live under authRouter at /api/traits.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tcomp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `tcomp${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TComp',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-TCompHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/traits/competition-impact/:horseId ──────────────────────────────

describe('GET /api/traits/competition-impact/:horseId', () => {
  it('returns 200 with impact analysis for owned horse and valid discipline', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-impact/${horse.id}?discipline=Dressage`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
    expect(res.body.data).toHaveProperty('discipline');
    expect(res.body.data).toHaveProperty('analysis');
    expect(res.body.data).toHaveProperty('traits');
  });

  it('returns 400 when discipline query param is missing', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-impact/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid discipline value', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-impact/${horse.id}?discipline=InvalidDiscipline`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/traits/competition-impact/notanumber?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/traits/competition-impact/999999999?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-impact/${horse.id}?discipline=Dressage`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/traits/competition-comparison/:horseId ─────────────────────────

describe('GET /api/traits/competition-comparison/:horseId', () => {
  it('returns 200 with cross-discipline comparison for owned horse', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-comparison/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('comparison');
    expect(Array.isArray(res.body.data.comparison)).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/traits/competition-comparison/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/traits/competition-comparison/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/traits/competition-comparison/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/traits/discipline-recommendations/:horseId ─────────────────────

describe('GET /api/traits/discipline-recommendations/:horseId', () => {
  it('returns 200 with discipline recommendations for owned horse', async () => {
    const res = await request(app)
      .get(`/api/traits/discipline-recommendations/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/traits/discipline-recommendations/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/traits/discipline-recommendations/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/traits/discipline-recommendations/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
