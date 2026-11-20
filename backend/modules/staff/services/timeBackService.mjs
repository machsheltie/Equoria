/**
 * Outage time-back (Equoria-puj1e.5, owner rulings q377/q378,
 * docs/features/admin-time-back.md).
 *
 * The owner gives back the time an outage took: every game clock behaves as if
 * the outage never happened (a true pause). The window is entered in Eastern
 * game time: a time the clocks skip is refused, and a time they repeat needs
 * the Owner to say which; the pause is the real time elapsed. Preview reads only. Apply needs the nightly jobs held, a window
 * that ends in the past, is at most 30 days and overlaps no applied time-back,
 * and a fresh emailed code it consumes in the same transaction as every change
 * and the staff action log entry. Undo restores each recorded value only where
 * the field still holds what the time-back wrote, once, with its own fresh code,
 * and never while a job body runs. Career weeks are given back only where the
 * weekly pass recorded adding them inside the window, each recorded week at most
 * once while the time-back that gave it back stands; undo adds back exactly the
 * weeks its apply took. A window the record does not cover leaves them alone and
 * names them (unprovableCounters).
 *
 * Bank weeks fully inside the outage are given back as owed weekly claims
 * (owner ruling 2026-10-12, timeBackBankClaims.mjs); undo removes the unpaid ones.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import { gameDateKey, gameDateParts } from '../../../utils/gameTime.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';
import { consumeFreshCodeTx } from './staffFreshCodeService.mjs';
import { lockJobHoldTx } from './jobHoldService.mjs';
import { unruledFields } from './timeBackClassification.mjs';
import {
  countOwedWeeklyClaims,
  grantOwedWeeklyClaimsTx,
  owedClaimsSummaryKey,
  removeOwedWeeklyClaimsTx,
} from './timeBackBankClaims.mjs';
import {
  applyCounterRuleTx,
  applyDerivedRulesTx,
  applyFieldRuleTx,
  careerTicksCoverWindow,
  countCounterRule,
  countFieldRule,
  countHorsesUnretired,
  jobCounterRules,
  movedFieldRules,
  restorableColumns,
  restoreColumnTx,
  ruleIsIdle,
  windowParams,
} from './timeBackRules.mjs';

const msPerDay = 86_400_000;
export const maxWindowMs = 30 * msPerDay;
const minWindowMs = 60_000;
const applyTimeoutMs = 120_000;

/** A refused time-back; `code` is for the API, the message for a person. */
export class TimeBackError extends AppError {
  constructor(message, statusCode, code) {
    super(message, statusCode);
    this.code = code;
  }
}

/** What each scheduled job that ran inside a window did, in words. */
const jobEffects = Object.freeze({
  dailyHorseAging: 'Horses had birthdays; any that turned 21 retired and let their staff go.',
  dailyTraitEvaluation: 'Foals had a development day evaluated.',
  nightlyTraitReveal: 'Traits may have been revealed.',
  dailyFoalMilestoneEvaluation: 'Foal milestones were checked.',
  foaling: 'Foals may have been born.',
  nightlyShowExecution: 'Shows were run and their prizes paid.',
  showExecutionReaper: 'Stuck shows were run and paid.',
  electionStatusTransition: 'Club elections opened or closed.',
  groomCareerProgression: 'Grooms aged a year; some may have retired.',
  weeklyRiderTrainerCareerWeeks: 'Riders and trainers aged a year.',
  riderTrainerRetirement: 'Riders or trainers may have retired.',
  weeklySalaries: 'Staff wages were charged.',
  hallOfFameRounds: 'Hall of Fame rounds were decided.',
  dailyNewsPosting: 'Daily news was posted.',
});

/** Which of a time that happens twice the Owner means: before or after the clocks went back. */
export const wallTimeOccurrences = Object.freeze(['first', 'second']);

const skippedTimeWords =
  "That time doesn't exist on the night the clocks spring forward; pick a time outside 2:00–3:00 a.m.";
