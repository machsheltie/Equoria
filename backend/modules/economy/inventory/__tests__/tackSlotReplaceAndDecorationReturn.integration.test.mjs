/**
 * Horse.tack stays truthful when an item REPLACES another or a decoration is
 * taken off (Equoria-6p398.19), and an equip never overwrites a tack purchase
 * that committed while it was in flight.
 *
 * 1. STALE MIRROR. A shop purchase used to store `{ saddle: <id>, saddleBonus: <n> }`
 *    and equipping an inventory saddle over it left the old `saddleBonus`, so the
 *    horse kept the replaced saddle's bonus. Equoria-lsudd retired the mirror
 *    (owner decision A, 2026-10-23: the item in the slot decides the tack
 *    points; old contract: the mirror was rewritten to the new item's number).
 *    The pin is now that replacing a saddle leaves only the new id.
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
 * Owner ruling 2026-10-26 (q78, Equoria-dslww): the Tack Shop no longer puts tack
 * on a horse; buying goes to the inventory. Horses bought-for before that ruling
 * still carry shop tack with NO inventory record, and the replace and
 * decoration-return paths must keep reconciling it, so tests 1, 2 and 4 seed that
 * legacy state directly (seedLegacyShopTack). Old contract for test 3: a tack
 * purchase for the horse raced an equip on the horse's tack; a purchase now races
 * an equip on the inventory array, where the equip's compare-and-swap loses.
 *
 * Real DB, real HTTP + CSRF, real tack-shop and inventory endpoints.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';
import { seedLegacyShopTack } from '../../../../__tests__/helpers/tackShopBuy.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../../__tests__/helpers/rowLockBarrier.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-6p398-19-tack';
const shopSaddle = 'racing-exercise-saddle';
const inventorySaddle = 'all-purpose-saddle';
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
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: owner.id } }), 'userTransaction');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
    owner = await prisma.user.create({
      data: {
        emailVerified: true,
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
  }, 60000);

  afterEach(() => cleanup.run(), 30000);
  afterAll(() => barrierClient.$disconnect());

  it('an inventory saddle replacing a shop saddle leaves only its own id, with no numeric bonus beside it', async () => {
    await seedLegacyShopTack(horse.id, { id: shopSaddle, category: 'saddle' });
    const purchased = await readTack(horse.id);
    expect(purchased.saddle).toBe(shopSaddle);
    expect(purchased.saddleBonus).toBeUndefined();

    await setInventory([record('inv-saddle', inventorySaddle, 'saddle')]);
    const equipped = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: 'inv-saddle',
      horseId: horse.id,
    });
    expect(equipped.status).toBe(200);

    const tack = await readTack(horse.id);
    expect(tack.saddle).toBe(inventorySaddle);
    expect(tack.saddleBonus).toBeUndefined();
  });

  it('a shop-bought decoration taken off returns to the owner’s inventory and can be worn again', async () => {
    await seedLegacyShopTack(horse.id, { id: browband, category: 'decorative' });

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

  it('an inventory saddle equipped over a shop-bought saddle returns the shop saddle to inventory (Equoria-063xk)', async () => {
    await seedLegacyShopTack(horse.id, { id: shopSaddle, category: 'saddle' });
    await setInventory([record('inv-saddle', inventorySaddle, 'saddle')]);

    const equipped = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: 'inv-saddle',
      horseId: horse.id,
    });
    expect(equipped.status).toBe(200);
    expect((await readTack(horse.id)).saddle).toBe(inventorySaddle);

    // The paid-for shop saddle is not destroyed: it has an inventory record, off the horse.
    const returned = (await readInventory(owner.id)).filter(i => i.itemId === shopSaddle);
    expect(returned).toEqual([
      expect.objectContaining({
        id: `${horse.id}-${shopSaddle}`,
        category: 'saddle',
        equippedToHorseId: null,
      }),
    ]);
    // The response the client renders carries it too.
    expect(equipped.body.data.items.some(i => i.itemId === shopSaddle)).toBe(true);

    // And it can be put back on, which returns the inventory saddle in turn.
    const back = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: returned[0].id,
      horseId: horse.id,
    });
    expect(back.status).toBe(200);
    expect((await readTack(horse.id)).saddle).toBe(shopSaddle);
    const after = await readInventory(owner.id);
    expect(after.find(i => i.id === 'inv-saddle')).toMatchObject({ equippedToHorseId: null });
    expect(after.filter(i => i.itemId === shopSaddle)).toHaveLength(1);
  });

  it('an inventory saddle replacing another inventory saddle adds no phantom record (Equoria-063xk)', async () => {
    await setInventory([record('inv-a', inventorySaddle, 'saddle'), record('inv-b', shopSaddleForRace, 'saddle')]);
    expect((await post('/api/v1/inventory/equip', token, { inventoryItemId: 'inv-a', horseId: horse.id })).status).toBe(
      200,
    );
    expect((await post('/api/v1/inventory/equip', token, { inventoryItemId: 'inv-b', horseId: horse.id })).status).toBe(
      200,
    );

    const inventory = await readInventory(owner.id);
    expect(inventory.map(i => i.id).sort()).toEqual(['inv-a', 'inv-b']);
    expect(inventory.find(i => i.id === 'inv-a')).toMatchObject({ equippedToHorseId: null });
    expect(inventory.find(i => i.id === 'inv-b')).toMatchObject({ equippedToHorseId: horse.id });
  });

  it('an equip racing a shop purchase loses cleanly: the purchase and its debit stand, the equip changes nothing', async () => {
    await setInventory([record('inv-browband', browband, 'decorative')]);
    const moneyBefore = (await prisma.user.findUnique({ where: { id: owner.id } })).money;

    const barrier = await openRowLockBarrier(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner.id} FOR UPDATE`,
    );
    let purchase;
    let equip;
    try {
      // The purchase queues on its debit (User row); the equip then reads the
      // pre-purchase inventory and queues on its inventory write behind it.
      purchase = post('/api/v1/tack-shop/purchase', token, { itemId: shopSaddleForRace }).then(r => r);
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
    // The purchase committed first and changed the inventory array underneath the
    // equip, so the equip's compare-and-swap affected no row.
    expect(equipped.status).toBe(409);

    const inventory = await readInventory(owner.id);
    expect(inventory.filter(i => i.itemId === shopSaddleForRace)).toHaveLength(1);
    expect(inventory.find(i => i.id === 'inv-browband')).toMatchObject({ equippedToHorseId: null });
    expect(readDecorationsOf(await readTack(horse.id))).toEqual([]);
    const moneyAfter = (await prisma.user.findUnique({ where: { id: owner.id } })).money;
    expect(moneyBefore - moneyAfter).toBe(500);

    // The owner simply retries against fresh state.
    const retry = await post('/api/v1/inventory/equip', token, {
      inventoryItemId: 'inv-browband',
      horseId: horse.id,
    });
    expect(retry.status).toBe(200);
    expect(readDecorationsOf(await readTack(horse.id))).toContain(browband);
  }, 60000);
});

function readDecorationsOf(tack) {
  return Array.isArray(tack.decorations) ? tack.decorations : [];
}
