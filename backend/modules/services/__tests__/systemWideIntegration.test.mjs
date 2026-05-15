/**
 * 🧪 System-Wide Data Integrity Tests
 *
 * Cross-system data integrity assertions (Story 21-6 AC1).
 * Slimmed from full user-journey coverage. The remaining tests are limited
 * to data invariants that span MULTIPLE backend systems — e.g., training
 * mutating both Horse and User progress, horse creation impacting user
 * counts, groom interaction affecting groom experience visible via API.
 *
 * Full multi-screen user-journey scenarios live in tests/e2e/ Playwright
 * specs, not here.
 *
 * Testing Approach: real database, no mocks (per CLAUDE.md Testing Philosophy).
 */

import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('System-Wide Data Integrity', () => {
  let csrf;
  let testUser;
  let authToken;
  let testHorse;
  let testGroom;
  let testBreed;

  beforeAll(async () => {
    csrf = await fetchCsrf(app);

    testBreed =
      (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ??
      (await prisma.breed.create({
        data: { name: 'Thoroughbred', description: 'Test breed for integration testing' },
      }));

    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        username: `swi${timestamp.toString().slice(-6)}`,
        email: `swi${timestamp}@test.com`,
        password: 'TestPassword123!',
        firstName: 'SWI',
        lastName: 'Test',
        level: 1,
        xp: 0,
        money: 5000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, email: testUser.email });

    testHorse = await prisma.horse.create({
      data: {
        name: 'SWI Test Horse',
        age: 5,
        breed: { connect: { id: testBreed.id } },
        user: { connect: { id: testUser.id } },
        sex: 'mare',
        dateOfBirth: new Date('2019-01-01'),
        healthStatus: 'Excellent',
      },
    });

    testGroom = await prisma.groom.create({
      data: {
        name: 'SWI Test Groom',
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

  test('Horse creation increments owner horse count and sets ownership FK', async () => {
    const initialCount = await prisma.horse.count({ where: { userId: testUser.id } });

    const horseData = {
      name: 'Consistency Test Horse',
      age: 3,
      breedId: testBreed.id,
      sex: 'mare',
      dateOfBirth: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000),
      temperament: 'energetic',
    };

    const horseResponse = await request(app)
      .post('/api/horses')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(horseData)
      .expect(201);

    const newHorse = horseResponse.body.data;

    const finalCount = await prisma.horse.count({ where: { userId: testUser.id } });
    expect(finalCount).toBe(initialCount + 1);

    const created = await prisma.horse.findUnique({ where: { id: newHorse.id } });
    expect(created.userId).toBe(testUser.id);

    // Cleanup
    await prisma.horse.deleteMany({ where: { id: newHorse.id } });
  });

  test('Training a horse increments user XP — cross-system: Training → User Progress', async () => {
    const initialProgress = await request(app)
      .get(`/api/users/${testUser.id}/progress`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const initialXP = initialProgress.body.data.xp;

    await new Promise(resolve => setTimeout(resolve, 1000));

    const trainingResponse = await request(app)
      .post('/api/training/train')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: testHorse.id, discipline: 'Dressage' })
      .expect(200);

    expect(trainingResponse.body.success).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 200));

    const finalProgress = await request(app)
      .get(`/api/users/${testUser.id}/progress`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const finalXP = finalProgress.body.data.xp;
    expect(finalXP).toBeGreaterThan(initialXP);

    // Cross-system invariant: level derives from xp
    const finalLevel = finalProgress.body.data.level;
    const expectedLevel = Math.floor(finalXP / 100) + 1;
    expect(finalLevel).toBe(expectedLevel);
  });

  test('Groom interaction increments groom experience — cross-system: Groom Interaction → Groom Profile API', async () => {
    const interactionResponse = await request(app)
      .post('/api/grooms/interact')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: testGroom.id,
        foalId: testHorse.id,
        interactionType: 'early_touch',
        duration: 30,
      })
      .expect(200);

    expect(interactionResponse.body.success).toBe(true);

    const groomResponse = await request(app)
      .get(`/api/grooms/user/${testUser.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(groomResponse.body.success).toBe(true);
    const updatedGroom = groomResponse.body.grooms.find(g => g.id === testGroom.id);
    expect(updatedGroom).toBeDefined();
    expect(updatedGroom.experience).toBeGreaterThan(0);
  });

  test('Auth registration produces auth cookies and queryable user record — cross-system: Auth → DB', async () => {
    const ts = Date.now();
    const registrationData = {
      username: `swireg${ts.toString().slice(-6)}`,
      email: `swireg${ts}@test.com`,
      password: 'TestPassword123!',
      firstName: 'Reg',
      lastName: 'Test',
    };

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(registrationData)
      .expect(201);

    expect(registerResponse.body.status).toBe('success');
    expect(registerResponse.headers['set-cookie']).toBeDefined();

    const registeredUserId = registerResponse.body.data.user.id;

    // Cross-system: API-reported user must exist in DB
    const dbUser = await prisma.user.findUnique({ where: { id: registeredUserId } });
    expect(dbUser).toBeDefined();
    expect(dbUser.email).toBe(registrationData.email);

    // Cleanup registered user
    await prisma.user.deleteMany({ where: { id: registeredUserId } });
  });

  test('Horse delete does not cascade-orphan unrelated groom records — cross-system: Horse table → Groom table boundary', async () => {
    // Create a horse and groom owned by the test user
    const tempHorse = await prisma.horse.create({
      data: {
        name: 'Cascade Boundary Test Horse',
        age: 4,
        breed: { connect: { id: testBreed.id } },
        user: { connect: { id: testUser.id } },
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        healthStatus: 'Excellent',
      },
    });

    const groomsBefore = await prisma.groom.count({ where: { userId: testUser.id } });

    await prisma.horse.delete({ where: { id: tempHorse.id } });

    const groomsAfter = await prisma.groom.count({ where: { userId: testUser.id } });

    // Cross-system boundary: deleting a horse must not remove user's other grooms
    expect(groomsAfter).toBe(groomsBefore);
  });
});
