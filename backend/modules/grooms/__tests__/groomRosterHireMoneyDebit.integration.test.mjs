/**
 * groomRosterController.hireGroom money-debit hardening sentinel (Equoria-otii0).
 *
 * The defect class (P1 MONEY): `hireGroom` (direct-hire path) did a
 * `findUnique(money)` pre-check then an UNCONDITIONAL `money: { decrement }`
 * inside the tx (no `WHERE money >= cost` predicate). Two concurrent hires
 * both pass the pre-check and both decrement -> negative balance / double-spend.
 * It also wrote NO ledger row and skipped the SYSTEM_ACCOUNT_BURN pairing,
 * breaking the money-conservation invariant
 *   total = sum(User.money) + sum(SystemAccount.balance).
 *
 * The fix mirrors the already-hardened sibling `hireFromMarketplace`
 * (Equoria-6g8wm / kl16c): the debit runs through `debitMoneyOrThrow` inside
 * the existing `$transaction` (atomic `updateMany where money >= cost`
 * predicate + paired burn credit), and a principal `recordTransactionTx`
 * debit row is written in the same tx. InsufficientFundsError -> 400.
 *
 * THIS SENTINEL asserts (fails-first against the un-hardened code):
 *   1. Concurrency/TOCTOU: two concurrent hires with a wallet for ONE ->
 *      exactly one 201, wallet never negative, exactly one groom created,
 *      and the winner has exactly one groom_hire debit row + one paired
 *      groom_hire_burn credit row (burn credited once).
 *   2. Money conservation: a single successful hire moves exactly `hiringCost`
 *      from the user's wallet to the burn account, with the paired ledger rows.
 *   3. Insufficient funds -> 400 (message mentions funds), no groom created,
 *      no ledger row.
 *
 * Why these are red on the un-hardened code:
 *   - Case 1 with the double-decrement bug: BOTH hires 201, wallet goes
 *     negative, two grooms — and even in the rare serial-timing branch where
 *     only one 201 lands, the OLD code writes ZERO ledger rows / ZERO burn
 *     credit, so the ledger assertions still fail. Timing-independent red.
 *   - Case 2: the OLD code never writes a groom_hire / groom_hire_burn row and
 *     never credits burn -> red.
 *   (Case 3 already returned 400 via the old pre-check; it is a post-fix
 *   regression guard, not the fails-first sentinel.)
 *
 * Isolation note: the `burn` SystemAccount row is SHARED across suites. Per the
 * kl16c pattern, conservation is proven via values THIS suite owns — the user's
 * money delta and the user-attributed paired ledger rows — never an absolute
 * burn total (which a parallel suite could shift between reads).
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireGroom } from '../controllers/groomRosterController.mjs';
import { SKILL_LEVELS } from '../../../utils/groomSystem.mjs';
import { SYSTEM_ACCOUNT_BURN } from '../../economy/index.mjs';

const FIXTURE_PREFIX = 'TestFixture-otii0-groom';

// Mirrors the controller's BASE_HIRING_COST constant (groomRosterController.mjs).
// hiringCost = round(BASE_HIRING_COST * SKILL_LEVELS[skill_level].costModifier).
const BASE_HIRING_COST = 500;
const SKILL_LEVEL = 'expert'; // costModifier 1.5 -> hiringCost 750
const HIRING_COST = Math.round(BASE_HIRING_COST * SKILL_LEVELS[SKILL_LEVEL].costModifier);

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
      firstName: 'Otii0',
      lastName: 'Groom',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

function hireReq(userId, name) {
  return {
    user: { id: userId },
    body: {
      name,
      speciality: 'foal_care',
      skill_level: SKILL_LEVEL,
      personality: 'gentle',
    },
  };
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
  // SystemAccount balance — other suites share it and we only assert deltas /
  // per-user audit rows, never absolutes.
  if (createdUserIds.length) {
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

describe('groomRosterController.hireGroom money-debit hardening (Equoria-otii0)', () => {
  it('SENTINEL: two concurrent hires with money for ONE — exactly one 201, wallet never negative, burn credited once', async () => {
    const buyer = await makeUser(HIRING_COST); // exactly one hire's worth

    const reqs = [
      hireReq(buyer.id, `${FIXTURE_PREFIX}-A-${randomBytes(3).toString('hex')}`),
      hireReq(buyer.id, `${FIXTURE_PREFIX}-B-${randomBytes(3).toString('hex')}`),
    ];

    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return hireGroom(req, res).then(() => res);
      }),
    );

    const successes = responses.filter(r => r.statusCode === 201);
    const failures = responses.filter(r => r.statusCode !== 201);

    // Exactly one hire may win when the wallet only covers one.
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

    // Tx atomicity: exactly one groom row persisted (the loser's create rolled
    // back with its failed debit).
    const groomCount = await prisma.groom.count({ where: { userId: buyer.id } });
    expect(groomCount).toBe(1);

    // Burn credited exactly ONCE + exactly one principal debit row for the
    // winner. This per-user pair is the concurrency-proof "no off-ledger,
    // no double-burn" signal (immune to the shared burn account moving).
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(debitRows[0].type).toBe('debit');
    expect(debitRows[0].amount).toBe(HIRING_COST);

    const burnCreditRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire_burn' },
    });
    expect(burnCreditRows).toHaveLength(1);
    expect(burnCreditRows[0].type).toBe('credit');
    expect(burnCreditRows[0].amount).toBe(HIRING_COST);
    expect(burnCreditRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
    expect(burnCreditRows[0].metadata?.systemAccountSide).toBe('credit');
  });

  it('MONEY CONSERVATION: a successful hire moves exactly hiringCost from wallet to burn, with paired ledger rows', async () => {
    const buyer = await makeUser(HIRING_COST * 3);

    const moneyBefore = await userMoney(buyer.id);
    const burnBefore = await burnBalance();

    const res = fakeRes();
    await hireGroom(hireReq(buyer.id, `${FIXTURE_PREFIX}-C-${randomBytes(3).toString('hex')}`), res);

    expect(res.statusCode).toBe(201);

    const moneyAfter = await userMoney(buyer.id);
    const burnAfter = await burnBalance();

    // The user lost exactly hiringCost (this user is owned solely by this suite).
    expect(moneyBefore - moneyAfter).toBe(HIRING_COST);
    // Conservation: the money the user lost landed in the burn account. Measured
    // tightly around the op; a concurrent suite could only INFLATE burnAfter, so
    // assert AT LEAST hiringCost and rely on the per-user rows for the exact,
    // concurrency-proof signal.
    expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(HIRING_COST);

    // Paired ledger rows attributed to this user: one principal debit + one
    // counterparty burn credit — the rows the un-hardened path never wrote.
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(debitRows[0].type).toBe('debit');
    expect(debitRows[0].amount).toBe(HIRING_COST);
    expect(Number(debitRows[0].balanceAfter)).toBe(moneyBefore - HIRING_COST);

    const burnCreditRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire_burn' },
    });
    expect(burnCreditRows).toHaveLength(1);
    expect(burnCreditRows[0].type).toBe('credit');
    expect(burnCreditRows[0].amount).toBe(HIRING_COST);
    expect(burnCreditRows[0].metadata?.systemAccount).toBe(SYSTEM_ACCOUNT_BURN);
  });

  it('INSUFFICIENT FUNDS: hire with money below cost -> 400 (funds message), no groom, no ledger row', async () => {
    const brokeUser = await makeUser(HIRING_COST - 1); // one coin short

    const res = fakeRes();
    await hireGroom(hireReq(brokeUser.id, `${FIXTURE_PREFIX}-D-${randomBytes(3).toString('hex')}`), res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.message).toMatch(/funds/i);

    // No groom persisted, no ledger rows, wallet untouched.
    const groomCount = await prisma.groom.count({ where: { userId: brokeUser.id } });
    expect(groomCount).toBe(0);
    const ledgerRows = await prisma.userTransaction.findMany({
      where: { userId: brokeUser.id },
    });
    expect(ledgerRows).toHaveLength(0);
    expect(await userMoney(brokeUser.id)).toBe(HIRING_COST - 1);
  });
});
