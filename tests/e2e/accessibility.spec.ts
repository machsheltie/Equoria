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
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const failImpacts = new Set(['critical', 'serious']);

type AxeViolation = {
  id: string;
  impact?: string | null;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

type AxeRuleResult = {
  id: string;
  nodes: Array<{
    target: unknown[];
    any?: Array<{ data?: Record<string, unknown> | null }>;
  }>;
};

type AxeRunResults = {
  passes: AxeRuleResult[];
  violations: AxeRuleResult[];
  incomplete: AxeRuleResult[];
};

/**
 * Flatten axe's `color-contrast` rule into one row per checked text node:
 * the foreground/background it computed, the ratio, and the ratio required.
 * `incomplete` rows are nodes axe could not decide (text over an image,
 * gradient or translucent layer) and are kept so they are never mistaken for
 * passes.
 */
function contrastEvidence(results: AxeRunResults) {
  const rows: Array<Record<string, unknown>> = [];
  const groups: Array<[string, AxeRuleResult[]]> = [
    ['pass', results.passes],
    ['fail', results.violations],
    ['undecided', results.incomplete],
  ];
  for (const [outcome, list] of groups) {
    for (const rule of list.filter((r) => r.id === 'color-contrast')) {
      for (const node of rule.nodes) {
        const data = node.any?.[0]?.data ?? {};
        rows.push({
          outcome,
          target: node.target.join(' '),
          fgColor: data.fgColor ?? null,
          bgColor: data.bgColor ?? null,
          contrastRatio: data.contrastRatio ?? null,
          expectedContrastRatio: data.expectedContrastRatio ?? null,
          fontSize: data.fontSize ?? null,
          fontWeight: data.fontWeight ?? null,
          messageKey: data.messageKey ?? null,
        });
      }
    }
  }
  return rows;
}

/**
 * Run axe on the current page, attach the full report, log a concise
 * breakdown, and assert zero critical/serious violations. moderate/minor
 * are reported but not failed (see threshold doc above).
 */
async function assertNoCriticalA11yViolations(
  page: Page,
  surfaceName: string,
  options: { disableRules?: string[] } = {}
) {
  let builder = new AxeBuilder({ page }).withTags(wcagTags);
  if (options.disableRules?.length) builder = builder.disableRules(options.disableRules);
  const results = await builder.analyze();

  const violations = results.violations as AxeViolation[];

  // Always attach the raw axe report for the surface (visible in HTML report)
  await test.info().attach(`axe-${surfaceName}.json`, {
    body: JSON.stringify(violations, null, 2),
    contentType: 'application/json',
  });

  // Equoria-oey96.10: the computed contrast axe measured on every text node it
  // checked (passes, failures and the nodes it could not decide), so contrast
  // is recorded as measured values rather than inferred from the token sheet.
  await test.info().attach(`contrast-${surfaceName}.json`, {
    body: JSON.stringify(contrastEvidence(results as unknown as AxeRunResults), null, 2),
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

  const blocking = violations.filter((v) => failImpacts.has((v.impact ?? '') as string));

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

// ─────────────────────────────────────────────────────────────────────────────
// Story 30.5 key pages (Equoria-oey96.10): the eight highest-traffic pages —
// login, hub, train, compete, horse detail, breed, results, messages — scanned
// as rendered, then again under forced-colors emulation with a keyboard-only
// Tab sweep. "Breed" is the horse page's Stud / Sale tab: the Breeding Hall
// route was removed (owner ruling q89) and /breeding now redirects to /stable.
// ─────────────────────────────────────────────────────────────────────────────

type KeyPage = {
  name: string;
  auth: boolean;
  open: (page: Page) => Promise<void>;
};

function starterHorseId(): number {
  const { testHorseId } = readTestCredentials();
  if (!testHorseId) {
    throw new Error('E2E_TEST_HORSE_ID missing: global-setup did not record the starter horse.');
  }
  return testHorseId;
}

/** Wait until no loading spinner, skeleton or busy region is left on the page. */
async function waitForSettledContent(page: Page) {
  await expect(
    page.locator('[data-testid="loading-spinner"], [data-testid$="-skeleton"], [aria-busy="true"]')
  ).toHaveCount(0, { timeout: 20000 });
}

const keyPages: KeyPage[] = [
  {
    name: 'login',
    auth: false,
    open: async (page) => {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h2')).toContainText('Welcome Back', { timeout: 15000 });
    },
  },
  {
    name: 'home-hub',
    auth: true,
    open: async (page) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
    },
  },
  {
    name: 'training',
    auth: true,
    open: async (page) => {
      await page.goto('/training', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('training-page')).toBeVisible({ timeout: 15000 });
    },
  },
  {
    name: 'competitions',
    auth: true,
    open: async (page) => {
      await page.goto('/competitions', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('competition-browser-page')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('h1')).toContainText('Competition Arena', { timeout: 10000 });
    },
  },
  {
    name: 'horse-detail',
    auth: true,
    open: async (page) => {
      await page.goto(`/horses/${starterHorseId()}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('horse-detail-overview')).toBeVisible({ timeout: 15000 });
    },
  },
  {
    name: 'breeding-stud-sale',
    auth: true,
    open: async (page) => {
      await page.goto(`/horses/${starterHorseId()}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('horse-detail-overview')).toBeVisible({ timeout: 15000 });
      await page.getByRole('tab', { name: /Stud \/ Sale/ }).click();
      await expect(page.getByTestId('stud-sale-tab')).toBeVisible({ timeout: 15000 });
    },
  },
  {
    name: 'competition-results',
    auth: true,
    open: async (page) => {
      await page.goto('/competition-results', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('competition-results-page')).toBeVisible({ timeout: 20000 });
    },
  },
  {
    name: 'messages',
    auth: true,
    open: async (page) => {
      await page.goto('/messages', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1')).toContainText('Messages', { timeout: 15000 });
    },
  },
];

/**
 * Press Tab up to `maxStops` times from where the page left focus and record what
 * took focus and whether it painted a focus indicator (an outline, or a box
 * shadow — which forced-colors mode removes). Evidence only: attached, never
 * asserted, so the keyboard findings are recorded as measured.
 */
async function keyboardSweep(page: Page, label: string, maxStops = 15) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const stops: Array<Record<string, unknown>> = [];
  for (let i = 0; i < maxStops; i += 1) {
    await page.keyboard.press('Tab');
    stops.push(
      await page.evaluate(async () => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { tag: 'body' };
        // Focus styles may transition in; read them once they have settled.
        // Only transitions: a looping animation would never finish.
        await Promise.all(
          el
            .getAnimations()
            .filter((a) => a instanceof CSSTransition)
            .map((a) => a.finished.catch(() => undefined))
        );
        const cs = getComputedStyle(el);
        const opaque = (color: string) => !/^rgba\([^)]*,\s*0\)$/.test(color.trim());
        const hasOutline =
          cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && opaque(cs.outlineColor);
        // A shadow counts only if one layer has a visible color and a non-zero
        // blur or spread (Tailwind leaves transparent 0px ring layers behind).
        const hasShadow = (cs.boxShadow.match(/rgba?\([^)]*\)[^,]*/g) ?? []).some((layer) => {
          const color = layer.match(/rgba?\([^)]*\)/)?.[0] ?? '';
          const lengths = (layer.slice(color.length).match(/-?[\d.]+px/g) ?? []).map(parseFloat);
          return opaque(color) && lengths.slice(2).some((n) => n !== 0);
        });
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 60),
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
          borderColor: cs.borderTopColor,
          boxShadow: cs.boxShadow,
          visibleIndicator: hasOutline || hasShadow,
          outlineIndicator: hasOutline,
        };
      })
    );
  }
  await test.info().attach(`keyboard-${label}.json`, {
    body: JSON.stringify(stops, null, 2),
    contentType: 'application/json',
  });
}

