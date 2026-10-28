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

    // Equoria-iiiz: SidebarNav rendering depends on useMediaQuery firing
    // after React hydration (initial SSR-safe state is `false`). Default
    // 5s timeout was unreliable in CI under Redis-reconnect contention.
    // 15s matches the timeout pattern used by the celestial-night specs.
    const sidebar = page.getByTestId('sidebar-nav');
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // Initial state — expanded
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false', { timeout: 5000 });
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
    // Equoria-iiiz: wait for sidebar to actually mount before clicking toggle.
    await expect(page.getByTestId('sidebar-nav')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'true');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sidebar-nav')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'true');

    // Expand again so other tests in this file start from the canonical state
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('sidebar-nav')).toHaveAttribute('data-collapsed', 'false');
  });

  test('22-8-E2E-003: hamburger is hidden on desktop (SidebarNav replaces it)', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('sidebar-nav')).toBeVisible({ timeout: 15000 });
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

    // Equoria-iiiz: wait long enough for React hydration + media-query effect.
    const bottomNav = page.getByTestId('bottom-nav');
    await expect(bottomNav).toBeVisible({ timeout: 15000 });

    // Owner ruling q267 (2026-10-28): the five realms, matching the menu. Old
    // contract: Home, Horses, Compete, Breed links and a More button.
    for (const realm of ['home', 'world', 'community', 'marketplace', 'compete']) {
      await expect(page.getByTestId(`bottom-nav-${realm}`)).toBeVisible();
    }
  });

  test('22-8-E2E-006: active tab shows gold-dot indicator on home route', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for bottom nav to mount before checking the active-dot child.
    await expect(page.getByTestId('bottom-nav')).toBeVisible({ timeout: 15000 });

    // Home is the realm the player is in on `/` (q267: the dot is per realm).
    await expect(page.getByTestId('bottom-nav-active-dot-home')).toBeVisible({ timeout: 5000 });
  });

  test('22-8-E2E-007: hamburger opens NavPanel overlay', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for the mobile MainNavigation to render its hamburger before clicking.
    const hamburger = page.getByTestId('hamburger-menu');
    await expect(hamburger).toBeVisible({ timeout: 15000 });
    await hamburger.click();
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).not.toBeVisible();
  });

  // Owner ruling q267: a bottom-bar realm opens its own list. Old contract: a
  // "More" button opened the whole menu.
  test('22-8-E2E-008: a bottom-bar realm opens its own list', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const world = page.getByTestId('bottom-nav-world');
    await expect(world).toBeVisible({ timeout: 15000 });
    await world.click();
    const list = page.getByRole('dialog', { name: 'World' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('link', { name: 'Vet Clinic', exact: true })).toBeVisible();
  });
});
