/**
 * Groom Marketplace API Integration Tests
 * Tests for the complete groom marketplace API workflow
 *
 * Test Coverage:
 * - Get marketplace
 * - Refresh marketplace
 * - Hire grooms from marketplace
 * - Marketplace statistics
 * - Authentication and authorization
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import app from '../../app.mjs';

describe('🏪 INTEGRATION: Groom Marketplace API', () => {
  let _testUser;
  let authToken;

  beforeAll(async () => {
    // Create test user with unique username
    const timestamp = Date.now();
    const userData = await createTestUser({
      username: `marketplace-test-user-${timestamp}`,
      email: `marketplace-${timestamp}@test.com`,
      money: 10000, // Give user plenty of money for testing
    });
    _testUser = userData.user;
    authToken = userData.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should require authentication for all marketplace endpoints', async () => {
      // Test all endpoints without auth
      const endpoints = [
        { method: 'get', path: '/api/groom-marketplace' },
        { method: 'post', path: '/api/groom-marketplace/refresh' },
        { method: 'post', path: '/api/groom-marketplace/hire' },
        { method: 'get', path: '/api/groom-marketplace/stats' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('GET /api/groom-marketplace', () => {
    it('should get marketplace with available grooms', async () => {
      const response = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Marketplace retrieved successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('grooms');
      expect(data).toHaveProperty('lastRefresh');
      expect(data).toHaveProperty('nextFreeRefresh');
      expect(data).toHaveProperty('refreshCost');
      expect(data).toHaveProperty('canRefreshFree');
      expect(data).toHaveProperty('refreshCount');

      // Check grooms array
      expect(Array.isArray(data.grooms)).toBe(true);
      expect(data.grooms.length).toBeGreaterThan(0);

      // Check first groom structure
      const [firstGroom] = data.grooms;
      expect(firstGroom).toHaveProperty('firstName');
      expect(firstGroom).toHaveProperty('lastName');
      expect(firstGroom).toHaveProperty('specialty');
      expect(firstGroom).toHaveProperty('skillLevel');
      expect(firstGroom).toHaveProperty('personality');
      expect(firstGroom).toHaveProperty('experience');
      expect(firstGroom).toHaveProperty('sessionRate');
      expect(firstGroom).toHaveProperty('bio');
      expect(firstGroom).toHaveProperty('availability');
      expect(firstGroom).toHaveProperty('marketplaceId');

      // Check refresh info (first generation counts as refresh)
      expect(data.refreshCount).toBe(1);
      // Note: canRefreshFree may be false immediately after generation due to timing
    });

    it('should return same marketplace on subsequent calls', async () => {
      // Get marketplace twice
      const response1 = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Should have same grooms and refresh count
      expect(response1.body.data.grooms).toEqual(response2.body.data.grooms);
      expect(response1.body.data.refreshCount).toBe(response2.body.data.refreshCount);
    });
  });

  describe('POST /api/groom-marketplace/refresh', () => {
    it('should refresh marketplace when free refresh available', async () => {
      // First get current marketplace
      const initialResponse = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      const initialGrooms = initialResponse.body.data.grooms;

      // Wait for free refresh to become available (test environment has very short interval)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh marketplace
      const refreshResponse = await request(app)
        .post('/api/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.message).toBe('Marketplace refreshed successfully');

      const { data } = refreshResponse.body;
      expect(data).toHaveProperty('grooms');
      expect(data).toHaveProperty('paidRefresh');
      expect(data.paidRefresh).toBe(false); // Should be free

      // Grooms should be different (very high probability)
      const newGrooms = data.grooms;
      expect(newGrooms).not.toEqual(initialGrooms);
      expect(newGrooms.length).toBe(initialGrooms.length);
    });

    it('should require payment for premium refresh when not enough time passed', async () => {
      // Refresh marketplace first
      await request(app)
        .post('/api/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`);

      // Try to refresh again immediately (should require payment)
      const response = await request(app)
        .post('/api/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('costs');
      expect(response.body.data).toHaveProperty('cost');
      expect(response.body.data.cost).toBeGreaterThan(0);
    });

    it('should allow premium refresh with force=true', async () => {
      // Get user's initial money
      const _initialResponse = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      // Force premium refresh
      const refreshResponse = await request(app)
        .post('/api/groom-marketplace/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: true });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.paidRefresh).toBe(true);
    });
  });

  describe('POST /api/groom-marketplace/hire', () => {
    let marketplaceGroom;

    beforeEach(async () => {
      // Get fresh marketplace
      const response = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      [marketplaceGroom] = response.body.data.grooms;
    });

    it('should hire groom from marketplace successfully', async () => {
      const response = await request(app)
        .post('/api/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marketplaceId: marketplaceGroom.marketplaceId });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Groom hired successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('groom');
      expect(data).toHaveProperty('cost');
      expect(data).toHaveProperty('remainingMoney');

      // Check hired groom data
      const hiredGroom = data.groom;
      expect(hiredGroom.name).toBe(`${marketplaceGroom.firstName} ${marketplaceGroom.lastName}`);
      expect(hiredGroom.speciality).toBe(marketplaceGroom.specialty);
      expect(hiredGroom.skillLevel).toBe(marketplaceGroom.skillLevel);
      expect(Number(hiredGroom.sessionRate)).toBe(marketplaceGroom.sessionRate);

      // Check cost calculation (one week upfront)
      const expectedCost = marketplaceGroom.sessionRate * 7;
      expect(data.cost).toBe(expectedCost);
    });

    it('should remove hired groom from marketplace', async () => {
      // Get initial marketplace
      const initialResponse = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      const initialGroomCount = initialResponse.body.data.grooms.length;
      const [groomToHire] = initialResponse.body.data.grooms;

      // Hire the groom
      await request(app)
        .post('/api/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marketplaceId: groomToHire.marketplaceId });

      // Check marketplace again
      const updatedResponse = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      const updatedGrooms = updatedResponse.body.data.grooms;
      expect(updatedGrooms.length).toBe(initialGroomCount - 1);

      // Hired groom should not be in marketplace anymore
      const hiredGroomStillThere = updatedGrooms.find(g => g.marketplaceId === groomToHire.marketplaceId);
      expect(hiredGroomStillThere).toBeUndefined();
    });

    it('should reject hiring with insufficient funds', async () => {
      // Create a poor user with unique username
      const timestamp = Date.now();
      const poorUserData = await createTestUser({
        username: `poor-marketplace-user-${timestamp}`,
        email: `poor-${timestamp}@test.com`,
        money: 10, // Very little money
      });

      // Get marketplace for poor user
      const marketplaceResponse = await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${poorUserData.token}`);

      const expensiveGroom = marketplaceResponse.body.data.grooms
        .find(g => g.sessionRate * 7 > 10); // Find groom that costs more than user has

      if (expensiveGroom) {
        const response = await request(app)
          .post('/api/groom-marketplace/hire')
          .set('Authorization', `Bearer ${poorUserData.token}`)
          .send({ marketplaceId: expensiveGroom.marketplaceId });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Insufficient funds');
      }
    });

    it('should reject hiring non-existent groom', async () => {
      const response = await request(app)
        .post('/api/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ marketplaceId: 'non-existent-id' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Groom not found in marketplace');
    });

    it('should require marketplaceId', async () => {
      const response = await request(app)
        .post('/api/groom-marketplace/hire')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('marketplaceId is required');
    });
  });

  describe('GET /api/groom-marketplace/stats', () => {
    it('should return marketplace statistics', async () => {
      // Ensure marketplace exists
      await request(app)
        .get('/api/groom-marketplace')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/groom-marketplace/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Marketplace statistics retrieved successfully');

      const { data } = response.body;
      expect(data).toHaveProperty('totalGrooms');
      expect(data).toHaveProperty('lastRefresh');
      expect(data).toHaveProperty('refreshCount');
      expect(data).toHaveProperty('qualityDistribution');
      expect(data).toHaveProperty('specialtyDistribution');
      expect(data).toHaveProperty('config');

      // Check distributions
      expect(typeof data.qualityDistribution).toBe('object');
      expect(typeof data.specialtyDistribution).toBe('object');

      // Check config
      expect(data.config).toHaveProperty('refreshIntervalHours');
      expect(data.config).toHaveProperty('premiumRefreshCost');
      expect(data.config).toHaveProperty('defaultSize');
    });

    it('should return empty stats for user with no marketplace', async () => {
      // Create new user with no marketplace and unique username
      const timestamp = Date.now();
      const newUserData = await createTestUser({
        username: `no-marketplace-user-${timestamp}`,
        email: `nomarket-${timestamp}@test.com`,
      });

      const response = await request(app)
        .get('/api/groom-marketplace/stats')
        .set('Authorization', `Bearer ${newUserData.token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalGrooms).toBe(0);
      expect(response.body.data.lastRefresh).toBe('never');
      expect(response.body.data.refreshCount).toBe(0);
    });
  });
});
