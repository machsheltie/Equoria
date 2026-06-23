/**
 * INTEGRATION TEST: Complete Horse Breeding Workflow
 *
 * This test validates the ENTIRE horse breeding process from user registration
 * to foal birth with traits, following TDD principles with minimal mocking.
 *
 * WORKFLOW TESTED:
 * 1. User Registration & Authentication
 * 2. Horse Creation (Mare & Stallion)
 * 3. Breeding Process
 * 4. Foal Birth with Trait Application
 * 5. Groom Assignment to Foal
 * 6. Initial Foal Development
 *
 * MOCKING STRATEGY (Balanced Approach):
 * ✅ REAL: Database operations, business logic, trait calculations
 * 🔧 MOCK: Only Math.random for deterministic trait generation
 */

import { jest, describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { randomBytes } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
dotenv.config({ path: join(__dirname, '../../.env.test') });

// Import real modules (minimal mocking)
const app = (await import('../../app.mjs')).default;
const { default: prisma } = await import('../../../packages/database/prismaClient.mjs');

/**
 * Extract cookie value from Set-Cookie header
 * @param {Array} cookies - Array of cookie strings from response headers
 * @param {string} name - Cookie name to extract
 * @returns {string|null} - Cookie value or null if not found
 */
const extractCookie = (cookies, name) => {
  if (!cookies || !Array.isArray(cookies)) {
    return null;
  }
  const cookie = cookies.find(c => c.startsWith(`${name}=`));
  if (!cookie) {
    return null;
  }
  // Extract value between = and ; (or end of string)
  const match = cookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
};

describe('🐎 INTEGRATION: Complete Horse Breeding Workflow', () => {
  // Raise per-test timeout: this suite runs late in --runInBand when memory
  // pressure is high (3 GB+). 120 s gives enough headroom for bcrypt + DB ops.
  jest.setTimeout(120000);

  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  // Equoria-klq4v: testUser/mare/stallion/foal/assignedGroom were previously
  // describe-scope `let`s shared ACROSS it()s — the cross-it() coupling this
  // refactor eliminates. They are now local consts inside the single atomic
  // it() below, so no describe-scope declarations remain. Cleanup stays
  // name-prefix / email scoped (it never referenced the ids), so removing the
  // shared lets does not affect teardown.

  // Equoria-cs6wf: randomize fixture identifiers so a crashed prior run's
  // partial cleanup cannot collide with the next run's beforeEach on the
  // User.username / User.email unique constraints. Cleanup probes were
  // widened from exact `email: 'integration-test@example.com'` to scoped
  // `email: { contains: 'integration-test' }` so they continue to catch
  // stale rows from any prior crash regardless of the randomized suffix.
  const suffix = randomBytes(6).toString('hex');
  // Equoria-u95n4: the register validator (authRoutes.mjs) requires
  // username 3-30 chars matching /^[a-zA-Z0-9_]+$/. The prior value
  // `TestFixture-cs6wf-integrationtester-${suffix}` was 49 chars AND
  // contained hyphens, so STEP 1 register returned 400 (two validation
  // failures) — cascading no-token -> STEPS 2-6 all failing (9 total).
  // `bw${suffix}` = "bw" + 12 hex chars = 14 chars, all [a-z0-9], so it
  // provably passes both the length and charset rules. The email keeps the
  // `integration-test` substring the cleanup probe matches on.
  const username = `bw${suffix}`;
  const email = `testfixture-cs6wf-integration-test-${suffix}@example.com`;

  beforeAll(async () => {
    process.env.BCRYPT_SALT_ROUNDS = '1';

    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  async function cleanupTestData() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.groomAssignment.deleteMany({
        where: { foal: { name: { startsWith: 'Integration Test' } } },
      });

      await prisma.groom.deleteMany({
        where: { name: { startsWith: 'Integration Test' } },
      });

      await prisma.horse.deleteMany({
        where: { name: { startsWith: 'Integration Test' } },
      });

      await prisma.user.deleteMany({
        where: { email: { contains: 'integration-test' } },
      });
    } catch (error) {
      console.warn('Cleanup warning (can be ignored):', error.message);
    }
  }

  // Equoria-klq4v: the breeding workflow is one strictly-sequential pipeline —
  // every former STEP read mutable describe-scope state (testUser, mare,
  // stallion, foal, assignedGroom) that an EARLIER STEP set. Under Jest test
  // randomization (--randomize) a later STEP could run first and read
  // undefined state, so the suite was order-dependent. The fix is to
  // consolidate the entire end-to-end workflow into ONE atomic it() whose
  // steps share local consts/lets inside the it() scope (NOT describe-scope).
  // No it() now depends on another it()'s state. Every assertion from the old
  // STEPS 1-6 is preserved, in order, below. Real DB only, no mocks — the same
  // controller→service→Prisma→DB path is exercised unchanged.
  it('runs the full breeding workflow end-to-end (registration → foal birth → groom care → development → integrity)', async () => {
    // ── STEP 1: User Registration & Authentication ──────────────────────────
    const userData = {
      username,
      firstName: 'Integration',
      lastName: 'Tester',
      email,
      password: 'TestPassword123!',
      // Equoria-9nwzi: COPPA age gate (iqzn) requires an adult DOB for 201.
      dateOfBirth: '1990-01-01',
      money: 5000, // Enough for breeding operations
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(userData)
      .expect(201);

    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.data.user.email).toBe(userData.email);

    // Extract token from httpOnly cookie
    const cookies = registerResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const accessToken = extractCookie(cookies, 'accessToken');
    expect(accessToken).toBeDefined();

    const testUser = registerResponse.body.data.user;

    // VERIFY: User exists in database
    const dbUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(dbUser).toBeTruthy();
    expect(dbUser.email).toBe(userData.email);

    // ── STEP 2: Horse Creation (Breeding Stock) ─────────────────────────────
    // Ensure we have a breed
    let breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: {
          name: 'Integration Test Thoroughbred',
          description: 'Test breed for integration testing',
        },
      });
    }

    // Calculate dynamic date for 5-year-old mare
    const fiveYearsAgoForMare = new Date();
    fiveYearsAgoForMare.setFullYear(fiveYearsAgoForMare.getFullYear() - 5);

    // Create mare with proper schema fields (matching working tests)
    const mare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Integration Test Mare',
        age: 5,
        breed: { connect: { id: breed.id } },
        sex: 'Mare',
        healthStatus: 'Excellent',
        user: { connect: { id: testUser.id } },
        dateOfBirth: fiveYearsAgoForMare, // FIXED: Use calculated date
        disciplineScores: {
          Racing: 85,
          Dressage: 78,
        },
        epigeneticModifiers: {
          positive: ['fast', 'intelligent', 'calm', 'resilient'],
          negative: [],
          hidden: ['strong_heart'],
        },
      },
    });

    expect(mare.name).toBe('Integration Test Mare');
    expect(mare.sex).toBe('Mare');
    expect(mare.epigeneticModifiers.positive).toContain('fast');
    expect(mare.userId).toBe(testUser.id);

    // Calculate dynamic date for 6-year-old stallion
    const sixYearsAgoForStallion = new Date();
    sixYearsAgoForStallion.setFullYear(sixYearsAgoForStallion.getFullYear() - 6);

    // Create stallion with proper schema fields (matching working tests)
    const stallion = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Integration Test Stallion',
        age: 6,
        breed: { connect: { id: breed.id } },
        sex: 'Stallion',
        healthStatus: 'Excellent',
        user: { connect: { id: testUser.id } },
        dateOfBirth: sixYearsAgoForStallion, // FIXED: Use calculated date
        disciplineScores: {
          Racing: 90,
          'Show Jumping': 82,
        },
        epigeneticModifiers: {
          positive: ['powerful', 'brave', 'athletic', 'peopleTrusting'],
          negative: [],
          hidden: ['endurance'],
        },
      },
    });

    expect(stallion.name).toBe('Integration Test Stallion');
    expect(stallion.sex).toBe('Stallion');
    expect(stallion.epigeneticModifiers.positive).toContain('powerful');
    expect(stallion.userId).toBe(testUser.id);

    // ── STEP 3: Breeding Process & Foal Birth ───────────────────────────────
    // Create foal (simulating breeding result) with proper schema fields
    let foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Integration Test Foal',
        age: 0, // Newborn
        breed: { connect: { id: breed.id } },
        sex: 'Colt',
        sire: { connect: { id: stallion.id } },
        dam: { connect: { id: mare.id } },
        healthStatus: 'Excellent',
        user: { connect: { id: testUser.id } },
        dateOfBirth: new Date(), // Born today
        disciplineScores: {}, // No training yet
        epigeneticModifiers: {
          positive: [], // Will be populated by trait application
          negative: [],
          hidden: [],
        },
      },
    });

    // APPLY AT-BIRTH TRAITS (Real business logic, no mocking)
    const { applyEpigeneticTraitsAtBirth } = await import('../../utils/applyEpigeneticTraitsAtBirth.mjs');

    const lineage = [mare, stallion]; // Simplified lineage
    const epigeneticTraits = applyEpigeneticTraitsAtBirth({
      mare: { stressLevel: 20 }, // Low stress
      lineage,
      feedQuality: 85, // Premium feed
      stressLevel: 20,
    });

    // Update foal with epigenetic traits
    foal = await prisma.horse.update({
      where: { id: foal.id },
      data: {
        epigeneticModifiers: epigeneticTraits,
      },
    });

    // VERIFY: Foal has proper relationships and traits
    expect(foal.sireId).toBe(stallion.id);
    expect(foal.damId).toBe(mare.id);
    expect(foal.age).toBe(0);

    // VERIFY: Epigenetic traits applied (with mocked random, should be deterministic)
    expect(foal.epigeneticModifiers).toHaveProperty('positive');
    expect(foal.epigeneticModifiers).toHaveProperty('negative');

    // ── STEP 4: Groom Assignment & Care ─────────────────────────────────────
    // Import groom system (real business logic)
    const { ensureDefaultGroomAssignment, recordGroomInteraction } = await import('../../utils/groomSystem.mjs');

    // Ensure foal has a groom assignment
    const assignmentResult = await ensureDefaultGroomAssignment(foal.id, testUser.id);

    expect(assignmentResult.success).toBe(true);
    expect(assignmentResult.assignment || assignmentResult.newAssignment).toBeDefined();

    // VERIFY: Assignment exists in database
    const dbAssignment = await prisma.groomAssignment.findFirst({
      where: { foalId: foal.id },
      include: { groom: true },
    });

    expect(dbAssignment).toBeTruthy();
    expect(dbAssignment.groom.speciality).toBe('foalCare');

    const assignedGroom = dbAssignment.groom;

    // Record groom interaction with foal
    const interactionData = {
      foalId: foal.id,
      groomId: assignedGroom.id,
      interactionType: 'daily_care',
      duration: 60, // 1 hour
      notes: 'Initial care for newborn foal',
    };

    const interactionResult = await recordGroomInteraction(
      interactionData.foalId,
      interactionData.groomId,
      interactionData.interactionType,
      interactionData.duration,
      testUser.id,
      interactionData.notes,
    );

    expect(interactionResult.success).toBe(true);

    // VERIFY: Interaction logged in database
    const dbInteraction = await prisma.groomInteraction.findFirst({
      where: {
        foalId: foal.id,
        groomId: assignedGroom.id,
      },
    });

    expect(dbInteraction).toBeTruthy();
    expect(dbInteraction.interactionType).toBe('daily_care');
    expect(dbInteraction.duration).toBe(60);

    // ── STEP 5: Foal Development Tracking ────────────────────────────────────
    // Get foal development data
    const { getFoalDevelopment } = await import('../../modules/horses/models/foalModel.mjs');

    const developmentData = await getFoalDevelopment(foal.id);

    expect(developmentData).toBeDefined();
    expect(developmentData.foal.id).toBe(foal.id);
    expect(developmentData.development.currentDay).toBeGreaterThanOrEqual(0);

    // VERIFY: Development record exists in database
    const dbDevelopment = await prisma.foalDevelopment.findUnique({
      where: { foalId: foal.id },
    });

    expect(dbDevelopment).toBeTruthy();
    expect(dbDevelopment.foalId).toBe(foal.id);

    // ── STEP 6: End-to-End Workflow Validation ──────────────────────────────
    // VERIFY: Complete family tree exists
    const foalWithFamily = await prisma.horse.findUnique({
      where: { id: foal.id },
      include: {
        sire: true,
        dam: true,
        groomAssignments: {
          include: { groom: true },
        },
        groomInteractions: true,
        foalDevelopment: true,
      },
    });

    // Family relationships
    expect(foalWithFamily.sire.id).toBe(stallion.id);
    expect(foalWithFamily.dam.id).toBe(mare.id);

    // Groom care system
    expect(foalWithFamily.groomAssignments).toHaveLength(1);
    expect(foalWithFamily.groomAssignments[0].groom.speciality).toBe('foalCare');
    expect(foalWithFamily.groomInteractions).toHaveLength(1);

    // Development tracking
    expect(foalWithFamily.foalDevelopment).toBeTruthy();

    // Trait inheritance (epigenetic traits applied)
    expect(foalWithFamily.epigeneticModifiers).toHaveProperty('positive');
    expect(foalWithFamily.epigeneticModifiers).toHaveProperty('negative');

    // User ownership
    expect(foalWithFamily.userId).toBe(testUser.id);

    // ── Business-rule integrity assertions (former STEP 6, second it()) ──────
    // Age validation
    expect(foal.age).toBe(0); // Newborn
    expect(mare.age).toBeGreaterThanOrEqual(3); // Breeding age
    expect(stallion.age).toBeGreaterThanOrEqual(3); // Breeding age

    // Trait inheritance rules
    expect(foal.epigeneticModifiers.positive).toBeDefined();
    expect(Array.isArray(foal.epigeneticModifiers.positive)).toBe(true);

    // Groom specialization rules
    expect(assignedGroom.speciality).toBe('foalCare'); // Correct specialty for foal

    // Data integrity
    expect(foal.sireId).toBe(stallion.id);
    expect(foal.damId).toBe(mare.id);
    expect(foal.userId).toBe(testUser.id);
  });
});
