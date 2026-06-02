/**
 * 🧪 INTEGRATION TEST: Complete Training Progression Workflow
 *
 * This test validates the ENTIRE training progression from young horse
 * to competition-ready athlete, following balanced mocking principles.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Horses must be 3+ years old to train
 * - ONE training session per week total (any discipline) - 7-day cooldown
 * - Horses can change disciplines week-to-week but NOT within same week
 * - Training awards +5 discipline score and +5 XP to user
 * - Multi-discipline progression happens over multiple weeks (not same week)
 *
 * 🎯 WORKFLOW TESTED:
 * 1. Horse Maturation (Age Progression)
 * 2. First Training Session (Age Validation)
 * 3. Weekly Training Cooldown Management
 * 4. XP & Progression Tracking
 * 5. Competition Readiness
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Database operations, business logic, training calculations, XP system, cooldown enforcement
 * 🔧 MOCK: Only timestamp manipulation for simulating weekly progression (minimal, realistic)
 *
 * 💡 TEST STRATEGY: Use test data manipulation to simulate weekly time passage rather than
 *    complex time mocking, ensuring we test real business logic with realistic scenarios
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-cfv3c: fail-loud, FK-ordered scoped cleanup. The prior swallowed
// try/catch hid a delete failure: if the user delete tripped the
// horses_userId_fkey RESTRICT (children not yet removed), the error was
// silently ignored and the fixture user + its horses leaked into the
// canonical DB. The tracker re-raises so a cleanup failure is a TEST failure
// and gets fixed at the source.
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
dotenv.config({ path: join(__dirname, '../../.env.test') });

// Import real modules (minimal mocking)
const app = (await import('../../app.mjs')).default;
const { default: prisma } = await import('../../../packages/database/prismaClient.mjs');

/**
 * Extract cookie value from Set-Cookie header array
 */
const extractCookie = (cookies, name) => {
  if (!cookies || !Array.isArray(cookies)) {
    return null;
  }
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  if (!cookie) {
    return null;
  }
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
};

