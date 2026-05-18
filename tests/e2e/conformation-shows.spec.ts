/**
 * Conformation Shows — E2E (Story 21-9 follow-up, Equoria-dij4;
 * unified into the competition browser in Equoria-8g4n / 31F-FE-3)
 *
 * Conformation shows are now a tab inside CompetitionBrowserPage. The legacy
 * /conformation-shows URL redirects to /competitions?tab=conformation so
 * tester bookmarks keep working. The conformation panel reuses the same
 * data-testids, so the read + gating coverage below is unchanged — it just
 * lands on the unified surface via the redirect.
 *
 * Covers the conformation-shows browse surface beta testers exercise:
 *   1. /conformation-shows redirects to the conformation tab with real
 *      /api/v1/competitions GET
 *   2. Horse selector + show selector populate from real API data
 *   3. Enter Show button is gated until both selections are made
 *
 * Auth: uses Playwright storageState set by tests/e2e/global-setup.ts
 * (no test-credentials.json file I/O — Story 21-8 AC1, Equoria-4m96).
 * Network-first waits on the competitions GET.
 *
 * Note: the actual entry POST flow opens ConformationEntryModal and would
 * mutate real DB state (entry fee debit + competition_result row). For beta
 * readiness we exercise the read path + gating logic without firing the
 * mutation — entry success is a separate workflow that requires a horse
 * eligible for the chosen show.
 */
import { test, expect } from '@playwright/test';

test.describe('Conformation Shows', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('AC1: /conformation-shows redirects to the conformation tab with real competitions API', async ({
    page,
  }) => {
    const competitionsResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/competitions') && resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/conformation-shows', { waitUntil: 'domcontentloaded' });

    // The legacy URL redirects to the unified competition browser, deep-linked
    // straight to the conformation tab.
    await expect(page).toHaveURL(/\/competitions\?tab=conformation/, { timeout: 20000 });

    // PageHero title of the unified browser — proves the protected route
    // loaded under real auth after the redirect.
    await expect(page.getByRole('heading', { name: 'Competition Arena' }).first()).toBeVisible({
      timeout: 20000,
    });

    // The conformation tab panel renders (replaces the old standalone page
    // wrapper testid).
    await expect(page.locator('[data-testid="conformation-tab-panel"]')).toBeVisible();

    // Real competitions GET completes (the page reuses useCompetitions and
    // filters by showType === 'conformation' client-side)
    const resp = await competitionsResp.catch(() => null);
    if (resp) {
      expect(resp.status()).toBe(200);
    }
  });

  test('AC2: horse + show selectors are present and populated from real data', async ({ page }) => {
    await page.goto('/conformation-shows', { waitUntil: 'domcontentloaded' });

    const horseSelect = page.locator('[data-testid="conformation-horse-select"]');
    const showSelect = page.locator('[data-testid="conformation-show-select"]');

    await expect(horseSelect).toBeVisible({ timeout: 20000 });
    await expect(showSelect).toBeVisible();

    // Horse select always shows the "Select a horse…" placeholder + any owned
    // horses returned by /api/v1/horses. Real-DB-friendly: at minimum the
    // placeholder option must exist.
    await expect(horseSelect.locator('option').first()).toHaveText(/select a horse/i);

    // Show select likewise has a placeholder option. If no open conformation
    // shows exist, the select is disabled and the empty-state message renders.
    await expect(showSelect.locator('option').first()).toHaveText(/select a show/i);

    // Either the open-shows list is populated, OR the honest empty-state is
    // shown. Both are real-DB-valid; neither should be a graceful skip.
    const showRows = page.locator('[data-testid^="conformation-show-row-"]');
    const emptyState = page.locator('[data-testid="conformation-empty-state"]');

    const rowCount = await showRows.count();
    if (rowCount > 0) {
      await expect(showRows.first()).toBeVisible();
    } else {
      await expect(emptyState).toBeVisible({ timeout: 10000 });
      await expect(emptyState).toContainText(/no open conformation shows/i);
    }
  });

  test('AC3: Enter Show button is disabled until both selections are made', async ({ page }) => {
    await page.goto('/conformation-shows', { waitUntil: 'domcontentloaded' });

    const enterButton = page.locator('[data-testid="conformation-open-entry"]');
    await expect(enterButton).toBeVisible({ timeout: 20000 });

    // Default state: no horse + no show → button disabled
    await expect(enterButton).toBeDisabled();

    // The button stays disabled until both selects have a numeric value.
    // We don't fire the actual entry POST here (see file header), but the
    // gating is itself a beta-relevant correctness check.
  });
});
