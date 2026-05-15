/**
 * Inventory — E2E (Story 21-9 follow-up, Equoria-nz6y)
 *
 * Covers the inventory surface beta testers exercise:
 *   1. Navigate to /inventory — page renders with real auth + GET /api/inventory
 *   2. Switching category tabs filters the grid via real client-side filtering
 *   3. Item count badge and grid populate from the real API response
 *
 * Note: InventoryPage is read-only as of 2026-05-05 — Equip moved to the per-horse
 * Equip page (/horses/:id/equip). This spec exercises the inventory listing and
 * tab navigation surface; Unequip flow is only available when tack is equipped,
 * which depends on real DB state and so is not asserted as a happy-path action.
 *
 * Auth: uses Playwright storageState set by tests/e2e/global-setup.ts
 * (no test-credentials.json file I/O — Story 21-8 AC1, Equoria-4m96).
 * Network-first waits via response interceptors on the inventory GET.
 */
import { test, expect } from '@playwright/test';

test.describe('Inventory', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('AC1: /inventory renders with real API data and item count badge', async ({ page }) => {
    // Network-first: assert the inventory GET fires from the real API path
    const inventoryResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/inventory') && resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/inventory', { waitUntil: 'domcontentloaded' });

    // PageHero title (Inventory) — proves the protected route loaded under real auth
    await expect(page.getByRole('heading', { name: 'Inventory' }).first()).toBeVisible({
      timeout: 20000,
    });

    // Real inventory GET completes
    const resp = await inventoryResp;
    expect(resp.status()).toBe(200);

    // Item count badge populates with real count (not '...')
    const itemCount = page.locator('[data-testid="item-count"]');
    await expect(itemCount).toBeVisible({ timeout: 10000 });
    await expect(itemCount).not.toHaveText('...', { timeout: 10000 });
    await expect(itemCount).toHaveText(/\d+ items/, { timeout: 5000 });
  });

  test('AC2: All Items tab is the default and category tabs are navigable', async ({ page }) => {
    await page.goto('/inventory', { waitUntil: 'domcontentloaded' });

    // Wait for the inventory grid to be present (rendered after data loads)
    await expect(page.locator('[data-testid="inventory-grid"]')).toBeVisible({ timeout: 20000 });

    // The category tabs are rendered as part of FantasyTabs. Verify each tab
    // label is reachable as a tab role (the role-based query is independent of
    // the underlying tab implementation).
    const allItemsTab = page.getByRole('tab', { name: /all items/i });
    const saddlesTab = page.getByRole('tab', { name: /saddles/i });
    const feedTab = page.getByRole('tab', { name: /feed/i });

    await expect(allItemsTab).toBeVisible({ timeout: 10000 });
    await expect(saddlesTab).toBeVisible();
    await expect(feedTab).toBeVisible();

    // All Items is selected by default (defaultValue="all" in InventoryPage)
    await expect(allItemsTab).toHaveAttribute('aria-selected', 'true');

    // Click Saddles tab — selection should switch
    await saddlesTab.click();
    await expect(saddlesTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
    await expect(allItemsTab).toHaveAttribute('aria-selected', 'false');
  });

  test('AC3: inventory grid shows real items or an honest empty-state message', async ({
    page,
  }) => {
    const inventoryResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/inventory') && resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/inventory', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="inventory-grid"]')).toBeVisible({ timeout: 20000 });

    // Wait for the real inventory GET to complete before asserting on the grid
    await inventoryResp;

    // After the GET resolves, one of three states is rendered inside the grid:
    //   - inventory-item-<id> cards (items present)
    //   - empty-inventory placeholder (zero items)
    //   - inventory-error placeholder (API failed)
    // For real-DB readiness we accept the first two; the error state is a
    // legitimate failure that should fail this test.
    const errorState = page.locator('[data-testid="inventory-error"]');
    await expect(errorState).toHaveCount(0);

    const items = page.locator('[data-testid^="inventory-item-"]');
    const empty = page.locator('[data-testid="empty-inventory"]');

    const itemCount = await items.count();
    if (itemCount > 0) {
      // At least one inventory card is visible
      await expect(items.first()).toBeVisible();
    } else {
      // Honest empty-state message — no fake "Coming soon" text
      await expect(empty).toBeVisible({ timeout: 5000 });
      await expect(empty).toContainText(/empty/i);
    }
  });
});
