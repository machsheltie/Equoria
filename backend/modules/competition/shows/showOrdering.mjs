/**
 * Scoring a show's entries into the ordering its payout replays (Equoria-c7mx0).
 *
 * Moved verbatim out of showExecutionService.mjs (Equoria-ehlbj) so the owner's
 * quarantine tools score through the same code the overnight executor does.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { rankScoredEntries, scoreShowEntries } from '../services/competitionScoring.mjs';

/**
 * The horse fields the ridden scorer (scoreShowEntries) reads: every stat a
 * discipline can weigh (Equoria-576c0 B4a), the temperament percent term (B6),
 * and, for epic Equoria-k1p62 (owner rulings 2026-10-23), the trained values
 * behind the training points, the tack behind the saddle/bridle points and the
 * health fields behind the health percent term. Traits and flags are not read:
 * they contribute nothing until traits are reworked.
 */
export const scoringHorseSelect = {
  id: true,
  name: true,
  userId: true,
  speed: true,
  stamina: true,
  agility: true,
  balance: true,
  precision: true,
  boldness: true,
  intelligence: true,
  flexibility: true,
  obedience: true,
  focus: true,
  temperament: true,
  disciplineScores: true,
  tack: true,
  age: true,
  healthStatus: true,
  lastFedDate: true,
  lastVettedDate: true,
};

/**
 * Score a show's entries and rank them into the ordering its payout replays
 * (Equoria-c7mx0). The active RiderAssignment per entry is resolved here, in
 * one query (Equoria-5bkh): it drives both the score's rider modifier and,
 * through the staged riderId, the rider's competition stats after payout.
 *
 * @returns {Promise<Array<{horseId: number, userId: string, horseName: string|null, score: number, placement: number, riderId: number|null}>>}
 */
export async function scoreOrdering(show, entries, scoreRng, now) {
  const horseIds = entries.map(e => e.horseId);
  const riderAssignments = horseIds.length
    ? await prisma.riderAssignment.findMany({
        where: { horseId: { in: horseIds }, isActive: true },
        include: { rider: true },
      })
    : [];
  const assignmentByHorseId = new Map(riderAssignments.map(ra => [ra.horseId, ra]));

  // Score (extracted verbatim to competitionScoring.mjs) + rank. Equal scores
  // are separated by a luck re-roll among the tied horses (owner ruling
  // 2026-10-22, Equoria-bvddn.22): no shared placings, no split prizes.
  const scored = scoreShowEntries({
    show,
    entries,
    assignmentByHorseId,
    now,
    ...(scoreRng ? { rng: scoreRng } : {}),
  });
  return rankScoredEntries(scored, scoreRng ?? Math.random).map(
    ({ entry, score, assignment, breakdown }, i) => ({
      horseId: entry.horseId,
      userId: entry.userId,
      horseName: entry.horse?.name ?? null,
      score,
      placement: i + 1,
      riderId: assignment?.riderId ?? null,
      // Every input of the score, kept for staff to audit (Equoria-4q02c).
      scoreInputs: breakdown,
    }),
  );
}
