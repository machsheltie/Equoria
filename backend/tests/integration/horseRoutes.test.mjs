/**
 * Horse Routes Integration Tests
 *
 * Tests for horse API endpoints — real database, no mocks.
 * Covers beta-critical flows used by the stable page and training system.
 *
 * Testing Approach: NO MOCKING — Real database operations
 * This validates actual API behavior and database constraints.
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Horse Routes Integration Tests', () => {
  let testUser;
  let testToken;
  let trainableHorse;
  let foalHorse;

  beforeEach(async () => {
    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    testUser = await prisma.user.create({
      data: {
        username: `testuser_hr_${ts}`,
        email: `testuser_hr_${ts}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    testToken = generateTestToken(testUser);

    trainableHorse = await prisma.horse.create({
      data: {
        name: `TrainableHorse_${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
        age: 4,
        userId: testUser.id,
      },
    });

    foalHorse = await prisma.horse.create({
      data: {
        name: `FoalHorse_${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 1 * 365.25 * 24 * 60 * 60 * 1000),
        age: 1,
        userId: testUser.id,
      },
    });
  });

  afterEach(async () => {
    if (trainableHorse) {
      await prisma.horse.deleteMany({ where: { id: trainableHorse.id } });
    }
    if (foalHorse) {
      await prisma.horse.deleteMany({ where: { id: foalHorse.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
      testUser = null;
    }
  });

  describe('GET /api/horses', () => {
    test('should return horses for the authenticated user', async () => {
      const response = await request(app).get('/api/horses').set('Authorization', `Bearer ${testToken}`).expect(200);

      expect(response.body).toHaveProperty('success', true);
      const horseIds = response.body.data.map(h => h.id);
      expect(horseIds).toContain(trainableHorse.id);
      expect(horseIds).toContain(foalHorse.id);
    });

    test('should require authentication', async () => {
      await request(app).get('/api/horses').expect(401);
    });
  });

  describe('GET /api/horses/trainable/:userId', () => {
    test('should return all horses with trainableDisciplines based on age', async () => {
      const response = await request(app)
        .get(`/api/horses/trainable/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);

      const returned = response.body.data;
      const trainable = returned.find(h => h.horseId === trainableHorse.id);
      const foal = returned.find(h => h.horseId === foalHorse.id);

      // 4-year-old horse should have trainable disciplines
      expect(trainable).toBeDefined();
      expect(trainable.age).toBe(4);
      expect(trainable.trainableDisciplines.length).toBeGreaterThan(0);

      // 1-year-old foal is too young — controller returns it with empty disciplines
      expect(foal).toBeDefined();
      expect(foal.age).toBe(1);
      expect(foal.trainableDisciplines).toHaveLength(0);
    });

    test('should return 403 when accessing another users trainable horses', async () => {
      const otherTs = `${Date.now()}_other`;
      const otherUser = await prisma.user.create({
        data: {
          username: `other_hr_${otherTs}`,
          email: `other_hr_${otherTs}@example.com`,
          password: 'hashedpassword123',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      try {
        const response = await request(app)
          .get(`/api/horses/trainable/${otherUser.id}`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/Forbidden/i);
      } finally {
        await prisma.user.deleteMany({ where: { id: otherUser.id } });
      }
    });

    test('should return 400 for user ID that is too long', async () => {
      const longUserId = 'a'.repeat(51);
      const response = await request(app)
        .get(`/api/horses/trainable/${longUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    test('should require authentication', async () => {
      await request(app).get(`/api/horses/trainable/${testUser.id}`).expect(401);
    });
  });
});
