/**
 * userRankSnapshotService.mjs
 *
 * Equoria-dbdk — Scheduled capture of UserRankSnapshot rows.
 * Equoria-ky0x — set-based rewrite (perf): the previous implementation
 *   recomputed three full GROUP BY aggregations *inside* a per-user loop,
 *   i.e. O(users) × O(full-table aggregate) ≈ O(N²). On the canonical
 *   production dataset (~4.9k users) that exceeded the 60s cron/Jest
 *   window. This version computes each global ranking exactly once with a
 *   single aggregate query, then assigns every user's rank from in-memory
 *   sorted totals — O(N log N), one bulk insert. Rank semantics are
 *   byte-identical to the old per-user formula (see RANK SEMANTICS below).
 *
 * Mirrors the inner logic of leaderboardController.captureRankSnapshots so
 * the nightly cron writes the same numbers the admin HTTP route would.
 *
 * RANK SEMANTICS (preserved exactly from the original per-user formula):
 *   - level: rank = (# users with level > L, OR level == L AND xp > X) + 1.
 *   - xp / horse-earnings / horse-performance: only users that actually
 *     have at least one contributing row (xp_events / horses-with-userId /
 *     competition_results joined to an owned horse) participate in the
 *     "ahead" population — exactly as the original HAVING-filtered
 *     subqueries did. A user's metric total is the SUM (or MAX, for
 *     performance) of their contributing rows; users with no contributing
 *     rows have total 0. rank = (# participating users whose total is
 *     strictly greater than this user's total) + 1. A zero-total user
 *     therefore ranks behind every participating user with a positive
 *     total, identical to the old `targetTotal = 0` → `HAVING SUM > 0`
 *     behaviour.
 */

import defaultPrisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Given a Map of userId -> numeric total for the *participating* population,
 * return a function rank(total) = (# participating totals strictly greater)
 * + 1. Implemented with a sorted-descending array + binary search so the
 * whole ranking is O(P log P) for P participants and O(log P) per lookup.
 *
 * @param {number[]} totals participating totals (one per participating user)
 */
function buildRanker(totals) {
  const sortedDesc = [...totals].sort((a, b) => b - a);

  // Number of entries strictly greater than `value` = index of the first
  // entry that is <= value in the descending array (lower bound).
  return function rank(value) {
    let lo = 0;
    let hi = sortedDesc.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedDesc[mid] > value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo + 1;
  };
}

/**
 * Capture one batch of rank snapshots (level, xp, horse-earnings,
 * horse-performance) for every user. Returns the number of users processed.
 *
 * @param {object} [prismaClient] Optional Prisma client (or $extends proxy)
 *   for dependency injection in tests / shared call sites. Defaults to the
 *   module singleton — existing callers are unaffected.
 * @returns {Promise<{captured: number}>}
 */
export async function captureAllUserRankSnapshots(prismaClient = defaultPrisma) {
  const prisma = prismaClient;
  // ---- 1. Single global reads (no per-user loop) -------------------------
  const [users, xpGroups, earningsGroups, perfGroups] = await Promise.all([
    prisma.user.findMany({ select: { id: true, level: true, xp: true } }),
    // SUM(amount) per userId over xp_events — only users with events appear.
    prisma.xpEvent.groupBy({ by: ['userId'], _sum: { amount: true } }),
    // SUM(totalEarnings) per owning userId over horses (userId NOT NULL).
    prisma.horse.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _sum: { totalEarnings: true },
    }),
    // MAX(score) per owning userId over competition_results -> owned horse.
    // groupBy can't traverse the relation, so aggregate from the rows: pull
    // (horseId, score) joined to owner via a raw query (one scan, not N).
    prisma.$queryRaw`
      SELECT h."userId" AS "userId", MAX(cr.score) AS "maxScore"
      FROM competition_results cr
      JOIN horses h ON cr."horseId" = h.id
      WHERE h."userId" IS NOT NULL
      GROUP BY h."userId"`,
  ]);

  // ---- 2. Build participating-population totals + rankers -----------------
  const xpTotalByUser = new Map();
  for (const g of xpGroups) {
    xpTotalByUser.set(g.userId, Number(g._sum.amount ?? 0));
  }
  const earningsTotalByUser = new Map();
  for (const g of earningsGroups) {
    earningsTotalByUser.set(g.userId, Number(g._sum.totalEarnings ?? 0));
  }
  const perfMaxByUser = new Map();
  for (const row of perfGroups) {
    const score = row.maxScore;
    perfMaxByUser.set(row.userId, score === null || score === undefined ? 0 : Number(score));
  }

  const rankXp = buildRanker([...xpTotalByUser.values()]);
  const rankEarnings = buildRanker([...earningsTotalByUser.values()]);
  const rankPerf = buildRanker([...perfMaxByUser.values()]);

  // level rank needs the strict (level, xp) ordering. Sort once descending
  // by (level, xp); a user's rank = (# users strictly ahead) + 1, where
  // "strictly ahead" = higher level, or same level with higher xp.
  const byLevel = [...users].sort((a, b) =>
    b.level !== a.level ? b.level - a.level : b.xp - a.xp,
  );
  // Precompute, for each distinct (level,xp) key, how many users are
  // strictly ahead. Walking the sorted array once: everyone before the
  // first row with this exact (level,xp) is strictly ahead.
  const levelRankByKey = new Map();
  for (let i = 0; i < byLevel.length; i++) {
    const key = `${byLevel[i].level}:${byLevel[i].xp}`;
    if (!levelRankByKey.has(key)) {
      levelRankByKey.set(key, i + 1); // i users strictly ahead → rank i+1
    }
  }

  // ---- 3. Assemble all snapshot rows -------------------------------------
  const data = [];
  for (const u of users) {
    const xpTotal = xpTotalByUser.get(u.id) ?? 0;
    const earningsTotal = earningsTotalByUser.get(u.id) ?? 0;
    const perfMax = perfMaxByUser.get(u.id) ?? 0;

    data.push(
      { userId: u.id, category: 'level', rank: levelRankByKey.get(`${u.level}:${u.xp}`) },
      { userId: u.id, category: 'xp', rank: rankXp(xpTotal) },
      { userId: u.id, category: 'horse-earnings', rank: rankEarnings(earningsTotal) },
      { userId: u.id, category: 'horse-performance', rank: rankPerf(perfMax) },
    );
  }

  // ---- 4. One bulk insert ------------------------------------------------
  // Equoria-fiiy: between the user read (step 1) and this insert, a user row
  // can be deleted (account deletion, concurrent test-fixture cleanup on the
  // canonical DB). The old per-user loop tolerated this by `continue`-ing on
  // a missing user; the bulk insert must not regress that into a hard
  // FK-violation failure of the whole nightly job. On P2003 (foreign-key
  // violation) we re-read the set of user IDs that still exist and retry the
  // insert filtered to those rows. A user deleted in the final micro-window
  // simply gets no snapshot this run — correct behaviour, not an error.
  let captured = 0;
  if (data.length > 0) {
    try {
      const result = await prisma.userRankSnapshot.createMany({ data });
      captured = users.length;
      logger.info(
        `[userRankSnapshotService.captureAllUserRankSnapshots] Inserted ${result.count} snapshot rows for ${captured} users`,
      );
    } catch (err) {
      if (err?.code !== 'P2003') {
        logger.error(
          `[userRankSnapshotService.captureAllUserRankSnapshots] Bulk insert failed: ${err.message}`,
        );
        throw err;
      }
      // A user vanished mid-run. Re-read existing IDs, drop snapshot rows for
      // the now-missing users, retry once. Still O(1) extra queries — NOT a
      // per-user loop.
      logger.warn(
        '[userRankSnapshotService.captureAllUserRankSnapshots] FK violation (user deleted mid-run); retrying with existing users only',
      );
      const existing = await prisma.user.findMany({ select: { id: true } });
      const existingIds = new Set(existing.map(u => u.id));
      const filtered = data.filter(row => existingIds.has(row.userId));
      const result = await prisma.userRankSnapshot.createMany({ data: filtered });
      captured = filtered.length / 4; // 4 category rows per user
      logger.info(
        `[userRankSnapshotService.captureAllUserRankSnapshots] Retry inserted ${result.count} snapshot rows for ${captured} users (post-deletion filter)`,
      );
    }
  } else {
    logger.info(
      '[userRankSnapshotService.captureAllUserRankSnapshots] No users — nothing captured',
    );
  }

  return { captured };
}
