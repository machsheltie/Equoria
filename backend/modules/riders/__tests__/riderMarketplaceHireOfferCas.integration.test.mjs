/**
 * riderMarketplaceController.hireRiderFromMarketplace offer-removal race (Equoria-bvddn.19).
 *
 * Sibling of groomMarketplaceHireOfferCas.integration.test.mjs — see that file
 * for the full defect narrative. Summary: hireRiderFromMarketplace removed the
 * hired offer from `staff_marketplace_state.offers` AFTER the hire transaction
 * committed, using the `offers` array read BEFORE that transaction opened
 * (`offers.filter(...)` then a separate `prisma.staffMarketplaceState.update`).
 * Two concurrent hires of the SAME offer both computed their filter from the
 * same stale snapshot, so both landed a 201 and both were charged.
 *
 * The fix moves the removal INSIDE the hire transaction as a compare-and-swap
 * (`removeMarketplaceOfferCas`, backend/utils/staffMarketplaceOfferCas.mjs):
 * the UPDATE only applies if `offers` still equals the exact snapshot this
 * request read. debitMoneyOrThrow row-locks the User row first, so the two
 * concurrent transactions serialize there; the second to commit re-checks its
 * CAS precondition against the ALREADY-UPDATED row and loses (0 rows), rolling
 * its whole hire back (no rider, no charge) and surfacing 409.
 *
 * This is its OWN sentinel (not covered by the shared-helper argument alone):
 * riderMarketplaceController has its own catch/409 mapping and its own debit +
 * roster-cap wiring around the CAS call, so a wiring mistake specific to this
 * controller (wrong staffType, wrong offer index, a catch that doesn't map
 * StaleOfferError to 409) would not be caught by the groom test.
 *
 * Buyer's stable level is raised to 5 (-> stable level 2, rider roster cap 3)
 * so the roster-cap guard cannot mask the offer-CAS race under test — a
 * level-1 user's cap of 2 is still safe here, but level 5 keeps ample margin
 * and mirrors the trainer sibling test where the level-1 cap is exactly 1 and
 * WOULD mask it.
 *
 * Buyer is funded far beyond the (here fixed, not randomly generated)
 * hiring cost so insufficient-funds can never be the reason for a rejection.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireRiderFromMarketplace } from '../controllers/riderMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-bvddn19-rider';

// hireRiderFromMarketplace: hiringCost = riderData.weeklyRate.
const WEEKLY_RATE = 150;
const HIRING_COST = WEEKLY_RATE;
// Fund the buyer far beyond what even several concurrent hires could ever
// cost — the scenario under test is the offer-list race, not money.
const BUYER_FUNDS = HIRING_COST * 1000;
// User.level 5 -> getStableLevel -> stable level 2 -> rider roster cap 3.
const BUYER_LEVEL = 5;

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
      lastName: 'Rider',
      money,
      level: BUYER_LEVEL,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

// Create a rider marketplace state with a single offer for `userId`.
// Returns the offer's marketplaceId.
async function makeSingleOfferMarketplace(userId) {
  const marketplaceId = `mid-${randomBytes(4).toString('hex')}`;
  const offers = [
    {
      marketplaceId,
      firstName: 'Cas',
      lastName: 'Rider',
      personality: 'focused',
      skillLevel: 'experienced',
      speciality: 'dressage',
      weeklyRate: WEEKLY_RATE,
      experience: 5,
      bio: 'bvddn19 offer-cas fixture',
    },
  ];
  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'rider' } },
    create: { userId, staffType: 'rider', offers, refreshCount: 0 },
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
    await prisma.rider
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] rider: ${err.message}`));
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

describe('riderMarketplaceController.hireRiderFromMarketplace offer-removal race (Equoria-bvddn.19)', () => {
  it('SENTINEL: two concurrent hires of the SAME offer -> exactly one 201, one 409, charged once', async () => {
    const buyer = await makeUser(BUYER_FUNDS);
    const marketplaceId = await makeSingleOfferMarketplace(buyer.id);

    const moneyBefore = await userMoney(buyer.id);

    const [resA, resB] = await Promise.all([
      (() => {
        const res = fakeRes();
        return hireRiderFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
      })(),
      (() => {
        const res = fakeRes();
        return hireRiderFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
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

    // Exactly one rider exists, exactly one debit ledger row, charged once.
    const riderCount = await prisma.rider.count({ where: { userId: buyer.id } });
    expect(riderCount).toBe(1);

    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'rider_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(await userMoney(buyer.id)).toBe(moneyBefore - HIRING_COST);

    // The offer is gone from the persisted list — not resurrected by the
    // loser's stale-snapshot write.
    const state = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: buyer.id, staffType: 'rider' } },
    });
    const offers = Array.isArray(state?.offers) ? state.offers : [];
    expect(offers.find(o => o.marketplaceId === marketplaceId)).toBeUndefined();
  });
});
