/**
 * Show-execution reaper sentinel (Equoria-c7mx0).
 *
 * The defect: executeClosedShows claims a show atomically ('open' ->
 * 'executing', stamping claimedAt) and writes 'completed' later; the nightly
 * scan selects status:'open' only, so a crash between claim and completion
 * strands the show in 'executing' forever — prize + fee escrow frozen.
 *
 * These tests build a REAL show through the REAL controllers (createShow /
 * enterShow — real escrow funding, real DB, no mocks), then reproduce the
 * exact crash artifact: the claim write committed ('executing' + claimedAt)
 * and nothing after it. The reaper must:
 *   - FIRE on a genuinely stranded show (stale claimedAt, and the
 *     pre-migration claimedAt-NULL/stale-updatedAt variant), re-driving it
 *     through the real executor: results exactly once per entry, winners
 *     paid exactly once, fees settled to the creator, escrow columns
 *     drained, status 'completed', claimedAt cleared;
 *   - be IDEMPOTENT (second run is a no-op — no duplicate results, no
 *     double pay);
 *   - NOT fire on a freshly-claimed 'executing' show (a live executor's
 *     claim is not the reaper's to touch).
 *
 * Conservation is asserted over SUITE-OWNED wallets + per-show escrow
 * columns only (Equoria-3n2g4 pattern) — never exact balances of the shared
 * SystemAccount rows, which sibling suites mutate concurrently.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createShow, enterShow } from '../modules/competition/index.mjs';
import { reapStaleExecutingShows, STALE_CLAIM_THRESHOLD_MS } from '../services/jobs/impl/showExecutionReaper.mjs';

const FIXTURE_PREFIX = 'TestFixture-c7mx0-reaper';
const PRIZE = 1000; // divisible by the 50/30/20 slots — no floor crumbs
const ENTRY_FEE = 50;

let creator;
let entrants;
let entrantHorses;
const createdUserIds = [];
const createdHorseIds = [];
const createdShowIds = [];

function fakeRes() {
  // Minimal Express res shim for direct controller invocation (established
  // pattern — see showEscrowMoneyConservation.integration.test.mjs).
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  const u = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'Reaper',
      lastName: suffix,
      money,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

async function makeHorse(ownerId) {
  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-06-15'),
      age: 7,
      userId: ownerId,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });
  createdHorseIds.push(h.id);
  return h;
}

async function moneyOf(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

async function totalMoney(userIds) {
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { money: true },
  });
  return rows.reduce((s, r) => s + Number(r.money), 0);
}

/**
 * Build a fully-funded show through the real controllers: creator funds the
 * prize into escrow, every entrant pays the fee into escrow. Returns the
 * show id.
 */
