import { randomBytes } from 'crypto';
import { generateTestToken } from './authHelper.mjs';
import supertest from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { fetchCsrf } from './csrfHelper.mjs';
import { fixtureColor } from './fixtureColor.mjs';

const DEFAULT_ORIGIN = 'http://localhost:3000';

// Per-module-instance ID tracking. Each Jest worker gets its own module cache,
// so these sets accumulate only the IDs created by the current test file.
// cleanupTestData() deletes exactly those IDs — no prefix-based sweeps that
// could wipe parallel workers' in-flight data (Equoria-8wuc).
const _createdHorseIds = new Set();
const _createdUserIds = new Set();
const _createdShowIds = new Set();

/**
 * Add JWT auth header + Origin to a supertest request. Synchronous.
 *
 * For state-changing requests (POST/PUT/PATCH/DELETE) on authenticated
 * routes use `withAuthCsrf` instead — it also attaches a real CSRF token.
 * This helper no longer sets any `x-test-skip-csrf` header.
 */
export const withAuth = (supertestRequest, userData = {}) => {
  const token = generateTestToken(userData);
  return supertestRequest.set('Authorization', `Bearer ${token}`).set('Origin', DEFAULT_ORIGIN);
};

/**
 * Creates an authenticated supertest request. Synchronous.
 *
 * For state-changing calls use `withSeededPlayerAuthCsrf` instead.
 */
export const withSeededPlayerAuth = (method, endpoint, userData = {}) => {
  const token = generateTestToken(userData);
  const agent = supertest(app);
  if (typeof agent[method] !== 'function') {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  return agent[method](endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', DEFAULT_ORIGIN);
};

/**
 * Async equivalent of `withAuth` that ALSO performs the real CSRF flow.
 * Fetches a token from GET /auth/csrf-token, attaches the cookie +
 * X-CSRF-Token header, and returns the supertest chain ready to `.send()`.
 *
 * Usage:
 *   const res = await (await withAuthCsrf(request(app).post('/api/foo')))
 *     .send({ ... });
 */
export async function withAuthCsrf(supertestRequest, userData = {}) {
  const token = generateTestToken(userData);
  const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
  return supertestRequest
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', DEFAULT_ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}

/**
 * Async equivalent of `withSeededPlayerAuth` that ALSO performs the real
 * CSRF flow. Drop-in replacement for mutation tests:
 *
 *   // OLD:
 *   const res = await withSeededPlayerAuth('post', '/api/foo', u).send({...});
 *   // NEW:
 *   const res = await (await withSeededPlayerAuthCsrf('post', '/api/foo', u))
 *     .send({...});
 */
export async function withSeededPlayerAuthCsrf(method, endpoint, userData = {}) {
  const token = generateTestToken(userData);
  const agent = supertest(app);
  if (typeof agent[method] !== 'function') {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
  return agent[method](endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', DEFAULT_ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}

/**
 * Create a test user with authentication token
 */
export async function createTestUser(userData = {}) {
  // Equoria-326tg: stripped debug bare-console trace lines that were left in
  // from a one-off investigation. Failure paths still surface via the thrown
  // errors below (console.error preserved — kqwdm's pre-production stance
  // permits console.error/.warn). On success this helper is now silent.

  // randomBytes(8).toString('hex') eliminates same-millisecond collisions
  // under parallel real-DB execution (see authHelper.mjs comment).
  const uid = randomBytes(8).toString('hex');
  const defaultData = {
    username: `testuser_${uid}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test_${uid}@example.com`,
    password: 'TestPassword123!',
    money: 5000,
    xp: 100,
    level: 1,
    ...userData,
  };

  // Hash the password before creating user (matching authController behavior)
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(defaultData.password, saltRounds);
  } catch (hashError) {
    console.error('[createTestUser] Password hashing FAILED:', hashError);
    throw new Error(`Password hashing failed: ${hashError.message}`);
  }

  // Create user in database
  let user;
  try {
    user = await prisma.user.create({
      data: {
        ...defaultData,
        password: hashedPassword,
      },
    });
  } catch (dbError) {
    console.error('[createTestUser] Database user creation FAILED:', dbError);
    throw new Error(`User creation failed: ${dbError.message}`);
  }

  // Generate JWT token
  let token;
  try {
    token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' },
    );
  } catch (jwtError) {
    console.error('[createTestUser] JWT token generation FAILED:', jwtError);
    throw new Error(`JWT generation failed: ${jwtError.message}`);
  }

  _createdUserIds.add(user.id);
  return { user, token };
}

/**
 * Create a test horse
 */
export async function createTestHorse(horseData = {}) {
  // First ensure we have a breed to connect to
  let breed = await prisma.breed.findFirst({
    where: { name: 'Thoroughbred' },
  });

  if (!breed) {
    breed = await prisma.breed.create({
      data: {
        name: 'Thoroughbred',
        description: 'Test breed for integration tests',
      },
    });
  }

  // randomBytes(8).toString('hex') eliminates same-millisecond collisions
  // under parallel real-DB execution (see authHelper.mjs comment).
  const horseUid = randomBytes(8).toString('hex');
  const defaultData = {
    // Inject a non-NULL colorGenotype + phenotype so this helper never
    // creates a NULL-phenotype row (CLAUDE.md dm1i defect class). Without
    // this, every horse from createTestHorse trips the horseColorNullSentinel
    // (Equoria-a429) if its afterAll cleanup is ever skipped/interrupted.
    // Spread first so explicit horseData can still override if a test needs to.
    ...fixtureColor(),
    name: `TestHorse_${horseUid}`,
    breed: { connect: { id: breed.id } },
    age: 5,
    sex: 'Mare',
    dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
    speed: 50,
    stamina: 50,
    focus: 50,
    precision: 50,
    agility: 50,
    boldness: 50,
    balance: 50,
    flexibility: 50,
    obedience: 50,
    intelligence: 50,
    healthStatus: 'Good',
    stressLevel: 20,
    epigeneticModifiers: {
      positive: [],
      negative: [],
    },
    disciplineScores: {},
    ...horseData,
  };

  // Handle userId and user relation
  if (defaultData.userId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: defaultData.userId },
      select: { id: true },
    });

    if (!existingUser) {
      const userSuffix =
        defaultData.userId.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || Date.now().toString();
      // Hash the password before creating recovery user
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      const hashedPassword = await bcrypt.hash('TestPassword123!', saltRounds);

      await prisma.user.create({
        data: {
          id: defaultData.userId,
          username: `recovery_${userSuffix}`,
          email: `recovery_${userSuffix}@example.com`,
          password: hashedPassword,
          firstName: 'Recovery',
          lastName: 'User',
        },
      });
      _createdUserIds.add(defaultData.userId);
    }

    defaultData.user = { connect: { id: defaultData.userId } };
    delete defaultData.userId;
  }

  const horse = await prisma.horse.create({
    data: defaultData,
  });
  _createdHorseIds.add(horse.id);
  return horse;
}

/**
 * Create a test show
 */
export async function createTestShow(showData = {}) {
  // Generate highly unique show name to avoid constraint violations
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 100000);
  const processId = process.pid || Math.floor(Math.random() * 10000);

  const defaultData = {
    name: `TestShow_${timestamp}_${randomSuffix}_${processId}`,
    discipline: 'Racing',
    levelMin: 1,
    levelMax: 10,
    entryFee: 100,
    prize: 1000,
    runDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    ...showData,
  };

  // If showData provides a name, make it unique too
  if (showData.name) {
    defaultData.name = `${showData.name}_${timestamp}_${randomSuffix}_${processId}`;
  }

  const show = await prisma.show.create({
    data: defaultData,
  });
  _createdShowIds.add(show.id);
  return show;
}

