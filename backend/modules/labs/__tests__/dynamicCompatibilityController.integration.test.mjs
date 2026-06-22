/**
 * dynamicCompatibilityController integration tests (Equoria-rr7 coverage sprint;
 * Equoria-fefh2.40 consolidation — the legacy top-level
 * backend/tests/controllers/dynamicCompatibilityController.test.mjs was merged
 * in here, its canonical home per CONTRIBUTING.md module-test co-location).
 *
 * Covers: calculateCompatibility, getCompatibilityFactors, predictOutcome,
 * getRecommendations, getCompatibilityTrends, getCompatibilityConfig.
 * Routes live under authRouter at /api/v1/compatibility (Equoria-vivsi: the
 * unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:190).
 *
 * Equoria-fefh2.40: the migrated score-threshold / response-shape / branch-value
 * tests (high/low compat, predict pos/neg, factors comprehensive, recommendations
 * ranked-groom shape, trends insufficient_data, config) require a richer fixture
 * than the original 1-groom/1-horse beforeAll could produce. The top-level
 * createFixture()'s 3-groom (calm/energetic/methodical) + 3-horse (incl. a
 * nervous horse stressLevel:9 bondScore:15) fixture is ported below so the
 * thresholds are exercised against real computed scores, not luck. Every created
 * id is tracked in the fail-loud cleanup tracker (FK order: horse -> groom ->
 * user -> breed; Horse.userId/Horse.breedId onDelete: Restrict).
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
// Equoria-twmpa: fail-loud scoped cleanup. The prior afterAll wrapped horse +
// groom in Promise.allSettled and a swallowed .catch on the user delete, hiding
// any leaked fixture in the canonical DB (CLAUDE.md §2). The tracker re-throws
// so the suite goes red at the source. horse -> groom -> user -> breed
// (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

// Reference date anchor for a 2-year-old horse (matches the migrated fixture).
const referenceDate = new Date('2025-06-01T12:00:00Z');
const birthDate2YearsOld = new Date(referenceDate);
birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2); // 2023-06-01 (age 2)

let user;
let token;
// 3 grooms: [calm/expert, energetic/novice, methodical/intermediate].
let grooms = [];
// 3 horses: [nervous (fearful), confident, developing].
let horses = [];
let breedId = null;
// Equoria-plw0h: CSRF pair bound to the acting identity — fetched after the
// fixture token exists, forwarding the accessToken cookie so issuance binds to
// user.id (an anonymous salt-bound token would 403 on authenticated mutations).
let csrfPair;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  const uid = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

  const breed = await prisma.breed.create({
    data: {
      name: `TestFixture-CompatBreed-${uid}`,
      description: 'Test breed for compatibility testing',
    },
  });
  breedId = breed.id;

  user = await prisma.user.create({
    data: {
      email: `dcompat-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `dcompat${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'DCompat',
      lastName: 'Tester',
      money: 5000,
      xp: 0,
      level: 1,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  const groomData = [
    {
      name: `Calm Expert ${uid}`,
      personality: 'calm',
      skillLevel: 'expert',
      experience: 200,
      level: 10,
      speciality: 'foal_care',
    },
    {
      name: `Energetic Novice ${uid}`,
      personality: 'energetic',
      skillLevel: 'novice',
      experience: 50,
      level: 3,
      speciality: 'general_grooming',
    },
    {
      name: `Methodical Intermediate ${uid}`,
      personality: 'methodical',
      skillLevel: 'intermediate',
      experience: 120,
      level: 6,
      speciality: 'enrichment',
    },
  ];

  grooms = [];
  for (const data of groomData) {
    grooms.push(
      await prisma.groom.create({
        data: {
          userId: user.id,
          name: data.name,
          speciality: data.speciality,
          personality: data.personality,
          epigeneticInfluenceType: data.personality,
          skillLevel: data.skillLevel,
          experience: data.experience,
          level: data.level,
          sessionRate: 25.0,
          isActive: true,
        },
      }),
    );
  }

  const horseData = [
    { name: `Fearful Horse ${uid}`, temperament: 'nervous', stressLevel: 9, bondScore: 15 },
    { name: `Confident Horse ${uid}`, temperament: 'confident', stressLevel: 3, bondScore: 35 },
    { name: `Developing Horse ${uid}`, temperament: 'developing', stressLevel: 5, bondScore: 25 },
  ];

  horses = [];
  for (const data of horseData) {
    horses.push(
      await prisma.horse.create({
        data: {
          ...fixtureColor(),
          userId: user.id,
          breedId,
          name: data.name,
          sex: 'Filly',
          dateOfBirth: birthDate2YearsOld,
          age: 2,
          temperament: data.temperament,
          stressLevel: data.stressLevel,
          bondScore: data.bondScore,
          healthStatus: 'Good',
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
          epigeneticFlags: [],
        },
      }),
    );
  }

  // Equoria-plw0h: forward the accessToken cookie so getCsrfToken's
  // tryPopulateUserFromAccessCookie binds issuance to user.id — the same
  // sessionIdentifier the Bearer-authed mutations below resolve to.
  csrfPair = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

  // FK-ordered, id-scoped, fail-loud sweep.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
  cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: breedId } }), 'breed');
}, 60000);

afterAll(() => cleanup.run(), 60000);

// ─── GET /api/v1/compatibility/config ────────────────────────────────────────

describe('GET /api/compatibility/config', () => {
  it('returns 200 with compatibility configuration', async () => {
    const res = await request(app)
      .get('/api/v1/compatibility/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/compatibility/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: full config response-shape (incl. the
  // environmentalFactors field asserted in NEITHER twin previously).
  it('returns the full compatibility system configuration shape', async () => {
    const res = await request(app)
      .get('/api/v1/compatibility/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.personalityTypes).toBeDefined();
    expect(res.body.data.temperamentTypes).toBeDefined();
    expect(res.body.data.taskTypes).toBeDefined();
    expect(res.body.data.environmentalFactors).toBeDefined();
    expect(res.body.data.recommendationLevels).toBeDefined();
  });
});

// ─── POST /api/v1/compatibility/calculate ────────────────────────────────────

describe('POST /api/compatibility/calculate', () => {
  it('returns 200 with compatibility score for owned groom and horse', async () => {
    // Equoria-vivsi: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's
    // tryPopulateUserFromAccessCookie binds the token to user.id; otherwise
    // issuance falls back to the salt and validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: grooms[0].id,
        horseId: horses[0].id,
        context: { taskType: 'trust_building' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83) and runs before csrfProtection
    // (routers.mjs:93,95), so a no-auth request 401s before CSRF validation —
    // the salt-bound bare token is sufficient. Forwarding accessToken would
    // authenticate the request and defeat the 401 assertion.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: grooms[0].id, horseId: horses[0].id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: high compatibility — calm/expert groom with a
  // fearful (nervous, high-stress) horse should score highly_recommended.
  it('calculates high compatibility for calm groom with fearful horse', async () => {
    const [calmGroom] = grooms;
    const [fearfulHorse] = horses;

    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({
        groomId: calmGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'morning',
          horseCurrentStress: 9,
          environmentalFactors: ['quiet', 'familiar'],
          recentInteractions: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.overallScore).toBeGreaterThan(0.7);
    expect(res.body.data.recommendationLevel).toBe('highly_recommended');
    expect(res.body.data.confidence).toBeCloseTo(0.8, 1);
  });

  // Equoria-fefh2.40 migrated: low compatibility — energetic/novice groom with
  // a fearful horse should score not_recommended.
  it('calculates low compatibility for energetic groom with fearful horse', async () => {
    const energeticGroom = grooms[1];
    const [fearfulHorse] = horses;

    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({
        groomId: energeticGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'afternoon',
          horseCurrentStress: 9,
          environmentalFactors: ['noisy', 'unfamiliar'],
          recentInteractions: [],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallScore).toBeLessThan(0.4);
    expect(res.body.data.recommendationLevel).toBe('not_recommended');
  });
});

// ─── POST /api/v1/compatibility/predict ──────────────────────────────────────

describe('POST /api/compatibility/predict', () => {
  it('returns 200 when predicting outcome for owned groom and horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: grooms[0].id,
        horseId: horses[0].id,
        context: { taskType: 'foal_care' },
      });

    // 200 success or 400 (validation error) are both acceptable depending on taskType
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see /calculate 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: grooms[0].id, horseId: horses[0].id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: positive outcome prediction for a good
  // (calm groom + fearful horse) pairing.
  it('predicts positive outcome for good compatibility', async () => {
    const [calmGroom] = grooms;
    const [fearfulHorse] = horses;

    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({
        groomId: calmGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          duration: 30,
          environmentalFactors: ['quiet', 'familiar'],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.predictedBondingChange).toBeGreaterThan(0);
    expect(res.body.data.predictedStressChange).toBeLessThan(2);
    expect(['good', 'excellent'].includes(res.body.data.predictedQuality)).toBe(true);
    expect(res.body.data.successProbability).toBeGreaterThan(0.6);
  });

  // Equoria-fefh2.40 migrated: negative outcome prediction for a poor
  // (energetic groom + fearful horse) pairing.
  it('predicts negative outcome for poor compatibility', async () => {
    const energeticGroom = grooms[1];
    const [fearfulHorse] = horses;

    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({
        groomId: energeticGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'desensitization',
          duration: 30,
          environmentalFactors: ['noisy'],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.predictedBondingChange).toBeLessThan(2);
    expect(res.body.data.predictedStressChange).toBeGreaterThanOrEqual(1);
    expect(res.body.data.successProbability).toBeLessThanOrEqual(0.52);
  });
});

// ─── POST /api/v1/compatibility/recommendations ───────────────────────────────

describe('POST /api/compatibility/recommendations', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with recommendations for valid horse and context', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: horses[0].id,
        context: { taskType: 'trust_building' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see /calculate 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horses[0].id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: ranked-groom recommendation shape — verifies the
  // controller ranks the 3 fixture grooms and returns rich per-groom fields.
  it('recommends optimal grooms with ranked-groom shape for a horse and context', async () => {
    const [fearfulHorse] = horses;

    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'morning',
          urgency: 'normal',
          environmentalFactors: ['quiet'],
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.rankedGrooms)).toBe(true);
    expect(res.body.data.rankedGrooms.length).toBeGreaterThan(0);
    expect(res.body.data.topRecommendation).toBeDefined();
    expect(res.body.data.alternativeOptions).toBeDefined();

    const topGroom = res.body.data.rankedGrooms[0];
    expect(topGroom.groomId).toBeDefined();
    expect(topGroom.groomName).toBeDefined();
    expect(topGroom.compatibilityScore).toBeGreaterThan(0);
    expect(topGroom.epigeneticInfluenceType).toBeDefined();
    expect(topGroom.skillLevel).toBeDefined();
    expect(topGroom.reasoning).toBeDefined();
  });
});

// ─── GET /api/v1/compatibility/factors/:groomId/:horseId ─────────────────────

describe('GET /api/compatibility/factors/:groomId/:horseId', () => {
  it('returns 200 with factors for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/${grooms[0].id}/${horses[0].id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/999999999/${horses[0].id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/${grooms[0].id}/${horses[0].id}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: comprehensive factor analysis — verifies all 8
  // factor fields the controller returns.
  it('analyzes compatibility factors comprehensively (all 8 fields)', async () => {
    const [calmGroom] = grooms;
    const [fearfulHorse] = horses;

    const res = await request(app)
      .get(`/api/v1/compatibility/factors/${calmGroom.id}/${fearfulHorse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.personalityMatch).toBeDefined();
    expect(res.body.data.experienceLevel).toBeDefined();
    expect(res.body.data.stressCompatibility).toBeDefined();
    expect(res.body.data.bondingPotential).toBeDefined();
    expect(res.body.data.taskEffectiveness).toBeDefined();
    expect(res.body.data.riskFactors).toBeDefined();
    expect(res.body.data.strengthFactors).toBeDefined();
    expect(res.body.data.overallAssessment).toBeDefined();
  });

  // Equoria-fefh2.40 migrated: 400 for a non-numeric (invalid) groom id —
  // validation rejects before ownership lookup.
  it('returns 400 for an invalid (non-numeric) groom ID', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/invalid/${horses[0].id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/v1/compatibility/trends/:groomId/:horseId ──────────────────────

describe('GET /api/compatibility/trends/:groomId/:horseId', () => {
  it('returns 200 with trends for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/trends/${grooms[0].id}/${horses[0].id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/trends/999999999/${horses[0].id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/trends/${grooms[0].id}/${horses[0].id}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: insufficient_data trend — a fresh groom/horse
  // pair has no interaction history, so the trend is 'insufficient_data'.
  it('analyzes compatibility trends with insufficient data', async () => {
    const [groom] = grooms;
    const [horse] = horses;

    const res = await request(app)
      .get(`/api/v1/compatibility/trends/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.overallTrend).toBe('insufficient_data');
    expect(res.body.data.dataPoints).toBeLessThan(3);
  });
});
