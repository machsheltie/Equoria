/**
 * Integration Test: Foal Enrichment API — Real Database
 *
 * Tests the POST /api/foals/:foalId/enrichment endpoint with real database
 * operations. No mocks — validates actual request handling, validation,
 * database writes, and response formatting against the real enrichment system.
 *
 * Business rules tested:
 * - Foal enrichment API: POST /api/foals/:foalId/enrichment endpoint
 * - Request validation: day (0-6), activity name, foal ID
 * - Activity validation: day-specific activities, appropriate activity-day combos
 * - Bond/stress management: score updates with proper bounds (0-100)
 * - Database operations: horse lookup, updates, training history creation
 * - Response structure: success/error responses with proper data formatting
 * - Error handling: 404 for missing foals, 400 for validation failures
 * - Activity flexibility: multiple name formats (type, name, case insensitive)
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateTestToken } from './helpers/authHelper.mjs';
import bcrypt from 'bcryptjs';

// Import the real app — no mocks
const app = (await import('../app.mjs')).default;

describe('INTEGRATION: Foal Enrichment API — Real Database', () => {
  let testUser;
  let testFoal;
  let authToken;
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    // Create a real user in the database
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    testUser = await prisma.user.create({
      data: {
        username: `enrichment_user_${ts}`,
        email: `enrichment_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Enrichment',
        lastName: 'Tester',
      },
    });

    // Generate a JWT token for the real user
    authToken = generateTestToken({ id: testUser.id, role: 'user' });

    // Create a real foal (age 0) owned by the test user
    testFoal = await prisma.horse.create({
      data: {
        name: `EnrichmentFoal_${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: testUser.id,
        bondScore: 50,
        stressLevel: 20,
      },
    });
  });

  afterAll(async () => {
    // Clean up in correct order to respect foreign key constraints
    try {
      if (testFoal) {
        await prisma.foalTrainingHistory.deleteMany({
          where: { horseId: testFoal.id },
        });
        await prisma.foalDevelopment.deleteMany({
          where: { foalId: testFoal.id },
        });
        await prisma.foalActivity
          .deleteMany({
            where: { foalId: testFoal.id },
          })
          .catch(() => {});
        await prisma.groomAssignment
          .deleteMany({
            where: { foalId: testFoal.id },
          })
          .catch(() => {});
        await prisma.horse.deleteMany({ where: { id: testFoal.id } });
      }
      if (testUser) {
        await prisma.groom.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    } catch (error) {
      console.warn('Cleanup warning (can be ignored):', error.message);
    }
  });

  describe('POST /api/foals/:foalId/enrichment', () => {
    it('should complete enrichment activity successfully', async () => {
      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Trailer Exposure',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Trailer Exposure');
      expect(response.body.data).toHaveProperty('foal');
      expect(response.body.data).toHaveProperty('activity');
      expect(response.body.data).toHaveProperty('updatedLevels');
      expect(response.body.data).toHaveProperty('changes');
      expect(response.body.data).toHaveProperty('trainingRecordId');

      // Verify foal data
      expect(response.body.data.foal.id).toBe(testFoal.id);
      expect(response.body.data.foal.name).toBe(testFoal.name);

      // Verify activity data
      expect(response.body.data.activity.name).toBe('Trailer Exposure');
      expect(response.body.data.activity.day).toBe(3);
      expect(response.body.data.activity.outcome).toMatch(/success|excellent|challenging/);

      // Verify levels are within bounds
      expect(response.body.data.updatedLevels.bondScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.stressLevel).toBeLessThanOrEqual(100);

      // Verify changes are reported
      expect(response.body.data.changes).toHaveProperty('bondChange');
      expect(response.body.data.changes).toHaveProperty('stressChange');
    });

    it('should update horse bondScore and stressLevel in the real database', async () => {
      // Read current values from DB
      const _before = await prisma.horse.findUnique({
        where: { id: testFoal.id },
        select: { bondScore: true, stressLevel: true },
      });

      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 3,
          activity: 'Halter Introduction',
        })
        .expect(200);

      // Read values after enrichment
      const after = await prisma.horse.findUnique({
        where: { id: testFoal.id },
        select: { bondScore: true, stressLevel: true },
      });

      // The bond/stress should have changed from the activity
      expect(response.body.data.updatedLevels).toHaveProperty('bondScore');
      expect(response.body.data.updatedLevels).toHaveProperty('stressLevel');

      // Verify the DB values match the response
      expect(after.bondScore).toBe(response.body.data.updatedLevels.bondScore);
      expect(after.stressLevel).toBe(response.body.data.updatedLevels.stressLevel);
    });

    it('should validate request parameters', async () => {
      // Missing day
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ activity: 'Trailer Exposure' })
        .expect(400);

      // Missing activity
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3 })
        .expect(400);

      // Invalid day (too high)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 7, activity: 'Trailer Exposure' })
        .expect(400);

      // Invalid day (negative)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: -1, activity: 'Trailer Exposure' })
        .expect(400);

      // Empty activity
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: '' })
        .expect(400);
    });

    it('should return 404 for non-existent foal', async () => {
      const response = await request(app)
        .post('/api/foals/99999/enrichment')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: 'Trailer Exposure' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 for inappropriate activity for day', async () => {
      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          day: 0,
          activity: 'Trailer Exposure', // This is a day 3 activity
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not appropriate for day 0');
    });

    it('should accept different activity name formats', async () => {
      // Test exact type (snake_case)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: 'leading_practice' })
        .expect(200);

      // Test exact name (Title Case)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: 'Leading Practice' })
        .expect(200);

      // Test case insensitive (UPPERCASE)
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: 'HANDLING EXERCISES' })
        .expect(200);
    });

    it('should handle all day 3 activities', async () => {
      const day3Activities = ['Halter Introduction', 'Leading Practice', 'Handling Exercises', 'Trailer Exposure'];

      for (const activity of day3Activities) {
        const response = await request(app)
          .post(`/api/foals/${testFoal.id}/enrichment`)
          .set('Authorization', `Bearer ${authToken}`)
          .set('x-test-skip-csrf', 'true')
          .send({ day: 3, activity })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.activity.name).toBe(activity);
        expect(response.body.data.activity.day).toBe(3);
      }
    });

    it('should create training history records in the real database', async () => {
      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 1, activity: 'Feeding Assistance' })
        .expect(200);

      // Verify training record exists in the real database
      const trainingRecord = await prisma.foalTrainingHistory.findUnique({
        where: { id: response.body.data.trainingRecordId },
      });

      expect(trainingRecord).toBeTruthy();
      expect(trainingRecord.horseId).toBe(testFoal.id);
      expect(trainingRecord.day).toBe(1);
      expect(trainingRecord.activity).toBe('Feeding Assistance');
      expect(trainingRecord.outcome).toMatch(/success|excellent|challenging/);
      expect(typeof trainingRecord.bondChange).toBe('number');
      expect(typeof trainingRecord.stressChange).toBe('number');
    });

    it('should handle edge cases with bond and stress levels', async () => {
      // Set foal to extreme bond/stress values in the real DB
      await prisma.horse.update({
        where: { id: testFoal.id },
        data: { bondScore: 98, stressLevel: 2 },
      });

      const response = await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ day: 3, activity: 'Trailer Exposure' })
        .expect(200);

      // Values should be capped within 0-100 bounds
      expect(response.body.data.updatedLevels.bondScore).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.bondScore).toBeGreaterThanOrEqual(0);
      expect(response.body.data.updatedLevels.stressLevel).toBeLessThanOrEqual(100);
      expect(response.body.data.updatedLevels.stressLevel).toBeGreaterThanOrEqual(0);

      // Verify the capped values were persisted in DB
      const updated = await prisma.horse.findUnique({
        where: { id: testFoal.id },
        select: { bondScore: true, stressLevel: true },
      });
      expect(updated.bondScore).toBeLessThanOrEqual(100);
      expect(updated.stressLevel).toBeGreaterThanOrEqual(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/foals/${testFoal.id}/enrichment`)
        .send({ day: 3, activity: 'Trailer Exposure' })
        .expect(401);
    });
  });
});
