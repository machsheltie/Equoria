/**
 * Entry-window claim-race guard sentinel (Equoria-8pb6w, cluster 2).
 *
 * DEFECT: both entry transactions — showController.enterShowAtomicTx (the
 * canonical POST /api/v1/shows/:id/enter path) and
 * competitionRouteQueries.enterShowDeferredTx (the live-frontend
 * POST /api/v1/competition/enter path) — checked `show.status === 'open'`
 * ONLY in a pre-tx guard, then wrote `show.update({ feeEscrow: { increment } })`
 * UNCONDITIONALLY inside the tx. An entry whose tx commits AFTER the executor's
 * atomic claim ('open' -> 'executing') still landed: fee debited, escrow
 * credited, ShowEntry created — on a show already being scored from a snapshot
 * that predates the entry. Pure player loss (fee paid, horse never scored, no
 * refund).
 *
 * THE FIX re-asserts status='open' INSIDE the tx via a status-scoped conditional
 * updateMany (count===0 -> throw entryClosed -> whole tx rolls back -> HTTP
 * 409). Because the paid path's feeEscrow increment carries the status
 * predicate but a FREE show (entryFee 0) has no increment to carry it, the free
 * branch gets the same status-scoped touch (increment: 0) — otherwise free
 * shows would silently bypass the guard (the trap this suite locks explicitly).
 *
 * DETERMINISM (no flaky concurrency): both entry functions take the pre-read
 * `show` snapshot as a parameter and re-check status against the live DB. We
 * therefore (1) read the show as 'open', (2) flip the DB row to 'executing'
 * (exactly the executor's claim landing between the pre-check and the tx), then
 * (3) call the function with the STALE 'open' snapshot. The tx-internal guard
 * must reject. This is the "test seam" the issue's AC sanctions.
 *
 * SENTINEL-POSITIVE: against the pre-guard code every assertion below fails
 * (the fee is debited / escrow credited / feeEscrow incremented / a ShowEntry
 * is created and the call resolves instead of throwing). Against the fix it
 * passes. Real DB, no mocks, scoped fail-loud cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { enterShowAtomicTx } from '../shows/showEscrowTx.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';
// Equoria-576c0 B9: both entry txs run the shared entry rules first (age 3-20,
// an eligible rider; the XP bracket is gone, R9). The horses are eligible, so
// the 8pb6w status guard (entryClosed) remains the thing under test here.
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';

const PREFIX = 'TestFixture-8pb6w-raceguard';
const uid = () => `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;

let creator;
let entrant;
let entrantHorse;
const userIds = [];
const horseIds = [];
const showIds = [];
const riderIds = [];
const cleanup = createCleanupTracker();

async function makeUser(money, suffix) {
  const u = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${suffix}-${uid()}`.slice(0, 30),
      email: `${PREFIX}-${suffix}-${uid()}@test.com`,
      password: 'irrelevant-hash',
      firstName: 'Race',
      lastName: suffix,
      money,
    },
  });
  userIds.push(u.id);
  return u;
}

async function makeHorse(ownerId) {
  const h = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}-horse-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: ownerId,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
    },
  });
  horseIds.push(h.id);
  await giveEligibleRider(prisma, { horseId: h.id, userId: ownerId }, riderIds);
  return h;
}

async function makeOpenShow(entryFee) {
  const s = await prisma.show.create({
    data: {
      name: `${PREFIX}-show-${uid()}`,
      discipline: 'Dressage',
      entryFee,
      maxEntries: null,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      closeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      openDate: new Date(),
      status: 'open',
      createdByUserId: creator.id,
      prizeEscrow: 1000,
      feeEscrow: 0,
    },
  });
  showIds.push(s.id);
  return s;
}

async function snapshot(showId) {
  const [entrantRow, creatorRow, showRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: entrant.id }, select: { money: true } }),
    prisma.user.findUnique({ where: { id: creator.id }, select: { money: true } }),
    prisma.show.findUnique({ where: { id: showId }, select: { feeEscrow: true } }),
  ]);
  return {
    entrant: Number(entrantRow.money),
    creator: Number(creatorRow.money),
    feeEscrow: Number(showRow.feeEscrow),
  };
}

// Every ledger row the entry transaction writes names the show in its metadata:
// the escrow credit (showEntryFeeEscrow, written by creditSystemAccount right
// after it increments SystemAccount[showEscrow]) and the entrant's fee debit
// (competitionEntry). Rows for THIS show exist only if that transaction committed.
function entryLedgerRows(showId) {
  return prisma.userTransaction.findMany({
    where: { userId: entrant.id, metadata: { path: ['showId'], equals: showId } },
    select: { category: true },
  });
}

/**
 * The shared assertion: entering `enterFn` against a show whose DB status has
 * been flipped to 'executing' (while the caller still holds an 'open' snapshot)
 * must throw entryClosed and leave EVERY balance and the ShowEntry table
 * exactly as they were.
 */
