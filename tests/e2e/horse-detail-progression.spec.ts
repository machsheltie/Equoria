/**
 * Horse Detail — Progression Tab E2E (Equoria-prfgh, Equoria-c61qa child)
 *
 * Real-user coverage for the Progression tab on /horses/:id, which renders
 * (among other panels) the TrainingRecommendations component. Replaces the
 * deleted vi.mock'd unit tests:
 *
 *   - frontend/src/components/horse/__tests__/TrainingRecommendations.test.tsx
 *   - frontend/src/components/training/__tests__/TrainingHistoryPanel.test.tsx
 *
 * Constitution §3 mandate: vi.mock'd API/hook unit tests for these surfaces
 * are removed in favor of real-DB Playwright coverage. No bypass headers,
 * no mocks — uses the global-setup storage state + the seeded testHorseId.
 *
 * TrainingHistoryPanel lives inside TrainingDashboard (the /training page),
 * not inside ProgressionTab — its primary surface is already exercised by
 * tests/e2e/training-flow.spec.ts (training-page testid + train buttons).
 * This spec extends that coverage with a discipline-status assertion on the
 * /training page, so the deleted TrainingHistoryPanel unit test is replaced
 * by real-data E2E without inventing a second route for it.
 */

import { test, expect } from '@playwright/test';
import { readTestCredentials } from './helpers/credentials';

test.describe('Horse Detail — Progression Tab (Equoria-prfgh)', () => {
  test('owner can view TrainingRecommendations panel on the Progression tab', async ({ page }) => {
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

    // Progression tab was added in Equoria-kdduk.
    const progressionTab = page.getByRole('button', { name: /^Progression$/ }).first();
    await expect(progressionTab).toBeVisible({ timeout: 10000 });
    await progressionTab.click();

    // ProgressionTab container — lazy content may take a moment.
    await expect(page.locator('[data-testid="progression-tab"]')).toBeVisible({ timeout: 15000 });

    // TrainingRecommendations panel must render against real stats. The
    // wired component renders a single panel with this testid whether it
    // shows recommendations, the "fully trained" empty state, or an error
    // retry surface — all three are valid real-data paths.
    await expect(page.locator('[data-testid="training-recommendations"]')).toBeVisible({
      timeout: 15000,
    });

    // The "Training Recommendations" heading is present in every render path
    // (recommendations list, fully-trained empty state). This guards against
    // the panel mounting but failing to render its own UI.
    await expect(
      page.getByRole('heading', { name: /Training Recommendations/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('training dashboard exposes discipline status surface (TrainingHistoryPanel)', async ({
    page,
  }) => {
    // TrainingHistoryPanel renders inside TrainingDashboard on /training. Its
    // unit test was deleted along with the ProgressionTab test; this spec
    // confirms the real surface is reachable with real backend data.
    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="training-page"]')).toBeVisible({ timeout: 20000 });

    // The "Discipline Status" heading is the panel's primary tell. It renders
    // unconditionally once a horse is selected — TrainingDashboard auto-selects
    // the first owned horse, and global-setup seeds one. The heading text is
    // hardcoded in TrainingHistoryPanel.tsx and so is a stable real-DB assertion.
    await expect(page.getByRole('heading', { name: /Discipline Status/i }).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
