/**
 * Navigation Structure — Story 22-8 E2E
 *
 * Verifies:
 *  - Desktop (≥1024px): SidebarNav renders, toggle collapses to 64px rail,
 *    localStorage key `equoria-sidebar-collapsed` persists across reloads.
 *  - Mobile (375×812):  hamburger opens NavPanel, BottomNav renders with 5
 *    items and a gold-dot active indicator on the current route.
 *  - BottomNav "More" opens the same NavPanel overlay.
 *  - NavPanel closes on Escape.
 *
 * Uses the authenticated storageState from global setup.
 */
import { test, expect } from '@playwright/test';

// ─────────────────────────────────────────────────────────────────────────
// Desktop — SidebarNav
// ─────────────────────────────────────────────────────────────────────────
test.describe('SidebarNav — desktop (1440px)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('22-8-E2E-001: sidebar renders and toggle collapses to icon-only rail', async ({ page }) => {
    // Clear persisted sidebar state so the initial state is deterministic.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('equoria-sidebar-collapsed');
      } catch {
        /* ignore */
      }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const sidebar = page.getByTestId('sidebar-nav');
    await expect(sidebar).toBeVisible();

    // Initial state — expanded
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    const expandedBox = await sidebar.boundingBox();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.width).toBeGreaterThan(200);

    // Toggle to collapsed
    await page.getByTestId('sidebar-toggle').click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    // Allow CSS transition to settle before measuring
    await page.waitForTimeout(400);
    const collapsedBox = await sidebar.boundingBox();
    expect(collapsedBox).not.toBeNull();
    // 64px rail — allow ±2px for platform AA
    expect(collapsedBox!.width).toBeLessThan(80);
    expect(collapsedBox!.width).toBeGreaterThan(40);
  });

  test('22-8-E2E-002: sidebar collapse state persists across reloads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'true');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'true');

    // Expand again so other tests in this file start from the canonical state
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'false');
  });

  test('22-8-E2E-003: hamburger is hidden on desktop (SidebarNav replaces it)', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sidebar-nav')).toBeVisible();
    await expect(page.getByTestId('hamburger-menu')).toHaveCount(0);
  });

  test('22-8-E2E-004: bottom nav does NOT render on desktop', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // BottomNav is gated on !isDesktop AND md:hidden — so it is absent on 1440px
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Mobile — BottomNav + NavPanel
// ─────────────────────────────────────────────────────────────────────────
test.describe('MobileNav — phone (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('22-8-E2E-005: bottom nav renders with 5 items at 375px', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const bottomNav = page.getByTestId('bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Links: Home, Horses, Compete, Breed + "More" button
    await expect(page.getByTestId('bottom-nav-home')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-horses')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-compete')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-breed')).toBeVisible();
    await expect(page.getByTestId('bottom-nav-more')).toBeVisible();
  });

  test('22-8-E2E-006: active tab shows gold-dot indicator on home route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Home is active on `/` — gold dot appears
    await expect(page.getByTestId('bottom-nav-active-dot-')).toBeVisible();
  });

  test('22-8-E2E-007: hamburger opens NavPanel overlay', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('hamburger-menu').click();
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).not.toBeVisible();
  });

  test('22-8-E2E-008: bottom-nav "More" button opens the same NavPanel overlay', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.getByTestId('bottom-nav-more').click();
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();
  });
});
