import { generateTestToken } from './authHelper.mjs';
import supertest from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/**
 * Add authentication headers to a supertest request object
 */
export const withAuth = (supertestRequest, userData = {}) => {
  const token = generateTestToken(userData);
  return supertestRequest
    .set('Authorization', `Bearer ${token}`)
    .set('x-test-skip-csrf', 'true');
};

/**
 * Creates a supertest request with auth headers for a test user.
 * @param {string} method - The HTTP method (e.g., 'get', 'post').
 * @param {string} endpoint - The API endpoint (e.g., '/api/users').
 * @param {object} userData - User data for token generation.
 * @returns {object} A supertest request object with Authorization header set.
 */
export const withSeededPlayerAuth = (method, endpoint, userData = {}) => {
  const token = generateTestToken(userData);
  // Ensure 'method' is a valid property of supertest(app) (e.g., 'get', 'post')
  // and 'endpoint' is a string.
  if (typeof supertest(app)[method] !== 'function') {
    throw new Error(`Invalid HTTP method: ${method}`);
  }
  return supertest(app)[method](endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('x-test-skip-csrf', 'true');
};

// USAGE EXAMPLE (INSIDE TEST):
// const response = await withSeededPlayerAuth('get', '/api/horses/trainable/somePlayerId');

/**
 * Create a test user with authentication token
 */
export async function createTestUser(userData = {}) {
  try {
    console.log('[createTestUser] Starting user creation...');

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const defaultData = {
      username: `testuser_${timestamp}_${randomSuffix}`,
      firstName: 'Test',
      lastName: 'User',
      email: `test_${timestamp}_${randomSuffix}@example.com`,
      password: 'TestPassword123!',
      money: 5000,
      xp: 100,
      level: 1,
      ...userData,
    };
    console.log('[createTestUser] Default data prepared:', { username: defaultData.username, email: defaultData.email });

    // Hash the password before creating user (matching authController behavior)
    console.log('[createTestUser] Starting password hashing...');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(defaultData.password, saltRounds);
      console.log('[createTestUser] Password hashing successful');
    } catch (hashError) {
      console.error('[createTestUser] Password hashing FAILED:', hashError);
      throw new Error(`Password hashing failed: ${hashError.message}`);
    }

    // Create user in database
    console.log('[createTestUser] Creating user in database...');
    let user;
    try {
      user = await prisma.user.create({
        data: {
          ...defaultData,
          password: hashedPassword,
        },
      });
      console.log('[createTestUser] User created successfully:', { id: user.id, username: user.username });
    } catch (dbError) {
      console.error('[createTestUser] Database user creation FAILED:', dbError);
      throw new Error(`User creation failed: ${dbError.message}`);
    }

    // Generate JWT token
    console.log('[createTestUser] Generating JWT token...');
    let token;
    try {
      token = jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' },
      );
      console.log('[createTestUser] JWT token generated successfully');
    } catch (jwtError) {
      console.error('[createTestUser] JWT token generation FAILED:', jwtError);
      throw new Error(`JWT generation failed: ${jwtError.message}`);
    }

    console.log('[createTestUser] Returning user and token...');
    return { user, token };
  } catch (error) {
    console.error('[createTestUser] FATAL ERROR in createTestUser:', error);
    console.error('[createTestUser] Error stack:', error.stack);
    throw error;
  }
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

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const defaultData = {
    name: `TestHorse_${timestamp}_${randomSuffix}`,
    breed: { connect: { id: breed.id } },
    age: 5,
    sex: 'Female',
    dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years ago
    speed: 50,
    stamina: 50,
    focus: 50,
    precision: 50,
    agility: 50,
    coordination: 50,
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

  // Handle userId conversion to ownerId and user relation
  if (defaultData.userId) {
    defaultData.ownerId = defaultData.userId;
    defaultData.user = { connect: { id: defaultData.userId } };
    delete defaultData.userId;
  }

  if (defaultData.ownerId) {
    const existingUser = await prisma.user.findUnique({
      where: { id: defaultData.ownerId },
      select: { id: true },
    });

    if (!existingUser) {
      const userSuffix = defaultData.ownerId.replace(/[^a-zA-Z0-9]/g, '').slice(-10) || Date.now().toString();
      // Hash the password before creating recovery user
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
      const hashedPassword = await bcrypt.hash('TestPassword123!', saltRounds);

      await prisma.user.create({
        data: {
          id: defaultData.ownerId,
          username: `recovery_${userSuffix}`,
          email: `recovery_${userSuffix}@example.com`,
          password: hashedPassword,
          firstName: 'Recovery',
          lastName: 'User',
        },
      });
    }
  }

  return await prisma.horse.create({
    data: defaultData,
  });
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

  return await prisma.show.create({
    data: defaultData,
  });
}

/**
 * Clean up test data
 */
export async function cleanupTestData() {
  try {
    // Delete in order to respect foreign key constraints
    await prisma.competitionResult.deleteMany({
      where: {
        horse: {
          name: {
            startsWith: 'TestHorse_',
          },
        },
      },
    });

    await prisma.horse.deleteMany({
      where: {
        name: {
          startsWith: 'TestHorse_',
        },
      },
    });

    await prisma.show.deleteMany({
      where: {
        name: {
          startsWith: 'TestShow_',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'testuser_',
        },
      },
    });
  } catch (error) {
    console.warn('Cleanup error:', error.message);
  } finally {
    // Ensure proper database connection cleanup
    await prisma.$disconnect();
  }
}
