/**
 * Automated Accessibility Suite — Equoria-yhg0g (UX spec 13.4 Testing Strategy)
 *
 * Runs @axe-core/playwright against the highest-value beta surfaces using
 * REAL login + REAL backend. There are NO bypass headers, NO test-user
 * impersonation headers, NO route interception — this conforms to the
 * CLAUDE.md testing philosophy and the 21R beta-readiness doctrine
 * (no test.skip on beta surfaces).
 *
 * Auth model
 * ----------
 * tests/e2e/global-setup.ts registers a real user through the real UI and
 * persists genuine auth cookies to storageState.json (the Playwright project
 * default `use.storageState`). The authenticated surfaces below therefore
 * exercise the production auth path with real session cookies.
 *
 * Unauthenticated surfaces (/login, /register) explicitly clear storageState
 * so axe runs against the real public pages.
 *
 * Threshold (documented per OPTIMAL_FIX_DISCIPLINE.md §6)
 * ------------------------------------------------------
 * The suite FAILS on axe `critical` and `serious` impact violations only.
 * `moderate` and `minor` violations are REPORTED (attached + logged) but do
 * NOT fail the build *for now*. Rationale: this is a brand-new gate over an
 * existing codebase. Starting at critical+serious makes the gate immediately
 * adoptable and meaningful (it catches the WCAG-impactful regressions —
 * missing labels, contrast failures, broken ARIA, focus traps) without
 * drowning the signal in dozens of pre-existing minor/moderate findings that
 * would force a "make it green" weakening. The moderate/minor findings are
 * still surfaced on every run so the a11y debt is visible and tightenable
 * later (raise the threshold once the moderate backlog is filed + burned
 * down). This is a deliberate, documented posture decision — NOT a skip and
 * NOT a silenced assertion: a regression that introduces a critical/serious
 * violation on any covered page genuinely fails this suite.
 *
 * CI wiring
 * ---------
 * This file is registered under its own Playwright project, `a11y`
 * (see playwright.config.ts). It runs on a single browser (chromium) and
 * can be invoked independently:  `npx playwright test --project=a11y`.
 * It is a real, runnable suite — not skipped.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readTestCredentials } from './helpers/credentials';

// WCAG tags scanned. 2.1 AA is the project's documented target (gold tokens
// are WCAG-AA-documented per the issue description).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const FAIL_IMPACTS = new Set(['critical', 'serious']);

type AxeViolation = {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

/**
 * Run axe on the current page, attach the full report, log a concise
 * breakdown, and assert zero critical/serious violations. moderate/minor
 * are reported but not failed (see threshold doc above).
 */
async function assertNoCriticalA11yViolations(page: Page, surfaceName: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

  const violations = results.violations as AxeViolation[];

  // Always attach the raw axe report for the surface (visible in HTML report)
  await test.info().attach(`axe-${surfaceName}.json`, {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  });

  const byImpact = (impact: string) => violations.filter((v) => (v.impact ?? 'unknown') === impact);

  const critical = byImpact('critical');
  const serious = byImpact('serious');
  const moderate = byImpact('moderate');
  const minor = byImpact('minor');

  // Surface ALL findings in the test log so a11y debt stays visible.

  console.log(
    `[a11y:${surfaceName}] critical=${critical.length} serious=${serious.length} ` +
      `moderate=${moderate.length} minor=${minor.length}`
  );
  for (const v of violations) {
    console.log(
      `  [${v.impact ?? 'unknown'}] ${v.id}: ${v.help} ` +
        `(${v.nodes.length} node(s)) ${v.helpUrl}`
    );
  }

  const blocking = violations.filter((v) => FAIL_IMPACTS.has((v.impact ?? '') as string));

  const blockingSummary = blocking
    .map(
      (v) =>
        `\n  • [${v.impact}] ${v.id} — ${v.help}\n` +
        `    ${v.helpUrl}\n` +
        v.nodes
          .slice(0, 5)
          .map((n) => `    target: ${n.target.join(' ')}`)
          .join('\n')
    )
    .join('');

  expect(
    blocking,
    `[${surfaceName}] axe found ${blocking.length} critical/serious ` +
      `accessibility violation(s):${blockingSummary}`
  ).toEqual([]);
}

async function loginWithRealCredentials(page: Page) {
  const { email, password } = readTestCredentials();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Welcome Back', { timeout: 15000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/', { timeout: 20000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated surfaces — clear storageState so axe sees the real public UI
// ─────────────────────────────────────────────────────────────────────────────
test.describe('a11y — public surfaces (real backend, no auth)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Welcome Back', { timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'login');
  });

  test('register page has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Join the Realm', { timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'register');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated surfaces — real login each test (fresh session; the suite may
// take long enough that the 15-min storageState cookie expires).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('a11y — authenticated beta surfaces (real login, real DB)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Home hub (/) has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await loginWithRealCredentials(page);
    // Already on / after login; ensure primary content rendered
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'home-hub');
  });

  test('World Hub (/world) has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await loginWithRealCredentials(page);
    await page.goto('/world', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('world-hub-page')).toBeVisible({ timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'world-hub');
  });

  test('Horse list (/stable) has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await loginWithRealCredentials(page);
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Stable', { timeout: 15000 });
    // Wait for at least one real horse card (global-setup created a horse)
    await expect(page.locator('[data-testid="horse-card"]').first()).toBeVisible({
      timeout: 15000,
    });
    await assertNoCriticalA11yViolations(page, 'stable-horse-list');
  });

  test('Horse detail (/horses/:id) has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await loginWithRealCredentials(page);
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Stable', { timeout: 15000 });
    const firstCard = page.locator('[data-testid="horse-card"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 15000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/horses\/\d+/, { timeout: 10000 });
    await expect(page.getByTestId('horse-detail-overview')).toBeVisible({ timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'horse-detail');
  });

  test('Training page (/training) has no critical/serious axe violations', async ({ page }) => {
    test.setTimeout(60000);
    await loginWithRealCredentials(page);
    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('training-page')).toBeVisible({ timeout: 15000 });
    await assertNoCriticalA11yViolations(page, 'training');
  });
});
