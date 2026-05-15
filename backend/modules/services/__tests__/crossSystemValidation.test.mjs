/**
 * 🧪 Cross-System Boundary Validation Tests
 *
 * Pure system-boundary assertions (Story 21-6 AC2): API contract shape
 * and cross-module API surface compatibility. The full workflow scenarios
 * (multi-step user journeys, performance monitoring, memory cleanup runs)
 * have been migrated to Playwright E2E specs under tests/e2e/.
 *
 * Each test here validates that ONE system's output is a valid input for
 * ANOTHER system, by hitting the public HTTP surface (not internal calls).
 *
 * Testing Approach: real database, real HTTP, no mocks.
 */

import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('Cross-System Boundary Validation', () => {
  let csrf;
  let testUser;
  let authToken;
  let testBreed;
  let testHorse;
  let testGroom;

  beforeAll(async () => {
    csrf = await fetchCsrf(app);

    const timestamp = Date.now();
    const suffix = timestamp.toString().slice(-6);

    testUser = await prisma.user.create({
      data: {
        username: `csbUser${suffix}`,
        email: `csb${timestamp}@test.com`,
        password: 'testPassword123',
        firstName: 'Cross',
        lastName: 'Boundary',
        role: 'admin',
      },
    });

    authToken = generateTestToken({ id: testUser.id, email: testUser.email, role: 'admin' });

    testBreed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Test breed' },
    });

    testHorse = await prisma.horse.create({
      data: {
        name: 'CSB Test Horse',
        age: 4,
        breed: { connect: { id: testBreed.id } },
        user: { connect: { id: testUser.id } },
        sex: 'mare',
        dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
        healthStatus: 'Excellent',
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: 'CSB Test Groom',
        userId: testUser.id,
        skillLevel: 'novice',
        experience: 0,
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        speciality: 'foal_care',
        level: 1,
        careerWeeks: 0,
        retired: false,
      },
    });
  });

  afterAll(async () => {
    if (testGroom) {
      await prisma.groom.deleteMany({ where: { id: testGroom.id } });
    }
    if (testHorse) {
      await prisma.horse.deleteMany({ where: { id: testHorse.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  test('Horse API contract: GET /api/horses/:id returns shape consumed by training UI', async () => {
    const res = await request(app)
      .get(`/api/horses/${testHorse.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const horse = res.body.data;
    // Boundary: training, competition, breeding, and groom modules all read these
    expect(horse).toHaveProperty('id');
    expect(horse).toHaveProperty('name');
    expect(horse).toHaveProperty('age');
    expect(horse).toHaveProperty('sex');
    expect(horse).toHaveProperty('breed');
  });

  test('Groom assignment API contract: GET /api/grooms/user/:userid returns array consumed by foal care UI', async () => {
    const res = await request(app)
      .get(`/api/grooms/user/${testUser.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.grooms)).toBe(true);
    const groom = res.body.grooms.find(g => g.id === testGroom.id);
    expect(groom).toBeDefined();
    // Boundary: groom UI + interaction system require these fields
    expect(groom).toHaveProperty('skillLevel');
    expect(groom).toHaveProperty('personality');
    expect(groom).toHaveProperty('experience');
    expect(groom).toHaveProperty('level');
  });

  test('User progress API contract: GET /api/users/:id/progress returns shape consumed by training XP UI', async () => {
    const res = await request(app)
      .get(`/api/users/${testUser.id}/progress`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    const data = res.body.data;
    // Boundary: training/competition both rely on these to compute level-up
    expect(data).toHaveProperty('level');
    expect(data).toHaveProperty('xp');
    expect(data).toHaveProperty('progressPercentage');
    expect(typeof data.level).toBe('number');
    expect(typeof data.xp).toBe('number');
  });

  test('Health endpoint contract: GET /health returns success envelope used by Railway probes', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Server is healthy');
  });

  test('Swagger contract: GET /api-docs/swagger.json exposes OpenAPI v3 paths used by frontend client', async () => {
    const res = await request(app)
      .get('/api-docs/swagger.json')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty('paths');
    // Boundary: the frontend's api-client expects /api/v1 prefix paths to exist
    const paths = Object.keys(res.body.paths);
    expect(paths.length).toBeGreaterThan(0);
  });
});
