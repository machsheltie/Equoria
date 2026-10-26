/**
 * Tack purchase lost-update regression (Equoria-bvddn.14).
 *
 * Defect: purchaseTackItem built the new `horse.tack` object from a read taken
 * BEFORE its transaction, then wrote it by horse id inside the transaction.
 * Concurrent purchases for one horse serialise on the owner's User row (the
 * debit), but each then writes its own stale copy — the last write wins. The
 * player pays for every item and keeps only one.
 *
 * Owner ruling 2026-10-26 (q78, Equoria-dslww): a purchase now adds a record to
 * the owner's inventory array instead of writing a horse. The same lost-update
 * hazard applies to that array (a stale copy would drop a sibling's record), so
 * the test keeps proving it: concurrent purchases are all charged AND all kept.
 *
 * Real controller, real DB, concurrent calls (same controller-direct pattern
 * as tackPurchaseConcurrentRace — avoids the HTTP CSRF flake Equoria-pyz4z).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { purchaseTackItem, TACK_INVENTORY } from '../controllers/tackShopController.mjs';

const FIXTURE_PREFIX = 'TestFixture-bvddn14-tack';
const STARTING_MONEY = 1_000_000;
const ROUNDS = 3;

let user;
const createdUserIds = [];

const firstOf = category => TACK_INVENTORY.find(i => i.category === category && !i.isLegacyAlias);
const decoratives = () => TACK_INVENTORY.filter(i => i.category === 'decorative' && !i.isLegacyAlias);

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      res.statusCode = c;
      return res;
    },
    json(b) {
      res.body = b;
      return res;
    },
  };
  return res;
}

async function resetInventory() {
  await prisma.user.update({ where: { id: user.id }, data: { settings: { inventory: [] } } });
}

async function inventoryItemIds() {
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
  return (row.settings?.inventory ?? []).map(r => r.itemId);
}

function buy(itemId) {
  const res = fakeRes();
  const req = { user: { id: user.id }, body: { itemId } };
  return purchaseTackItem(req, res).then(() => res);
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Tack',
      lastName: 'LostUpdate',
      money: STARTING_MONEY,
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  await prisma.userTransaction.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}, 30000);

describe('purchaseTackItem concurrent purchases by one owner (Equoria-bvddn.14)', () => {
  it('saddle + bridle bought at once: both charged AND both kept', async () => {
    const saddle = firstOf('saddle');
    const bridle = firstOf('bridle');
    expect(saddle).toBeDefined();
    expect(bridle).toBeDefined();

    for (let round = 0; round < ROUNDS; round++) {
      await resetInventory();
      const moneyBefore = Number(
        (await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money,
      );

      const responses = await Promise.all([buy(saddle.id), buy(bridle.id)]);
      expect(responses.map(r => r.statusCode)).toEqual([200, 200]);

      const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
      expect(Number(after.money)).toBe(moneyBefore - saddle.cost - bridle.cost);

      expect((await inventoryItemIds()).sort()).toEqual([saddle.id, bridle.id].sort());
    }
  });

  it('two decorations bought at once: both kept in the inventory', async () => {
    const [decoA, decoB] = decoratives();
    expect(decoA).toBeDefined();
    expect(decoB).toBeDefined();

    for (let round = 0; round < ROUNDS; round++) {
      await resetInventory();
      const responses = await Promise.all([buy(decoA.id), buy(decoB.id)]);
      expect(responses.map(r => r.statusCode)).toEqual([200, 200]);

      expect((await inventoryItemIds()).sort()).toEqual([decoA.id, decoB.id].sort());
    }
  });
});
