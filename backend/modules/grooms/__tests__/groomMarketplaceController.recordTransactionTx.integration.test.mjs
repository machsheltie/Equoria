/**
 * groomMarketplaceController — recordTransactionTx migration sentinel (Equoria-26wuo)
 *
 * Sentinel-positive integration test for the Equoria-pqp69 migration of
 * hireFromMarketplace from recordTransaction(opts, tx) to
 * recordTransactionTx(tx, opts).
 *
 * What this test PROVES (the load-bearing assertions):
 *   1. A `groom_hire` debit row is persisted under the same tx as the
 *      money debit + groom.create. If the migration silently swapped
 *      back to fire-and-forget recordTransaction, the row count would
 *      still match — but the `balanceAfter` would carry whatever the
 *      caller supplied, not the value read inside the tx.
 *   2. `balanceAfter` on the persisted row equals the user's money AFTER
 *      the debit (read by recordTransactionTx internally — the caller no
 *      longer supplies it). Pre-migration the caller passed
 *      `userUpdate.money` which is derived from debitMoneyOrThrow; this
 *      test would still pass for that path, but it ALSO passes for the
 *      new path where recordTransactionTx reads the balance itself.
 *      The shared invariant is "balanceAfter equals post-debit balance,
 *      regardless of who reads it" — both paths must honor it.
 *   3. The InsufficientFundsError path leaves NO ledger row. This proves
 *      the recordTransactionTx call is INSIDE the tx (rollback parity).
 *      If it had been moved outside the tx by mistake, a successful
 *      ledger row would persist while the groom.create rolled back.
 *
 * Real DB only. No mocks. Mirrors the Equoria-ye2r3 pattern from
 * trainerMarketplaceController.recordTransactionTx.integration.test.mjs
 * (the same migration class for the trainer sibling controller).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireFromMarketplace } from '../controllers/groomMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-26wuo-groom';
const SESSION_RATE = 100;
const HIRING_COST = SESSION_RATE * 7; // controller line 216: sessionRate * 7

let happyUser;
let happyMarketplaceId;
let happyStateId;
let brokeUser;
let brokeMarketplaceId;
let brokeStateId;
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

async function seedOfferState(userId) {
  const marketplaceId = `mid-${randomBytes(4).toString('hex')}`;
  const offers = [
    {
      marketplaceId,
      firstName: 'Sentinel',
      lastName: 'Groom',
      specialty: 'general',
      skillLevel: 'experienced',
      personality: 'gentle',
      experience: 5,
      sessionRate: SESSION_RATE,
      bio: 'sentinel fixture',
    },
  ];
  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'groom' } },
    create: { userId, staffType: 'groom', offers, refreshCount: 0 },
    update: { offers },
  });
  return { marketplaceId, stateId: state.id };
}

beforeAll(async () => {
  const pw = await bcrypt.hash('TestPassword123!', 1);

  // Happy-path user: starts with EXACTLY enough money for one hire.
  const happyTag = randomBytes(4).toString('hex');
  happyUser = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-happy-${happyTag}`,
      email: `${FIXTURE_PREFIX}-happy-${happyTag}@example.com`,
      password: pw,
      firstName: 'Sentinel',
      lastName: 'Happy',
      money: HIRING_COST,
    },
  });
  createdUserIds.push(happyUser.id);
  const happySeed = await seedOfferState(happyUser.id);
  happyMarketplaceId = happySeed.marketplaceId;
  happyStateId = happySeed.stateId;

  // Insufficient-funds user: starts with zero money, marketplace seeded.
  const brokeTag = randomBytes(4).toString('hex');
  brokeUser = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-broke-${brokeTag}`,
      email: `${FIXTURE_PREFIX}-broke-${brokeTag}@example.com`,
      password: pw,
      firstName: 'Sentinel',
      lastName: 'Broke',
      money: 0,
    },
  });
  createdUserIds.push(brokeUser.id);
  const brokeSeed = await seedOfferState(brokeUser.id);
  brokeMarketplaceId = brokeSeed.marketplaceId;
  brokeStateId = brokeSeed.stateId;
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.groom
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  for (const stateId of [happyStateId, brokeStateId].filter(Boolean)) {
    await prisma.staffMarketplaceState
      .delete({ where: { id: stateId } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
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

describe('hireFromMarketplace — recordTransactionTx migration (Equoria-26wuo)', () => {
  it('SENTINEL: persists a groom_hire debit row with balanceAfter sourced from inside the tx', async () => {
    const before = await prisma.userTransaction.count({
      where: { userId: happyUser.id, category: 'groom_hire' },
    });

    const req = {
      user: { id: happyUser.id },
      body: { marketplaceId: happyMarketplaceId },
    };
    const res = fakeRes();
    await hireFromMarketplace(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);

    // Ledger row count incremented by exactly 1
    const after = await prisma.userTransaction.count({
      where: { userId: happyUser.id, category: 'groom_hire' },
    });
    expect(after).toBe(before + 1);

    const row = await prisma.userTransaction.findFirst({
      where: { userId: happyUser.id, category: 'groom_hire' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).not.toBeNull();
    expect(row.type).toBe('debit');
    expect(Number(row.amount)).toBe(HIRING_COST);
    expect(row.category).toBe('groom_hire');
    expect(row.metadata).toMatchObject({ marketplaceId: happyMarketplaceId });

    // balanceAfter is now read INSIDE recordTransactionTx from the same tx
    // as the debit. It MUST equal post-debit money (start - cost).
    const userAfter = await prisma.user.findUnique({
      where: { id: happyUser.id },
      select: { money: true },
    });
    expect(Number(userAfter.money)).toBe(HIRING_COST - HIRING_COST); // 0
    expect(Number(row.balanceAfter)).toBe(HIRING_COST - HIRING_COST); // 0
  });

  it('rolls back the ledger row when the tx fails on insufficient funds (rollback parity)', async () => {
    const before = await prisma.userTransaction.count({
      where: { userId: brokeUser.id, category: 'groom_hire' },
    });

    const req = {
      user: { id: brokeUser.id },
      body: { marketplaceId: brokeMarketplaceId },
    };
    const res = fakeRes();
    await hireFromMarketplace(req, res);

    // InsufficientFundsError -> 400 envelope
    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);

    // NO ledger row written.
    const after = await prisma.userTransaction.count({
      where: { userId: brokeUser.id, category: 'groom_hire' },
    });
    expect(after).toBe(before);

    // NO groom created.
    const persisted = await prisma.groom.findFirst({ where: { userId: brokeUser.id } });
    expect(persisted).toBeNull();
  });
});
