/**
 * competitionResultRecord.mjs (Equoria-q4uem.10)
 *
 * The one owner of a CompetitionResult row's shape: what the nightly executor
 * writes, and what the results reads hand to players. Owner ruling R6 (Stacey,
 * 2026-10-15): every result records the Horse Points its placement awarded and
 * the post-show stat gain, so a horse's show history is read back from the
 * record, never recomputed from today's tables. R4: reads are scoped DTOs built
 * here, never raw rows. R7: a stat gain is shown to the horse's owner only.
 *
 * This module records what was awarded; it never decides an award. The award
 * table and the stat roll stay in competitionAwards.mjs.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * `statGains` as an object. The executors store an object; the dead
 * resultModelService.saveResult stored a JSON string, so a string is parsed.
 * Anything unparseable reads as nothing.
 */
function statGainsObject(raw) {
  if (typeof raw !== 'string') {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * The stat gain stored on a ridden result, or null. `statGains` also carries
 * conformation awards, and legacy rows may hold anything, so the shape is
 * checked before it is trusted.
 *
 * @param {unknown} raw - CompetitionResult.statGains.
 * @returns {{ stat: string, gain: number } | null}
 */
export function readStatGain(raw) {
  const value = statGainsObject(raw);
  if (!isPlainObject(value) || typeof value.stat !== 'string' || !Number.isInteger(value.gain)) {
    return null;
  }
  return { stat: value.stat, gain: value.gain };
}

/**
 * The ribbon and title points stored on a conformation result, or null.
 *
 * @param {unknown} raw - CompetitionResult.statGains.
 * @returns {{ ribbon: string, titlePoints: number } | null}
 */
export function readConformationAward(raw) {
  const value = statGainsObject(raw);
  if (
    !isPlainObject(value) ||
    typeof value.ribbon !== 'string' ||
    !Number.isInteger(value.titlePoints)
  ) {
    return null;
  }
  return { ribbon: value.ribbon, titlePoints: value.titlePoints };
}

const toNumberOrNull = value => (value === null || value === undefined ? null : Number(value));
const toIsoOrNull = value => (value ? new Date(value).toISOString() : null);

function toPlacement(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Project one result row (scoped select, below) for a viewer.
 *
 * @param {object} row - CompetitionResult with `horse: { name, userId, user: { username } }`.
 * @param {string} viewerId - The authenticated player's id.
 * @returns {object} The player-facing result.
 */
export function toResultView(row, viewerId) {
  const isViewerHorse = Boolean(viewerId) && row.horse?.userId === viewerId;
  const isConformation = row.discipline === 'conformation';
  return {
    resultId: row.id,
    horseId: row.horseId,
    horseName: row.horse?.name ?? null,
    ownerName: row.horse?.user?.username ?? null,
    isViewerHorse,
    placement: toPlacement(row.placement),
    score: Number(row.score),
    prizeWon: toNumberOrNull(row.prizeWon),
    runDate: toIsoOrNull(row.runDate),
    horsePointsAwarded: row.horsePointsAwarded ?? null,
    statGain: isViewerHorse && !isConformation ? readStatGain(row.statGains) : null,
    conformationAward: isConformation ? readConformationAward(row.statGains) : null,
  };
}

/** Placement ascending (unplaced last), then score descending. */
function byPlacementThenScore(a, b) {
  const pa = a.placement ?? Number.POSITIVE_INFINITY;
  const pb = b.placement ?? Number.POSITIVE_INFINITY;
  return pa === pb ? b.score - a.score : pa - pb;
}

const RESULT_SELECT = {
  id: true,
  horseId: true,
  placement: true,
  score: true,
  prizeWon: true,
  runDate: true,
  discipline: true,
  statGains: true,
  horsePointsAwarded: true,
  horse: { select: { name: true, userId: true, user: { select: { username: true } } } },
};

const SHOW_SELECT = {
  id: true,
  name: true,
  discipline: true,
  showType: true,
  status: true,
  runDate: true,
  executedAt: true,
  prize: true,
};

/**
 * The results of one show for one viewer: GET /competition/show/:showId/results.
 * A show that does not exist answers with `show: null` and no results (the
 * route's long-standing 200 + [] contract).
 *
 * @param {number} showId
 * @param {string} viewerId - req.user.id; never taken from the client.
 * @returns {Promise<{ success: true, showId: number, count: number, show: object|null, results: object[] }>}
 */
export async function getShowResultsView(showId, viewerId) {
  const [show, rows] = await Promise.all([
    prisma.show.findUnique({ where: { id: showId }, select: SHOW_SELECT }),
    prisma.competitionResult.findMany({ where: { showId }, select: RESULT_SELECT }),
  ]);
  const results = rows.map(row => toResultView(row, viewerId)).sort(byPlacementThenScore);
  return {
    success: true,
    showId,
    results,
    count: results.length,
    show: show
      ? {
          id: show.id,
          name: show.name,
          discipline: show.discipline,
          showType: show.showType,
          status: show.status,
          scheduledRunDate: toIsoOrNull(show.runDate),
          executedAt: toIsoOrNull(show.executedAt),
          prize: show.prize,
        }
      : null,
  };
}

const HORSE_SHOW_SELECT = {
  id: true,
  name: true,
  discipline: true,
  showType: true,
  status: true,
  runDate: true,
};

/** Where a show stands for one horse: the result row decides "completed". */
function horseShowStatus(show, result) {
  if (result || show.status === 'completed') {
    return 'completed';
  }
  return show.status === 'executing' ? 'running' : 'upcoming';
}

/**
 * One row of a horse's show list (owner ruling R7). `show` comes from the
 * entry or, for a result with no entry row left, from the result itself.
 *
 * @param {object} show - Show (HORSE_SHOW_SELECT).
 * @param {object|null} result - The horse's CompetitionResult for that show.
 * @returns {object}
 */
export function toHorseShowRow(show, result) {
  const isConformation = (result?.discipline ?? show.discipline) === 'conformation';
  return {
    showId: show.id,
    showName: show.name ?? result?.showName ?? null,
    competitionType: { showType: show.showType, discipline: show.discipline },
    status: horseShowStatus(show, result),
    date: toIsoOrNull(result?.runDate ?? show.runDate),
    placement: result ? toPlacement(result.placement) : null,
    horsePointsAwarded: result?.horsePointsAwarded ?? null,
    winnings: result ? toNumberOrNull(result.prizeWon) : null,
    statGain: result && !isConformation ? readStatGain(result.statGains) : null,
    conformationAward: result && isConformation ? readConformationAward(result.statGains) : null,
  };
}

/**
 * Every show a horse was entered in, run and unrun, newest first (owner ruling
 * R7). The caller must already have proved the viewer owns the horse: the rows
 * include the stat gain, which is the owner's to see.
 *
 * Entries and results are read with narrow selects and merged in memory (a
 * horse's lifetime of shows is small), then paged.
 *
 * @param {number} horseId
 * @param {{ skip: number, take: number }} page
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function getHorseShowResults(horseId, { skip, take }) {
  const [entries, results] = await Promise.all([
    prisma.showEntry.findMany({
      where: { horseId },
      select: { show: { select: HORSE_SHOW_SELECT } },
    }),
    prisma.competitionResult.findMany({
      where: { horseId },
      select: {
        showId: true,
        showName: true,
        placement: true,
        discipline: true,
        runDate: true,
        prizeWon: true,
        statGains: true,
        horsePointsAwarded: true,
        show: { select: HORSE_SHOW_SELECT },
      },
    }),
  ]);

  const resultByShow = new Map(results.map(r => [r.showId, r]));
  const showsById = new Map(entries.map(e => [e.show.id, e.show]));
  for (const r of results) {
    if (!showsById.has(r.showId)) {
      showsById.set(r.showId, r.show);
    }
  }

  const rows = [...showsById.values()]
    .map(show => toHorseShowRow(show, resultByShow.get(show.id) ?? null))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.showId - a.showId);
  return { rows: rows.slice(skip, skip + take), total: rows.length };
}

/**
 * The competitionResult.create data for one replayed ridden placement.
 * `create` stays the first write of the per-entry transaction, so the
 * @@unique([showId, horseId]) constraint remains the idempotency token.
 *
 * @param {object} input
 * @param {{ id: number, name: string, discipline: string }} input.show
 * @param {{ horseId: number, score: number, placement: number }} input.staged
 * @param {number} input.prize - Prize paid for this placement.
 * @param {Date} input.now - Settlement time (the result's run date).
 * @returns {object} Prisma create data.
 */
export function buildRiddenResultRow({ show, staged, prize, now }) {
  return {
    score: staged.score,
    placement: `${staged.placement}`,
    discipline: show.discipline,
    runDate: now,
    showName: show.name,
    prizeWon: prize,
    horseId: staged.horseId,
    showId: show.id,
  };
}

/**
 * Record what a placement awarded on its (already created) result row, inside
 * the same per-entry transaction as the award itself.
 *
 * - `horsePointsAwarded` is the Horse Points the award table paid.
 * - `statGains` is written only when a stat really rose (`statGainApplied`).
 *   A roll that hit today's 100 ceiling raised nothing, so nothing is recorded
 *   and the column keeps its NULL default.
 *
 * @param {object} db - The per-entry `$transaction` client.
 * @param {{ showId: number, horseId: number }} key - The result row.
 * @param {{ awards: { horseXp: number }, statGain: { stat: string, gain: number } | null,
 *   statGainApplied: boolean }} progression - awardPlacementProgression's return value.
 * @returns {Promise<void>}
 */
export async function recordProgressionOnResult(db, { showId, horseId }, progression) {
  const { awards, statGain, statGainApplied } = progression;
  await db.competitionResult.update({
    where: { showId_horseId: { showId, horseId } },
    data: {
      horsePointsAwarded: awards.horseXp,
      ...(statGainApplied && statGain
        ? { statGains: { stat: statGain.stat, gain: statGain.gain } }
        : {}),
    },
  });
}
