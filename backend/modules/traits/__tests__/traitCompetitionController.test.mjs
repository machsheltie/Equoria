/**
 * traitCompetitionController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: analyzeHorseTraitImpact, compareTraitImpactAcrossDisciplines,
 * getDisciplineRecommendations.
 * Routes live under authRouter at /api/v1/traits.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let horseWithTraits; // horse with epigeneticModifiers to cover getDisciplineRecommendations lines 313-506
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tcomp-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `tcomp${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TComp',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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
      ...fixtureColor(),
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

  // Scoped, fail-loud cleanup (Equoria-1ohys). Both horses before the user
  // (Horse.userId onDelete:Restrict).
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: [horse.id, horseWithTraits.id] } } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/traits/competition-impact/:horseId ──────────────────────────────

describe('GET /api/v1/traits/competition-impact/:horseId', () => {
  it('returns 200 with impact analysis for owned horse and valid discipline', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-impact/${horse.id}?discipline=Dressage`)
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
      .get(`/api/v1/traits/competition-impact/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid discipline value', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-impact/${horse.id}?discipline=InvalidDiscipline`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-impact/notanumber?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-impact/999999999?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-impact/${horse.id}?discipline=Dressage`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/traits/competition-comparison/:horseId ─────────────────────────

describe('GET /api/v1/traits/competition-comparison/:horseId', () => {
  it('returns 200 with cross-discipline comparison for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-comparison/${horse.id}`)
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
      .get('/api/v1/traits/competition-comparison/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-comparison/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/traits/competition-comparison/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/traits/discipline-recommendations/:horseId ─────────────────────

describe('GET /api/v1/traits/discipline-recommendations/:horseId', () => {
  it('returns 200 with discipline recommendations for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/discipline-recommendations/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/v1/traits/discipline-recommendations/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/traits/discipline-recommendations/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/traits/discipline-recommendations/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── getDisciplineRecommendations — horse WITH traits (lines 313-506) ─────────

describe('GET /api/v1/traits/discipline-recommendations/:horseId — horse with traits', () => {
  it('returns 200 with non-empty recommendations for horse with visible traits', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/discipline-recommendations/${horseWithTraits.id}`)
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
      .get(`/api/v1/traits/discipline-recommendations/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // 3 positive + 1 negative = 4 visible traits
    expect(res.body.data.summary.totalTraits).toBe(4);
  });

  it('each recommendation entry has discipline and traits fields', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/discipline-recommendations/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    for (const rec of res.body.data.recommendations) {
      expect(typeof rec.discipline).toBe('string');
      expect(Array.isArray(rec.specializedTraits)).toBe(true);
      expect(typeof rec.recommendationScore).toBe('number');
    }
  });

  it('returns 200 with no-traits message for horse with empty traits', async () => {
    // The main fixture horse has no traits — exercises the early-return path
    const res = await request(app)
      .get(`/api/v1/traits/discipline-recommendations/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recommendations).toEqual([]);
  });
});

// ─── analyzeHorseTraitImpact — horse with traits (lines 59-62 etc.) ──────────

describe('GET /api/v1/traits/competition-impact/:horseId — horse with traits', () => {
  it('returns impact analysis with applied traits for horse with visible traits', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-impact/${horseWithTraits.id}?discipline=Dressage`)
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

describe('GET /api/v1/traits/competition-comparison/:horseId — horse with traits', () => {
  it('returns cross-discipline comparison with trait scores for horse with traits', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/competition-comparison/${horseWithTraits.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.comparison)).toBe(true);
    expect(res.body.data.comparison.length).toBeGreaterThan(0);
  });
});

// ─── GET /api/v1/traits/competition-effects — getTraitCompetitionEffects ─────────

describe('GET /api/v1/traits/competition-effects', () => {
  it('returns 200 with all trait effects', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-effects')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.totalTraits).toBe('number');
    expect(Array.isArray(res.body.data.effects)).toBe(true);
  });

  it('filters by type=positive', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-effects?type=positive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // All returned effects should be positive
    for (const effect of res.body.data.effects) {
      expect(effect.type).toBe('positive');
    }
  });

  it('filters by type=negative', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-effects?type=negative')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.filter.type).toBe('negative');
  });

  it('filters by discipline=Dressage highlights forDiscipline (line 476)', async () => {
    const res = await request(app)
      .get('/api/v1/traits/competition-effects?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Effects with Dressage specialization should have forDiscipline set
    const withDiscipline = res.body.data.effects.filter(e => e.forDiscipline);
    expect(withDiscipline.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/traits/competition-effects').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
