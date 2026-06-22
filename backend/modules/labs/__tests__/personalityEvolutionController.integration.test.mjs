/**
 * personalityEvolutionController integration tests (Equoria-rr7 coverage sprint;
 * Equoria-fefh2.40 consolidation — the legacy top-level
 * backend/tests/controllers/personalityEvolutionController.test.mjs was merged
 * in here, its canonical home per CONTRIBUTING.md module-test co-location).
 *
 * Covers: evolveGroomPersonality, evolveHorseTemperament, getEvolutionTriggers,
 * getPersonalityStability, predictPersonalityEvolution, getEvolutionHistory,
 * applyEvolutionEffects, batchEvolve, getPersonalityConfig.
 * Routes live under authRouter at /api/v1/personality-evolution (Equoria-vivsi:
 * the unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:191).
 *
 * Equoria-fefh2.40: the migrated success/shape/branch-value tests need a richer
 * fixture than the original groom+horse beforeAll (which had no interaction
 * history). The top-level fixture's 20-iteration groomInteraction seed loop,
 * nervous-temperament horse (stressLevel/bondScore), and groom
 * epigeneticInfluenceType are ported below so evolution/triggers/stability/
 * history have real history to compute against. Interaction ids are tracked in
 * the fail-loud cleanup tracker and deleted FIRST (FK order:
 * groomInteraction -> horse -> groom -> user -> breed).
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
// Equoria-twmpa: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. groomInteraction -> horse -> groom -> user
// -> breed (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

// Reference date anchor for a 2-year-old horse (matches the migrated fixture).
const referenceDate = new Date('2025-06-01T12:00:00Z');
const birthDate2YearsOld = new Date(referenceDate);
birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2); // 2023-06-01 (age 2)

let user;
let token;
let groom;
let horse;
let breed;
// Equoria-plw0h: CSRF pair bound to the acting identity — fetched after the
// fixture token exists, forwarding the accessToken cookie so issuance binds to
// user.id (an anonymous salt-bound token would 403 on authenticated mutations).
let csrfPair;
const cleanup = createCleanupTracker();
const interactionIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `pevol-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `pevol${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'PEvol',
      lastName: 'Tester',
      money: 5000,
      xp: 0,
      level: 1,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Equoria-plw0h: CSRF pair bound to the acting identity — fetched after the
  // fixture token exists, forwarding the accessToken cookie so
  // tryPopulateUserFromAccessCookie binds issuance to user.id.
  csrfPair = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

  breed = await prisma.breed.create({
    data: {
      name: `TestFixture-PersEvoBreed-${randomBytes(8).toString('hex')}`,
      description: 'Test breed for personality evolution API testing',
    },
  });

  // Equoria-fefh2.40: groom carries an epigeneticInfluenceType so evolution /
  // stability logic has a personality-influence basis to compute against.
  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-EvolGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'calm',
      epigeneticInfluenceType: 'calm',
      skillLevel: 'intermediate',
      experience: 100,
      level: 5,
      sessionRate: 25.0,
      isActive: true,
      userId: user.id,
    },
  });

  // Equoria-fefh2.40: nervous temperament + stress/bond seed values so the
  // horse has real evolution-relevant state.
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EvolHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: birthDate2YearsOld,
      age: 2,
      temperament: 'nervous',
      stressLevel: 7,
      bondScore: 20,
      healthStatus: 'Good',
      userId: user.id,
      breedId: breed.id,
    },
  });

  // Equoria-fefh2.40: 20-interaction history so triggers / stability / history /
  // evolution endpoints have real care-pattern data to analyze.
  for (let i = 0; i < 20; i++) {
    const interaction = await prisma.groomInteraction.create({
      data: {
        groomId: groom.id,
        foalId: horse.id,
        taskType: 'trust_building',
        interactionType: 'enrichment',
        bondingChange: 2,
        stressChange: -2,
        quality: 'excellent',
        cost: 25.0,
        duration: 30,
        notes: 'API test interaction for evolution',
      },
    });
    interactionIds.push(interaction.id);
  }

  // FK-ordered, id-scoped, fail-loud sweep (interactions FIRST).
  cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { id: { in: interactionIds } } }), 'groomInteractions');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'breed');
}, 60000);

afterAll(() => cleanup.run(), 60000);

// ─── GET /api/v1/personality-evolution/config ─────────────────────────────────

describe('GET /api/personality-evolution/config', () => {
  it('returns 200 with personality evolution configuration', async () => {
    const res = await request(app)
      .get('/api/v1/personality-evolution/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/personality-evolution/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: full config response-shape.
  it('returns the full system configuration shape', async () => {
    const res = await request(app)
      .get('/api/v1/personality-evolution/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.evolutionTypes).toBeDefined();
    expect(Array.isArray(res.body.data.evolutionTypes)).toBe(true);
    expect(res.body.data.entityTypes).toBeDefined();
    expect(res.body.data.groomConfig).toBeDefined();
    expect(res.body.data.horseConfig).toBeDefined();
    expect(res.body.data.availableTraits).toBeDefined();
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/triggers ─────────

describe('GET /api/personality-evolution/:entityType/:entityId/triggers', () => {
  it('returns 200 with triggers for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 200 with triggers for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/horse/${horse.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for invalid entityType', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/trainer/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/triggers`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: triggers response-shape for groom — triggers +
  // numeric evolutionReadiness fields.
  it('returns triggers and a numeric evolutionReadiness for groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.triggers).toBeDefined();
    expect(res.body.data.evolutionReadiness).toBeDefined();
    expect(typeof res.body.data.evolutionReadiness).toBe('number');
  });

  // Equoria-fefh2.40 migrated: triggers response-shape for horse.
  it('returns triggers and evolutionReadiness for horse', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/horse/${horse.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.triggers).toBeDefined();
    expect(res.body.data.evolutionReadiness).toBeDefined();
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/stability ────────

describe('GET /api/personality-evolution/:entityType/:entityId/stability', () => {
  it('returns 200 with stability data for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/stability`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: stability response-shape for groom — numeric
  // stabilityScore + stabilityFactors.
  it('returns a numeric stabilityScore and stabilityFactors for groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.stabilityScore).toBeDefined();
    expect(typeof res.body.data.stabilityScore).toBe('number');
    expect(res.body.data.stabilityFactors).toBeDefined();
  });

  // Equoria-fefh2.40 migrated: horse-stability shape had ZERO co-located
  // equivalent before this migration.
  it('returns stabilityScore and stabilityFactors for horse', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/horse/${horse.id}/stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.stabilityScore).toBeDefined();
    expect(res.body.data.stabilityFactors).toBeDefined();
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/predict ──────────

describe('GET /api/personality-evolution/:entityType/:entityId/predict', () => {
  it('returns 200 with prediction for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/predict`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/predict`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: predict response-shape with default timeframe —
  // predictions array.
  it('predicts personality evolution with default timeframe (predictions array)', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/predict`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.predictions).toBeDefined();
    expect(Array.isArray(res.body.data.predictions)).toBe(true);
  });

  // Equoria-fefh2.40 migrated: predict with a custom ?timeframeDays=60.
  it('predicts personality evolution with a custom timeframe', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/horse/${horse.id}/predict?timeframeDays=60`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.predictions).toBeDefined();
  });

  // Equoria-fefh2.40 migrated: 400 for an out-of-range timeframe (HTTP level).
  it('returns 400 for an invalid timeframe', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/predict?timeframeDays=500`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/history ──────────

describe('GET /api/personality-evolution/:entityType/:entityId/history', () => {
  it('returns 200 with evolution history for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: history response-shape — evolutionEvents array +
  // totalEvolutions.
  it('returns evolutionEvents array and totalEvolutions', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.evolutionEvents).toBeDefined();
    expect(Array.isArray(res.body.data.evolutionEvents)).toBe(true);
    expect(res.body.data.totalEvolutions).toBeDefined();
  });
});

// ─── POST /api/v1/personality-evolution/groom/:groomId/evolve ────────────────

describe('POST /api/personality-evolution/groom/:groomId/evolve', () => {
  it('returns 200 when evolving personality for owned groom', async () => {
    // Equoria-vivsi: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's
    // tryPopulateUserFromAccessCookie binds the token to user.id; otherwise
    // issuance falls back to the salt and validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
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
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/personality-evolution/groom/999999999/evolve')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83) and runs before csrfProtection
    // (routers.mjs:93,95), so a no-auth request 401s before CSRF validation.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: success-path response-shape — message + boolean
  // personalityEvolved. Uses the identity-bound CSRF pair so the mutation 200s.
  it('evolves groom personality successfully (message + boolean personalityEvolved)', async () => {
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('evolution');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.success).toBe(true);
    expect(typeof res.body.data.personalityEvolved).toBe('boolean');
  });

  // Equoria-fefh2.40 migrated: 400 for an invalid (non-numeric) groom id.
  it('returns 400 for an invalid groom ID', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/groom/invalid/evolve')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });
});

// ─── POST /api/v1/personality-evolution/horse/:horseId/evolve ────────────────

describe('POST /api/personality-evolution/horse/:horseId/evolve', () => {
  it('returns 200 when evolving temperament for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/personality-evolution/horse/${horse.id}/evolve`)
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
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/personality-evolution/horse/999999999/evolve')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see groom evolve 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/personality-evolution/horse/${horse.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });

  // Equoria-fefh2.40 migrated: success-path response-shape — message + boolean
  // temperamentEvolved.
  it('evolves horse temperament successfully (message + boolean temperamentEvolved)', async () => {
    const res = await request(app)
      .post(`/api/v1/personality-evolution/horse/${horse.id}/evolve`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('evolution');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.success).toBe(true);
    expect(typeof res.body.data.temperamentEvolved).toBe('boolean');
  });

  // Equoria-fefh2.40 migrated: 400 for an invalid (non-numeric) horse id.
  it('returns 400 for an invalid horse ID', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/horse/invalid/evolve')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });
});

// ─── POST /api/v1/personality-evolution/apply-effects ────────────────────────
// Equoria-fefh2.40 migrated: NO co-located HTTP version existed before this.

describe('POST /api/personality-evolution/apply-effects', () => {
  it('applies personality evolution effects successfully', async () => {
    const evolutionData = {
      entityId: groom.id,
      entityType: 'groom',
      evolutionType: 'trait_strengthening',
      newTraits: ['enhanced_patience'],
      stabilityPeriod: 14,
      effectStrength: 0.8,
    };

    const res = await request(app)
      .post('/api/v1/personality-evolution/apply-effects')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send(evolutionData)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.effectsApplied).toBeDefined();
  });

  it('returns 400 for missing required fields', async () => {
    const invalidData = {
      entityId: groom.id,
      // Missing entityType and evolutionType
    };

    const res = await request(app)
      .post('/api/v1/personality-evolution/apply-effects')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send(invalidData)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });
});

// ─── POST /api/v1/personality-evolution/batch-evolve ─────────────────────────
// Equoria-fefh2.40 migrated: NO co-located HTTP version existed before this.

describe('POST /api/personality-evolution/batch-evolve', () => {
  it('processes batch evolution successfully', async () => {
    const batchData = {
      entities: [
        { entityId: groom.id, entityType: 'groom' },
        { entityId: horse.id, entityType: 'horse' },
      ],
    };

    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send(batchData)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.results).toBeDefined();
    expect(Array.isArray(res.body.data.results)).toBe(true);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.summary).toBeDefined();
  });

  it('returns 400 for empty entities array', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrfPair.cookieHeader)
      .set('X-CSRF-Token', csrfPair.csrfToken)
      .send({ entities: [] })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation failed');
  });
});
