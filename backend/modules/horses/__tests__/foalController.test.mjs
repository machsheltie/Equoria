/**
 * foalRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: development — and that the retired advance-day (Equoria-mwjst) and
 * player-run activity / enrichment / graduate routes (Equoria-fr2kg) stay
 * gone.
 * Routes are mounted at /api/v1/foals (authRouter at /api/v1, foalRoutes at
 * '/foals'; app.mjs:290 + routers.mjs:143). The unversioned /api/* mounts were
 * removed (Equoria-4bs3s), so /api/foals/* now 404s.
 * A "foal" is a Horse with age <= 1.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-n7qa3: fail-loud scoped cleanup — a swallowed cleanup delete leaks
// fixtures into the canonical DB and trips downstream sentinels (CLAUDE.md §2).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';

const cleanup = createCleanupTracker();

let user;
let token;
let foal;

beforeAll(async () => {
  // FK-order scoped cleanup (Equoria-n7qa3): foal child rows -> horse -> user.
  // Horse.userId is onDelete:Restrict (schema:282), so the foal horse row must
  // be deleted BEFORE its owning user, or the user delete throws. Fail-loud:
  // if any of these fails, afterAll goes red so the leak is fixed at source.
  // Before q153 the development read created a default groom and assignment for
  // the user; these scoped deletes keep a red run from leaking them.
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'groomAssignment');
  cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'groom');
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: foal.id } }), 'foalActivity');
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: foal.id } }), 'foalDevelopment');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: foal.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `foal-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `foal${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Foal',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  foal = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-Foal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    }),
  });
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/foals/:foalId/development ───────────────────────────────────

describe('GET /api/v1/foals/:foalId/development', () => {
  it('returns 200 with development data for owned foal', async () => {
    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  // Owner ruling 2026-10-28 (q153): no foal is ever born with, or given, a groom;
  // grooms come from the hiring pool. Old behaviour: this read called
  // ensureDefaultGroomAssignment, which in test mode created a "Sarah Johnson"
  // foal-care groom and an assignment for the foal.
  it('reading a foal gives it no groom and creates no groom (q153)', async () => {
    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(await prisma.groomAssignment.count({ where: { foalId: foal.id } })).toBe(0);
    expect(await prisma.groom.count({ where: { userId: user.id } })).toBe(0);
  });

  it('returns 404 for foal not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/foals/999999999/development')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/foals/${foal.id}/development`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

//
// OLD CONTRACT (vulnerable): "returns 200 or 400 when advancing day for owned
// foal" — any owner could bump FoalDevelopment.currentDay on demand, skipping
// the development week that drives nightly trait revelation. CORRECTED
// CONTRACT (owner ruling 2026-10-05, "THEY DO NOT GET AN ADVANCE DAY"): the
// route is gone; only the nightly trait job advances the day. Full proof,
// including the unchanged development record, lives in
// modules/breeding/__tests__/foalDevelopmentServerAuthoritative.integration.test.mjs.

describe('POST /api/v1/foals/:foalId/advance-day (retired)', () => {
  it('returns 404 to the owner and leaves the development day where it was', async () => {
    const before = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/foals/${foal.id}/advance-day`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    const after = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(after?.currentDay ?? null).toBe(before?.currentDay ?? null);
  });
});

// Owner ruling 2026-10-28 (q153). OLD CONTRACT: POST /api/v1/grooms/ensure-default/:foalId
// gave an owned foal a default groom assignment (creating the groom in test mode).
// NEW: the route is gone; an authenticated owner gets 404 and no groom is created.
describe('POST /api/v1/grooms/ensure-default/:foalId (retired, q153)', () => {
  it('returns 404 and creates no groom or assignment', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/grooms/ensure-default/${foal.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(await prisma.groomAssignment.count({ where: { foalId: foal.id } })).toBe(0);
    expect(await prisma.groom.count({ where: { userId: user.id } })).toBe(0);
  });
});

// ─── Player-run activity / enrichment / graduation (retired) ────────────────
//
// Equoria-fr2kg. OLD CONTRACT: the owner could POST /activity (a stage or
// day activity), /enrichment or its /enrich alias (a day 0-6 enrichment
// activity) and /graduate (close the foal window at age 3); each returned 200
// for a valid request and wrote bond, activity or graduation state.
// NEW RULING (owner, 2026-10-14/15): foal enrichment is the groom's job and
// there is no graduation; the player-run enrichment and graduation were AI
// inventions. The routes are gone: an authenticated owner gets 404 and
// nothing about the foal changes.

describe('retired player-run foal routes (Equoria-fr2kg)', () => {
  const retired = [
    ['activity', { activityType: 'gentleTouch' }],
    ['enrichment', { activity: 'gentleTouch' }],
    ['enrich', { activity: 'gentleTouch' }],
    ['graduate', {}],
  ];

  it.each(retired)('POST /:foalId/%s returns 404 to the owner and changes nothing', async (path, body) => {
    const before = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { bondScore: true },
    });
    const devBefore = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/foals/${foal.id}/${path}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);

    expect(res.status).toBe(404);
    expect(
      await prisma.horse.findUnique({
        where: { id: foal.id },
        select: { bondScore: true },
      }),
    ).toEqual(before);
    expect(await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } })).toEqual(devBefore);
    expect(await prisma.foalActivity.count({ where: { foalId: foal.id } })).toBe(0);
    expect(await prisma.foalTrainingHistory.count({ where: { horseId: foal.id } })).toBe(0);
  });
});

// ─── Named life stages (removed) ────────────────────────────────────────────
// Equoria-fr2kg Q5. OLD CONTRACT: GET /foals/:id, /activities and /development
// carried `ageStage` ('newborn' | 'weanling' | 'yearling' | 'twoYearOld'),
// and GET /foals/:id refused an age-3 horse as "already graduated". NEW RULING
// (owner, 2026-10-15): remove the named life stages; they are not part of the
// design, and there is no graduation. The age-3 refusal itself is unchanged.

describe('foal routes carry no named life stage (Equoria-fr2kg Q5)', () => {
  const get = path =>
    request(app).get(`/api/v1/foals/${path}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

  const makeHorse = async (label, ageYears) => {
    const dob = birthDateForAge(ageYears);
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-Foal-${label}-${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: dob,
        age: ageYears,
        userId: user.id,
      }),
    });
    return horse;
  };
  // Deleted inside each test: the shared tracker deletes the user before any
  // horse registered after it, and Horse.userId is onDelete:Restrict.
  const dropHorse = horse => prisma.horse.deleteMany({ where: { id: horse.id } });

  it('GET /:foalId has no ageStage', async () => {
    const res = await get(foal.id);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('ageStage');
  });

  it('GET /:foalId/activities has no ageStage', async () => {
    const res = await get(`${foal.id}/activities`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('ageStage');
  });

  it('GET /:foalId/development has no ageStage', async () => {
    const res = await get(`${foal.id}/development`);
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('ageStage');
  });

  it('GET /:foalId still serves a 2-year-old', async () => {
    const twoYearOld = await makeHorse('age2', 2);
    try {
      const res = await get(twoYearOld.id);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(twoYearOld.id);
    } finally {
      await dropHorse(twoYearOld);
    }
  });

  it('GET /:foalId refuses an age-3 horse without calling it graduated', async () => {
    const adult = await makeHorse('age3', 3);
    try {
      const res = await get(adult.id);
      expect(res.status).toBe(404);
      expect(res.body.message).not.toMatch(/graduat/i);
    } finally {
      await dropHorse(adult);
    }
  });
});
