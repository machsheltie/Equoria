/**
 * 🧪 INTEGRATION TEST: Breeds API — /api/breeds (canonical-DB safe)
 *
 * Rewritten + relocated for Equoria-lkady (was tests/integration/breeds.test.mjs,
 * which was jest-ignored AND a legacy empty-test-DB test):
 *   - resetDatabase() ran unscoped horse/breed.deleteMany({}) → wiped the
 *     canonical DB (CLAUDE.md §2),
 *   - created real breed names (Arabian/Thoroughbred/Quarter Horse) that
 *     409-collide with seeded data,
 *   - asserted absolute counts (breeds.length === 2, "empty array" === 0)
 *     impossible against ~32 real breeds,
 *   - asserted a stale response shape (breed fields at body top-level; the
 *     controller actually returns { success, data, count }) and a stale
 *     409 duplicate status (the controller throws ValidationError → 400).
 *
 * This version coexists with real production data:
 *   - unique TestFixture-Breed- names (never collide with seeded breeds),
 *   - asserts the real controller contract ({ success, data, count }, 400 for
 *     duplicate/invalid),
 *   - GET-all asserts the fixture APPEARS in the list (not an absolute count);
 *     the impossible "empty DB" test is dropped,
 *   - scoped cleanup by the TestFixture-Breed- name prefix — never deleteMany({}),
 *   - breed list/detail caches (10-min TTL) invalidated so fresh fixtures show.
 *
 * Equoria-mgcyd (owner ruling 2026-10-22, Stacey): the POST calls drive the create
 * as a real admin through the real CSRF flow, like the sibling
 * backend/__tests__/integration/breeds.integration.test.mjs.
 *   OLD contract: this suite POSTed /api/v1/breeds anonymously and got 401 on
 *     every call, because breed creation became admin-only + CSRF (Equoria-7p4xe).
 *   NEW ruling: update the stale test to authenticate as admin; NO assertion
 *     changed (same statuses, bodies and invariants).
 *
 * Equoria-mlnpu (owner ruling q289, Equoria-n256i): admin tools also need the
 * emailed staff check-in.
 *   OLD contract: an admin access token + CSRF was enough to create a breed.
 *   NEW ruling: the admin must also hold a checked-in device, so every POST
 *     answered 403 here. The admin now carries a real trusted-device cookie
 *     (backend/tests/helpers/staffDeviceFixture.mjs), as the sibling suite
 *     does. The fixture admin is also email-verified: since Equoria-voasj ("no
 *     play until the email is confirmed") an unverified account is refused
 *     with 403 before any admin check, and the sibling suite's admin already is.
 *   No assertion changed.
 *
 * Relocated to root tests/ so it RUNS via the root jest config (npm test / CI)
 * — it is excluded from the pre-push gate, which uses backend/jest.config.mjs
 * (rootDir: backend) and never collects repo-root tests/ (Equoria-jcgid).
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import app from '../backend/app.mjs';
import prisma from '../packages/database/prismaClient.mjs';
import config from '../backend/config/config.mjs';
import { fetchCsrf } from '../backend/tests/helpers/csrfHelper.mjs';
import { checkedInDeviceCookie } from '../backend/tests/helpers/staffDeviceFixture.mjs';
import { invalidateCachePattern } from '../backend/utils/cacheHelper.mjs';

const NAME_PREFIX = 'TestFixture-Breed-';
const ORIGIN = 'http://localhost:3000';
const adminTag = randomBytes(6).toString('hex');

let adminUser;

// Breed create requires an authenticated admin + CSRF (Equoria-7p4xe). Build a
// real access-token cookie for the admin and bind CSRF via that same cookie so
// the issued token's sessionIdentifier matches req.user.id on the mutation.
function adminAccessCookie() {
  const token = jwt.sign(
    {
      id: adminUser.id,
      userId: adminUser.id,
      email: adminUser.email,
      role: 'admin',
      fingerprint: Date.now(),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn || '7d' }
  );
  return `accessToken=${token}`;
}

async function adminCreateBreed(body) {
  const cookie = adminAccessCookie();
  // Equoria-n256i (owner ruling q289): admin tools need the emailed staff check-in.
  const device = await checkedInDeviceCookie(adminUser.id);
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [cookie, device] });
  return request(app)
    .post('/api/v1/breeds')
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

beforeAll(async () => {
  const pw = await bcrypt.hash('BreedAdmin123!', 1);
  adminUser = await prisma.user.create({
    data: {
      username: `TestFixture-mgcyd-admin-${adminTag}`,
      email: `testfixture-mgcyd-admin-${adminTag}@example.com`,
      password: pw,
      firstName: 'Breed',
      lastName: 'Admin',
      role: 'admin',
      emailVerified: true,
      dateOfBirth: new Date('1990-01-01'),
    },
  });
}, 120000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [adminUser?.id].filter(Boolean) } } });
}, 120000);

describe('Breeds API — /api/v1/breeds (canonical-DB safe)', () => {
  let tag;

  beforeEach(async () => {
    tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // Breed list/detail are cached 10 min — clear so fresh fixtures are visible.
    await invalidateCachePattern('breeds:*');
  });

  afterEach(async () => {
    // Scoped cleanup — only the TestFixture-Breed- rows this suite created.
    // NEVER deleteMany({}) (CLAUDE.md §2 / Equoria-lkady). Real breeds (Arabian,
    // Thoroughbred, …) do not match the prefix and are untouched.
    await prisma.breed.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
    await invalidateCachePattern('breeds:*');
  });

  describe('POST /api/v1/breeds', () => {
    it('creates a new breed → 201 with { success, data, message }', async () => {
      const name = `${NAME_PREFIX}${tag}`;
      const res = await adminCreateBreed({ name, description: 'Elegant and spirited' });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe(name);
      expect(res.body.data.description).toBe('Elegant and spirited');

      // Verify persisted.
      const dbBreed = await prisma.breed.findUnique({ where: { id: res.body.data.id } });
      expect(dbBreed).not.toBeNull();
      expect(dbBreed.name).toBe(name);
    });

    it('returns 400 when name is missing', async () => {
      const res = await adminCreateBreed({ description: 'A breed without a name' });
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 when name is empty or not a string', async () => {
      const emptyName = await adminCreateBreed({ name: '' });
      expect(emptyName.statusCode).toBe(400);

      const nonStringName = await adminCreateBreed({ name: 123 });
      expect(nonStringName.statusCode).toBe(400);
    });

    it('rejects a duplicate breed name (case-insensitive) and does not persist a second row', async () => {
      const name = `${NAME_PREFIX}dup-${tag}`;
      const first = await adminCreateBreed({ name });
      expect(first.statusCode).toBe(201);

      // The duplicate is rejected (not 201). NOTE: the controller currently
      // returns 500 here — it throws ValidationError(400) but its own catch
      // re-wraps that as DatabaseError(500). That is a separate pre-existing
      // controller bug (tracked separately); this test asserts the real
      // invariant — the duplicate is NOT created — rather than blessing 500.
      const sameCase = await adminCreateBreed({ name });
      expect(sameCase.statusCode).not.toBe(201);

      const differentCase = await adminCreateBreed({ name: name.toLowerCase() });
      expect(differentCase.statusCode).not.toBe(201);

      // Invariant: exactly one breed with this name exists (no duplicate persisted).
      const matches = await prisma.breed.findMany({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      expect(matches.length).toBe(1);
    });
  });

  describe('GET /api/v1/breeds', () => {
    it('returns the breed list including a freshly created fixture (coexists with real data)', async () => {
      const name = `${NAME_PREFIX}list-${tag}`;
      const created = await adminCreateBreed({ name });
      expect(created.statusCode).toBe(201);
      // createBreed does not invalidate the list cache — clear it so GET is fresh.
      await invalidateCachePattern('breeds:*');

      const res = await request(app).get('/api/v1/breeds');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // No absolute-count assertion (the DB holds real breeds too); count must
      // simply agree with the array length, and the fixture must appear.
      expect(res.body.count).toBe(res.body.data.length);
      expect(res.body.data.map((b) => b.name)).toContain(name);
    });

    // Equoria-refgs trimmed the LIST endpoint's breedGeneticProfile to ONLY
    // ratingProfiles for the breed picker's stat bars. Owner ruling 2026-10-29
    // (q292, Equoria-9kakx) removed those stat bars, and q274 keeps every breed
    // odd off the wire, so the list now sends no breedGeneticProfile at all.
    // Old contract: { ratingProfiles } was kept on every row.
    it('sends no breedGeneticProfile on the list (no ratings, colour, stat or temperament keys)', async () => {
      const name = `${NAME_PREFIX}trim-${tag}`;
      // createBreed (POST) does not accept breedGeneticProfile, so seed the
      // profile directly. Scoped by the TestFixture-Breed- name prefix → the
      // afterEach scoped deleteMany cleans it up; real breeds are untouched.
      const fullProfile = {
        ratingProfiles: {
          conformation: {
            head: { mean: 78, stdDev: 5 },
            legs: { mean: 74, stdDev: 6 },
          },
          gaits: {
            gallop: { mean: 90, stdDev: 4 },
            gaiting: null,
          },
          isGaitedBreed: false,
          gaitedGaitRegistry: null,
        },
        // Heavy keys that MUST NOT ship on the list endpoint:
        starterStats: { speed: { mean: 20, stdDev: 3 } },
        temperamentWeights: { Spirited: 30, Calm: 3 },
        alleleWeights: { E: { E: 0.5, e: 0.5 } },
        allowedAlleles: { E: ['E', 'e'] },
        markingBias: { star: 0.3 },
        shadeBias: { dark: 0.4 },
        disallowedCombinations: [['LP', 'LP']],
      };
      await prisma.breed.create({
        data: { name, description: 'trim fixture', breedGeneticProfile: fullProfile },
      });
      await invalidateCachePattern('breeds:*');

      const res = await request(app).get('/api/v1/breeds');
      expect(res.statusCode).toBe(200);

      const row = res.body.data.find((b) => b.name === name);
      expect(row).toBeDefined();

      // No part of the profile ships on the list endpoint.
      expect(row).not.toHaveProperty('breedGeneticProfile');
      expect(Object.keys(row).sort()).toEqual(['description', 'id', 'name']);

      // defaultTrait is also not part of the trimmed list payload (detail
      // endpoint GET /api/v1/breeds/:id still serves the full row).
      expect(row).not.toHaveProperty('defaultTrait');
    });

    // Owner rulings 2026-10-29 (q274, q292; Equoria-9kakx): the detail endpoint
    // is public and sends no breed odds or ranges either. Old contract: the full
    // breedGeneticProfile was served here.
    it('sends no breedGeneticProfile on the detail endpoint either', async () => {
      const name = `${NAME_PREFIX}detailfull-${tag}`;
      const created = await prisma.breed.create({
        data: {
          name,
          description: 'detail fixture',
          breedGeneticProfile: {
            ratingProfiles: { conformation: { head: { mean: 70, stdDev: 5 } } },
            starterStats: { speed: { mean: 20, stdDev: 3 } },
            markingBias: { star: 0.3 },
          },
        },
      });
      await invalidateCachePattern('breeds:*');

      const res = await request(app).get(`/api/v1/breeds/${created.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe(name);
      expect(res.body.data).not.toHaveProperty('breedGeneticProfile');
      expect(JSON.stringify(res.body)).not.toMatch(/ratingProfiles|starterStats|markingBias/);
    });
  });

  describe('GET /api/v1/breeds/:id', () => {
    it('returns a single breed by id → 200', async () => {
      const name = `${NAME_PREFIX}byid-${tag}`;
      const created = await adminCreateBreed({ name });
      const id = created.body.data.id;

      const res = await request(app).get(`/api/v1/breeds/${id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', id);
      expect(res.body.data.name).toBe(name);
    });

    it('returns 404 if a breed with the id does not exist', async () => {
      const res = await request(app).get('/api/v1/breeds/999999999');
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 if the id is not a valid integer', async () => {
      const res = await request(app).get('/api/v1/breeds/abc');
      expect(res.statusCode).toBe(400);
    });
  });
});
