/**
 * Competition API Endpoints Integration Tests
 * Tests for the new enhanced competition API endpoints:
 * - POST /api/competition/enter
 * - POST /api/competition/execute
 * - GET /api/competition/eligibility/:horseId/:discipline
 * - GET /api/competition/disciplines
 * - GET /api/leaderboards/competition
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../helpers/testAuth.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🚀 INTEGRATION: Competition API Endpoints', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let testUser;
  let testHorse;
  let testShow;
  let authToken;

  // Equoria-g8iu2: RESILIENT FIXTURE MATERIALISATION.
  //
  // Root cause of the sharded-load flake: under the pre-push hook the suite
  // runs `jest --runInBand --shard=i/N`, so every suite in a shard executes
  // sequentially in ONE process and shares this file's `testAuth.mjs` module
  // instance — including the module-level `_createdHorseIds` / `_createdUserIds`
  // / `_createdShowIds` sets and the shared `cleanupTestData()`. `cleanupTestData()`
  // deletes the UNION of all tracked ids and clears the sets. A sibling suite's
  // cleanup running while this suite's ids are still in those shared sets sweeps
  // THIS suite's user (and, by FK cascade, its horse) — so the very next
  // `POST /enter` resolves a missing horse/show and returns 404 instead of
  // 201/409. It only manifests under cross-suite ordering (passes in isolation),
  // which is exactly CLAUDE.md Rule 2: a test must not assume its data survives
  // alongside concurrent real + sibling-suite data.
  //
  // Fix: own the fixture lifecycle by UNIQUE TestFixture- ids and make it
  // idempotently self-healing. `ensureFixtures()` re-materialises any swept row
  // BY ITS ORIGINAL ID (the User uuid is explicit, so the signed JWT stays valid;
  // horse/show int ids are re-fetched and only re-created when absent, with the
  // `let` bindings reassigned). Called in beforeAll AND immediately before the
  // entry-dependent assertions, it removes the dependency on global ordering.
  const fixtureTag = `TestFixture-compapi-${randomBytes(6).toString('hex')}`;
  let testUserId; // stable across re-materialisation (preserves authToken)

  async function ensureFixtures() {
    // ── User (stable uuid id → token stays valid even if swept+recreated) ──
    if (!testUserId) {
      const userResult = await createTestUser({
        username: `${fixtureTag}-user-${randomBytes(4).toString('hex')}`,
        email: `${fixtureTag}-${randomBytes(4).toString('hex')}@example.com`,
        money: 10000,
        xp: 500,
        level: 5,
      });
      testUser = userResult.user;
      testUserId = userResult.user.id;
      authToken = userResult.token;
    } else {
      const liveUser = await prisma.user.findUnique({ where: { id: testUserId } });
      if (!liveUser) {
        // Re-create with the SAME uuid so the already-issued authToken still
        // resolves to a real row. Mirrors createTestUser's password hashing.
        const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
        const hashed = await bcrypt.hash('TestPassword123!', saltRounds);
        testUser = await prisma.user.create({
          data: {
            id: testUserId,
            username: `${fixtureTag}-user-${randomBytes(4).toString('hex')}`,
            email: `${fixtureTag}-${randomBytes(4).toString('hex')}@example.com`,
            password: hashed,
            firstName: 'Test',
            lastName: 'User',
            money: 10000,
            xp: 500,
            level: 5,
          },
        });
      } else {
        testUser = liveUser;
      }
    }

    // ── Horse (re-fetch by id; re-create + rebind if swept by FK cascade) ──
    const liveHorse =
      testHorse?.id != null ? await prisma.horse.findFirst({ where: { id: testHorse.id, userId: testUserId } }) : null;
    if (!liveHorse) {
      testHorse = await createTestHorse({
        userId: testUserId,
        name: `${fixtureTag}-horse`,
        age: 5, // 5 game-years — Equoria-8y0v
        speed: 80,
        stamina: 75,
        focus: 70,
        precision: 65,
        agility: 70,
        balance: 60,
        healthStatus: 'Excellent',
        epigeneticModifiers: {
          positive: ['fast', 'athletic', 'focused'],
          negative: [],
        },
        disciplineScores: {
          Racing: 100,
          Dressage: 80,
          'Show Jumping': 90,
        },
      });
    } else {
      testHorse = liveHorse;
    }

    // ── Show (re-fetch by id; re-create + rebind if swept) ──
    const liveShow = testShow?.id != null ? await prisma.show.findUnique({ where: { id: testShow.id } }) : null;
    if (!liveShow) {
      testShow = await createTestShow({
        name: `${fixtureTag}-show`,
        discipline: 'Racing',
        levelMin: 1,
        levelMax: 10,
        entryFee: 100,
        prize: 1000,
        hostUserId: testUserId,
        runDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });
    } else {
      testShow = liveShow;
    }
  }

  beforeAll(async () => {
    await ensureFixtures();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('🎯 GET /api/competition/disciplines', () => {
    test('should return all available disciplines', async () => {
      const response = await request(app)
        .get('/api/competition/disciplines')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.disciplines).toBeInstanceOf(Array);
      expect(response.body.data.disciplines.length).toBeGreaterThanOrEqual(24);
      expect(response.body.data.disciplines).toContain('Racing');
      expect(response.body.data.disciplines).toContain('Dressage');
      expect(response.body.data.disciplines).toContain('Gaited');
      expect(response.body.data.disciplineDetails).toBeInstanceOf(Array);
      expect(response.body.data.total).toBe(response.body.data.disciplines.length);
    });
  });

  describe('🔍 GET /api/competition/eligibility/:horseId/:discipline', () => {
    test('should check horse eligibility for Racing discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Racing`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.horseId).toBe(testHorse.id);
      expect(response.body.data.horseName).toBe(testHorse.name);
      expect(response.body.data.discipline).toBe('Racing');
      expect(response.body.data.eligibility).toHaveProperty('horseLevel');
      expect(response.body.data.eligibility).toHaveProperty('ageEligible');
      expect(response.body.data.eligibility).toHaveProperty('traitEligible');
      expect(response.body.data.eligibility).toHaveProperty('disciplineStats');
      expect(response.body.data.eligibility.ageEligible).toBe(true); // Horse is 5 years old
      expect(response.body.data.eligibility.traitEligible).toBe(true); // Racing doesn't require special traits
    });

    test('should check horse eligibility for Gaited discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Gaited`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.discipline).toBe('Gaited');
      expect(response.body.data.eligibility.traitEligible).toBe(false); // Horse doesn't have 'gaited' trait
      expect(response.body.data.eligibility.requiredTrait).toBe('gaited');
    });

    test('should reject invalid discipline', async () => {
      const response = await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/InvalidDiscipline`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid discipline');
      expect(response.body.availableDisciplines).toBeInstanceOf(Array);
    });

    test('should reject unauthorized access', async () => {
      await request(app)
        .get(`/api/competition/eligibility/${testHorse.id}/Racing`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });

    test('should reject access to horse not owned by user', async () => {
      // Create another user and horse
      const otherUserResult = await createTestUser({
        username: `otheruser_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `other_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
      });
      const otherHorse = await createTestHorse({
        userId: otherUserResult.user.id,
        name: 'Other Horse',
      });

      const response = await request(app)
        .get(`/api/competition/eligibility/${otherHorse.id}/Racing`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('📝 POST /api/competition/enter', () => {
    // Equoria-g8iu2: self-heal + assert the user/horse/show fixtures BEFORE the
    // entry-dependent tests run. This closes the cross-suite contention window:
    // if a sibling suite's shared cleanup swept this suite's fixtures after the
    // top-level beforeAll, ensureFixtures() re-materialises them by id (User by
    // its original uuid, so authToken stays valid). The assertions below make a
    // missing-fixture failure ATTRIBUTABLE here, rather than surfacing as a
    // silent 404 from POST /enter. The success + duplicate tests both rely on a
    // single live show id, so this runs ONCE (beforeAll), not per-test — a
    // per-test rebuild would change the show id between the two and break the
    // 409 duplicate semantics.
    beforeAll(async () => {
      await ensureFixtures();
      const [liveHorse, liveShow] = await Promise.all([
        prisma.horse.findFirst({ where: { id: testHorse.id, userId: testUserId } }),
        prisma.show.findUnique({ where: { id: testShow.id } }),
      ]);
      expect(liveHorse).toBeTruthy(); // attributable: horse fixture present
      expect(liveShow).toBeTruthy(); // attributable: show fixture present
      expect(liveShow.status).toBe('open'); // show accepts entries (no 409 window)
    });

    // Equoria-kacla: /enter is now a CANONICAL DEFERRED entry (7-day model,
    // nx8t1). It creates a ShowEntry (the row the nightly cron scores), debits
    // the entrant, credits the creator, and returns NO instant results /
    // eligibilityDetails. Migrated from the obsolete instant-entry assertions.
    test('should successfully enter horse in competition (deferred ShowEntry, no instant results)', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.horseId).toBe(testHorse.id);
      expect(response.body.data.showId).toBe(testShow.id);
      expect(response.body.data.entryFee).toBe(testShow.entryFee);
      // No instant results / placement / scores / eligibilityDetails.
      expect(response.body.results).toBeUndefined();
      expect(response.body.data.placement).toBeUndefined();
      expect(response.body.data.score).toBeUndefined();
      expect(response.body.data.eligibilityDetails).toBeUndefined();

      // Entry lands in the canonical ShowEntry table the cron reads, NOT a
      // pre-scored competitionResult row.
      const entry = await prisma.showEntry.findFirst({
        where: {
          horseId: testHorse.id,
          showId: testShow.id,
        },
      });
      expect(entry).toBeTruthy();
      expect(entry.feePaid).toBe(testShow.entryFee);

      const preScored = await prisma.competitionResult.findFirst({
        where: { horseId: testHorse.id, showId: testShow.id },
      });
      expect(preScored).toBeNull(); // No instant execution occurred.
    });

    test('should reject duplicate entry (409 — canonical ShowEntry uniqueness)', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse is already entered in this competition');
    });

    test('should reject invalid input', async () => {
      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: 'invalid',
          showId: testShow.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toBeInstanceOf(Array);
    });

    test('should reject unauthorized access', async () => {
      await request(app)
        .post('/api/competition/enter')
        .set('Origin', 'http://localhost:3000')
        .send({
          horseId: testHorse.id,
          showId: testShow.id,
        })

        .expect(401);
    });

    test('should reject horse not owned by user with 404 (CWE-639, Equoria-8ug7)', async () => {
      // Migrated from inline findOwnedResource to requireOwnership({from:'body'}).
      // The CWE-639 doctrine: a foreign-horse caller must receive 404
      // indistinguishable from not-found — never 403 or any other status that
      // would leak the resource's existence.
      const otherUserResult = await createTestUser({
        username: `other_enter_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `other_enter_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
      });
      const otherHorse = await createTestHorse({
        userId: otherUserResult.user.id,
        name: `Other Horse Enter ${Date.now()}`,
      });

      const response = await request(app)
        .post('/api/competition/enter')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: otherHorse.id,
          showId: testShow.id,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  // Equoria-kacla: POST /api/competition/execute is REMOVED (410 Gone). The
  // only sanctioned executor is the nightly cron `executeClosedShows`, which
  // scores each show exactly once at closeDate (createdAt + 7d). The legacy
  // on-demand-execute tests below were migrated to assert the deprecation
  // (per nx8t1 precedent: migrate obsolete tests, never skip — CLAUDE.md).
  describe('🏁 POST /api/competition/execute (removed — 410 Gone, Equoria-kacla)', () => {
    test('returns 410 Gone instead of instant-executing a competition', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          showId: testShow.id,
        })
        .expect(410);

      expect(response.body.success).toBe(false);
      expect(String(response.body.message)).toMatch(/7-day|cron|deferred|\/api\/shows/i);
      // Must NOT have run the competition.
      expect(response.body.data).toBeUndefined();
      const preScored = await prisma.competitionResult.findFirst({
        where: { horseId: testHorse.id, showId: testShow.id },
      });
      expect(preScored).toBeNull();
    });

    test('returns 410 Gone regardless of caller (no host/non-host distinction now)', async () => {
      const otherUserResult = await createTestUser({
        username: `nonhost_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `nonhost_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
      });

      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${otherUserResult.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          showId: testShow.id,
        })
        .expect(410);

      expect(response.body.success).toBe(false);
    });

    test('returns 410 Gone for any show ID (endpoint removed)', async () => {
      const response = await request(app)
        .post('/api/competition/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          showId: 99999,
        })
        .expect(410);

      expect(response.body.success).toBe(false);
    });
  });

  describe('🏆 GET /api/leaderboard/competition', () => {
    test('should get competition leaderboard by wins', async () => {
      const response = await request(app)
        .get('/api/leaderboards/competition?metric=wins&limit=10')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toBeInstanceOf(Array);
      expect(response.body.data.filters.metric).toBe('wins');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('offset');
      expect(response.body.data.pagination).toHaveProperty('hasMore');

      // Check leaderboard entry structure
      if (response.body.data.leaderboard.length > 0) {
        const [entry] = response.body.data.leaderboard;
        expect(entry).toHaveProperty('rank');
        expect(entry).toHaveProperty('horseId');
        expect(entry).toHaveProperty('horseName');
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('userName');
        expect(entry).toHaveProperty('wins');
        expect(entry).toHaveProperty('metric');
        expect(entry).toHaveProperty('value');
      }
    });

    test('should get competition leaderboard by earnings', async () => {
      const response = await request(app)
        .get('/api/leaderboards/competition?metric=earnings&discipline=Racing')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filters.metric).toBe('earnings');
      expect(response.body.data.filters.discipline).toBe('Racing');
    });

    test('should reject invalid metric', async () => {
      const response = await request(app)
        .get('/api/leaderboards/competition?metric=invalid')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should reject unauthorized access', async () => {
      await request(app)
        .get('/api/leaderboards/competition')
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });
  });
});
