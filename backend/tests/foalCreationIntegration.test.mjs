/**
 * Integration Test: Foal Creation API — Real Database
 *
 * Tests the POST /api/horses/foals endpoint with real database operations.
 * No mocks — validates actual pregnancy initiation, parent validation, and
 * database persistence.
 *
 * UPDATED 2026-04-29 (B3, parent Equoria-3gqg) — feed-system redesign:
 * breeding no longer creates a foal Horse row immediately. The endpoint sets
 * the dam's pregnancy state (`inFoalSinceDate`, `pregnancySireId`,
 * `pregnancyFeedingsByTier`, `lastBredDate`) and returns 200 with
 * `{ success, data: { pregnancyStarted, damId, sireId, foalDueDate } }`.
 * Foal materialisation happens 7 days later in the foaling job (B5) via
 * `foalingService.createFoalFromPregnancy()`. Tests that previously asserted
 * on `data.foal.*` are rewritten to assert the new pregnancy contract — the
 * behavioral coverage is the same (validation + persistence), but the
 * contract is delayed-foaling rather than instant-foal.
 *
 * Business rules tested:
 * - Pregnancy API: POST /api/horses/foals accepts valid breeding data
 * - Request validation: name, breedId, sireId, damId, sex, healthStatus
 * - Database integration: dam pregnancy columns, breed validation, parent lookup
 * - Breeding system: sire and dam must exist to start a pregnancy
 * - Response handling: proper HTTP status codes and error messages
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
  }, 90000);

  let testUser;
  let testBreed;
  let testSire;
  let testDam;
  let authToken;
  const createdFoalIds = [];
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    // Create a real user in the database
    // rounds=1: fast in tests; password is never verified (JWT generated directly)
    const hashedPassword = await bcrypt.hash('TestPassword123!', 1);
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
        lastFedDate: new Date(), // healthy by default so happy-path tests pass
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
        lastFedDate: new Date(), // healthy by default so happy-path tests pass
        epigeneticModifiers: { positive: ['calm'], negative: [], hidden: [] },
      },
    });
  }, 120000);

  /**
   * Reset the dam's pregnancy state between tests so each `it()` block can
   * cleanly start a fresh pregnancy. The previous shape created a fresh foal
   * row each time and tracked it via `createdFoalIds`; now there are no foal
   * rows to clean up between tests, but the dam carries forward state.
   */
  async function resetDamPregnancy() {
    if (!testDam) {
      return;
    }
    await prisma.horse.update({
      where: { id: testDam.id },
      data: {
        inFoalSinceDate: null,
        pregnancySireId: null,
        pregnancyFeedingsByTier: {},
        lastBredDate: null,
        pendingFoalName: null,
        pendingFoalBreedId: null,
      },
    });
  }

  afterAll(async () => {
    try {
      // No foal rows are created any more (delayed pregnancy); the
      // createdFoalIds harness is preserved as a defensive cleanup in case
      // a future hybrid test creates real foals via foalingService.
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
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  it('should start a pregnancy and persist dam in-foal state in the database', async () => {
    await resetDamPregnancy();

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
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeTruthy();
    expect(response.body.data.pregnancyStarted).toBe(true);
    expect(response.body.data.damId).toBe(testDam.id);
    expect(response.body.data.sireId).toBe(testSire.id);
    expect(response.body.data.foalDueDate).toBeTruthy();

    // No foal row yet — foaling job (B5) materialises the foal at +7 days.
    const foalCount = await prisma.horse.count({ where: { damId: testDam.id } });
    expect(foalCount).toBe(0);

    // Dam's pregnancy state is persisted.
    const dbDam = await prisma.horse.findUnique({ where: { id: testDam.id } });
    expect(dbDam.inFoalSinceDate).toBeTruthy();
    expect(dbDam.pregnancySireId).toBe(testSire.id);
    expect(dbDam.pregnancyFeedingsByTier).toEqual({});
    expect(dbDam.lastBredDate).toBeTruthy();

    // Wjxw: pendingFoalName and pendingFoalBreedId must be persisted so the
    // foaling job can honour caller intent at delivery time.
    expect(dbDam.pendingFoalName).toBe(foalData.name);
    expect(dbDam.pendingFoalBreedId).toBe(testBreed.id);
  });

  it('should reject a second pregnancy while the mare is already in foal', async () => {
    await resetDamPregnancy();

    const foalData = {
      name: `EpigeneticFoal_${ts}`,
      breedId: testBreed.id,
      sireId: testSire.id,
      damId: testDam.id,
      sex: 'Colt',
      healthStatus: 'Good',
    };

    // First pregnancy succeeds.
    const first = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(foalData)
      .expect(200);
    expect(first.body.data.pregnancyStarted).toBe(true);

    // Second attempt while mare is in foal must be rejected.
    const second = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(foalData)
      .expect(400);
    expect(second.body.success).toBe(false);
    expect(String(second.body.message || '').toLowerCase()).toContain('in foal');

    // Still no foal row.
    const foalCount = await prisma.horse.count({ where: { damId: testDam.id } });
    expect(foalCount).toBe(0);
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

  it('should accept valid breeding payload and return 200 pregnancy-started', async () => {
    await resetDamPregnancy();

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
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('pregnancyStarted', true);
    expect(response.body.data).toHaveProperty('damId', testDam.id);
    expect(response.body.data).toHaveProperty('sireId', testSire.id);
    expect(response.body.data).toHaveProperty('foalDueDate');
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

  // ── Critical-health gate (Equoria-2e7e) ─────────────────────────────────────

  it('should return 400 when sire is in critical health (lastFedDate null)', async () => {
    await resetDamPregnancy();
    await prisma.horse.update({ where: { id: testSire.id }, data: { lastFedDate: null } });

    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `HealthGateFoal_${ts}`,
        breedId: testBreed.id,
        sireId: testSire.id,
        damId: testDam.id,
        sex: 'Filly',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/critical health/i);

    // Restore sire for subsequent tests
    await prisma.horse.update({ where: { id: testSire.id }, data: { lastFedDate: new Date() } });
  });

  it('should return 400 when dam is in critical health (lastFedDate null)', async () => {
    await resetDamPregnancy();
    await prisma.horse.update({ where: { id: testDam.id }, data: { lastFedDate: null } });

    const response = await request(app)
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `HealthGateFoal_${ts}`,
        breedId: testBreed.id,
        sireId: testSire.id,
        damId: testDam.id,
        sex: 'Filly',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/critical health/i);

    // Restore dam health and pregnancy state for subsequent tests
    await prisma.horse.update({
      where: { id: testDam.id },
      data: { lastFedDate: new Date(), inFoalSinceDate: null, pregnancySireId: null },
    });
  });
});
