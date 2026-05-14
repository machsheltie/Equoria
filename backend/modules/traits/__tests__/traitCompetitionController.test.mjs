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
let horseWithTraits; // horse with epigeneticModifiers to cover getDisciplineRecommendations lines 313-506

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

  // Horse with visible traits — exercises getDisciplineRecommendations lines 313-506
  horseWithTraits = await prisma.horse.create({
    data: {
      name: `TestFixture-TCompHorseTrait-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: user.id,
      epigeneticModifiers: {
        positive: ['bold', 'intelligent', 'resilient'],
        negative: ['nervous'],
        hidden: [],
      },
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horseWithTraits.id } }).catch(() => {});
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

// ─── getDisciplineRecommendations — horse WITH traits (lines 313-506) ─────────

describe('GET /api/traits/discipline-recommendations/:horseId — horse with traits', () => {
  it('returns 200 with non-empty recommendations for horse with visible traits', async () => {
    const res = await request(app)
      .get(`/api/traits/discipline-recommendations/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    // Horse has bold+intelligent+resilient+nervous — recommendations array should exist
    expect(Array.isArray(res.body.data.recommendations)).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(typeof res.body.data.summary.totalTraits).toBe('number');
    expect(typeof res.body.data.summary.specializedTraits).toBe('number');
    expect(typeof res.body.data.summary.recommendedDisciplines).toBe('number');
  });

  it('summary.totalTraits matches the number of visible traits', async () => {
    const res = await request(app)
      .get(`/api/traits/discipline-recommendations/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 3 positive + 1 negative = 4 visible traits
    expect(res.body.data.summary.totalTraits).toBe(4);
  });

  it('each recommendation entry has discipline and traits fields', async () => {
    const res = await request(app)
      .get(`/api/traits/discipline-recommendations/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const rec of res.body.data.recommendations) {
      expect(typeof rec.discipline).toBe('string');
      expect(Array.isArray(rec.traits)).toBe(true);
    }
  });

  it('returns 200 with no-traits message for horse with empty traits', async () => {
    // The main fixture horse has no traits — exercises the early-return path
    const res = await request(app)
      .get(`/api/traits/discipline-recommendations/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendations).toEqual([]);
  });
});

// ─── analyzeHorseTraitImpact — horse with traits (lines 59-62 etc.) ──────────

describe('GET /api/traits/competition-impact/:horseId — horse with traits', () => {
  it('returns impact analysis with applied traits for horse with visible traits', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-impact/${horseWithTraits.id}?discipline=Dressage`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('horseId');
    expect(res.body.data).toHaveProperty('discipline', 'Dressage');
    // Horse has intelligent+resilient which have Dressage specialized effects
    expect(res.body.data.analysis).toBeDefined();
  });
});

// ─── compareTraitImpactAcrossDisciplines — horse with traits ──────────────────

describe('GET /api/traits/competition-comparison/:horseId — horse with traits', () => {
  it('returns cross-discipline comparison with trait scores for horse with traits', async () => {
    const res = await request(app)
      .get(`/api/traits/competition-comparison/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.comparison)).toBe(true);
    expect(res.body.data.comparison.length).toBeGreaterThan(0);
  });
});
