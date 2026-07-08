/**
 * Groom Manage tab — four-state ERROR path — E2E (Equoria-mljz9)
 *
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§7: a FAILED grooms fetch on the Manage tab
 * (MyGroomsDashboard) must render a real ERROR state with a retry affordance —
 * NOT collapse into the honest-looking "No Grooms Hired" empty state. Before the
 * mljz9 fix the dashboard had no error branch, so a 500 rendered the false empty.
 *
 * Real-backend, real-auth (storageState from tests/e2e/global-setup.ts),
 * NODE_ENV=beta CSRF — same harness as groom-marketplace-hire.spec.ts. No bypass
 * headers, no test.skip, no mocked primary path. The ONLY test-side control is a
 * transient 500 FAULT INJECTED on the grooms/user READ via page.route — the
 * sanctioned way to exercise an error UI against an otherwise-healthy backend
 * (the issue's own Test section: "force the grooms query to error"). It is not a
 * bypass header and not a mocked primary path; the intercepted path is versioned
 * (/api/v1/grooms/user/:id). Assignments/salaries are left to succeed, so the
 * error state is driven purely by the grooms read fault.
 *
 * ⚠️ LEAD-RUN NEEDED (fleet-worker note): this spec was authored in an isolated
 * fleet worktree where the frontend dev server + backend + Postgres + E2E
 * storageState could not be started, so it has NOT been executed here. The
 * companion MSW-boundary component test
 * (frontend/src/components/__tests__/MyGroomsDashboard.fourstate.test.tsx) IS
 * verified green and exercises the same four-state contract against the real
 * hooks + real api-client. Run this spec in the lead's E2E environment to
 * validate the real-backend path before closure.
 */
import { test, expect } from '@playwright/test';

const GROOMS_USER_GLOB = '**/api/v1/grooms/user/**';

test.describe('Groom Manage tab — error state (Equoria-mljz9)', () => {
  test.beforeEach(() => {
    test.setTimeout(90_000);
  });

  test('a failed grooms read renders ERROR + retry, never the false "No Grooms Hired" empty', async ({
    page,
  }) => {
    // Inject a transient 500 on the grooms/user READ BEFORE navigation so the
    // Manage tab's useUserGrooms query fails on first load. The body carries a
    // server-style message that MUST NOT reach the UI (§3 — userMessageFor maps
    // it to safe copy).
    let served500 = false;
    await page.route(GROOMS_USER_GLOB, async (route) => {
      served500 = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal grooms failure (leak-check)' }),
      });
    });

    await page.goto('/grooms', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Groom Quarters').first()).toBeVisible({ timeout: 20_000 });

    // The Manage tab is the default; the failed read must surface the ErrorCard
    // (role="alert") with the section title and a wired "Try Again" button.
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/couldn't load your grooms/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    // The false empty must NOT appear on a failed fetch …
    await expect(page.getByText(/no grooms hired/i)).toHaveCount(0);
    // … and the raw server body text must never be rendered (§3).
    await expect(page.getByText(/internal grooms failure/i)).toHaveCount(0);
    expect(served500, 'the grooms/user read must have been intercepted with a 500').toBe(true);

    // Retry recovers: drop the fault so the retry refetch hits the real backend
    // and the dashboard resolves (grid for an owner, or the honest empty for a
    // zero-groom user) — either way the error state is gone.
    await page.unroute(GROOMS_USER_GLOB);
    await page.getByRole('button', { name: /try again/i }).click();

    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/couldn't load your grooms/i)).toHaveCount(0);
  });
});
