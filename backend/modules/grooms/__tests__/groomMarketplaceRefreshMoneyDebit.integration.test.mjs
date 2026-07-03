/**
 * groomMarketplaceController.refreshMarketplace money-debit hardening sentinel
 * (Equoria-t7ywe).
 *
 * The defect class (P1 MONEY): the premium (`force`) groom-marketplace refresh
 * charged the user with a BARE `prisma.user.update({ money: { decrement } })`
 * against the autocommit singleton — NOT atomic with the
 * `staffMarketplaceState.upsert`, and with no `WHERE money >= cost` predicate.
 * Consequences:
 *   - TOCTOU: two concurrent force-refreshes both pass the pre-check and both
 *     decrement -> negative balance / double-spend.
 *   - Charge-without-refresh: the debit autocommits; if the SEPARATE upsert
 *     then fails, the user is charged for nothing.
 *   - Off-ledger: no ledger row, no SYSTEM_ACCOUNT_BURN pairing -> breaks
 *     conservation (total = sum(User.money) + sum(SystemAccount.balance)).
 *
 * The fix mirrors the hardened siblings refreshTrainerMarketplace /
 * refreshRiderMarketplace (Equoria-t65fh): the conditional debit and the
 * upsert run in ONE `prisma.$transaction` via `debitMoneyOrThrow` (atomic
 * `updateMany where money >= cost` predicate + paired burn credit), a principal
 * `recordTransactionTx` debit row is written in the same tx, and
 * InsufficientFundsError -> 400.
 *
 * THIS SENTINEL asserts (fails-first against the un-hardened code):
 *   1. Concurrency/TOCTOU: two concurrent force-refreshes with money for ONE ->
 *      exactly one 200, wallet never negative, burn credited once + one
 *      principal debit row for the winner.
 *   2. Money conservation: a single paid refresh moves exactly the refresh cost
 *      from the wallet to burn, with the paired ledger rows.
 *   3. Atomicity (no charge-without-refresh): when the upsert fails AFTER the
 *      debit (forced via a REAL int4-overflow on refreshCount — no mocks), the
 *      whole tx rolls back and the user is NOT charged.
 *
 * Why red on the un-hardened code:
 *   - Case 1: the bare autocommit decrement double-spends -> two 200s, wallet
 *     negative.
 *   - Case 2: the old path writes NO groom_marketplace_refresh(/_burn) row and
 *     credits burn ZERO.
 *   - Case 3: the old debit autocommits BEFORE the separate upsert, so when the
 *     upsert overflows the user is already charged (wallet down by the cost).
 *
 * Isolation note: the `burn` SystemAccount row is SHARED across suites. Per the
 * kl16c pattern, conservation is proven via values THIS suite owns — the user's
 * money delta and the user-attributed paired ledger rows — never an absolute
 * burn total.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { refreshMarketplace } from '../controllers/groomMarketplaceController.mjs';
import { MARKETPLACE_CONFIG } from '../services/groomMarketplace.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-t7ywe-groom';
const STAFF_TYPE = 'groom';
const REFRESH_COST = MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST; // 100
const PG_MAX_INT4 = 2147483647;

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

async function makeUser(money) {
  const tag = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'T7ywe',
      lastName: 'Groom',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

/**
 * Seed a groom marketplace state whose lastRefresh is "now" so the next refresh
 * is a PAID refresh (getRefreshCost returns PREMIUM_REFRESH_COST). refreshCount
 * lets us force an int4-overflow on the upsert for the atomicity test.
 */
async function seedPaidRefreshState(userId, refreshCount = 0) {
  return prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    create: {
      userId,
      staffType: STAFF_TYPE,
      offers: [],
      lastRefresh: new Date(),
      refreshCount,
    },
    update: { lastRefresh: new Date(), refreshCount },
  });
}

async function userMoney(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row?.money ?? 0);
}

async function burnBalance() {
  const row = await prisma.systemAccount.findUnique({
    where: { name: SYSTEM_ACCOUNT_BURN },
    select: { balance: true },
  });
  return Number(row?.balance ?? 0);
}

afterAll(async () => {
  if (createdUserIds.length) {
    // staffMarketplaceState + userTransaction cascade off the user, but delete
    // explicitly (scoped to this suite's ids) to be robust.
    await prisma.staffMarketplaceState
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] staffMarketplaceState: ${err.message}`));
    await prisma.groom
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] groom: ${err.message}`));
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
}, 30000);

