/**
 * debitMoneyOrThrow money-conservation sentinel (Equoria-kl16c / kz86s).
 *
 * The defect class this guards: pre-kl16c, `debitMoneyOrThrow` decremented a
 * user's money WITHOUT crediting any counterparty. Every sink that called it
 * (the hjtys audit found 13: crafting, farrier, vet, tack shop, feed shop,
 * trainer hire, rider hire, groom hire, store-horse purchase, groom salary,
 * and the marketplace refreshes) destroyed money from the in-game economy
 * invisibly to the conservation invariant
 *   total = sum(User.money) + sum(SystemAccount.balance)
 * A bug elsewhere that silently drained a wallet would be indistinguishable
 * from a legitimate purchase under that ledger.
 *
 * The kl16c fix makes `systemAccount` + `category` REQUIRED on
 * `debitMoneyOrThrow` and PAIRS a `creditSystemAccount` in the same client,
 * so the money that leaves the wallet lands in a named SystemAccount and the
 * invariant holds across the move.
 *
 * THIS SENTINEL asserts:
 *   1. Conservation: across a paired debit, the user-money decrease is exactly
 *      the amount and a paired credit ledger row is written for the user.
 *   2. Sentinel-positive: a PLANTED unpaired debit (raw decrement, the old
 *      shape) decreases user money but writes NO paired counterparty row —
 *      proving paired vs unpaired is detectable and the conservation pairing
 *      is load-bearing.
 *   3. Required-arg guards: omitting systemAccount or category THROWS (the
 *      unpaired-debit path is structurally inexpressible).
 *   4. Rollback: a parent-tx throw after debitMoneyOrThrow rolls BOTH the
 *      user debit AND the SystemAccount credit back together.
 *   5. Failed-debit atomicity: InsufficientFundsError leaves no orphan credit.
 *
 * Isolation note: the `burn` SystemAccount row is SHARED across suites that
 * also credit it (showEscrow, gdprShowCancel, etc.). To stay robust under
 * parallel workers, conservation is asserted via values this suite OWNS — the
 * user's money delta and the user-attributed paired ledger row — never an
 * absolute burn total (which another suite could shift between reads).
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../modules/economy/services/financialLedgerService.mjs';

const FIXTURE_PREFIX = 'TestFixture-kl16c-conserv';
const createdUserIds = [];

async function makeUser(money) {
  const tag = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Cons',
      lastName: 'Kl16c',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
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
  // Scoped cleanup: only the ids THIS suite created. We do NOT touch the burn
  // SystemAccount balance — other suites share it, and we only ever asserted
  // deltas/per-user audit rows, never absolutes, so each paired debit's credit
  // is a legitimate, audited move we leave in place.
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
}, 30000);

describe('debitMoneyOrThrow money-conservation sentinel (Equoria-kl16c)', () => {
  it('SENTINEL: paired debit conserves — user loses amount, burn gains it, with audit row', async () => {
    const user = await makeUser(1000);

    const userBefore = await userMoney(user.id);
    const burnBefore = await burnBalance();

    await prisma.$transaction(async tx => {
      await debitMoneyOrThrow(tx, {
        userId: user.id,
        amount: 250,
        systemAccount: SYSTEM_ACCOUNT_BURN,
        category: 'kl16c_conservation_test_burn',
        description: 'paired debit conservation test',
        metadata: { test: 'conservation' },
      });
    });

    const userAfter = await userMoney(user.id);
    const burnAfter = await burnBalance();

    // The user lost exactly 250 (this user is owned solely by this suite).
    expect(userBefore - userAfter).toBe(250);
    // Conservation: the money the user lost landed in the burn account. The
    // burn delta is measured tightly around the single op; a concurrent suite
    // could only INFLATE burnAfter, so we assert AT LEAST 250 here and rely on
    // the per-user audit row below for the exact, concurrency-proof signal.
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(250);

    // The load-bearing conservation proof that is immune to concurrency: a
    // paired CREDIT ledger row attributed to THIS user, for exactly 250,
    // tagged with the burn system account. This counterparty row's ABSENCE is
    // the entire defect class kl16c fixes.
    const ledger = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: 'kl16c_conservation_test_burn' },
    });
    expect(ledger.length).toBe(1);
    expect(ledger[0].type).toBe('credit');
    expect(ledger[0].amount).toBe(250);
    expect(ledger[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
    expect(ledger[0].metadata?.systemAccountSide).toBe('credit');
  });

  it('SENTINEL-POSITIVE: a PLANTED unpaired raw decrement writes NO counterparty row', async () => {
    // Proves the paired-credit row above is load-bearing, not incidental. The
    // old (pre-kl16c) shape was a raw `tx.user.update({ decrement })` with NO
    // SystemAccount credit and NO paired ledger row. We reproduce exactly that
    // and assert: user money dropped, but there is NO counterparty audit row —
    // the money vanished untraceably. A regression that dropped the internal
    // pairing from debitMoneyOrThrow would make real sinks look like this.
    const user = await makeUser(1000);
    const PLANTED_CATEGORY = `kl16c_planted_unpaired_${randomBytes(4).toString('hex')}`;

    const userBefore = await userMoney(user.id);

    await prisma.$transaction(async tx => {
      // PLANTED VIOLATION — unpaired user-money decrement (the defect class).
      await tx.user.update({
        where: { id: user.id },
        data: { money: { decrement: 250 } },
      });
      // Intentionally NO creditSystemAccount / debitMoneyOrThrow pairing.
    });

    const userAfter = await userMoney(user.id);

    // Money left the wallet...
    expect(userBefore - userAfter).toBe(250);
    // ...but NO counterparty row exists for it under the planted category...
    const planted = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: PLANTED_CATEGORY },
    });
    expect(planted).toHaveLength(0);
    // ...and this user has NO burn-credit row AT ALL, in contrast to the
    // paired-debit user above who has exactly one. That detectable difference
    // is what conservation auditing depends on.
    const anyCredit = await prisma.userTransaction.findMany({
      where: { userId: user.id, type: 'credit' },
    });
    expect(anyCredit).toHaveLength(0);
  });

  it('throws when systemAccount is omitted (unpaired debit is inexpressible)', async () => {
    const user = await makeUser(1000);
    await expect(
      prisma.$transaction(async tx => debitMoneyOrThrow(tx, { userId: user.id, amount: 100, category: 'x' })),
    ).rejects.toThrow(/systemAccount is required/i);

    // money untouched — the guard threw before any decrement.
    expect(await userMoney(user.id)).toBe(1000);
  });

  it('throws when category is omitted', async () => {
    const user = await makeUser(1000);
    await expect(
      prisma.$transaction(async tx =>
        debitMoneyOrThrow(tx, {
          userId: user.id,
          amount: 100,
          systemAccount: SYSTEM_ACCOUNT_BURN,
        }),
      ),
    ).rejects.toThrow(/category is required/i);

    expect(await userMoney(user.id)).toBe(1000);
  });

  it('SENTINEL: parent-tx rollback rolls back BOTH the user debit and the burn credit', async () => {
    const user = await makeUser(1000);
    const ROLLBACK_CATEGORY = `kl16c_rollback_${randomBytes(4).toString('hex')}`;

    await expect(
      prisma.$transaction(async tx => {
        await debitMoneyOrThrow(tx, {
          userId: user.id,
          amount: 300,
          systemAccount: SYSTEM_ACCOUNT_BURN,
          category: ROLLBACK_CATEGORY,
          description: 'rollback sentinel — should not persist',
        });
        // Force rollback AFTER the paired debit+credit.
        throw new Error('intentional rollback for kl16c');
      }),
    ).rejects.toThrow('intentional rollback for kl16c');

    // The user-money side reverted (owned solely by this suite).
    expect(await userMoney(user.id)).toBe(1000);

    // No paired ledger row survived the rollback (counterparty row gone too) —
    // proving the burn credit rolled back together with the user debit.
    const ledger = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: ROLLBACK_CATEGORY },
    });
    expect(ledger).toHaveLength(0);
  });

  it('throws InsufficientFundsError without crediting burn (no half-move on a failed debit)', async () => {
    const user = await makeUser(50);
    const FAIL_CATEGORY = `kl16c_insufficient_${randomBytes(4).toString('hex')}`;

    await expect(
      prisma.$transaction(async tx =>
        debitMoneyOrThrow(tx, {
          userId: user.id,
          amount: 100, // more than the 50 balance
          systemAccount: SYSTEM_ACCOUNT_BURN,
          category: FAIL_CATEGORY,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    // No credit row was written — the debit predicate failed BEFORE the
    // credit, so there is no orphan counterparty row tied to this user.
    const ledger = await prisma.userTransaction.findMany({
      where: { userId: user.id, category: FAIL_CATEGORY },
    });
    expect(ledger).toHaveLength(0);
    expect(await userMoney(user.id)).toBe(50);
  });
});
