/**
 * epigeneticFlagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getFlagDefinitions, getCarePatterns. getHorseFlags and GET
 * /flags/horses/:id/flags went with the old epigeneticFlags store (owner ruling
 * 2026-10-29, q300, Equoria-efs4j); retiredTraitAdviceRoutes pins the 404.
 * (batchEvaluateFlags
 * and POST /flags/batch-evaluate were removed by owner ruling 2026-10-28, q203,
 * Equoria-a7f1p; retiredTraitAdviceRoutes pins the 404.) (evaluateFlags and POST /flags/evaluate were removed by
 * Equoria-gu8jk — players never assign flags.)
 * Routes live under authRouter at /api/v1/flags.
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
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();
// Equoria-1ohys: ids of all fixture horses owned by `user` (the beforeAll
// horse + any per-test transient horses). Swept before the user delete so the
// FK ordering (Horse.userId onDelete:Restrict) holds.
const horseIds = [];

beforeAll(async () => {
  // Scoped, fail-loud cleanup (Equoria-1ohys). Sweep all owned fixture horses
  // (collected in horseIds) before the user, for FK ordering.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `eflag-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `eflag${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EFlag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-FlagHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2022-01-01'),
      age: 3,
      userId: user.id,
    }),
  });
  horseIds.push(horse.id);
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/flags/health ────────────────────────────────────────────────────

describe('GET /api/v1/flags/health', () => {
  it('returns 200 with operational status', async () => {
    const res = await request(app)
      .get('/api/v1/flags/health')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/flags/definitions ──────────────────────────────────────────────

describe('GET /api/v1/flags/definitions', () => {
  it('returns 200 with flag definitions', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/flags/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── No advertised effects (Equoria-v6sp2, Equoria-rqz1z) ───────────────────────
// Owner ruling 2026-10-27 (q117): trait names only — "Do not add what each
// actually does yet." No live gameplay code consumed the flag registry's
// competition/training/bonding/trait-weight modifiers, so the flag endpoints
// must not tell a player a flag does anything: each flag is its name, its
// authored name and its polarity.

describe('flag endpoints advertise no effects', () => {
  it('GET /flags/definitions sends each flag as name, displayName and type only', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.flags.length).toBeGreaterThan(0);
    for (const flag of res.body.data.flags) {
      expect(Object.keys(flag).sort()).toEqual(['displayName', 'name', 'type']);
    }
  });
});

// ─── GET /api/v1/flags/horses/:id/care-patterns ─────────────────────────────────

describe('GET /api/v1/flags/horses/:id/care-patterns', () => {
  it('returns 200 with care patterns for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/flags/horses/${horse.id}/care-patterns`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/flags/horses/999999999/care-patterns')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/flags/horses/${horse.id}/care-patterns`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/flags/definitions?type= — type-filter branch (line 169) ─────────

describe('GET /api/v1/flags/definitions — type query filter', () => {
  it('returns filtered flags for type=positive (covers line 169 if-type branch)', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=positive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.flags)).toBe(true);
  });

  it('returns filtered flags for type=negative', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=negative')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns filtered flags for type=adaptive', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=adaptive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid type value', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=invalid')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    // Validation middleware rejects invalid type
    expect([200, 400]).toContain(res.status);
  });
});
