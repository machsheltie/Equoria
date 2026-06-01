/**
 * POST /api/riders/marketplace/hire — recordTransactionTx migration sentinel
 * (Equoria-vp393).
 *
 * Per Equoria-pqp69 migration plan: the rider hire path was migrated from
 * the legacy `recordTransaction(opts, tx)` signature to
 * `recordTransactionTx(tx, opts)` and pulled INSIDE the same tx as the
 * rider.create + atomic money debit. The structural guarantee of the new
 * signature is that `balanceAfter` is read inside the same tx by the
 * service — the caller no longer supplies it, so the recorded balance
 * cannot lag the actual post-debit value.
 *
 * Rollback parity: a ledger insert failure now rolls the rider create +
 * money debit back, eliminating the "rider exists with no ledger trail"
 * defect class (the pre-Equoria-vp393 best-effort recordTransaction()
 * happened AFTER the tx committed and could silently leak).
 *
 * This sentinel proves the migration is wired correctly by:
 *
 *   1. Hiring a rider from a seeded marketplace via the controller
 *      (no HTTP — dodges CSRF; uses the same pattern as the vet and
 *      bank migration sentinels Equoria-2hfss / Equoria-hw3c8).
 *   2. Reading back the most recent rider_hire `userTransaction` row.
 *   3. Asserting `balanceAfter` on the ledger row equals the user's
 *      money column AFTER the debit (starting money - hiringCost).
 *   4. Asserting type/amount/category/metadata.riderId/marketplaceId
 *      so a refactor that drops one of those fields fails loudly.
 *
 * Real DB, no mocks, scoped fixtures (TestFixture-vp393 prefix).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireRiderFromMarketplace } from '../controllers/riderMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-vp393-rider';
const STARTING_MONEY = 10000;
const HIRING_COST = 250;

let user;
let marketplaceId;
const createdUserIds = [];
const createdRiderIds = [];
const createdMarketplaceStateIds = [];

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
      firstName: 'Rider',
      lastName: 'Migration',
      money: STARTING_MONEY,
    },
  });
  createdUserIds.push(user.id);

  marketplaceId = `mid-${randomBytes(4).toString('hex')}`;
  const offers = [
    {
      marketplaceId,
      firstName: 'Sentinel',
      lastName: 'Rider',
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate: HIRING_COST,
      experience: 5,
      bio: 'vp393 sentinel fixture',
    },
  ];

  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId: user.id, staffType: 'rider' } },
    create: { userId: user.id, staffType: 'rider', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdRiderIds.length) {
    await prisma.rider
      .deleteMany({ where: { id: { in: createdRiderIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.rider
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdMarketplaceStateIds.length) {
    await prisma.staffMarketplaceState
      .deleteMany({ where: { id: { in: createdMarketplaceStateIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('rider hireRiderFromMarketplace recordTransactionTx migration sentinel (Equoria-vp393)', () => {
  it('SENTINEL: ledger row balanceAfter is sourced from inside the tx (post-debit)', async () => {
    const req = {
      user: { id: user.id },
      body: { marketplaceId },
    };
    const res = fakeRes();
    await hireRiderFromMarketplace(req, res);

    // Hire succeeded
    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    const hiredRiderId = res.body?.data?.rider?.id;
    expect(hiredRiderId).toBeTruthy();
    createdRiderIds.push(hiredRiderId);

    // User money was debited correctly
    const afterUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { money: true },
    });
    const expectedMoneyAfter = STARTING_MONEY - HIRING_COST;
    expect(Number(afterUser.money)).toBe(expectedMoneyAfter);

    // Ledger row was created with the correct shape — balanceAfter
    // matches the user's money column AFTER the debit, proving
    // recordTransactionTx read inside the same tx (the migration's
    // structural guarantee).
    const ledgerRow = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'rider_hire' },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledgerRow).not.toBeNull();
    expect(ledgerRow.type).toBe('debit');
    expect(Number(ledgerRow.amount)).toBe(HIRING_COST);
    expect(ledgerRow.category).toBe('rider_hire');
    expect(Number(ledgerRow.balanceAfter)).toBe(expectedMoneyAfter);
    expect(ledgerRow.metadata).toMatchObject({
      riderId: hiredRiderId,
      marketplaceId,
    });
  });
});
