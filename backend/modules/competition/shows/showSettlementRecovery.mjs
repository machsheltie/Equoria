/**
 * Finding the ridden shows that settled only in part (Equoria-cmw85.2).
 *
 * executeClosedShows writes a show 'completed' BEFORE it pays its entries
 * (Equoria-koodu claim-then-process, so a retry can never double-pay) and
 * discards Show.stagedOrdering only after every placement has settled. A show
 * that is 'completed' and still holds its stagedOrdering is therefore the
 * record of placements that were never paid: an entry's transaction failed and
 * rolled back, or the process died mid-payout. Each entry settles in ONE
 * transaction that creates its competitionResult first, so "this horse has a
 * result row for the show" means "this entry is fully settled", and re-driving
 * a show means settling only the staged placements that have no result row.
 *
 * The scan is raw SQL because `stagedOrdering IS NOT NULL` on a JSONB column
 * needs the Prisma.DbNull identity that showExecutionService documents it
 * avoids (Equoria-27xvj).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { lockUserRowsTx } from './showEscrowTx.mjs';

/**
 * How long after a show's run began its payout is left alone. A healthy payout
 * takes seconds and is still 'completed' with its staged ordering while it runs,
 * so a scan inside that window would race it for the same placements: the unique
 * result row would abort the loser before money moved, but the loser would log a
 * false failure. Matches the half-hour cadence of the nightly maintenance and
 * reaper jobs, so a half-settled show is retried the next time either runs after
 * it. It applies to a show named by id too (a concurrent executor is named the
 * same way).
 */
export const recoveryGraceMs = 30 * 60 * 1000;

/**
 * Ids of the ridden shows still holding unpaid placements.
 *
 * @param {{ now: Date, showIds: number[] | null }} params
 *   `showIds`, when given, narrows the scan to those shows (an admin POST
 *   /shows/execute, or a test); null scans every show. Either way a show whose
 *   run began less than recoveryGraceMs ago is not due.
 * @returns {Promise<number[]>}
 */
export async function findPartiallySettledShowIds({ now, showIds }) {
  const named = Array.isArray(showIds) && showIds.length > 0 ? showIds : null;
  const rows = named
    ? await prisma.$queryRaw`
        SELECT "id" FROM "shows"
        WHERE "status" = 'completed' AND "showType" <> 'conformation'
          AND "stagedOrdering" IS NOT NULL AND "id" = ANY(${named})`
    : await prisma.$queryRaw`
        SELECT "id" FROM "shows"
        WHERE "status" = 'completed' AND "showType" <> 'conformation'
          AND "stagedOrdering" IS NOT NULL`;
  if (rows.length === 0) {
    return [];
  }
  // The grace period is applied through the client, not in the raw SQL: a Date bound
  // there is compared to the zone-less executedAt column in the database session's
  // zone, which skews it by the local UTC offset.
  const settled = await prisma.show.findMany({
    where: {
      id: { in: rows.map(r => r.id) },
      executedAt: { lte: new Date(now.getTime() - recoveryGraceMs) },
    },
    select: { id: true },
  });
  return settled.map(s => s.id);
}

/** Each placing's share of the prize: 1st / 2nd / 3rd. */
const prizeSlots = [0.5, 0.3, 0.2];

/**
 * Which staged placements still need paying, and what each is paid.
 *
 * Moved verbatim out of settleRiddenShow, with `settledHorseIds` (the horses
 * whose result row already exists) added for a re-drive; a first run passes an
 * empty set and gets exactly the amounts it always did.
 *
 * Placed shares round down; with 3+ entrants the rounding remainder goes to the
 * winner so the three shares sum to the whole prize (Equoria-w7fnz, owner ruling
 * 2026-10-19). With fewer than 3 entrants the unpaid share goes back to the
 * creator, paid inside the 1st-place transaction: the refund is the rest of the
 * escrow after the placings still to pay, so on a re-drive that already paid
 * some placings it is computed from what is left, never from the full prize.
 * Only an escrow-funded show has escrow to refund (the same test the payout
 * uses), and a refund already paid with the winner is never paid again.
 *
 * @param {{ prize: number, prizeEscrow: number }} show
 * @param {Array<{ horseId: number, placement: number }>} stagedOrdering - the whole ordering
 * @param {Set<number>} settledHorseIds
 * @returns {{ pending: Array<{ staged: object, prize: number }>, unpaidPrizeShare: number }}
 */
export function planPlacementPayouts(show, stagedOrdering, settledHorseIds) {
  const totalPrize = Math.max(0, show.prize);
  const floorShare = placement => Math.floor(totalPrize * (prizeSlots[placement - 1] ?? 0));
  const prizeFor = placement =>
    placement === 1 && stagedOrdering.length >= prizeSlots.length
      ? totalPrize - floorShare(2) - floorShare(3)
      : floorShare(placement);

  const pending = stagedOrdering
    .filter(staged => !settledHorseIds.has(staged.horseId))
    .map(staged => ({ staged, prize: prizeFor(staged.placement) }));
  const paidSoFar = stagedOrdering
    .filter(staged => settledHorseIds.has(staged.horseId))
    .reduce((sum, staged) => sum + prizeFor(staged.placement), 0);
  const pendingTotal = pending.reduce((sum, p) => sum + p.prize, 0);
  const winnerPending = pending.some(p => p.staged.placement === 1);
  const unpaidPrizeShare =
    stagedOrdering.length < prizeSlots.length &&
    winnerPending &&
    show.prizeEscrow >= totalPrize - paidSoFar
      ? show.prizeEscrow - pendingTotal
      : 0;
  return { pending, unpaidPrizeShare };
}

