/**
 * Groom Engagement — hiring is an ENGAGEMENT, never ownership.
 *
 * Equoria-ypb7d.2 / .3, implementing the owner's ruling of 2026-09-09
 * (Equoria-m0w8n), quoted because every rule below is a clause of it:
 *
 *   "players never own grooms. If anyone owns them, Equoria does. They are free
 *    agents. They are HIRED by players and charged a weekly fee. Each groom can
 *    groom up to 10 horses per week. A groom is working for a player and so long
 *    as they pay their weekly fee, they keep the groom on their staff. If they
 *    fail to pay for a groom for a week, the groom goes back to the Grooms for
 *    hire section of the marketplace and can be hired by other players. So for
 *    clarity, a player gets one weeks grace period. The groom can't groom horse
 *    until paid for that week but they don't officially lose the groom once until
 *    they fail to pay for a whole week."
 *
 * WHAT "HIRED, NEVER OWNED" MEANS CONCRETELY IN THIS SCHEMA
 *
 *   `Groom.userId`  — the player whose STAFF the groom is currently on. NULL is a
 *                     free agent. It stays the LIVE pointer: the roster cap
 *                     counts it, `requireOwnership('groom')` resolves it, and
 *                     ~20 reads select it. Renaming or removing it would have
 *                     been a 200-site change that bought nothing the comment on
 *                     the field does not already buy.
 *   `GroomEngagement` — the HISTORY of who has hired whom, in the same
 *                     relationship `GroomAssignmentLog` has to
 *                     `GroomAssignment`. At most one open row per groom, by the
 *                     partial unique index
 *                     `groom_engagements_active_groomId_key … WHERE "endedAt" IS
 *                     NULL`.
 *   `Groom.feeUnpaidSince` — non-NULL means the engagement is inside the one-week
 *                     grace period: the groom is still on staff and STILL
 *                     BELONGS TO NOBODY, but may not work. See
 *                     `checkGroomMayWork` below.
 *
 *   The live pointer and the history are written in the SAME transaction by every
 *   function here, so they cannot drift. The invariant, for a non-retired groom:
 *       `Groom.userId IS NOT NULL`  <=>  an open engagement row exists.
 *
 * THE ONE DELIBERATE EXCEPTION: RETIREMENT
 *   Retirement CLOSES the engagement but leaves `Groom.userId` set. `retired`
 *   already bars the groom from working and from the hire pool, and keeping the
 *   pointer is what lets a player still read their retired grooms
 *   (`getRetirementStatistics`, `getUserGrooms`) — the readable history
 *   Equoria-m9lz1 established. Release for non-payment DOES clear it, because
 *   the whole point is that someone else can hire them.
 *
 * WHAT A RELEASE DOES *NOT* TOUCH, AND WHY (owner question, not a decision)
 *   Nothing about the groom themself is reset: `experience`, `level`,
 *   `careerWeeks`, `startAge`, `bonusTraitMap`, `GroomHorseSynergy` rows,
 *   `GroomInteraction` history and `GroomAssignmentLog` history all survive
 *   untouched, exactly as they do through retirement (invariant I5). Preserving
 *   is the reversible choice and destroying is not, so it is the safe default —
 *   but whether a groom returning to the pool should arrive with their bond
 *   history and accumulated experience intact is a PRODUCT question the code
 *   cannot answer. It is raised for the owner in the Equoria-ypb7d report; it has
 *   not been decided here.
 */

import logger from '../../../utils/logger.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { createNotificationTx } from '../../../utils/notificationService.mjs';

/**
 * Why an engagement ended. Written by the game only — no request reaches any of
 * these functions directly.
 */
export const ENGAGEMENT_END_REASONS = {
  /** A full pay week went unpaid; the groom returned to the hire pool. */
  FEE_UNPAID: 'fee_unpaid',
  /** The groom aged out (groomRetirementService.processRetirement). */
  RETIREMENT: 'retirement',
};

/** The player is told their groom cannot work until this week's fee is paid. */
export const GROOM_FEE_UNPAID_NOTIFICATION_TYPE = 'groom_fee_unpaid';

/** The player is told the groom has left for the grooms-for-hire pool. */
export const GROOM_RELEASED_NOTIFICATION_TYPE = 'groom_released';

