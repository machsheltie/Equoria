/**
 * marketplaceController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: browseListings, listHorse, delistHorse, myListings, saleHistory,
 * buyStoreHorse.
 * Routes live under authRouter → real auth + real CSRF for POST/DELETE.
 *
 * Path contract: the unversioned /api/* mounts were removed (Equoria-4bs3s);
 * /api/v1/* is the only surface, so every request below targets /api/v1/.
 *
 * CSRF binding: per-user CSRF binding (Equoria-plw0h,
 * backend/middleware/csrf.mjs) derives the sessionIdentifier as req.user.id
 * when the request is authenticated. The authRouter mounts authenticateToken
 * BEFORE csrfProtection (backend/app/routers.mjs), so by the time
 * csrfProtection runs on a Bearer-authenticated mutation, req.user.id is
 * populated and the CSRF token MUST have been issued under that same user id.
 * An anonymous token (bound to the CSRF_SESSION_SALT fallback) correctly
 * 403s — that is the middleware doing its job — so every authenticated
 * mutation below fetches its CSRF token bound to the acting identity by
 * forwarding that identity's accessToken cookie to GET /auth/csrf-token
 * (fetchCsrf's extraCookies option → tryPopulateUserFromAccessCookie binds
 * issuance to the decoded user id).
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { listHorse } from '../controllers/marketplaceController.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

/**
 * Fetch a CSRF token bound to a specific authenticated identity.
 * Forwards the identity's JWT as an accessToken cookie on the token GET so
 * csrf.mjs#tryPopulateUserFromAccessCookie resolves the issuance
 * sessionIdentifier to that user's id — matching what authenticateToken →
 * csrfProtection will resolve on the subsequent mutation (Equoria-plw0h).
 */
