/**
 * traitController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getHorseTraits, getDiscoveryStatus. (getTraitDefinitions and
 * getTraitCompetitionEffects went with GET /traits/definitions and
 * /traits/competition-effects, owner ruling 2026-10-28, q152; Equoria-a7f1p;
 * pinned in removedTraitReportRoutes.) (discoverTraits and its POST /traits/discover/:horseId
 * route were removed by Equoria-gu8jk — players never reveal traits.)
 * Routes live under authRouter (mounted at /api/v1) at /api/v1/traits.
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
// Equoria-1ohys: fail-loud scoped cleanup. A silent no-op catch arm on the
// afterAll deletes leaks fixture rows into the canonical DB (CLAUDE.md §2) and
// keeps the suite green while a leak trips downstream sentinels. The tracker
// runs every registered scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
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

  // FK order: horse(s) before user (Horse.userId is onDelete: Restrict).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

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

  // Equoria-ecp0i. OLD CONTRACT: discoveryConditions carried an `enrichment`
  // list (six player-run enrichment activity names) counted into `total` and
  // `canDiscover`. NEW RULING (owner, 2026-10-16, fr2kg F14): nothing produces
  // those activities since the player-run enrichment was removed, so the list
  // is gone; `total` counts the met conditions only.
  it('carries no enrichment discovery list (Equoria-ecp0i)', async () => {
    const res = await request(app)
      .get(`/api/v1/traits/discovery-status/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { discoveryConditions } = res.body.data;
    expect(discoveryConditions).not.toHaveProperty('enrichment');
    expect(discoveryConditions.total).toBe(discoveryConditions.met.length);
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
