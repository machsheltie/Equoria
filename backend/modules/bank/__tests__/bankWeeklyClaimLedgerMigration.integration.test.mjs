/**
 * POST /api/v1/bank/claim — recordTransactionTx migration sentinel
 * (Equoria-hw3c8).
 *
 * Per Equoria-pqp69 migration plan: the weekly_reward CREDIT in
 * bankController.claimWeeklyReward was migrated from the legacy
 * `recordTransaction(opts, tx)` signature to
 * `recordTransactionTx(tx, opts)`. The structural guarantee of the new
 * signature is that `balanceAfter` is read inside the same tx by the
 * service — the caller no longer supplies it.
 *
 * This sentinel proves the migration is wired correctly by:
 *
 *   1. Claiming the weekly reward via the controller (no HTTP — dodges
 *      CSRF setup; uses the same pattern as the vet migration sentinel
 *      Equoria-2hfss).
 *   2. Reading back the most recent weekly_reward `userTransaction` row.
 *   3. Asserting `balanceAfter` on the ledger row equals the user's
 *      money column AFTER the credit (starting money + WEEKLY_REWARD).
 *
 * The atomic UPDATE bumps money before recordTransactionTx is called
 * inside the same tx, so the service's balanceAfter read must observe
 * the post-credit balance. If a future regression made the caller pass
 * a stale balanceAfter (computed before the UPDATE landed), the new
 * signature would have made that impossible by construction.
 *
 * Sentinel-positive coverage: also asserts type='credit',
 * amount=WEEKLY_REWARD, category='weekly_reward', and
 * metadata.weekStart matches the current Sunday — so a refactor that
 * drops one of those fields fails loudly.
 *
 * Real DB, no mocks, scoped fixtures (TestFixture-hw3c8 prefix).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { claimWeeklyReward, getCurrentWeekStart } from '../controllers/bankController.mjs';

const FIXTURE_PREFIX = 'TestFixture-hw3c8-bank';
const STARTING_MONEY = 1000;
const WEEKLY_REWARD_AMOUNT = 500;

let user;
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

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);

  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: pw,
      firstName: 'Bank',
      lastName: 'Migration',
      money: STARTING_MONEY,
      settings: {}, // no prior weekly claim → first claim succeeds
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('bank claimWeeklyReward recordTransactionTx migration sentinel (Equoria-hw3c8)', () => {
  it('SENTINEL: ledger row balanceAfter is sourced from inside the tx (post-credit)', async () => {
    const req = {
      user: { id: user.id },
      body: {},
    };
    const res = fakeRes();
    await claimWeeklyReward(req, res);

    // Claim succeeded
    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.amount).toBe(WEEKLY_REWARD_AMOUNT);

    // User money was credited correctly
    const afterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    const expectedMoneyAfter = STARTING_MONEY + WEEKLY_REWARD_AMOUNT;
    expect(Number(afterUser.money)).toBe(expectedMoneyAfter);

    // Ledger row was created with the correct shape — balanceAfter
    // matches the user's money column AFTER the credit, proving
    // recordTransactionTx read inside the same tx (the migration's
    // structural guarantee).
    const ledgerRow = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'weekly_reward' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledgerRow).not.toBeNull();
    expect(ledgerRow.type).toBe('credit');
    expect(Number(ledgerRow.amount)).toBe(WEEKLY_REWARD_AMOUNT);
    expect(ledgerRow.category).toBe('weekly_reward');
    expect(Number(ledgerRow.balanceAfter)).toBe(expectedMoneyAfter);

    const expectedWeekStartISO = getCurrentWeekStart().toISOString();
    expect(ledgerRow.metadata).toMatchObject({
      weekStart: expectedWeekStartISO,
    });
  });
});
