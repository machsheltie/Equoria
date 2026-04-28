/**
 * Integration Test: Foal Creation API — Real Database
 *
 * Tests the POST /api/horses/foals endpoint with real database operations.
 * No mocks — validates actual foal creation, parent validation, epigenetic
 * trait application, and database persistence.
 *
 * Business rules tested:
 * - Foal creation API: POST /api/horses/foals accepts valid breeding data
 * - Request validation: name, breedId, sireId, damId, sex, healthStatus
 * - Database integration: horse creation, breed validation, parent lookup
 * - Breeding system: sire and dam must exist to create a foal
 * - Response handling: proper HTTP status codes and error messages
 * - Data structure: foal objects have required fields and relationships
 * - Epigenetic traits: applied at birth based on mare stress and lineage
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from './helpers/authHelper.mjs';
import bcrypt from 'bcryptjs';

import { fetchCsrf } from './helpers/csrfHelper.mjs';
// Import the real app — no mocks
const app = (await import('../app.mjs')).default;

describe('INTEGRATION: Foal Creation API — Real Database', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let testUser;
  let testBreed;
  let testSire;
  let testDam;
  let authToken;
  const createdFoalIds = [];
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    // Create a real user in the database
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    testUser = await prisma.user.create({
      data: {
        username: `foalcreation_user_${ts}`,
        email: `foalcreation_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'FoalCreation',
        lastName: 'Tester',
        money: 10000,
      },
    });

    // Generate a JWT token for the real user
    authToken = generateTestToken({ id: testUser.id, role: 'user' });

    // Use a real breed name that exists in breedProfiles.json. The
    // post-309-breeds refactor requires every breed in the DB to have
    // a matching JSON profile — random synthetic breed names no longer
    // work, so we upsert the canonical "Thoroughbred" for this suite.
    testBreed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: {
        name: 'Thoroughbred',
        description: 'Thoroughbred (shared across integration suites)',
      },
    });

    // Create a real sire (adult stallion)
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    testSire = await prisma.horse.create({
      data: {
        name: `FoalTestSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: testBreed.id,
        userId: testUser.id,
        stressLevel: 10,
        bondScore: 80,
        healthStatus: 'Good',
        epigeneticModifiers: { positive: ['resilient'], negative: [], hidden: [] },
      },
    });

    // Create a real dam (adult mare)
    const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
    testDam = await prisma.horse.create({
      data: {
        name: `FoalTestDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: fourYearsAgo,
        age: 4,
        breedId: testBreed.id,
        userId: testUser.id,
        stressLevel: 15,
        bondScore: 70,
        healthStatus: 'Good',
        epigeneticModifiers: { positive: ['calm'], negative: [], hidden: [] },
      },
    });
  });

  afterAll(async () => {
    try {
      // Clean up created foals and their related records
      for (const foalId of createdFoalIds) {
        await prisma.foalTrainingHistory.deleteMany({ where: { horseId: foalId } }).catch(() => {});
        await prisma.foalDevelopment.deleteMany({ where: { foalId } }).catch(() => {});
        await prisma.foalActivity.deleteMany({ where: { foalId } }).catch(() => {});
        await prisma.groomAssignment.deleteMany({ where: { foalId } }).catch(() => {});
        await prisma.horse.deleteMany({ where: { id: foalId } });
      }

      // Clean up sire, dam, breed, user
      if (testSire) {
        await prisma.horse.deleteMany({ where: { id: testSire.id } });
      }
      if (testDam) {
        await prisma.horse.deleteMany({ where: { id: testDam.id } });
      }
      // Do NOT delete the shared "Thoroughbred" breed — it's used by other suites.
      if (testUser) {
        await prisma.groom.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    } catch (error) {
      console.warn('Cleanup warning (can be ignored):', error.message);
    }
  });

  it('should create a foal with valid breeding data and persist it in the database', async () => {
    const foalData = {
      name: `IntegrationFoal_${ts}`,
      breedId: testBreed.id,
      sireId: testSire.id,
      damId: testDam.id,
      sex: 'Filly',
      healthStatus: 'Good',
    };

    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(foalData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('foal');
    expect(response.body.data.foal.name).toBe(foalData.name);
    expect(response.body.data.foal.sireId).toBe(testSire.id);
    expect(response.body.data.foal.damId).toBe(testDam.id);

    // Track for cleanup
    createdFoalIds.push(response.body.data.foal.id);

    // Verify the foal exists in the real database
    const dbFoal = await prisma.horse.findUnique({
      where: { id: response.body.data.foal.id },
    });

    expect(dbFoal).toBeTruthy();
    expect(dbFoal.name).toBe(foalData.name);
    expect(dbFoal.age).toBe(0);
    expect(dbFoal.sireId).toBe(testSire.id);
    expect(dbFoal.damId).toBe(testDam.id);
    expect(dbFoal.userId).toBe(testUser.id);
  });

  it('should apply epigenetic traits at birth', async () => {
    const foalData = {
      name: `EpigeneticFoal_${ts}`,
      breedId: testBreed.id,
      sireId: testSire.id,
      damId: testDam.id,
      sex: 'Colt',
      healthStatus: 'Good',
    };

    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(foalData)
      .expect(201);

    createdFoalIds.push(response.body.data.foal.id);

    expect(response.body.data).toHaveProperty('appliedTraits');
    expect(response.body.data).toHaveProperty('breedingAnalysis');

    // Breeding analysis should contain the real parent info
    expect(response.body.data.breedingAnalysis.sire.id).toBe(testSire.id);
    expect(response.body.data.breedingAnalysis.dam.id).toBe(testDam.id);
    expect(typeof response.body.data.breedingAnalysis.mareStress).toBe('number');
    expect(typeof response.body.data.breedingAnalysis.feedQuality).toBe('number');

    // The foal should have epigenetic modifiers stored in DB
    const dbFoal = await prisma.horse.findUnique({
      where: { id: response.body.data.foal.id },
    });
    expect(dbFoal.epigeneticModifiers).toBeTruthy();
    expect(dbFoal.epigeneticModifiers).toHaveProperty('positive');
    expect(dbFoal.epigeneticModifiers).toHaveProperty('negative');
  });

  it('should reject foal creation with missing required fields', async () => {
    // Missing name
    await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ breedId: testBreed.id, sireId: testSire.id, damId: testDam.id })
      .expect(400);

    // Missing breedId
    await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ name: 'TestFoal', sireId: testSire.id, damId: testDam.id })
      .expect(400);

    // Missing sireId
    await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ name: 'TestFoal', breedId: testBreed.id, damId: testDam.id })
      .expect(400);

    // Missing damId
    await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ name: 'TestFoal', breedId: testBreed.id, sireId: testSire.id })
      .expect(400);
  });

  it('should return 404 when sire does not exist', async () => {
    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `MissingSireFoal_${ts}`,
        breedId: testBreed.id,
        sireId: 999999,
        damId: testDam.id,
        sex: 'Colt',
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Sire');
  });

  it('should return 404 when dam does not exist', async () => {
    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `MissingDamFoal_${ts}`,
        breedId: testBreed.id,
        sireId: testSire.id,
        damId: 999998,
        sex: 'Filly',
      })
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Dam');
  });

  it('should accept valid foal creation data structure and return 201', async () => {
    const validFoalData = {
      name: `ValidStructureFoal_${ts}`,
      breedId: testBreed.id,
      sireId: testSire.id,
      damId: testDam.id,
      sex: 'Colt',
      healthStatus: 'Good',
    };

    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(validFoalData)
      .expect(201);

    createdFoalIds.push(response.body.data.foal.id);

    expect(response.body.success).toBe(true);
    expect(response.body.data.foal).toHaveProperty('id');
    expect(response.body.data.foal).toHaveProperty('name');
    expect(response.body.data.foal).toHaveProperty('sireId');
    expect(response.body.data.foal).toHaveProperty('damId');
  });

  it('should require authentication', async () => {
    await request(app)
      .post('/api/horses/foals')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'UnauthFoal',
        breedId: testBreed.id,
        sireId: testSire.id,
        damId: testDam.id,
        sex: 'Filly',
      })
      .expect(401);
  });
});
