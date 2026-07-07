/**
 * Profile Game-Statistics E2E Smoke Test (Equoria-oey96.2)
 *
 * Verifies the /profile "Game Statistics" cards render REAL non-zero values
 * from the backend — specifically Horses Owned and Competitions Won — for a
 * seeded user, with production parity (no bypass headers).
 *
 * Audit finding [P1-1]: the cards previously always rendered 0 for every
 * player because the /progress endpoint never returned totalHorses /
 * totalCompetitions / winRate / breedingCount (Constitution §2 forbids
 * "Unknown/0 masquerading as real data").
 *
 * Flow:
 *   1. Register a new player + complete onboarding (provides a starter horse
 *      → Horses Owned >= 1).
 *   2. Seed one competition result with a 1st-place finish for that horse via
 *      the real DB (→ Competitions Won >= 1, Win Rate > 0).
 *   3. Navigate to /profile.
 *   4. Assert the "Horses Owned" and "Competitions Won" StatisticsCards show
 *      non-zero values (real data, not the old always-0 placeholder).
 *   5. Assert no bypass headers were used.
 *
 * Issue: Equoria-oey96.2
 */

import { test, expect } from '@playwright/test';
// @ts-expect-error — JS module without .d.ts; import works at runtime via Node.
import prisma from '../../../packages/database/prismaClient.mjs';
import {
  expectOk,
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
  unwrapData,
} from './support/prodParity';

const HORSE_NAME_PREFIX = 'StatsCardTest Horse';
const SHOW_NAME_PREFIX = 'StatsCardTest Show';

test.afterAll(async () => {
  try {
    // FK order: results cascade-delete with the horse (onDelete: Cascade).
    await prisma.horse.deleteMany({
      where: { name: { startsWith: HORSE_NAME_PREFIX } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: SHOW_NAME_PREFIX } },
    });
  } finally {
    await prisma.$disconnect();
  }
});

test('profile Game-Statistics cards render real non-zero values with no bypass headers', async ({
  page,
}) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_stats`;

  // Step 1: Register fresh player + onboarding → 1 starter horse.
  await registerAndCompleteOnboarding(page, suffix, `${HORSE_NAME_PREFIX} ${suffix}`);

  // Step 2: Resolve the user id + starter horse id.
  const profileJson = await expectOk(
    await page.request.get('/api/v1/auth/profile'),
    'GET /api/auth/profile'
  );
  const profile = unwrapData<{ user: { id: string } }>(profileJson);
  const userId = profile.user.id;
  expect(userId, 'User ID must be a non-empty string').toBeTruthy();

  const horsesJson = await expectOk(await page.request.get('/api/v1/horses'), 'GET /api/horses');
  const horses = unwrapData<Array<{ id: number; name: string }>>(horsesJson);
  const starterHorse = horses.find((h) => h.name.startsWith(HORSE_NAME_PREFIX));
  expect(starterHorse, 'Starter horse must be findable by name prefix').toBeTruthy();
  const starterHorseId = Number(starterHorse!.id);

  // Step 3: Seed a real competition result (1st place) for the starter horse,
  // so Competitions Won and Win Rate are provably non-zero. Test-fixture setup
  // via the real DB — the READ path (/progress rendering) is what is under
  // test, mirroring the backend integration sentinel.
  const show = await prisma.show.create({
    data: {
      name: `${SHOW_NAME_PREFIX} ${suffix}`,
      discipline: 'Racing',
      levelMin: 1,
      levelMax: 20,
      entryFee: 100,
      prize: 1000,
      runDate: new Date(Date.now() - 86400000),
    },
  });
  await prisma.competitionResult.create({
    data: {
      score: 95.5,
      placement: '1st',
      discipline: 'Racing',
      runDate: new Date(Date.now() - 86400000),
      showName: show.name,
      horseId: starterHorseId,
      showId: show.id,
      prizeWon: 500,
    },
  });

  // Step 4: Navigate to /profile and wait for the progress fetch to settle.
  const progressSettled = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/users/${userId}/progress`) &&
      response.request().method() === 'GET'
  );
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await progressSettled;

  // The StatisticsCard exposes an aria-label of the form "<label>: <value>"
  // (frontend/src/components/StatisticsCard.tsx). Assert the two data-backed
  // cards are non-zero.
  const horsesOwnedCard = page.locator('[aria-label^="Horses Owned:"]').first();
  await horsesOwnedCard.waitFor({ state: 'visible' });
  await expect
    .poll(async () => (await horsesOwnedCard.getAttribute('aria-label')) ?? '', {
      timeout: 8000,
      message: 'Horses Owned card must render a real non-zero value',
    })
    .not.toBe('Horses Owned: 0');

  const competitionsWonCard = page.locator('[aria-label^="Competitions Won:"]').first();
  await competitionsWonCard.waitFor({ state: 'visible' });
  await expect
    .poll(async () => (await competitionsWonCard.getAttribute('aria-label')) ?? '', {
      timeout: 8000,
      message: 'Competitions Won card must render a real non-zero value',
    })
    .not.toBe('Competitions Won: 0');

  guard.assertClean();
});
