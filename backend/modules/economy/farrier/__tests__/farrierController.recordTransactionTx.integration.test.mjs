/**
 * farrierController — recordTransactionTx migration sentinel (Equoria-u9mw9).
 *
 * Sentinel-positive integration test for the Equoria-pqp69 migration of
 * bookFarrierService from recordTransaction(opts, tx) to
 * recordTransactionTx(tx, opts).
 *
 * What this test PROVES (the load-bearing assertions):
 *   1. A `farrier_service` debit row is persisted under the same tx as the
 *      money debit + horse update.
 *   2. `balanceAfter` on the persisted row equals the user's money AFTER
 *      the debit. Pre-migration the caller passed `userUpdate.money`
 *      (the moneyAfter from debitMoneyOrThrow); post-migration
 *      recordTransactionTx reads it internally via tx.user.findUnique.
 *      Both paths honor the same invariant — "balanceAfter equals
 *      post-debit balance".
 *   3. The InsufficientFundsError path leaves NO ledger row. This proves
 *      the recordTransactionTx call is INSIDE the tx (rollback parity).
 *      If a future regression moved it outside the tx, a successful
 *      ledger row would persist while the horse update rolled back.
 *
 * Real DB only. No mocks. Scoped TestFixture- prefix + scoped cleanup.
 * Mirrors the Equoria-4539b crafting sentinel pattern.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
import { bookFarrierService, FARRIER_SERVICES } from '../controllers/farrierController.mjs';

const FIXTURE_PREFIX = 'TestFixture-u9mw9-farrier-tx';

const service = FARRIER_SERVICES[0]; // hoof-trim, cost 80
const createdUserIds = [];
const createdHorseIds = [];

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

async function makeFarrierFixture(money) {
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
    },
  });
  createdUserIds.push(u.id);

  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: u.id,
      healthStatus: 'healthy',
    },
  });
  createdHorseIds.push(h.id);

  return { user: u, horse: h };
}

afterEach(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
  }
});

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] horse: ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
}, 30000);

describe('farrierController.bookFarrierService — recordTransactionTx migration (Equoria-u9mw9)', () => {
  it('SENTINEL: writes a farrier_service debit ledger row inside the same tx, balanceAfter sourced internally', async () => {
    const startMoney = service.cost + 1000;
    const { user, horse } = await makeFarrierFixture(startMoney);

    const req = { user: { id: user.id }, body: { horseId: horse.id, serviceId: service.id } };
    const res = fakeRes();
    await bookFarrierService(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);

    // 1. The ledger row exists, attached to this user, category 'farrier_service'.
    const rows = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'farrier_service' },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('debit');
    expect(Number(rows[0].amount)).toBe(service.cost);

    // 2. balanceAfter is the post-debit balance. Pre-migration the caller
    //    supplied this; post-migration recordTransactionTx reads it inside
    //    the tx via tx.user.findUnique. Both honor the same invariant.
    const expectedBalanceAfter = startMoney - service.cost;
    expect(Number(rows[0].balanceAfter)).toBe(expectedBalanceAfter);

    // 3. Sanity: user.money actually reflects the debit.
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(refreshed.money)).toBe(expectedBalanceAfter);
  });

  it('SENTINEL: InsufficientFundsError rollback path leaves NO ledger row (recordTransactionTx is inside tx)', async () => {
    // User has LESS than service.cost — debitMoneyOrThrow throws
    // InsufficientFundsError, the tx rolls back, and no ledger row persists.
    // If a future regression moved recordTransactionTx outside the tx, this
    // test would catch an orphan ledger row.
    const startMoney = service.cost - 1;
    const { user, horse } = await makeFarrierFixture(startMoney);

    // Snapshot horse fields to verify rollback parity below.
    const horseBefore = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { lastFarrierDate: true, hoofCondition: true, lastShod: true },
    });

    const req = { user: { id: user.id }, body: { horseId: horse.id, serviceId: service.id } };
    const res = fakeRes();
    await bookFarrierService(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);

    // The bug guard: no row was written.
    const rows = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'farrier_service' },
    });
    expect(rows).toHaveLength(0);

    // User's money unchanged (the debit also rolled back).
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    expect(Number(refreshed.money)).toBe(startMoney);

    // Horse fields also rolled back (proves the horse.update + ledger row
    // share tx state via the recordTransactionTx tx-first signature).
    const horseAfter = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { lastFarrierDate: true, hoofCondition: true, lastShod: true },
    });
    expect(horseAfter.lastFarrierDate).toEqual(horseBefore.lastFarrierDate);
    expect(horseAfter.hoofCondition).toEqual(horseBefore.hoofCondition);
    expect(horseAfter.lastShod).toEqual(horseBefore.lastShod);
  });
});
