/**
 * Design-system baseline screenshot capture (Equoria-o5hub.1, handoff §6.1).
 *
 * Captures every routed page family at three viewport classes into
 * tests/e2e/baseline/__screenshots__/<run-date>/ (gitignored artifacts).
 *
 * Reproduce with:
 *   npx playwright test --project=baseline
 *
 * Notes (handoff §6.1 cautions):
 * - Real layout, real backend (NODE_ENV=beta webServer), real login
 *   (storageState from global-setup) — no mocked page shells.
 * - reducedMotion: 'reduce' stabilizes ambient animation (starfield twinkle,
 *   pulses) so diffs are meaningful; the motion policy keeps end states
 *   visible (docs/design-system/MOTION.md).
 * - Waits for network idle + fonts + images before capturing; fails (does not
 *   silently skip) when an entity route can't be resolved because the roster
 *   is empty — an incomplete baseline must look incomplete.
 * - This project is a capture tool, not a CI gate: it lives in its own
 *   Playwright project (`baseline`) excluded from the default browser
 *   projects, mirroring the a11y project pattern.
 */

import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { staticRoutes, dynamicEntityRoutes, viewports } from './routeManifest';

const RUN_DATE = process.env.BASELINE_DATE ?? new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(__dirname, '__screenshots__', RUN_DATE);

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

/** Settle the page: network idle, fonts loaded, images decoded. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Confirm images decoded (handoff: "Confirm that images have loaded")
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
      )
    );
  });
  // Small settle for layout/async paints after idle.
  await page.waitForTimeout(300);
}

/** Assert we are not staring at a global loading spinner (handoff caution). */
async function assertNotStuckLoading(page: Page, slug: string): Promise<void> {
  const spinners = page.locator('[data-testid="page-loading"], [aria-busy="true"]');
  const count = await spinners.count();
  if (count > 0) {
    // One more settle round — slow queries on first hit are common.
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
  }
  expect
    .soft(
      await page.locator('[data-testid="page-loading"]').count(),
      `${slug}: page-level loading spinner still visible at capture time`
    )
    .toBe(0);
}

for (const viewport of viewports) {
  test.describe(`baseline @ ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });

    for (const route of staticRoutes) {
      test(`${route.family}/${route.slug}`, async ({ page, browser }) => {
        // Auth routes must render the UNauthenticated chrome — use a clean context.
        if (!route.auth) {
          const ctx = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            reducedMotion: 'reduce',
            storageState: undefined,
          });
          const cleanPage = await ctx.newPage();
          await cleanPage.goto(route.path);
          await settle(cleanPage);
          await cleanPage.screenshot({
            path: path.join(OUT_DIR, `${route.family}--${route.slug}--${viewport.name}.png`),
            fullPage: true,
          });
          await ctx.close();
          return;
        }

        await page.goto(route.path);
        await settle(page);
        await assertNotStuckLoading(page, route.slug);
        await page.screenshot({
          path: path.join(OUT_DIR, `${route.family}--${route.slug}--${viewport.name}.png`),
          fullPage: true,
        });
      });
    }

    test('stable-entity/dynamic entity routes (horse detail + equip)', async ({ page }) => {
      // Resolve a real horse id from the roster — no hardcoded fixtures.
      await page.goto('/stable');
      await settle(page);
      const firstHorseLink = page.locator('a[href^="/horses/"]').first();
      await expect(
        firstHorseLink,
        'Baseline requires at least one horse in the roster — empty roster means an incomplete baseline, fix the account state'
      ).toBeVisible({ timeout: 15000 });
      const href = await firstHorseLink.getAttribute('href');
      const horseId = href?.match(/\/horses\/(\d+)/)?.[1];
      expect(horseId, `could not parse horse id from ${href}`).toBeTruthy();

      for (const dyn of dynamicEntityRoutes) {
        const target = dyn.template.replace(':id', horseId as string);
        await page.goto(target);
        await settle(page);
        await assertNotStuckLoading(page, dyn.slug);
        await page.screenshot({
          path: path.join(OUT_DIR, `${dyn.family}--${dyn.slug}--${viewport.name}.png`),
          fullPage: true,
        });
      }
    });
  });
}
