/**
 * Bulk-pack feed purchase integration tests (Equoria-g4a3).
 *
 * Spec §6.1: POST /api/feed-shop/purchase with body { feedTier, packs }.
 * Debits packPrice * packs from user.money. Increments
 * inventory[feed-{tier}].quantity by 100 * packs. Idempotent on existing
 * inventory rows.
 *
 * Real DB, real auth, real CSRF — no bypass headers, no API mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

describe('POST /api/feed-shop/purchase (bulk pack purchase)', () => {
  let user;
  let token;
  let csrf;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `feed-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `feedbulk${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app);
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  const post = body =>
    request(app)
      .post('/api/feed-shop/purchase')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);

  it('purchases 1 pack of basic feed: debits 100 coins, adds 100 units to inventory', async () => {
    const res = await post({ feedTier: 'basic', packs: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.remainingMoney).toBe(900);
    expect(res.body.data.inventoryItem).toMatchObject({
      itemId: 'basic',
      category: 'feed',
      quantity: 100,
    });

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.money).toBe(900);
    expect(fresh.settings.inventory).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'feed-basic', quantity: 100 })]),
    );
  });

  it('purchases 3 packs of elite feed: debits 600 coins, adds 300 units', async () => {
    const res = await post({ feedTier: 'elite', packs: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.remainingMoney).toBe(400);
    expect(res.body.data.inventoryItem.quantity).toBe(300);
  });

  it('accumulates quantity on existing inventory row of the same tier', async () => {
    await post({ feedTier: 'basic', packs: 1 });
    const res = await post({ feedTier: 'basic', packs: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.inventoryItem.quantity).toBe(300);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const basicRows = fresh.settings.inventory.filter(i => i.id === 'feed-basic');
    expect(basicRows).toHaveLength(1);
    expect(basicRows[0].quantity).toBe(300);
  });

  it('rejects insufficient funds (4xx, money unchanged)', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 50 } });
    const res = await post({ feedTier: 'basic', packs: 1 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.message).toMatch(/insufficient/i);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.money).toBe(50);
  });

  it('rejects unknown tier', async () => {
    const res = await post({ feedTier: 'platinum', packs: 1 });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('rejects packs < 1', async () => {
    const res = await post({ feedTier: 'basic', packs: 0 });
    expect(res.status).toBe(400);
  });

  it('rejects non-integer packs', async () => {
    const res = await post({ feedTier: 'basic', packs: 1.5 });
    expect(res.status).toBe(400);
  });
});
