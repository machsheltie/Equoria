/**
 * competitionResultRecord.mjs (Equoria-q4uem.10)
 *
 * The one owner of a CompetitionResult row's shape: what the nightly executor
 * writes. Owner ruling R6 (Stacey, 2026-10-15): every result records the Horse
 * Points its placement awarded and the post-show stat gain, so a horse's show
 * history is read back from the record, never recomputed from today's tables.
 *
 * This module records what was awarded; it never decides an award. The award
 * table and the stat roll stay in competitionAwards.mjs.
 */

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
