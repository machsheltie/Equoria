/**
 * Fee-settlement decrement-semantics sentinel (Equoria-8pb6w, cluster 2 half 2).
 *
 * DEFECT: settleShowFeeEscrow (extracted from executeClosedShows) read
 * `feeEscrow` fresh, paid the creator that amount, then wrote
 * `feeEscrow: 0` (ABSOLUTE) instead of `{ decrement: <read amount> }`. Any
 * feeEscrow increment that raced in between the read and the write was ERASED —
 * the per-show reconciliation invariant (SystemAccount[show_escrow].balance ==
 * SUM(prizeEscrow + feeEscrow) of open shows) breaks and money is stranded.
 *
 * THE FIX writes `feeEscrow: { decrement: settled.feeEscrow }` so the column is
 * reduced by exactly what was settled, computed RELATIVE at write time; a
 * concurrent increment survives as the residual.
 *
 * DETERMINISM (no flaky concurrency): settleShowFeeEscrow accepts an injectable
 * Prisma client. We pass a `$extends`-wrapped client whose `show.findUnique`
 * (the settlement's fresh read) performs a REAL feeEscrow increment on the base
 * client immediately AFTER returning the read row — reproducing, with zero
 * timing dependence, an entry that committed between the settlement read and
 * the settlement write. The read value the settler decrements by is the
 * pre-increment amount; the residual must remain.
 *
 * SENTINEL-POSITIVE: against the absolute `feeEscrow: 0` code the residual is
 * wiped to 0 and this fails; against the decrement fix the residual (50)
 * remains. Real DB, no mocks, scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { SYSTEM_ACCOUNT_SHOW_ESCROW, creditSystemAccount } from '../../economy/index.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { settleShowFeeEscrow } from '../shows/showEscrowTx.mjs';

const PREFIX = 'TestFixture-8pb6w-settle';
const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

const SETTLED_AMOUNT = 100; // feeEscrow at settlement-read time
const RACED_INCREMENT = 50; // an entry that commits between read and write

let creator;
const userIds = [];
const showIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  creator = await prisma.user.create({
    data: {
      username: `${PREFIX}-creator-${uid()}`.slice(0, 30),
      email: `${PREFIX}-creator-${uid()}@test.com`,
      password: 'irrelevant-hash',
      firstName: 'Settle',
      lastName: 'Creator',
      money: 10000,
    },
  });
  userIds.push(creator.id);

  cleanup.add(async () => {
    for (const id of showIds) {
      await prisma.show.delete({ where: { id } });
    }
  }, 'shows');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransactions');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('settleShowFeeEscrow — decrement, not absolute-zero (Equoria-8pb6w)', () => {
  it('SENTINEL: a feeEscrow increment racing between settlement read and write is preserved', async () => {
    // Show whose feeEscrow == SETTLED_AMOUNT, owned by a live creator.
    const show = await prisma.show.create({
      data: {
        name: `${PREFIX}-show-${uid()}`,
        discipline: 'Dressage',
        entryFee: SETTLED_AMOUNT,
        maxEntries: null,
        levelMin: 1,
        levelMax: 999,
        prize: 1000,
        runDate: new Date(Date.now() - 60 * 60 * 1000),
        closeDate: new Date(Date.now() - 60 * 60 * 1000),
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        status: 'completed',
        createdByUserId: creator.id,
        prizeEscrow: 0,
        feeEscrow: SETTLED_AMOUNT,
      },
    });
    showIds.push(show.id);

    // Fund SystemAccount[show_escrow] so the settlement debit (== read amount)
    // succeeds regardless of the shared row's starting balance. Delta-based:
    // we credit exactly SETTLED_AMOUNT and settlement debits it back.
    await creditSystemAccount(prisma, SYSTEM_ACCOUNT_SHOW_ESCROW, SETTLED_AMOUNT, {
      category: 'test_seed_escrow',
    });

    const creatorBefore = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });

    // Injectable client: on the settlement's fresh feeEscrow read, interpose a
    // REAL increment (a raced entry) on the base client AFTER returning the row.
    let injected = false;
    const injectingClient = prisma.$extends({
      query: {
        show: {
          async findUnique({ args, query }) {
            const result = await query(args);
            if (!injected) {
              injected = true;
              await prisma.show.update({
                where: { id: show.id },
                data: { feeEscrow: { increment: RACED_INCREMENT } },
              });
            }
            return result;
          },
        },
      },
    });

    await settleShowFeeEscrow(show.id, injectingClient);

    const showAfter = await prisma.show.findUnique({
      where: { id: show.id },
      select: { feeEscrow: true },
    });
    const creatorAfter = await prisma.user.findUnique({
      where: { id: creator.id },
      select: { money: true },
    });

    // THE BUG GUARD: the raced increment survives as the residual. Absolute
    // `feeEscrow: 0` would wipe it to 0.
    expect(Number(showAfter.feeEscrow)).toBe(RACED_INCREMENT);
    // Settlement paid the creator exactly what it read (SETTLED_AMOUNT), not
    // the post-increment total — the residual stays escrowed for a later pass.
    expect(Number(creatorAfter.money)).toBe(Number(creatorBefore.money) + SETTLED_AMOUNT);
  });
});
