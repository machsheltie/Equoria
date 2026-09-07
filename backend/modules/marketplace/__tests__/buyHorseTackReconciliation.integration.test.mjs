/**
 * POST /api/v1/marketplace/buy/:horseId — tack does not travel with a sold
 * horse; it goes back into the SELLER's inventory (owner ruling
 * Equoria-6p398.12, the Task-1 `unequipItem` residual).
 *
 * THE DEFECT THIS FILE REPRODUCES
 *   `Horse.tack` records what is ON a horse; it does not record who OWNS it.
 *   Ownership lives in exactly one place — a record in the owner's
 *   `User.settings.inventory` carrying `equippedToHorseId`. Before this fix a
 *   sale rewrote `Horse.userId` and nothing else, so:
 *
 *     - the BUYER received a horse still wearing the seller's saddle, bridle
 *       and decorations, and every scoring path that reads `Horse.tack`
 *       (`resolveTackBonus` in simulateCompetition, the parade presence bonus)
 *       handed the buyer bonuses paid for by the seller; and
 *     - the SELLER's inventory record still said `equippedToHorseId: <sold
 *       horse>`, so the item was unusable — `equipItem` moves it by writing the
 *       PREVIOUS horse's tack, which `applyTackChange` refuses for a horse the
 *       user no longer owns (409), and `unequipItem` clears the record but
 *       cannot touch the stranger's horse, leaving the item on it forever.
 *
 *   Shop-bought tack was worse: `tackShopController.purchaseTackItem` writes
 *   only `Horse.tack` and creates no inventory record at all, so a sale simply
 *   gave the item away with the horse.
 *
 * THE INVARIANT
 *   After the sale commits, the buyer's horse carries no equipment, and every
 *   item that came off it exists in the SELLER's inventory unequipped —
 *   whichever provenance it had. A rejected purchase changes neither.
 *
 * Real DB, real HTTP, real CSRF, real tack-shop and inventory endpoints,
 * scoped fail-loud fixtures. No mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { setMarketplaceRaceBarrier } from '../services/marketplaceRaceBarrier.mjs';
// Cross-module: through the economy barrel, never the tackShop internals.
import { resolveTackBonus } from '../../economy/index.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-6p398-12-tack';
const LIST_PRICE = 400;

// Catalogue entries used below (backend/modules/economy/tackShop). Ids, costs,
// categories and bonus strings are read back from the live catalogue in the
// assertions rather than hard-coded twice.
const SHOP_HALTER = 'show-halter'; // 250, category `halter`
const SHOP_DECORATION = 'show-ribbon'; // 120, category `decorative`
const INVENTORY_SADDLE = 'all-purpose-saddle'; // 400, category `saddle`
const SPARE_BRIDLE = 'snaffle-bridle'; // 200, category `bridle`

function tag() {
  return randomBytes(6).toString('hex');
}

async function makeUser(role, money) {
  const suffix = tag();
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${role}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${role}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'TackTransfer',
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
      name: `${FIXTURE_PREFIX}-horse-${tag()}`,
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

async function purchaseTackRequest(token, horseId, itemId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/tack-shop/purchase')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, itemId });
}

async function getInventoryRequest(token) {
  return request(app).get('/api/v1/inventory').set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN);
}

async function equipRequest(token, inventoryItemId, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/inventory/equip')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ inventoryItemId, horseId });
}

async function unequipRequest(token, inventoryItemId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post('/api/v1/inventory/unequip')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ inventoryItemId });
}

async function buyRequest(token, horseId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(`/api/v1/marketplace/buy/${horseId}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});
}

/** Settled-safe: a rejected supertest promise must not surface as an unhandled rejection. */
function buySettled(token, horseId) {
  return buyRequest(token, horseId).then(
    res => ({ status: res.status, body: res.body }),
    err => ({ status: 0, body: { message: String(err?.message ?? err) } }),
  );
}

