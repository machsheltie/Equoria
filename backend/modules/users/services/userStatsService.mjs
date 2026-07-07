/**
 * 📊 USER STATS SERVICE (Equoria-oey96.2)
 *
 * Single source of truth for a user's competition-stats aggregation and
 * bred-foal count. Extracted from userController.getUserCompetitionStats so
 * BOTH the /competition-stats endpoint AND the /progress endpoint compute the
 * same numbers from the same code path — no copy-pasted aggregation that could
 * drift the next time one side changes (per the issue's design decision and
 * OPTIMAL_FIX_DISCIPLINE §3: don't duplicate the aggregation).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Parse a placement string like "1st", "3rd", "5th", or "4" into its numeric
 * rank. Returns 0 when no numeric prefix is found.
 */
export function placementToNumber(placement) {
  if (placement === null || placement === undefined) {
    return 0;
  }
  if (typeof placement === 'number') {
    return placement;
  }
  const str = String(placement).trim();
  const match = str.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Aggregate competition results across all horses owned by :userId and return
 * the `UserCompetitionStats` shape (see
 * frontend/src/lib/api/competitionResults.ts). winRate semantics: wins /
 * entries * 100, rounded to two decimals (unchanged from the original
 * getUserCompetitionStats controller logic).
 *
 * @param {string} userId
 * @returns {Promise<object>} the full stats object
 */
export async function computeUserCompetitionStats(userId) {
  const results = await prisma.competitionResult.findMany({
    where: { horse: { userId } },
    select: {
      id: true,
      score: true,
      placement: true,
      discipline: true,
      runDate: true,
      showName: true,
      prizeWon: true,
      showId: true,
      horse: { select: { id: true, name: true } },
      show: {
        select: {
          id: true,
          name: true,
          _count: { select: { competitionResults: true } },
        },
      },
    },
    orderBy: { runDate: 'desc' },
  });

  const totalCompetitions = results.length;

  if (totalCompetitions === 0) {
    return {
      userId,
      totalCompetitions: 0,
      totalWins: 0,
      totalTop3: 0,
      winRate: 0,
      totalPrizeMoney: 0,
      // totalXpGained: omitted — not stored in CompetitionResult (Equoria-aenc)
      bestPlacement: 0,
      mostSuccessfulDiscipline: '',
      recentCompetitions: [],
    };
  }

  let totalWins = 0;
  let totalTop3 = 0;
  let totalPrizeMoney = 0;
  let bestPlacement = Number.POSITIVE_INFINITY;
  const disciplineCounts = {};

  for (const r of results) {
    const placementNum = placementToNumber(r.placement);
    if (placementNum === 1) {
      totalWins += 1;
    }
    if (placementNum > 0 && placementNum <= 3) {
      totalTop3 += 1;
    }
    if (placementNum > 0 && placementNum < bestPlacement) {
      bestPlacement = placementNum;
    }
    totalPrizeMoney += Number(r.prizeWon ?? 0);
    disciplineCounts[r.discipline] = (disciplineCounts[r.discipline] ?? 0) + 1;
  }

  if (bestPlacement === Number.POSITIVE_INFINITY) {
    bestPlacement = 0;
  }

  const mostSuccessfulDiscipline =
    Object.keys(disciplineCounts).length > 0
      ? Object.entries(disciplineCounts).sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        )[0][0]
      : '';

  const winRate = totalCompetitions > 0 ? (totalWins / totalCompetitions) * 100 : 0;

  const recentCompetitions = results.slice(0, 5).map(r => ({
    competitionId: r.showId,
    competitionName: r.show?.name ?? r.showName,
    discipline: r.discipline,
    date: r.runDate,
    placement: placementToNumber(r.placement),
    // Derive participant count from results recorded for this show (actual field size).
    totalParticipants: r.show?._count?.competitionResults ?? 0,
    finalScore: Number(r.score),
    prizeMoney: Number(r.prizeWon ?? 0),
    // xpGained: omitted — not stored in CompetitionResult and cannot be reliably
    // derived without a schema change (Equoria-aenc). Remove the misleading zero.
  }));

  return {
    userId,
    totalCompetitions,
    totalWins,
    totalTop3,
    winRate: Math.round(winRate * 100) / 100,
    totalPrizeMoney,
    // totalXpGained: omitted — not stored in CompetitionResult (Equoria-aenc).
    bestPlacement,
    mostSuccessfulDiscipline,
    recentCompetitions,
  };
}

/**
 * Count foals BRED within the game that the user currently owns — i.e. horses
 * owned by :userId that have BOTH parents recorded (sireId AND damId non-null).
 *
 * SEMANTIC NOTE (Equoria-oey96.2): there is no immutable "breeder" attribution
 * in the schema. A newly-foaled horse is assigned to the dam-owner at foaling
 * (foalingService.createFoalFromPregnancy: `userId: options.userId ||
 * dam.userId`). This count therefore means "bred horses currently in the
 * user's stable" — the product of in-game breeding, distinguished from
 * foundation/starter stock which is created with null parents. A foal sold
 * away stops counting for the seller and starts counting for the buyer. This
 * is the cheapest honest query available; a true lifetime "foals I bred"
 * metric would require a breederId column (deferred — see Equoria follow-up).
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countUserBredFoals(userId) {
  return prisma.horse.count({
    where: { userId, sireId: { not: null }, damId: { not: null } },
  });
}
