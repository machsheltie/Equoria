/**
 * Outage time-back: what each moved field does, as SQL (Equoria-puj1e.5,
 * docs/features/admin-time-back.md "Rulebook").
 *
 * Every rule updates its rows with a database-side expression over the row's
 * CURRENT value, under a row lock, and writes one time_back_changes row per
 * changed value (old and new) in the same statement. So a player action that
 * commits during apply is never overwritten (it waits for the lock and then
 * writes its own value) and never shifted twice (a value already at or after
 * the window's end is left alone).
 *
 * Instants are bound as ISO text and cast through timestamptz to UTC, never as
 * raw Date binds (a non-UTC session shifts those, Equoria-7uphu). Calendar
 * columns (`@db.Date`) move by the pause rounded to whole days, read on the
 * Eastern game calendar (owner ruling 2026-10-09).
 *
 * Table and column names come only from the constant list below, never from a
 * request.
 */

import { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { gameDateParts, gameTimeZone, sameGameClockDaysLater } from '../../../utils/gameTime.mjs';
import { pastEventFields, pendingDeadlineFields } from './timeBackClassification.mjs';

const daysUntilRetirement = 21 * 7; // a horse retires at 21 game-years; 7 days each
const msPerDay = 86_400_000;
const careWindowDays = 60; // the longest trailing care window

/** An instant's Eastern wall-clock reading, written as a UTC instant (ms). */
function easternWallMs(date) {
  const p = gameDateParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Whole game weeks from `start` to `end`: the most k for which k Eastern
 * calendar weeks after `start`, at the same Eastern clock time, is not after
 * `end`. Sunday midnight to Sunday midnight is one week even when the clocks
 * sprang forward in between (167 hours).
 */
export function wholeGameWeeks(start, end) {
  let weeks = 0;
  while (sameGameClockDaysLater(start, 7 * (weeks + 1)).getTime() <= end.getTime()) {
    weeks += 1;
  }
  return weeks;
}

/**
 * The moved fields. `key` is the classification key ('Model.field'); `table`,
 * `column` and `id` (the primary key column, 'id' unless given) are the
 * database names. `type` is the SQL type a recorded value is cast back to on
 * undo.
 */
const fieldRules = Object.freeze([
  // Rule 1: past events.
  {
    key: 'Horse.dateOfBirth',
    table: 'horses',
    column: 'dateOfBirth',
    type: 'date',
    // Only horses under 21 at the outage start; one that turned 21 inside the
    // window goes back to 20.
    extra: w => Prisma.sql`t."dateOfBirth" > (${w.startDate}::date - ${daysUntilRetirement}::int)`,
  },
  { key: 'Horse.lastBredDate', table: 'horses', column: 'lastBredDate', type: 'date' },
  { key: 'Horse.lastVettedDate', table: 'horses', column: 'lastVettedDate', type: 'date' },
  { key: 'Horse.inFoalSinceDate', table: 'horses', column: 'inFoalSinceDate' },
  { key: 'Horse.lastGroomed', table: 'horses', column: 'lastGroomed' },
  { key: 'Horse.lastShod', table: 'horses', column: 'lastShod' },
  { key: 'Horse.lastFedDate', table: 'horses', column: 'lastFedDate' },
  { key: 'TrainingLog.trainedAt', table: 'training_logs', column: 'trainedAt' },
  { key: 'GroomAssignment.createdAt', table: 'groom_assignments', column: 'createdAt' },
  { key: 'GroomAssignment.startDate', table: 'groom_assignments', column: 'startDate' },
  // Interactions inside the trailing care windows (the longest is 60 days).
  {
    key: 'GroomInteraction.timestamp',
    table: 'groom_interactions',
    column: 'timestamp',
    extra: w => Prisma.sql`t."timestamp" > ${w.careWindowStart}`,
  },
  {
    key: 'GroomInteraction.createdAt',
    table: 'groom_interactions',
    column: 'createdAt',
    extra: w => Prisma.sql`t."timestamp" > ${w.careWindowStart}`,
  },
  {
    key: 'StaffMarketplaceState.lastRefresh',
    table: 'staff_marketplace_state',
    column: 'lastRefresh',
  },
  // Owner ruling q383 (2026-11-18): the clocks added after the survey.
  { key: 'Horse.hungerSince', table: 'horses', column: 'hungerSince' },
  { key: 'Rider.freeAgentSince', table: 'riders', column: 'freeAgentSince' },
  {
    key: 'RiderRetirementSchedule.noticeSentAt',
    table: 'rider_retirement_schedules',
    column: 'noticeSentAt',
    id: 'riderId',
  },
  {
    key: 'FoalDevelopment.finalDayEvaluatedAt',
    table: 'foal_development',
    column: 'finalDayEvaluatedAt',
  },
  // Rule 2: pending deadlines.
  { key: 'Horse.trainingCooldown', table: 'horses', column: 'trainingCooldown' },
  {
    key: 'Show.closeDate',
    table: 'shows',
    column: 'closeDate',
    extra: () => Prisma.sql`t."status" = 'open'`,
  },
  {
    key: 'Show.runDate',
    table: 'shows',
    column: 'runDate',
    extra: () => Prisma.sql`t."status" = 'open'`,
  },
  {
    key: 'ClubElection.startsAt',
    table: 'ClubElection',
    column: 'startsAt',
    extra: () => Prisma.sql`t."status" <> 'closed'`,
  },
  {
    key: 'ClubElection.endsAt',
    table: 'ClubElection',
    column: 'endsAt',
    extra: () => Prisma.sql`t."status" <> 'closed'`,
  },
  // Bucketed by pay week: the pause moves it in whole weeks only.
  { key: 'Groom.feeUnpaidSince', table: 'grooms', column: 'feeUnpaidSince', weekly: true },
  // q383: mirrors Groom.feeUnpaidSince (a rider's unpaid pay week).
  { key: 'Rider.feeUnpaidSince', table: 'riders', column: 'feeUnpaidSince', weekly: true },
  // q383: a Hall of Fame round (weekly or run-off) still being voted on.
  {
    key: 'HallOfFameRound.startsAt',
    table: 'HallOfFameRound',
    column: 'startsAt',
    extra: () => Prisma.sql`t."closedAt" IS NULL`,
  },
  {
    key: 'HallOfFameRound.endsAt',
    table: 'HallOfFameRound',
    column: 'endsAt',
    extra: () => Prisma.sql`t."closedAt" IS NULL`,
  },
]);

const ruleOf = key =>
  pastEventFields.includes(key)
    ? 'pastEvent'
    : pendingDeadlineFields.includes(key)
      ? 'pendingDeadline'
      : null;

for (const rule of fieldRules) {
  if (!ruleOf(rule.key)) {
    throw new Error(`timeBackRules: ${rule.key} is not classified as moved`);
  }
}

/** Every moved field's rule, with its classification attached. */
export const movedFieldRules = Object.freeze(
  fieldRules.map(rule => Object.freeze({ id: 'id', ...rule, rule: ruleOf(rule.key) })),
);

/**
 * Rule 3: job counters, reversed by the ticks their job ran inside the window
 * (from the cron run log). Only rows that existed at a tick, and are not
 * retired, were ticked by it.
 */
export const jobCounterRules = Object.freeze([
  {
    key: 'Groom.careerWeeks',
    table: 'grooms',
    column: 'careerWeeks',
    jobName: 'groomCareerProgression',
  },
  {
    key: 'Rider.careerWeeks',
    table: 'riders',
    column: 'careerWeeks',
    jobName: 'weeklyRiderTrainerCareerWeeks',
  },
  {
    key: 'Trainer.careerWeeks',
    table: 'trainers',
    column: 'careerWeeks',
    jobName: 'weeklyRiderTrainerCareerWeeks',
  },
]);

/** Values recomputed from a moved birth date, recorded like every other change. */
export const derivedRules = Object.freeze([
  { key: 'Horse.age', table: 'horses', column: 'age', type: 'int' },
  {
    key: 'FoalDevelopment.currentDay',
    table: 'foal_development',
    column: 'currentDay',
    type: 'int',
  },
]);

/** Every rule whose changes an undo restores: table, column and cast type. */
export const restorableColumns = Object.freeze([
  ...movedFieldRules.map(r => ({
    key: r.key,
    table: r.table,
    column: r.column,
    id: r.id,
    type: r.type ?? 'timestamp(3)',
  })),
  ...jobCounterRules.map(r => ({
    key: r.key,
    table: r.table,
    column: r.column,
    id: 'id',
    type: 'int',
  })),
  ...derivedRules.map(r => ({ ...r, id: 'id' })),
]);

const ident = name => Prisma.raw(`"${name}"`);

/**
 * The window's bound values for SQL. `start`/`end` are Dates; `startDate` /
 * `endDate` are the Eastern calendar dates of the window as 'YYYY-MM-DD'.
 *
 * `pause` is the real time elapsed (instants move by it). Day and week counts
 * are read on the Eastern clock, never as a millisecond delta, so a 23- or
 * 25-hour daylight-saving day is still one game day: `days` is the window's
 * Eastern wall-clock length rounded to whole days, `weeks` its whole game weeks.
 */
export function windowParams({ start, end, startDate, endDate, pauseMs, todayDate }) {
  const days = Math.round((easternWallMs(end) - easternWallMs(start)) / msPerDay);
  const weeks = wholeGameWeeks(start, end);
  const at = date => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  return {
    s: at(start),
    e: at(end),
    careWindowStart: at(sameGameClockDaysLater(start, -careWindowDays)),
    pause: Prisma.sql`make_interval(secs => ${pauseMs / 1000}::double precision)`,
    weeks,
    days,
    startDate,
    endDate,
    todayDate,
  };
}

/**
 * A UTC timestamp column moved `weeks` Eastern calendar weeks at the same
 * Eastern clock time (not 168 hours each). Postgres reads a moved time that
 * the clocks skip an hour later, and one they repeat as the second.
 */
function inGameWeeks(col, weeks) {
  const zone = Prisma.sql`${gameTimeZone}::text`;
  const wall = Prisma.sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${zone})`;
  return Prisma.sql`(((${wall} + make_interval(days => ${weeks * 7}::int)) AT TIME ZONE ${zone}) AT TIME ZONE 'UTC')`;
}

/** The new-value expression and the WHERE condition of a moved field. */
function fieldExpressions(rule, w) {
  const col = Prisma.sql`t.${ident(rule.column)}`;
  let newValue;
  let condition;
  if (rule.type === 'date') {
    const sd = Prisma.sql`${w.startDate}::date`;
    const ed = Prisma.sql`${w.endDate}::date`;
    newValue = Prisma.sql`CASE WHEN ${col} <= ${sd} THEN ${col} + ${w.days}::int ELSE ${ed} END`;
    condition = Prisma.sql`${col} IS NOT NULL AND ${col} < ${ed}`;
  } else if (rule.rule === 'pastEvent') {
    newValue = Prisma.sql`CASE WHEN ${col} <= ${w.s} THEN ${col} + ${w.pause} ELSE ${w.e} END`;
    condition = Prisma.sql`${col} IS NOT NULL AND ${col} < ${w.e}`;
  } else {
    newValue = rule.weekly ? inGameWeeks(col, w.weeks) : Prisma.sql`${col} + ${w.pause}`;
    condition = Prisma.sql`${col} IS NOT NULL AND ${col} > ${w.s}`;
  }
  if (rule.extra) {
    condition = Prisma.sql`${condition} AND ${rule.extra(w)}`;
  }
  // A row whose value would not change is not touched or recorded.
  condition = Prisma.sql`${condition} AND (${newValue}) IS DISTINCT FROM ${col}`;
  return { newValue, condition };
}

/** Whether a moved field's rule does nothing for this pause (e.g. under a week). */
export function ruleIsIdle(rule, w) {
  return Boolean(rule.weekly) && w.weeks === 0;
}

/**
 * Lock, update and record one rule's rows: returns how many values changed.
 * `select` yields (rid, old, nv) rows from alias t; the rows are locked FOR
 * UPDATE OF t and their new values are recomputed on the locked version.
 */
async function updateAndRecordTx(tx, timeBackId, { table, column, key, id = 'id' }, select) {
  const pk = ident(id);
  const recorded = await tx.$executeRaw`
    WITH target AS (${select}),
    upd AS (
      UPDATE ${ident(table)} u SET ${ident(column)} = target.nv
      FROM target WHERE u.${pk} = target.rid
      RETURNING u.${pk} AS rid, target.old AS old, u.${ident(column)} AS new
    )
    INSERT INTO "time_back_changes" ("timeBackId", "tableName", "rowId", "field", "oldValue", "newValue")
    SELECT ${timeBackId}, ${table}, upd.rid::text, ${column}, to_jsonb(upd.old), to_jsonb(upd.new) FROM upd`;
  return { key, changed: recorded };
}

/** Apply one moved-field rule inside the apply transaction. */
export function applyFieldRuleTx(tx, timeBackId, rule, w) {
  const { newValue, condition } = fieldExpressions(rule, w);
  const select = Prisma.sql`
    SELECT t.${ident(rule.id)} AS rid, t.${ident(rule.column)} AS old, ${newValue} AS nv
    FROM ${ident(rule.table)} t WHERE ${condition} FOR UPDATE OF t`;
  return updateAndRecordTx(tx, timeBackId, rule, select);
}

/** How many rows a moved-field rule would change, without locking or writing. */
export async function countFieldRule(client, rule, w) {
  const { condition } = fieldExpressions(rule, w);
  const [{ n }] = await client.$queryRaw`
    SELECT count(*)::int AS n FROM ${ident(rule.table)} t WHERE ${condition}`;
  return n;
}

/** Ticks a counter row received from runs at `runTimes`, as SQL over alias t. */
function ticksExpression(runTimes) {
  const parts = runTimes.map(
    at =>
      Prisma.sql`(CASE WHEN t."createdAt" <= (${at.toISOString()}::timestamptz AT TIME ZONE 'UTC') THEN 1 ELSE 0 END)`,
  );
  return Prisma.join(parts, ' + ');
}

/** Reverse one job counter by the ticks its job ran inside the window. */
export function applyCounterRuleTx(tx, timeBackId, rule, runTimes) {
  if (runTimes.length === 0) {
    return Promise.resolve({ key: rule.key, changed: 0 });
  }
  const ticks = ticksExpression(runTimes);
  const col = Prisma.sql`t.${ident(rule.column)}`;
  const select = Prisma.sql`
    SELECT t."id" AS rid, ${col} AS old, GREATEST(${col} - (${ticks}), 0) AS nv
    FROM ${ident(rule.table)} t
    WHERE t."retired" = false AND (${ticks}) > 0 AND ${col} > 0
    FOR UPDATE OF t`;
  return updateAndRecordTx(tx, timeBackId, rule, select);
}

/** How many counter rows the reversal would change. */
export async function countCounterRule(client, rule, runTimes) {
  if (runTimes.length === 0) {
    return 0;
  }
  const ticks = ticksExpression(runTimes);
  const [{ n }] = await client.$queryRaw`
    SELECT count(*)::int AS n FROM ${ident(rule.table)} t
    WHERE t."retired" = false AND (${ticks}) > 0 AND t.${ident(rule.column)} > 0`;
  return n;
}

/**
 * Recompute Horse.age (game-years) and clamp FoalDevelopment.currentDay for
 * every horse whose birth date this time-back moved.
 */
export async function applyDerivedRulesTx(tx, timeBackId, w) {
  const today = Prisma.sql`${w.todayDate}::date`;
  const moved = Prisma.sql`
    SELECT ("rowId")::int FROM "time_back_changes"
    WHERE "timeBackId" = ${timeBackId} AND "tableName" = 'horses' AND "field" = 'dateOfBirth'`;
  const ageExpr = Prisma.sql`GREATEST(FLOOR((${today} - t."dateOfBirth") / 7.0), 0)::int`;
  const age = await updateAndRecordTx(
    tx,
    timeBackId,
    derivedRules[0],
    Prisma.sql`
      SELECT t."id" AS rid, t."age" AS old, ${ageExpr} AS nv FROM "horses" t
      WHERE t."id" IN (${moved}) AND t."age" IS DISTINCT FROM ${ageExpr}
      FOR UPDATE OF t`,
  );
  const ageDays = Prisma.sql`GREATEST(${today} - h."dateOfBirth", 0)`;
  const day = await updateAndRecordTx(
    tx,
    timeBackId,
    derivedRules[1],
    Prisma.sql`
      SELECT t."id" AS rid, t."currentDay" AS old, ${ageDays} AS nv
      FROM "foal_development" t JOIN "horses" h ON h."id" = t."foalId"
      WHERE t."foalId" IN (${moved}) AND t."currentDay" > ${ageDays}
      FOR UPDATE OF t`,
  );
  return [age, day];
}

/** Horses that are 21 or older now but go back under 21 when their birth date moves. */
export async function countHorsesUnretired(client, w) {
  if (w.days === 0) {
    return 0;
  }
  const [{ n }] = await client.$queryRaw`
    SELECT count(*)::int AS n FROM "horses" t
    WHERE t."dateOfBirth" <= ${w.startDate}::date
      AND t."dateOfBirth" > (${w.startDate}::date - ${daysUntilRetirement}::int)
      AND (${w.todayDate}::date - t."dateOfBirth") >= ${daysUntilRetirement}::int
      AND (${w.todayDate}::date - (t."dateOfBirth" + ${w.days}::int)) < ${daysUntilRetirement}::int`;
  return n;
}

/**
 * Undo one column: restore each recorded old value only where the field still
 * holds the value the time-back wrote. Returns restored and skipped counts and
 * up to 50 skipped row ids: every recorded row the undo did not restore (play
 * changed it since, even back to its old value, or it is gone).
 */
export async function restoreColumnTx(tx, timeBackId, { table, column, id = 'id', type }) {
  const cast = Prisma.raw(type);
  const pk = ident(id);
  const changes = Prisma.sql`
    SELECT "rowId", "oldValue", "newValue" FROM "time_back_changes"
    WHERE "timeBackId" = ${timeBackId} AND "tableName" = ${table} AND "field" = ${column}`;
  const [{ total }] = await tx.$queryRaw`
    SELECT count(*)::int AS total FROM "time_back_changes"
    WHERE "timeBackId" = ${timeBackId} AND "tableName" = ${table} AND "field" = ${column}`;
  if (total === 0) {
    return { restored: 0, skipped: 0, skippedRows: [] };
  }
  const [{ restored, skippedRows }] = await tx.$queryRaw`
    WITH c AS (${changes}),
    locked AS (
      SELECT u.${pk} AS "lockedId" FROM ${ident(table)} u JOIN c ON u.${pk}::text = c."rowId"
      WHERE u.${ident(column)} IS NOT DISTINCT FROM (c."newValue" #>> '{}')::${cast}
      FOR UPDATE OF u
    ),
    upd AS (
      UPDATE ${ident(table)} u SET ${ident(column)} = (c."oldValue" #>> '{}')::${cast}
      FROM c WHERE u.${pk}::text = c."rowId" AND u.${pk} IN (SELECT "lockedId" FROM locked)
      RETURNING u.${pk}::text AS "rowId"
    )
    SELECT (SELECT count(*)::int FROM upd) AS restored,
      ARRAY(
        SELECT c."rowId" FROM c WHERE c."rowId" NOT IN (SELECT "rowId" FROM upd)
        ORDER BY c."rowId" LIMIT 50
      ) AS "skippedRows"`;
  return { restored, skipped: total - restored, skippedRows };
}
