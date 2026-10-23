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
    // Equoria-0isqi, owner decision 24 (2026-10-19): the Vault follows the
    // prize-history rule — an offline ledger fetch ends in the error card with
    // Try Again. Old trigger: go offline on /stable, then open /bank. That could
    // never reach the ledger: BankPage is a lazily loaded route chunk, so with
    // the network already down the chunk itself failed and the app-level
    // ErrorBoundary replaced the route. New trigger, a real player path: she
    // opens the Vault online (route chunk loaded, ledger fetched), leaves it,
    // comes back after the cached ledger has been discarded (React Query's
    // 5-minute gcTime) while her connection is down. The browser clock is
    // installed so those minutes pass deterministically (owner ruling
    // 2026-10-23: flaky/slow paths may use fake timers, never weaker asserts).
    await page.clock.install();

    // 1. Open the Vault ONLINE through the real navigation, so the route chunk
    //    is loaded and the ledger has been fetched once.
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    const bankLink = page.getByRole('link', { name: 'Bank' }).first();
    await expect(bankLink).toBeVisible({ timeout: 20000 });
    const firstLedgerOk = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/transactions') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 30000 }
    );
    await bankLink.click();
    await expect(
      page.getByRole('heading', { name: 'The Vault', exact: true, level: 1 })
    ).toBeVisible({ timeout: 20000 });
    await firstLedgerOk;

    // 2. Leave the Vault (browser Back, same document), let more than the
    //    5-minute cache lifetime pass, lose the network, and come back
    //    (browser Forward). The ledger query is cold, so the Vault must fetch
    //    it — against a genuinely unreachable network, no route interception.
    await page.goBack();
    await expect(page).toHaveURL(/\/stable$/);
    await page.clock.fastForward('06:00');
    await context.setOffline(true);
    await page.goForward();
    await expect(page).toHaveURL(/\/bank$/);
    await expect(
      page.getByRole('heading', { name: 'The Vault', exact: true, level: 1 })
    ).toBeVisible({ timeout: 20000 });

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
    // Equoria-c2erw: `{ name: 'The Vault' }` is substring matching, and the
    // design-system migration added an "About the Vault" info panel (h3) to
    // BankPage.tsx, so the bare locator became a strict-mode violation
    // (2 headings). Pinned to the page's own h1 via exact + level, which is
    // what this line always meant: the Vault page itself has rendered.
    await expect(
      page.getByRole('heading', { name: 'The Vault', exact: true, level: 1 })
    ).toBeVisible({ timeout: 20000 });
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