/**
 * The players one placement's payout writes: the entrant (the prize) and, when
 * the winner's payout carries the unpaid prize share, the show's creator (the
 * refund). The payout locks them FIRST, before the show and the escrow
 * account, in the entry's order (Equoria-ifnhc).
 *
 * @param {{ createdByUserId: string|null }} show
 * @param {{ userId: string, placement: number }} staged
 * @param {number} unpaidPrizeShare
 * @returns {string[]}
 */
export function payoutUserIds(show, staged, unpaidPrizeShare) {
  const refunds = staged.placement === 1 && unpaidPrizeShare > 0 && show.createdByUserId;
  return refunds ? [staged.userId, show.createdByUserId] : [staged.userId];
}

/**
 * Claim one staged placement for a recovery's payout transaction
 * (Equoria-ifnhc). Recovery has no show-level claim: an admin run and the
 * nightly run can finish the same half-settled show at once. Each recovery
 * payout locks its User rows (payoutUserIds), then the show row here, so they
 * run one at a time; the one that finds the placement's result row already
 * written (the first write of a settled payout) has nothing to pay. That is a
 * no-op, not a failure: nothing is logged, counted toward quarantine or
 * returned as an error. A first run is claimed by its open -> executing
 * update instead, so a result row before its payout stays a failure.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ id: number, createdByUserId: string|null }} show
 * @param {{ horseId: number, userId: string, placement: number }} staged
 * @param {number} unpaidPrizeShare
 * @returns {Promise<boolean>} true when the placement is still unpaid
 */
export async function claimUnsettledPlacementTx(tx, show, staged, unpaidPrizeShare) {
  await lockUserRowsTx(tx, payoutUserIds(show, staged, unpaidPrizeShare));
  await tx.$queryRaw`SELECT "id" FROM "shows" WHERE "id" = ${show.id} FOR NO KEY UPDATE`;
  const settled = await tx.competitionResult.findUnique({
    where: { showIdHorseId: { showId: show.id, horseId: staged.horseId } },
    select: { id: true },
  });
  return settled === null;
}

/**
 * The ordering a half-settled show replays, or null when it cannot be trusted.
 * Same shape guard as readStagedOrdering, but the roster is allowed to have
 * shrunk (an entrant erased since the run): the staged placing of an entrant
 * that is gone is simply skipped by the caller, and the others still settle.
 *
 * @param {{ stagedOrdering: unknown }} show
 * @returns {Array<{ horseId: number, userId: string, horseName: string|null, score: number, placement: number, riderId: number|null }>|null}
 */
export function readRecoverableOrdering(show) {
  const so = show.stagedOrdering;
  if (!Array.isArray(so) || so.length === 0) {
    return null;
  }
  const valid = so.every(
    m =>
      m !== null &&
      typeof m === 'object' &&
      !Array.isArray(m) &&
      Number.isInteger(m.horseId) &&
      typeof m.userId === 'string' &&
      typeof m.score === 'number' &&
      Number.isInteger(m.placement) &&
      m.placement >= 1,
  );
  return valid ? so : null;
}

/**
 * Set shows.stagedOrdering to SQL NULL (Equoria-c7mx0). Raw parameterized SQL
 * rather than `data: { stagedOrdering: Prisma.DbNull }` because the DbNull
 * sentinel is identity-checked by the client. Root cause (Equoria-27xvj): under
 * a single-process Jest run the sandbox reused a client cached by the host's
 * globalSetup while importing its own copy of @prisma/client, so the sentinel
 * and the client came from different runtime copies and DbNull serialized as
 * `{}`. packages/database/prismaClient.mjs now exports the namespace that
 * belongs to the cached client and
 * backend/__tests__/prismaNamespaceMatchesSharedClient.integration.test.mjs
 * pins it; this raw SQL is kept as it is, unambiguous in every runtime.
 * Id-scoped by construction.
 */
export async function clearStagedOrdering(showId, client = prisma) {
  await client.$executeRaw`UPDATE "shows" SET "stagedOrdering" = NULL WHERE "id" = ${showId}`;
}

/**
 * Owner ruling 2026-10-23 (Equoria-o1vns, q56): a show whose payout cannot be
 * finished after this many failed tries is quarantined, like a show the reaper
 * gives up on (Equoria-c7mx0.1). Same count and same column.
 */
export const maxSettlementAttempts = 3;

/**
 * Count one failed payout run of a 'completed' show; the third quarantines it.
 *
 * A show that keeps a placing it can never pay (broken entry data) used to be
 * re-driven at every scan for ever, keeping cron red. Both writes are guarded
 * on the show still being 'completed', so a show the owner has already run, or
 * a concurrent run that counted first, is never touched twice. A quarantined
 * show keeps its staged ordering and its escrow for the owner's Run Show; no
 * scan selects it ('completed' is the half-settled scan's predicate).
 *
 * @param {number} showId
 * @returns {Promise<'quarantined'|'counted'|'skipped'>}
 */
export async function recordFailedSettlementAttempt(showId) {
  const fence = { id: showId, status: 'completed' };
  const quarantined = await prisma.show.updateMany({
    where: { ...fence, executionAttempts: { gte: maxSettlementAttempts - 1 } },
    data: { status: 'quarantined', executionAttempts: { increment: 1 } },
  });
  if (quarantined.count === 1) {
    return 'quarantined';
  }
  const counted = await prisma.show.updateMany({
    where: fence,
    data: { executionAttempts: { increment: 1 } },
  });
  return counted.count === 1 ? 'counted' : 'skipped';
}
