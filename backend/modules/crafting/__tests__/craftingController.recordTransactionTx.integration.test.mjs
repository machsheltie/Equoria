/**
 * craftingController — recordTransactionTx migration sentinel (Equoria-4539b).
 *
 * Sentinel-positive integration test for the Equoria-pqp69 migration of
 * craftItem from recordTransaction(opts, tx) to recordTransactionTx(tx, opts).
 *
 * What this test PROVES (the load-bearing assertions):
 *   1. A `crafting` debit row is persisted under the same tx as the
 *      money debit + settings update.
 *   2. `balanceAfter` on the persisted row equals the user's money AFTER
 *      the debit. Pre-migration the caller passed `moneyAfter` (read by
 *      debitMoneyOrThrow); post-migration recordTransactionTx reads it
 *      internally via tx.user.findUnique. Both paths honor the same
 *      invariant — "balanceAfter equals post-debit balance".
 *   3. The InsufficientFundsError path leaves NO ledger row. This proves
 *      the recordTransactionTx call is INSIDE the tx (rollback parity).
 *      If a future regression moved it outside the tx, a successful
 *      ledger row would persist while the settings update rolled back.
 *
 * Real DB only. No mocks. Scoped TestFixture- prefix + scoped cleanup.
 * Mirrors the Equoria-ye2r3 / Equoria-jmn75 patterns from the trainer +
 * rider marketplace controller migrations.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { craftItem } from '../controllers/craftingController.mjs';
import { CRAFTING_RECIPES } from '../data/craftingRecipes.mjs';

const FIXTURE_PREFIX = 'TestFixture-4539b-craft-tx';

let recipe;
const createdUserIds = [];

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

async function makeCraftingUser(money) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Tx',
      lastName: 'Sentinel',
      money,
      settings: {
        craftingMaterials: {
          leather: 1000,
          cloth: 1000,
          dye: 1000,
          metal: 1000,
          thread: 1000,
        },
        workshopTier: 1,
      },
    },
  });
  createdUserIds.push(u.id);
  return u;
}

beforeAll(async () => {
  recipe = CRAFTING_RECIPES.find(r => r.tier === 0);
  expect(recipe).toBeDefined();
}, 30000);

afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
  }
});

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
}, 30000);

describe('craftingController.craftItem — recordTransactionTx migration (Equoria-4539b)', () => {
  it('SENTINEL: writes a crafting debit ledger row inside the same tx, balanceAfter sourced internally', async () => {
    const startMoney = recipe.cost + 1000;
    const user = await makeCraftingUser(startMoney);

    const req = { user: { id: user.id }, body: { recipeId: recipe.id } };
    const res = fakeRes();
    await craftItem(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);

    // 1. The ledger row exists, attached to this user, category 'crafting'.
    const rows = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'crafting' },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('debit');
    expect(Number(rows[0].amount)).toBe(recipe.cost);

    // 2. balanceAfter is the post-debit balance. Pre-migration the caller
    //    supplied this; post-migration recordTransactionTx reads it inside
    //    the tx via tx.user.findUnique. Both honor the same invariant.
    const expectedBalanceAfter = startMoney - recipe.cost;
    expect(Number(rows[0].balanceAfter)).toBe(expectedBalanceAfter);

    // 3. Sanity: user.money actually reflects the debit.
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(refreshed.money)).toBe(expectedBalanceAfter);
  });

  it('SENTINEL: InsufficientFundsError rollback path leaves NO ledger row (recordTransactionTx is inside tx)', async () => {
    // User has LESS than recipe.cost — debitMoneyOrThrow throws
    // InsufficientFundsError, the tx rolls back, and no ledger row persists.
    // If a future regression moved recordTransactionTx outside the tx, this
    // test would catch an orphan ledger row.
    const user = await makeCraftingUser(recipe.cost - 1);

    const req = { user: { id: user.id }, body: { recipeId: recipe.id } };
    const res = fakeRes();
    await craftItem(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);

    // The bug guard: no row was written.
    const rows = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'crafting' },
    });
    expect(rows).toHaveLength(0);

    // User's money unchanged (the debit also rolled back).
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(refreshed.money)).toBe(recipe.cost - 1);
  });
});