const twiceTimeWords =
  'That time happens twice on the night the clocks go back; choose the first or the second.';

/** The Eastern wall-clock reading of an instant, written as a UTC instant (ms). */
function easternWallMs(ms) {
  const p = gameDateParts(ms);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * Every instant at which the Eastern clock read 'YYYY-MM-DDTHH:mm', earliest
 * first: none for a time the clocks skip (02:xx on the spring-forward night),
 * two for a time they repeat (01:xx on the fall-back night), otherwise one.
 * @param {unknown} text
 * @returns {Date[]|null} null when the text is not such a time
 */
export function easternWallTimeInstants(text) {
  const match = typeof text === 'string' && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) {
    return null;
  }
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  // The Eastern offsets in force a day either side: at most one clock change lies between.
  const offsets = new Set([-msPerDay, msPerDay].map(d => easternWallMs(wallMs + d) - (wallMs + d)));
  return [...offsets]
    .map(offset => wallMs - offset)
    .filter(ms => easternWallMs(ms) === wallMs)
    .sort((x, y) => x - y)
    .map(ms => new Date(ms));
}

/**
 * One end of the window as an instant, or null for text that is not a time.
 * Refuses a time the clocks skip, and a time they repeat unless `occurrence`
 * ('first' or 'second') says which; on any other time `occurrence` is ignored.
 */
function windowInstant(text, occurrence) {
  const instants = easternWallTimeInstants(text);
  if (instants === null) {
    return null;
  }
  if (instants.length === 1) {
    return instants[0];
  }
  if (instants.length === 0) {
    throw new TimeBackError(skippedTimeWords, 400, 'timeBackTimeSkipped');
  }
  const pick = wallTimeOccurrences.indexOf(occurrence);
  if (pick < 0) {
    throw new TimeBackError(twiceTimeWords, 400, 'timeBackTimeAmbiguous');
  }
  return instants[pick];
}

/**
 * Validate and describe the window. Throws TimeBackError(400). The pause is
 * the real time that elapsed between the two instants.
 * @param {{ start: string, end: string, startOccurrence?: string, endOccurrence?: string }} input
 */
export function parseWindow({ start, end, startOccurrence, endOccurrence }, now = new Date()) {
  const s = windowInstant(start, startOccurrence);
  const e = windowInstant(end, endOccurrence);
  if (!s || !e) {
    throw new TimeBackError(
      'Enter when the outage started and ended.',
      400,
      'timeBackWindowInvalid',
    );
  }
  const pauseMs = e.getTime() - s.getTime();
  if (pauseMs < minWindowMs) {
    throw new TimeBackError('The outage must end after it starts.', 400, 'timeBackWindowInvalid');
  }
  if (e.getTime() > now.getTime()) {
    throw new TimeBackError('The outage end cannot be in the future.', 400, 'timeBackEndInFuture');
  }
  if (pauseMs > maxWindowMs) {
    throw new TimeBackError(
      'An outage longer than 30 days cannot be given back.',
      400,
      'timeBackWindowTooLong',
    );
  }
  return {
    start: s,
    end: e,
    pauseMs,
    startDate: gameDateKey(s),
    endDate: gameDateKey(e),
    todayDate: gameDateKey(now),
  };
}

/** Scheduled job runs that started inside the window (from the cron run log). */
async function jobRunsInWindow(client, window) {
  const runs = await client.cronRunLog.findMany({
    where: { startedAt: { gte: window.start, lt: window.end } },
    orderBy: { startedAt: 'asc' },
    select: { jobName: true, startedAt: true, status: true },
  });
  return runs;
}

/**
 * The job counters whose evidence this window lacks: the career-week record
 * does not cover all of it, so which staff aged is unknown and their weeks are
 * left alone (named on the preview and in the summary). Otherwise none.
 */
async function unprovableCounters(client, window) {
  return (await careerTicksCoverWindow(client, window)) ? [] : jobCounterRules.map(r => r.key);
}