/**
 * Measure contrast for the text axe could not score (text over the painted
 * backdrop, a gradient or a translucent panel). The text is hidden, the page
 * is captured, and every captured pixel behind each text box is compared with
 * the text's computed color: `worstRatio` uses the backdrop pixel closest in
 * luminance to the text (5th percentile of ratios, so a stray icon pixel does
 * not decide it) and `medianRatio` the typical pixel. Evidence only: attached
 * so the contrast record covers the whole page, not asserted (Equoria-oey96.10).
 */
async function sampledContrast(page: Page, label: string) {
  const axe = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const selectors = (axe.incomplete as unknown as AxeRuleResult[])
    .filter((r) => r.id === 'color-contrast')
    .flatMap((r) => r.nodes)
    .map((n) => n.target)
    .filter((t) => t.length === 1 && typeof t[0] === 'string')
    .map((t) => t[0] as string);

  // Grow the viewport to the page's full height first, so the text boxes are
  // measured in the same layout the capture paints (a fullPage capture resizes
  // the viewport itself and moves anything sized to the screen).
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.min(fullHeight, 8000) });
  await page.evaluate(() => window.scrollTo(0, 0));

  const boxes = await page.evaluate((sels) => {
    return sels.flatMap((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return [];
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return [];
      const cs = getComputedStyle(el);
      return [
        {
          sel,
          text: (el.textContent ?? '').trim().slice(0, 40),
          x: r.left + window.scrollX,
          y: r.top + window.scrollY,
          w: r.width,
          h: r.height,
          color: cs.color,
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight) || 400,
        },
      ];
    });
  }, selectors);

  const hide = await page.addStyleTag({
    content:
      '*{color:transparent!important;-webkit-text-fill-color:transparent!important;' +
      'text-shadow:none!important;caret-color:transparent!important}',
  });
  const shot = await page.screenshot({ animations: 'disabled' });
  await hide.evaluate((node) => node.remove());
  await page.setViewportSize(viewport);
  await test.info().attach(`contrast-backdrop-${label}.png`, {
    body: shot,
    contentType: 'image/png',
  });

  const rows = await page.evaluate(
    async ({ png, items }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return [];
      ctx.drawImage(img, 0, 0);
      const lin = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      const lum = (r: number, g: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return items.flatMap((it) => {
        // Only rgb()/rgba() is parsed; any other color syntax is skipped, not guessed.
        if (!/^rgba?\(/.test(it.color)) return [];
        // Gradient-clipped text paints with a transparent color: not measurable here.
        if (it.color === 'rgba(0, 0, 0, 0)') return [];
        const m = it.color.match(/[\d.]+/g)?.map(Number) ?? [];
        if (m.length < 3) return [];
        const alpha = m.length > 3 ? m[3] : 1;
        const x0 = Math.max(0, Math.floor(it.x));
        const y0 = Math.max(0, Math.floor(it.y));
        const w = Math.min(Math.ceil(it.w), img.width - x0);
        const h = Math.min(Math.ceil(it.h), img.height - y0);
        if (w < 1 || h < 1) return [];
        const px = ctx.getImageData(x0, y0, w, h).data;
        const ratios: number[] = [];
        for (let i = 0; i < px.length; i += 4 * 3) {
          const [br, bg, bb] = [px[i], px[i + 1], px[i + 2]];
          // Translucent text is blended over the pixel it sits on.
          const fr = m[0] * alpha + br * (1 - alpha);
          const fg = m[1] * alpha + bg * (1 - alpha);
          const fb = m[2] * alpha + bb * (1 - alpha);
          ratios.push(ratio(lum(fr, fg, fb), lum(br, bg, bb)));
        }
        ratios.sort((a, b) => a - b);
        const large = it.fontSize >= 24 || (it.fontSize >= 18.66 && it.fontWeight >= 700);
        const required = large ? 3 : 4.5;
        const worst = ratios[Math.floor(ratios.length * 0.05)];
        return [
          {
            target: it.sel,
            text: it.text,
            color: it.color,
            fontSize: it.fontSize,
            fontWeight: it.fontWeight,
            required,
            worstRatio: Math.round(worst * 100) / 100,
            medianRatio: Math.round(ratios[Math.floor(ratios.length / 2)] * 100) / 100,
            meetsAtWorst: worst >= required,
          },
        ];
      });
    },
    { png: shot.toString('base64'), items: boxes }
  );

  await test.info().attach(`contrast-sampled-${label}.json`, {
    body: JSON.stringify(
      { undecidedByAxe: selectors.length, measured: rows.length, rows },
      null,
      2
    ),
    contentType: 'application/json',
  });
}

test.describe('a11y — Story 30.5 key pages (real login, real DB)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // competitions: the selected filter chips measured #dcebff on #3a6fdd, 3.86:1
  // at 12px (WCAG 1.4.3 needs 4.5:1). Fixed by --celestial-primary-fill #3163cc,
  // 4.59:1 (Equoria-oey96.74, owner ruling q344).
  for (const keyPage of keyPages.filter((p) =>
    ['competitions', 'breeding-stud-sale', 'competition-results', 'messages'].includes(p.name)
  )) {
    test(`${keyPage.name} has no critical/serious axe violations`, async ({ page }) => {
      test.setTimeout(60000);
      await loginWithRealCredentials(page);
      await keyPage.open(page);
      await waitForSettledContent(page);
      await assertNoCriticalA11yViolations(page, keyPage.name);
    });
  }
});

