/**
 * competitionRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: list, disciplines, show results, horse results, eligibility, enter, claim-prizes.
 * Routes are mounted at /api/v1/competition in authRouter.
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
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let show;
let competitionResult;
const extraShowIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `competition-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `competition${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Competition',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-CompetitionHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });

  show = await prisma.show.create({
    data: {
      name: `TestFixture-CompetitionShow-${Date.now()}`,
      discipline: 'Dressage',
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      prize: 5000,
      entryFee: 100,
      levelMin: 1,
      levelMax: 10,
      status: 'open',
    },
  });

  // Create a competition result so we can test claim-prizes
  competitionResult = await prisma.competitionResult.create({
    data: {
      horseId: horse.id,
      showId: show.id,
      showName: show.name,
      discipline: 'Dressage',
      placement: '1st',
      prizeWon: 5000,
      score: 92.5,
      runDate: new Date(),
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: results -> shows ->
  // horse -> user (Horse.userId is onDelete:Restrict, so the owned horse MUST
  // be deleted before its owner). A cleanup failure now fails the suite so a
  // leaked fixture surfaces at the source instead of a swallowed catch.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { OR: [{ horseId: horse.id }, { showId: show.id }] } }),
    'competitionResult',
  );
  cleanup.add(
    () => (extraShowIds.length ? prisma.show.deleteMany({ where: { id: { in: extraShowIds } } }) : undefined),
    'extraShows',
  );
  cleanup.add(() => prisma.show.delete({ where: { id: show.id } }), 'show');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/competition ─────────────────────────────────────────────────────

describe('GET /api/v1/competition', () => {
  it('returns 200 with list of open competitions for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/competition')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/competition').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/competition/disciplines ────────────────────────────────────────

describe('GET /api/v1/competition/disciplines', () => {
  it('returns 200 with disciplines list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/competition/disciplines')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.disciplines)).toBe(true);
    expect(res.body.data.disciplines.length).toBeGreaterThan(0);
    expect(typeof res.body.data.total).toBe('number');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/competition/disciplines').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/competition/show/:showId/results ───────────────────────────────

describe('GET /api/v1/competition/show/:showId/results', () => {
  it('returns 200 with results for valid show id', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/show/${show.id}/results`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.showId).toBe(show.id);
  });

  it('returns 200 with empty results for show with no entries', async () => {
    const emptyShow = await prisma.show.create({
      data: {
        name: `TestFixture-EmptyShow-${Date.now()}`,
        discipline: 'Dressage',
        runDate: new Date(),
        prize: 1000,
        entryFee: 50,
        levelMin: 1,
        levelMax: 10,
        status: 'open',
      },
    });
    // Register for scoped, fail-loud cleanup in afterAll (Equoria-1ohys) instead
    // of a swallowed inline delete.
    extraShowIds.push(emptyShow.id);

    const res = await request(app)
      .get(`/api/v1/competition/show/${emptyShow.id}/results`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('returns 400 for invalid show id format', async () => {
    const res = await request(app)
      .get('/api/v1/competition/show/not-a-number/results')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/v1/competition/horse/:horseId/results ─────────────────────────────

describe('GET /api/v1/competition/horse/:horseId/results', () => {
  it('returns 200 with results for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/horse/${horse.id}/results`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.horseId).toBe(horse.id);
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/competition/horse/999999999/results')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/competition/horse/${horse.id}/results`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/competition/eligibility/:horseId/:discipline ───────────────────

describe('GET /api/v1/competition/eligibility/:horseId/:discipline', () => {
  it('returns 200 with eligibility for owned horse and valid discipline', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/eligibility/${horse.id}/Dressage`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.horseId).toBe(horse.id);
    expect(res.body.data.discipline).toBe('Dressage');
    expect(res.body.data.eligibility).toBeDefined();
  });

  it('returns 404 for horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/competition/eligibility/999999999/Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid discipline', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/eligibility/${horse.id}/InvalidDisciplineXYZ`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/competition/eligibility/${horse.id}/Dressage`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/competition/enter ─────────────────────────────────────────────

describe('POST /api/v1/competition/enter', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseId does not belong to user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, showId: show.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when showId does not exist', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, showId: 999999999 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/competition/enter')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, showId: show.id });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/competition/enter-show (removed — 410 Gone, Equoria-kacla) ─────
//
// The legacy instant enter-and-run path was removed: it returned competition
// results synchronously, contradicting the 7-day deferred model (nx8t1).
// Auth still runs first (so unauth → 401); for an authenticated caller the
// handler returns 410 unconditionally (no validation/ownership branch — the
// endpoint no longer does any work). Migrated, not skipped (CLAUDE.md).

describe('POST /api/v1/competition/enter-show (removed — 410 Gone)', () => {
  it('returns 410 Gone for an authenticated caller (no instant enter-and-run)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter-show')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.results).toBeUndefined();
    expect(String(res.body.message)).toMatch(/7-day|deferred|\/api\/shows/i);
  });

  it('returns 410 Gone even with valid-looking body (endpoint removed)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/enter-show')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: show.id, horseIds: [horse.id] });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
    expect(res.body.results).toBeUndefined();
  });

  it('returns 401 without auth (auth gate runs before the deprecation handler)', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/competition/enter-show')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showId: show.id, horseIds: [horse.id] });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/competition/:competitionId/claim-prizes ───────────────────────

describe('POST /api/v1/competition/:competitionId/claim-prizes', () => {
  it('returns 200 when claiming prizes for own competition result', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/competition/${competitionResult.id}/claim-prizes`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.competitionResultId).toBe(competitionResult.id);
    expect(res.body.data.horseName).toBeDefined();
  });

  it('returns 404 for competition result not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/999999999/claim-prizes')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid competition id format', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/competition/not-a-number/claim-prizes')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/competition/${competitionResult.id}/claim-prizes`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
