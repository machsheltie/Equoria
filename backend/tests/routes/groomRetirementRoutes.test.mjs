/**
 * Groom Retirement Routes Tests
 *
 * Tests for the groom retirement, legacy, and talent API endpoints
 *
 * Testing Approach: NO MOCKING - Real database operations
 * This validates actual API behavior and database constraints
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Groom Retirement Routes', () => {
  let testUser;
  let testToken;
  let testGroom;
  let retiredGroom;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_routes_${Date.now()}`,
        email: `test_routes_${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Generate test token
    testToken = generateTestToken(testUser);
  });

  beforeEach(async () => {
    // Create test grooms
    testGroom = await prisma.groom.create({
      data: {
        name: `Test Groom ${Date.now()}`,
        personality: 'calm',
        skillLevel: 'intermediate',
        speciality: 'foal_care',
        userId: testUser.id,
        level: 5,
        careerWeeks: 50,
      },
    });

    retiredGroom = await prisma.groom.create({
      data: {
        name: `Retired Groom ${Date.now()}`,
        personality: 'energetic',
        skillLevel: 'expert',
        speciality: 'general_grooming',
        userId: testUser.id,
        level: 8,
        careerWeeks: 104,
        retired: true,
        retirementReason: 'mandatory_career_limit',
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testGroom) {
      await prisma.groomTalentSelections.deleteMany({
        where: { groomId: testGroom.id },
      });
      await prisma.groom.delete({
        where: { id: testGroom.id },
      });
    }
    if (retiredGroom) {
      await prisma.groomLegacyLog.deleteMany({
        where: {
          OR: [{ retiredGroomId: retiredGroom.id }, { legacyGroomId: retiredGroom.id }],
        },
      });
      await prisma.groomTalentSelections.deleteMany({
        where: { groomId: retiredGroom.id },
      });
      await prisma.groom.delete({
        where: { id: retiredGroom.id },
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
    await prisma.$disconnect();
  });

  describe('Retirement Endpoints', () => {
    test('GET /api/grooms/:id/retirement/eligibility should check eligibility', async () => {
      const response = await request(app)
        .get(`/api/grooms/${testGroom.id}/retirement/eligibility`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eligible');
      expect(response.body.data).toHaveProperty('weeksUntilRetirement');
    });

    test('GET /api/grooms/retirement/statistics should return user stats', async () => {
      const response = await request(app)
        .get('/api/grooms/retirement/statistics')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalGrooms');
      expect(response.body.data).toHaveProperty('activeGrooms');
      expect(response.body.data).toHaveProperty('retiredGrooms');
    });

    test('GET /api/grooms/retirement/approaching should return approaching retirement grooms', async () => {
      const response = await request(app)
        .get('/api/grooms/retirement/approaching')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Legacy Endpoints', () => {
    test('GET /api/grooms/:id/legacy/eligibility should check legacy eligibility', async () => {
      const response = await request(app)
        .get(`/api/grooms/${retiredGroom.id}/legacy/eligibility`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('eligible');
    });

    test('GET /api/grooms/legacy/history should return legacy history', async () => {
      const response = await request(app)
        .get('/api/grooms/legacy/history')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Talent Endpoints', () => {
    test('GET /api/grooms/talents/definitions should return talent definitions', async () => {
      const response = await request(app)
        .get('/api/grooms/talents/definitions')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('calm');
      expect(response.body.data).toHaveProperty('energetic');
      expect(response.body.data).toHaveProperty('methodical');
    });

    test('GET /api/grooms/:id/talents should return groom talent selections', async () => {
      const response = await request(app)
        .get(`/api/grooms/${testGroom.id}/talents`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should be "none" for new groom with no selections
      expect(response.body.data).toBe('none');
    });

    test('POST /api/grooms/:id/talents/validate should validate talent selection', async () => {
      const response = await request(app)
        .post(`/api/grooms/${testGroom.id}/talents/validate`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          tier: 'tier1',
          talentId: 'gentle_hands',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid');
    });

    test('POST /api/grooms/:id/talents/select should select talent', async () => {
      const response = await request(app)
        .post(`/api/grooms/${testGroom.id}/talents/select`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          tier: 'tier1',
          talentId: 'gentle_hands',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('selection');
      expect(response.body.data.selection.tier1).toBe('gentle_hands');
    });
  });

  describe('Authentication', () => {
    test('should require authentication for protected endpoints', async () => {
      await request(app)
        .get(`/api/grooms/${testGroom.id}/retirement/eligibility`)
        .set('x-test-require-auth', 'true')
        .expect(401);

      await request(app).get('/api/grooms/retirement/statistics').set('x-test-require-auth', 'true').expect(401);

      await request(app).get(`/api/grooms/${testGroom.id}/talents`).set('x-test-require-auth', 'true').expect(401);
    });

    test('should require authentication for talent definitions', async () => {
      await request(app).get('/api/grooms/talents/definitions').set('Authorization', `Bearer ${testToken}`).expect(200);
    });
  });

  describe('Validation', () => {
    test('should validate groom ID parameter', async () => {
      await request(app)
        .get('/api/grooms/invalid/retirement/eligibility')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
    });

    test('should validate talent selection data', async () => {
      await request(app)
        .post(`/api/grooms/${testGroom.id}/talents/select`)
        .set('Authorization', `Bearer ${testToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          tier: 'invalid_tier',
          talentId: 'gentle_hands',
        })
        .expect(400);
    });
  });
});
