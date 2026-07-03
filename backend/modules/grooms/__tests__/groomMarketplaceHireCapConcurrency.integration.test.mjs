/**
 * groomMarketplaceController.hireFromMarketplace roster-cap sentinel (Equoria-hduc5).
 *
 * The defect class: hireFromMarketplace creates a user-owned groom
 * (groomMarketplaceController.mjs, `tx.groom.create`) with NO
 * MAX_GROOMS_PER_USER enforcement — neither a pre-tx fast-path count nor an
 * in-tx re-count. So the marketplace hire path is a TOTAL bypass of the roster
 * cap that the direct-hire path (hireGroom) advertises: a user can exceed
 * MAX_GROOMS_PER_USER even under fully sequential hiring, and unboundedly under
 * concurrency. This is the marketplace sibling of Equoria-n4m5j (which fixed the
 * direct-hire cap TOCTOU); found during n4m5j's OPTIMAL_FIX_DISCIPLINE §3
 * adjacent-locations check and filed separately per no-bundling (§7).
 *
 * The fix mirrors n4m5j: after debitMoneyOrThrow row-locks the User row inside
 * the hire tx (serializing concurrent same-user hires), re-count the user's
 * grooms and throw CapExceededError (-> 400) if the post-create count exceeds
 * MAX_GROOMS_PER_USER, rolling back the create + debit together. A pre-tx count
 * is kept as the cheap fast-path. MAX_GROOMS_PER_USER + CapExceededError are
 * lifted to shared module locations so both hire paths use one source of truth.
 *
 * THIS SENTINEL asserts (fails-first against the no-cap code):
 *   1. Concurrency: user at MAX-1 grooms with a wallet for ALL hires ->
 *      exactly one 201, final count == MAX (never MAX+k), charged once.
 *   2. Sequential fast-path: user already AT MAX hiring one from the
 *      marketplace -> 400 "maximum limit", no groom, no charge.
 * Both are red on the current code (no cap at all -> the hire succeeds and the
 * count climbs past MAX). Money is NOT the limiter here (the wallet covers every
 * hire); the ONLY thing that may reject is a cap guard.
 *
 * Real DB, no mocks, id-scoped cleanup (CLAUDE.md §3). Marketplace-offer fixture
 * mirrors groomHireConcurrentRace (Equoria-6g8wm).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hireFromMarketplace } from '../controllers/groomMarketplaceController.mjs';

const FIXTURE_PREFIX = 'TestFixture-hduc5-groom';

// Mirrors the shared roster-cap constant (backend/utils/groomSystem.mjs).
const MAX_GROOMS_PER_USER = 10;
// hireFromMarketplace: hiringCost = sessionRate * 7 (one week upfront).
const SESSION_RATE = 100;
const HIRING_COST = SESSION_RATE * 7;

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
      firstName: 'Hduc5',
      lastName: 'Groom',
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

// Seed `count` grooms directly (bypasses the hire path so the wallet is
// untouched — we exercise the CAP, not the money race).
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

// Create a groom marketplace state with `count` distinct offers for `userId`.
// Returns the marketplaceId list (one per offer).
async function makeMarketplace(userId, count) {
  const ids = Array.from({ length: count }, () => `mid-${randomBytes(4).toString('hex')}`);
  const offers = ids.map((mid, i) => ({
    marketplaceId: mid,
    firstName: 'Cap',
    lastName: `Groom${i}`,
    specialty: 'general',
    skillLevel: 'experienced',
    personality: 'gentle',
    experience: 5,
    sessionRate: SESSION_RATE,
    bio: 'hduc5 cap fixture',
  }));
  const state = await prisma.staffMarketplaceState.upsert({
    where: { userId_staffType: { userId, staffType: 'groom' } },
    create: { userId, staffType: 'groom', offers, refreshCount: 0 },
    update: { offers },
  });
  createdMarketplaceStateIds.push(state.id);
  return ids;
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

describe('groomMarketplaceController.hireFromMarketplace roster-cap (Equoria-hduc5)', () => {
  it('SENTINEL: concurrent marketplace hires racing for ONE open slot — exactly one 201, count never exceeds MAX, charged once', async () => {
    const CONCURRENCY = 8;
    const buyer = await makeUser(HIRING_COST * (CONCURRENCY + 2)); // money is not the limiter
    await seedGrooms(buyer.id, MAX_GROOMS_PER_USER - 1); // 9 grooms -> one slot left
    const marketplaceIds = await makeMarketplace(buyer.id, CONCURRENCY);

    const moneyBefore = await userMoney(buyer.id);

    const responses = await Promise.all(
      marketplaceIds.map(mid => {
        const res = fakeRes();
        return hireFromMarketplace(hireReq(buyer.id, mid), res).then(() => res);
      }),
    );

    const successes = responses.filter(r => r.statusCode === 201);
    const failures = responses.filter(r => r.statusCode !== 201);

    // Only one slot was open — exactly one hire may win regardless of how many
    // raced. The un-fixed code (no cap) lets several through.
    expect(successes.length).toBe(1);

    // Every loser is a cap 400 (client error), never a 5xx, and says so.
    expect(failures.length).toBe(CONCURRENCY - 1);
    for (const f of failures) {
      expect(f.statusCode).toBe(400);
      expect(f.body?.success).toBe(false);
      expect(f.body?.message).toMatch(/maximum limit/i);
    }

    // The roster invariant under concurrency: COUNT(groom) <= MAX.
    const groomCount = await prisma.groom.count({ where: { userId: buyer.id } });
    expect(groomCount).toBe(MAX_GROOMS_PER_USER);

    // Charged exactly once — every loser's debit rolled back with its create.
    const debitRows = await prisma.userTransaction.findMany({
      where: { userId: buyer.id, category: 'groom_hire' },
    });
    expect(debitRows).toHaveLength(1);
    expect(await userMoney(buyer.id)).toBe(moneyBefore - HIRING_COST);
  });

  it('FAST-PATH: hiring from marketplace while already AT MAX -> 400 maximum-limit, no groom, no charge', async () => {
    const buyer = await makeUser(HIRING_COST * 2);
    await seedGrooms(buyer.id, MAX_GROOMS_PER_USER); // already full
    const [mid] = await makeMarketplace(buyer.id, 1);

    const moneyBefore = await userMoney(buyer.id);
    const res = fakeRes();
    await hireFromMarketplace(hireReq(buyer.id, mid), res);

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
