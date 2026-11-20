/**
 * Owed weekly bank claims (Equoria-puj1e.5, owner ruling 2026-10-12) granted by
 * a time-back apply while two of the owed players pay each other
 * (Equoria-puj1e.5.3). It was a deadlock: Postgres aborted one side.
 *
 * Every path that locks two players' accounts locks them in ascending id order
 * (the player-to-player payment of a stud fee or a horse sale, the show
 * payouts). The apply's grant locked its accounts in table-scan order. With the
 * later id first in the table, the apply held it while it waited for the
 * earlier one, which the payment held while it waited for the later one.
 *
 * The interleaving is forced, not timed: a second client holds the earlier
 * player's account; the payment queues on it, then the apply queues behind it
 * (pg_blocking_pids of the holder only, a fresh statement each poll;
 * equoria-lock-barrier-tests-three-traps). Releasing lets both finish, or
 * deadlock. The fixture lays the later id first in the table, so the scan
 * order and the id order differ; the apply locks in id order either way.
 *
 * Real app: the Owner's real fresh code, hold and apply over HTTP; the real
 * player-to-player payment the stud booking makes; real undo; real DB. Apply
 * changes every matching row in the shared database, so the time-back is undone.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { transferUserMoneyOrThrow } from '../../economy/index.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
import {
  checkIn,
  createUserFactory,
  post,
  preparePost,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  actionCodesFor,
  easternWall,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbowed');
const APPLY = `${staffApi}/time-back/apply`;
const day = 86_400_000;
const startingMoney = 1000;
const studFee = 300;

// One whole bank week, five weeks back (clear of the other time-back suites' windows).
const thisWeek = startOfGameWeek(new Date(), 0);
const S = startOfGameDayIndex(gameDayIndex(thisWeek) - 35);
const E = startOfGameDayIndex(gameDayIndex(thisWeek) - 28);

let holdBefore;
let owner;
let device;
let barrierClient;

const suiteLock = gameWideSuiteLock();
// First: one game-wide suite at a time (gameWideSuiteLock).
beforeAll(() => suiteLock.take(), gameWideSuiteWaitMs);

beforeAll(async () => {
  holdBefore = await snapshotHold();
  barrierClient = createBarrierClient();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => barrierClient.$disconnect(), 'barrier client');
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  // Only undone time-backs: one still applied keeps its record (and fails the
  // owner's deletion loudly) so its changes can still be reversed.
  cleanup.add(async () => {
    const ids = (
      await prisma.timeBack.findMany({
        where: { appliedById: scope(), reversedAt: { not: null } },
        select: { id: true },
      })
    ).map(r => r.id);
    await prisma.timeBackChange.deleteMany({ where: { timeBackId: { in: ids } } });
    await prisma.timeBack.deleteMany({ where: { id: { in: ids } } });
  }, 'time-backs');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: scope() } }), 'ledger rows');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  await prisma.gameControl.deleteMany({ where: { id: 1 } });
  startEmailCapture();
  owner = await makeUser('owner');
  device = await checkIn(owner);
  // Apply needs the nightly jobs held.
  expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
  stopEmailCapture();
}, 120_000);

// Safety net: never leave a time-back applied in the shared database.
afterAll(async () => {
  const open = await prisma.timeBack.findMany({
    where: { appliedById: { in: createdUserIds }, reversedAt: null },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  startEmailCapture();
  try {
    for (const { id } of open) {
      await undo(id).catch(err => console.warn(`[cleanup] undo ${id}: ${err.message}`));
    }
  } finally {
    stopEmailCapture();
  }
  await cleanup.run();
}, 120_000);

// Last: the next game-wide suite may start.
afterAll(() => suiteLock.release());

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** Undo a time-back through the service with the Owner's real fresh code. */
async function undo(timeBackId) {
  await requestFreshCode(owner, 'timeBackUndo');
  const proof = await checkFreshCode(owner, 'timeBackUndo', actionCodesFor(owner.email).at(-1));
  return undoTimeBack({ actor: owner, timeBackId, proof });
}

/** Start a promise and capture its outcome instead of throwing. */
function outcomeOf(promise) {
  return promise.then(
    result => ({ result }),
    error => ({ error }),
  );
}