function describeRuns(runs) {
  return runs
    .filter(r => r.status === 'success' || r.status === 'error')
    .map(r => ({
      jobName: r.jobName,
      startedAt: r.startedAt,
      status: r.status,
      effect: jobEffects[r.jobName] ?? 'A housekeeping job ran.',
    }));
}

/** An applied, not undone, time-back whose window overlaps this one. */
function findOverlap(client, window) {
  return client.timeBack.findFirst({
    where: { reversedAt: null, windowStart: { lt: window.end }, windowEnd: { gt: window.start } },
    select: { id: true },
  });
}

/**
 * Dry run: what an apply would change now. Reads only.
 * @param {{ start: string, end: string }} input Eastern wall times
 */
export async function previewTimeBack(input, now = new Date()) {
  const window = parseWindow(input, now);
  const w = windowParams(window);
  const fields = {};
  for (const rule of movedFieldRules) {
    fields[rule.key] = ruleIsIdle(rule, w) ? 0 : await countFieldRule(prisma, rule, w);
  }
  const runs = await jobRunsInWindow(prisma, window);
  const unprovable = await unprovableCounters(prisma, window);
  for (const rule of jobCounterRules) {
    fields[rule.key] = unprovable.includes(rule.key) ? 0 : await countCounterRule(prisma, rule, w);
  }
  fields[owedClaimsSummaryKey] = await countOwedWeeklyClaims(prisma, window);
  const overlap = await findOverlap(prisma, window);
  return {
    windowStart: window.start,
    windowEnd: window.end,
    pauseSeconds: Math.round(window.pauseMs / 1000),
    pauseDays: w.days,
    fields,
    horsesUnretired: await countHorsesUnretired(prisma, w),
    jobRuns: describeRuns(runs),
    unruledFields: [...unruledFields],
    unprovableCounters: unprovable,
    overlapsTimeBackId: overlap?.id ?? null,
  };
}

/**
 * Apply a time-back. `proof` is the checked fresh code (requireFreshStaffProof);
 * it is consumed here, inside the same transaction as every change.
 * @param {{ actor: { id: string, role: string }, input: { start: string, end: string }, proof: object }} params
 */
export async function applyTimeBack({ actor, input, proof }, now = new Date()) {
  const window = parseWindow(input, now);
  const w = windowParams(window);
  return prisma.$transaction(
    async tx => {
      const hold = await lockJobHoldTx(tx);
      if (!hold.held) {
        throw new TimeBackError(
          'Hold the nightly jobs before giving time back.',
          409,
          'timeBackJobsNotHeld',
        );
      }
      if (await findOverlap(tx, window)) {
        throw new TimeBackError(
          'This outage overlaps time already given back.',
          409,
          'timeBackOverlaps',
        );
      }
      const owner = await consumeFreshCodeTx(tx, actor, proof);
      const horsesUnretired = await countHorsesUnretired(tx, w);
      const runs = await jobRunsInWindow(tx, window);
      const unprovable = await unprovableCounters(tx, window);
      const record = await tx.timeBack.create({
        data: {
          windowStart: window.start,
          windowEnd: window.end,
          pauseSeconds: Math.round(window.pauseMs / 1000),
          appliedById: owner.id,
          summary: {},
        },
      });
      const fields = {};
      for (const rule of movedFieldRules) {
        fields[rule.key] = ruleIsIdle(rule, w)
          ? 0
          : (await applyFieldRuleTx(tx, record.id, rule, w)).changed;
      }
      for (const rule of jobCounterRules) {
        fields[rule.key] = unprovable.includes(rule.key)
          ? 0
          : (await applyCounterRuleTx(tx, record.id, rule, w)).changed;
      }
      for (const derived of await applyDerivedRulesTx(tx, record.id, w)) {
        fields[derived.key] = derived.changed;
      }
      fields[owedClaimsSummaryKey] = await grantOwedWeeklyClaimsTx(tx, record.id, window);
      const summary = {
        pauseDays: w.days,
        fields,
        horsesUnretired,
        jobRuns: describeRuns(runs).map(r => ({ ...r, startedAt: r.startedAt.toISOString() })),
        unruledFields: [...unruledFields],
        unprovableCounters: unprovable,
      };
      const log = await recordStaffActionTx(tx, {
        actorId: owner.id,
        actorRole: owner.role,
        capability: 'time-back',
        targetType: 'game',
        targetId: `timeBack:${record.id}`,
        reason: null,
        after: {
          windowStart: window.start.toISOString(),
          windowEnd: window.end.toISOString(),
          pauseSeconds: record.pauseSeconds,
          fields,
        },
      });
      return tx.timeBack.update({
        where: { id: record.id },
        data: { summary, applyLogId: log.id },
      });
    },
    { timeout: applyTimeoutMs, maxWait: 10_000 },
  );
}

