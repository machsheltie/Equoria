/**
 * groomRosterController.hireGroom roster-cap concurrency sentinel (Equoria-n4m5j).
 *
 * The defect class (P2 CONCURRENCY): the roster-cap guard is a pre-transaction
 * `prisma.groom.count()` followed (much later, outside any lock) by the
 * `groom.create` inside the hire `$transaction`. Two concurrent hires at
 * `MAX_GROOMS_PER_USER - 1` both read the same pre-tx count, both pass the
 * `< MAX` check, and both create — so the server persists `MAX + 1` grooms,
 * silently violating the roster-cap invariant it advertises
 *   COUNT(groom WHERE userId) <= MAX_GROOMS_PER_USER
 * (a server-side rule that must hold under concurrency, not just sequentially).
 *
 * The fix (companion to Equoria-otii0): the Equoria-otii0 debit restructure now
 * runs `debitMoneyOrThrow` inside the tx, whose atomic `updateMany where money
 * >= cost` takes a row lock on the User row — serializing concurrent same-user
 * hires. AFTER that lock, the controller RE-COUNTS the user's grooms inside the
 * same tx and throws a typed `CapExceededError` (-> 400) when the post-create
 * count exceeds `MAX_GROOMS_PER_USER`, rolling back the groom.create + debit
 * together. The pre-tx count is kept only as a fast-path 400.
 *
 * THIS SENTINEL asserts (fails-first against the count-then-create code):
 *   1. Concurrency: user at MAX-1 grooms with a wallet for BOTH hires -> exactly
 *      one 201, final groom count == MAX (never MAX+1), exactly one groom_hire
 *      debit row, and the wallet is charged exactly once (the loser's debit +
 *      create rolled back atomically — no charge-without-slot).
 *   2. Fast-path regression: a user already AT MAX hiring one more -> 400 with
 *      the "maximum limit" message, no groom created, no ledger row, wallet
 *      untouched.
 *
 * Why case 1 is red on the un-fixed code: both concurrent hires read pre-tx
 * count == MAX-1, both pass `< MAX`, both create and both debit (the wallet
 * covers both) -> TWO 201s and a final count of MAX+1. The `expect(successes)
 * .toBe(1)` / `count == MAX` assertions fail. Timing-independent: money is not
 * the limiter here (the cap is), so the only thing that can reject the second
 * hire is a cap guard that survives concurrency.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3). Mirrors the otii0
 * money-debit sentinel's harness.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireGroom } from '../controllers/groomRosterController.mjs';
import { SKILL_LEVELS } from '../../../utils/groomSystem.mjs';

const FIXTURE_PREFIX = 'TestFixture-n4m5j-groom';

// Mirrors the controller's module constants (groomRosterController.mjs:13,16).
// Not exported from the controller; kept in sync here as the otii0 sentinel
// does for BASE_HIRING_COST.
const MAX_GROOMS_PER_USER = 10;
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
      firstName: 'N4m5j',
      lastName: 'Groom',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

// Seed `count` grooms directly for `userId` (bypasses the hire path so the
// wallet is untouched — we are exercising the CAP race, not the money race).
async function seedGrooms(userId, count) {
  for (let i = 0; i < count; i++) {
    await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-seed-${i}-${randomBytes(3).toString('hex')}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId,
      },
    });
  }
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

afterAll(async () => {
  // Scoped cleanup: only the ids THIS suite created.
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

describe('groomRosterController.hireGroom roster-cap concurrency (Equoria-n4m5j)', () => {
  it('SENTINEL: 8 concurrent hires racing for ONE open slot — exactly one 201, count never exceeds MAX, charged once', async () => {
    // Wallet covers all 8 hires: money is NOT the limiter here, the cap is —
    // the ONLY thing that may reject the 7 losers is a cap guard that survives
    // concurrency. Firing 8 simultaneously (vs 2) reliably drives multiple
    // requests past the pre-tx fast-path count at once, opening the TOCTOU
    // window the un-fixed count-then-create leaves; a mere 2 can serialize by
    // luck and hide the race.
    const CONCURRENCY = 8;
    const buyer = await makeUser(HIRING_COST * (CONCURRENCY + 2));
    await seedGrooms(buyer.id, MAX_GROOMS_PER_USER - 1); // 9 grooms -> one slot left

    const moneyBefore = await userMoney(buyer.id);

    const reqs = Array.from({ length: CONCURRENCY }, (_unused, i) =>
      hireReq(buyer.id, `${FIXTURE_PREFIX}-${i}-${randomBytes(3).toString('hex')}`),
    );

    const responses = await Promise.all(
      reqs.map(req => {
        const res = fakeRes();
        return hireGroom(req, res).then(() => res);
      }),
    );

    const successes = responses.filter(r => r.statusCode === 201);
    const failures = responses.filter(r => r.statusCode !== 201);

    // Only one slot was open — exactly one hire may win, regardless of how many
    // raced. The un-fixed code lets several through (final count MAX+k).
    expect(successes.length).toBe(1);

    // Every loser is a cap 400 (client error), never a 5xx, and says so.
    expect(failures.length).toBe(CONCURRENCY - 1);
    for (const f of failures) {
      expect(f.statusCode).toBe(400);
      expect(f.body?.success).toBe(false);
      expect(f.body?.message).toMatch(/maximum limit/i);
    }

    // The invariant that must hold under concurrency: COUNT(groom) <= MAX.
    const groomCount = await prisma.groom.count({ where: { userId: buyer.id } });
    expect(groomCount).toBe(MAX_GROOMS_PER_USER);

    // Charged exactly once — every loser's debit rolled back with its create
    // (no charge-without-slot, no off-ledger burn for the rejected hires).
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(await userMoney(buyer.id)).toBe(moneyBefore - HIRING_COST);
  });

  it('FAST-PATH: hiring while already AT MAX -> 400 maximum-limit, no groom, no charge', async () => {
    const buyer = await makeUser(HIRING_COST * 2);
    await seedGrooms(buyer.id, MAX_GROOMS_PER_USER); // already full

    const moneyBefore = await userMoney(buyer.id);
    const res = fakeRes();
    await hireGroom(hireReq(buyer.id, `${FIXTURE_PREFIX}-full-${randomBytes(3).toString('hex')}`), res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.message).toMatch(/maximum limit/i);

    // No new groom, no ledger row, wallet untouched.
    expect(await prisma.groom.count({ where: { userId: buyer.id } })).toBe(MAX_GROOMS_PER_USER);
    const ledgerRows = await prisma.userTransaction.findMany({ where: { userId: buyer.id } });
    expect(ledgerRows).toHaveLength(0);
    expect(await userMoney(buyer.id)).toBe(moneyBefore);
  });
});