/**
 * The predicate that defines the grooms-for-hire pool.
 *
 * A groom is hireable by anyone when they are a free agent (`userId: null`),
 * still working (`retired: false, isActive: true`), and have ALREADY BEEN
 * ENGAGED AT LEAST ONCE — the `engagements.some({ endedAt: not null })` clause.
 *
 * That last clause is not decoration. The local database holds 65 non-retired
 * grooms with a NULL `userId` that are leftover test fixtures and legacy rows,
 * none of which any player ever hired. Listing them as free agents would put
 * fixture debris in front of a player. Requiring a CLOSED engagement means the
 * pool contains exactly the grooms a player has released, which is what the
 * ruling describes ("the groom goes back to the Grooms for hire section"). If the
 * owner later wants Equoria to seed the pool with never-engaged free agents, that
 * is a deliberate widening of this predicate plus a way to mark such a groom, not
 * an accident of a NULL column.
 */
export const FREE_AGENT_WHERE = Object.freeze({
  userId: null,
  retired: false,
  isActive: true,
  engagements: { some: { endedAt: { not: null } } },
});

/**
 * Take the per-(user, pay week) advisory lock. THE ONE DEFINITION of that lock key.
 *
 * Equoria-ypb7d.3 fix round 1, finding F2. `processWeeklySalaries` took this lock as
 * the first statement of its payment transaction (Equoria-icqqm), but the arrears
 * handler ran AFTER that transaction aborted — so the lock was already released, and
 * its grace transaction was serialized against nothing. An overlapping second pass
 * whose debit succeeded held the `User` row and then wanted the `Groom` row, while the
 * grace transaction held the `Groom` row and then wanted the `User` row: a textbook
 * deadlock, aborted by Postgres with 40P01, losing either the grace entry (the groom
 * works that week for free and nobody is told) or the second pass's whole payroll for
 * that player.
 *
 * WHAT NOW TAKES IT, precisely — fix round 2 corrected an overstatement here. Every
 * transaction OF THE WEEKLY FEE PASS takes this lock first: the payment transaction in
 * `processWeeklySalaries`, and both arrears transactions (grace and release) in
 * `groomFeeArrearsService`. That closes the deadlock class between them.
 *
 * `hireFreeAgent` does NOT take it, and deliberately: it writes `feeUnpaidSince: null`
 * as part of claiming a free agent, which is fee state, but it cannot contend with the
 * pass over the same groom. `releaseGroomTx` clears `feeUnpaidSince` when it releases,
 * so a free agent always has it NULL already; and a groom in grace has a non-NULL
 * `userId`, so it fails `FREE_AGENT_WHERE` and the claim's guarded `updateMany` matches
 * nothing. It is the ORDER, not this lock, that keeps `hireFreeAgent` out of a cycle
 * with the grace transaction: both write `User` before any staff row.
 *
 * It lives HERE because it is the only module both `groomSalaryService` and
 * `groomFeeArrearsService` already import, so sharing one definition costs no import
 * cycle. Restating the key string in two places is exactly the drift F1 was about.
 *
 * MUST be the first statement of the transaction. `$executeRaw`, not `$queryRaw`:
 * `pg_advisory_xact_lock` returns `void`, which `$queryRaw` cannot deserialize as a
 * column. The blocking variant, not `try_`: a loser should WAIT for the winner's
 * commit and then see its committed rows, not fail spuriously.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {string} userId
 * @param {Date} payWeekStart
 * @returns {Promise<void>}
 */