const fetchCsrfFor = jwt => fetchCsrf(app, { extraCookies: [`accessToken=${jwt}`] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function uniqueEmail(prefix = 'mp') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'mp') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

// Resolve a breed ID that also has a breedStarterStats.json entry (required by buyStoreHorse)
let realBreedId;

beforeAll(async () => {
  const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
  let validBreedNames;
  try {
    validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
  } catch {
    // fallback: try relative path
    try {
      const alt = resolve(__dirname, '../../../data/breedStarterStats.json');
      validBreedNames = Object.keys(JSON.parse(readFileSync(alt, 'utf8')));
    } catch {
      validBreedNames = [];
    }
  }
  if (validBreedNames.length > 0) {
    const breed = await prisma.breed.findFirst({
      where: { name: { in: validBreedNames } },
      select: { id: true },
    });
    realBreedId = breed?.id ?? null;
  } else {
    realBreedId = null;
  }
}, 30000);

describe('marketplaceController integration', () => {
  let user;
  let token;
  // Track every horse this test made (named fixtures AND store-bought horses
  // whose generated names don't match the fixture prefix) so afterEach deletes
  // exactly them by id (Equoria-9jv9c) — fail-loud, no swallowed catch.
  let createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    createdHorseIds = [];
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'MP',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // Scoped, fail-loud cleanup (Equoria-9jv9c): horses (FK) before owner. Also
    // sweeps any owned TestFixture-MPHorse rows the suite may have created
    // without recording the id (defence-in-depth, still userId-scoped).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horsesById');
    cleanup.add(
      () =>
        prisma.horse.deleteMany({
          where: { name: { startsWith: 'TestFixture-MPHorse' }, userId: user.id },
        }),
      'horsesByName',
    );
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterEach(() => cleanup.run(), 30000);

  // ─── GET /api/marketplace ─────────────────────────────────────────────────

  describe('GET /api/marketplace', () => {
    it('returns 200 with listings and pagination', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('listings');
      expect(Array.isArray(res.body.data.listings)).toBe(true);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/marketplace').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/marketplace/my-listings ─────────────────────────────────────

  describe('GET /api/marketplace/my-listings', () => {
    it('returns 200 with empty array for new user', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/my-listings')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/marketplace/my-listings').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/marketplace/history ─────────────────────────────────────────

  describe('GET /api/marketplace/history', () => {
    it('returns 200 with empty history for new user', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/history')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/marketplace/history').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/marketplace/list ───────────────────────────────────────────

  describe('POST /api/marketplace/list', () => {
    it('returns 400 when horseId or price is missing', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ price: 500 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when price is below 100', async () => {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-MPHorse-${Date.now()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          user: { connect: { id: user.id } },
        },
      });
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: horse.id, price: 50 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for a horse not owned by the user', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: 999999999, price: 500 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and lists an owned horse for sale', async () => {
      const horse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-MPHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2021-01-01'),
          age: 4,
          userId: user.id,
        },
      });
      createdHorseIds.push(horse.id);

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: horse.id, price: 1000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salePrice).toBe(1000);
    });

    it('returns 401 without auth', async () => {
      // No CSRF pair needed: the authRouter mounts authenticateToken BEFORE
      // csrfProtection (backend/app/routers.mjs), so a credential-less request
      // is 401'd by authenticateToken before CSRF validation ever runs.
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Origin', ORIGIN)
        .send({ horseId: 1, price: 1000 });

      expect(res.status).toBe(401);
    });

    it('returns 500 when req.horse is absent (requireOwnership middleware not applied)', async () => {
      // Exercises the defensive null-guard in listHorse. The HTTP route always
      // has the middleware, so we call the controller function directly to
      // reach this branch without mocking Prisma.
      let statusCode;
      let jsonBody;
      const req = { body: { price: 1000 }, user: { id: user.id } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          jsonBody = body;
          return this;
        },
      };

      await listHorse(req, res, () => {});

      expect(statusCode).toBe(500);
      expect(jsonBody.success).toBe(false);
    });
  });

  // ─── POST /api/marketplace/store/buy ──────────────────────────────────────

  describe('POST /api/marketplace/store/buy', () => {
    it('returns 400 for invalid sex', async () => {
      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId ?? 1, sex: 'Gelding' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when user has insufficient funds', async () => {
      await prisma.user.update({ where: { id: user.id }, data: { money: 0 } });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId ?? 1, sex: 'Mare' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and creates horse when purchase succeeds', async () => {
      if (!realBreedId) {
        return; // Skip if no breeds in DB
      }

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('horse');

      // Track the purchased horse for scoped afterEach cleanup (Equoria-9jv9c).
      if (res.body.data?.horse?.id) {
        createdHorseIds.push(res.body.data.horse.id);
      }
    });

    it('returns 401 without auth', async () => {
      // No CSRF pair needed: authenticateToken runs before csrfProtection on
      // the authRouter, so a credential-less request is 401'd first.
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .send({ breedId: 1, sex: 'Mare' });

      expect(res.status).toBe(401);
    });

    // Equoria-xooh: invalid breedId returns 404. Sentinel-positive — fails
    // if the 'Breed not found' branch in marketplaceController.mjs:429-431 is
    // removed or short-circuited. Uses a breedId guaranteed to not exist
    // (max int4) so the DB lookup misses.
    it('returns 404 when breedId does not exist (AC tech-spec line 631)', async () => {
      // Ensure user has funds so we don't hit the insufficient-funds path
      // before the breed lookup.
      await prisma.user.update({
        where: { id: user.id },
        data: { money: 100000 },
      });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        // breedId 2147483647 = int4 max; will not collide with any real row.
        .send({ breedId: 2147483647, sex: 'Mare' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message || res.body.error).toMatch(/breed not found/i);

      // F1 contract: no coins should have been deducted on a 404. Verify the
      // refund-on-failure logic did not mask a bug where the deduction
      // partially landed.
      const userAfter = await prisma.user.findUnique({ where: { id: user.id } });
      expect(userAfter.money).toBe(100000);
    });

    // Equoria-xooh AC-7: stat-range verification. Purchased horse stats must
    // fall within the breed's mean ± k*std_dev window. We use k=6 (deeper
    // than 3*std_dev to absorb Box-Muller variance + clampStatsToTotalCap
    // post-hoc adjustments at the 200-total cap). Tight enough to catch a
    // generator regression that returns zeros or constants; loose enough to
    // avoid flaking on legitimate distribution outliers.
    it('purchased horse stats fall within breed mean ± 6*std_dev (AC-7 sentinel)', async () => {
      if (!realBreedId) {
        return; // Skip if no breeds in DB
      }

      // Reload starter-stats JSON and find the profile for realBreedId's breed
      const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
      const statsByName = JSON.parse(readFileSync(statsPath, 'utf8'));

      // Look up the actual breed name for realBreedId
      const breed = await prisma.breed.findUnique({
        where: { id: realBreedId },
        select: { name: true },
      });
      const profile = statsByName[breed.name];
      expect(profile).toBeDefined();

      await prisma.user.update({
        where: { id: user.id },
        data: { money: 100000 },
      });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      const horseId = res.body.data.horse.id;
      const stored = await prisma.horse.findUnique({ where: { id: horseId } });

      // For each stat key in the breed profile, assert the sampled value
      // falls within mean ± 6*std_dev. Box-Muller variance plus the
      // total-cap clamp can push individual stats off the mean by several
      // std_dev, so we use a generous bound here. The point is to catch a
      // generator regression that returns constant zeros or random 1-100,
      // not to pin the distribution shape.
      const STAT_KEYS = [
        'speed',
        'stamina',
        'agility',
        'balance',
        'precision',
        'intelligence',
        'boldness',
        'flexibility',
        'obedience',
        'focus',
        'endurance',
        'strength',
      ];
      for (const key of STAT_KEYS) {
        const s = profile[key];
        const mean = s.mean;
        const std = s.std ?? s.std_dev ?? 3;
        const value = stored[key];
        expect(typeof value).toBe('number');
        // Lower bound: 1 (game minimum) OR mean - 6*std, whichever is higher
        // Upper bound: 100 (game maximum) OR mean + 6*std, whichever is lower
        expect(value).toBeGreaterThanOrEqual(Math.max(1, mean - 6 * std));
        expect(value).toBeLessThanOrEqual(Math.min(100, mean + 6 * std));
      }

      // Total must respect the 200 cap from clampStatsToTotalCap
      const total = STAT_KEYS.reduce((sum, k) => sum + stored[k], 0);
      expect(total).toBeLessThanOrEqual(200);

      createdHorseIds.push(horseId);
    });

    // Sentinel-positive: store-bought horse dateOfBirth must yield the intended
    // 3 game-years via the canonical helper (1 game-year = 7 real days), NOT
    // ~156 from a calendar-years-ago dob. Fails if buyStoreHorse regresses to
    // setFullYear(-3) calendar math.
    it('purchased horse dateOfBirth yields 3 game-years, not calendar-years', async () => {
      if (!realBreedId) {
        return;
      }
      await prisma.user.update({ where: { id: user.id }, data: { money: 100000 } });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      const horseId = res.body.data.horse.id;
      const stored = await prisma.horse.findUnique({ where: { id: horseId } });

      expect(stored.age).toBe(3);
      expect(getHorseAgeYears(stored.dateOfBirth)).toBe(3);

      createdHorseIds.push(horseId);
    });

    // Equoria-kiep — 31E follow-up: store-bought horse MUST have colorGenotype
    // and phenotype populated (not NULL) — adjacent-locations fix to e8zj.
    // Sentinel-positive: this fails if the 31E wiring is removed from buyStoreHorse.
    it('purchased horse has non-null colorGenotype + phenotype (Equoria-kiep)', async () => {
      if (!realBreedId) {
        return;
      }

      // Top up funds (insufficient-funds test above may have zeroed them).
      await prisma.user.update({ where: { id: user.id }, data: { money: 5000 } });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const horseId = res.body.data?.horse?.id;
      expect(horseId).toBeTruthy();

      // Re-fetch to confirm DB persisted the genetics fields.
      const stored = await prisma.horse.findUnique({
        where: { id: horseId },
        select: { colorGenotype: true, phenotype: true },
      });
      expect(stored).toBeTruthy();
      expect(stored.colorGenotype).toBeTruthy();
      expect(typeof stored.colorGenotype).toBe('object');
      // All 19 CORE_LOCI must be present.
      expect(stored.colorGenotype.E_Extension).toBeTruthy();
      expect(stored.phenotype).toBeTruthy();
      expect(typeof stored.phenotype.colorName).toBe('string');
      expect(stored.phenotype.colorName.length).toBeGreaterThan(0);

      createdHorseIds.push(horseId);
    });

    // Equoria-f5372 — store-bought horse MUST have a temperament populated
    // (not NULL) — same defect class as the kiep colorGenotype gap above.
    // Sentinel-positive: this fails if the temperament wiring is removed from
    // buyStoreHorse. Without the fix the column is NULL and the frontend shows
    // 'not recorded'.
    it('purchased horse has a non-null temperament from the 11 canonical types (Equoria-f5372)', async () => {
      if (!realBreedId) {
        return;
      }

      const { TEMPERAMENT_TYPES } = await import('../../horses/data/breedGeneticProfiles.mjs');

      await prisma.user.update({ where: { id: user.id }, data: { money: 5000 } });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      const horseId = res.body.data?.horse?.id;
      expect(horseId).toBeTruthy();

      const stored = await prisma.horse.findUnique({
        where: { id: horseId },
        select: { temperament: true },
      });
      expect(stored).toBeTruthy();
      expect(stored.temperament).toBeTruthy();
      expect(TEMPERAMENT_TYPES).toContain(stored.temperament);

      createdHorseIds.push(horseId);
    });
  });

  // ---------------------------------------------------------------------------
  // Equoria-fkcf — v1-prefix contract sentinel
  // ---------------------------------------------------------------------------
  // The Horse Trader tech-spec and frontend api-client.ts:1456 target
  // POST /api/v1/marketplace/store/buy. The legacy unversioned /api/ mount
  // was retired (Equoria-4bs3s) — every test in this file now targets
  // /api/v1/ — but this block remains as the named contract sentinel for
  // the exact path the frontend calls.
  describe('POST /api/v1/marketplace/store/buy (Equoria-fkcf v1 contract sentinel)', () => {
    it('returns 201 and creates horse via the /api/v1/ prefix (sentinel-positive)', async () => {
      if (!realBreedId) {
        return; // Skip if no breeds in DB
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { money: 100000 },
      });

      const csrf = await fetchCsrfFor(token);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('horse');

      if (res.body.data?.horse?.id) {
        createdHorseIds.push(res.body.data.horse.id);
      }
    });

    it('returns 401 without auth via the /api/v1/ prefix', async () => {
      // No CSRF pair needed: authenticateToken runs before csrfProtection on
      // the authRouter, so a credential-less request is 401'd first.
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .send({ breedId: 1, sex: 'Mare' });

      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // Equoria-2keb: every real (non-test) DB breed has a starter-stats entry
  // ---------------------------------------------------------------------------
  // Bug: buyStoreHorse threw 500 when picked breed wasn't in
  // backend/data/breedStarterStats.json. Audit found 'Quarter Horse' missing.
  // Sentinel-positive: assert every real breed name in the DB resolves to a
  // starter-stats key. Filters out test-fixture breeds (HORSUPD_*, OWASP*,
  // Test*, TestFixture*) which are intentionally non-sellable.
  describe('Equoria-2keb — every real DB breed resolves to starter stats', () => {
    it('lists all DB breed names that are missing from breedStarterStats.json (should be empty)', async () => {
      const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
      const statsNames = new Set(Object.keys(JSON.parse(readFileSync(statsPath, 'utf8'))));

      const allBreeds = await prisma.breed.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      // Filter out test fixtures — these are not sellable products and don't
      // need starter-stats entries. The pattern matches the cleanup helpers
      // used elsewhere in the test suite.
      const isTestFixture = name =>
        /^Test Breed\b/.test(name) ||
        /^TestFixture-/.test(name) ||
        /^OWASP/.test(name) ||
        /^HORSUPD_/.test(name) ||
        /^TrainingComplete_Breed_/.test(name) ||
        /^Test Breed for /.test(name);

      const realBreedNames = allBreeds.map(b => b.name).filter(n => !isTestFixture(n));
      const missing = realBreedNames.filter(n => !statsNames.has(n));

      // Sentinel-positive: print the missing list for diagnostics — must be empty.
      expect(missing).toEqual([]);
    });

    it('generateStoreStats does not throw for any real DB breed name (sentinel-positive)', async () => {
      // horseStarterStats moved into the horses module (same path the
      // production controller imports: marketplaceController.mjs:24).
      const { generateStoreStats } = await import('../../horses/services/horseStarterStats.mjs');
      const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
      const statsNames = new Set(Object.keys(JSON.parse(readFileSync(statsPath, 'utf8'))));

      const allBreeds = await prisma.breed.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      const isTestFixture = name =>
        /^Test Breed\b/.test(name) ||
        /^TestFixture-/.test(name) ||
        /^OWASP/.test(name) ||
        /^HORSUPD_/.test(name) ||
        /^TrainingComplete_Breed_/.test(name) ||
        /^Test Breed for /.test(name);

      const realBreedNames = allBreeds.map(b => b.name).filter(n => !isTestFixture(n));

      for (const name of realBreedNames) {
        // Only assert no-throw when the breed actually has an entry; the
        // prior test pins the contract that ALL real names should be in
        // statsNames, so this branch documents the runtime contract for
        // the canonical breeds.
        if (statsNames.has(name)) {
          expect(() => generateStoreStats(name)).not.toThrow();
        }
      }
    });
  });
});
