/**
 * Trainers Manage tab — four-state ERROR path — E2E (Equoria-u96fm, Equoria-i2xxj)
 *
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§7: a FAILED trainers fetch on the Manage tab
 * (MyTrainersDashboard) must render a real ERROR state with a retry affordance — NOT
 * collapse into the honest-looking "No Trainers Hired" empty state.
 *
 * Real backend, real auth (storageState from tests/e2e/global-setup.ts),
 * NODE_ENV=beta CSRF. No route interception, no bypass headers, no test.skip.
 * Owner ruling 2026-10-23 (Equoria-i2xxj): the error is a REAL failure, not a
 * synthetic 500 fulfilled with page.route (which mocked the primary API read).
 * The trigger is a genuinely unreachable network (context.setOffline), the same
 * one the prize-history and Vault specs use. A real backend 500 on this read
 * cannot be produced from the test without fault injection in the app, so the
 * network failure is the real path; the never-render-the-raw-server-body rule
 * for a 500 stays covered by the component test
 * (frontend/src/components/__tests__/MyTrainersDashboard.fourstate.test.tsx).
 *
 * The trainers hooks use networkMode 'always' (Equoria-i2xxj): before that, an
 * offline read PAUSED, the dashboard skipped both its loading and error
 * branches, and the player was told "No Trainers Hired".
 */
import { test, expect } from '@playwright/test';

const TRAINERS_USER_PATH = /^\/api\/v1\/trainers\/user\//;

test.describe('Trainers Manage tab — error state (Equoria-u96fm)', () => {
  test.beforeEach(() => {
    test.setTimeout(90_000);
  });

  test('a failed trainers read renders ERROR + retry, never the false "No Trainers Hired" empty', async ({
    page,
    context,
  }) => {
    // A real player path: she opens the Manage tab online (route chunk loaded,
    // trainers read once), steps into the Vault from the coins in the HUD, and
    // comes back after the cached read has expired (React Query's 5-minute
    // gcTime, advanced with Playwright's clock) while her connection is down.
    await page.clock.install();
    const firstReadOk = page.waitForResponse(
      (resp) =>
        TRAINERS_USER_PATH.test(new URL(resp.url()).pathname) &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 30_000 }
    );
    await page.goto('/trainers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Trainer Academy').first()).toBeVisible({ timeout: 20_000 });
    await firstReadOk;

    try {
      await page.getByTestId('coins-display').click();
      await expect(page).toHaveURL(/\/bank$/);
      await page.clock.fastForward('06:00');
      await context.setOffline(true);
      await page.goBack();
      await expect(page).toHaveURL(/\/trainers$/);

      // The Manage tab is the default; the failed read must surface the ErrorCard
      // (role="alert") with the section title and a wired "Try Again" button.
      const errorAlert = page
        .getByRole('alert')
        .filter({ hasText: /couldn't load your trainers/i });
      await expect(errorAlert).toBeVisible({ timeout: 30_000 });
      const tryAgain = errorAlert.getByRole('button', { name: /try again/i });
      await expect(tryAgain).toBeVisible();

      // The false empty must NOT appear on a failed fetch.
      await expect(page.getByText(/no trainers hired/i)).toHaveCount(0);

      // Retry recovers: back online, the retry refetch hits the real backend and
      // the dashboard resolves (grid for an owner, or the honest empty for a
      // player with none) — either way the error state is gone.
      const retryOk = page.waitForResponse(
        (resp) =>
          TRAINERS_USER_PATH.test(new URL(resp.url()).pathname) &&
          resp.request().method() === 'GET' &&
          resp.status() === 200,
        { timeout: 30_000 }
      );
      await context.setOffline(false);
      await tryAgain.click();
      await retryOk;

      await expect(errorAlert).toHaveCount(0, { timeout: 20_000 });
      await expect(page.getByText(/couldn't load your trainers/i)).toHaveCount(0);
    } finally {
      await context.setOffline(false);
    }
  });
});