export async function acquirePayWeekLockTx(tx, userId, payWeekStart) {
  const lockKey = jobNameToLockKey(`groomSalary:${userId}:${payWeekStart.toISOString()}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

/**
 * Open an engagement for a groom who has none. For the two hire paths, where the
 * groom row was just created (direct hire) or just claimed by a guarded
 * conditional update (free-agent hire), so no open row can exist.
 *
 * MUST be called on the same transaction client as the hire, so a rolled-back
 * hire leaves no orphan engagement.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {number} groomId
 * @param {string} userId
 * @returns {Promise<Object>} the created engagement row
 */
export async function openEngagementTx(tx, groomId, userId) {
  if (!tx || typeof tx.groomEngagement?.create !== 'function') {
    throw new Error(
      '[groomEngagementService.openEngagementTx] a Prisma transaction client is required',
    );
  }
  return tx.groomEngagement.create({ data: { groomId, userId } });
}

/**
 * Ensure a groom already carrying a `userId` has an OPEN engagement row.
 * Idempotent backstop for the 101 grooms that predate migration
 * 20260909120000_ypb7d_groom_age_and_engagement, which performs no backfill —
 * the same shape `ensureRetirementSchedule` uses for the retirement age.
 *
 * The partial unique index is what makes it safe: a concurrent second caller's
 * INSERT violates `groom_engagements_active_groomId_key` rather than producing a
 * second open row. That aborts the caller's transaction, which is the correct
 * outcome for the weekly fee pass (its per-user transaction retries or reports a
 * per-user failure); this function deliberately does NOT swallow it.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {number} groomId
 * @param {string} userId
 * @returns {Promise<Object>} the open engagement row (existing or newly created)
 */
export async function ensureEngagementTx(tx, groomId, userId) {
  const open = await tx.groomEngagement.findFirst({
    where: { groomId, endedAt: null },
  });
  if (open) {
    return open;
  }
  return openEngagementTx(tx, groomId, userId);
}

/**
 * Close the open engagement for a groom. A no-op (count 0) for a groom whose
 * engagement predates the table, which is why callers must not assert on 1.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {number} groomId
 * @param {string} reason - one of ENGAGEMENT_END_REASONS
 * @param {Date} endedAt
 * @returns {Promise<number>} rows closed (0 or 1)
 */
export async function endEngagementTx(tx, groomId, reason, endedAt) {
  const closed = await tx.groomEngagement.updateMany({
    where: { groomId, endedAt: null },
    data: { endedAt, endReason: reason },
  });
  return closed.count;
}

/**
 * Release a groom back to the grooms-for-hire pool. GAME-INTERNAL: no HTTP route
 * reaches this, exactly as no route reaches `processRetirement`.
 *
 * Everything the player can observe happens in ONE transaction, in this order:
 *   1. `Groom` freed — a GUARDED conditional update (`updateMany` whose `where`
 *      carries the precondition `userId: <the releasing player>, retired: false`,
 *      then `count === 1`), the Equoria-zvp4 idiom that
 *      `processRetirement` uses for its flip. Two concurrent releases, or a
 *      release racing a re-hire, cannot both win: the loser sees count 0 and
 *      throws, rolling its own transaction back. No `SELECT ... FOR UPDATE` —
 *      the precondition fits in the WHERE clause, so mechanism (2) of the
 *      concurrency rule applies and mechanism (3) is unnecessary.
 *   2. The open `GroomEngagement` row closed with `endedAt` + `endReason`.
 *   3. ACTIVE `GroomAssignment` rows ENDED (`isActive: false` + `endDate`).
 *      Inactive rows — the groom's history — are NOT matched and NOT touched.
 *      Same rule as retirement's invariant I5: never destroy history. A released
 *      groom must not stay assigned to a stranger's horse.
 *   4. Open `GroomAssignmentLog` rows closed with `unassignedAt`.
 *   5. The notification, via `createNotificationTx` on the same `tx`. Losing a
 *      groom silently is the worst outcome in a game about attachment, so the
 *      notice cannot fail independently of the release it announces.
 *
 * Write order is Groom → GroomEngagement → GroomAssignment → GroomAssignmentLog
 * → Notification: ascending by dependency depth. No `User` row is written, so the
 * User-before-Horse-before-staff lock rule is satisfied trivially.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {Object} params
 * @param {number} params.groomId
 * @param {string} params.userId - the player releasing the groom (the precondition)
 * @param {string} params.reason - one of ENGAGEMENT_END_REASONS
 * @param {Object} [params.notificationPayloadExtras] - merged into the notice
 * @param {Date} [params.now]
 * @returns {Promise<{released: Object, endedAssignmentCount: number,
 *   closedAssignmentLogCount: number, horses: Array, notificationId: number,
 *   notificationPayload: Object}>}
 */
export async function releaseGroomTx(tx, params) {
  const { groomId, userId, reason, notificationPayloadExtras = {}, now = new Date() } = params;

  const groom = await tx.groom.findUnique({
    where: { id: groomId },
    select: { id: true, name: true, speciality: true, skillLevel: true, level: true },
  });
  if (!groom) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }

  const freed = await tx.groom.updateMany({
    where: { id: groomId, userId, retired: false },
    data: { userId: null, feeUnpaidSince: null },
  });
  if (freed.count !== 1) {
    throw new Error(
      `Groom ${groomId} was no longer on user ${userId}'s staff when the release ran`,
    );
  }

  await endEngagementTx(tx, groomId, reason, now);

  // Read the assignments about to end BEFORE ending them: `updateMany` returns no
  // rows, and the notice names the horses the player has just lost care on. A
  // player in this game knows every horse by name, so a bare count would be the
  // wrong shape of notice (the same correction Equoria-m9lz1 made to retirement).
  const endingAssignments = await tx.groomAssignment.findMany({
    where: { groomId, isActive: true },
    select: { userId: true, foalId: true, foal: { select: { id: true, name: true } } },
  });

  const endedAssignments = await tx.groomAssignment.updateMany({
    where: { groomId, isActive: true },
    data: { isActive: false, endDate: now },
  });

  const closedLogs = await tx.groomAssignmentLog.updateMany({
    where: { groomId, unassignedAt: null },
    data: { unassignedAt: now },
  });

  // Only the releasing player's own horses are named — plus rows carrying no
  // `userId` of their own, because `GroomAssignment.userId` is `String?` and a
  // null there is far more likely to be this player's own legacy row than someone
  // else's. Fix round 1 (F13) withdraws the stronger claim this comment used to
  // make: a null-`userId` assignment pointing at ANOTHER player's horse would
  // still be named here. Zero such rows exist today (every active assignment
  // shares its `userId` with its groom), and the correct fix is upstream — either
  // make `GroomAssignment.userId` non-null or reject a cross-owner assignment at
  // creation — which is Equoria-m0w8n's ownership-model call, not this story's.
  const horses = endingAssignments
    .filter(a => a.userId === userId || !a.userId)
    .map(a => ({ id: a.foal?.id ?? a.foalId, name: a.foal?.name ?? null }))
    .sort((x, y) => x.id - y.id);

  const notificationPayload = {
    groomId,
    groomName: groom.name,
    speciality: groom.speciality,
    skillLevel: groom.skillLevel,
    level: groom.level,
    reason,
    horsesLeftUnattended: horses.length,
    horses,
    ...notificationPayloadExtras,
  };

  const notification = await createNotificationTx(
    tx,
    userId,
    GROOM_RELEASED_NOTIFICATION_TYPE,
    notificationPayload,
  );

  if (horses.length !== endedAssignments.count) {
    logger.error(
      `[groomEngagementService.releaseGroomTx] Groom ${groomId} left user ${userId} with ` +
        `${endedAssignments.count} active assignment(s) ended but only ${horses.length} named in ` +
        'the notice. A horse lost its groom without its owner being told. Investigate the userId ' +
        'on those GroomAssignment rows.',
    );
  }

  return {
    released: groom,
    endedAssignmentCount: endedAssignments.count,
    closedAssignmentLogCount: closedLogs.count,
    horses,
    notificationId: notification.id,
    notificationPayload,
  };
}

