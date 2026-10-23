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

import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const SHOW_NAME_PREFIX = 'E2E-PrizeHistory-';

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
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const prisma = mod.default as Partial<PrismaSubset> | undefined;
  if (!prisma?.show) {
    throw new Error('Could not resolve prisma from packages/database/prismaClient.mjs');
  }
  return prisma as PrismaSubset;
}

export type SeededPrizeResult = { showId: number; resultId: number; showName: string };

/**
 * One completed show, run yesterday, in which `horseId` placed 1st and won 500.
 */
export async function seedPrizeResult(horseId: number): Promise<SeededPrizeResult> {
  const prisma = await getPrisma();
  const runDate = new Date(Date.now() - DAY_MS);
  const showName = `${SHOW_NAME_PREFIX}${randomUUID()}`;
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
