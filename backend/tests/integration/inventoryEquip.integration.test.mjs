/**
 * Inventory Equip Integration Tests
 *
 * Covers the stale-equippedToHorseId bug (Equoria-edah):
 * when a horse already has a same-category item equipped and a different item
 * of the same category is equipped in its place, the old item's equippedToHorseId
 * must be cleared — not left pointing at the horse.
 *
 * Testing approach: real DB, real auth, real CSRF. No mocks.
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../helpers/testAuth.mjs';
import { fetchCsrf } from '../helpers/csrfHelper.mjs';

describe('Inventory Equip — same-category swap', () => {
  let testUser;
  let authToken;
  let testHorse;
  let csrf;

  // Two saddles from TACK_INVENTORY
  const SADDLE_A_ID = 'dressage-saddle'; // itemId
  const SADDLE_B_ID = 'jumping-saddle'; // itemId

  const INV_A = {
    id: 'inv-saddle-a',
    itemId: SADDLE_A_ID,
    category: 'saddle',
    name: 'Dressage Saddle',
    bonus: 8,
    quantity: 1,
    equippedToHorseId: null,
  };
  const INV_B = {
    id: 'inv-saddle-b',
    itemId: SADDLE_B_ID,
    category: 'saddle',
    name: 'Jumping Saddle',
    bonus: 7,
    quantity: 1,
    equippedToHorseId: null,
  };

  beforeAll(async () => {
    ({ user: testUser, token: authToken } = await createTestUser({
      username: `invequip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      email: `invequip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@example.com`,
    }));

    testHorse = await createTestHorse({ userId: testUser.id });

    // Seed inventory into user settings
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { inventory: [INV_A, INV_B] } },
    });

    csrf = await fetchCsrf(app);
  });

  afterAll(async () => {
    if (testHorse) {
      await prisma.horse.deleteMany({ where: { id: testHorse.id } });
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  it('equips saddleA to the horse correctly', async () => {
    const res = await request(app)
      .post('/api/inventory/equip')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ inventoryItemId: INV_A.id, horseId: testHorse.id })
      .expect(200);

    expect(res.body.success).toBe(true);
    const itemA = res.body.data.items.find(i => i.id === INV_A.id);
    expect(itemA.equippedToHorseId).toBe(testHorse.id);
  });

  it('equipping saddleB clears saddleA equippedToHorseId (Equoria-edah regression)', async () => {
    // This is the sentinel test: proves the old item's stale pointer is cleared.
    // Before the fix, saddleA.equippedToHorseId remained === testHorse.id after
    // equipping saddleB to the same horse, making saddleA appear equipped in inventory.
    const res = await request(app)
      .post('/api/inventory/equip')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ inventoryItemId: INV_B.id, horseId: testHorse.id })
      .expect(200);

    expect(res.body.success).toBe(true);

    const items = res.body.data.items;
    const itemA = items.find(i => i.id === INV_A.id);
    const itemB = items.find(i => i.id === INV_B.id);

    // saddleB is the new active saddle
    expect(itemB.equippedToHorseId).toBe(testHorse.id);

    // saddleA must be cleared — not still showing as equipped to this horse
    expect(itemA.equippedToHorseId).toBeNull();
  });

  it('GET /api/inventory confirms saddleA is unequipped after swap', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    const items = res.body.data.items;
    const itemA = items.find(i => i.id === INV_A.id);
    const itemB = items.find(i => i.id === INV_B.id);

    expect(itemB.equippedToHorseId).toBe(testHorse.id);
    expect(itemA.equippedToHorseId).toBeNull();
  });
});