/**
 * Enter the owner's one-week grace period for one groom: the fee for `payWeekStart`
 * went unpaid, so the groom stays on staff but may not groom.
 *
 * Guarded, and the guard is the whole mechanic: the `where` carries
 * `feeUnpaidSince: null`, so re-entering grace cannot move the marker forward and
 * quietly extend the grace period past one week. A second missed week therefore
 * leaves the ORIGINAL pay week recorded, which is exactly what
 * `hasFullUnpaidWeek` needs to fire.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {Object} params
 * @param {number} params.groomId
 * @param {string} params.userId
 * @param {Date} params.payWeekStart
 * @param {number} params.fee
 * @returns {Promise<{entered: boolean, notificationId: number|null,
 *   notificationPayload: Object|null}>} `entered` is false when the groom was
 *   already in grace, in which case nothing is written and the player is not told
 *   twice. The payload is returned so the caller can run
 *   `finalizeNotificationAfterCommit` (ADR-011 stream nudge, ADR-007 prune) with
 *   exactly the payload the stored row carries.
 */
export async function enterFeeGraceTx(tx, params) {
  const { groomId, userId, payWeekStart, fee } = params;

  const marked = await tx.groom.updateMany({
    where: { id: groomId, userId, retired: false, feeUnpaidSince: null },
    data: { feeUnpaidSince: payWeekStart },
  });
  if (marked.count !== 1) {
    return { entered: false, notificationId: null, notificationPayload: null };
  }

  const groom = await tx.groom.findUnique({
    where: { id: groomId },
    select: { name: true, speciality: true, skillLevel: true },
  });

  const notificationPayload = {
    groomId,
    groomName: groom?.name ?? null,
    speciality: groom?.speciality ?? null,
    skillLevel: groom?.skillLevel ?? null,
    weeklyFee: fee,
    payWeekStart: payWeekStart.toISOString(),
    // The consequence, stated in the payload rather than left to prose: the groom
    // is still on staff, cannot work, and leaves if the next pay week arrives
    // with this week still unpaid.
    canWork: false,
    graceWeeks: 1,
  };

  const notification = await createNotificationTx(
    tx,
    userId,
    GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
    notificationPayload,
  );

  return { entered: true, notificationId: notification.id, notificationPayload };
}

