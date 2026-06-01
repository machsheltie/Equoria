/**
 * Horse Detail — Conformation Tab E2E (Equoria-ffaca, ruycn follow-up)
 *
 * Replaces the deleted vi.mock'd ConformationTab unit test
 * (frontend/src/components/horse/__tests__/ConformationTab.test.tsx — removed
 * under Equoria-ruycn for vi.mock-of-useConformation API/hook mocking). That
 * suite asserted 8 score cards render, the breed-comparison toggle flips, and
 * the score-display values render — all against fabricated hook returns. This
 * spec exercises the same surfaces against real backend data through real
 * authenticated session navigation.
 *
 * Constitution §3 mandate: no bypass headers, no mocks. Uses the global-setup
 * storage state and the seeded starter horse (E2E_TEST_HORSE_ID written into
 * process.env by tests/e2e/global-setup.ts).
 *
 * Existing /tests/e2e/conformation-shows.spec.ts covers the *competition entry*
 * Conformation Shows tab on CompetitionBrowserPage (data-testid
 * "conformation-tab-panel"). That surface is entirely separate from the
 * horse-detail Conformation tab covered here (data-testid "conformation-tab"
 * inside HorseDetailPage). No overlap.
 *
 * The starter horse seeded by global-setup may or may not have conformation
 * data populated depending on backend defaults. The spec mirrors the pattern
 * in horse-detail-coat-genetics.spec.ts: assert the structural container
 * renders, then branch on the real-data path (score cards) vs the
 * no-data fallback ("conformation-no-data"). Both are real, beta-relevant
 * paths.
 */

import { test, expect } from '@playwright/test';
import { readTestCredentials } from './helpers/credentials';

test.describe('Horse Detail — Conformation Tab (Equoria-ffaca)', () => {
  test('owner can view conformation scores tab on a real horse', async ({ page }) => {
    const creds = readTestCredentials();
    const horseId = creds.testHorseId;
    if (!horseId) {
      throw new Error(
        'E2E_TEST_HORSE_ID missing in process.env — global-setup must seed a starter horse'
      );
    }

    await page.goto(`/horses/${horseId}`, { waitUntil: 'domcontentloaded' });

    // Header (h1) reflects the horse name — confirms the detail page loaded.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // The Conformation tab is registered in HorseDetailPage.tsx with label
    // "Conformation". Click it to load the ConformationTab component.
    const conformationTab = page.getByRole('button', { name: /^Conformation$/ }).first();
    await expect(conformationTab).toBeVisible({ timeout: 10000 });
    await conformationTab.click();

    // ConformationTab renders one of three top-level containers depending on
    // backend state: conformation-tab (data present), conformation-no-data
    // (no scores), or conformation-error (fetch failure). The first two are
    // valid real-data paths; the third would be a real beta defect surfaced
    // by the test — we assert one of the success containers is visible.
    const conformationContainer = page.locator('[data-testid="conformation-tab"]');
    const noDataContainer = page.locator('[data-testid="conformation-no-data"]');

    const sawConformation = await conformationContainer
      .waitFor({ state: 'visible', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (sawConformation) {
      // Real data path — the tab renders 9 ConformationScoreCard items
      // (head, neck, shoulders, back, hindquarters, legs, hooves, topline,
      // overallConformation). The ruycn-deleted unit test asserted "8 score
      // cards" (the older 8-region taxonomy); the current code renders 9
      // cards (topline added). We assert at least 8 to remain robust against
      // future taxonomy adjustments while still catching a render regression.
      const scoreCards = page.locator('[data-testid^="conformation-score-card-"]');
      await expect(scoreCards.first()).toBeVisible({ timeout: 10000 });
      const cardCount = await scoreCards.count();
      expect(cardCount).toBeGreaterThanOrEqual(8);

      // Score-display elements must each render a numeric score (XX/100).
      // Asserting the first one is non-empty proves the score rendering
      // pipeline (hook -> ConformationScoreCard -> formatScore) is wired.
      const firstScoreDisplay = page
        .locator('[data-testid^="score-display-"]')
        .first();
      await expect(firstScoreDisplay).toBeVisible({ timeout: 10000 });
      const scoreText = (await firstScoreDisplay.textContent())?.trim() ?? '';
      expect(scoreText.length).toBeGreaterThan(0);

      // Breed-comparison toggle is only rendered when the horse has a
      // breedId (passed into ConformationTab as a prop). The starter horse
      // created during onboarding does have a breedId, so the toggle should
      // render. If it does, exercise its UI state transition — the ruycn
      // unit test asserted aria-checked flips on click. We do the same here.
      const toggle = page.locator('[data-testid="breed-comparison-toggle"]');
      const toggleVisible = await toggle
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (toggleVisible) {
        const beforeState = await toggle.getAttribute('aria-checked');
        await toggle.click();
        // aria-checked must flip after click — proves the controlled toggle
        // state actually transitions.
        await expect(toggle).not.toHaveAttribute('aria-checked', beforeState ?? '', {
          timeout: 5000,
        });
      }
    } else {
      // No-data fallback path — when the seeded horse has no conformation
      // scores yet, the component renders the no-data container. That is a
      // legitimate beta path (legacy horses pre-31E), so we assert it
      // instead of failing.
      await expect(noDataContainer).toBeVisible({ timeout: 5000 });
    }
  });
});
