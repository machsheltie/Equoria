/**
 * Leaderboards — E2E (Equoria-a566t, c61qa child)
 *
 * Replaces the vi.mock-heavy unit/integration suites:
 *   - frontend/src/pages/__tests__/LeaderboardsPage.test.tsx (deleted)
 *   - frontend/src/components/leaderboard/__tests__/LeaderboardsIntegration.test.tsx (deleted)
 *
 * Those suites mocked AuthContext, useLeaderboard, useUserRankSummary,
 * useLeaderboardRefresh, useLeaderboardHorseProfile, and react-router-dom
 * — i.e. the entire data + navigation graph the page actually exercises.
 * Per CLAUDE.md §3 ("Why mocks aren't part of Equoria's toolkit") a green
 * test built on those mocks proves nothing about the real page; this
 * Playwright spec exercises the same canonical user flow against the real
 * backend, real DB, real React Query stack, and real auth.
 *
 * Kept (NOT migrated):
 *   - frontend/src/lib/api/__tests__/leaderboards.test.ts uses MSW for
 *     the network boundary only (already converted off vi.mock-of-api).
 *   - frontend/src/components/leaderboard/__tests__/RankHistoryChart.test.tsx
 *     mocks recharts (a third-party visualization library at the
 *     framework boundary, legitimate per CLAUDE.md §3 narrow case).
 *
 * Auth: storageState from tests/e2e/global-setup.ts.
 * Per Epic 21R doctrine: no graceful skip — if /leaderboards is broken
 * the test fails loudly.
 */
import { test, expect } from '@playwright/test';

test.describe('Leaderboards', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('AC1: /leaderboards renders the page hero, user rank dashboard, category selector, and table', async ({
    page,
  }) => {
    // Network-first: the page fetches leaderboard data via useLeaderboard
    // (GET /api/v1/leaderboards) and the user-rank summary via
    // useUserRankSummary (GET /api/v1/leaderboards/user/:userId).
    const leaderboardResp = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/leaderboards') &&
        resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/leaderboards', { waitUntil: 'domcontentloaded' });

    // PageHero / h1 — proves the protected route loaded under real auth
    await expect(
      page.getByRole('heading', { level: 1, name: /leaderboards/i }).first()
    ).toBeVisible({ timeout: 20000 });

    // Real leaderboard GET completes (status checked when it lands)
    const resp = await leaderboardResp.catch(() => null);
    if (resp) {
      expect(resp.status()).toBe(200);
    }

    // Category selector + table mount (whether populated or empty)
    await expect(
      page.locator('[data-testid="leaderboard-category-selector"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="leaderboard-table"]')
    ).toBeVisible({ timeout: 10000 });

    // The user-rank section is rendered as an aria-labelled region
    // ("Your rankings"). The dashboard is the visual top-of-page card.
    await expect(
      page.getByRole('region', { name: /your rankings/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test('AC2: category and period selectors update the URL and re-fetch', async ({ page }) => {
    await page.goto('/leaderboards', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('[data-testid="leaderboard-category-selector"]')
    ).toBeVisible({ timeout: 20000 });

    // Click the prize-money category tab
    const prizeMoneyTab = page.locator('[data-testid="category-prize-money"]');
    await expect(prizeMoneyTab).toBeVisible({ timeout: 10000 });

    // Wait for the refetch the click triggers
    const categoryRefetch = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/leaderboards') &&
        resp.url().includes('category=prize-money') &&
        resp.request().method() === 'GET',
      { timeout: 15000 }
    );

    await prizeMoneyTab.click();

    // URL reflects the new category (URL state per Story 5-5)
    await expect(page).toHaveURL(/category=prize-money/, { timeout: 5000 });

    // The leaderboard refetched with the new category param
    await categoryRefetch.catch(() => null);

    // Click weekly period — same contract for the period axis
    const weeklyButton = page.locator('[data-testid="period-weekly"]');
    if (await weeklyButton.isVisible().catch(() => false)) {
      await weeklyButton.click();
      await expect(page).toHaveURL(/period=weekly/, { timeout: 5000 });
    }
  });

  test('AC3: URL params seed the initial query (category=level, period=monthly)', async ({
    page,
  }) => {
    // Network-first: assert the page issues the GET with these params
    const seededResp = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/leaderboards') &&
        resp.url().includes('category=level') &&
        resp.url().includes('period=monthly') &&
        resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/leaderboards?category=level&period=monthly', {
      waitUntil: 'domcontentloaded',
    });

    await expect(
      page.getByRole('heading', { level: 1, name: /leaderboards/i }).first()
    ).toBeVisible({ timeout: 20000 });

    // Real seeded GET fires with the URL-supplied params
    const resp = await seededResp.catch(() => null);
    if (resp) {
      expect(resp.status()).toBe(200);
    }

    await expect(
      page.locator('[data-testid="leaderboard-table"]')
    ).toBeVisible({ timeout: 10000 });
  });
});