/** Arm the delay-only interleaving seam for exactly ONE buyer. */
function armBarrierFor(buyerId) {
  let markReached;
  let openGate;
  const reached = new Promise(resolve => {
    markReached = resolve;
  });
  const gate = new Promise(resolve => {
    openGate = resolve;
  });
  setMarketplaceRaceBarrier(async (stage, context) => {
    if (stage !== 'buyHorse:afterListingRead' || context?.buyerId !== buyerId) {
      return;
    }
    markReached();
    await gate;
  });
  return {
    reached,
    release: () => openGate(),
    disarm: () => setMarketplaceRaceBarrier(null),
  };
}

/**
 * Arm the seam to THROW after the reconciliation writes, for one horse. This is
 * the only way to prove the tack return rolls back: every ordinary rejection
 * (insufficient funds, stale listing) fails before the claim and before the
 * reconciliation ever runs.
 */
function armAbortAfterReconciliation(horseId, marker) {
  setMarketplaceRaceBarrier(async (stage, context) => {
    if (stage !== 'horseTransfer:afterReconciliation' || context?.horseId !== horseId) {
      return;
    }
    throw new Error(marker);
  });
}

async function waitFor(promise, label) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function horseRow(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true, userId: true, tack: true },
  });
}

async function userRow(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
}

/** The SELLER's persisted inventory array, read straight from the database. */
async function sellerInventory(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
  const inv = user?.settings?.inventory;
  return Array.isArray(inv) ? inv : [];
}

function recordsFor(inventory, itemId) {
  return inventory.filter(i => i.itemId === itemId);
}

