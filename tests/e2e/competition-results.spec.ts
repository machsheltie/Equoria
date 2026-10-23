/**
 * Competition Results page — real results journey (Equoria-dyoyi, from
 * Equoria-oey96.5).
 *
 * oey96.5 wired CompetitionResultsPage's "My Results" list to the real
 * GET /api/v1/competition/user-results (it had been permanently empty). The
 * backend, hook and page are covered below the browser; this spec proves the
 * whole stack from a player's seat:
 *   1. a player with a real completed-show result opens /competition-results;
 *   2. her result card renders (not the empty state) and her stats count it;
 *   3. opening the card shows that show's real results, her horse included;
 *   4. a second player sees HER result and never the first player's.
 *
 * REAL backend, REAL DB, REAL auth. Each player is registered and onboarded
 * over the real API (fixtures/seededPlayer.ts); her onboarding starter horse is
 * given one completed-show result written to the test database
 * (fixtures/prizeHistory.ts — nothing in an E2E run settles a show, which only
 * the nightly job does). No route interception, no bypass headers, no skips.
 *
 * The oey96.5 note also listed a "view performance → ScoreBreakdownRadar" step.
 * That control is not on this page — it belongs to the horse page's
 * CompetitionHistory — so it is not part of this journey.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';
import {
  removeSeededPrizeResult,
  seedPrizeResult,
  type SeededPrizeResult,
} from './fixtures/prizeHistory';

type PlayerWithResult = { player: SeededPlayerSession; prize: SeededPrizeResult };

async function playerWithResult(
  browser: import('@playwright/test').Browser
): Promise<PlayerWithResult> {
  const player = await createSeededPlayerSession(browser);
  const prize = await seedPrizeResult(player.starterHorseId);
  return { player, prize };
}

async function release({ player, prize }: PlayerWithResult): Promise<void> {
  try {
    await removeSeededPrizeResult(prize);
  } finally {
    await player.context.close();
  }
}

const test = base.extend<object, { first: PlayerWithResult; second: PlayerWithResult }>({
  first: [
    async ({ browser }, use) => {
      const seeded = await playerWithResult(browser);
      await use(seeded);
      await release(seeded);
    },
    { scope: 'worker' },
  ],
  second: [
    async ({ browser }, use) => {
      const seeded = await playerWithResult(browser);
      await use(seeded);
      await release(seeded);
    },
    { scope: 'worker' },
  ],
});

/** Open /competition-results as `player` and wait for her real results read. */
async function openResults(player: SeededPlayerSession): Promise<Page> {
  const page = await player.context.newPage();
  const resultsOk = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/competition/user-results') &&
      resp.request().method() === 'GET' &&
      resp.status() === 200,
    { timeout: 30000 }
  );
  await page.goto('/competition-results', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('competition-results-page')).toBeVisible({ timeout: 20000 });
  await resultsOk;
  return page;
}

test.describe('Competition Results — real results journey (Equoria-dyoyi)', () => {
  test('a player sees her own result, opens it, and sees the show’s real results', async ({
    first,
    second,
  }) => {
    const page = await openResults(first.player);
    try {
      const cards = page.getByTestId('result-card');
      const own = cards.filter({ hasText: first.prize.showName });
      await expect(own).toHaveCount(1, { timeout: 15000 });
      await expect(cards).toHaveCount(1);
      await expect(cards.filter({ hasText: second.prize.showName })).toHaveCount(0);
      await expect(page.getByTestId('empty-state-banner')).toHaveCount(0);
      await expect(page.getByTestId('stat-total-competitions')).toContainText('1', {
        timeout: 15000,
      });

      const showResultsOk = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/v1/competition/show/${first.prize.showId}/results`) &&
          resp.request().method() === 'GET' &&
          resp.status() === 200,
        { timeout: 20000 }
      );
      await own.click();
      const modal = page.getByTestId('competition-results-modal');
      await expect(modal).toBeVisible({ timeout: 10000 });
      await showResultsOk;
      await expect(modal.getByTestId(`result-row-${first.player.starterHorseId}`)).toBeVisible({
        timeout: 15000,
      });
    } finally {
      await page.close();
    }
  });

  test('a second player sees her result and never the first player’s', async ({
    first,
    second,
  }) => {
    const page = await openResults(second.player);
    try {
      const cards = page.getByTestId('result-card');
      await expect(cards.filter({ hasText: second.prize.showName })).toHaveCount(1, {
        timeout: 15000,
      });
      await expect(cards).toHaveCount(1);
      await expect(cards.filter({ hasText: first.prize.showName })).toHaveCount(0);
    } finally {
      await page.close();
    }
  });
});
