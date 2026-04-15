/**
 * Story 22-1: Font Migration — E2E Tests
 *
 * Verifies that the self-hosted font migration is live and no regressions have
 * occurred. Covers the gaps not addressed by 22-7-E2E-010:
 *
 *  22-1-E2E-001 (P1) — AC2:     Body text inherits Inter from body rule
 *  22-1-E2E-002 (P1) — AC6/AC9: No network requests to Google Fonts CDN
 *  22-1-E2E-003 (P2) — AC6:     HTML preload <link> tags reference self-hosted /fonts/
 *
 * NOTE: AC1 (Cinzel on h1-h6) and AC3 (Cinzel Decorative on hero) are already
 * covered by 22-7-E2E-010 in auth-page-chrome.spec.ts. Duplication is avoided.
 *
 * All tests run unauthenticated — /login is a public page.
 */

import { test, expect } from '@playwright/test';

// ── No auth needed — /login is fully public ──────────────────────────────────
test.use({ storageState: { cookies: [], origins: [] } });

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Body text renders in Inter
// The body element has font-family: var(--font-body) = 'Inter', system-ui, ...
// This test asserts the CSS rule applied; it does NOT wait for the font file to
// be decoded by the browser (that is an AC4 / font-display concern, not AC2).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Font stack — body text (AC2)', () => {
  test('22-1-E2E-001: body element computed font-family begins with Inter', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const bodyFontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });

    // The first entry in the stack must be Inter (case-insensitive)
    expect(bodyFontFamily.toLowerCase()).toMatch(/^["']?inter["']?/);
  });

  test('22-1-E2E-002: form label inherits Inter from body', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The "Email Address" form label has no explicit font-family — it inherits body
    const label = page.locator('label[for="email"]');
    await expect(label).toBeVisible({ timeout: 10_000 });

    const fontFamily = await label.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    expect(fontFamily.toLowerCase()).toContain('inter');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 / AC9: No Google Fonts CDN requests — GDPR compliance
// Set up request interception BEFORE navigation so no requests are missed.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('No CDN font requests (AC6 / AC9)', () => {
  test('22-1-E2E-003: page load makes no requests to fonts.googleapis.com', async ({ page }) => {
    const cdnRequests: string[] = [];

    // Intercept all network requests — must be registered before goto
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        cdnRequests.push(url);
      }
    });

    await page.goto('/login', { waitUntil: 'networkidle' });

    // Assert no CDN font requests were made
    expect(
      cdnRequests,
      `Expected zero Google Fonts CDN requests but got: ${cdnRequests.join(', ')}`
    ).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC6 markup: HTML preload <link> tags reference self-hosted /fonts/ paths
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Self-hosted preload tags (AC6)', () => {
  test('22-1-E2E-004: all font preload links reference /fonts/ (not CDN)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // Collect all <link rel="preload" as="font"> hrefs
    const preloadHrefs = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')
      );
      return links.map((l) => l.getAttribute('href') ?? '');
    });

    // At least the 3 preloads declared in index.html should be present
    expect(preloadHrefs.length).toBeGreaterThanOrEqual(3);

    for (const href of preloadHrefs) {
      // Each href must point to self-hosted /fonts/ path
      expect(href, `Font preload href must start with /fonts/: got "${href}"`).toMatch(
        /^\/fonts\//
      );
      // Must NOT reference CDN
      expect(href).not.toContain('googleapis.com');
      expect(href).not.toContain('gstatic.com');
    }
  });

  test('22-1-E2E-005: preload links cover Inter, Cinzel, and Cinzel Decorative', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const preloadHrefs = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')
      );
      return links.map((l) => l.getAttribute('href') ?? '');
    });

    const allHrefs = preloadHrefs.join(' ');

    // Each of the three font families must have at least one preload
    expect(allHrefs).toContain('inter');
    expect(allHrefs).toContain('cinzel');
    expect(allHrefs).toContain('cinzel-decorative');
  });
});
