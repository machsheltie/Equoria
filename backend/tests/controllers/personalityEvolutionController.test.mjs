/**
 * Personality Evolution Controller API Tests
 *
 * Tests comprehensive personality evolution API endpoints including groom and horse evolution,
 * triggers analysis, stability assessment, prediction capabilities, and batch processing.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Groom personality evolution API with interaction pattern validation
 * - Horse temperament evolution API with care history analysis
 * - Evolution triggers calculation and analysis endpoints
 * - Personality stability assessment API functionality
 * - Evolution prediction capabilities with timeframe parameters
 * - Evolution history retrieval and tracking
 * - Manual evolution effects application (admin functionality)
 * - Batch processing for multiple entities
 * - System configuration endpoint validation
 */

// jest import removed - not used in this file
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-0y9f5: fail-loud, FK-ordered, id-scoped cleanup — a failed delete
// throws in afterAll instead of leaking fixture rows into the canonical DB.
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';

describe('Personality Evolution Controller API', () => {
  // Equoria-plw0h: per-user CSRF binding — csrfProtection derives the
  // sessionIdentifier from req.user.id on authenticated mutations, so the
  // token must be ISSUED under that same identity. The pair is fetched in
  // beforeAll AFTER authToken exists, forwarding the accessToken cookie so
  // issuance binds to testUser.id (an anonymous salt-bound token would 403).
  let __csrf__;

  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate birth date for 2-year-old horse
  const birthDate2YearsOld = new Date(referenceDate);
  birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2); // 2023-06-01 (age 2)

  let testUser;
  let testGroom;
  let testHorse;
  let testBreed;
  let authToken;

  // Fail-loud cleanup ledger: every fixture row id is tracked the moment it
  // is created, and afterAll deletes are strictly id-scoped + FK-ordered
  // (interactions → horses → grooms → users → breed; Horse.userId and
  // Horse.breedId are ON DELETE RESTRICT).
  const cleanup = createCleanupTracker();
  const ids = { interactions: [], horses: [], grooms: [], users: [], breeds: [] };

  beforeAll(async () => {
    cleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { id: { in: ids.interactions } } }),
      'groomInteractions',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horses } } }), 'horses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.grooms } } }), 'grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.users } } }), 'users');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: { in: ids.breeds } } }), 'breeds');

    // Unique per-run fixture suffix — the previous fixed names
    // ('Test Breed API', 'API Test Groom', 'API Test Horse') collide across
    // concurrent/interrupted runs and required a name-scoped pre-clean.
    const ts = randomBytes(8).toString('hex');

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `personality_evolution_api_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `personality_evolution_api_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });
    ids.users.push(testUser.id);

    // Generate auth token
    authToken = generateTestToken({ id: testUser.id, email: testUser.email });

    // Equoria-plw0h: CSRF pair bound to the acting identity — fetched after
    // the fixture token exists, forwarding the accessToken cookie so
    // tryPopulateUserFromAccessCookie binds issuance to testUser.id.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `TestFixture-PersEvoBreed-${ts}`,
        description: 'Test breed for personality evolution API testing',
      },
    });
    ids.breeds.push(testBreed.id);

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        userId: testUser.id,
        name: `TestFixture-PersEvoGroom-${ts}`,
        speciality: 'foal_care',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        skillLevel: 'intermediate',
        experience: 100,
        level: 5,
        sessionRate: 25.0,
        isActive: true,
      },
    });
    ids.grooms.push(testGroom.id);

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        userId: testUser.id,
        breedId: testBreed.id,
        name: `TestFixture-PersEvoHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: birthDate2YearsOld,
        age: 2,
        temperament: 'nervous',
        stressLevel: 7,
        bondScore: 20,
        healthStatus: 'Good',
        speed: 50,
        stamina: 50,
        agility: 50,
        balance: 50,
        precision: 50,
        intelligence: 50,
        boldness: 50,
        flexibility: 50,
        obedience: 50,
        focus: 50,
        epigeneticFlags: [],
      },
    });
    ids.horses.push(testHorse.id);

    // Create interaction history for testing
    for (let i = 0; i < 20; i++) {
      const interaction = await prisma.groomInteraction.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          taskType: 'trust_building',
          interactionType: 'enrichment',
          bondingChange: 2,
          stressChange: -2,
          quality: 'excellent',
          cost: 25.0,
          duration: 30,
          notes: 'API test interaction for evolution',
        },
      });
      ids.interactions.push(interaction.id);
    }
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterAll(() => cleanup.run(), 120000);

  describe('POST /api/v1/personality-evolution/groom/:groomId/evolve', () => {
    test('should evolve groom personality successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/personality-evolution/groom/${testGroom.id}/evolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('evolution');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.success).toBe(true);
      expect(typeof response.body.data.personalityEvolved).toBe('boolean');
    });

    test('should return 400 for invalid groom ID', async () => {
      const response = await request(app)
        .post('/api/v1/personality-evolution/groom/invalid/evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .post(`/api/v1/personality-evolution/groom/${testGroom.id}/evolve`)
        .set('Origin', 'http://localhost:3000')

        .expect(401);
    });
  });

  describe('POST /api/v1/personality-evolution/horse/:horseId/evolve', () => {
    test('should evolve horse temperament successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/personality-evolution/horse/${testHorse.id}/evolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('evolution');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.success).toBe(true);
      expect(typeof response.body.data.temperamentEvolved).toBe('boolean');
    });

    test('should return 400 for invalid horse ID', async () => {
      const response = await request(app)
        .post('/api/v1/personality-evolution/horse/invalid/evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/personality-evolution/:entityType/:entityId/triggers', () => {
    test('should get evolution triggers for groom', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/groom/${testGroom.id}/triggers`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.triggers).toBeDefined();
      expect(response.body.data.evolutionReadiness).toBeDefined();
      expect(typeof response.body.data.evolutionReadiness).toBe('number');
    });

    test('should get evolution triggers for horse', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/horse/${testHorse.id}/triggers`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.triggers).toBeDefined();
      expect(response.body.data.evolutionReadiness).toBeDefined();
    });

    test('should return 400 for invalid entity type', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/invalid/${testGroom.id}/triggers`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/personality-evolution/:entityType/:entityId/stability', () => {
    test('should analyze personality stability for groom', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/groom/${testGroom.id}/stability`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stabilityScore).toBeDefined();
      expect(typeof response.body.data.stabilityScore).toBe('number');
      expect(response.body.data.stabilityFactors).toBeDefined();
    });

    test('should analyze personality stability for horse', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/horse/${testHorse.id}/stability`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stabilityScore).toBeDefined();
      expect(response.body.data.stabilityFactors).toBeDefined();
    });
  });

  describe('GET /api/v1/personality-evolution/:entityType/:entityId/predict', () => {
    test('should predict personality evolution with default timeframe', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/groom/${testGroom.id}/predict`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.predictions).toBeDefined();
      expect(Array.isArray(response.body.data.predictions)).toBe(true);
    });

    test('should predict personality evolution with custom timeframe', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/horse/${testHorse.id}/predict?timeframeDays=60`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.predictions).toBeDefined();
    });

    test('should return 400 for invalid timeframe', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/groom/${testGroom.id}/predict?timeframeDays=500`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/personality-evolution/:entityType/:entityId/history', () => {
    test('should get personality evolution history', async () => {
      const response = await request(app)
        .get(`/api/v1/personality-evolution/groom/${testGroom.id}/history`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.evolutionEvents).toBeDefined();
      expect(Array.isArray(response.body.data.evolutionEvents)).toBe(true);
      expect(response.body.data.totalEvolutions).toBeDefined();
    });
  });

  describe('POST /api/v1/personality-evolution/apply-effects', () => {
    test('should apply personality evolution effects successfully', async () => {
      const evolutionData = {
        entityId: testGroom.id,
        entityType: 'groom',
        evolutionType: 'trait_strengthening',
        newTraits: ['enhanced_patience'],
        stabilityPeriod: 14,
        effectStrength: 0.8,
      };

      const response = await request(app)
        .post('/api/v1/personality-evolution/apply-effects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(evolutionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.effectsApplied).toBeDefined();
    });

    test('should return 400 for missing required fields', async () => {
      const invalidData = {
        entityId: testGroom.id,
        // Missing entityType and evolutionType
      };

      const response = await request(app)
        .post('/api/v1/personality-evolution/apply-effects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('POST /api/v1/personality-evolution/batch-evolve', () => {
    test('should process batch evolution successfully', async () => {
      const batchData = {
        entities: [
          { entityId: testGroom.id, entityType: 'groom' },
          { entityId: testHorse.id, entityType: 'horse' },
        ],
      };

      const response = await request(app)
        .post('/api/v1/personality-evolution/batch-evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(batchData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.results).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.summary).toBeDefined();
    });

    test('should return 400 for empty entities array', async () => {
      const response = await request(app)
        .post('/api/v1/personality-evolution/batch-evolve')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ entities: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });
  });

  describe('GET /api/v1/personality-evolution/config', () => {
    test('should get system configuration successfully', async () => {
      const response = await request(app)
        .get('/api/v1/personality-evolution/config')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.evolutionTypes).toBeDefined();
      expect(Array.isArray(response.body.data.evolutionTypes)).toBe(true);
      expect(response.body.data.entityTypes).toBeDefined();
      expect(response.body.data.groomConfig).toBeDefined();
      expect(response.body.data.horseConfig).toBeDefined();
      expect(response.body.data.availableTraits).toBeDefined();
    });
  });
});
