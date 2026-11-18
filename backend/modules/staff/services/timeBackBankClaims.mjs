/**
 * Owed weekly bank claims after an outage time-back (Equoria-puj1e.5, owner
 * ruling 2026-10-12, docs/features/admin-time-back.md "Weekly bank claim").
 *
 * The ruling: players get a lost bank week back. The weekly claim's marker
 * (`User.settings.lastWeeklyClaimDate`) is a calendar-week marker, so no shift
 * restores a week that fell entirely inside an outage. Instead a time-back
 * grants each player one owed claim for every bank week fully covered by the
 * window in which they had not already claimed. The bank pays an owed claim
 * through the normal weekly claim (same amount, ledger-recorded), on top of
 * that week's own claim. Undoing the time-back removes every owed claim it
 * granted that has not been paid yet.
 *
 * A bank week runs from Sunday 00:00 Eastern to the next Sunday 00:00 (the
 * bank's own week, startOfGameWeek(…, 0)); it is fully covered when the outage
 * began at or before its start and ended at or after its end. A player "had
 * already claimed" a week when the ledger holds a weekly reward for that week
 * (`metadata.weekStart`), when their claim marker falls inside it, or when an
 * owed claim for it is already waiting. Accounts created after the week ended
 * lost nothing.
 *
 * Storage: `User.settings.owedWeeklyClaims`, a list of `{ timeBackId, weekStart }`
 * that only the server writes (players' settings writes are allow-listed and
 * cannot reach it). Each grant is also one time_back_changes row (table
 * 'User', field 'owedWeeklyClaims', the claim as the new value), so the
 * change set records it like every other value a time-back writes.
 */

import { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';

/** The `User.settings` key the owed claims live under; the bank pays from it. */
export const owedWeeklyClaimsKey = 'owedWeeklyClaims';

/** The key the time-back summary counts owed claims under. */
export const owedClaimsSummaryKey = 'User.owedWeeklyClaims';

const bankWeekStartDay = 0; // Sunday, as the bank's getCurrentWeekStart

const weekAfter = start => startOfGameDayIndex(gameDayIndex(start) + 7);

/**
 * The bank weeks lying wholly inside [start, end], oldest first.
 * @param {Date} start
 * @param {Date} end
 * @returns {{ start: Date, end: Date }[]}
 */
export function bankWeeksInside(start, end) {
  let weekStart = startOfGameWeek(start, bankWeekStartDay);
  if (weekStart.getTime() < start.getTime()) {
    weekStart = weekAfter(weekStart);
  }
  const weeks = [];
  for (let next = weekAfter(weekStart); next.getTime() <= end.getTime(); next = weekAfter(next)) {
    weeks.push({ start: weekStart, end: next });
    weekStart = next;
  }
  return weeks;
}

const instant = date => Prisma.sql`${date.toISOString()}::timestamptz`;
const owedList = Prisma.sql`(CASE WHEN jsonb_typeof(u."settings" -> ${owedWeeklyClaimsKey}::text) = 'array'
  THEN u."settings" -> ${owedWeeklyClaimsKey}::text ELSE '[]'::jsonb END)`;

/** The players (alias u) owed a claim for one bank week. */
function owedCondition(week) {
  const weekStartIso = week.start.toISOString();
  const marker = Prisma.sql`(u."settings" ->> 'lastWeeklyClaimDate')`;
  return Prisma.sql`
    jsonb_typeof(COALESCE(u."settings", '{}'::jsonb)) = 'object'
    AND u."createdAt" < (${instant(week.end)} AT TIME ZONE 'UTC')
    AND NOT (${marker} IS NOT NULL
      AND ${marker}::timestamptz >= ${instant(week.start)}
      AND ${marker}::timestamptz < ${instant(week.end)})
    AND NOT EXISTS (
      SELECT 1 FROM "user_transactions" ut
      WHERE ut."userId" = u."id" AND ut."category" = 'weeklyReward'
        AND ut."metadata" ->> 'weekStart' = ${weekStartIso})
    AND NOT (${owedList} @> jsonb_build_array(jsonb_build_object('weekStart', ${weekStartIso}::text)))`;
}

/**
 * How many owed claims an apply would grant now (preview; reads only).
 * @param {object} client prisma or a transaction
 * @param {{ start: Date, end: Date }} window
 */
export async function countOwedWeeklyClaims(client, window) {
  let total = 0;
  for (const week of bankWeeksInside(window.start, window.end)) {
    const [{ n }] = await client.$queryRaw`
      SELECT count(*)::int AS n FROM "User" u WHERE ${owedCondition(week)}`;
    total += n;
  }
  return total;
}

/**
 * Grant the owed claims inside the apply transaction and record each one.
 * Returns how many were granted.
 */
export async function grantOwedWeeklyClaimsTx(tx, timeBackId, window) {
  let granted = 0;
  for (const week of bankWeeksInside(window.start, window.end)) {
    const claim = JSON.stringify({ timeBackId, weekStart: week.start.toISOString() });
    granted += await tx.$executeRaw`
      WITH target AS (
        SELECT u."id" AS rid FROM "User" u WHERE ${owedCondition(week)} FOR UPDATE OF u
      ),
      upd AS (
        UPDATE "User" u
        SET "settings" = jsonb_set(
              COALESCE(u."settings", '{}'::jsonb),
              ARRAY[${owedWeeklyClaimsKey}::text],
              ${owedList} || jsonb_build_array(${claim}::jsonb),
              true),
            "updatedAt" = NOW()
        FROM target WHERE u."id" = target.rid
        RETURNING u."id" AS rid
      )
      INSERT INTO "time_back_changes" ("timeBackId", "tableName", "rowId", "field", "oldValue", "newValue")
      SELECT ${timeBackId}, 'User', upd.rid, ${owedWeeklyClaimsKey}, NULL, ${claim}::jsonb FROM upd`;
  }
  return granted;
}

/**
 * Undo: remove every owed claim this time-back granted that is still waiting.
 * A claim the bank has already paid is gone from the list and counts as
 * skipped (the payment stands, like every irreversible effect).
 * @returns {Promise<{ restored: number, skipped: number }>}
 */
export async function removeOwedWeeklyClaimsTx(tx, timeBackId) {
  const recorded = Prisma.sql`
    SELECT "rowId" FROM "time_back_changes"
    WHERE "timeBackId" = ${timeBackId} AND "tableName" = 'User' AND "field" = ${owedWeeklyClaimsKey}`;
  const [{ total }] = await tx.$queryRaw`SELECT count(*)::int AS total FROM (${recorded}) r`;
  if (total === 0) {
    return { restored: 0, skipped: 0 };
  }
  const mine = Prisma.sql`(x.e ->> 'timeBackId') = ${String(timeBackId)}`;
  const [{ removed }] = await tx.$queryRaw`
    WITH target AS (
      SELECT u."id", ${owedList} AS owed FROM "User" u
      WHERE u."id" IN (${recorded}) FOR UPDATE OF u
    ),
    cut AS (
      SELECT target."id",
        (SELECT COALESCE(jsonb_agg(x.e ORDER BY x.n), '[]'::jsonb)
           FROM jsonb_array_elements(target.owed) WITH ORDINALITY AS x(e, n)
           WHERE NOT (${mine})) AS kept,
        (SELECT count(*) FROM jsonb_array_elements(target.owed) AS x(e) WHERE ${mine})::int AS gone
      FROM target
    ),
    upd AS (
      UPDATE "User" u
      SET "settings" = CASE WHEN cut.kept = '[]'::jsonb
            THEN u."settings" - ${owedWeeklyClaimsKey}::text
            ELSE jsonb_set(u."settings", ARRAY[${owedWeeklyClaimsKey}::text], cut.kept) END,
          "updatedAt" = NOW()
      FROM cut WHERE u."id" = cut."id" AND cut.gone > 0
      RETURNING cut.gone
    )
    SELECT COALESCE(sum(gone), 0)::int AS removed FROM upd`;
  return { restored: removed, skipped: total - removed };
}