/**
 * Has a FULL pay week gone unpaid for this groom?
 *
 * True only when the recorded unpaid pay week is STRICTLY EARLIER than the pay
 * week now being processed. Comparing pay-week starts rather than elapsed
 * milliseconds is deliberate: the fee pass runs at 09:00 UTC on Mondays, so a
 * `now > graceStart + 7 days` test decided the player's fate on a few seconds of
 * cron jitter. Pay weeks are the unit the fee is billed in, so they are the unit
 * the grace period is measured in.
 *
 * @param {Date|null|undefined} feeUnpaidSince
 * @param {Date} payWeekStart - the pay week currently being processed
 * @returns {boolean}
 */
export function hasFullUnpaidWeek(feeUnpaidSince, payWeekStart) {
  if (!feeUnpaidSince) {
    return false;
  }
  return new Date(feeUnpaidSince).getTime() < payWeekStart.getTime();
}

/**
 * May this groom groom a horse right now?
 *
 * PURE, and takes the groom row the caller already fetched, so adding the check
 * to a care path costs no extra query. The three refusals, in the order a caller
 * should report them:
 *   - retired      — the game ended their career (Equoria-m9lz1).
 *   - inactive     — `isActive: false`.
 *   - fee unpaid   — the owner's grace period: "The groom can't groom horse until
 *                    paid for that week but they don't officially lose the groom
 *                    once until they fail to pay for a whole week."
 *
 * @param {{ retired?: boolean, isActive?: boolean, feeUnpaidSince?: Date|null, name?: string }} groom
 * @returns {{ allowed: boolean, reason: string|null, code: string|null }}
 */
export function checkGroomMayWork(groom) {
  if (!groom) {
    return { allowed: false, reason: 'Groom not found', code: 'not_found' };
  }
  if (groom.retired) {
    return {
      allowed: false,
      reason: `${groom.name ?? 'This groom'} has retired and can no longer work.`,
      code: 'retired',
    };
  }
  if (groom.isActive === false) {
    return {
      allowed: false,
      reason: `${groom.name ?? 'This groom'} is not currently working.`,
      code: 'inactive',
    };
  }
  if (groom.feeUnpaidSince) {
    return {
      allowed: false,
      reason:
        `${groom.name ?? 'This groom'} is waiting on this week's fee and cannot work until it ` +
        'is paid. They stay on your staff for one week; after a full week unpaid they return to ' +
        'the grooms for hire.',
      code: 'fee_unpaid',
    };
  }
  return { allowed: true, reason: null, code: null };
}

/**
 * List the grooms-for-hire pool: free agents any player may engage.
 *
 * @param {import('@prisma/client').PrismaClient|Object} client
 * @param {{ limit?: number, skip?: number }} [options]
 * @returns {Promise<{grooms: Array, total: number}>}
 */
export async function listFreeAgents(client, options = {}) {
  const { limit = 20, skip = 0 } = options;
  const [grooms, total] = await Promise.all([
    client.groom.findMany({
      where: FREE_AGENT_WHERE,
      // Explicit projection, NOT a bare findMany: the pool is a player-facing
      // read, and an explicit select is what keeps a future column from
      // appearing here by accident.
      select: {
        id: true,
        name: true,
        speciality: true,
        skillLevel: true,
        personality: true,
        experience: true,
        level: true,
        sessionRate: true,
        bio: true,
        imageUrl: true,
      },
      orderBy: [{ skillLevel: 'desc' }, { experience: 'desc' }, { id: 'asc' }],
      take: limit,
      skip,
    }),
    client.groom.count({ where: FREE_AGENT_WHERE }),
  ]);
  return { grooms, total };
}

export default {
  acquirePayWeekLockTx,
  ENGAGEMENT_END_REASONS,
  GROOM_FEE_UNPAID_NOTIFICATION_TYPE,
  GROOM_RELEASED_NOTIFICATION_TYPE,
  FREE_AGENT_WHERE,
  openEngagementTx,
  ensureEngagementTx,
  endEngagementTx,
  releaseGroomTx,
  enterFeeGraceTx,
  hasFullUnpaidWeek,
  checkGroomMayWork,
  listFreeAgents,
};
