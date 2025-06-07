import { generateTestToken } from './authHelper.mjs';
import supertest from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import jwt from 'jsonwebtoken';

/**
 * Add authentication headers to a supertest request object
 */
export const withAuth = (supertestRequest, userData = {}) => {
  const token = generateTestToken(userData);
  return supertestRequest.set('Authorization', `Bearer ${token}`);
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
  return supertest(app)[method](endpoint).set('Authorization', `Bearer ${token}`);
};

// USAGE EXAMPLE (INSIDE TEST):
// const response = await withSeededPlayerAuth('get', '/api/horses/trainable/somePlayerId');

/**
 * Create a test user with authentication token
 */
export async function createTestUser(userData = {}) {
  const defaultData = {
    username: `testuser_${Date.now()}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123',
    money: 5000,
    xp: 100,
    level: 1,
    ...userData,
  };

  const user = await prisma.user.create({
    data: defaultData,
  });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '24h' },
  );

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

  const defaultData = {
    name: `TestHorse_${Date.now()}`,
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

  // Handle userId conversion to user relation
  if (defaultData.userId) {
    defaultData.user = { connect: { id: defaultData.userId } };
    delete defaultData.userId;
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
