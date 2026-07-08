/**
 * Prize history — four-state E2E (Equoria-x6l44)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect on the
 * Prize History page (sibling of the BankPage case, Equoria-4hra5). The page
 * drives BOTH the stat cards and the transaction list off a single
 * usePrizeHistory query. On a FAILED fetch it still passed `transactions ?? []`
 * to PrizeTransactionHistory — a presentational component with no error concept
 * — so the list rendered its "No transactions yet" empty (a lie on a failed
 * fetch) alongside fabricated "0" stat cards. Per FRONTEND_ASYNC_STATE_DOCTRINE
 * §1/§4 the four canonical states are LOADING → ERROR (visible + retry) → EMPTY
 * (only via success) → SUCCESS, and a query's failure must not falsify a
 * section.
 *
 * REAL backend, REAL DB, REAL auth via storageState (tests/e2e/global-setup.ts).
 * NO route interception, NO bypass headers, NO test.skip. The error condition is
 * induced by a genuinely-unreachable network (`context.setOffline(true)`): the
 * prize-history GET fails against a real offline transport, not a stubbed 500.
 * The failure is triggered by a real user action — changing the date-range
 * filter re-queries the boundary (new query key) while offline.
 *
 * Timing note (mirrors the Equoria-4hra5 caveat): the app's global QueryClient
 * (frontend/src/App.tsx `new QueryClient()`) uses the React Query default of 3
 * retries with exponential backoff, so the error state surfaces only AFTER the
 * offline query exhausts its retries (~7s). Assertions allow generous timeouts.
 *
 * Sentinel-positive: on the pre-fix tree the error case renders "No transactions
 * yet" (the false empty), so this spec FAILS RED before the fix and PASSES after.
 */
import { test, expect } from '@playwright/test';

test.describe('Prize history — four-state (Equoria-x6l44)', () => {
  test.beforeEach(() => {
    // Offline retry/backoff (~7s) + navigation headroom.
    test.setTimeout(60000);
  });

  test('a failed prize-history (re)fetch renders an error + retry, never a false empty', async ({
    page,
    context,
  }) => {
    // 1. Load /prizes ONLINE so the initial prize-history GET succeeds and the
    //    real PrizeTransactionHistory (with its date-range filter) is mounted.
    const firstLoadOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/prize-history') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 30000 }
    );
    await page.goto('/prizes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /prize history/i, level: 1 })).toBeVisible({
      timeout: 20000,
    });
    await firstLoadOk;

    // The date-range filter is present on the successful load.
    const dateRange = page.getByTestId('filter-date-range');
    await expect(dateRange).toBeVisible({ timeout: 15000 });

    // 2. Go offline, then change the date-range filter. That re-queries the
    //    prize-history boundary under a new query key, which fails against the
    //    genuinely-unreachable network (no route interception involved).
    await context.setOffline(true);
    await dateRange.selectOption('30days');

    // 3. The page must render the ERROR state with a retry affordance — NOT the
    //    honest empty and NOT fabricated stat cards. ErrorCard carries
    //    role="alert".
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(alert.getByRole('button', { name: /try again/i })).toBeVisible();

    // 4. The false empty must NOT be on the page during the error, and the raw
    //    stat cards must be gone (no fabricated zeros).
    await expect(page.getByText('No transactions yet')).toHaveCount(0);
    await expect(page.getByTestId('stat-total-prize-money')).toHaveCount(0);

    // 5. Restore the network and click Retry — refetch must re-run and the
    //    section must resolve to a success-derived state (rows OR honest empty),
    //    with the error cleared. This proves `refetch` is WIRED to the retry.
    const retryOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/prize-history') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 30000 }
    );
    await context.setOffline(false);
    await page.getByRole('button', { name: /try again/i }).click();
    await retryOk;

    // Error gone; a success state is shown (either real rows or the honest
    // empty — whichever the real ledger holds), and the stat cards return.
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId('prize-transaction-history')).toBeVisible({ timeout: 15000 });
  });

  test('a successful prize-history fetch renders a non-error state (rows or honest empty)', async ({
    page,
  }) => {
    // Positive control: the fix must not break the happy path. Online load →
    // real prize-history GET 200 → the section renders a success-derived state
    // (rows OR the honest empty) and NEVER an error, and the stat cards render.
    const historyOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/prize-history') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 20000 }
    );

    await page.goto('/prizes', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /prize history/i, level: 1 })).toBeVisible({
      timeout: 20000,
    });
    await historyOk;

    // No error surfaced on a successful fetch.
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 10000 });

    // The stat cards and the history region render on success.
    await expect(page.getByTestId('stat-total-prize-money')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('prize-transaction-history')).toBeVisible({ timeout: 15000 });
  });
});