describe('groomMarketplaceController.refreshMarketplace money-debit hardening (Equoria-t7ywe)', () => {
  it('SENTINEL: two concurrent force-refreshes with money for ONE — exactly one 200, wallet never negative, burn credited once', async () => {
    const buyer = await makeUser(REFRESH_COST); // exactly one paid refresh
    await seedPaidRefreshState(buyer.id, 0);

    const responses = await Promise.all(
      [0, 1].map(() => {
        const res = fakeRes();
        return refreshMarketplace({ user: { id: buyer.id }, body: { force: true } }, res).then(() => res);
      }),
    );

    const successes = responses.filter(r => r.statusCode === 200);
    const failures = responses.filter(r => r.statusCode !== 200);

    // Exactly one paid refresh may win when the wallet only covers one.
    expect(successes.length).toBe(1);
    // Every loser is a client error (400 insufficient funds), never a 5xx.
    for (const f of failures) {
      expect(f.statusCode).toBeGreaterThanOrEqual(400);
      expect(f.statusCode).toBeLessThan(500);
    }

    // Wallet never negative; the single winner drained it to exactly 0.
    const moneyAfter = await userMoney(buyer.id);
    expect(moneyAfter).toBeGreaterThanOrEqual(0);
    expect(moneyAfter).toBe(0);

    // Burn credited exactly ONCE + exactly one principal debit row for the
    // winner (concurrency-proof "no off-ledger, no double-burn" signal).
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_marketplace_refresh' },
    });
    expect(debitRows).toHaveLength(1);
    expect(debitRows[0].type).toBe('debit');
    expect(debitRows[0].amount).toBe(REFRESH_COST);

    const burnCreditRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_marketplace_refresh_burn' },
    });
    expect(burnCreditRows).toHaveLength(1);
    expect(burnCreditRows[0].type).toBe('credit');
    expect(burnCreditRows[0].amount).toBe(REFRESH_COST);
    expect(burnCreditRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
    expect(burnCreditRows[0].metadata?.systemAccountSide).toBe('credit');
  });

  it('MONEY CONSERVATION: a paid refresh moves exactly the cost from wallet to burn, with paired ledger rows', async () => {
    const buyer = await makeUser(REFRESH_COST * 3);
    await seedPaidRefreshState(buyer.id, 0);

    const moneyBefore = await userMoney(buyer.id);
    const burnBefore = await burnBalance();

    const res = fakeRes();
    await refreshMarketplace({ user: { id: buyer.id }, body: { force: true } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.paidRefresh).toBe(true);

    const moneyAfter = await userMoney(buyer.id);
    const burnAfter = await burnBalance();

    // The user lost exactly the refresh cost (owned solely by this suite).
    expect(moneyBefore - moneyAfter).toBe(REFRESH_COST);
    // Conservation: the money landed in burn (>= because burn is shared).
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(REFRESH_COST);

    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_marketplace_refresh' },
    });
    expect(debitRows).toHaveLength(1);
    expect(debitRows[0].type).toBe('debit');
    expect(debitRows[0].amount).toBe(REFRESH_COST);
    expect(Number(debitRows[0].balanceAfter)).toBe(moneyBefore - REFRESH_COST);

    const burnCreditRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_marketplace_refresh_burn' },
    });
    expect(burnCreditRows).toHaveLength(1);
    expect(burnCreditRows[0].type).toBe('credit');
    expect(burnCreditRows[0].amount).toBe(REFRESH_COST);
    expect(burnCreditRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
  });

  it('ATOMICITY: upsert failure AFTER the debit rolls back the charge (no charge-without-refresh)', async () => {
    // Seed refreshCount at PG int4 max so the controller computes
    // refreshCount + 1 = 2147483648 and the upsert throws "integer out of
    // range" INSIDE the tx, AFTER debitMoneyOrThrow. A real DB constraint, no
    // mock. On the hardened path the whole tx rolls back -> user NOT charged.
    const buyer = await makeUser(REFRESH_COST * 5);
    await seedPaidRefreshState(buyer.id, PG_MAX_INT4);

    const moneyBefore = await userMoney(buyer.id);

    const res = fakeRes();
    await refreshMarketplace({ user: { id: buyer.id }, body: { force: true } }, res);

    // The refresh did NOT succeed (the upsert genuinely failed).
    expect(res.statusCode).not.toBe(200);

    // The charge rolled back with the failed upsert — wallet untouched.
    expect(await userMoney(buyer.id)).toBe(moneyBefore);

    // No ledger rows persisted (debit + burn credit both rolled back).
    const ledgerRows = await prisma.userTransaction.findMany({
      where: {
        userId: buyer.id,
        category: { in: ['groom_marketplace_refresh', 'groom_marketplace_refresh_burn'] },
      },
    });
    expect(ledgerRows).toHaveLength(0);
  });
});
