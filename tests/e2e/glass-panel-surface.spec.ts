/**
 * Glass Panel Surface — Visual Regression Tests (Story 22-4)
 *
 * Verifies that:
 *  1. `.glass-panel`, `.glass-panel-heavy`, `.glass-panel-subtle` all render correctly
 *     when `.celestial` is active.
 *  2. No blur stacking occurs — .glass-panel-subtle must NOT apply backdrop-filter.
 *  3. All three variants appear simultaneously on a single viewport without conflicts.
 *
 * These tests use the authenticated storageState from global setup.
 */
import { test, expect } from '@playwright/test';

test.describe('Glass Panel Surface — Story 22-4', () => {
  /**
   * Verify that .glass-panel-subtle has no backdrop-filter in the computed style.
   * This is the single-blur-layer rule: only one blur per viewport stack.
   */
  test('glass-panel-subtle has no backdrop-filter (single-blur-layer rule)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Inject a test fixture with all three glass panel variants into the DOM
    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'glass-test-fixture';
      fixture.style.cssText = 'position:fixed;top:0;left:0;width:400px;z-index:9999;padding:16px;';
      fixture.innerHTML = `
        <div class="glass-panel"        data-testid="gp-standard">Standard</div>
        <div class="glass-panel-heavy"  data-testid="gp-heavy">Heavy</div>
        <div class="glass-panel-subtle" data-testid="gp-subtle">Subtle</div>
      `;
      document.body.appendChild(fixture);
    });

    // Confirm .celestial is active on body (default from CelestialThemeProvider)
    const hasCelestial = await page.evaluate(() => document.body.classList.contains('celestial'));
    expect(hasCelestial).toBe(true);

    // .glass-panel-subtle must NOT have backdrop-filter (no stacked blur)
    const subtleBlur = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="gp-subtle"]') as HTMLElement;
      if (!el) return null;
      return window.getComputedStyle(el).backdropFilter;
    });
    // "none" or empty string means no blur applied — both are acceptable
    expect(subtleBlur === 'none' || subtleBlur === '').toBe(true);

    // Screenshot with all three variants simultaneously in viewport — satisfies AC.
    // Tightened tolerance: 0.005 (0.5%) catches real regressions while allowing
    // for sub-pixel AA differences across platforms.
    await expect(page).toHaveScreenshot('glass-panels-all-variants.png', {
      maxDiffPixelRatio: 0.005,
    });
  });

  /**
   * Verify .glass-panel applies blur (has backdrop-filter set to non-none).
   */
  test('glass-panel applies backdrop-filter blur', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.id = 'glass-test-fixture-2';
      fixture.style.cssText = 'position:fixed;top:0;left:0;width:400px;z-index:9999;';
      fixture.innerHTML = `
        <div class="glass-panel" data-testid="gp-standard-2">Standard panel</div>
      `;
      document.body.appendChild(fixture);
    });

    const blur = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="gp-standard-2"]') as HTMLElement;
      if (!el) return null;
      return window.getComputedStyle(el).backdropFilter;
    });
    // Should contain "blur(" indicating backdrop-filter is active
    expect(blur).toMatch(/blur\(/);
  });

  /**
   * Screenshot test — all three variants visible simultaneously.
   * Covers: login page at 1440px (glass panel centered over PageBackground).
   */
  test('login page at 1440px — glass panel over background (screenshot)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Go to login (unauthenticated) — uses scene="auth" PageBackground + centered glass panel
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Wait for content to render
    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot('login-glass-panel-1440.png', {
      maxDiffPixelRatio: 0.02,
    });
  });

  /**
   * Screenshot test — mobile viewport (375px).
   */
  test('login page at 375px — glass panel responsive (screenshot)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot('login-glass-panel-375.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