/**
 * Clean up test data created by this module instance's helper calls.
 *
 * Uses tracked IDs from createTestHorse/createTestUser/createTestShow instead
 * of broad prefix-based sweeps. This prevents parallel Jest workers from
 * deleting each other's in-flight fixtures (Equoria-8wuc).
 *
 * CompetitionResult rows cascade-delete when their horse is deleted
 * (onDelete: Cascade in schema), so no explicit result cleanup is needed.
 */
export async function cleanupTestData() {
  try {
    const horseIds = [..._createdHorseIds];
    const userIds = [..._createdUserIds];
    const showIds = [..._createdShowIds];

    if (horseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
      _createdHorseIds.clear();
    }

    if (showIds.length > 0) {
      await prisma.show.deleteMany({ where: { id: { in: showIds } } });
      _createdShowIds.clear();
    }

    if (userIds.length > 0) {
      // Equoria-fefh2.26: delete the tracked users' horses (incl. registration
      // starter horses that are NOT in _createdHorseIds) BEFORE the users.
      // v58ta made horses_userId_fkey ON DELETE RESTRICT, so a tracked user
      // owning an untracked starter horse would otherwise RESTRICT-block
      // user.deleteMany — the exact failure the old catch swallowed.
      // userId-scoped to the suite's own users; no broad delete.
      await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      _createdUserIds.clear();
    }
  } catch (error) {
    // Equoria-fefh2.26: FAIL LOUD. The prior `console.warn` swallowed cleanup
    // failures, leaving stale fixture rows and making this shared helper
    // untrustworthy (CLAUDE.md §2/§3). With horses now deleted before users,
    // an error here is unexpected — rethrow so the consuming suite goes red
    // instead of silently leaking fixtures.
    throw new Error(`testAuth.cleanupTestData failed (fixture leak risk): ${error.message}`);
  }
  // Do NOT call prisma.$disconnect() here — the global teardown handles disconnection.
  // Calling it mid-run disconnects the shared client for all parallel suites.
}
