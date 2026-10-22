/**
 * Horse.tack stays truthful when an item REPLACES another or a decoration is
 * taken off (Equoria-6p398.19), and an equip never overwrites a tack purchase
 * that committed while it was in flight.
 *
 * 1. STALE MIRROR. A shop purchase stores `{ saddle: <id>, saddleBonus: <n> }`.
 *    Equipping an inventory saddle over it replaced the id and left the old
 *    `saddleBonus`, and `resolveTackBonus` short-circuits on the mirror — the
 *    horse kept the replaced saddle's bonus.
 * 2. DESTROYED DECORATION. `POST /tack-shop/unequip-decoration` deleted the
 *    decoration outright. The sale path (Equoria-6p398.12) returns the same
 *    decoration to the seller's inventory, so the two paths disagreed on
 *    whether a decoration survives being taken off. It now returns to the
 *    owner's inventory the way the sale returns it: an inventory record that
 *    already points at the horse is released, a shop-bought one is derived.
 * 3. STALE TACK ON EQUIP. equipItem read the target horse's tack before its
 *    User-row write; a tack purchase for the same horse committing in between
 *    was overwritten — paid for, then gone. Forced with a real row lock
 *    (rowLockBarrier), no mocks.
 *
 * Real DB, real HTTP + CSRF, real tack-shop and inventory endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { resolveTackBonus } from '../../tackShop/controllers/tackShopController.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../../__tests__/helpers/rowLockBarrier.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-6p398-19-tack';
const shopSaddle = 'racing-exercise-saddle'; // catalogue +7
const inventorySaddle = 'all-purpose-saddle'; // catalogue +2
const shopSaddleForRace = 'dressage-saddle';
const browband = 'floral-browband';

const barrierClient = createBarrierClient();
const uniq = () => randomBytes(6).toString('hex');

async function post(endpoint, token, body) {
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body ?? {});
}

async function readTack(horseId) {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  return row?.tack && typeof row.tack === 'object' ? row.tack : {};
}

async function readInventory(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  return Array.isArray(row?.settings?.inventory) ? row.settings.inventory : [];
}

const record = (id, itemId, category, equippedToHorseId = null) => ({
  id,
  itemId,
  category,
  name: itemId,
  bonus: null,
  quantity: 1,
  equippedToHorseId,
});

describe('Horse.tack replace / decoration return / equip-vs-purchase (Equoria-6p398.19)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let token;
  let horse;

  async function setInventory(items) {
    await prisma.user.update({ where: { id: owner.id }, data: { settings: { inventory: items } } });
  }

  beforeEach(async () => {
    const tag = uniq();
    owner = await prisma.user.create({
      data: {
        username: `${fixturePrefix}-${tag}`,
        email: `${fixturePrefix}-${tag}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Tack',
        lastName: 'Slot',
        money: 10000,
        settings: {},
      },
    });
    token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-horse-${tag}`,
        sex: 'Mare',
        dateOfBirth: new Date('2019-06-15'),
        age: 6,
        userId: owner.id,
        healthStatus: 'Excellent',
      },
    });
    const userId = owner.id;
    const horseId = horse.id;
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId } }), 'userTransaction');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 30000);
  afterAll(() => barrierClient.$disconnect());

  it('an inventory saddle replacing a shop saddle carries its own bonus, not the replaced one', async () => {
    const bought = await post('/api/v1/tack-shop/purchase', token, { horseId: horse.id, itemId: shopSaddle });
    expect(bought.status).toBe(200);
    expect(resolveTackBonus(await readTack(horse.id)).saddleBonus).toBe(7);

    await setInventory([record('inv-saddle', inventorySaddle, 'saddle')]);
    const equipped = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: 'inv-saddle',
      horseId: horse.id,
    });
    expect(equipped.status).toBe(200);

    const tack = await readTack(horse.id);
    expect(tack.saddle).toBe(inventorySaddle);
    expect(resolveTackBonus(tack).saddleBonus).toBe(2);
  });

  it('a shop-bought decoration taken off returns to the owner’s inventory and can be worn again', async () => {
    expect((await post('/api/v1/tack-shop/purchase', token, { horseId: horse.id, itemId: browband })).status).toBe(200);

    const off = await post('/api/v1/tack-shop/unequip-decoration', token, {
      horseId: horse.id,
      itemId: browband,
    });
    expect(off.status).toBe(200);
    expect(readDecorationsOf(await readTack(horse.id))).not.toContain(browband);

    const returned = (await readInventory(owner.id)).filter(i => i.itemId === browband);
    expect(returned).toEqual([
      expect.objectContaining({
        id: `${horse.id}-${browband}`,
        category: 'decorative',
        equippedToHorseId: null,
      }),
    ]);

    const again = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: returned[0].id,
      horseId: horse.id,
    });
    expect(again.status).toBe(200);
    expect(readDecorationsOf(await readTack(horse.id))).toContain(browband);
  });

  it('a decoration worn from inventory is released, not duplicated, when taken off', async () => {
    await setInventory([record('inv-browband', browband, 'decorative')]);
    expect(
      (await post('/api/v1/inventory/equip', token, { inventoryItemId: 'inv-browband', horseId: horse.id })).status,
    ).toBe(200);

    const off = await post('/api/v1/tack-shop/unequip-decoration', token, {
      horseId: horse.id,
      itemId: browband,
    });
    expect(off.status).toBe(200);

    const inventory = await readInventory(owner.id);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({ id: 'inv-browband', equippedToHorseId: null });
    expect(readDecorationsOf(await readTack(horse.id))).not.toContain(browband);
  });

  it('an equip racing a tack purchase for the same horse keeps the purchased item', async () => {
    await setInventory([record('inv-browband', browband, 'decorative')]);

    const barrier = await openRowLockBarrier(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner.id} FOR UPDATE`,
    );
    let purchase;
    let equip;
    try {
      // The purchase queues on its debit (User row); the equip then reads the
      // pre-purchase tack and queues on its inventory write behind it.
      purchase = post('/api/v1/tack-shop/purchase', token, {
        horseId: horse.id,
        itemId: shopSaddleForRace,
      }).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 1);
      equip = post('/api/v1/inventory/equip', token, {
        inventoryItemId: 'inv-browband',
        horseId: horse.id,
      }).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 2);
    } finally {
      await barrier.release();
    }
    const [bought, equipped] = await Promise.all([purchase, equip]);
    expect(bought.status).toBe(200);
    expect(equipped.status).toBe(200);

    const tack = await readTack(horse.id);
    expect(tack.saddle).toBe(shopSaddleForRace);
    expect(readDecorationsOf(tack)).toContain(browband);
  }, 60000);
});

function readDecorationsOf(tack) {
  return Array.isArray(tack.decorations) ? tack.decorations : [];
}