test.describe('a11y — Story 30.5 key pages under forced colors (real login, real DB)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const keyPage of keyPages) {
    test(`${keyPage.name} has no critical/serious axe violations in forced-colors mode`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      if (keyPage.auth) await loginWithRealCredentials(page);
      await keyPage.open(page);
      await waitForSettledContent(page);
      await sampledContrast(page, keyPage.name);
      await keyboardSweep(page, `${keyPage.name}-default`);

      await page.emulateMedia({ forcedColors: 'active' });
      await keyPage.open(page);
      await waitForSettledContent(page);
      expect(
        await page.evaluate(() => window.matchMedia('(forced-colors: active)').matches),
        'forced-colors emulation must be in effect before measuring'
      ).toBe(true);
      await test.info().attach(`forced-colors-${keyPage.name}.png`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
      await keyboardSweep(page, `${keyPage.name}-forced-colors`);
      // color-contrast is not scored here: axe reads the authored text color
      // but the forced background, so it reports pairs nobody sees. Measured
      // 2026-11-03 (Equoria-oey96.10): it scored the sidebar wordmark gold
      // #c8a84e on #ffffff (2.29:1) while the screenshot shows it painted in
      // the system text color. Contrast is asserted on the authored palette in
      // the default-mode tests; every other axe rule still runs here.
      await assertNoCriticalA11yViolations(page, `${keyPage.name}-forced-colors`, {
        disableRules: ['color-contrast'],
      });
    });
  }
});
