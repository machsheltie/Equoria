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

    // Wait for CelestialThemeProvider's useLayoutEffect to apply
    // body.celestial. Without this, the test races against React mount
    // and fails on firefox/webkit before the class is set.
    await expect.poll(
      () => page.evaluate(() => document.body.classList.contains('celestial')),
      { timeout: 10_000 }
    ).toBe(true);

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
  });

  // Screenshot variant of the above — quarantined until a CI-stable
  // baseline is generated and committed (see follow-up issue).
  test.fixme(
    'glass-panel-subtle screenshot — all three variants visible simultaneously',
    async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
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
      await expect(page).toHaveScreenshot('glass-panels-all-variants.png', {
        maxDiffPixelRatio: 0.005,
      });
    }
  );

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
  // Quarantined: no committed snapshot baseline. toHaveScreenshot() on first
  // run generates the baseline and fails until one is committed. Generating
  // CI-stable baselines requires running playwright on the CI runner image
  // (Linux + chromium) and committing the resulting .png. Tracked as a
  // follow-up issue alongside Equoria-nj0y.
  test.fixme('login page at 1440px — glass panel over background (screenshot)', async ({ page }) => {
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
  // Quarantined: same baseline-missing issue as the 1440px screenshot test.
  test.fixme('login page at 375px — glass panel responsive (screenshot)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('form')).toBeVisible({ timeout: 10000 });

    await expect(page).toHaveScreenshot('login-glass-panel-375.png', {
      maxDiffPixelRatio: 0.02,
    });
  });
});
