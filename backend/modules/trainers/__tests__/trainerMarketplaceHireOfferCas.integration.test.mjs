/**
 * trainerMarketplaceController.hireTrainerFromMarketplace offer-removal race (Equoria-bvddn.19).
 *
 * Sibling of groomMarketplaceHireOfferCas.integration.test.mjs — see that file
 * for the full defect narrative. Summary: hireTrainerFromMarketplace removed
 * the hired offer from `staff_marketplace_state.offers` AFTER the hire
 * transaction committed, using the `offers` array read BEFORE that
 * transaction opened (`offers.filter(...)` then a separate
 * `prisma.staffMarketplaceState.update`). Two concurrent hires of the SAME
 * offer both computed their filter from the same stale snapshot, so both
 * landed a 201 and both were charged.
 *
 * The fix moves the removal INSIDE the hire transaction as a compare-and-swap
 * (`removeMarketplaceOfferCas`, backend/utils/staffMarketplaceOfferCas.mjs):
 * the UPDATE only applies if `offers` still equals the exact snapshot this
 * request read. The hire row-locks the User row first, so the two
 * concurrent transactions serialize there; the second to commit re-checks its
 * CAS precondition against the ALREADY-UPDATED row and loses (0 rows), rolling
 * its whole hire back (no trainer) and surfacing 409.
 *
 * This is its OWN sentinel (not covered by the shared-helper argument alone):
 * trainerMarketplaceController has its own catch/409 mapping (a SINGLE outer
 * try/catch, unlike groom/rider's inner try around the transaction) and its
 * own debit + roster-cap wiring around the CAS call, so a wiring mistake
 * specific to this controller (wrong staffType, wrong offer index, a catch
 * that doesn't map StaleOfferError to 409) would not be caught by the groom
 * or rider tests.
 *
 * Buyer's stable level is raised to 5 (-> stable level 2, trainer roster cap
 * 2) so the roster-cap guard cannot mask the offer-CAS race under test — at
 * the DEFAULT stable level 1 the trainer cap is exactly 1, which would reject
 * the second concurrent hire with a roster-cap 400 before it ever reaches the
 * offer CAS, masking the defect this test exists to prove.
 *
 * Equoria-3kegj (owner ruling 2026-10-22): hiring a trainer is free, so the
 * winner is charged nothing and no hire ledger row is written; the race is
 * about one offer producing one trainer.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireTrainerFromMarketplace } from '../controllers/trainerMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-bvddn19-trainer';

// The trainer's per-training fee; the hire itself is free (Equoria-3kegj).
const SESSION_RATE = 120;
const BUYER_FUNDS = 1000;
// User.level 5 -> getStableLevel -> stable level 2 -> trainer roster cap 2.
// (Stable level 1's cap is exactly 1 and would mask the race under test.)
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
      lastName: 'Trainer',
      money,
      level: BUYER_LEVEL,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

// Create a trainer marketplace state with a single offer for `userId`.
// Returns the offer's marketplaceId.
async function makeSingleOfferMarketplace(userId) {
  const marketplaceId = `mid-${randomBytes(4).toString('hex')}`;
  const offers = [
    {
      marketplaceId,
      firstName: 'Cas',
      lastName: 'Trainer',
      personality: 'disciplined',
      skillLevel: 'experienced',
      speciality: 'jumping',
      sessionRate: SESSION_RATE,
      experience: 5,
      bio: 'bvddn19 offer-cas fixture',
    },
  ];
  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'trainer' } },
    create: { userId, staffType: 'trainer', offers, refreshCount: 0 },
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
    await prisma.trainer
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] trainer: ${err.message}`));
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

describe('trainerMarketplaceController.hireTrainerFromMarketplace offer-removal race (Equoria-bvddn.19)', () => {
  it('SENTINEL: two concurrent hires of the SAME offer -> exactly one 201, one 409, one trainer', async () => {
    const buyer = await makeUser(BUYER_FUNDS);
    const marketplaceId = await makeSingleOfferMarketplace(buyer.id);

    const moneyBefore = await userMoney(buyer.id);

    const [resA, resB] = await Promise.all([
      (() => {
        const res = fakeRes();
        return hireTrainerFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
      })(),
      (() => {
        const res = fakeRes();
        return hireTrainerFromMarketplace(hireReq(buyer.id, marketplaceId), res).then(() => res);
      })(),
    ]);

    const responses = [resA, resB];
    const successes = responses.filter(r => r.statusCode === 201);
    const conflicts = responses.filter(r => r.statusCode === 409);

    // Pre-fix: both requests get 201 (two trainers from one offer).
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].body?.success).toBe(false);
    expect(conflicts[0].body?.message).toMatch(/already hired|marketplace changed/i);

    // Exactly one trainer exists; the free hire wrote no ledger row and moved no coins.
    const trainerCount = await prisma.trainer.count({ where: { userId: buyer.id } });
    expect(trainerCount).toBe(1);

    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'trainerHire' },
    });
    expect(debitRows).toHaveLength(0);
    expect(await userMoney(buyer.id)).toBe(moneyBefore);

    // The offer is gone from the persisted list — not resurrected by the
    // loser's stale-snapshot write.
    const state = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId: buyer.id, staffType: 'trainer' } },
    });
    const offers = Array.isArray(state?.offers) ? state.offers : [];
    expect(offers.find(o => o.marketplaceId === marketplaceId)).toBeUndefined();
  });
});
