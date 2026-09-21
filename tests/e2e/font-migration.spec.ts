/**
 * Story 22-1: Font Migration — E2E Tests
 *
 * Verifies that the self-hosted font migration is live and no regressions have
 * occurred. Covers the gaps not addressed by 22-7-E2E-010:
 *
 *  22-1-E2E-001 (P1) — AC2:     Body text inherits the body font from the body rule
 *  22-1-E2E-002 (P1) — AC6/AC9: No network requests to Google Fonts CDN
 *  22-1-E2E-003 (P2) — AC6:     HTML preload <link> tags reference self-hosted /fonts/
 *
 * NOTE: the display/wordmark face is already covered by 22-7-E2E-010 in
 * auth-page-chrome.spec.ts. Duplication is avoided.
 *
 * Equoria-c2erw — OLD CONTRACT (this spec as written): the self-hosted stack
 * was Inter for body text and Cinzel / Cinzel Decorative for display.
 * NEW RULING: the Celestial Night type system in DESIGN.md (lines 264-268)
 * assigns Dragon Tales to the wordmark, Basteleur Bold and Basteleur Moonlight
 * to the announcer and entity voices, and Proda Sans to all functional UI and
 * body copy. The live token carries that ruling in its own comment —
 * frontend/src/styles/tokens.css:333 sets --font-body to
 * 'Proda Sans', system-ui, sans-serif and notes it replaced Inter under the
 * user ruling of 2026-08-14. Inter is retired: no inter woff2 remains in
 * frontend/public/fonts, and frontend/index.html preloads proda-sans-400,
 * basteleur-moonlight-400 and dragon-tales-400. The tests below keep their
 * original purpose and strength — the body rule is the single source of the UI
 * face, every preload is self-hosted, and each ruled family is preloaded —
 * measured against the ruled families instead of the retired ones.
 *
 * All tests run unauthenticated — /login is a public page.
 */

import { test, expect } from '@playwright/test';

// ── No auth needed — /login is fully public ──────────────────────────────────
test.use({ storageState: { cookies: [], origins: [] } });

// ─────────────────────────────────────────────────────────────────────────────
// AC2: Body text renders in the ruled UI face
// The body element has font-family: var(--font-body) = 'Proda Sans', system-ui, ...
// This test asserts the CSS rule applied; it does NOT wait for the font file to
// be decoded by the browser (that is an AC4 / font-display concern, not AC2).
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Font stack — body text (AC2)', () => {
  test('22-1-E2E-001: body element computed font-family begins with Proda Sans', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    const bodyFontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });

    // The first entry in the stack must be Proda Sans (case-insensitive)
    expect(bodyFontFamily.toLowerCase()).toMatch(/^["']?proda sans["']?/);
  });

  test('22-1-E2E-002: form label inherits Proda Sans from body', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // The "Email Address" form label has no explicit font-family — it inherits body
    const label = page.locator('label[for="email"]');
    await expect(label).toBeVisible({ timeout: 10_000 });

    const fontFamily = await label.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    expect(fontFamily.toLowerCase()).toContain('proda sans');
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

  test('22-1-E2E-005: preload links cover Proda Sans, Basteleur Moonlight, and Dragon Tales', async ({
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

    // Each of the three ruled font families must have at least one preload.
    // These are exactly the three declared in frontend/index.html: the UI face,
    // the entity voice, and the wordmark.
    expect(allHrefs).toContain('proda-sans');
    expect(allHrefs).toContain('basteleur-moonlight');
    expect(allHrefs).toContain('dragon-tales');
  });
});