async function assertRejectsClosed(enterFn, entryFee) {
  const show = await makeOpenShow(entryFee);
  const staleOpenSnapshot = { ...show }; // pre-check saw status: 'open'

  // The executor's atomic claim lands AFTER the pre-check read the show.
  await prisma.show.update({ where: { id: show.id }, data: { status: 'executing' } });

  const before = await snapshot(show.id);

  await expect(
    enterFn({
      show: staleOpenSnapshot,
      showId: show.id,
      horseId: entrantHorse.id,
      userId: entrant.id,
    }),
  ).rejects.toThrow('entryClosed');

  const after = await snapshot(show.id);
  // Wallets and the per-show feeEscrow column UNCHANGED: the whole tx (fee
  // debit + escrow credit + increment) rolled back on the throw.
  expect(after.entrant).toBe(before.entrant);
  expect(after.creator).toBe(before.creator);
  expect(after.feeEscrow).toBe(before.feeEscrow);
  // Equoria-t1agd: the escrow credit rolled back too, proven by its own ledger
  // row, not by the shared SystemAccount[showEscrow] balance (which a sibling
  // suite can move between two reads). On the paid path the credit is written
  // BEFORE the status guard throws, so a missing rollback leaves this row.
  expect(await entryLedgerRows(show.id)).toEqual([]);
  // No ShowEntry row was created on the already-claimed show.
  const entry = await prisma.showEntry.findFirst({
    where: { showId: show.id, horseId: entrantHorse.id },
    select: { id: true },
  });
  expect(entry).toBeNull();
}

/**
 * The positive side of the FREE-show boundary: the increment:0 status-scoped
 * touch must NOT over-reject a legitimately-open free show. A free entry into a
 * still-open show succeeds, creates the ShowEntry, and leaves feeEscrow at 0.
 */
async function assertAcceptsOpenFree(enterFn) {
  const horse = await makeHorse(entrant.id);
  const show = await makeOpenShow(0); // status stays 'open' — no claim raced in

  const created = await enterFn({
    show,
    showId: show.id,
    horseId: horse.id,
    userId: entrant.id,
  });

  expect(created).toBeTruthy();
  expect(created.feePaid).toBe(0);
  const showAfter = await prisma.show.findUnique({
    where: { id: show.id },
    select: { feeEscrow: true, status: true },
  });
  expect(Number(showAfter.feeEscrow)).toBe(0);
  expect(showAfter.status).toBe('open');
}

beforeAll(async () => {
  creator = await makeUser(100000, 'creator');
  entrant = await makeUser(5000, 'entrant');
  entrantHorse = await makeHorse(entrant.id);

  cleanup.add(async () => {
    for (const id of showIds) {
      await prisma.showEntry.deleteMany({ where: { showId: id } });
      await prisma.show.delete({ where: { id } });
    }
  }, 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'userTransactions');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
}, 60000);

afterAll(() => cleanup.run(), 60000);

describe('entry claim-race guard (Equoria-8pb6w)', () => {
  it('SENTINEL: enterShowAtomicTx (paid) racing the claim → 409/entryClosed, no charge, no entry', async () => {
    await assertRejectsClosed(enterShowAtomicTx, 100);
  });

  it('SENTINEL: enterShowAtomicTx (FREE show — the trap) racing the claim → entryClosed, no entry', async () => {
    await assertRejectsClosed(enterShowAtomicTx, 0);
  });

  it('SENTINEL: enterShowDeferredTx (paid) racing the claim → 409/entryClosed, no charge, no entry', async () => {
    await assertRejectsClosed(enterShowDeferredTx, 100);
  });

  it('SENTINEL: enterShowDeferredTx (FREE show — the trap) racing the claim → entryClosed, no entry', async () => {
    await assertRejectsClosed(enterShowDeferredTx, 0);
  });

  // Boundary: prove the increment:0 free-show guard does NOT over-reject a
  // legitimately-open free show (the positive side of the trap).
  it('enterShowAtomicTx (FREE show, still open) succeeds — increment:0 guard does not over-reject', async () => {
    await assertAcceptsOpenFree(enterShowAtomicTx);
  });

  it('enterShowDeferredTx (FREE show, still open) succeeds — increment:0 guard does not over-reject', async () => {
    await assertAcceptsOpenFree(enterShowDeferredTx);
  });
});
