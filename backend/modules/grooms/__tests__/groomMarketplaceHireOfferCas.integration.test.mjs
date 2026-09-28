/**
 * groomMarketplaceController.hireFromMarketplace offer-removal race (Equoria-bvddn.19).
 *
 * The defect: hireFromMarketplace removed the hired offer from the persisted
 * `staff_marketplace_state.offers` list AFTER the hire transaction committed,
 * using the `offers` array read BEFORE that transaction opened:
 *
 *     const updatedOffers = offers.filter((_, i) => i !== groomIndex);
 *     await prisma.staffMarketplaceState.update({ ..., data: { offers: updatedOffers } });
 *
 * Two concurrent hires of the SAME offer both read the same pre-tx snapshot,
 * both pass their own hire transaction (nothing in the transaction touched the
 * offer list), and both then write `offers.filter(...)` computed from that same
 * stale snapshot — the offer never actually disappears from the persisted list
 * until the LAST writer's post-tx update lands, and either writer's charge
 * still went through. So both requests get a 201 and both get charged for one
 * offer.
 *
 * The fix moves the removal INSIDE the hire transaction as a compare-and-swap
 * (`removeMarketplaceOfferCas`, backend/utils/staffMarketplaceOfferCas.mjs):
 * the UPDATE only applies if `offers` still equals the exact snapshot this
 * request read. debitMoneyOrThrow row-locks the User row first, so the two
 * concurrent transactions serialize there; the second to commit re-checks its
 * CAS precondition against the ALREADY-UPDATED row and loses (0 rows), rolling
 * its whole hire back (no groom, no charge) and surfacing 409.
 *
 * THIS SENTINEL asserts (fails-first against the pre-fix code):
 *   - Two concurrent hires of ONE offer -> exactly one 201, the other 409.
 *   - Exactly one groom created, exactly one debit ledger row, buyer charged
 *     exactly once.
 *   - The persisted offer list no longer contains the hired offer (not
 *     resurrected by the loser's stale-snapshot write).
 *
 * Buyer is funded far beyond the (here fixed, not randomly generated)
 * hiring cost so insufficient-funds can never be the reason for a rejection.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3). Fixture pattern mirrors
 * groomMarketplaceHireCapConcurrency.integration.test.mjs (Equoria-hduc5).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireFromMarketplace } from '../controllers/groomMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-bvddn19-groom';

// hireFromMarketplace: hiringCost = sessionRate * 7 (one week upfront).
const SESSION_RATE = 100;
const HIRING_COST = SESSION_RATE * 7;
// Fund the buyer far beyond what even several concurrent hires could ever
// cost — the scenario under test is the offer-list race, not money.
const BUYER_FUNDS = HIRING_COST * 1000;

const createdUserIds = [];
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

async function makeUser(money) {
  const tag = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Bvddn19',
      lastName: 'Groom',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

// Create a groom marketplace state with a single offer for `userId`.
// Returns the offer's marketplaceId.
async function makeSingleOfferMarketplace(userId) {
  const marketplaceId = `mid-${randomBytes(4).toString('hex')}`;
  const offers = [
    {
      marketplaceId,
      firstName: 'Cas',
      lastName: 'Groom',
      specialty: 'general',
      skillLevel: 'experienced',
      personality: 'gentle',
      experience: 5,
      sessionRate: SESSION_RATE,
      bio: 'bvddn19 offer-cas fixture',
    },
  ];
  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'groom' } },
    create: { userId, staffType: 'groom', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);
  return marketplaceId;
}

function hireReq(userId, marketplaceId) {
  return { user: { id: userId }, body: { marketplaceId } };
}

async function userMoney(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row?.money ?? 0);
}

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.groom
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] groom: ${err.message}`));
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] userTransaction: ${err.message}`));
  }
  for (const id of createdMarketplaceStateIds) {
    await prisma.staffMarketplaceState
      .delete({ where: { id } })
      .catch(err => console.warn(`[cleanup] marketplaceState: ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] user: ${err.message}`));
  }
}, 30000);

describe('groomMarketplaceController.hireFromMarketplace offer-removal race (Equoria-bvddn.19)', () => {
  it('SENTINEL: two concurrent hires of the SAME offer -> exactly one 201, one 409, charged once', async () => {
    const buyer = await makeUser(BUYER_FUNDS);
    const marketplaceId = await makeSingleOfferMarketplace(buyer.id);

    const moneyBefore = await userMoney(buyer.id);

    const [resA, resB] = await Promise.all([
      (() => {
        const res = fakeRes();
        return hireFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
      })(),
      (() => {
        const res = fakeRes();
        return hireFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
      })(),
    ]);

    const responses = [resA, resB];
    const successes = responses.filter(r => r.statusCode === 201);
    const conflicts = responses.filter(r => r.statusCode === 409);

    // Pre-fix: both requests get 201 (both charged for the same offer).
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].body?.success).toBe(false);
    expect(conflicts[0].body?.message).toMatch(/already hired|marketplace changed/i);

    // Exactly one groom exists, exactly one debit ledger row, charged once.
    const groomCount = await prisma.groom.count({ where: { userId: buyer.id } });
    expect(groomCount).toBe(1);

    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(await userMoney(buyer.id)).toBe(moneyBefore - HIRING_COST);

    // The offer is gone from the persisted list — not resurrected by the
    // loser's stale-snapshot write.
    const state = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: buyer.id, staffType: 'groom' } },
    });
    const offers = Array.isArray(state?.offers) ? state.offers : [];
    expect(offers.find(o => o.marketplaceId === marketplaceId)).toBeUndefined();
  });
});
