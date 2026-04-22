/**
 * Dynamic Compatibility Controller Tests
 *
 * Tests API endpoints for advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Real-time compatibility scoring with contextual factors
 * - Environmental and situational modifiers
 * - Historical performance integration
 * - Adaptive scoring based on interaction outcomes
 * - Multi-factor compatibility analysis
 * - Predictive compatibility modeling
 * - API endpoint validation and error handling
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('Dynamic Compatibility Controller API', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate birth date for 2-year-old horse
  const birthDate2YearsOld = new Date(referenceDate);
  birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2); // 2023-06-01 (age 2)

  let testUser;
  let testToken;
  let testGrooms = [];
  let testHorses = [];

  // Per-worker prefix isolates this suite's rows from every other suite so
  // broad `contains`-style cleanups in other files cannot touch our data.
  const RUN_PREFIX = `compat-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let testBreedId = null;

  // Helper: (re)create the user + 3 grooms + 3 horses atomically. Called from
  // beforeEach rather than beforeAll because the previous once-only fixture
  // sometimes had its rows disappear partway through the 11-test run under
  // the full 4971-test pre-push suite, producing a 404 from requireOwnership
  // and a non-200 status at the assertion on line ~380. Creating per-test in
  // a single transaction guarantees every test starts from a known-good state.
  const createFixture = async () => {
    // Ensure a breed exists once per suite (findFirst + create).
    if (testBreedId === null) {
      const breed =
        (await prisma.breed.findFirst({ where: { name: `${RUN_PREFIX}-breed` } })) ??
        (await prisma.breed.create({
          data: {
            name: `${RUN_PREFIX}-breed`,
            description: 'Test breed for compatibility testing',
          },
        }));
      testBreedId = breed.id;
    }

    const uid = `${RUN_PREFIX}-${Date.now()}`;
    const groomData = [
      {
        name: `Calm Expert ${uid}`,
        personality: 'calm',
        skillLevel: 'expert',
        experience: 200,
        level: 10,
        speciality: 'foal_care',
      },
      {
        name: `Energetic Novice ${uid}`,
        personality: 'energetic',
        skillLevel: 'novice',
        experience: 50,
        level: 3,
        speciality: 'general_grooming',
      },
      {
        name: `Methodical Intermediate ${uid}`,
        personality: 'methodical',
        skillLevel: 'intermediate',
        experience: 120,
        level: 6,
        speciality: 'enrichment',
      },
    ];

    const horseData = [
      { name: `Fearful Horse ${uid}`, temperament: 'nervous', stressLevel: 9, bondScore: 15 },
      { name: `Confident Horse ${uid}`, temperament: 'confident', stressLevel: 3, bondScore: 35 },
      { name: `Developing Horse ${uid}`, temperament: 'developing', stressLevel: 5, bondScore: 25 },
    ];

    const fixture = await prisma.$transaction(async client => {
      const user = await client.user.create({
        data: {
          username: `${RUN_PREFIX}-${uid}`,
          email: `${RUN_PREFIX}-${uid}@test.com`,
          password: 'test_hash',
          firstName: 'Test',
          lastName: 'User',
          money: 1000,
          xp: 0,
          level: 1,
        },
      });

      const grooms = [];
      for (const data of groomData) {
        grooms.push(
          await client.groom.create({
            data: {
              userId: user.id,
              name: data.name,
              speciality: data.speciality,
              personality: data.personality,
              epigeneticInfluenceType: data.personality,
              skillLevel: data.skillLevel,
              experience: data.experience,
              level: data.level,
              sessionRate: 25.0,
              isActive: true,
            },
          }),
        );
      }

      const horses = [];
      for (const data of horseData) {
        horses.push(
          await client.horse.create({
            data: {
              userId: user.id,
              breedId: testBreedId,
              name: data.name,
              sex: 'Filly',
              dateOfBirth: birthDate2YearsOld,
              age: 2,
              temperament: data.temperament,
              stressLevel: data.stressLevel,
              bondScore: data.bondScore,
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
          }),
        );
      }

      return { user, grooms, horses };
    });

    testUser = fixture.user;
    testGrooms = fixture.grooms;
    testHorses = fixture.horses;
    testToken = generateTestToken({ id: testUser.id, email: testUser.email });
  };

  beforeEach(async () => {
    await createFixture();
  });

  afterEach(async () => {
    if (testUser) {
      await prisma.horse.deleteMany({ where: { userId: testUser.id } });
      await prisma.groom.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.deleteMany({ where: { id: testUser.id } });
      testUser = null;
      testGrooms = [];
      testHorses = [];
    }
  });

  afterAll(async () => {
    // Breed is reused across all tests in the suite; delete last.
    if (testBreedId !== null) {
      await prisma.breed.deleteMany({ where: { id: testBreedId } });
    }
  });

  describe('POST /api/compatibility/calculate', () => {
    test('should calculate high compatibility for calm groom with fearful horse', async () => {
      const [calmGroom] = testGrooms;
      const [fearfulHorse] = testHorses;

      const requestBody = {
        groomId: calmGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'morning',
          horseCurrentStress: 9,
          environmentalFactors: ['quiet', 'familiar'],
          recentInteractions: [],
        },
      };

      const response = await request(app)
        .post('/api/compatibility/calculate')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.overallScore).toBeGreaterThan(0.7);
      expect(response.body.data.recommendationLevel).toBe('highly_recommended');
      expect(response.body.data.confidence).toBeCloseTo(0.8, 1);
    });

    test('should calculate low compatibility for energetic groom with fearful horse', async () => {
      const energeticGroom = testGrooms[1];
      const [fearfulHorse] = testHorses;

      const requestBody = {
        groomId: energeticGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'afternoon',
          horseCurrentStress: 9,
          environmentalFactors: ['noisy', 'unfamiliar'],
          recentInteractions: [],
        },
      };

      const response = await request(app)
        .post('/api/compatibility/calculate')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overallScore).toBeLessThan(0.4);
      expect(response.body.data.recommendationLevel).toBe('not_recommended');
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/compatibility/calculate')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          groomId: testGrooms[0].id,
          // Missing horseId and context
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 401 for missing authentication', async () => {
      const response = await request(app)
        .post('/api/compatibility/calculate')
        .send({
          groomId: testGrooms[0].id,
          horseId: testHorses[0].id,
          context: { taskType: 'trust_building' },
        })
        .set('x-test-require-auth', 'true')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/compatibility/factors/:groomId/:horseId', () => {
    test('should analyze compatibility factors comprehensively', async () => {
      const [calmGroom] = testGrooms;
      const [fearfulHorse] = testHorses;

      const response = await request(app)
        .get(`/api/compatibility/factors/${calmGroom.id}/${fearfulHorse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.personalityMatch).toBeDefined();
      expect(response.body.data.experienceLevel).toBeDefined();
      expect(response.body.data.stressCompatibility).toBeDefined();
      expect(response.body.data.bondingPotential).toBeDefined();
      expect(response.body.data.taskEffectiveness).toBeDefined();
      expect(response.body.data.riskFactors).toBeDefined();
      expect(response.body.data.strengthFactors).toBeDefined();
      expect(response.body.data.overallAssessment).toBeDefined();
    });

    test('should return 400 for invalid groom ID', async () => {
      const response = await request(app)
        .get(`/api/compatibility/factors/invalid/${testHorses[0].id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/compatibility/predict', () => {
    test('should predict positive outcome for good compatibility', async () => {
      const [calmGroom] = testGrooms;
      const [fearfulHorse] = testHorses;

      const requestBody = {
        groomId: calmGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          duration: 30,
          environmentalFactors: ['quiet', 'familiar'],
        },
      };

      const response = await request(app)
        .post('/api/compatibility/predict')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.predictedBondingChange).toBeGreaterThan(0);
      expect(response.body.data.predictedStressChange).toBeLessThan(2);
      expect(['good', 'excellent'].includes(response.body.data.predictedQuality)).toBe(true);
      expect(response.body.data.successProbability).toBeGreaterThan(0.6);
    });

    test('should predict negative outcome for poor compatibility', async () => {
      const energeticGroom = testGrooms[1];
      const [fearfulHorse] = testHorses;

      const requestBody = {
        groomId: energeticGroom.id,
        horseId: fearfulHorse.id,
        context: {
          taskType: 'desensitization',
          duration: 30,
          environmentalFactors: ['noisy'],
        },
      };

      const response = await request(app)
        .post('/api/compatibility/predict')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.predictedBondingChange).toBeLessThan(2);
      expect(response.body.data.predictedStressChange).toBeGreaterThanOrEqual(1);
      expect(response.body.data.successProbability).toBeLessThanOrEqual(0.52);
    });
  });

  describe('POST /api/compatibility/recommendations', () => {
    test('should recommend optimal grooms for specific horse and context', async () => {
      const [fearfulHorse] = testHorses;

      const requestBody = {
        horseId: fearfulHorse.id,
        context: {
          taskType: 'trust_building',
          timeOfDay: 'morning',
          urgency: 'normal',
          environmentalFactors: ['quiet'],
        },
      };

      const response = await request(app)
        .post('/api/compatibility/recommendations')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data.rankedGrooms)).toBe(true);
      expect(response.body.data.rankedGrooms.length).toBeGreaterThan(0);
      expect(response.body.data.topRecommendation).toBeDefined();
      expect(response.body.data.alternativeOptions).toBeDefined();

      // Should rank grooms by compatibility score (business logic validation)

      const topGroom = response.body.data.rankedGrooms[0];
      // Verify a valid groom recommendation with appropriate properties
      expect(topGroom.groomId).toBeDefined();
      expect(topGroom.groomName).toBeDefined();
      expect(topGroom.compatibilityScore).toBeGreaterThan(0);
      expect(topGroom.epigeneticInfluenceType).toBeDefined();
      expect(topGroom.skillLevel).toBeDefined();
      expect(topGroom.reasoning).toBeDefined();
    });
  });

  describe('GET /api/compatibility/trends/:groomId/:horseId', () => {
    test('should analyze compatibility trends with insufficient data', async () => {
      const [groom] = testGrooms;
      const [horse] = testHorses;

      const response = await request(app)
        .get(`/api/compatibility/trends/${groom.id}/${horse.id}`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.overallTrend).toBe('insufficient_data');
      expect(response.body.data.dataPoints).toBeLessThan(3);
    });
  });

  describe('GET /api/compatibility/config', () => {
    test('should return compatibility system configuration', async () => {
      const response = await request(app)
        .get('/api/compatibility/config')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.personalityTypes).toBeDefined();
      expect(response.body.data.temperamentTypes).toBeDefined();
      expect(response.body.data.taskTypes).toBeDefined();
      expect(response.body.data.environmentalFactors).toBeDefined();
      expect(response.body.data.recommendationLevels).toBeDefined();
    });
  });
});