/** A player since before the outage, who never claimed: the apply owes them the lost week. */
function longStandingPlayer(idFirst) {
  const suffix = `${uid()}${uid()}`;
  return {
    id: `${idFirst}${randomUUID().slice(1)}`,
    email: `sttbowed-${suffix}@test.com`,
    username: `sttbowed${suffix}`,
    password: 'not-a-real-hash',
    firstName: 'Owed',
    lastName: 'Player',
    role: 'user',
    settings: {},
    emailVerified: true,
    emailVerifiedAt: new Date(),
    money: startingMoney,
    createdAt: new Date(S.getTime() - day),
  };
}

/** Where a row lies in the table, as a sequential scan meets it. */
async function heapPlace(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT (ctid::text::point)[0]::int AS page, (ctid::text::point)[1]::int AS item
    FROM "User" WHERE "id" = ${userId}`;
  return row;
}

/**
 * Two owed players, the later id lying before the earlier one in the table.
 * Both are inserted in one transaction (one connection, so the same target
 * page); when they still land the other way round (a full page), they are
 * removed and made again.
 */
async function laterIdFirstInTable() {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const [later, earlier] = await prisma.$transaction(async tx => [
      await tx.user.create({ data: longStandingPlayer('f') }),
      await tx.user.create({ data: longStandingPlayer('0') }),
    ]);
    createdUserIds.push(later.id, earlier.id);
    const [l, e] = [await heapPlace(later.id), await heapPlace(earlier.id)];
    if (l.page < e.page || (l.page === e.page && l.item < e.item)) {
      return { later, earlier };
    }
    await prisma.user.deleteMany({ where: { id: { in: [later.id, earlier.id] } } });
  }
  throw new Error('Could not lay the later id before the earlier one in the User table');
}

describe('Owed bank claims lock players in id order (Equoria-puj1e.5.3)', () => {
  it('a payment between two owed players during the apply: both finish', async () => {
    const { later, earlier } = await laterIdFirstInTable();
    expect(earlier.id < later.id).toBe(true);
    const code = await freshCode(owner, device, 'timeBackApply');
    const sendApply = await preparePost(APPLY, owner, { start: easternWall(S), end: easternWall(E), code }, device);
    // The stud fee a booking pays, from the earlier player to the later one.
    const pay = () =>
      prisma.$transaction(tx =>
        transferUserMoneyOrThrow(tx, {
          fromUserId: earlier.id,
          toUserId: later.id,
          amount: studFee,
          debitCategory: 'studFeePaid',
          creditCategory: 'studFeeReceived',
          debitDescription: 'Stud fee (time-back lock order test)',
          creditDescription: 'Stud fee (time-back lock order test)',
        }),
      );

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${earlier.id} FOR UPDATE`,
    );
    let paying;
    let applying;
    try {
      // The payment locks the earlier player first, and queues there.
      paying = outcomeOf(pay());
      await barrier.waitForQueued(1);
      // The apply queues on the earlier player too: in id order it holds
      // neither; in scan order it already held the later one.
      applying = Promise.resolve(sendApply());
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [paid, applied] = await Promise.all([paying, applying]);

    expect(paid.error).toBeUndefined();
    expect(applied.status).toBe(200);
    const timeBackId = applied.body.data.id;
    const owed = [{ timeBackId, weekStart: S.toISOString() }];
    const earlierAfter = await prisma.user.findUnique({ where: { id: earlier.id } });
    const laterAfter = await prisma.user.findUnique({ where: { id: later.id } });
    expect(earlierAfter.settings.owedWeeklyClaims).toEqual(owed);
    expect(laterAfter.settings.owedWeeklyClaims).toEqual(owed);
    expect(Number(earlierAfter.money)).toBe(startingMoney - studFee);
    expect(Number(laterAfter.money)).toBe(startingMoney + studFee);

    // Undo takes both owed claims back, in the same order, and leaves the payment.
    await undo(timeBackId);
    for (const id of [earlier.id, later.id]) {
      const row = await prisma.user.findUnique({ where: { id } });
      expect(row.settings.owedWeeklyClaims ?? []).toEqual([]);
    }
    expect(Number((await prisma.user.findUnique({ where: { id: earlier.id } })).money)).toBe(startingMoney - studFee);
  }, 120_000);
});