describe('buyHorse — tack comes off the horse and goes back to the seller (Equoria-6p398.12)', () => {
  const cleanup = createCleanupTracker();
  let seller;
  let buyer;
  let listedHorse;
  let keptHorse;

  beforeEach(async () => {
    // 5,000 covers the halter (250) + ribbon (120) + saddle (400) purchases
    // below with room to spare; the sale credit is asserted separately.
    seller = await makeUser('seller', 5000);
    buyer = await makeUser('buyer', 10000);
    listedHorse = await makeHorse(seller.id, { forSale: true, salePrice: LIST_PRICE });
    keptHorse = await makeHorse(seller.id);

    const userIds = [seller.id, buyer.id];
    const horseIds = [listedHorse.id, keptHorse.id];

    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransaction');
    cleanup.add(() => prisma.horseSale.deleteMany({ where: { horseId: { in: horseIds } } }), 'horseSale');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'user');
  }, 60000);

  afterEach(async () => {
    setMarketplaceRaceBarrier(null);
    await cleanup.run();
  }, 30000);

  it('strips shop-bought tack off the sold horse and derives a seller inventory record', async () => {
    // Shop-origin: purchaseTackItem writes ONLY Horse.tack — there is no
    // inventory record anywhere, which is why the sale used to give the item
    // away outright.
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_HALTER)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_DECORATION)).status).toBe(200);
    expect(await sellerInventory(seller.id)).toEqual([]);

    const beforeSale = await horseRow(listedHorse.id);
    expect(beforeSale.tack.halter).toBe(SHOP_HALTER);
    expect(beforeSale.tack.decorations).toEqual([SHOP_DECORATION]);

    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    // The buyer gets a bare horse — no halter, no decorations, no bonus mirror.
    const sold = await horseRow(listedHorse.id);
    expect(sold.userId).toBe(buyer.id);
    expect(sold.tack.halter).toBeUndefined();
    expect(sold.tack.decorations ?? []).toEqual([]);

    // ... and the seller keeps both items, unequipped, in the same record shape
    // `deriveInventoryFromHorseTack` persists on the first GET /api/inventory.
    const inventory = await sellerInventory(seller.id);
    const halter = recordsFor(inventory, SHOP_HALTER);
    expect(halter).toHaveLength(1);
    expect(halter[0].category).toBe('halter');
    expect(halter[0].name).toBe('Show Halter');
    expect(halter[0].quantity).toBe(1);
    expect(halter[0].equippedToHorseId).toBeNull();

    const ribbon = recordsFor(inventory, SHOP_DECORATION);
    expect(ribbon).toHaveLength(1);
    expect(ribbon[0].category).toBe('decorative');
    expect(ribbon[0].equippedToHorseId).toBeNull();
  }, 90000);

  it('releases the seller’s equipped inventory record rather than stranding it on the buyer’s horse', async () => {
    // Inventory-origin: buy the saddle for a horse the seller KEEPS, surface it
    // as an inventory record (the GET seed), then equip it onto the listing
    // through the real endpoint. Now both representations exist.
    expect((await purchaseTackRequest(seller.token, keptHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    expect(seeded.status).toBe(200);
    const saddleRecord = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE);
    expect(saddleRecord).toBeDefined();

    expect((await equipRequest(seller.token, saddleRecord.id, listedHorse.id)).status).toBe(200);
    expect((await horseRow(listedHorse.id)).tack.saddle).toBe(INVENTORY_SADDLE);
    expect((await sellerInventory(seller.id)).find(i => i.id === saddleRecord.id).equippedToHorseId).toBe(
      listedHorse.id,
    );

    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    const sold = await horseRow(listedHorse.id);
    expect(sold.userId).toBe(buyer.id);
    expect(sold.tack.saddle).toBeUndefined();

    // The SAME record is released — not deleted, not duplicated.
    const inventory = await sellerInventory(seller.id);
    const saddles = recordsFor(inventory, INVENTORY_SADDLE);
    expect(saddles).toHaveLength(1);
    expect(saddles[0].id).toBe(saddleRecord.id);
    expect(saddles[0].equippedToHorseId).toBeNull();

    // And it is usable again: the seller can put it on a horse they still own.
    expect((await equipRequest(seller.token, saddleRecord.id, keptHorse.id)).status).toBe(200);
    expect((await horseRow(keptHorse.id)).tack.saddle).toBe(INVENTORY_SADDLE);
  }, 90000);

  it('returns both provenances at once and leaves the buyer’s horse bare', async () => {
    expect((await purchaseTackRequest(seller.token, keptHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    const saddleRecord = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE);
    expect((await equipRequest(seller.token, saddleRecord.id, listedHorse.id)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_HALTER)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_DECORATION)).status).toBe(200);

    const loaded = await horseRow(listedHorse.id);
    expect(loaded.tack.saddle).toBe(INVENTORY_SADDLE);
    expect(loaded.tack.halter).toBe(SHOP_HALTER);
    expect(loaded.tack.decorations).toEqual([SHOP_DECORATION]);

    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    const sold = await horseRow(listedHorse.id);
    expect(sold.userId).toBe(buyer.id);
    // Nothing that identifies an item survives on the buyer's horse.
    for (const key of ['saddle', 'bridle', 'halter', 'saddle_pad', 'girth', 'reins']) {
      expect(sold.tack[key]).toBeUndefined();
    }
    expect(sold.tack.decorations ?? []).toEqual([]);
    // The derived scoring mirrors go with the items that produced them.
    expect(sold.tack.saddleBonus).toBeUndefined();
    expect(sold.tack.bridleBonus).toBeUndefined();

    const inventory = await sellerInventory(seller.id);
    for (const itemId of [INVENTORY_SADDLE, SHOP_HALTER, SHOP_DECORATION]) {
      const records = recordsFor(inventory, itemId);
      expect(records).toHaveLength(1);
      expect(records[0].equippedToHorseId).toBeNull();
    }
    // Inventory record ids stay unique — a duplicate id is an unreachable item
    // (`equipItem` addresses records by `findIndex`).
    const ids = inventory.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  }, 90000);

  it('leaves the horse’s tack and the seller’s inventory untouched when the purchase is rejected', async () => {
    expect((await purchaseTackRequest(seller.token, keptHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    const saddleRecord = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE);
    expect((await equipRequest(seller.token, saddleRecord.id, listedHorse.id)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_HALTER)).status).toBe(200);

    const tackBefore = (await horseRow(listedHorse.id)).tack;
    const inventoryBefore = await sellerInventory(seller.id);

    const brokeBuyer = await makeUser('broke', 1);
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: brokeBuyer.id } }), 'brokeNotification');
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: brokeBuyer.id } }), 'brokeTransaction');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: brokeBuyer.id } }), 'brokeBuyer');

    expect((await buyRequest(brokeBuyer.token, listedHorse.id)).status).toBe(400);

    // Both representations roll back together with the money move.
    const after = await horseRow(listedHorse.id);
    expect(after.userId).toBe(seller.id);
    expect(after.tack).toEqual(tackBefore);
    expect(await sellerInventory(seller.id)).toEqual(inventoryBefore);
  }, 90000);

  it('does not erase an equip the seller committed while the purchase was in flight', async () => {
    // Both provenances present, plus a SPARE bridle the seller is free to move.
    expect((await purchaseTackRequest(seller.token, listedHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, keptHorse.id, SPARE_BRIDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    expect(seeded.status).toBe(200);
    const saddleRecordId = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE).id;
    const bridleRecordId = seeded.body.data.items.find(i => i.itemId === SPARE_BRIDLE).id;
    expect(
      (await unequipRequest(seller.token, bridleRecordId)).status,
      // Free the bridle so the racing action is an ordinary equip.
    ).toBe(200);

    const barrier = armBarrierFor(buyer.id);
    let purchase;
    let equipStatus;
    try {
      purchase = buySettled(buyer.token, listedHorse.id);
      await waitFor(barrier.reached, 'the buyer to read the listing');

      // The seller equips the spare bridle on a horse they still own, and it
      // COMMITS, in the window between the buyer's listing read and the buyer's
      // money move. The sale therefore must not compute the seller's new
      // inventory from anything it read before that window.
      equipStatus = (await equipRequest(seller.token, bridleRecordId, keptHorse.id)).status;
    } finally {
      barrier.release();
      barrier.disarm();
    }

    const bought = await purchase;
    expect(bought.status).toBe(200);
    expect(equipStatus).toBe(200);

    const inventory = await sellerInventory(seller.id);
    // The sale's own change: the sold horse's saddle is released ...
    expect(inventory.find(i => i.id === saddleRecordId).equippedToHorseId).toBeNull();
    // ... and the seller's committed equip survives it (the Finding 1 defect
    // would have rewritten the array from the pre-equip snapshot).
    expect(inventory.find(i => i.id === bridleRecordId).equippedToHorseId).toBe(keptHorse.id);
    expect((await horseRow(keptHorse.id)).tack.bridle).toBe(SPARE_BRIDLE);

    const sold = await horseRow(listedHorse.id);
    expect(sold.userId).toBe(buyer.id);
    expect(sold.tack.saddle).toBeUndefined();
  }, 120000);

  it('strips an orphaned bonus mirror, so the buyer inherits no free scoring bonus', async () => {
    // The orphan state, seeded exactly as live rows carry it: `unequipItem`
    // used to delete the ITEM key and leave the mirror behind (shop-buy a
    // saddle -> GET /api/inventory seeds the record -> unequip). That is fixed
    // now, but rows created before the fix still look like this, and
    // `resolveTackBonus` short-circuits on ANY numeric mirror — a horse holding
    // only `{ saddleBonus: 5 }` scores +5 in every ridden competition with
    // nothing on its back.
    await prisma.horse.update({
      where: { id: listedHorse.id },
      data: { tack: { saddleBonus: 5, bridleBonus: 4 } },
    });
    expect(resolveTackBonus((await horseRow(listedHorse.id)).tack)).toEqual({
      saddleBonus: 5,
      bridleBonus: 4,
      presenceBonus: 0,
    });
    const inventoryBefore = await sellerInventory(seller.id);

    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    // Nothing was released and nothing derived — there were no items — so this
    // also pins that the horse write is decided independently of the inventory
    // write. An early return here is what left the mirror on the buyer's horse.
    const sold = await horseRow(listedHorse.id);
    expect(sold.userId).toBe(buyer.id);
    expect(sold.tack.saddleBonus).toBeUndefined();
    expect(sold.tack.bridleBonus).toBeUndefined();
    expect(resolveTackBonus(sold.tack)).toEqual({
      saddleBonus: 0,
      bridleBonus: 0,
      presenceBonus: 0,
    });
    // A mirror is not an item: nothing is invented in the seller's inventory.
    expect(await sellerInventory(seller.id)).toEqual(inventoryBefore);
  }, 90000);

  it('rolls the tack return back when the purchase fails AFTER the reconciliation', async () => {
    expect((await purchaseTackRequest(seller.token, keptHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    const saddleRecordId = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE).id;
    expect((await equipRequest(seller.token, saddleRecordId, listedHorse.id)).status).toBe(200);
    expect((await purchaseTackRequest(seller.token, listedHorse.id, SHOP_HALTER)).status).toBe(200);

    const tackBefore = (await horseRow(listedHorse.id)).tack;
    const inventoryBefore = await sellerInventory(seller.id);
    const sellerMoneyBefore = (await userRow(seller.id)).money;
    const buyerMoneyBefore = (await userRow(buyer.id)).money;

    const marker = `TestFixture-6p398-12-abort-${tag()}`;
    let bought;
    try {
      armAbortAfterReconciliation(listedHorse.id, marker);
      bought = await buyRequest(buyer.token, listedHorse.id);
    } finally {
      setMarketplaceRaceBarrier(null);
    }

    // An injected fault carries no statusCode, so buyHorse's catch answers 500.
    // The status is not the point; the persisted state is.
    expect(bought.status).toBe(500);

    const after = await horseRow(listedHorse.id);
    expect(after.userId).toBe(seller.id);
    expect(after.tack).toEqual(tackBefore);
    expect(await sellerInventory(seller.id)).toEqual(inventoryBefore);
    expect((await userRow(seller.id)).money).toBe(sellerMoneyBefore);
    expect((await userRow(buyer.id)).money).toBe(buyerMoneyBefore);
    expect(await prisma.horseSale.count({ where: { horseId: listedHorse.id } })).toBe(0);
    expect(
      await prisma.userTransaction.count({
        where: {
          userId: { in: [seller.id, buyer.id] },
          category: { in: ['marketplace_sale', 'marketplace_purchase'] },
        },
      }),
    ).toBe(0);

    // The listing survives intact, so the sale can simply be retried.
    const relisted = await prisma.horse.findUnique({
      where: { id: listedHorse.id },
      select: { forSale: true, salePrice: true },
    });
    expect(relisted.forSale).toBe(true);
    expect(relisted.salePrice).toBe(LIST_PRICE);
  }, 90000);

  it('leaves the former owner with nothing to unequip once the sale returned the item', async () => {
    expect((await purchaseTackRequest(seller.token, keptHorse.id, INVENTORY_SADDLE)).status).toBe(200);
    const seeded = await getInventoryRequest(seller.token);
    const saddleRecordId = seeded.body.data.items.find(i => i.itemId === INVENTORY_SADDLE).id;
    expect((await equipRequest(seller.token, saddleRecordId, listedHorse.id)).status).toBe(200);

    expect((await buyRequest(buyer.token, listedHorse.id)).status).toBe(200);

    const tackAfterSale = (await horseRow(listedHorse.id)).tack;
    const inventoryAfterSale = await sellerInventory(seller.id);

    // The Task-1 residual: unequip used to be the former owner's only handle on
    // a sold horse, and it cleared the record while leaving the item on the
    // stranger's horse. The sale has already returned it, so the two
    // representations agree and there is nothing left to unequip.
    const rejected = await unequipRequest(seller.token, saddleRecordId);
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toBe('Item is not currently equipped');

    const settled = await horseRow(listedHorse.id);
    expect(settled.tack).toEqual(tackAfterSale);
    expect(settled.userId).toBe(buyer.id);
    expect(await sellerInventory(seller.id)).toEqual(inventoryAfterSale);
  }, 90000);
});
