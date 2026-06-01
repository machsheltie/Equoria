/**
 * 🧪 INTEGRATION TEST: Leaderboard API - Real Database Integration
 *
 * This test validates leaderboard endpoints with real database operations
 * following the proven balanced mocking approach for maximum business logic validation.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Player rankings: Level-based and XP-based leaderboards with proper sorting
 * - Horse rankings: Earnings-based and performance-based leaderboards
 * - Competition winners: Recent winners with discipline filtering
 * - Statistics aggregation: Comprehensive leaderboard statistics
 * - Authentication: Proper access control for all endpoints
 * - Data filtering: Discipline-specific filtering and pagination
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. GET /api/leaderboards/players/level - Top players by level
 * 2. GET /api/leaderboards/players/xp - Top players by XP
 * 3. GET /api/leaderboards/horses/earnings - Top horses by earnings
 * 4. GET /api/leaderboards/horses/performance - Top horses by performance
 * 5. GET /api/leaderboards/recent-winners - Recent competition winners
 * 6. GET /api/leaderboards/stats - Comprehensive statistics
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Database operations, business logic, API responses, data aggregation
 * ✅ REAL: Authentication, filtering, sorting, pagination
 * 🔧 MOCK: Logger only (external dependency)
 *
 * 💡 TEST STRATEGY: Integration testing with real database to validate
 *    complete leaderboard functionality and ranking algorithms
 *
 * Equoria-cs6wf: fixture usernames are randomized per run (TestFixture-cs6wf-
 * prefix + 6-byte hex suffix) so concurrent suite runs and re-runs cannot
 * collide on unique (email, username) constraints. The 8 assertion sites
 * that previously compared against static literals have been migrated to
 * the per-run randomized usernames. A sentinel test guards the file
 * against future regressions to the historical static identifiers.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import config from '../../config/config.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-qp2vj: leaderboard endpoints cache for 5min; tests must invalidate
// to observe their own writes within the same suite run.
import { invalidateCachePattern } from '../../utils/cacheHelper.mjs';

// Strategic mocking: Only mock external dependencies
jest.mock('../../utils/logger.mjs', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('🏆 INTEGRATION: Leaderboard API - Real Database Integration', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  // Equoria-cs6wf: per-run unique suffix for fixture identifiers so concurrent
  // jest workers / repeat runs cannot collide on unique (email, username).
  const suffix = randomBytes(6).toString('hex');
  const FIXTURE_USERNAMES = {
    p1: `TestFixture-cs6wf-tp1-${suffix}`,
    p2: `TestFixture-cs6wf-tp2-${suffix}`,
    p3: `TestFixture-cs6wf-tp3-${suffix}`,
  };
  const FIXTURE_EMAILS = {
    p1: `test-leaderboard-cs6wf-1-${suffix}@example.com`,
    p2: `test-leaderboard-cs6wf-2-${suffix}@example.com`,
    p3: `test-leaderboard-cs6wf-3-${suffix}@example.com`,
  };

  let testToken;
  let testUser;
  let testUsers;
  let testHorses;
  let testBreed;

  beforeEach(async () => {
    // Equoria-qp2vj / Equoria-cs6wf: Clean ONLY this suite's own fixtures.
    // Scoped by the TestFixture-cs6wf- username prefix (CLAUDE.md §3).
    const pollutionHorses = await prisma.horse.findMany({
      where: { name: { startsWith: 'TestLeaderboard' } },
      select: { id: true },
    });
    const pollutionHorseIds = pollutionHorses.map(h => h.id);

    await prisma.competitionResult.deleteMany({
      where: {
        OR: [
          ...(pollutionHorseIds.length ? [{ horseId: { in: pollutionHorseIds } }] : []),
          { showName: { contains: 'Grand Prix Classic' } },
          { showName: { contains: 'Regional Championship' } },
          { showName: { contains: 'Evening Classic' } },
        ],
      },
    });

    // Clean up shows this suite creates
    await prisma.show.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Grand Prix Classic' } },
          { name: { contains: 'Regional Championship' } },
          { name: { contains: 'Evening Classic' } },
        ],
      },
    });

    // Clean up only this suite's horses
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestLeaderboard' } },
    });

    // Clean up only specific test users for this test suite.
    // Equoria-cs6wf: scope by the new TestFixture-cs6wf- username prefix
    // (covers this run's fixtures and any prior cs6wf runs).
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { startsWith: 'test-leaderboard' } }, { username: { startsWith: 'TestFixture-cs6wf-' } }],
      },
    });

    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestBreed' } },
    });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'TestBreed Thoroughbred',
        description: 'Test breed for leaderboard tests',
      },
    });

    // Create test users with varying levels and XP
    testUsers = await Promise.all([
      prisma.user.create({
        data: {
          email: FIXTURE_EMAILS.p1,
          username: FIXTURE_USERNAMES.p1,
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player1',
          level: 15,
          xp: 50,
          money: 25000,
        },
      }),
      prisma.user.create({
        data: {
          email: FIXTURE_EMAILS.p2,
          username: FIXTURE_USERNAMES.p2,
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player2',
          level: 14,
          xp: 90,
          money: 18000,
        },
      }),
      prisma.user.create({
        data: {
          email: FIXTURE_EMAILS.p3,
          username: FIXTURE_USERNAMES.p3,
          password: 'hashedpassword',
          firstName: 'Top',
          lastName: 'Player3',
          level: 14,
          xp: 30,
          money: 21500,
        },
      }),
    ]);

    // Use first user as test user for authentication
    [testUser] = testUsers;

    // Generate auth token for test user
    testToken = jwt.sign({ id: testUser.id, email: testUser.email }, config.jwtSecret, { expiresIn: '1h' });

    // Create test horses with varying earnings
    testHorses = await Promise.all([
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'TestLeaderboard Champion',
          age: 6,
          sex: 'Stallion',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[0].id } },
          dateOfBirth: new Date('2019-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 200000,
        },
      }),
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'TestLeaderboard Silver Star',
          age: 5,
          sex: 'Mare',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[1].id } },
          dateOfBirth: new Date('2020-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 150000,
        },
      }),
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'TestLeaderboard Gold Rush',
          age: 4,
          sex: 'Stallion',
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUsers[2].id } },
          dateOfBirth: new Date('2021-01-01'),
          healthStatus: 'Good',
          totalEarnings: 100000,
        },
      }),
    ]);

    // Create shows first with unique names using timestamp
    const timestamp = Date.now();
    const testShows = await Promise.all([
      prisma.show.create({
        data: {
          name: `Grand Prix Classic ${timestamp}`,
          discipline: 'Dressage',
          runDate: new Date(),
          prize: 15000,
          entryFee: 500,
          levelMin: 1,
          levelMax: 10,
        },
      }),
      prisma.show.create({
        data: {
          name: `Regional Championship ${timestamp}`,
          discipline: 'Show Jumping',
          runDate: new Date(),
          prize: 12000,
          entryFee: 400,
          levelMin: 1,
          levelMax: 10,
        },
      }),
      prisma.show.create({
        data: {
          name: `Evening Classic ${timestamp}`,
          discipline: 'Cross Country',
          runDate: new Date(),
          prize: 9000,
          entryFee: 300,
          levelMin: 1,
          levelMax: 10,
        },
      }),
    ]);

    // Create competition results
    await Promise.all([
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[0].id,
          showId: testShows[0].id,
          showName: `Grand Prix Classic ${timestamp}`,
          discipline: 'Dressage',
          placement: '1st',
          prizeWon: 15000,
          score: 95.7,
          runDate: new Date(),
        },
      }),
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[1].id,
          showId: testShows[1].id,
          showName: `Regional Championship ${timestamp}`,
          discipline: 'Show Jumping',
          placement: '1st',
          prizeWon: 12000,
          score: 92.3,
          runDate: new Date(),
        },
      }),
      prisma.competitionResult.create({
        data: {
          horseId: testHorses[2].id,
          showId: testShows[2].id,
          showName: `Evening Classic ${timestamp}`,
          discipline: 'Cross Country',
          placement: '1st',
          prizeWon: 9000,
          score: 88.5,
          runDate: new Date(),
        },
      }),
    ]);
  });

  afterEach(async () => {
    // Equoria-qp2vj / Equoria-cs6wf: Clean ONLY this suite's own fixtures (CLAUDE.md §3).
    // First clean up competition results referencing our test data.
    await prisma.competitionResult.deleteMany({
      where: {
        OR: [
          { horse: { name: { startsWith: 'TestLeaderboard' } } },
          { showName: { contains: 'Grand Prix Classic' } },
          { showName: { contains: 'Regional Championship' } },
          { showName: { contains: 'Evening Classic' } },
        ],
      },
    });

    // Clean up shows this suite creates
    await prisma.show.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Grand Prix Classic' } },
          { name: { contains: 'Regional Championship' } },
          { name: { contains: 'Evening Classic' } },
        ],
      },
    });

    // Clean up only this suite's horses
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'TestLeaderboard' } },
    });

    // Clean up only specific test users for this test suite.
    // Equoria-cs6wf: scoped by the TestFixture-cs6wf- username prefix.
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: { startsWith: 'test-leaderboard' } }, { username: { startsWith: 'TestFixture-cs6wf-' } }],
      },
    });

    await prisma.breed.deleteMany({
      where: { name: { startsWith: 'TestBreed' } },
    });
  });

  describe('GET /api/leaderboards/players/level', () => {
    it('should return top players by level', async () => {
      const response = await request(app)
        .get('/api/leaderboards/players/level')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top users by level retrieved successfully');
      expect(response.body.data.users.length).toBeGreaterThanOrEqual(3); // At least our 3 test users

      // Filter to find our test fixtures by name — real-DB may have other high-level users
      // that precede our test fixtures, so never assert on absolute position.
      const { users: rankings } = response.body.data;
      // Leaderboards expose the username, not real first/last names, for
      // privacy (Equoria-2gfor). Match on the per-run randomized username.
      const p1 = rankings.find(u => u.name === FIXTURE_USERNAMES.p1);
      const p2 = rankings.find(u => u.name === FIXTURE_USERNAMES.p2);
      const p3 = rankings.find(u => u.name === FIXTURE_USERNAMES.p3);
      if (!p1) {
        throw new Error(`${FIXTURE_USERNAMES.p1} must appear in rankings`);
      }
      expect(p1.level).toBe(15);
      if (!p2) {
        throw new Error(`${FIXTURE_USERNAMES.p2} must appear in rankings`);
      }
      expect(p2.level).toBe(14);
      expect(p2.xp).toBe(90); // Higher XP than Player 3
      if (!p3) {
        throw new Error(`${FIXTURE_USERNAMES.p3} must appear in rankings`);
      }
      expect(p3.level).toBe(14);
      expect(p3.xp).toBe(30); // Lower XP than Player 2
      // Relative order within test fixtures must be correct (p1 > p2 > p3)
      const p1idx = rankings.indexOf(p1);
      const p2idx = rankings.indexOf(p2);
      const p3idx = rankings.indexOf(p3);
      expect(p1idx).toBeLessThan(p2idx);
      expect(p2idx).toBeLessThan(p3idx);
    });

    it('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/leaderboards/players/level')
        .set('Origin', 'http://localhost:3000')

        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });
  });

  describe('GET /api/leaderboards/horses/earnings', () => {
    it('should return top horses by earnings', async () => {
      const response = await request(app)
        .get('/api/leaderboards/horses/earnings')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Top horses by earnings retrieved successfully');
      // Equoria-qp2vj: Find fixtures by name, not position. Other suites
      // (or planted fakes) may have horses with higher earnings that
      // legitimately rank above the test fixtures; the test must not
      // assume its data dominates absolute positions in the response.
      expect(response.body.data.horses.length).toBeGreaterThanOrEqual(3);
      const { horses: rankings } = response.body.data;
      const champion = rankings.find(h => h.name === 'TestLeaderboard Champion');
      const silver = rankings.find(h => h.name === 'TestLeaderboard Silver Star');
      const gold = rankings.find(h => h.name === 'TestLeaderboard Gold Rush');
      if (!champion) {
        throw new Error('TestLeaderboard Champion must appear in earnings rankings');
      }
      if (!silver) {
        throw new Error('TestLeaderboard Silver Star must appear in earnings rankings');
      }
      if (!gold) {
        throw new Error('TestLeaderboard Gold Rush must appear in earnings rankings');
      }
      expect(champion.earnings).toBe(200000);
      expect(silver.earnings).toBe(150000);
      expect(gold.earnings).toBe(100000);

      // Relative order WITHIN test fixtures must be correct (champion > silver > gold).
      const cIdx = rankings.indexOf(champion);
      const sIdx = rankings.indexOf(silver);
      const gIdx = rankings.indexOf(gold);
      expect(cIdx).toBeLessThan(sIdx);
      expect(sIdx).toBeLessThan(gIdx);

      // Verify breed and owner information is included on test fixtures
      expect(champion.breedName).toBe('TestBreed Thoroughbred');
      expect(champion.ownerName).toBe(FIXTURE_USERNAMES.p1);
    });
  });

  describe('GET /api/leaderboards/recent-winners', () => {
    it('should return recent competition winners', async () => {
      const response = await request(app)
        .get('/api/leaderboards/recent-winners')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Recent winners retrieved successfully');
      // Real-DB shared with non-test winners; locate fixture by name, not
      // by position (fixture runDate from 2025 is now superseded by real activity).
      expect(response.body.data.winners.length).toBeGreaterThanOrEqual(1);

      const { winners } = response.body.data;
      const championEntry = winners.find(w => w.horse.name === 'TestLeaderboard Champion');
      expect(championEntry).toBeDefined();
      expect(championEntry.competition.discipline).toBe('Dressage');
      expect(championEntry.show).toContain('Grand Prix Classic');
      // Note: prizeWon is not included in the API response

      // Verify horse and owner information is included
      expect(championEntry.owner).toBe(FIXTURE_USERNAMES.p1);
    });

    it('should filter by discipline', async () => {
      const response = await request(app)
        .get('/api/leaderboards/recent-winners')
        .set('Origin', 'http://localhost:3000')
        .query({ discipline: 'Dressage' })
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // Real-DB may contain non-test Dressage winners; locate fixture by name.
      expect(response.body.data.winners.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data.discipline).toBe('Dressage');
      const dressageChampion = response.body.data.winners.find(w => w.horse.name === 'TestLeaderboard Champion');
      expect(dressageChampion).toBeDefined();
      expect(dressageChampion.competition.discipline).toBe('Dressage');
    });
  });

  describe('GET /api/leaderboards/stats', () => {
    it('should return comprehensive leaderboard statistics', async () => {
      const response = await request(app)
        .get('/api/leaderboards/stats')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Leaderboard stats retrieved');

      const { data } = response.body;

      // Verify overview statistics
      expect(data.userCount).toBeGreaterThanOrEqual(3); // At least our 3 test users
      expect(data.horseCount).toBeGreaterThanOrEqual(3); // At least our 3 test horses
      expect(data.totalEarnings).toBeGreaterThanOrEqual(114500); // At least our test horses' earnings
      // Note: averagePlayerLevel is not provided by the API
    });
  });

  describe('Equoria-qp2vj sentinel: foreign-fixture pollution', () => {
    // Plants a high-earnings fixture with a NON-TestLeaderboard name (mimics
    // foreign-suite leakage) and a 1st-place competition result. Asserts:
    //   (a) the test fixtures are still findable by name in earnings rankings
    //   (b) the test fixture is still findable in recent-winners by name
    // The prior implementation relied on a manually-enumerated blocklist of
    // foreign suite prefixes; this sentinel proves the new name-scoped
    // assertions are robust to any name not on a blocklist.
    let foreignHorse;
    let foreignShow;
    let foreignResult;
    let foreignBreed;
    let foreignUser;

    beforeEach(async () => {
      foreignUser = await prisma.user.create({
        data: {
          email: `qp2vj-sentinel-${Date.now()}@example.com`,
          username: `qp2vjSentinel${Date.now()}`,
          password: 'hashedpassword',
          firstName: 'Sentinel',
          lastName: 'Foreign',
          level: 20,
          xp: 0,
          money: 100,
        },
      });
      foreignBreed = await prisma.breed.create({
        data: { name: `qp2vj-SentinelBreed-${Date.now()}`, description: 'sentinel' },
      });
      foreignHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          // intentionally NOT starting with 'TestLeaderboard'
          name: `qp2vjSentinelHorse-${Date.now()}`,
          age: 6,
          sex: 'Stallion',
          breed: { connect: { id: foreignBreed.id } },
          user: { connect: { id: foreignUser.id } },
          dateOfBirth: new Date('2019-01-01'),
          healthStatus: 'Excellent',
          totalEarnings: 999999, // higher than any TestLeaderboard fixture
        },
      });
      foreignShow = await prisma.show.create({
        data: {
          name: `qp2vjSentinelShow-${Date.now()}`,
          discipline: 'Dressage',
          runDate: new Date(),
          prize: 99999,
          entryFee: 100,
          levelMin: 1,
          levelMax: 20,
        },
      });
      foreignResult = await prisma.competitionResult.create({
        data: {
          horseId: foreignHorse.id,
          showId: foreignShow.id,
          showName: foreignShow.name,
          discipline: 'Dressage',
          placement: '1st',
          prizeWon: 99999,
          score: 99.9,
          runDate: new Date(),
        },
      });
      // Bust cache so this describe's endpoints see the freshly-planted rows.
      await invalidateCachePattern('leaderboard:*');
    });

    afterEach(async () => {
      // Scoped by foreign IDs so this suite cleans up its own sentinel
      // — does not leak the high-earnings fake into the canonical DB.
      if (foreignResult) {
        await prisma.competitionResult
          .deleteMany({ where: { id: foreignResult.id } })
          .catch(err => console.warn(`[cleanup] ${err.message}`));
      }
      if (foreignShow) {
        await prisma.show
          .deleteMany({ where: { id: foreignShow.id } })
          .catch(err => console.warn(`[cleanup] ${err.message}`));
      }
      if (foreignHorse) {
        await prisma.horse
          .deleteMany({ where: { id: foreignHorse.id } })
          .catch(err => console.warn(`[cleanup] ${err.message}`));
      }
      if (foreignBreed) {
        await prisma.breed
          .deleteMany({ where: { id: foreignBreed.id } })
          .catch(err => console.warn(`[cleanup] ${err.message}`));
      }
      if (foreignUser) {
        await prisma.user
          .deleteMany({ where: { id: foreignUser.id } })
          .catch(err => console.warn(`[cleanup] ${err.message}`));
      }
    });

    it('horses/earnings still locates test fixtures by name when a higher-earning foreign horse exists', async () => {
      const response = await request(app)
        .get('/api/leaderboards/horses/earnings')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const { horses: rankings } = response.body.data;
      // Foreign sentinel SHOULD appear (proves cleanup didn't wipe it).
      const foreign = rankings.find(h => h.name === foreignHorse.name);
      expect(foreign).toBeDefined();
      expect(foreign.earnings).toBe(999999);
      // Test fixtures STILL present and findable by name.
      expect(rankings.find(h => h.name === 'TestLeaderboard Champion')).toBeDefined();
      expect(rankings.find(h => h.name === 'TestLeaderboard Silver Star')).toBeDefined();
      expect(rankings.find(h => h.name === 'TestLeaderboard Gold Rush')).toBeDefined();
    });

    it('recent-winners still locates test-fixture winner by name when a foreign 1st-place winner is present', async () => {
      const response = await request(app)
        .get('/api/leaderboards/recent-winners')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      const { winners } = response.body.data;
      // The foreign sentinel SHOULD appear (since cleanup is scoped).
      const foreign = winners.find(w => w.horse.name === foreignHorse.name);
      expect(foreign).toBeDefined();
      // The TestLeaderboard fixture winner is still findable by name.
      const champion = winners.find(w => w.horse.name === 'TestLeaderboard Champion');
      expect(champion).toBeDefined();
      expect(champion.competition.discipline).toBe('Dressage');
    });
  });

  // Equoria-cs6wf sentinel: source-text guard against regression to static
  // username literals. Asserts no remaining single-quoted historical fixture
  // identifiers. The randomized FIXTURE_USERNAMES values use backtick template
  // literals (with prefix tp1/tp2/tp3), so they would not match the single-
  // quoted regex even if they contained the substring.
  describe('Equoria-cs6wf sentinel: forbid regression to static username literals', () => {
    it('source file has zero single-quoted historical fixture identifiers', () => {
      const here = fileURLToPath(import.meta.url);
      const sourcePath = resolve(dirname(here), 'leaderboardRoutes.test.mjs');
      const source = readFileSync(sourcePath, 'utf8');
      // Build the forbidden regex via concatenation so this very line does
      // not contain the literal text it forbids.
      const t = 'topplay' + 'er';
      const forbidden = new RegExp(`'${t}[123]'`, 'g');
      // Mask the sentinel-describe block itself so we only scan production
      // surface above it.
      const sentinelMarker = "describe('Equoria-cs6wf sentinel: forbid regression";
      const sentinelStart = source.indexOf(sentinelMarker);
      const scanRegion = sentinelStart === -1 ? source : source.slice(0, sentinelStart);
      const matches = scanRegion.match(forbidden) || [];
      expect(matches).toHaveLength(0);
    });
  });
});
