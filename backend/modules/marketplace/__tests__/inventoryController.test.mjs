/**
 * inventoryController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getInventory, equipItem, unequipItem.
 * All inventory routes live under authRouter → real auth + real CSRF for POSTs.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix = 'inv') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}
function uniqueUsername(prefix = 'inv') {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// A valid inventory item that can be seeded directly into User.settings
const SEED_ITEM = {
  id: 'test-inv-saddle-1',
  itemId: 'all-purpose-saddle',
  category: 'saddle',
  name: 'All-Purpose Saddle',
  bonus: 5,
  quantity: 1,
  equippedToHorseId: null,
};

describe('inventoryController integration', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Inv',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    // Cleanup horses first (FK), then user
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-InvHorse' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  // ─── GET /api/inventory ───────────────────────────────────────────────────

  describe('GET /api/inventory', () => {
    it('returns 200 with empty items for a new user', async () => {
      const res = await request(app)
        .get('/api/inventory')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.total).toBe(0);
    });

    it('returns 200 with seeded inventory items', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      const res = await request(app)
        .get('/api/inventory')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].id).toBe(SEED_ITEM.id);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/inventory').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/inventory/equip ────────────────────────────────────────────

  describe('POST /api/inventory/equip', () => {
    it('returns 400 when inventoryItemId is missing', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: 1 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when horseId is missing', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'test-inv-saddle-1' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when inventoryItemId does not exist in user inventory', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'nonexistent-item', horseId: 1 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and equips item to horse when both exist', async () => {
      // Seed inventory item
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      // Create horse owned by user
      const horse = await prisma.horse.create({
        data: {
          name: `TestFixture-InvHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
        },
      });

      try {
        const csrf = await fetchCsrf(app);
        const res = await request(app)
          .post('/api/inventory/equip')
          .set('Origin', ORIGIN)
          .set('Authorization', `Bearer ${token}`)
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.csrfToken)
          .send({ inventoryItemId: SEED_ITEM.id, horseId: horse.id });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('items');
        // The equipped item should now point to this horse
        const equipped = res.body.data.equippedItem;
        expect(equipped.equippedToHorseId).toBe(horse.id);
      } finally {
        await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
      }
    });

    it('returns 401 without auth token', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/equip')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'test-inv-saddle-1', horseId: 1 });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/inventory/unequip ──────────────────────────────────────────

  describe('POST /api/inventory/unequip', () => {
    it('returns 400 when inventoryItemId is missing', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 404 when inventoryItemId does not exist in user inventory', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'nonexistent-item' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when item exists but is not equipped', async () => {
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [SEED_ITEM] } },
      });

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: SEED_ITEM.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not currently equipped/i);
    });

    it('returns 200 and unequips item when it was equipped', async () => {
      const horse = await prisma.horse.create({
        data: {
          name: `TestFixture-InvHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2022-01-01'),
          age: 3,
          userId: user.id,
          tack: { saddle: 'all-purpose-saddle' },
        },
      });

      // Seed inventory with item already equipped to this horse
      const equippedItem = { ...SEED_ITEM, equippedToHorseId: horse.id };
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { inventory: [equippedItem] } },
      });

      try {
        const csrf = await fetchCsrf(app);
        const res = await request(app)
          .post('/api/inventory/unequip')
          .set('Origin', ORIGIN)
          .set('Authorization', `Bearer ${token}`)
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.csrfToken)
          .send({ inventoryItemId: SEED_ITEM.id });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.unequippedItem.equippedToHorseId).toBeNull();
      } finally {
        await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
      }
    });

    it('returns 401 without auth token', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/inventory/unequip')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ inventoryItemId: 'test-inv-saddle-1' });

      expect(res.status).toBe(401);
    });
  });
});
