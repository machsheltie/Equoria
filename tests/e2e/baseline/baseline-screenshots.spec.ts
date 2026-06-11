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
import { fileURLToPath } from 'node:url';
import { staticRoutes, dynamicEntityRoutes, viewports } from './routeManifest';

// ESM scope — no __dirname (repo is "type": "module")
const here = path.dirname(fileURLToPath(import.meta.url));
const RUN_DATE = process.env.BASELINE_DATE ?? new Date().toISOString().slice(0, 10);
const OUT_DIR = path.resolve(here, '__screenshots__', RUN_DATE);

test.beforeAll(() => {
  mkdirSync(OUT_DIR, { recursive: true });
});

/**
 * Complete the E2E user's onboarding via API if global-setup left it
 * incomplete (known defect: the onboarding UI's advance-onboarding call
 * 403s on a stale anonymous CSRF token — see the bd issue filed from this
 * spec's first runs). OnboardingGuard otherwise redirects EVERY
 * authenticated route to /onboarding, which would silently corrupt the
 * whole baseline. Fails loudly if completion can't be achieved.
 */
async function ensureOnboardingComplete(page: Page): Promise<void> {
  const csrfRes = await page.request.get('/api/v1/auth/csrf-token');
  const csrfJson = await csrfRes.json();
  const csrfToken: string = csrfJson?.data?.csrfToken ?? csrfJson?.csrfToken ?? '';
  expect(csrfToken, 'csrf token for onboarding completion').toBeTruthy();

  for (let i = 0; i < 12; i++) {
    const res = await page.request.post('/api/v1/auth/advance-onboarding', {
      data: {},
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    });
    expect(res.ok(), `advance-onboarding step ${i} → ${res.status()}`).toBeTruthy();
    const j = await res.json();
    if (j?.data?.completed ?? j?.completed) return;
  }
  throw new Error('onboarding did not reach completed=true within 12 steps');
}

let onboardingEnsured = false;
test.beforeEach(async ({ page }) => {
  if (onboardingEnsured) return;
  await ensureOnboardingComplete(page);
  onboardingEnsured = true;
});

/** Settle the page: network idle, fonts loaded, images decoded. */
async function settle(page: Page): Promise<void> {
  // Bounded: under DB saturation API responses crawl and networkidle may
  // never fire — the stuck-loading guard below remains the HARD check that
  // we never capture a spinner.
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
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
      // Primary: the starter-horse id global-setup stored in process.env
      // (propagates to workers — see tests/e2e/global-setup.ts step 5).
      // Fallback: navigate via the stable roster. NOTE the roster cards are
      // onClick divs, not anchors (tracked a11y debt: Equoria-o5hub.24/.25),
      // so we click a card and read the URL rather than scraping hrefs.
      let horseId = process.env.E2E_TEST_HORSE_ID ?? null;
      if (!horseId) {
        // API fallback (global-setup's lookup uses the unversioned /api/horses
        // which 404s — bug filed). The starter horse always exists post-register.
        const res = await page.request.get('/api/v1/horses');
        expect(res.ok(), `GET /api/v1/horses → ${res.status()}`).toBeTruthy();
        const j = await res.json();
        const horses = j?.data?.horses ?? j?.data ?? j?.horses ?? [];
        const first = Array.isArray(horses) ? horses[0] : null;
        horseId = first?.id != null ? String(first.id) : null;
      }
      expect(
        horseId,
        'Baseline requires at least one horse — empty roster means an incomplete baseline, fix the account state'
      ).toBeTruthy();

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
