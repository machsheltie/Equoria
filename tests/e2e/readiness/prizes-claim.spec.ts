/**
 * Prizes Claim E2E Smoke Test
 *
 * Verifies the /prizes claim write flow works end-to-end with production parity
 * (no bypass headers, real API calls).
 *
 * Flow:
 *   1. Register a new player and complete onboarding (provides a starter mare)
 *   2. Create a show and enter the horse via POST /api/v1/competition/enter-show
 *      (this immediately runs the competition and produces a CompetitionResult)
 *   3. Find the competition result ID from the response
 *   4. Navigate to /prizes to confirm the page loads without errors
 *   5. POST /api/v1/competition/:id/claim-prizes — claim the result
 *   6. Assert claim response contains the expected fields
 *   7. Cleanup: delete the show and result records
 *
 * Issue: Equoria-qc11
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

test.afterAll(async () => {
  try {
    await prisma.competitionResult.deleteMany({
      where: { showName: { startsWith: 'Prizes Readiness Show' } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'Prizes Readiness Show' } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'PrizesTest Horse' } },
    });
    // Rider assignments and hired riders are cleaned up automatically when
    // the horse is deleted (cascade) — no explicit cleanup needed here.
  } finally {
    await prisma.$disconnect();
  }
});

test('prizes claim write flow: enter competition and claim result with no bypass headers', async ({
  page,
}) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_prizes`;

  // Step 1: Register fresh player — provides a starter mare
  const player = await registerAndCompleteOnboarding(page, suffix, `PrizesTest Horse ${suffix}`);
  const starterHorseId = Number(player.horse.id);
  expect(starterHorseId).toBeGreaterThan(0);

  // Step 2: Create a show for the competition (use Dressage — no entry fee so no balance drain)
  const showJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/shows/create', {
      name: `Prizes Readiness Show ${suffix}`,
      discipline: 'Dressage',
      entryFee: 0,
      maxEntries: 20,
      description: 'Prizes readiness claim smoke test',
    }),
    'POST /api/v1/shows/create'
  );
  const show = unwrapData<{ show: { id: number } }>(showJson).show;
  expect(show.id).toBeGreaterThan(0);

  // Step 2b: Feed the starter horse so it passes the critical-health gate.
  // The competition engine (enterAndRunShow) checks getDisplayedHealth() for each
  // horse, which is worseOf(feedHealth, vetHealth). A horse with lastFedDate=null
  // always has feedHealth='critical', blocking competition entry regardless of
  // healthStatus. We must purchase feed, equip it, and feed the horse before entry.
  const feedCatalog = unwrapData<Array<{ id: string }>>(
    await expectOk(
      await page.request.get('/api/v1/feed-shop/catalog'),
      'GET /api/v1/feed-shop/catalog'
    )
  );
  const feedTier = feedCatalog[0].id;
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier,
      packs: 1,
    }),
    'POST /api/v1/feed-shop/purchase'
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${starterHorseId}/equip-feed`, {
      feedType: feedTier,
    }),
    'POST /api/v1/horses/:id/equip-feed'
  );
  await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/horses/${starterHorseId}/feed`, {}),
    'POST /api/v1/horses/:id/feed'
  );

  // Step 2c: Hire a rider and assign to the starter horse.
  // The competition engine (enterAndRunShow) requires each competing horse to
  // have a non-null rider object (hasValidRider check). A freshly created horse
  // has no rider, so we must hire one from the marketplace and assign it before
  // entering the show.
  const riderMarket = unwrapData<{ riders: Array<{ marketplaceId: string; weeklyRate: number }> }>(
    await expectOk(
      await page.request.get('/api/v1/riders/marketplace'),
      'GET /api/v1/riders/marketplace'
    )
  );
  expect(
    riderMarket.riders.length,
    'Rider marketplace must have at least one rider'
  ).toBeGreaterThan(0);
  const cheapestRider = riderMarket.riders.reduce((cheapest, rider) =>
    rider.weeklyRate < cheapest.weeklyRate ? rider : cheapest
  );
  const riderHireResult = unwrapData<{ rider: { id: number } }>(
    await expectOk(
      await csrfRequest(page, 'POST', '/api/v1/riders/marketplace/hire', {
        marketplaceId: cheapestRider.marketplaceId,
      }),
      'POST /api/v1/riders/marketplace/hire'
    )
  );
  await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/riders/assignments', {
      riderId: riderHireResult.rider.id,
      horseId: starterHorseId,
      notes: 'Prizes readiness smoke test',
    }),
    'POST /api/v1/riders/assignments'
  );

  // Step 3: Enter and immediately run the show
  // enter-show both enters AND runs the competition in one request, returning savedResults
  const enterRunJson = await expectOk(
    await csrfRequest(page, 'POST', '/api/v1/competition/enter-show', {
      showId: show.id,
      horseIds: [starterHorseId],
    }),
    'POST /api/v1/competition/enter-show'
  );

  // The response does NOT go through the standard { data: ... } wrapper —
  // enterAndRunShow returns the result object directly.
  const enterRunResult = enterRunJson as {
    success: boolean;
    results: Array<{ id: number; horseId: number; placement: string; prizeWon: number }>;
    summary: Record<string, unknown>;
  };
  expect(enterRunResult.success, 'enter-show must succeed: ' + JSON.stringify(enterRunResult)).toBe(
    true
  );
  expect(
    Array.isArray(enterRunResult.results) && enterRunResult.results.length > 0,
    'enter-show must return at least one competition result'
  ).toBe(true);

  // Find the result belonging to our horse
  const ourResult = enterRunResult.results.find((r) => r.horseId === starterHorseId);
  expect(ourResult, `Competition result for horse ${starterHorseId} must be present`).toBeTruthy();
  const competitionResultId = ourResult!.id;
  expect(competitionResultId).toBeGreaterThan(0);

  // Step 4: Navigate to /prizes page — must load without error
  await visitLiveRoute(page, '/prizes');

  // Step 5: Claim the prize via POST /api/v1/competition/:id/claim-prizes
  const claimJson = await expectOk(
    await csrfRequest(page, 'POST', `/api/v1/competition/${competitionResultId}/claim-prizes`),
    `POST /api/v1/competition/${competitionResultId}/claim-prizes`
  );

  // Step 6: Assert the claim response contains expected fields
  // The controller returns { success, message, data: { competitionResultId, ... } }
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
  expect(typeof claimData.prizeMoney, 'prizeMoney must be a number').toBe('number');
  expect(claimData.horseId, 'Claim response must identify the horse').toBe(starterHorseId);
  expect(typeof claimData.placement, 'Claim response must include placement').toBe('string');
  expect(claimData.discipline, 'Claim response must include discipline').toBe('Dressage');

  guard.assertClean();
});
