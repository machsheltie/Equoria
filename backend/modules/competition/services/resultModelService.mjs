import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  InvalidCursorError,
  clampLimit,
  findKeysetPage,
} from '../../../utils/paginationHelper.mjs';

// A player cannot meaningfully open more shows' results than this in one visit,
// and the bound keeps an `IN (...)` list from growing without limit. The route's
// validator rejects anything longer before this service is reached; the constant
// lives here so the service is safe for any future caller too.
const MAX_MARK_VIEWED_SHOWS = 100;

/**
 * The most rows a horse's result list returns (Equoria-cmw85.12; a show's list
 * is bounded the same way in competitionResultRecord.getShowResultsView),
 * the same ceiling getResultsByUser applies.
 */
const resultListLimit = 100;

/**
 * What a result list returns per row (Equoria-cmw85.12): the result's own
 * columns, the horse's id, name and breed, and the show's public fields. Never
 * whole horse rows (genotype, colour genotype, epigenetic modifiers and the
 * other JSONB columns) or the show's settlement internals (staged ordering of
 * every entrant, escrow columns, creator).
 */
const resultListRowSelect = {
  id: true,
  horseId: true,
  showId: true,
  score: true,
  placement: true,
  discipline: true,
  runDate: true,
  showName: true,
  prizeWon: true,
  horsePointsAwarded: true,
  createdAt: true,
  horse: { select: { id: true, name: true, breed: { select: { id: true, name: true } } } },
  show: {
    select: {
      id: true,
      name: true,
      discipline: true,
      showType: true,
      status: true,
      runDate: true,
      executedAt: true,
      prize: true,
      entryFee: true,
    },
  },
};

/**
 * One keyset page of a horse's competition results (Equoria-cmw85.20): newest
 * first, ties on the run date broken by id, so a result written while the owner
 * pages is neither skipped nor repeated. `cursor` continues a list; `skip` is the
 * legacy offset. The page size is the shared clamp (default and maximum 100).
 *
 * @param {number} horseId - Horse ID
 * @param {{ limit?: unknown, cursor?: unknown, skip?: number }} [paging]
 * @returns {Promise<{ items: Array, pageInfo: { nextCursor: string|null, hasMore: boolean } }>}
 *   items carry each result's horse and show (scoped; statGains included: the
 *   callers are the horse's owner)
 * @throws {InvalidCursorError} on a cursor that cannot be decoded
 */
async function getResultsPageByHorse(horseId, { limit, cursor = null, skip = 0 } = {}) {
  // Validate horseId
  const numericId = parseInt(horseId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new Error('Horse ID must be a positive integer');
  }

  try {
    const page = await findKeysetPage(args => prisma.competitionResult.findMany(args), {
      where: { horseId: numericId },
      sort: [
        { key: 'runDate', dir: 'desc', type: 'date' },
        { key: 'id', dir: 'desc', type: 'int' },
      ],
      limit: clampLimit(limit, { def: resultListLimit, max: resultListLimit }),
      cursor,
      skip,
      extra: { select: { ...resultListRowSelect, statGains: true } },
    });

    logger.info(
      `[resultModel.getResultsPageByHorse] Found ${page.items.length} results for horse ${numericId}`,
    );
    return page;
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      throw error;
    }
    logger.error('[resultModel.getResultsPageByHorse] Database error: %o', error);
    throw new Error(`Database error in getResultsByHorse: ${error.message}`, { cause: error });
  }
}

/**
 * Get a horse's newest competition results (the first page of
 * getResultsPageByHorse)
 * @param {number} horseId - Horse ID
 * @returns {Array} - The horse's newest results (at most 100), newest first,
 *   each with its horse and show (scoped; statGains included — the callers are
 *   the horse's owner)
 */
async function getResultsByHorse(horseId) {
  const { items } = await getResultsPageByHorse(horseId);
  return items;
}

/**
 * Get results by user ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} Competition results for user's horses
 */
