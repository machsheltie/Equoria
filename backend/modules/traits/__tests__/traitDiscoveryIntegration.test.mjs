import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// Equoria-gu8jk (owner ruling 2026-10-20: players never reveal traits): the
// POST /traits/discover/:id and /traits/batch-discover cases and the "discovery
// workflow" case were removed with those routes; the read-only progress,
// conditions and check-conditions coverage stays.

// SECURITY FIX (Phase 1, Task 1.1): Removed all x-test-bypass-ownership headers
// Tests now use proper JWT authentication with real token generation

const buildToken = userId =>
  jwt.sign({ id: userId, email: `${userId}@example.com` }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

describe('Trait Discovery API Integration Tests', () => {
  // Per-user CSRF (Equoria-plw0h): every mutation in this suite sends
  // Authorization: Bearer ${authToken} for the same testUserId, so the
  // validate-time sessionIdentifier resolves to req.user.id === testUserId.
  // The shared CSRF token is therefore minted bound to that user's
  // accessToken (in beforeAll, after authToken exists) so the binding
  // matches. Minting here (not in a separate earlier beforeAll) guarantees
  // authToken is already defined.
  let __csrf__;

  let testBreed;
  let testFoals = [];
  let authToken;
  const testUserId = 'test-trait-discovery-user';

  beforeAll(async () => {
    // Generate authentication token for test user
    authToken = buildToken(testUserId);
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Create test user in database (required for ownership validation)
    await prisma.user.create({
      data: {
        id: testUserId,
        username: 'test-trait-user',
        email: 'test-trait-discovery-user@example.com',
        password: 'hashed_password_placeholder',
        role: 'user',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Create test breed with unique name
    const uniqueName = `Test Breed for Trait Discovery ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    testBreed = await prisma.breed.create({
      data: {
        name: uniqueName,
        description: 'Test breed for trait discovery testing',
      },
    });

    // Create test foals with different conditions (owned by test user)
    const foal1 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'High Bond Foal',
        age: 0,
        sex: 'Filly',
        breedId: testBreed.id,
        dateOfBirth: new Date('2024-01-01'),
        bondScore: 85,
        stressLevel: 15,
        userId: testUserId, // Use relation instead of userId field
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['intelligent', 'calm', 'athletic', 'resilient', 'bold'],
        },
      },
    });

    const foal2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Low Stats Foal',
        age: 0,
        sex: 'Colt',
        breedId: testBreed.id,
        dateOfBirth: new Date('2024-01-01'),
        bondScore: 30,
        stressLevel: 70,
        userId: testUserId, // Use relation instead of userId field
        epigeneticModifiers: {
          positive: [],
          negative: [],
          hidden: ['resilient', 'nervous', 'stubborn'],
        },
      },
    });

    const foal3 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Adult Horse',
        age: 5,
        sex: 'Stallion',
        breedId: testBreed.id,
        dateOfBirth: new Date('2019-01-01'),
        bondScore: 90,
        stressLevel: 10,
        userId: testUserId, // Use relation instead of userId field
        epigeneticModifiers: {
          positive: ['calm'],
          negative: [],
          hidden: [],
        },
      },
    });

    testFoals = [foal1, foal2, foal3];

    // Create foal development records
    await prisma.foalDevelopment.create({
      data: {
        foalId: foal1.id,
        currentDay: 3,
        bondingLevel: 85,
        stressLevel: 15,
      },
    });

    await prisma.foalDevelopment.create({
      data: {
        foalId: foal2.id,
        currentDay: 2,
        bondingLevel: 30,
        stressLevel: 70,
      },
    });

    // Create some enrichment activities for foal1
    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 1,
        activity: 'gentle_handling',
        outcome: 'Gentle Touch - Successful bonding session',
        bondChange: 5,
        stressChange: -2,
      },
    });

    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 2,
        activity: 'human_interaction',
        outcome: 'Human Bonding - Positive interaction',
        bondChange: 3,
        stressChange: -1,
      },
    });

    await prisma.foalTrainingHistory.create({
      data: {
        horseId: foal1.id,
        day: 3,
        activity: 'social_play',
        outcome: 'Social Time - Enjoyed playtime',
        bondChange: 2,
        stressChange: -1,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    for (const foal of testFoals) {
      try {
        await prisma.foalTrainingHistory.deleteMany({
          where: { horseId: foal.id },
        });
        await prisma.foalDevelopment.deleteMany({
          where: { foalId: foal.id },
        });
        await prisma.horse.deleteMany({ where: { id: foal.id } });
      } catch {
        // Ignore cleanup errors
      }
    }
    if (testBreed?.id) {
      try {
        await prisma.breed.deleteMany({ where: { id: testBreed.id } });
      } catch {
        // Ignore cleanup errors
      }
    }
    // Clean up test user
    try {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch {
      // Ignore cleanup errors
    }
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  describe('GET /api/v1/trait-discovery/progress/:foalId', () => {
    it('should return discovery progress for foal', async () => {
      const response = await request(app)
        .get(`/api/v1/trait-discovery/progress/${testFoals[0].id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[0].id);
      expect(response.body.data).toHaveProperty('horseName', 'High Bond Foal');
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('hiddenTraitsCount');

      expect(response.body.data.currentStats).toEqual({
        bondScore: 85,
        stressLevel: 15,
        developmentDay: 3,
      });

      // Should have all discovery conditions
      const { conditions } = response.body.data;
      expect(conditions).toHaveProperty('high_bond');
      expect(conditions).toHaveProperty('low_stress');
      expect(conditions).toHaveProperty('perfect_care');
      expect(conditions).toHaveProperty('consistent_training');

      // High bond condition should be met
      expect(conditions.high_bond.met).toBe(true);
      expect(conditions.high_bond.progress).toBe(100);

      // Low stress condition should be met
      expect(conditions.low_stress.met).toBe(true);
      expect(conditions.low_stress.progress).toBe(100);

      // Perfect care should be met (high bond + low stress)
      expect(conditions.perfect_care.met).toBe(true);
      expect(conditions.perfect_care.progress).toBe(100);
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app)
        .get('/api/v1/trait-discovery/progress/99999')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /api/v1/trait-discovery/conditions', () => {
    it('should return all discovery conditions', async () => {
      const response = await request(app)
        .get('/api/v1/trait-discovery/conditions')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('totalConditions');
      expect(response.body.data).toHaveProperty('categories');

      const { conditions } = response.body.data;
      expect(conditions.length).toBeGreaterThan(0);

      // Check structure of conditions
      conditions.forEach(condition => {
        expect(condition).toHaveProperty('key');
        expect(condition).toHaveProperty('name');
        expect(condition).toHaveProperty('description');
        // Owner ruling 2026-10-19 (Equoria-6dace): the per-condition trait-name
        // hint lists are no longer sent.
        expect(condition).not.toHaveProperty('revealableTraits');
        expect(condition).toHaveProperty('category');
      });

      // Check categories
      const { categories } = response.body.data;
      expect(categories).toHaveProperty('bonding');
      expect(categories).toHaveProperty('stress');
      expect(categories).toHaveProperty('activities');
      expect(categories).toHaveProperty('milestones');
    });
  });

  describe('POST /api/v1/trait-discovery/check-conditions/:foalId', () => {
    it('should check conditions without triggering discovery', async () => {
      const response = await request(app)
        .post(`/api/v1/trait-discovery/check-conditions/${testFoals[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('horseId', testFoals[0].id);
      expect(response.body.data).toHaveProperty('horseName', 'High Bond Foal');
      expect(response.body.data).toHaveProperty('currentStats');
      expect(response.body.data).toHaveProperty('conditions');
      expect(response.body.data).toHaveProperty('summary');

      const { conditions } = response.body.data;
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBeGreaterThan(0);

      // Each condition should have proper structure
      conditions.forEach(condition => {
        expect(condition).toHaveProperty('key');
        expect(condition).toHaveProperty('name');
        expect(condition).toHaveProperty('met');
        expect(condition).toHaveProperty('progress');
        expect(typeof condition.progress).toBe('number');
        expect(condition.progress).toBeGreaterThanOrEqual(0);
        expect(condition.progress).toBeLessThanOrEqual(100);
      });

      // Summary should have proper structure
      const { summary } = response.body.data;
      expect(summary).toHaveProperty('totalConditions');
      expect(summary).toHaveProperty('conditionsMet');
      expect(summary).toHaveProperty('averageProgress');
      expect(summary).toHaveProperty('hiddenTraitsRemaining');
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app)
        .post('/api/v1/trait-discovery/check-conditions/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});
