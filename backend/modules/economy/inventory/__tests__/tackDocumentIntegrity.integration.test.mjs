/**
 * `Horse.tack` must never carry a bonus without the item that earns it, and an
 * item returned to a player's inventory must be usable again (Equoria-6p398.12,
 * fix round 1).
 *
 * TWO DEFECTS THIS FILE PINS
 *
 * 1. ORPHANED BONUS MIRRORS. `tackShopController.purchaseTackItem` stores a
 *    numeric mirror beside the item id (`{ saddle: 'x', saddleBonus: 5 }`), and
 *    `resolveTackBonus` SHORT-CIRCUITS on the mirror:
 *
 *        const hasDirect = typeof tack.saddleBonus === 'number' || …
 *        if (hasDirect) return { saddleBonus: tack.saddleBonus || 0, … };
 *
 *    It never looks at the item ids on that branch. `unequipItem` deleted the
 *    item key and left the mirror, so a horse wearing nothing kept scoring +5
 *    in every ridden competition, permanently. The mirror now leaves with its
 *    item.
 *
 * 2. DECORATIONS THAT EQUIP INTO A DEAD SLOT. Decorative items are ADDITIVE and
 *    live in `tack.decorations[]`: the parade presence bonus and
 *    `tackShopController.unequipDecoration` read that array and nothing else.
 *    `equipItem` wrote `tack[item.category]`, i.e. `tack.decorative`, so a
 *    decoration equipped from inventory was invisible to scoring and unreachable
 *    by the shop's remove endpoint. Nothing hit this before, because the only
 *    producer of decorative inventory records — the tack return on sale — is new
 *    in this change; returning a ribbon the player could never use again would
 *    have been a false affordance. Decorations now round-trip through the array.
 *
 * Real DB, real HTTP, real CSRF, real tack-shop / inventory / marketplace
 * endpoints, scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
// Same-module deep import (tackShop is nested inside economy, as
// inventoryController itself does for TACK_INVENTORY).
import { resolveTackBonus } from '../../tackShop/controllers/tackShopController.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-12-tackdoc';
const LIST_PRICE = 400;
const SHOP_SADDLE = 'all-purpose-saddle'; // 400, category `saddle`, +5
const RIBBON = 'show-ribbon'; // 120, category `decorative`
const BROWBAND = 'floral-browband'; // 160, category `decorative`

const uniq = () => randomBytes(6).toString('hex');

async function makeUser(role, money) {
  const suffix = uniq();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${role}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'TackDoc',
      lastName: role,
      money,
    },
  });
  return {
    id: user.id,
    token: generateTestToken({ id: user.id, email: user.email, role: 'user' }),
  };
}

async function makeHorse(ownerId, { forSale = false, salePrice = 0 } = {}) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${uniq()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: ownerId,
      healthStatus: 'Excellent',
      forSale,
      salePrice,
    },
  });
}

async function post(endpoint, token, body) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body ?? {});
}

async function inventoryOf(token) {
  const res = await request(app).get('/api/v1/inventory').set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN);
  expect(res.status).toBe(200);
  return res.body.data.items;
}

async function readTack(horseId) {
  const row = await prisma.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  return row?.tack && typeof row.tack === 'object' ? row.tack : {};
}

describe('Horse.tack document integrity around equip/unequip (Equoria-6p398.12)', () => {
  const cleanup = createCleanupTracker();
  let owner;
  let buyer;
  let horse;
  let listedHorse;

  beforeEach(async () => {
    owner = await makeUser('owner', 5000);
    buyer = await makeUser('buyer', 10000);
    horse = await makeHorse(owner.id);
    listedHorse = await makeHorse(owner.id, { forSale: true, salePrice: LIST_PRICE });

    const userIds = [owner.id, buyer.id];
    const horseIds = [horse.id, listedHorse.id];
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 30000);

  it('takes the bonus mirror off the horse with the item it belongs to', async () => {
    expect(
      (await post('/api/v1/tack-shop/purchase', owner.token, { horseId: horse.id, itemId: SHOP_SADDLE })).status,
    ).toBe(200);

    const equipped = await readTack(horse.id);
    expect(equipped.saddle).toBe(SHOP_SADDLE);
    expect(equipped.saddleBonus).toBe(5);
    expect(resolveTackBonus(equipped).saddleBonus).toBe(5);

    const record = (await inventoryOf(owner.token)).find(i => i.itemId === SHOP_SADDLE);
    expect(record).toBeDefined();

    expect((await post('/api/v1/inventory/unequip', owner.token, { inventoryItemId: record.id })).status).toBe(200);

    // The defect: the item key went, the mirror stayed, and resolveTackBonus's
    // hasDirect branch kept paying +5 to a bare horse forever.
    const bare = await readTack(horse.id);
    expect(bare.saddle).toBeUndefined();
    expect(bare.saddleBonus).toBeUndefined();
    expect(resolveTackBonus(bare)).toEqual({ saddleBonus: 0, bridleBonus: 0, presenceBonus: 0 });
  }, 90000);

  it('re-equips a decoration returned by a sale into tack.decorations, where scoring reads it', async () => {
    // Two shop decorations on the horse that is about to be sold. Only the sale
    // produces decorative inventory records, so this is the only route to the
    // state under test.
    for (const itemId of [RIBBON, BROWBAND]) {
      expect((await post('/api/v1/tack-shop/purchase', owner.token, { horseId: listedHorse.id, itemId })).status).toBe(
        200,
      );
    }
    expect((await readTack(listedHorse.id)).decorations).toEqual([RIBBON, BROWBAND]);

    expect((await post(`/api/v1/marketplace/buy/${listedHorse.id}`, buyer.token)).status).toBe(200);

    // Returned to the seller, off the buyer's horse.
    expect((await readTack(listedHorse.id)).decorations ?? []).toEqual([]);
    const returned = (await inventoryOf(owner.token)).filter(i => i.category === 'decorative');
    expect(returned.map(i => i.itemId).sort()).toEqual([BROWBAND, RIBBON].sort());
    for (const item of returned) {
      expect(item.equippedToHorseId).toBeNull();
    }

    // Re-equipping must land in `decorations[]`, not a dead `decorative` slot,
    // and decorations STACK — a second one must not displace the first.
    for (const item of returned) {
      expect(
        (
          await post('/api/v1/inventory/equip', owner.token, {
            inventoryItemId: item.id,
            horseId: horse.id,
          })
        ).status,
      ).toBe(200);
    }

    const dressed = await readTack(horse.id);
    expect(dressed.decorative).toBeUndefined();
    expect((dressed.decorations ?? []).sort()).toEqual([BROWBAND, RIBBON].sort());
    // Scoring can actually see them now (parade-only presence bonus).
    expect(resolveTackBonus(dressed, 'parade').presenceBonus).toBeGreaterThan(0);

    // Both records report themselves equipped — neither was silently cleared by
    // the same-category swap rule, which does not apply to additive items.
    const dressedInventory = (await inventoryOf(owner.token)).filter(i => i.category === 'decorative');
    for (const item of dressedInventory) {
      expect(item.equippedToHorseId).toBe(horse.id);
    }

    // And unequip takes one back out of the array, leaving the other in place.
    const ribbonRecord = dressedInventory.find(i => i.itemId === RIBBON);
    expect((await post('/api/v1/inventory/unequip', owner.token, { inventoryItemId: ribbonRecord.id })).status).toBe(
      200,
    );
    expect((await readTack(horse.id)).decorations).toEqual([BROWBAND]);
    expect(resolveTackBonus(await readTack(horse.id), 'parade').presenceBonus).toBeGreaterThan(0);
  }, 120000);
});
