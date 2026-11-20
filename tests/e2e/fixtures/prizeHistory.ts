/**
 * E2E fixture: give a player's horse one prize-history row (Equoria-g3n8c).
 *
 * WHY THIS EXISTS. Prize History reads CompetitionResult rows for the player's
 * horses. Nothing in an E2E run produces one through the UI (entering a show
 * does not pay out; shows run on the nightly job), so a fresh account has an
 * empty history, and PrizeTransactionHistory renders its empty state WITHOUT
 * the date-range filter prize-history.spec.ts needs to drive its offline
 * re-query (Equoria-0vhop, item 1). The row is written here, from the spec's
 * own Node process, straight into the test database: the same pattern as
 * `feedHistory.ts`, `ownedHorses.ts` and the readiness profile-statistics spec,
 * which seeds a completed show and its result the same way.
 *
 * The show is COMPLETED and dated in the past, so it is never listed for entry
 * and never picked up by the show executor (owner rulings 2026-10-05/07/12:
 * undated shows refuse entry). It touches only the rows it creates, and
 * `removeSeededPrizeResult` deletes them (the result cascades with the show).
 *
 * NOT PERMITTED here: production routes, `x-test-*` headers, or anything that
 * runs inside the backend process.
 */

import { loadE2ePrisma } from '../helpers/e2eTestStack.mjs';
import { randomUUID } from 'crypto';

const dayMs = 24 * 60 * 60 * 1000;
const showNamePrefix = 'E2E-PrizeHistory-';

type PrismaSubset = {
  show: {
    create: (_args: {
      data: Record<string, unknown>;
      select: { id: true; competitionResults: { select: { id: true } } };
    }) => Promise<{ id: number; competitionResults: Array<{ id: number }> }>;
    deleteMany: (_args: { where: { id: number } }) => Promise<{ count: number }>;
  };
};

// Dynamic import so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the feedHistory pattern).
async function getPrisma(): Promise<PrismaSubset> {
  const prisma = (await loadE2ePrisma()) as Partial<PrismaSubset> | undefined;
  if (!prisma?.show) {
    throw new Error('Could not resolve prisma from packages/database/prismaClient.mjs');
  }
  return prisma as PrismaSubset;
}

export type SeededPrizeResult = { showId: number; resultId: number; showName: string };

/**
 * One completed show, run yesterday, in which `horseId` placed 1st and won 500,
 * entered by `entrantUserId`. A player's results are the ones she entered
 * (owner ruling q256, Equoria-r9q06: a sold horse's past results stay with the
 * player who entered them), so the row names its entrant. Old contract: results
 * were read through the horse's current owner, and this row had no entrant.
 */
export async function seedPrizeResult(
  horseId: number,
  entrantUserId: string
): Promise<SeededPrizeResult> {
  const prisma = await getPrisma();
  const runDate = new Date(Date.now() - dayMs);
  const showName = `${showNamePrefix}${randomUUID()}`;
  // One nested write, so Prisma commits the show and its result together: a
  // failed result can never leave an orphaned completed show behind.
  const show = await prisma.show.create({
    data: {
      name: showName,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 20,
      entryFee: 0,
      prize: 1000,
      runDate,
      closeDate: runDate,
      status: 'completed',
      competitionResults: {
        create: {
          score: 92.5,
          placement: 1,
          discipline: 'Dressage',
          runDate,
          showName,
          horseId,
          entrantUserId,
          prizeWon: 500,
        },
      },
    },
    select: { id: true, competitionResults: { select: { id: true } } },
  });
  if (show.competitionResults.length !== 1) {
    throw new Error(
      `prizeHistory fixture expected one result on show ${show.id}, found ${show.competitionResults.length}`
    );
  }
  return { showId: show.id, resultId: show.competitionResults[0].id, showName };
}

/** Delete the seeded show (its result cascades). Fails loudly unless one show was removed. */
export async function removeSeededPrizeResult(seeded: SeededPrizeResult): Promise<void> {
  const prisma = await getPrisma();
  const { count } = await prisma.show.deleteMany({ where: { id: seeded.showId } });
  if (count !== 1) {
    throw new Error(
      `prizeHistory fixture expected to delete show ${seeded.showId}, deleted ${count}`
    );
  }
}
