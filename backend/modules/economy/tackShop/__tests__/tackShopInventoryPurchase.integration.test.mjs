/**
 * tackShopInventoryPurchase.integration.test.mjs (Equoria-dslww)
 *
 * Owner ruling 2026-10-26 (q78): the Tack Shop works like the Feed Shop, "just
 * a place to buy things". Horses play no part in a shop: buying puts the tack in
 * the player's inventory and equipping happens elsewhere (the inventory / horse
 * page). EVERY tack item costs 500: saddles, harnesses, bridles, halters, pads,
 * wraps, reins, girths, breastplates, the Coming soon items and the decorations.
 *
 * Old contract: purchase required a horseId and wrote the item straight onto
 * that horse's tack (items were priced 300-900).
 *
 * Real DB, real routes via supertest, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import { allTackItems } from '../services/tackInventory.mjs';

const ORIGIN = 'http://localhost:3000';
const startMoney = 2000;
const cleanup = createCleanupTracker();

let user;
let token;
let horse;

async function buy(body) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/tack-shop/purchase')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

async function readUser() {
  return prisma.user.findUnique({ where: { id: user.id }, select: { money: true, settings: true } });
}

beforeAll(async () => {
  const tag = randomBytes(8).toString('hex');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `tackinv-${tag}@test.com`,
      username: `tackinv${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Tack',
      lastName: 'Buyer',
      money: startMoney,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TackInv-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 6,
      userId: user.id,
    },
  });
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: user.id } }), 'ledger');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('every tack item costs 500 (q78)', () => {
  it('prices the whole catalogue at 500, every category and the retired aliases included', () => {
    const items = allTackItems();
    expect(items.length).toBeGreaterThan(60);
    expect(new Set(items.map(i => i.category)).size).toBeGreaterThan(8);
    expect(items.filter(i => i.cost !== 500).map(i => `${i.id}:${i.cost}`)).toEqual([]);
  });

  it('serves the same 500 prices through the shop endpoint', async () => {
    const res = await request(app)
      .get('/api/v1/tack-shop/inventory')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items.length).toBeGreaterThan(40);
    expect(res.body.data.items.every(i => i.cost === 500)).toBe(true);
  });
});

describe('POST /tack-shop/purchase puts tack in the inventory, no horse involved', () => {
  it('charges 500, adds an unequipped inventory record and leaves every horse untouched', async () => {
    const res = await buy({ itemId: 'dressage-saddle' });
    expect(res.status).toBe(200);
    expect(res.body.data.remainingMoney).toBe(startMoney - 500);

    const after = await readUser();
    expect(after.money).toBe(startMoney - 500);
    const records = after.settings.inventory.filter(r => r.itemId === 'dressage-saddle');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      category: 'saddle',
      name: 'Dressage Saddle',
      quantity: 1,
      equippedToHorseId: null,
    });

    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { tack: true } });
    expect(row.tack).toEqual({});

    const ledger = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'tackPurchase' },
    });
    expect(Number(ledger.amount)).toBe(500);
  });

  it('keeps a second copy as its own record (equip addresses records by id)', async () => {
    const res = await buy({ itemId: 'dressage-saddle' });
    expect(res.status).toBe(200);
    const records = (await readUser()).settings.inventory.filter(r => r.itemId === 'dressage-saddle');
    expect(records).toHaveLength(2);
    expect(new Set(records.map(r => r.id)).size).toBe(2);
  });

  it('lets the bought saddle be equipped later from the inventory', async () => {
    const record = (await readUser()).settings.inventory.find(r => r.itemId === 'dressage-saddle');
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/inventory/equip')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ inventoryItemId: record.id, horseId: horse.id });
    expect(res.status).toBe(200);
    const row = await prisma.horse.findUnique({ where: { id: horse.id }, select: { tack: true } });
    expect(row.tack.saddle).toBe('dressage-saddle');
  });

  it('refuses without funds and changes nothing', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 100 } });
    const before = (await readUser()).settings.inventory.length;
    const res = await buy({ itemId: 'racing-bridle' });
    expect(res.status).toBe(400);
    const after = await readUser();
    expect(after.money).toBe(100);
    expect(after.settings.inventory).toHaveLength(before);
  });

  it('still answers 404 for an unknown item', async () => {
    const res = await buy({ itemId: 'no-such-tack' });
    expect(res.status).toBe(404);
  });
});
