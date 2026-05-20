/**
 * Prizes Claim E2E Smoke Test
 *
 * Verifies the /prizes claim write flow works end-to-end with production parity
 * (no bypass headers, real API calls) against the canonical 7-day deferred-window
 * show model (Equoria-nx8t1 / Equoria-kacla). The legacy instant enter-and-run
 * path (POST /enter-show) was removed (410 Gone), so this spec exercises the REAL
 * deferred flow: create → enter → cron-execute → claim.
 *
 * Flow:
 *   1. Register a new player and complete onboarding (provides a starter mare,
 *      age 3, healthStatus 'Excellent' — passes the /enter age + health gates).
 *   2. Create a player-run show with a real prize via POST /api/v1/shows/create
 *      (the creator is debited the full prize at creation; entryFee 0 so the
 *      entrant pays nothing).
 *   3. Enter the starter horse via POST /api/v1/competition/enter — the canonical
 *      deferred entry that writes a ShowEntry (the row the nightly cron scores).
 *      NO instant result is produced.
 *   4. Advance the show's closeDate into the past (real DB write — a TIME
 *      precondition only; scoring, prize distribution, and claim all run through
 *      real production code). A real e2e test cannot wait 7 real days, and the
 *      cron's selection predicate is `status='open' AND closeDate <= now`, so the
 *      canonical, non-bypass way to drive it in a test is to make closeDate past
 *      (mirrors backend sevenDayShowModel.test.mjs R8).
 *   5. Drive the REAL cron executor via POST /api/v1/shows/execute — the only
 *      sanctioned scorer (showController.executeClosedShows). This genuinely
 *      scores every entrant, distributes prize money, and writes a real
 *      CompetitionResult row. NOT an instant-execute, NOT a faked result.
 *   6. Read the real persisted CompetitionResult for our horse from the DB.
 *   7. Navigate to /prizes to confirm the page loads without errors.
 *   8. POST /api/v1/competition/:id/claim-prizes — claim the real result.
 *   9. Assert the claim response echoes the real persisted prize money / placement
 *      / discipline, and that the prize money was genuinely credited to the
 *      player's balance by the cron.
 *  10. Cleanup: delete the show, entries, result, and horse records.
 *
 * Issue: Equoria-qc11 (original) / Equoria-fg7wq (deferred-model rewrite)
 */

import { test, expect } from '@playwright/test';
// @ts-expect-error — JS module without .d.ts; import works at runtime via Node.
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  csrfRequest,
  expectOk,
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
  unwrapData,
  visitLiveRoute,
} from './support/prodParity';

const SHOW_PRIZE = 100; // real prize pool; 1st place takes 50% = 50

