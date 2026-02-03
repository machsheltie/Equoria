/**
 * Enhanced Groom Interactions Integration Tests
 * Tests the advanced groom-horse interaction system
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Enhanced Groom Interactions Integration Tests', () => {
  let authToken;
  let testUser;
  let testGroom;
  let testHorse;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'enhanced-groom-test-user',
        email: 'enhanced-groom-test@example.com',
        password: 'hashedpassword',
        firstName: 'Enhanced',
        lastName: 'TestUser',
        money: 10000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, username: testUser.username });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Enhanced Test Horse',
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        user: { connect: { id: testUser.id } },
        user: { connect: { id: testUser.id } },
        bondScore: 25,
        stressLevel: 40,
        // breedId is optional, so we'll omit it for the test
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Enhanced Test Groom',
        user: { connect: { id: testUser.id } },
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 5,
        sessionRate: 25.0,
        bio: 'Test groom for enhanced interactions',
      },
    });

    // Test setup complete
  });

  afterAll(async () => {
    // Clean up test data
    if (testGroom?.id) {
      await prisma.groomInteraction.deleteMany({
        where: { groomId: testGroom.id },
      });
    }
    if (testUser?.id) {
      await prisma.groom.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.horse.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
  });

  describe('1. Get Available Enhanced Interactions', () => {
    it('should get available interactions for groom-horse pair', async () => {
      const response = await request(app)
        .get(`/api/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('horse');
      expect(response.body.data).toHaveProperty('relationship');
      expect(response.body.data).toHaveProperty('availableInteractions');
      expect(response.body.data).toHaveProperty('recommendations');

      // Check groom data
      const { groom } = response.body.data;
      expect(groom.id).toBe(testGroom.id);
      expect(groom.name).toBe(testGroom.name);
      expect(groom.speciality).toBe(testGroom.speciality);

      // Check horse data
      const { horse } = response.body.data;
      expect(horse.id).toBe(testHorse.id);
      expect(horse.name).toBe(testHorse.name);

      // Check relationship data
      const { relationship } = response.body.data;
      expect(relationship).toHaveProperty('level');
      expect(relationship).toHaveProperty('levelNumber');
      expect(relationship).toHaveProperty('bondingPoints');
      expect(relationship).toHaveProperty('multiplier');

      // Check available interactions
      const { availableInteractions } = response.body.data;
      expect(Array.isArray(availableInteractions)).toBe(true);
      expect(availableInteractions.length).toBeGreaterThan(0);

      // Each interaction should have required properties
      availableInteractions.forEach((interaction) => {
        expect(interaction).toHaveProperty('id');
        expect(interaction).toHaveProperty('name');
        expect(interaction).toHaveProperty('category');
        expect(interaction).toHaveProperty('variations');
        expect(Array.isArray(interaction.variations)).toBe(true);
      });
    });

    it('should return 404 for non-existent groom', async () => {
      const response = await request(app)
        .get(`/api/grooms/enhanced/interactions/99999/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Groom not found');
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app)
        .get(`/api/grooms/enhanced/interactions/${testGroom.id}/99999`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Horse not found');
    });
  });

  describe('2. Perform Enhanced Interactions', () => {
    it('should perform a basic enhanced interaction', async () => {
      const interactionData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        interactionType: 'daily_care',
        variation: 'Morning Routine',
        duration: 30,
        notes: 'Basic care interaction test',
      };

      const response = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(interactionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interaction');
      expect(response.body.data).toHaveProperty('effects');
      expect(response.body.data).toHaveProperty('relationship');
      expect(response.body.data).toHaveProperty('horse');

      // Check interaction data
      const { interaction } = response.body.data;
      expect(interaction.type).toBe('daily_care');
      expect(interaction.variation).toBe('Morning Routine');
      expect(interaction.duration).toBe(30);
      expect(interaction).toHaveProperty('quality');
      expect(interaction).toHaveProperty('cost');

      // Check effects
      const { effects } = response.body.data;
      expect(effects).toHaveProperty('bondingChange');
      expect(effects).toHaveProperty('stressChange');
      expect(effects).toHaveProperty('newBondScore');
      expect(effects).toHaveProperty('newStressLevel');
      expect(effects.bondingChange).toBeGreaterThan(0);
      expect(effects.stressChange).toBeLessThanOrEqual(0);

      // Check relationship progression
      const { relationship } = response.body.data;
      expect(relationship).toHaveProperty('oldLevel');
      expect(relationship).toHaveProperty('newLevel');
      expect(relationship).toHaveProperty('levelUp');
      expect(relationship).toHaveProperty('currentPoints');
    });

    it('should perform enrichment interaction with higher effects', async () => {
      // Create a second horse for this test to avoid daily limit
      const secondHorse = await prisma.horse.create({
        data: {
          name: 'Second Test Horse',
          sex: 'Mare',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
          user: { connect: { id: testUser.id } },
          user: { connect: { id: testUser.id } },
          bondScore: 30,
          stressLevel: 35,
        },
      });

      const interactionData = {
        groomId: testGroom.id,
        horseId: secondHorse.id,
        interactionType: 'enrichment',
        variation: 'Sensory Exploration',
        duration: 45,
        notes: 'Enrichment activity test',
      };

      const response = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(interactionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const { effects } = response.body.data;
      expect(effects.bondingChange).toBeGreaterThan(3); // Should be higher than basic care
      expect(effects.stressChange).toBeLessThan(0); // Should reduce stress

      // Clean up
      await prisma.horse.delete({ where: { id: secondHorse.id } });
    });

    it('should prevent multiple interactions per day', async () => {
      // Create a third horse for this test
      const thirdHorse = await prisma.horse.create({
        data: {
          name: 'Third Test Horse',
          sex: 'Mare',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
          user: { connect: { id: testUser.id } },
          user: { connect: { id: testUser.id } },
          bondScore: 20,
          stressLevel: 50,
        },
      });

      // First interaction should succeed
      const interactionData = {
        groomId: testGroom.id,
        horseId: thirdHorse.id,
        interactionType: 'bonding_time',
        variation: 'Trust Building',
        duration: 40,
      };

      const firstResponse = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(interactionData);

      expect(firstResponse.status).toBe(201);

      // Second interaction same day should fail
      const secondResponse = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(interactionData);

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.message).toContain('already had a groom interaction today');
      expect(secondResponse.body.data).toHaveProperty('dailyLimitReached');
      expect(secondResponse.body.data.dailyLimitReached).toBe(true);

      // Clean up
      await prisma.horse.delete({ where: { id: thirdHorse.id } });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        // Missing interactionType, variation, duration
      };

      const response = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should validate interaction type', async () => {
      const invalidData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        interactionType: 'invalid_type',
        variation: 'Test Variation',
        duration: 30,
      };

      const response = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid interaction type');
    });

    it('should validate duration bounds', async () => {
      const invalidData = {
        groomId: testGroom.id,
        horseId: testHorse.id,
        interactionType: 'daily_care',
        variation: 'Morning Routine',
        duration: 200, // Too long
      };

      const response = await request(app)
        .post('/api/grooms/enhanced/interact')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-test-skip-csrf', 'true')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('3. Relationship Details', () => {
    it('should get detailed relationship information', async () => {
      const response = await request(app)
        .get(`/api/grooms/enhanced/relationship/${testGroom.id}/${testHorse.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('relationship');
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data).toHaveProperty('recentInteractions');
      expect(response.body.data).toHaveProperty('milestones');

      // Check relationship data
      const { relationship } = response.body.data;
      expect(relationship).toHaveProperty('level');
      expect(relationship).toHaveProperty('levelNumber');
      expect(relationship).toHaveProperty('bondingPoints');
      expect(relationship).toHaveProperty('multiplier');

      // Check statistics
      const { statistics } = response.body.data;
      expect(statistics).toHaveProperty('totalInteractions');
      expect(statistics).toHaveProperty('totalBonding');
      expect(statistics).toHaveProperty('averageQuality');
      expect(statistics.totalInteractions).toBeGreaterThan(0);

      // Check recent interactions
      const { recentInteractions } = response.body.data;
      expect(Array.isArray(recentInteractions)).toBe(true);

      // Check milestones
      const { milestones } = response.body.data;
      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBeGreaterThan(0);
    });
  });

  describe('4. Information Endpoints', () => {
    it('should get interaction types', async () => {
      const response = await request(app)
        .get('/api/grooms/enhanced/interactions/types')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('interactionTypes');
      expect(response.body.data).toHaveProperty('categories');

      const { interactionTypes } = response.body.data;
      expect(Array.isArray(interactionTypes)).toBe(true);
      expect(interactionTypes.length).toBeGreaterThan(0);

      // Each interaction type should have required properties
      interactionTypes.forEach((type) => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('category');
        expect(type).toHaveProperty('variations');
        expect(Array.isArray(type.variations)).toBe(true);
      });
    });
  });

  describe('5. Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        `/api/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`,
        '/api/grooms/enhanced/interact',
        `/api/grooms/enhanced/relationship/${testGroom.id}/${testHorse.id}`,
        '/api/grooms/enhanced/interactions/types',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint).set('x-test-require-auth', 'true');
        expect(response.status).toBe(401);
      }
    });

    it("should prevent access to other users' grooms and horses", async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          username: 'other-enhanced-test-user',
          email: 'other-enhanced-test@example.com',
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'TestUser',
        },
      });

      const otherToken = generateTestToken({ id: otherUser.id, username: otherUser.username });

      try {
        const response = await request(app)
          .get(`/api/grooms/enhanced/interactions/${testGroom.id}/${testHorse.id}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      } finally {
        // Clean up
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });
});
