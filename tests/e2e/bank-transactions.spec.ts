/**
 * Bank transaction history — four-state E2E (Equoria-4hra5)
 *
 * Regression guard for the "swallow-fetch-error-as-false-empty" defect: on a
 * FAILED transaction fetch the ledger rendered the EMPTY state ("No transactions
 * yet") — a lie on a financial surface — because `isError` was unhandled and the
 * empty branch was gated on `!isLoading` instead of `isSuccess`. Per
 * FRONTEND_ASYNC_STATE_DOCTRINE §1 the four canonical states are
 * LOADING → ERROR (visible + retry) → EMPTY (only via success) → SUCCESS.
 *
 * REAL backend, REAL DB, REAL auth via storageState (tests/e2e/global-setup.ts).
 * NO route interception, NO bypass headers, NO test.skip. The error condition is
 * induced by a genuinely-unreachable network (`context.setOffline(true)`) — the
 * transactions GET fails against a real offline transport, not a stubbed 500.
 *
 * Timing note (bd Equoria-4hra5 caveat): the app's global QueryClient
 * (frontend/src/App.tsx `new QueryClient()`) uses the React Query default of 3
 * retries with exponential backoff, so the error state surfaces only AFTER the
 * offline query exhausts its retries (~7s). Assertions allow generous timeouts.
 * Auth-expiry is NOT a deterministic error trigger (the api-client auto-retries
 * 401 with a token refresh) — offline is, which is why this spec uses it.
 *
 * Sentinel-positive: on the pre-fix tree the error case renders "No transactions
 * yet" (the false empty), so this spec FAILS RED before the fix and PASSES after.
 */
import { test, expect } from '@playwright/test';

test.describe('Bank transaction history — four-state (Equoria-4hra5)', () => {
  test.beforeEach(() => {
    // Offline retry/backoff (~7s) + navigation headroom.
    test.setTimeout(60000);
  });

  test('a failed transaction fetch renders an error + retry, never a false empty', async ({
    page,
    context,
  }) => {
    // 1. Land on a DIFFERENT page first (loaded online) so the SPA document and
    //    the cached profile (which feeds the balance) are already in memory.
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'Bank' }).first()).toBeVisible({ timeout: 20000 });

    // 2. Go offline, then CLIENT-SIDE navigate to /bank (SPA nav — no document
    //    fetch). The transactions GET fails against a genuinely unreachable
    //    network; there is no route interception involved.
    await context.setOffline(true);
    await page.getByRole('link', { name: 'Bank' }).first().click();

    // 3. The transaction section must render the ERROR state with a retry
    //    affordance — NOT the honest empty. ErrorCard carries role="alert".
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 30000 });
    await expect(alert.getByRole('button', { name: /try again/i })).toBeVisible();

    // 4. The false empty must NOT be on the page during the error.
    await expect(page.getByText('No transactions yet')).toHaveCount(0);

    // 5. Restore the network and click Retry — refetch must re-run and the
    //    section must resolve to a success-derived state (rows OR honest empty),
    //    with the error cleared. This proves `refetch` is WIRED to the retry.
    const transactionsOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/transactions') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 30000 }
    );
    await context.setOffline(false);
    await page.getByRole('button', { name: /try again/i }).click();
    await transactionsOk;

    // Error gone; a success state is shown (either real rows or the honest
    // empty — whichever the real ledger holds).
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 15000 });
    const rows = page.locator('[data-testid^="transaction-"]');
    const emptyState = page.getByText('No transactions yet');
    await expect
      .poll(async () => (await rows.count()) > 0 || (await emptyState.count()) > 0, {
        timeout: 15000,
        message: 'Expected transaction rows OR the honest empty state after a successful retry',
      })
      .toBe(true);
  });

  test('a successful transaction fetch renders a non-error state (rows or honest empty)', async ({
    page,
  }) => {
    // Positive control: the fix must not break the happy path. Online load →
    // real transactions GET 200 → the section renders a success-derived state
    // (rows OR the honest empty) and NEVER an error.
    const transactionsOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/transactions') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 20000 }
    );

    await page.goto('/bank', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'The Vault' })).toBeVisible({ timeout: 20000 });
    await transactionsOk;

    // No error surfaced on a successful fetch.
    await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 10000 });

    // Exactly one of the two honest success states is shown.
    const rows = page.locator('[data-testid^="transaction-"]');
    const emptyState = page.getByText('No transactions yet');
    await expect
      .poll(async () => (await rows.count()) > 0 || (await emptyState.count()) > 0, {
        timeout: 15000,
        message: 'Expected transaction rows OR the honest empty state on a successful fetch',
      })
      .toBe(true);
  });
});
