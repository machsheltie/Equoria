import { expect, type Page } from '@playwright/test';

/**
 * Owner ruling 2026-09-30 (Equoria-bvddn.31).
 * OLD contract: finishing the onboarding wizard ended onboarding
 * (completedOnboarding true, step 10), so specs went straight to the game.
 * NEW contract: finishing the wizard hands the player INTO the 9-step spotlight
 * tour (step 1, completedOnboarding false). A player who does not want the tour
 * presses "Skip", which calls complete-onboarding.
 *
 * Call this right after the wizard lands on /stable. It asserts the hand-off
 * happened (the tour card is showing step 1) and then skips the tour the way a
 * player would, waiting for the server to record completion so later
 * navigation, other specs and saved storage state see a finished player.
 */
export async function skipGuidedTourAfterWizard(page: Page): Promise<void> {
  await expect(page.getByText('Step 1 of 10')).toBeVisible({ timeout: 15000 });

  const completed = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/auth/complete-onboarding') && res.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  expect((await completed).status()).toBe(200);

  await expect(page.getByText('Step 1 of 10')).toBeHidden({ timeout: 10000 });
}