async function getResultsByUser(userId, options = {}) {
  const { limit = 50, offset = 0, discipline = null } = options;

  const whereClause = {
    horse: {
      userId,
    },
  };

  if (discipline) {
    whereClause.discipline = discipline;
  }

  const results = await prisma.competitionResult.findMany({
    where: whereClause,
    omit: { scoreInputs: true }, // Equoria-4q02c: staff only, never a player surface
    include: {
      horse: {
        include: {
          breed: true,
        },
      },
      show: true,
    },
    orderBy: {
      runDate: 'desc',
    },
    take: Math.min(limit, 100),
    skip: Math.max(offset, 0),
  });

  logger.info(
    `[resultModel.getResultsByUser] Retrieved ${results.length} results for user ${userId}`,
  );
  return results;
}

/**
 * The result id of each horse's first-ever win (Equoria-oey96.41, owner ruling
 * 2026-10-23): its earliest 1st place, by run date then id. Derived from the
 * settled results themselves, so it needs no column and a horse can only ever
 * have one first win — settlement writes the results, and the earliest winning
 * row is the mark. Read over the horses' whole history, not the listed page.
 *
 * @param {number[]} horseIds
 * @returns {Promise<Set<number>>}
 */
async function getFirstWinResultIds(horseIds) {
  if (horseIds.length === 0) {
    return new Set();
  }
  const firstWins = await prisma.competitionResult.findMany({
    where: { horseId: { in: horseIds }, placement: 1 },
    orderBy: [{ horseId: 'asc' }, { runDate: 'asc' }, { id: 'asc' }],
    distinct: ['horseId'],
    select: { id: true },
  });
  return new Set(firstWins.map(r => r.id));
}

/**
 * Build the CompetitionResultSummary[] payload for the CompetitionResultsPage
 * My Results list. Groups the users raw results by show and enriches each
 * group with totalParticipants + a per-horse rank (Equoria-oey96.5).
 *
 * Design notes:
 *   - Ownership scoping delegated to getResultsByUser (horse.userId).
 *   - Rank resolution: prefer the persisted placement string (1st/2nd/3rd)
 *     as the authoritative game-generated rank; fall back to position
 *     within the show ordered by score DESC when placement is null
 *     (below top 3). Score is Decimal(10,2) so exact ties are rare.
 *   - Runs one extra findMany to fetch peer results for the distinct set
 *     of shows the user touched. Cheap even with hundreds of shows
 *     because we only select { id, showId, horseId, score, placement }.
 *
 * @param {string} userId - Authenticated users id.
 * @returns {Promise<Array>} Array of CompetitionResultSummary-shaped rows,
 *   already sorted newest-first (via getResultsByUser).
 */
