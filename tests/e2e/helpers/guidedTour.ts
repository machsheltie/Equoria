import { expect, type Page } from '@playwright/test';

/**
 * Owner ruling 2026-09-30 (Equoria-bvddn.31).
 * OLD contract: finishing the onboarding wizard ended onboarding
 * (completedOnboarding true, step 10), so specs went straight to the game.
 * NEW contract: finishing the wizard hands the player INTO the 9-step spotlight
 * tour (step 1, completedOnboarding false). A player who does not want the tour
 * presses "Skip", which calls complete-onboarding.
 *
 * Owner ruling 2026-10-23 (Equoria-kd2dd): before the tour, the one-time
 * welcome note greets the new player, and the tour stays quiet while the note
 * is owed. Its Continue records welcomeSeen and loads the News page, where the
 * tour then opens at step 1. Until Equoria-cgx4h this helper still expected the
 * tour card straight after the wizard, so global setup failed in every Burn-In
 * iteration of run 40171268724 with the welcome dialog on screen.
 *
 * Call this right after the wizard lands on /stable. It answers the welcome
 * note the way a player would (Continue, which loads /news), asserts the
 * hand-off to the tour happened (the tour card is showing step 1), skips the
 * tour, waiting for the server to record completion so later navigation, other
 * specs and saved storage state see a finished player, and returns to /stable.
 */
export async function skipGuidedTourAfterWizard(page: Page): Promise<void> {
  const welcome = page.getByRole('dialog', { name: /^Welcome .+!$/ });
  await expect(welcome).toBeVisible({ timeout: 15000 });
  const welcomeSeen = page.waitForResponse(
    (res) => res.url().includes('/api/v1/auth/welcome-seen') && res.request().method() === 'POST',
    { timeout: 30000 }
  );
  await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await welcomeSeen).status()).toBe(200);
  await page.waitForURL(/\/news$/, { timeout: 15000 });
  await expect(welcome).toBeHidden({ timeout: 10000 });

  await expect(page.getByText('Step 1 of 10')).toBeVisible({ timeout: 15000 });

  const completed = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/auth/complete-onboarding') && res.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  expect((await completed).status()).toBe(200);

  await expect(page.getByText('Step 1 of 10')).toBeHidden({ timeout: 10000 });

  // Callers continue on the stable the wizard landed on (they check the starter
  // horse there), so walk back to it now that the note took the player to News.
  await page.goto(new URL('/stable', page.url()).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/stable$/, { timeout: 15000 });
}
