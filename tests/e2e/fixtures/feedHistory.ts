/**
 * E2E fixture: give a seeded horse feeding history (Equoria-mwjst).
 *
 * WHY THIS EXISTS (Codex scan 2026-10-02, Finding 1): specs that feed one horse
 * more than once per run used `POST /api/v1/horses/:id/reset-last-fed`, an
 * owner-callable route that rewound `Horse.lastFedDate` — the server's
 * once-per-UTC-day feed authority. Any player could call it to re-feed the same
 * day and farm permanent stat rolls and pregnancy counters. The route is gone
 * from the production app, so feeding history is now written here, from the
 * spec's own Node process, straight into the test database — the same pattern
 * as `ownedHorses.ts` and `coatGenotypeHorses.ts`. The feed itself still runs
 * over the real HTTP route.
 *
 * Two days back, not one: the feed guard compares `lastFedDate` against the
 * start of today in UTC, and a non-UTC database session shifts raw-SQL Date
 * binds by its offset (Equoria-7uphu). Forty-eight hours is before today's UTC
 * midnight in either frame, so the next feed is accepted whatever time the
 * suite runs.
 *
 * NOT PERMITTED here: production routes, `x-test-*` headers, or anything that
 * runs inside the backend process. This only touches the row it is given.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKDATE_DAYS = 2;

type HorseDelegate = {
  updateMany: (_args: {
    where: { id: number };
    data: { lastFedDate: Date };
  }) => Promise<{ count: number }>;
};

// Dynamic import so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the coatGenotypeHorses pattern).
// The delegate is returned whole so updateMany keeps its Prisma `this`.
async function getHorseDelegate(): Promise<HorseDelegate> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const horse = (mod.default as { horse?: HorseDelegate } | undefined)?.horse;
  if (!horse || typeof horse.updateMany !== 'function') {
    throw new Error('Could not resolve prisma.horse from packages/database/prismaClient.mjs');
  }
  return horse;
}

/**
 * Mark a horse as last fed two days ago so its next real feed is accepted.
 * Fails loudly unless exactly that one horse row was written.
 */
export async function markHorseFedTwoDaysAgo(horseId: number): Promise<Date> {
  const horse = await getHorseDelegate();
  const lastFedDate = new Date(Date.now() - BACKDATE_DAYS * DAY_MS);
  const { count } = await horse.updateMany({ where: { id: horseId }, data: { lastFedDate } });
  if (count !== 1) {
    throw new Error(
      `feedHistory fixture expected to update horse ${horseId}, updated ${count} row(s)`
    );
  }
  return lastFedDate;
}
