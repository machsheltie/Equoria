/**
 * backfillLeaderboardMonthlyTotals.mjs (Equoria-y3nia)
 *
 * One-off, idempotent fill of the monthly leaderboard totals from history, for
 * the months before the totals were kept:
 *   - competition_results -> shows, wins, earnings (prizeWon), and per-discipline
 *     wins for each horse, and shows, wins, earnings for each horse's owner;
 *   - xp_events -> each player's xp;
 *   - horse_xp_events -> each horse's points.
 * A result or event belongs to the Eastern game month of its run date or
 * timestamp (America/New_York, like every game clock).
 *
 * Every figure is SET to what the history says, never added, so a second run
 * writes nothing new and a re-run after a partial one is safe. A result is
 * credited to the horse's CURRENT owner, because results do not record who
 * owned the horse on the day; live settlements record the owner of the day.
 * Run it in a quiet moment: a settlement landing between its read and its write
 * for the current month would be set back to the history it read.
 *
 * Usage (never run against production without the owner's say-so):
 *   node backend/scripts/backfillLeaderboardMonthlyTotals.mjs --dry-run   # counts, writes nothing
 *   node backend/scripts/backfillLeaderboardMonthlyTotals.mjs --apply     # fills the tables
 * Without --apply it is a dry run.
 */

import { fileURLToPath } from 'node:url';
import prisma, { Prisma } from '../../packages/database/prismaClient.mjs';

// The columns are timestamp without time zone holding UTC instants: read them as UTC first.
const month = column =>
  Prisma.sql`to_char((${column} AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York', 'YYYY-MM')`;

/** Rows (month, category, subjectId, value) the history says each table holds. */
const historicalRows = {
  player: Prisma.sql`
    SELECT ${month(Prisma.sql`r."runDate"`)} AS "month", c."category", h."userId" AS "subjectId", c."value"
    FROM (
      SELECT r."id", 'shows' AS "category", 1 AS "value" FROM "competition_results" r WHERE r."placement" IS NOT NULL
      UNION ALL
      SELECT r."id", 'wins', 1 FROM "competition_results" r WHERE r."placement" = 1
      UNION ALL
      SELECT r."id", 'earnings', ROUND(r."prizeWon")::int FROM "competition_results" r WHERE r."placement" IS NOT NULL AND r."prizeWon" > 0
    ) c
    JOIN "competition_results" r ON r."id" = c."id"
    JOIN "horses" h ON h."id" = r."horseId"
    WHERE h."userId" IS NOT NULL
    UNION ALL
    SELECT ${month(Prisma.sql`e."timestamp"`)}, 'xp', e."userId", e."amount"
    FROM "xp_events" e WHERE e."amount" > 0`,
  horse: Prisma.sql`
    SELECT ${month(Prisma.sql`r."runDate"`)} AS "month", c."category", r."horseId" AS "subjectId", c."value"
    FROM (
      SELECT r."id", 'shows' AS "category", 1 AS "value" FROM "competition_results" r WHERE r."placement" IS NOT NULL
      UNION ALL
      SELECT r."id", 'wins', 1 FROM "competition_results" r WHERE r."placement" = 1
      UNION ALL
      SELECT r."id", 'earnings', ROUND(r."prizeWon")::int FROM "competition_results" r WHERE r."placement" IS NOT NULL AND r."prizeWon" > 0
      UNION ALL
      SELECT r."id", 'disciplineWins:' || r."discipline", 1 FROM "competition_results" r WHERE r."placement" = 1
    ) c
    JOIN "competition_results" r ON r."id" = c."id"
    UNION ALL
    SELECT ${month(Prisma.sql`e."timestamp"`)}, 'points', e."horseId", e."amount"
    FROM "horse_xp_events" e WHERE e."amount" > 0`,
};

/** The history summed per row; `userIds` limits it to those players and their horses. */
const summed = (kind, userIds) => {
  const scope =
    userIds === undefined
      ? Prisma.empty
      : kind === 'player'
        ? Prisma.sql`WHERE "subjectId" = ANY(${userIds})`
        : Prisma.sql`WHERE "subjectId" IN (SELECT "id" FROM "horses" WHERE "userId" = ANY(${userIds}))`;
  return Prisma.sql`
  SELECT "month", "category", "subjectId", SUM("value")::int AS "value"
  FROM (${historicalRows[kind]}) AS "history"
  ${scope}
  GROUP BY "month", "category", "subjectId"`;
};

/** How many rows of each table the history would add or change. */
async function countPending(db, userIds) {
  const players = await db.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "pending" FROM (${summed('player', userIds)}) h
    LEFT JOIN "player_monthly_totals" t
      ON t."month" = h."month" AND t."category" = h."category" AND t."playerId" = h."subjectId"
    WHERE t."value" IS DISTINCT FROM h."value"`);
  const horses = await db.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS "pending" FROM (${summed('horse', userIds)}) h
    LEFT JOIN "horse_monthly_totals" t
      ON t."month" = h."month" AND t."category" = h."category" AND t."horseId" = h."subjectId"
    WHERE t."value" IS DISTINCT FROM h."value"`);
  return { players: Number(players[0].pending), horses: Number(horses[0].pending) };
}

/**
 * Fill the monthly totals from history.
 *
 * @param {{ dryRun?: boolean, db?: object, userIds?: string[] }} [options] dryRun
 *   defaults to true; userIds limits the run to those players and their horses (the
 *   tests use it to touch only rows they own; the command line runs on everyone).
 * @returns {Promise<{ dryRun: boolean, pending: { players: number, horses: number },
 *   written: { players: number, horses: number } }>} pending is what the history
 *   would add or change before the run; written is what the run wrote.
 */
export async function backfillLeaderboardMonthlyTotals({
  dryRun = true,
  db = prisma,
  userIds,
} = {}) {
  if (dryRun) {
    return {
      dryRun: true,
      pending: await countPending(db, userIds),
      written: { players: 0, horses: 0 },
    };
  }
  return db.$transaction(
    async tx => {
      const pending = await countPending(tx, userIds);
      const players = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "player_monthly_totals" ("month", "category", "playerId", "value")
        SELECT "month", "category", "subjectId", "value" FROM (${summed('player', userIds)}) h
        ORDER BY "month", "category", "subjectId"
        ON CONFLICT ("month", "category", "playerId") DO UPDATE SET "value" = EXCLUDED."value"
        WHERE "player_monthly_totals"."value" IS DISTINCT FROM EXCLUDED."value"`);
      const horses = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "horse_monthly_totals" ("month", "category", "horseId", "value")
        SELECT "month", "category", "subjectId", "value" FROM (${summed('horse', userIds)}) h
        ORDER BY "month", "category", "subjectId"
        ON CONFLICT ("month", "category", "horseId") DO UPDATE SET "value" = EXCLUDED."value"
        WHERE "horse_monthly_totals"."value" IS DISTINCT FROM EXCLUDED."value"`);
      return { dryRun: false, pending, written: { players, horses } };
    },
    { timeout: 300_000 },
  );
}

async function main() {
  const dryRun = !process.argv.includes('--apply') || process.argv.includes('--dry-run');
  const result = await backfillLeaderboardMonthlyTotals({ dryRun });
  process.stdout.write(
    `backfillLeaderboardMonthlyTotals (${dryRun ? 'dry run, nothing written' : 'applied'}): ` +
      `player rows to add or change ${result.pending.players}, horse rows ${result.pending.horses}; ` +
      `written ${result.written.players} + ${result.written.horses}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch(error => {
      process.stderr.write(`backfillLeaderboardMonthlyTotals failed: ${error.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
