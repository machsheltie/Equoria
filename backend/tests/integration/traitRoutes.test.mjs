/**
 * Trait Routes Integration Tests
 * Tests for the read-only trait API endpoints. (POST /traits/discover/:horseId
 * and /traits/batch-discover were removed by Equoria-gu8jk — players never
 * reveal traits — and their cases went with them.)
 *
 * Testing Approach: Balanced Mocking - Real Database Integration
 * - Uses REAL database operations for horses, breeds, users
 * - Tests actual ownership validation and authentication
 * - Creates and cleans up real test data for realistic scenarios
 * - Only minimal mocking of external dependencies (logger if needed)
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { createTestUser } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

// Import the app (no mocking - full integration testing)
const app = (await import('../../app.mjs')).default;

describe('Trait Routes Integration Tests', () => {
  let testHorse;
  let testBreed;
  let authToken;
  let testUser;

  beforeAll(async () => {
    try {
      // Create test user and get auth token
      // Equoria-jw471: stripped 3 [DEBUG] bare-console trace lines tracing setup.
      const auth = await createTestUser({ role: 'user' });

      if (!auth || !auth.user) {
        throw new Error('createTestUser did not return a valid user object');
      }

      testUser = auth.user;
      authToken = auth.token;

      // Create real test breed in database
      testBreed = await prisma.breed.create({
        data: {
          name: `Test Breed for Traits ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          description: 'Test breed for trait discovery testing',
        },
      });

      // Create real test horse in database owned by test user
      const twoYearsAgo = gameCalendarDate(new Date(), -2 * 365);
      testHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `Test Discovery Horse ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          sex: 'mare',
          dateOfBirth: twoYearsAgo,
          breed: { connect: { id: testBreed.id } },
          user: { connect: { id: testUser.id } }, // Link horse to test user in ACTUAL database
          bondScore: 85,
          healthStatus: 'excellent',
          epigeneticModifiers: {
            positive: ['resilient'],
            negative: [],
            hidden: ['bold', 'trainabilityBoost'],
          },
        },
      });
      // Equoria-jw471: stripped trailing [DEBUG] horse-creation log.
    } catch (error) {
      console.error('[ERROR] Failed in beforeAll setup:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // FK-ordered, scoped, fail-loud teardown (Equoria-d3ena).
    //
    // Order: horse → user → breed.
    //   - Horse.userId is onDelete: Restrict, so the user CANNOT be deleted
    //     while it owns a horse → delete the user's horse(s) first. This suite
    //     creates the user via createTestUser (a direct prisma.user.create), so
    //     there is NO register-flow starter horse here — only the single
    //     testHorse. Deleting USER-SCOPED still covers it and any straggler.
    //   - Horse children (HorseXpEvent, trait logs, …) cascade-delete from Horse.
    //   - The breed is suite-unique; deleted last.
    //
    // No silent no-op catch arm: createCleanupTracker runs every task even if
    // one throws, then throws ONE aggregated error so a leak into the canonical
    // DB (CLAUDE.md §2) fails the suite loudly instead of being swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (testUser) {
        return prisma.horse.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser horses');
    cleanup.add(() => {
      if (testUser) {
        return prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }, 'testUser');
    cleanup.add(() => {
      if (testBreed) {
        return prisma.breed.deleteMany({ where: { id: testBreed.id } });
      }
    }, 'suite breed');
    await cleanup.run();
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  beforeEach(() => {
    // Reset any mocks before each test (minimal mocking approach)
    jest.clearAllMocks();
    // Note: Using real database operations, no Prisma mocks needed
  });

  describe('GET /api/v1/traits/horse/:horseId', () => {
    it('should get horse traits successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/traits/horse/${testHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      // Equoria-jw471: stripped 2 "temporary debugging" [DEBUG] response-dump lines.

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('bondScore');
      expect(response.body.data).toHaveProperty('age');
      expect(response.body.data).toHaveProperty('traits');
      expect(response.body.data).toHaveProperty('summary');

      const { traits } = response.body.data;
      expect(traits).toHaveProperty('positive');
      expect(traits).toHaveProperty('negative');
      // Equoria-6dace (owner ruling 2026-10-16): unrevealed hidden traits are
      // a count, never a list of names.
      expect(traits).not.toHaveProperty('hidden');
      expect(Array.isArray(traits.positive)).toBe(true);
      expect(Array.isArray(traits.negative)).toBe(true);
      expect(Number.isInteger(traits.hiddenCount)).toBe(true);
      expect(traits.hiddenCount).toBe(response.body.data.summary.hiddenTraits);

      // Check trait structure
      if (traits.positive.length > 0) {
        expect(traits.positive[0]).toHaveProperty('name');
        expect(traits.positive[0]).toHaveProperty('definition');
      }
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app)
        .get('/api/v1/traits/horse/invalid')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get('/api/v1/traits/horse/99999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });

  describe('GET /api/v1/traits/definitions', () => {
    it('should get all trait definitions', async () => {
      const response = await request(app)
        .get('/api/v1/traits/definitions')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('traits');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('filter', 'all');
      expect(typeof response.body.data.traits).toBe('object');
      expect(response.body.data.count).toBeGreaterThan(0);

      // Check trait definition structure
      const traitKeys = Object.keys(response.body.data.traits);
      if (traitKeys.length > 0) {
        const firstTrait = response.body.data.traits[traitKeys[0]];
        expect(firstTrait).toHaveProperty('name');
        expect(firstTrait).toHaveProperty('type');
        expect(firstTrait).toHaveProperty('rarity');
      }
    });

    it('should filter traits by type', async () => {
      const response = await request(app)
        .get('/api/v1/traits/definitions?type=positive')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.filter).toBe('positive');

      // All returned traits should be positive
      const { traits } = response.body.data;
      Object.values(traits).forEach(trait => {
        expect(trait.type).toBe('positive');
      });
    });

    it('should return validation error for invalid type', async () => {
      const response = await request(app)
        .get('/api/v1/traits/definitions?type=invalid')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Type must be either "all", "positive", or "negative"');
    });
  });

  describe('GET /api/v1/traits/discovery-status/:horseId', () => {
    it('should get discovery status successfully', async () => {
      const response = await request(app)
        .get(`/api/v1/traits/discovery-status/${testHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testHorse.id);
      expect(response.body.data).toHaveProperty('horseName', testHorse.name);
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('traitCounts');
      expect(response.body.data).toHaveProperty('discoveryConditions');
      expect(response.body.data).toHaveProperty('canDiscover');

      const { currentStats } = response.body.data;
      expect(currentStats).toHaveProperty('bondScore');
      expect(currentStats).toHaveProperty('age');

      const { traitCounts } = response.body.data;
      expect(traitCounts).toHaveProperty('visible');
      expect(traitCounts).toHaveProperty('hidden');

      // Equoria-ecp0i. OLD CONTRACT: discoveryConditions also carried an
      // `enrichment` array. NEW RULING (owner, 2026-10-16, fr2kg F14): the
      // player-run enrichment discovery list is removed.
      const { discoveryConditions } = response.body.data;
      expect(discoveryConditions).toHaveProperty('met');
      expect(discoveryConditions).not.toHaveProperty('enrichment');
      expect(discoveryConditions).toHaveProperty('total');
      expect(Array.isArray(discoveryConditions.met)).toBe(true);
    });

    it('should return validation error for invalid horse ID', async () => {
      const response = await request(app)
        .get('/api/v1/traits/discovery-status/invalid')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse ID must be a positive integer');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get('/api/v1/traits/discovery-status/99999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });
  });
});