test.afterAll(async () => {
  try {
    await prisma.competitionResult.deleteMany({
      where: { showName: { startsWith: 'Prizes Readiness Show' } },
    });
    await prisma.showEntry.deleteMany({
      where: { show: { name: { startsWith: 'Prizes Readiness Show' } } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'Prizes Readiness Show' } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'PrizesTest Horse' } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test('prizes claim write flow: deferred 7-day show executes via cron and prize is claimed with no bypass headers', async ({
  page,
}) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_prizes`;

  // Step 1: Register fresh player — provides a starter mare (age 3, healthy).
  const player = await registerAndCompleteOnboarding(page, suffix, `PrizesTest Horse ${suffix}`);
  const starterHorseId = Number(player.horse.id);
  expect(starterHorseId).toBeGreaterThan(0);

  // Step 2: Create a 7-day deferred-window show with a real prize. Dressage with
  // entryFee 0 means the entrant pays nothing; the creator (this player) is
  // debited the full prize (SHOW_PRIZE) at creation. prize >= 10 * entryFee is
  // trivially satisfied (entryFee 0).
  const showJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/shows/create', {
      name: `Prizes Readiness Show ${suffix}`,
      discipline: 'Dressage',
      entryFee: 0,
      prize: SHOW_PRIZE,
      description: 'Prizes readiness claim smoke test',
    }),
    'POST /api/v1/shows/create'
  );
  const show = unwrapData<{ show: { id: number } }>(showJson).show;
  expect(show.id).toBeGreaterThan(0);

  // Step 3: Enter the starter horse via the canonical deferred-entry endpoint.
  // This writes a ShowEntry (the row the cron scores) and returns NO instant
  // result. The starter horse is age 3 and 'Excellent' health, so it passes the
  // /enter age (>= 3) and not-injured gates.
  const enterJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/competition/enter', {
      horseId: starterHorseId,
      showId: show.id,
    }),
    'POST /api/v1/competition/enter'
  );
  const entry = unwrapData<{ entryId: number; horseId: number; showId: number }>(enterJson);
  expect(entry.entryId, 'Deferred entry must persist a ShowEntry id').toBeGreaterThan(0);
  expect(entry.horseId).toBe(starterHorseId);
  // Critically: the deferred entry response carries NO results/placement/score.
  expect(
    (enterJson as Record<string, unknown>).results,
    'Deferred entry must NOT return instant results'
  ).toBeUndefined();

  // Step 4: Advance the show's closeDate into the past so the real cron executor
  // selects it (`status='open' AND closeDate <= now`). This is a TIME precondition
  // only — no scoring/payout logic is bypassed. A real e2e cannot wait 7 days;
  // this mirrors the canonical backend pattern in sevenDayShowModel.test.mjs R8.
  await prisma.show.update({
    where: { id: show.id },
    data: { closeDate: new Date(Date.now() - 60 * 60 * 1000) }, // 1h ago
  });

  // Capture the entrant's balance before execution so we can prove the cron
  // genuinely credited the prize money (not a faked claim response).
  const entrantBefore = await prisma.horse.findUnique({
    where: { id: starterHorseId },
    select: { user: { select: { id: true, money: true } } },
  });
  const ownerUserId = entrantBefore!.user!.id;
  const balanceBefore = Number(entrantBefore!.user!.money);

  // Step 5: Drive the REAL nightly cron executor (the only sanctioned scorer).
  // It scores every entrant from raw stats, distributes the prize pool, and
  // writes real CompetitionResult rows.
  const execJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/shows/execute'),
    'POST /api/v1/shows/execute'
  );
  const execData = unwrapData<{ executed: number }>(execJson);
  expect(
    execData.executed,
    'Cron must report at least one executed show'
  ).toBeGreaterThanOrEqual(1);

  // The show must now be 'completed' with an executedAt timestamp.
  const executedShow = await prisma.show.findUnique({
    where: { id: show.id },
    select: { status: true, executedAt: true },
  });
  expect(executedShow!.status, 'Show must be marked completed by the cron').toBe('completed');
  expect(executedShow!.executedAt, 'Show must have an executedAt timestamp').not.toBeNull();

  // Step 6: Read the real persisted CompetitionResult the cron wrote for our horse.
  const persistedResult = await prisma.competitionResult.findFirst({
    where: { horseId: starterHorseId, showId: show.id },
    select: { id: true, prizeWon: true, placement: true, discipline: true },
  });
  expect(
    persistedResult,
    `Cron must have written a CompetitionResult for horse ${starterHorseId}`
  ).toBeTruthy();
  const competitionResultId = persistedResult!.id;
  expect(competitionResultId).toBeGreaterThan(0);
  // Single entrant ⇒ 1st place ⇒ 50% of the prize pool.
  const expectedPrize = Math.floor(SHOW_PRIZE * 0.5);
  expect(
    Number(persistedResult!.prizeWon),
    'Persisted prize for the sole 1st-place entrant must be 50% of the pool'
  ).toBe(expectedPrize);

  // Prove the cron genuinely credited the prize money to the player's balance.
  const balanceAfter = Number(
    (await prisma.user.findUnique({ where: { id: ownerUserId }, select: { money: true } }))!.money
  );
  expect(
    balanceAfter,
    'Cron must have credited the real prize money to the player balance'
  ).toBe(balanceBefore + expectedPrize);

  // Step 7: Navigate to /prizes page — must load without error.
  await visitLiveRoute(page, '/prizes');

  // Step 8: Claim the prize via POST /api/v1/competition/:id/claim-prizes.
  const claimJson = await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/competition/${competitionResultId}/claim-prizes`),
    `POST /api/v1/competition/${competitionResultId}/claim-prizes`
  );

  // Step 9: Assert the claim response echoes the REAL persisted result.
  const claimData = unwrapData<{
    competitionResultId: number;
    competitionName: string;
    horseName: string;
    horseId: number;
    placement: string;
    prizeMoney: number;
    discipline: string;
    runDate: string;
  }>(claimJson);

  expect(claimData.competitionResultId, 'Claim response must echo the competitionResultId').toBe(
    competitionResultId
  );
  expect(claimData.prizeMoney, 'Claim prizeMoney must match the persisted prize').toBe(
    expectedPrize
  );
  expect(claimData.horseId, 'Claim response must identify the horse').toBe(starterHorseId);
  expect(typeof claimData.placement, 'Claim response must include placement').toBe('string');
  expect(claimData.discipline, 'Claim response must include the real discipline').toBe('Dressage');

  guard.assertClean();
});
