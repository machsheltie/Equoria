/**
 * Marketplace API Integration Tests — Epic 21
 *
 * Tests all 6 marketplace endpoints:
 * - GET  /api/v1/marketplace           (browse listings)
 * - POST /api/v1/marketplace/list      (list horse for sale)
 * - DELETE /api/v1/marketplace/list/:id (delist horse)
 * - POST /api/v1/marketplace/buy/:id   (purchase horse)
 * - GET  /api/v1/marketplace/my-listings (seller's active listings)
 * - GET  /api/v1/marketplace/history    (sale history)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../helpers/testAuth.mjs';
import app from '../../app.mjs';

describe('🛒 INTEGRATION: Marketplace API', () => {
  let seller, sellerToken;
  let buyer, buyerToken;
  let testHorse;
  const createdHorseIds = [];

  beforeAll(async () => {
    const ts = Date.now();
    const s = await createTestUser({
      username: `seller_${ts}`,
      email: `seller_${ts}@test.com`,
      money: 5000,
    });
    const b = await createTestUser({
      username: `buyer_${ts}`,
      email: `buyer_${ts}@test.com`,
      money: 10000,
    });
    seller = s.user;
    sellerToken = s.token;
    buyer = b.user;
    buyerToken = b.token;

    // Find or create a breed
    let breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: { name: 'TestBreed', description: 'Test breed' },
      });
    }

    // Create a horse owned by seller
    testHorse = await prisma.horse.create({
      data: {
        name: `MarketHorse_${ts}`,
        sex: 'mare',
        age: 5,
        dateOfBirth: new Date('2019-01-01'),
        userId: seller.id,
        breedId: breed.id,
        healthStatus: 'Good',
        speed: 50,
        stamina: 50,
        agility: 40,
      },
    });
    createdHorseIds.push(testHorse.id);
  });

  afterAll(async () => {
    try {
      // Delete sale records first
      await prisma.horseSale.deleteMany({
        where: { horseId: { in: createdHorseIds } },
      });
      await prisma.horse.deleteMany({
        where: { id: { in: createdHorseIds } },
      });
    } catch {
      /* ignore */
    }
    try {
      await prisma.user.deleteMany({
        where: { id: { in: [seller?.id, buyer?.id].filter(Boolean) } },
      });
    } catch {
      /* ignore */
    }
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  // ─── Listing ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/marketplace/list', () => {
    it('should list a horse for sale', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ horseId: testHorse.id, price: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salePrice).toBe(2500);

      const updated = await prisma.horse.findUnique({ where: { id: testHorse.id } });
      expect(updated.forSale).toBe(true);
      expect(updated.salePrice).toBe(2500);
    });

    it('should reject listing already-listed horse', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ horseId: testHorse.id, price: 3000 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already listed/i);
    });

    it('should reject listing with price below 100', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ horseId: testHorse.id, price: 50 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/100/);
    });

    it('should reject listing a horse owned by another user', async () => {
      const res = await request(app)
        .post('/api/v1/marketplace/list')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true')
        .send({ horseId: testHorse.id, price: 2000 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/do not own/i);
    });
  });

  // ─── Browse ───────────────────────────────────────────────────────────────────

  describe('GET /api/v1/marketplace', () => {
    it('should return listings excluding requester own horses', async () => {
      // buyer can see seller's horse
      const res = await request(app)
        .get('/api/v1/marketplace')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const listing = res.body.data.listings.find(l => l.id === testHorse.id);
      expect(listing).toBeDefined();
      expect(listing.salePrice).toBe(2500);
      expect(listing.seller).toBe(seller.username);
    });

    it("should exclude seller's own horse when seller browses", async () => {
      const res = await request(app)
        .get('/api/v1/marketplace')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      const listing = res.body.data.listings.find(l => l.id === testHorse.id);
      expect(listing).toBeUndefined();
    });

    it('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace?minPrice=1000&maxPrice=3000')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      for (const l of res.body.data.listings) {
        expect(l.salePrice).toBeGreaterThanOrEqual(1000);
        expect(l.salePrice).toBeLessThanOrEqual(3000);
      }
    });

    it('should return pagination metadata', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace?page=1&limit=10')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
      });
      expect(typeof res.body.data.pagination.total).toBe('number');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/marketplace').set('x-test-require-auth', 'true');

      expect(res.status).toBe(401);
    });
  });

  // ─── My Listings ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/marketplace/my-listings', () => {
    it("should return seller's active listings", async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/my-listings')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const listing = res.body.data.find(l => l.id === testHorse.id);
      expect(listing).toBeDefined();
    });

    it('should return empty array when no listings', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/my-listings')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ─── Purchase ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/marketplace/buy/:horseId', () => {
    it('should reject buying own horse', async () => {
      const res = await request(app)
        .post(`/api/v1/marketplace/buy/${testHorse.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already own/i);
    });

    it('should reject purchase with insufficient funds', async () => {
      // Create a broke buyer
      const brokeUser = await createTestUser({
        username: `broke_${Date.now()}`,
        email: `broke_${Date.now()}@test.com`,
        money: 100,
      });

      const res = await request(app)
        .post(`/api/v1/marketplace/buy/${testHorse.id}`)
        .set('Authorization', `Bearer ${brokeUser.token}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient/i);

      // Cleanup broke buyer
      await prisma.user.delete({ where: { id: brokeUser.user.id } });
    });

    it('should atomically transfer horse, deduct buyer, credit seller', async () => {
      const sellerBefore = await prisma.user.findUnique({ where: { id: seller.id } });
      const buyerBefore = await prisma.user.findUnique({ where: { id: buyer.id } });

      const res = await request(app)
        .post(`/api/v1/marketplace/buy/${testHorse.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.horseName).toBe(testHorse.name);

      const [sellerAfter, buyerAfter, horseAfter, saleRecord] = await Promise.all([
        prisma.user.findUnique({ where: { id: seller.id } }),
        prisma.user.findUnique({ where: { id: buyer.id } }),
        prisma.horse.findUnique({ where: { id: testHorse.id } }),
        prisma.horseSale.findFirst({ where: { horseId: testHorse.id } }),
      ]);

      // Money transferred
      expect(sellerAfter.money).toBe(sellerBefore.money + 2500);
      expect(buyerAfter.money).toBe(buyerBefore.money - 2500);

      // Horse ownership transferred
      expect(horseAfter.userId).toBe(buyer.id);
      expect(horseAfter.forSale).toBe(false);
      expect(horseAfter.salePrice).toBe(0);

      // Sale record created
      expect(saleRecord).toBeDefined();
      expect(saleRecord.sellerId).toBe(seller.id);
      expect(saleRecord.buyerId).toBe(buyer.id);
      expect(saleRecord.salePrice).toBe(2500);
      expect(saleRecord.horseName).toBe(testHorse.name);
    });

    it('should reject buying horse that is no longer for sale', async () => {
      // Horse was already sold in previous test
      const res = await request(app)
        .post(`/api/v1/marketplace/buy/${testHorse.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not for sale/i);
    });
  });

  // ─── Sale History ─────────────────────────────────────────────────────────────

  describe('GET /api/v1/marketplace/history', () => {
    it('should return seller history with type=sold', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/history')
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const record = res.body.data.find(r => r.horseName === testHorse.name);
      expect(record).toBeDefined();
      expect(record.type).toBe('sold');
      expect(record.salePrice).toBe(2500);
      expect(record.counterparty).toBe(buyer.username);
    });

    it('should return buyer history with type=bought', async () => {
      const res = await request(app)
        .get('/api/v1/marketplace/history')
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      const record = res.body.data.find(r => r.horseName === testHorse.name);
      expect(record).toBeDefined();
      expect(record.type).toBe('bought');
      expect(record.counterparty).toBe(seller.username);
    });

    it('should return empty history for new user', async () => {
      const newUser = await createTestUser({
        username: `hist_${Date.now()}`,
        email: `hist_${Date.now()}@test.com`,
      });

      const res = await request(app)
        .get('/api/v1/marketplace/history')
        .set('Authorization', `Bearer ${newUser.token}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);

      await prisma.user.delete({ where: { id: newUser.user.id } });
    });
  });

  // ─── Delist ───────────────────────────────────────────────────────────────────

  describe('DELETE /api/v1/marketplace/list/:horseId', () => {
    let delistHorse;

    beforeAll(async () => {
      // Create a fresh horse to delist (buyer now owns testHorse)
      const breed = await prisma.breed.findFirst();
      delistHorse = await prisma.horse.create({
        data: {
          name: `DelistHorse_${Date.now()}`,
          sex: 'stallion',
          age: 4,
          dateOfBirth: new Date('2020-01-01'),
          userId: seller.id,
          breedId: breed.id,
          healthStatus: 'Good',
          forSale: true,
          salePrice: 1000,
        },
      });
      createdHorseIds.push(delistHorse.id);
    });

    it('should delist a horse (owner only)', async () => {
      const res = await request(app)
        .delete(`/api/v1/marketplace/list/${delistHorse.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/listing removed/i);

      const updated = await prisma.horse.findUnique({ where: { id: delistHorse.id } });
      expect(updated.forSale).toBe(false);
      expect(updated.salePrice).toBe(0);
    });

    it('should reject delist by non-owner', async () => {
      // Re-list the horse first
      await prisma.horse.update({
        where: { id: delistHorse.id },
        data: { forSale: true, salePrice: 1000 },
      });

      const res = await request(app)
        .delete(`/api/v1/marketplace/list/${delistHorse.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .set('x-test-skip-csrf', 'true');

      expect(res.status).toBe(403);
    });
  });
});
