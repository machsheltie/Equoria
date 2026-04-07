/**
 * Story 22-7: Body & Page Chrome — Failing Acceptance Tests (ATDD)
 *
 * These tests are intentionally written BEFORE implementation to drive
 * development. They will fail until Story 22-7 tasks are complete.
 *
 * Covers:
 *  - AC1: Body has deep navy gradient + radial accent layers (CSS class check)
 *  - AC3: NavPanel active item has left-border gold indicator
 *  - AC4/AC7: Auth pages show PageBackground (scene="auth") at 375px + 1440px
 *  - AC5: AuthLayout uses token-based colors (no raw hex for logo/footer)
 *
 * All tests run unauthenticated (public pages only). No login flow needed.
 */

import { test, expect } from '@playwright/test';

// ── No auth for public pages ─────────────────────────────────────────────────
test.use({ storageState: { cookies: [], origins: [] } });

// ────────────────────────────────────────────────────────────────────────────
// AC7: Login page at 375px — PageBackground present, glass panel centered
// ────────────────────────────────────────────────────────────────────────────
test.describe('Login page chrome — 375px mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('22-7-E2E-001: PageBackground marker is attached', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // PageBackground renders <div data-testid="page-background" data-bg="..."> (hidden marker)
    await expect(page.locator('[data-testid="page-background"]')).toBeAttached();
  });

  test('22-7-E2E-002: PageBackground resolves auth scene path', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const bg = page.locator('[data-testid="page-background"]');
    await expect(bg).toBeAttached();

    const dataBg = await bg.getAttribute('data-bg');
    // Must resolve to the auth scene directory, not the generic /images/bg-*.webp
    expect(dataBg).toMatch(/\/images\/backgrounds\/auth\/bg-/);
  });

  test('22-7-E2E-003: glass panel is visible and within viewport', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The login card uses the .glass-panel class (glassmorphism card)
    const panel = page.locator('.glass-panel').first();
    await expect(panel).toBeVisible();

    // Panel should be within the 375px viewport (not clipped off screen)
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1); // allow 1px tolerance
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC7: Login page at 1440px — PageBackground present, glass panel centered
// ────────────────────────────────────────────────────────────────────────────
test.describe('Login page chrome — 1440px desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('22-7-E2E-004: PageBackground marker is attached at wide viewport', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="page-background"]')).toBeAttached();
  });

  test('22-7-E2E-005: PageBackground resolves auth scene path at wide viewport', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const dataBg = await page.locator('[data-testid="page-background"]').getAttribute('data-bg');
    expect(dataBg).toMatch(/\/images\/backgrounds\/auth\/bg-/);
  });

  test('22-7-E2E-006: glass panel is visible and horizontally centered at 1440px', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const panel = page.locator('.glass-panel').first();
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).not.toBeNull();

    // Panel should be centered — its midpoint within ±200px of viewport center
    const panelMidX = box!.x + box!.width / 2;
    expect(Math.abs(panelMidX - 720)).toBeLessThan(200);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC1: Body has Celestial Night background (not plain white / no background)
// ────────────────────────────────────────────────────────────────────────────
test.describe('Body background — Celestial Night', () => {
  test('22-7-E2E-007: body background is not white on login page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The body background must be dark (navy), not the default white.
    // We check that the CSS backgroundImage or backgroundColor is applied.
    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });

    // background-color should NOT be pure white: rgb(255, 255, 255)
    expect(bodyBg.backgroundColor).not.toBe('rgb(255, 255, 255)');
    // background-image should include a gradient (linear-gradient or image-set)
    expect(bodyBg.backgroundImage).not.toBe('none');
  });

  test('22-7-E2E-008: body background is not white on register page', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });

    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      const style = window.getComputedStyle(body);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });

    expect(bodyBg.backgroundColor).not.toBe('rgb(255, 255, 255)');
    expect(bodyBg.backgroundImage).not.toBe('none');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC3: NavPanel active item — left gold border indicator
// This test navigates to home (/) as an authenticated user to open the
// NavPanel and assert the active item's border styling.
// Requires auth — re-enable storage state for this describe block only.
// ────────────────────────────────────────────────────────────────────────────
test.describe('NavPanel active item — gold border indicator', () => {
  // Override to use auth for nav tests
  test.use({ storageState: 'storageState.json' });

  test('22-7-E2E-009: active nav item has gold left-border indicator', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Open nav panel via hamburger
    await page.getByTestId('hamburger-menu').click();

    // The nav panel should be open
    await expect(page.getByRole('dialog', { name: 'Navigation menu' })).toBeVisible();

    // Find the Home link (active on '/')
    const homeLink = page.getByRole('dialog', { name: 'Navigation menu' }).getByRole('link', {
      name: /home/i,
    });
    await expect(homeLink).toBeVisible();

    // Active link must have a border-l-2 (2px left border) Tailwind class
    // which renders as border-left-width: 2px
    const borderLeftWidth = await homeLink.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftWidth;
    });
    expect(borderLeftWidth).toBe('2px');

    // The left border color must be the gold token (~rgba(200,168,78) / #c8a84e)
    const borderLeftColor = await homeLink.evaluate((el) => {
      return window.getComputedStyle(el).borderLeftColor;
    });
    // Gold primary is rgb(200, 168, 78) — allow tolerance for token resolution
    expect(borderLeftColor).toMatch(/rgb\(20[0-9], 16[0-9], 7[0-9]\)|rgb\(201, 162, 39\)/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AC5: AuthLayout logo uses Cinzel font (not a fallback serif/sans)
// ────────────────────────────────────────────────────────────────────────────
test.describe('AuthLayout Celestial Night styling', () => {
  test('22-7-E2E-010: login page title uses Cinzel display font', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The "Equoria" logo/title on the login page should use Cinzel
    const title = page.getByRole('heading', { name: /equoria/i }).first();
    await expect(title).toBeVisible();

    const fontFamily = await title.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });
    // Cinzel font family check (case-insensitive)
    expect(fontFamily.toLowerCase()).toContain('cinzel');
  });
});
