/**
 * Riders Manage tab — four-state ERROR path — E2E (Equoria-5urmo)
 *
 * The rider mirror of Equoria-mljz9's groom-manage-error-state.spec.ts.
 * FRONTEND_ASYNC_STATE_DOCTRINE §1/§7: a FAILED riders fetch on the Manage tab
 * (MyRidersDashboard) must render a real ERROR state with a retry affordance —
 * NOT collapse into the honest-looking "No Riders Hired" empty state. Before the
 * 5urmo fix the dashboard had no error branch, so a 500 rendered the false empty.
 *
 * Real-backend, real-auth (storageState from tests/e2e/global-setup.ts),
 * NODE_ENV=beta CSRF — same harness as rider-dismiss.spec.ts. No bypass headers,
 * no test.skip, no mocked primary path. The ONLY test-side control is a transient
 * 500 FAULT INJECTED on the riders/user READ via page.route — the sanctioned way
 * to exercise an error UI against an otherwise-healthy backend (the issue's own
 * Test section: "force riders GET 500"). It is not a bypass header and not a
 * mocked primary path; the intercepted path is versioned
 * (/api/v1/riders/user/:id). Assignments are left to succeed, so the error state
 * is driven purely by the riders read fault.
 *
 * ⚠️ LEAD-RUN NEEDED (fleet-worker note): this spec was authored in an isolated
 * fleet worktree where the frontend dev server + backend + Postgres + E2E
 * storageState could not be started, so it has NOT been executed here. The
 * companion MSW-boundary component test
 * (frontend/src/components/__tests__/MyRidersDashboard.fourstate.test.tsx) IS
 * verified green and exercises the same four-state contract against the real
 * hooks + real api-client. Run this spec in the lead's E2E environment to
 * validate the real-backend path before closure.
 */
import { test, expect } from '@playwright/test';

const RIDERS_USER_GLOB = '**/api/v1/riders/user/**';

test.describe('Riders Manage tab — error state (Equoria-5urmo)', () => {
  test.beforeEach(() => {
    test.setTimeout(90_000);
  });

  test('a failed riders read renders ERROR + retry, never the false "No Riders Hired" empty', async ({
    page,
  }) => {
    // Inject a transient 500 on the riders/user READ BEFORE navigation so the
    // Manage tab's useUserRiders query fails on first load. The body carries a
    // server-style message that MUST NOT reach the UI (§3 — userMessageFor maps
    // it to safe copy).
    let served500 = false;
    await page.route(RIDERS_USER_GLOB, async (route) => {
      served500 = true;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Internal riders failure (leak-check)' }),
      });
    });

    await page.goto('/riders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Rider Hall').first()).toBeVisible({ timeout: 20_000 });

    // The Manage tab is the default; the failed read must surface the ErrorCard
    // (role="alert") with the section title and a wired "Try Again" button.
    const errorAlert = page.getByRole('alert');
    await expect(errorAlert).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/couldn't load your riders/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    // The false empty must NOT appear on a failed fetch …
    await expect(page.getByText(/no riders hired/i)).toHaveCount(0);
    // … and the raw server body text must never be rendered (§3).
    await expect(page.getByText(/internal riders failure/i)).toHaveCount(0);
    expect(served500, 'the riders/user read must have been intercepted with a 500').toBe(true);

    // Retry recovers: drop the fault so the retry refetch hits the real backend
    // and the dashboard resolves (grid for an owner, or the honest empty for a
    // zero-rider user) — either way the error state is gone.
    await page.unroute(RIDERS_USER_GLOB);
    await page.getByRole('button', { name: /try again/i }).click();

    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(/couldn't load your riders/i)).toHaveCount(0);
  });
});
