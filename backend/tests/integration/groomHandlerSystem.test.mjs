/**
 * Groom Handler System Integration Tests
 * Tests the integration of grooms as competition handlers
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Groom Handler System Integration Tests', () => {
  let authToken;
  let testUser;
  let testGroom;
  let testHorse;


  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'handler-test-user',
        email: 'handler-test@example.com',
        password: 'hashedpassword',
        firstName: 'Handler',
        lastName: 'TestUser',
        money: 10000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, username: testUser.username });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Handler Test Horse',
        sex: 'male',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        ownerId: testUser.id,
        bondScore: 50,
        stressLevel: 30,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Handler Test Groom',
        userId: testUser.id,
        speciality: 'showHandling',
        skillLevel: 'expert',
        personality: 'confident',
        experience: 10,
        sessionRate: 35.00,
        bio: 'Test groom for handler system',
      },
    });

    // Create test assignment
    await prisma.groomAssignment.create({
      data: {
        groomId: testGroom.id,
        foalId: testHorse.id,
        userId: testUser.id,
        priority: 1,
        isActive: true,
        notes: 'Test assignment for handler system',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser?.id) {
      await prisma.groomAssignment.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.groom.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.horse.deleteMany({
        where: { ownerId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
  });

  describe('1. Handler Assignment', () => {
    it('should get the assigned handler for a horse', async () => {
      const response = await request(app)
        .get(`/api/groom-handlers/horse/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hasHandler');
      expect(response.body.data).toHaveProperty('horse');
      expect(response.body.data).toHaveProperty('handler');
      expect(response.body.data).toHaveProperty('assignment');

      expect(response.body.data.hasHandler).toBe(true);
      expect(response.body.data.handler.id).toBe(testGroom.id);
      expect(response.body.data.handler.name).toBe(testGroom.name);
      expect(response.body.data.horse.id).toBe(testHorse.id);
    });

    it('should return no handler for a horse without assignment', async () => {
      // Create a horse without handler
      const noHandlerHorse = await prisma.horse.create({
        data: {
          name: 'No Handler Horse',
          sex: 'female',
          dateOfBirth: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000), // 2 years old
          ownerId: testUser.id,
          bondScore: 30,
          stressLevel: 40,
        },
      });

      try {
        const response = await request(app)
          .get(`/api/groom-handlers/horse/${noHandlerHorse.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.hasHandler).toBe(false);
        expect(response.body.data.handler).toBe("none");
        expect(response.body.data.assignment).toBe("none");
        expect(response.body.data.horse.id).toBe(noHandlerHorse.id);
      } finally {
        // Clean up
        await prisma.horse.delete({ where: { id: noHandlerHorse.id } });
      }
    });

    it('should validate horse ownership', async () => {
      // Create another user's horse
      const otherUser = await prisma.user.create({
        data: {
          username: 'other-handler-user',
          email: 'other-handler@example.com',
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherHorse = await prisma.horse.create({
        data: {
          name: 'Other User Horse',
          sex: 'male',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          ownerId: otherUser.id,
        },
      });

      try {
        const response = await request(app)
          .get(`/api/groom-handlers/horse/${otherHorse.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('do not own this horse');
      } finally {
        // Clean up
        await prisma.horse.delete({ where: { id: otherHorse.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });

  describe('2. Handler Eligibility', () => {
    it('should check handler eligibility for a conformation class', async () => {
      const response = await request(app)
        .get(`/api/groom-handlers/eligibility/${testHorse.id}/Mares`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eligible');
      expect(response.body.data).toHaveProperty('handlerBonus');
      expect(response.body.data).toHaveProperty('bonusBreakdown');
      expect(response.body.data).toHaveProperty('handler');
      expect(response.body.data).toHaveProperty('isConformationShow');

      expect(response.body.data.eligible).toBe(true);
      expect(response.body.data.handlerBonus).toBeGreaterThan(0);
      expect(response.body.data.handler.id).toBe(testGroom.id);
      expect(response.body.data.handler.name).toBe(testGroom.name);
      expect(response.body.data.isConformationShow).toBe(true);
    });

    it('should validate conformation class', async () => {
      const response = await request(app)
        .get(`/api/groom-handlers/eligibility/${testHorse.id}/InvalidClass`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid conformation class');
    });
  });

  describe('3. Handler Configuration', () => {
    it('should get handler configuration', async () => {
      const response = await request(app)
        .get('/api/groom-handlers/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('skillBonuses');
      expect(response.body.data).toHaveProperty('personalitySynergy');
      expect(response.body.data).toHaveProperty('specialtyBonuses');
      expect(response.body.data).toHaveProperty('description');

      // Check skill bonuses structure
      expect(response.body.data.skillBonuses).toHaveProperty('novice');
      expect(response.body.data.skillBonuses).toHaveProperty('expert');
      expect(response.body.data.skillBonuses.expert).toHaveProperty('baseBonus');
      expect(response.body.data.skillBonuses.expert).toHaveProperty('maxBonus');
    });
  });

  describe('4. Handler Recommendations', () => {
    it('should get handler recommendations for a horse', async () => {
      // Create additional grooms for testing recommendations
      const additionalGrooms = [];
      const groomData = [
        { name: 'Rec Groom 1', speciality: 'racing', skillLevel: 'novice', personality: 'energetic' },
        { name: 'Rec Groom 2', speciality: 'western', skillLevel: 'intermediate', personality: 'patient' },
      ];

      for (const data of groomData) {
        const groom = await prisma.groom.create({
          data: {
            ...data,
            userId: testUser.id,
            experience: 3,
            sessionRate: 20.00,
            bio: 'Test groom for recommendations',
          },
        });
        additionalGrooms.push(groom);
      }

      try {
        const response = await request(app)
          .get(`/api/groom-handlers/recommendations/${testHorse.id}?className=Mares`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('recommendations');
        expect(response.body.data).toHaveProperty('currentHandler');

        const { recommendations, currentHandler } = response.body.data;
        expect(Array.isArray(recommendations)).toBe(true);
        expect(recommendations.length).toBeGreaterThanOrEqual(3); // Original + 2 additional

        // Check if recommendations are sorted by bonus (highest first)
        for (let i = 1; i < recommendations.length; i++) {
          expect(recommendations[i - 1].bonus).toBeGreaterThanOrEqual(recommendations[i].bonus);
        }

        // Check current handler
        expect(currentHandler).not.toBe(null);
        expect(currentHandler.id).toBe(testGroom.id);
      } finally {
        // Clean up
        for (const groom of additionalGrooms) {
          await prisma.groom.delete({ where: { id: groom.id } });
        }
      }
    });
  });

  describe('5. Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: `/api/groom-handlers/horse/${testHorse.id}` },
        { method: 'get', path: `/api/groom-handlers/eligibility/${testHorse.id}/Mares` },
        { method: 'get', path: '/api/groom-handlers/config' },
        { method: 'get', path: `/api/groom-handlers/recommendations/${testHorse.id}` },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });
});