async function buildFundedShow() {
  const createRes = fakeRes();
  await createShow(
    {
      user: { id: creator.id },
      body: {
        name: `${FIXTURE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee: ENTRY_FEE,
        prize: PRIZE,
        level: 1,
      },
    },
    createRes,
  );
  expect(createRes.statusCode).toBe(201);
  const showId = createRes.body.data.show.id;
  createdShowIds.push(showId);

  for (let i = 0; i < entrants.length; i++) {
    const enterRes = fakeRes();
    await enterShow(
      {
        user: { id: entrants[i].id },
        params: { id: String(showId) },
        body: { horseId: entrantHorses[i].id },
      },
      enterRes,
    );
    expect(enterRes.statusCode).toBe(201);
  }
  return showId;
}

/**
 * Reproduce the crash artifact: the executor's claim write committed
 * ('executing' + claimedAt + stagedOrdering, one atomic statement) and the
 * process died before anything else. The koodu ordering guarantees this is
 * the complete stranded state — no result rows, no payouts, escrow intact.
 * `stagedOrdering` omitted => NULL column (a pre-staging-migration stranding).
 */
async function plantCrash(showId, claimedAt, stagedOrdering) {
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'executing',
      claimedAt,
      ...(stagedOrdering !== undefined ? { stagedOrdering } : {}),
    },
  });
}

beforeAll(async () => {
  creator = await makeUser(100000, 'creator');
  entrants = await Promise.all([makeUser(500, 'entrant1'), makeUser(500, 'entrant2'), makeUser(500, 'entrant3')]);
  entrantHorses = await Promise.all(entrants.map(e => makeHorse(e.id)));
}, 60000);

afterAll(async () => {
  for (const sid of createdShowIds) {
    await prisma.competitionResult
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.showEntry
      .deleteMany({ where: { showId: sid } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.show.delete({ where: { id: sid } }).catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    // Notifications, XpEvents, and UserTransactions cascade on user delete.
    await prisma.userTransaction
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  // Deliberately NOT resetting the shared SystemAccount rows (Equoria-3n2g4):
  // the reaper drains exactly what the fixtures funded, so this suite is
  // net-zero on the shared balance.
}, 30000);

describe('[Equoria-c7mx0] show-execution reaper', () => {
  it('SENTINEL-POSITIVE: recovers a stranded show by REPLAYING its staged ordering verbatim — deterministic placements, money settled exactly once, escrow drained; second run is a no-op', async () => {
    const allUserIds = [creator.id, ...entrants.map(e => e.id)];
    const creatorBefore = await moneyOf(creator.id);
    const entrantMoneyBefore = await Promise.all(entrants.map(e => moneyOf(e.id)));
    const conservationBefore = await totalMoney(allUserIds);

    const showId = await buildFundedShow();
    // Crash artifact: claim committed 3h ago, carrying the ordering scored at
    // claim time. Scores 999/998/997 are unreachable by the live formula
    // (~5-stat avg + luck + rider caps), and the order is deliberately NOT
    // entry order — so these results can ONLY appear via pure replay of the
    // staging, never via re-scoring. Recovery must pay THIS ordering.
    const staged = [
      {
        horseId: entrantHorses[2].id,
        userId: entrants[2].id,
        horseName: entrantHorses[2].name,
        score: 999,
        placement: 1,
        riderId: null,
      },
      {
        horseId: entrantHorses[0].id,
        userId: entrants[0].id,
        horseName: entrantHorses[0].name,
        score: 998,
        placement: 2,
        riderId: null,
      },
      {
        horseId: entrantHorses[1].id,
        userId: entrants[1].id,
        horseName: entrantHorses[1].name,
        score: 997,
        placement: 3,
        riderId: null,
      },
    ];
    // staged placement -> expected prize under the untouched 50/30/20 slots
    const expectedPrizeByHorseId = {
      [entrantHorses[2].id]: 500,
      [entrantHorses[0].id]: 300,
      [entrantHorses[1].id]: 200,
    };
    await plantCrash(showId, new Date(Date.now() - STALE_CLAIM_THRESHOLD_MS - 60 * 60 * 1000), staged);

    // Prove the stranded state is the koodu-clean one: no results, escrow intact.
    const stranded = await prisma.show.findUnique({ where: { id: showId } });
    expect(stranded.status).toBe('executing');
    expect(stranded.prizeEscrow).toBe(PRIZE);
    expect(stranded.feeEscrow).toBe(ENTRY_FEE * entrants.length);
    expect(await prisma.competitionResult.count({ where: { showId } })).toBe(0);

    // ── Reap ──────────────────────────────────────────────────────────────
    const summary = await reapStaleExecutingShows({ showIds: [showId] });
    expect(summary.staleShowsFound).toBe(1);
    expect(summary.releasedCount).toBe(1);
    expect(summary.recoveredCount).toBe(1);
    expect(summary.failedShowIds).toEqual([]);

    // Terminal state; claim AND staging cleared.
    const recovered = await prisma.show.findUnique({ where: { id: showId } });
    expect(recovered.status).toBe('completed');
    expect(recovered.executedAt).not.toBeNull();
    expect(recovered.claimedAt).toBeNull();
    expect(recovered.stagedOrdering).toBeNull();

    // Exactly one result per entry — and each one is the STAGED row, verbatim:
    // staged score, staged placement, slot prize for that placement.
    const results = await prisma.competitionResult.findMany({ where: { showId } });
    expect(results).toHaveLength(entrants.length);
    for (const s of staged) {
      const r = results.find(x => x.horseId === s.horseId);
      expect(r).toBeDefined();
      // score (like prizeWon) round-trips through a string/Decimal column.
      expect(Number(r.score)).toBe(s.score);
      expect(r.placement).toBe(String(s.placement));
      expect(Number(r.prizeWon ?? 0)).toBe(expectedPrizeByHorseId[s.horseId]);
    }
    expect(results.reduce((s, r) => s + Number(r.prizeWon ?? 0), 0)).toBe(PRIZE);

    // Money settled exactly once AND to the staged winners specifically:
    // each entrant's wallet moved by (staged prize - entry fee).
    for (let i = 0; i < entrants.length; i++) {
      expect(await moneyOf(entrants[i].id)).toBe(
        entrantMoneyBefore[i] - ENTRY_FEE + expectedPrizeByHorseId[entrantHorses[i].id],
      );
    }
    expect(await moneyOf(creator.id)).toBe(creatorBefore - PRIZE + ENTRY_FEE * entrants.length);
    expect(await totalMoney(allUserIds)).toBe(conservationBefore);

    // Per-show escrow columns drained to zero — the frozen money is free.
    expect(recovered.prizeEscrow).toBe(0);
    expect(recovered.feeEscrow).toBe(0);

    // ── Idempotency: a second reaper run must be a complete no-op ─────────
    const secondRun = await reapStaleExecutingShows({ showIds: [showId] });
    expect(secondRun).toEqual({
      staleShowsFound: 0,
      releasedCount: 0,
      recoveredCount: 0,
      failedShowIds: [],
    });
    expect(await prisma.competitionResult.count({ where: { showId } })).toBe(entrants.length);
    expect(await totalMoney(allUserIds)).toBe(conservationBefore);
  }, 60000);

  it('SENTINEL-POSITIVE (pre-migration variant): claimedAt NULL + no staged ordering — recovered via the stale-updatedAt fallback and fresh scoring', async () => {
    const allUserIds = [creator.id, ...entrants.map(e => e.id)];
    const conservationBefore = await totalMoney(allUserIds);

    const showId = await buildFundedShow();
    await plantCrash(showId, null);
    // Rows claimed before the claimedAt migration have claimedAt NULL; their
    // staleness signal is updatedAt (bumped by the claim write itself). Age
    // it via raw SQL — the Prisma client would re-bump @updatedAt.
    const staleTs = new Date(Date.now() - STALE_CLAIM_THRESHOLD_MS - 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE "shows" SET "updatedAt" = ${staleTs} WHERE "id" = ${showId}`;

    const summary = await reapStaleExecutingShows({ showIds: [showId] });
    expect(summary.staleShowsFound).toBe(1);
    expect(summary.recoveredCount).toBe(1);

    const recovered = await prisma.show.findUnique({ where: { id: showId } });
    expect(recovered.status).toBe('completed');
    expect(recovered.prizeEscrow).toBe(0);
    expect(recovered.feeEscrow).toBe(0);
    expect(await prisma.competitionResult.count({ where: { showId } })).toBe(entrants.length);
    expect(await totalMoney(allUserIds)).toBe(conservationBefore);
  }, 60000);

  it('SENTINEL-POSITIVE (invalid staging): a staged ordering that no longer matches the roster is rejected and the show recovers via fresh scoring', async () => {
    const allUserIds = [creator.id, ...entrants.map(e => e.id)];
    const conservationBefore = await totalMoney(allUserIds);

    const showId = await buildFundedShow();
    // Staging referencing a horse that is NOT among the entries (e.g. an
    // entrant GDPR-deleted between claim and re-drive). readStagedOrdering
    // must reject it and fall back to fresh scoring of the real roster —
    // never pay a stale one.
    const bogus = [
      { horseId: 999999999, userId: entrants[0].id, horseName: 'ghost', score: 999, placement: 1, riderId: null },
      {
        horseId: entrantHorses[0].id,
        userId: entrants[0].id,
        horseName: entrantHorses[0].name,
        score: 998,
        placement: 2,
        riderId: null,
      },
      {
        horseId: entrantHorses[1].id,
        userId: entrants[1].id,
        horseName: entrantHorses[1].name,
        score: 997,
        placement: 3,
        riderId: null,
      },
    ];
    await plantCrash(showId, new Date(Date.now() - STALE_CLAIM_THRESHOLD_MS - 60 * 60 * 1000), bogus);

    const summary = await reapStaleExecutingShows({ showIds: [showId] });
    expect(summary.recoveredCount).toBe(1);

    const recovered = await prisma.show.findUnique({ where: { id: showId } });
    expect(recovered.status).toBe('completed');
    expect(recovered.prizeEscrow).toBe(0);
    expect(recovered.feeEscrow).toBe(0);
    // Fresh scoring of the REAL roster: one result per actual entry, none for
    // the ghost horse, and no replayed impossible scores.
    const results = await prisma.competitionResult.findMany({ where: { showId } });
    expect(results).toHaveLength(entrants.length);
    expect(results.some(r => r.horseId === 999999999)).toBe(false);
    for (const r of results) {
      expect(Number(r.score)).toBeLessThan(200); // live formula range, not the staged 99x
    }
    expect(await totalMoney(allUserIds)).toBe(conservationBefore);
  }, 60000);

  it('SENTINEL-NEGATIVE: does NOT touch a freshly-claimed executing show (live executor territory)', async () => {
    const allUserIds = [creator.id, ...entrants.map(e => e.id)];
    const conservationBefore = await totalMoney(allUserIds);

    const showId = await buildFundedShow();
    // A live executor claimed this moments ago — NOT stranded.
    await plantCrash(showId, new Date());

    const summary = await reapStaleExecutingShows({ showIds: [showId] });
    expect(summary).toEqual({
      staleShowsFound: 0,
      releasedCount: 0,
      recoveredCount: 0,
      failedShowIds: [],
    });

    const untouched = await prisma.show.findUnique({ where: { id: showId } });
    expect(untouched.status).toBe('executing');
    expect(untouched.claimedAt).not.toBeNull();
    expect(untouched.prizeEscrow).toBe(PRIZE);
    expect(untouched.feeEscrow).toBe(ENTRY_FEE * entrants.length);
    expect(await prisma.competitionResult.count({ where: { showId } })).toBe(0);
    // The suite-owned wallet total is down by exactly prize + fees: that
    // money sits (correctly untouched) in the show's escrow columns while
    // the claim is fresh — the reaper moved nothing.
    expect(await totalMoney(allUserIds)).toBe(conservationBefore - PRIZE - ENTRY_FEE * entrants.length);
  }, 60000);
});
