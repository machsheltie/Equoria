/**
 * Enhanced Groom Interactions Integration Tests
 * Tests the advanced groom-horse interaction system
 */

import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Enhanced Groom Interactions Integration Tests', () => {
  // Equoria-rnbzn: __csrf__ is bound to testUser (authToken) AFTER the user
  // exists. csrfProtection resolves the sessionIdentifier from req.user.id
  // (csrf.mjs#resolveSessionIdentifier); an anonymously-fetched token binds to
  // the fallback salt and 403s the authed POST /interact. Bound in the
  // user-creation beforeAll below.
  let __csrf__;

  let authToken;
  let testUser;
  let testGroom;
  let testHorse;
  // Equoria-jjzem: randomize fixture identifiers so a crashed prior run's
  // partial cleanup cannot collide with the next run's beforeAll on the
  // User.username / User.email unique constraints. Cleanup scopes by
  // `startsWith: 'TestFixture-jjzem-'` to catch any stale rows.
  const suffix = randomBytes(6).toString('hex');
  const username = `TestFixture-jjzem-enhanced-${suffix}`;
  const email = `testfixture-jjzem-enhanced-${suffix}@example.com`;

  beforeAll(async () => {
    // Sweep any stale TestFixture-jjzem- rows from crashed prior runs
    const staleUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'TestFixture-jjzem-enhanced-' } },
      select: { id: true },
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map(u => u.id);
      await prisma.groomInteraction.deleteMany({ where: { groom: { userId: { in: staleIds } } } });
      await prisma.groom.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.horse.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username,
        email,
        password: 'hashedpassword',
        firstName: 'Enhanced',
        lastName: 'TestUser',
        money: 10000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, username: testUser.username });

    // Bind the CSRF token to this user (per-user CSRF, Equoria-plw0h).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Enhanced Test Horse',
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -365), // 1 year old
        userId: testUser.id,
        bondScore: 25,
        // breedId is optional, so we'll omit it for the test
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Enhanced Test Groom',
        userId: testUser.id,
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 5,
        sessionRate: 25.0,
        bio: 'Test groom for enhanced interactions',
      },
    });

    // Equoria-4kp53: section 3 ('Relationship Details') asserts
    // statistics.totalInteractions > 0, so one groom interaction row is seeded
    // here. The enhanced interact door that used to make it is retired
    // (Equoria-l7xag: "groom horse" is the only way to groom), so the row is
    // written directly, as a past session would have left it.
    await prisma.groomInteraction.create({
      data: {
        foalId: testHorse.id,
        groomId: testGroom.id,
        interactionType: 'groomHorse',
        duration: 0,
        bondingChange: 5,
      },
    });

    // Test setup complete
  });

  afterAll(async () => {
    // Equoria-rnbzn: FK-ordered, scoped, fail-loud teardown. The previous
    // afterAll ran each delete bare (no aggregation) and used prisma.user.delete
    // (singular), which THROWS if the row is already gone — masking a real leak
    // as a flaky teardown error. createCleanupTracker runs every task even if
    // one throws, then throws ONE aggregated error so a leak into the canonical
    // DB (CLAUDE.md §2) fails the suite loudly.
    //
    // Order: groomInteraction (FK→groom & horse) → groom (FK→user) →
    // horse (USER-SCOPED — covers testHorse and any per-test horses that were
    // not individually deleted) → user. Horse.userId is onDelete:Restrict, so
    // the user delete is FK-blocked until its horses are gone.
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.groomInteraction.deleteMany({ where: { groom: { userId: testUser.id } } });
      }
    }, 'testUser groom interactions');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.groom.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser grooms');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.horse.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser horses');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }, 'testUser');
    await cleanup.run();
  });

  describe('1. Get Available Enhanced Interactions', () => {
    it('should get available interactions for groom-horse pair', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('horse');
      expect(response.body.data).toHaveProperty('relationship');
      expect(response.body.data).toHaveProperty('availableInteractions');
      expect(response.body.data).toHaveProperty('recommendations');

      // Check groom data
      const { groom } = response.body.data;
      expect(groom.id).toBe(testGroom.id);
      expect(groom.name).toBe(testGroom.name);
      expect(groom.speciality).toBe(testGroom.speciality);

      // Check horse data
      const { horse } = response.body.data;
      expect(horse.id).toBe(testHorse.id);
      expect(horse.name).toBe(testHorse.name);

      // Check relationship data
      const { relationship } = response.body.data;
      expect(relationship).toHaveProperty('level');
      expect(relationship).toHaveProperty('levelNumber');
      expect(relationship).toHaveProperty('bondingPoints');
      expect(relationship).toHaveProperty('multiplier');

      // Check available interactions
      const { availableInteractions } = response.body.data;
      expect(Array.isArray(availableInteractions)).toBe(true);
      expect(availableInteractions.length).toBeGreaterThan(0);

      // Each interaction should have required properties
      availableInteractions.forEach(interaction => {
        expect(interaction).toHaveProperty('id');
        expect(interaction).toHaveProperty('name');
        expect(interaction).toHaveProperty('category');
        expect(interaction).toHaveProperty('variations');
        expect(Array.isArray(interaction.variations)).toBe(true);
      });
    });

    it('should return 404 for non-existent groom', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/enhanced/interactions/99999/${testHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Groom not found');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/enhanced/interactions/${testGroom.id}/99999`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Horse not found');
    });
  });

  // Section 2 ('Perform Enhanced Interactions') drove POST
  // /api/grooms/enhanced/interact, retired by Equoria-l7xag (owner rulings
  // 2026-10-20 and 2026-10-26: one daily "groom horse", +5 bond). Grooming is
  // covered by modules/grooms/__tests__/groomCareRoutes.integration.test.mjs.

  describe('3. Relationship Details', () => {
    it('should get detailed relationship information', async () => {
      const response = await request(app)
        .get(`/api/v1/grooms/enhanced/relationship/${testGroom.id}/${testHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('relationship');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('recentInteractions');
      expect(response.body.data).toHaveProperty('milestones');

      // Check relationship data
      const { relationship } = response.body.data;
      expect(relationship).toHaveProperty('level');
      expect(relationship).toHaveProperty('levelNumber');
      expect(relationship).toHaveProperty('bondingPoints');
      expect(relationship).toHaveProperty('multiplier');

      // Check statistics
      const { statistics } = response.body.data;
      expect(statistics).toHaveProperty('totalInteractions');
      expect(statistics).toHaveProperty('totalBonding');
      expect(statistics).toHaveProperty('averageQuality');
      expect(statistics.totalInteractions).toBeGreaterThan(0);

      // Check recent interactions
      const { recentInteractions } = response.body.data;
      expect(Array.isArray(recentInteractions)).toBe(true);

      // Check milestones
      const { milestones } = response.body.data;
      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBeGreaterThan(0);
    });
  });

  describe('4. Information Endpoints', () => {
    it('should get interaction types', async () => {
      const response = await request(app)
        .get('/api/v1/grooms/enhanced/interactions/types')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interactionTypes');
      expect(response.body.data).toHaveProperty('categories');

      const { interactionTypes } = response.body.data;
      expect(Array.isArray(interactionTypes)).toBe(true);
      expect(interactionTypes.length).toBeGreaterThan(0);

      // Each interaction type should have required properties
      interactionTypes.forEach(type => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('category');
        expect(type).toHaveProperty('variations');
        expect(Array.isArray(type.variations)).toBe(true);
      });
    });
  });

  describe('5. Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        `/api/v1/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`,
        '/api/v1/grooms/enhanced/interact',
        `/api/v1/grooms/enhanced/relationship/${testGroom.id}/${testHorse.id}`,
        '/api/v1/grooms/enhanced/interactions/types',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
      }
    });

    it("should prevent access to other users' grooms and horses", async () => {
      // Sweep stale TestFixture-jjzem-enhanced-other- rows from prior runs
      const staleOthers = await prisma.user.findMany({
        where: { username: { startsWith: 'TestFixture-jjzem-enhanced-other-' } },
        select: { id: true },
      });
      if (staleOthers.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: staleOthers.map(u => u.id) } } });
      }
      // Create another user
      const otherSuffix = randomBytes(6).toString('hex');
      const otherUser = await prisma.user.create({
        data: {
          username: `TestFixture-jjzem-enhanced-other-${otherSuffix}`,
          email: `testfixture-jjzem-enhanced-other-${otherSuffix}@example.com`,
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'TestUser',
        },
      });

      const otherToken = generateTestToken({ id: otherUser.id, username: otherUser.username });

      try {
        const response = await request(app)
          .get(`/api/v1/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      } finally {
        // Clean up
        await prisma.user.deleteMany({ where: { id: otherUser.id } });
      }
    });
  });
});