/**
 * Undo an applied time-back once. Restores each recorded old value only where
 * the field still holds the value the time-back wrote; the rest are left alone
 * and counted. Career weeks are added back (the weeks the apply took), and the
 * weeks it gave back may be given back again by a later time-back. Like apply, it first takes the nightly-job barrier exclusively,
 * so no job body runs while it restores (refused with 409 jobsRunning after the
 * bounded wait); it does not need the jobs held.
 * @param {{ actor: object, timeBackId: number, proof: object }} params
 */
export async function undoTimeBack({ actor, timeBackId, proof }) {
  return prisma.$transaction(
    async tx => {
      // Like apply: wait out any running job body and keep new ones from
      // starting until the undo commits (the nightly-job barrier, first lock).
      await lockJobHoldTx(tx);
      const [row] = await tx.$queryRaw`
        SELECT "id", "reversedAt", "applyLogId" FROM "time_backs" WHERE "id" = ${timeBackId} FOR UPDATE`;
      if (!row) {
        throw new TimeBackError('No time-back has that number.', 404, 'timeBackNotFound');
      }
      if (row.reversedAt !== null) {
        throw new TimeBackError(
          'This time-back has already been undone.',
          409,
          'timeBackAlreadyUndone',
        );
      }
      const owner = await consumeFreshCodeTx(tx, actor, proof);
      const restored = {};
      const skipped = {};
      const skippedRows = {};
      for (const column of restorableColumns) {
        const outcome = await restoreColumnTx(tx, timeBackId, column);
        restored[column.key] = outcome.restored;
        skipped[column.key] = outcome.skipped;
        if (outcome.skippedRows.length > 0) {
          skippedRows[column.key] = outcome.skippedRows;
        }
      }
      const owed = await removeOwedWeeklyClaimsTx(tx, timeBackId);
      restored[owedClaimsSummaryKey] = owed.restored;
      skipped[owedClaimsSummaryKey] = owed.skipped;
      const log = await recordStaffActionTx(tx, {
        actorId: owner.id,
        actorRole: owner.role,
        capability: 'time-back',
        targetType: 'game',
        targetId: `timeBack:${timeBackId}`,
        reason: null,
        before: { restored, skipped },
        reversesId: row.applyLogId ?? null,
      });
      return tx.timeBack.update({
        where: { id: timeBackId },
        data: {
          reversedAt: new Date(),
          reversedById: owner.id,
          reverseLogId: log.id,
          reverseSummary: { restored, skipped, skippedRows },
        },
      });
    },
    { timeout: applyTimeoutMs, maxWait: 10_000 },
  );
}

/** The most recent time-backs, newest first. */
export function listTimeBacks(limit = 20) {
  return prisma.timeBack.findMany({
    orderBy: { id: 'desc' },
    take: limit,
    select: {
      id: true,
      windowStart: true,
      windowEnd: true,
      pauseSeconds: true,
      appliedAt: true,
      summary: true,
      reversedAt: true,
      reverseSummary: true,
    },
  });
}