async function getUserResultsSummary(userId) {
  const rawResults = await getResultsByUser(userId, { limit: 100, offset: 0 });
  if (rawResults.length === 0) {
    return [];
  }

  const showIds = Array.from(new Set(rawResults.map(r => r.showId)));
  const firstWinIds = await getFirstWinResultIds(
    Array.from(new Set(rawResults.map(r => r.horseId))),
  );
  const allShowResults = await prisma.competitionResult.findMany({
    where: { showId: { in: showIds } },
    orderBy: [{ showId: 'asc' }, { score: 'desc' }],
    select: { showId: true, horseId: true, score: true, placement: true },
  });

  const resultsByShow = new Map();
  for (const r of allShowResults) {
    if (!resultsByShow.has(r.showId)) {
      resultsByShow.set(r.showId, []);
    }
    resultsByShow.get(r.showId).push(r);
  }

  const placementToRank = placement => {
    if (!placement) {
      return null;
    }
    const m = String(placement).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };
  const rankFromPosition = (showId, horseId) => {
    const list = resultsByShow.get(showId) || [];
    const idx = list.findIndex(r => r.horseId === horseId);
    return idx >= 0 ? idx + 1 : 0;
  };

  const summariesByShow = new Map();
  for (const r of rawResults) {
    const showId = r.showId;
    if (!summariesByShow.has(showId)) {
      summariesByShow.set(showId, {
        competitionId: showId,
        competitionName: r.show?.name ?? r.showName,
        discipline: r.discipline,
        date: (r.runDate instanceof Date ? r.runDate : new Date(r.runDate)).toISOString(),
        totalParticipants: (resultsByShow.get(showId) || []).length,
        prizePool: Number(r.show?.prize ?? 0),
        userResults: [],
      });
    }
    summariesByShow.get(showId).userResults.push({
      horseId: r.horseId,
      horseName: r.horse?.name ?? 'Unknown',
      rank: placementToRank(r.placement) ?? rankFromPosition(showId, r.horseId),
      score: Number(r.score),
      prizeWon: Number(r.prizeWon ?? 0),
      // Horse Points recorded at settlement; null on legacy rows, never a fake 0
      // (Equoria-q4uem.10, owner rulings R6/R7; was a hard-coded xpGained: 0).
      horsePointsAwarded: r.horsePointsAwarded ?? null,
      // Equoria-oey96.41: this is the horse's first-ever win, and whether the
      // player has opened it yet (the viewedAt latch) — together they let the
      // results screen celebrate a first win exactly once.
      isFirstWin: firstWinIds.has(r.id),
      viewed: r.viewedAt !== null,
    });
  }

  return Array.from(summariesByShow.values());
}

/**
 * Mark the caller's competition results for the given shows as viewed
 * (Equoria-oey96.28).
 *
 * This is the write half of the Story 23.4 `check-results` next-action: the hub
 * keeps nudging the player while any of their results still has `viewedAt`
 * NULL, and opening the results surface is what clears it.
 *
 * OWNERSHIP. The `where` clause reaches through the horse relation
 * (`horse: { userId } `), so a caller can only ever stamp results belonging to
 * horses they own. A show id naming somebody else's result is simply not
 * matched — there is no id-guessing surface here, and no row is read back.
 *
 * ONE-WAY LATCH. `viewedAt: null` is part of the filter, so an already-viewed
 * result keeps its original timestamp. Calling this repeatedly is idempotent and
 * reports 0 after the first time.
 *
 * TRANSACTION. The update is a player-state mutation, so it commits inside a
 * transaction and a transient timeout is mapped to a retryable 503 rather than a
 * 500 (the same treatment every other client-facing mutation gets; pinned by
 * backend/__tests__/retryableTransactionWrapping.sentinel.test.mjs). It writes
 * exactly one table, so no lock-ordering question arises.
 *
 * @param {string} userId - Owner id, always derived from req.user.id.
 * @param {number[]} showIds - Shows whose results the player has just seen.
 * @returns {Promise<number>} How many rows were newly marked viewed.
 */
async function markUserResultsViewed(userId, showIds) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!Array.isArray(showIds) || showIds.length === 0) {
    throw new Error('At least one show ID is required');
  }
  if (showIds.length > MAX_MARK_VIEWED_SHOWS) {
    throw new Error(`At most ${MAX_MARK_VIEWED_SHOWS} show IDs may be marked at once`);
  }
  if (!showIds.every(id => Number.isInteger(id) && id > 0)) {
    throw new Error('Show IDs must be positive integers');
  }

  const uniqueShowIds = Array.from(new Set(showIds));

  return withRetryableTxMapping(
    prisma.$transaction(async tx => {
      const { count } = await tx.competitionResult.updateMany({
        where: {
          showId: { in: uniqueShowIds },
          viewedAt: null,
          horse: { userId },
        },
        data: { viewedAt: new Date() },
      });
      return count;
    }),
    { message: 'Could not mark those results as viewed just now. Please try again.' },
  );
}

export {
  getResultsByHorse,
  getResultsPageByHorse,
  getResultsByUser,
  getUserResultsSummary,
  markUserResultsViewed,
};
