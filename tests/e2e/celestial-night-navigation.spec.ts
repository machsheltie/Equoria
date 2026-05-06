/**
 * Celestial Night Navigation — E2E Tests
 *
 * Tests the Celestial Night UI shell, navigation structure, and World Hub:
 *  - Home page loads with "My Stable" heading
 *  - Navigation menu (via hamburger) shows all main sections
 *  - World Hub loads with location cards
 *  - Location card navigation works
 *  - Protected routes redirect unauthenticated users to /login
 */
import { test, expect } from '@playwright/test';
import { openNavPanel } from './helpers/nav';

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated Navigation Tests (uses storageState from global setup)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Celestial Night Navigation — Authenticated', () => {
  test('home page loads and shows My Stable heading', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Index.tsx renders h1 "My Stable"
    await expect(page.locator('h1')).toContainText('My Stable', { timeout: 15000 });
  });

  test('navigation menu shows core sections via hamburger', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for page to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 15000 });

    // Equoria-d7k6: viewport-aware nav open. Desktop returns the always-
    // visible SidebarNav directly; mobile clicks the hamburger to open the
    // NavPanel overlay. Either way the returned Locator scopes the link
    // queries below. (Link list itself is tracked by Equoria-d5q1 — 'Stable'
    // vs 'My Stable' and Training-not-in-nav drift remain that issue's scope.)
    const navContainer = await openNavPanel(page);

    // NavPanel opens — check for core section links present in the actual
    // sidebar (frontend/src/components/layout/navItems.ts NAV_SECTIONS).
    // Equoria-d5q1: prior list included 'Stable' (actual label is 'My Stable')
    // and 'Training' (not a top-level nav item — Training Grounds is reached
    // via /world per Epic 13 product design). Updated to match current nav.
    // exact: true forces accessible-name equality, preventing 'Stable' from
    // incidentally substring-matching 'My Stable'.
    const expectedNavLinks = ['Home', 'My Stable', 'Competitions', 'Breeding', 'World'];

    for (const linkName of expectedNavLinks) {
      const link = navContainer.getByRole('link', { name: linkName, exact: true }).first();
      await expect(link).toBeVisible({ timeout: 10000 });
    }
  });

  test('World Hub loads with location cards', async ({ page }) => {
    await page.goto('/world', { waitUntil: 'domcontentloaded' });

    // World Hub has data-testid="world-hub-page"
    await expect(page.locator('[data-testid="world-hub-page"]')).toBeVisible({
      timeout: 15000,
    });

    // Page heading
    await expect(page.locator('h1')).toContainText('The World', { timeout: 10000 });

    // Should show multiple location cards (at least 5 of the 9 locations)
    const locationLinks = page.locator('[data-testid="world-hub-page"] a');
    const count = await locationLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('clicking a World Hub location card navigates to sub-page', async ({ page }) => {
    await page.goto('/world', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="world-hub-page"]')).toBeVisible({
      timeout: 15000,
    });

    // Click the "Vet Clinic" location link — the first location card
    const vetLink = page.getByRole('link', { name: /Vet Clinic/i }).first();
    if (await vetLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await vetLink.click();
      await expect(page).toHaveURL(/\/vet/, { timeout: 10000 });
    } else {
      // If specific link not found, click first location link
      const firstLink = page.locator('[data-testid="world-hub-page"] a').first();
      await firstLink.click();
      // Should navigate away from /world
      await page.waitForURL((url) => !url.pathname.endsWith('/world'), { timeout: 10000 });
      expect(page.url()).not.toMatch(/\/world$/);
    }
  });

  test('home page shows horse mini-cards or getting started state', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('My Stable', { timeout: 15000 });

    // Index page shows either horse cards (for users with horses) or a getting-started message
    const hasHorseLinks = await page.locator('a[aria-label*="View"]').count();
    const hasGettingStarted = await page.getByText(/adventure begins|Your Horses/i).count();

    expect(hasHorseLinks + hasGettingStarted).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated — Protected Route Redirect
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Celestial Night Navigation — Unauthenticated', () => {
  // Fresh session with no auth cookies
  test.use({ storageState: { cookies: [], origins: [] } });

  test('protected route /stable redirects to /login', async ({ page }) => {
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });

    // ProtectedRoute redirects unauthenticated users to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('protected route /world redirects to /login', async ({ page }) => {
    await page.goto('/world', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('protected route /training redirects to /login', async ({ page }) => {
    await page.goto('/training', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