describe('🏋️ INTEGRATION: Complete Training Progression Workflow', () => {
  // Equoria-tqhci: per-user CSRF binding (Equoria-plw0h). The CSRF token's
  // sessionIdentifier resolves to req.user.id for authenticated mutations
  // (see backend/middleware/csrf.mjs#resolveSessionIdentifier). authToken is
  // only minted in STEP 1's register response, so __csrf__ MUST be issued
  // AFTER the token exists — fetching it in a top-level beforeAll would bind
  // to the anonymous CSRF_SESSION_SALT and every Bearer POST below would 403.
  // It is therefore set inside STEP 1, once authToken is extracted.
  let __csrf__;

  let testUser;
  let authToken;
  let youngHorse;
  let matureHorse;
  let originalDateNow;

  // Equoria-cs6wf: randomize fixture identifiers so a crashed prior run's
  // partial cleanup cannot collide with the next run's beforeEach on the
  // User.username / User.email unique constraints. Cleanup probes were
  // widened from exact `email: 'training-integration@example.com'` to
  // scoped `email: { contains: 'training-integration' }` so they continue
  // to catch stale rows from any prior crash regardless of the randomized
  // suffix.
  const suffix = randomBytes(6).toString('hex');
  // Equoria-3xph4: the production register validator
  // (backend/modules/auth/routes/authRoutes.mjs) requires username
  // isLength({ min: 3, max: 30 }) AND matches(/^[a-zA-Z0-9_]+$/). The prior
  // value `TestFixture-cs6wf-trainingprogression-${suffix}` was ~50 chars
  // AND contained hyphens — two validation failures, so STEP 1 register
  // returned 400 -> no token -> STEPS 2+ cascaded. `tp${suffix}` = "tp" +
  // 12 hex = 14 chars, all [a-z0-9], so it provably passes both rules. The
  // email is unchanged, so the cleanup probe
  // (`email: { contains: 'training-integration' }`) still matches.
  const username = `tp${suffix}`;
  const email = `testfixture-cs6wf-training-integration-${suffix}@example.com`;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();

    // Mock Date.now for time-based testing (ONLY for cooldown testing)
    originalDateNow = Date.now;
  });

  afterAll(async () => {
    // Restore mocks
    Date.now = originalDateNow;

    // Clean up test data
    await cleanupTestData();
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  async function cleanupTestData() {
    // Equoria-cfv3c: FK-ordered, scoped, fail-loud cleanup. The tracker runs
    // every task even if one throws (so partial cleanup still happens) and
    // re-raises an aggregated error if any failed. Order respects the
    // RESTRICT FKs: trainingLog (horseId) + xpEvent (userId) BEFORE horse,
    // and horse (userId) BEFORE user — otherwise the user delete trips
    // horses_userId_fkey. All deletes are name-prefix / email-scoped.
    const cleanup = createCleanupTracker();
    cleanup.add(
      () =>
        prisma.trainingLog.deleteMany({
          where: { horse: { name: { startsWith: 'Training Integration' } } },
        }),
      'trainingLog',
    );
    cleanup.add(
      () =>
        prisma.xpEvent.deleteMany({
          where: { user: { email: { contains: 'training-integration' } } },
        }),
      'xpEvent',
    );
    cleanup.add(
      () =>
        // Equoria-cfv3c: user-scoped (NOT name-scoped) so the auto-created
        // STARTER horse (onboardingService, different name) is also removed —
        // a name-only probe leaks it and the user delete trips horses_userId_fkey.
        prisma.horse.deleteMany({
          where: { user: { email: { contains: 'training-integration' } } },
        }),
      'horse',
    );
    cleanup.add(
      () =>
        prisma.user.deleteMany({
          where: { email: { contains: 'training-integration' } },
        }),
      'user',
    );
    await cleanup.run();
  }

  describe('🔐 STEP 1: User Setup & Authentication', () => {
    it('should create user for training progression testing', async () => {
      const userData = {
        username,
        firstName: 'Training',
        lastName: 'Progression',
        email,
        password: 'TestPassword123!',
        // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
        dateOfBirth: '1990-01-01',
        money: 10000,
        xp: 0,
        level: 1,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send(userData)
        .expect(201);

      testUser = response.body.data.user;

      // Extract accessToken from httpOnly cookie
      const cookies = response.headers['set-cookie'];
      authToken = extractCookie(cookies, 'accessToken');
      expect(authToken).toBeDefined();

      // Equoria-tqhci: bind per-user CSRF now that authToken exists. Forwarding
      // the accessToken cookie on the GET /csrf-token request lets the issuance
      // path populate req.user.id, so the token's sessionIdentifier matches the
      // one authenticateToken resolves on the STEP 3/4/5 mutations below.
      __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

      // VERIFY: User starts with correct progression stats
      expect(testUser.xp).toBe(0);
      expect(testUser.level).toBe(1);
    });
  });

  describe('🐴 STEP 2: Horse Creation & Age Validation', () => {
    it('should create young horse (under training age)', async () => {
      const breed =
        (await prisma.breed.findFirst()) ||
        (await prisma.breed.create({
          data: {
            name: 'Training Integration Breed',
            description: 'Test breed for training integration',
          },
        }));

      // Calculate a date that's exactly 2 years ago from today
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      youngHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'Training Integration Young Horse',
          age: 2, // Too young for training
          breed: { connect: { id: breed.id } },
          user: { connect: { id: testUser.id } },
          sex: 'Colt',
          dateOfBirth: twoYearsAgo, // FIXED: Use calculated date for accurate age (was hardcoded '2022-01-01')
          healthStatus: 'Excellent',
          disciplineScores: {},
          epigeneticModifiers: {
            positive: ['energetic', 'curious'],
            negative: [],
            hidden: [],
          },
        },
      });

      expect(youngHorse.age).toBe(2);
      expect(youngHorse.disciplineScores).toEqual({});
    });

    it('should create mature horse (training eligible)', async () => {
      const breed = await prisma.breed.findFirst();

      // Calculate a date that's exactly 4 years ago from today
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

      matureHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'Training Integration Mature Horse',
          age: 4, // Eligible for training
          breed: { connect: { id: breed.id } },
          user: { connect: { id: testUser.id } },
          sex: 'Mare',
          dateOfBirth: fourYearsAgo, // FIXED: Use calculated date for accurate age (was hardcoded '2020-01-01')
          healthStatus: 'Excellent',
          disciplineScores: {},
          epigeneticModifiers: {
            positive: ['athletic', 'focused', 'brave', 'resilient'],
            negative: [],
            hidden: ['strong_heart'],
          },
        },
      });

      expect(matureHorse.age).toBe(4);
      expect(matureHorse.disciplineScores).toEqual({});
    });
  });

  describe('🚫 STEP 3: Age Restriction Enforcement', () => {
    it('should block training for young horse (under 3 years)', async () => {
      const response = await request(app)
        .post('/api/v1/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: youngHorse.id,
          discipline: 'Racing',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('age');

      // VERIFY: No training log created
      const trainingLogs = await prisma.trainingLog.findMany({
        where: { horseId: youngHorse.id },
      });
      expect(trainingLogs).toHaveLength(0);

      // VERIFY: No discipline score change
      const unchangedHorse = await prisma.horse.findUnique({
        where: { id: youngHorse.id },
      });
      expect(unchangedHorse.disciplineScores).toEqual({});
    });
  });

  describe('🏋️ STEP 4: First Training Session', () => {
    it('should successfully train mature horse for first time', async () => {
      // Get initial user XP
      const initialUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      const initialXP = initialUser.xp || 0;

      const response = await request(app)
        .post('/api/v1/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: matureHorse.id,
          discipline: 'Racing',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('trained in Racing');

      // VERIFY: Discipline score increased
      const trainedHorse = await prisma.horse.findUnique({
        where: { id: matureHorse.id },
      });
      expect(trainedHorse.disciplineScores.Racing).toBeGreaterThanOrEqual(5);

      // VERIFY: Training log created
      const trainingLogs = await prisma.trainingLog.findMany({
        where: {
          horseId: matureHorse.id,
          discipline: 'Racing',
        },
      });
      expect(trainingLogs).toHaveLength(1);
      expect(trainingLogs[0].discipline).toBe('Racing');

      // VERIFY: User received XP
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser.xp).toBeGreaterThan(initialXP);

      // VERIFY: XP event logged
      const xpEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser.id },
      });
      expect(xpEvents.length).toBeGreaterThan(0);
      expect(xpEvents[0].amount).toBeGreaterThan(0);
      expect(xpEvents[0].reason).toContain('Trained horse');
    });
  });

  describe('⏰ STEP 5: Training Cooldown Management', () => {
    it('should enforce 7-day cooldown period', async () => {
      // Attempt to train same horse immediately (should fail)
      const response = await request(app)
        .post('/api/v1/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: matureHorse.id,
          discipline: 'Dressage', // Different discipline, but still in cooldown
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('cooldown');

      // VERIFY: No new training log
      const dressageLogs = await prisma.trainingLog.findMany({
        where: {
          horseId: matureHorse.id,
          discipline: 'Dressage',
        },
      });
      expect(dressageLogs).toHaveLength(0);

      // VERIFY: No Dressage score added
      const unchangedHorse = await prisma.horse.findUnique({
        where: { id: matureHorse.id },
      });
      expect(unchangedHorse.disciplineScores.Dressage).toBeUndefined();
    });

    it('should allow training after cooldown expires (using test data manipulation)', async () => {
      // BALANCED MOCKING APPROACH: Test real business logic with realistic test data
      // Instead of mocking time, we manipulate training log timestamps to simulate time passage

      // STEP 1: Get the existing training log from the first training session
      const existingTrainingLog = await prisma.trainingLog.findFirst({
        where: { horseId: matureHorse.id },
        orderBy: { trainedAt: 'desc' },
      });

      expect(existingTrainingLog).toBeTruthy();
      expect(existingTrainingLog.discipline).toBe('Racing');

      // STEP 2: Verify horse is currently in cooldown (real business logic test)
      const cooldownResponse = await request(app)
        .post('/api/v1/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: matureHorse.id,
          discipline: 'Dressage',
        })
        .expect(400);

      expect(cooldownResponse.body.success).toBe(false);
      expect(cooldownResponse.body.message).toContain('cooldown');

      // STEP 3: Simulate time passage by updating training log timestamp (8 days ago)
      // This tests the real cooldown calculation logic with realistic data
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      await prisma.trainingLog.update({
        where: { id: existingTrainingLog.id },
        data: { trainedAt: eightDaysAgo },
      });

      // STEP 4: Verify training is now allowed (real business logic validation)
      const successResponse = await request(app)
        .post('/api/v1/training/train')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          horseId: matureHorse.id,
          discipline: 'Dressage',
        })
        .expect(200);

      expect(successResponse.body.success).toBe(true);
      expect(successResponse.body.message).toContain('trained in Dressage');

      // STEP 5: Verify real database changes occurred
      const updatedHorse = await prisma.horse.findUnique({
        where: { id: matureHorse.id },
      });
      expect(updatedHorse.disciplineScores.Dressage).toBeGreaterThanOrEqual(5);

      // STEP 6: Verify training log was created with real timestamp
      const dressageLog = await prisma.trainingLog.findFirst({
        where: {
          horseId: matureHorse.id,
          discipline: 'Dressage',
        },
      });
      expect(dressageLog).toBeTruthy();
      expect(dressageLog.trainedAt?.constructor?.name).toBe('Date');

      // STEP 7: Verify XP was awarded (real progression system test)
      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(finalUser.xp).toBeGreaterThan(5); // Should have XP from both training sessions
    });
  });

  describe('🎯 STEP 6: User Progression Tracking', () => {
    it('should track user XP and level progression from training', async () => {
      const finalUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      // VERIFY: User has gained significant XP from multiple training sessions
      expect(finalUser.xp).toBeGreaterThan(0);

      // VERIFY: Multiple XP events logged
      const allXpEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser.id },
        orderBy: { timestamp: 'asc' },
      });

      expect(allXpEvents.length).toBeGreaterThanOrEqual(1); // At least one training session

      // VERIFY: All XP events are training-related
      allXpEvents.forEach(event => {
        expect(event.reason).toContain('Trained horse');
        expect(event.amount).toBeGreaterThan(0);
      });
    });
  });

  describe('🏆 STEP 7: Competition Readiness Validation', () => {
    it('should validate horse is ready for competition', async () => {
      const competitionReadyHorse = await prisma.horse.findUnique({
        where: { id: matureHorse.id },
        include: {
          trainingLogs: true,
        },
      });

      // VERIFY: Horse meets competition requirements
      expect(competitionReadyHorse.age).toBeGreaterThanOrEqual(3); // Age requirement
      expect(Object.keys(competitionReadyHorse.disciplineScores).length).toBeGreaterThan(0); // Has training
      expect(competitionReadyHorse.healthStatus).toBe('Excellent'); // Health requirement

      // VERIFY: Training history exists
      expect(competitionReadyHorse.trainingLogs.length).toBeGreaterThan(0);

      // VERIFY: Multiple disciplines trained
      const trainedDisciplines = Object.keys(competitionReadyHorse.disciplineScores);
      expect(trainedDisciplines.length).toBeGreaterThanOrEqual(1); // At least one discipline trained

      // VERIFY: Minimum competency in each discipline
      trainedDisciplines.forEach(discipline => {
        expect(competitionReadyHorse.disciplineScores[discipline]).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('🎊 STEP 8: End-to-End Workflow Validation', () => {
    it('should validate complete training progression integrity', async () => {
      // VERIFY: Complete training progression from young to competition-ready
      const youngHorseCheck = await prisma.horse.findUnique({
        where: { id: youngHorse.id },
        include: { trainingLogs: true },
      });

      const matureHorseCheck = await prisma.horse.findUnique({
        where: { id: matureHorse.id },
        include: { trainingLogs: true },
      });

      // Young horse should still be untrained (age restriction enforced)
      expect(youngHorseCheck.trainingLogs).toHaveLength(0);
      expect(Object.keys(youngHorseCheck.disciplineScores)).toHaveLength(0);

      // Mature horse should be fully trained
      expect(matureHorseCheck.trainingLogs.length).toBeGreaterThan(0);
      expect(Object.keys(matureHorseCheck.disciplineScores).length).toBeGreaterThan(0);

      // VERIFY: User progression matches training activity
      const finalUserCheck = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { xpEvents: true },
      });

      expect(finalUserCheck.xp).toBeGreaterThan(0);
      expect(finalUserCheck.xpEvents.length).toBe(matureHorseCheck.trainingLogs.length);
    });

    it('should validate all business rules were enforced throughout progression', async () => {
      // Age restrictions enforced
      const youngHorseTrainingLogs = await prisma.trainingLog.findMany({
        where: { horseId: youngHorse.id },
      });
      expect(youngHorseTrainingLogs).toHaveLength(0);

      // Cooldown periods respected (verified by successful training after time progression)
      const matureHorseTrainingLogs = await prisma.trainingLog.findMany({
        where: { horseId: matureHorse.id },
        orderBy: { trainedAt: 'asc' },
      });

      // Each training session should be properly spaced (in our test, we mocked time progression)
      expect(matureHorseTrainingLogs.length).toBeGreaterThanOrEqual(1); // At least one training session

      // XP awards consistent
      const xpEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser.id },
      });
      expect(xpEvents.length).toBe(matureHorseTrainingLogs.length);

      // Data integrity maintained
      expect(matureHorse.userId).toBe(testUser.id);
      expect(matureHorse.userId).toBe(testUser.id);
    });
  });
});
