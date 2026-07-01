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
        // HARD guard: an authenticated route that lands on /login means the
        // session bootstrap failed — capturing it would silently corrupt the
        // baseline with 30 identical login screenshots.
        expect(
          page.url(),
          `${route.slug}: redirected to login — auth bootstrap failed for this run`
        ).not.toMatch(/\/login/);
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

// ────────────────────────────────────────────────────────────────────────────
// Slice 2 — representative-state captures (Equoria-o5hub.45, BOUNDED pass)
// ────────────────────────────────────────────────────────────────────────────
//
// Slice 1 above captures every routed page in its NORMAL (loaded, populated)
// state. Slice 2 captures the SIX non-normal UI states the design system has
// to render honestly, one representative route per state — NOT every family.
//
// Route interception (`page.route()`) is the intended mechanism here (issue
// text): this is a capture TOOL in its own `baseline` Playwright project,
// excluded from CI — NOT a beta-readiness gate. Intercepting a list API to
// force loading / empty / error / long-content states is legitimate here in a
// way it would never be in a readiness suite. Every intercepted envelope is
// grounded in the REAL backend controller shape (quoted inline) so the capture
// renders the real component, not a broken shell.
//
// State → route → grounding (all quoted from source at authoring time):
//   1. LOADING          /competitions  — delay GET /api/v1/competition; the
//        page renders [data-testid="loading-spinner"] while useCompetitions()
//        isLoading && activeTab==='ridden' (CompetitionBrowserPage.tsx:205-219).
//   2. EMPTY            /competitions   — fulfill GET /api/v1/competition with
//        an empty paginated envelope; CompetitionList renders
//        [data-testid="empty-state"] "No competitions found"
//        (CompetitionList.tsx:55-61, 108).
//   3. ERROR            /competitions   — fulfill GET /api/v1/competition 500;
//        the page renders [data-testid="error-state"] "Failed to load
//        competitions" (CompetitionBrowserPage.tsx:222-240). (Grooms has no
//        error state — its hooks default to [] and fall through to empty — so
//        competitions is the correct error candidate.)
//   4. DIALOG-OPEN      /grooms (Hire)  — mock GET /api/v1/groom-marketplace,
//        click [data-testid="hire-tab"] then a card's [aria-label="Hire …"];
//        [data-testid="hire-modal"] opens (GroomList.tsx:388-405, 432-439).
//   5. DESTRUCTIVE      /settings       — click [data-testid="settings-delete-
//        account"]; [data-testid="settings-delete-modal"] opens
//        (AccountSection.tsx:184-191, DeleteAccountModal.tsx:67). No seeded
//        state needed — Account is the default settings section
//        (SettingsPage.tsx:55, 351-372) and opening the dialog needs no input.
//   6. LONG-CONTENT     /stable         — intercept **/api/v1/horses*, rewrite
//        data[0].name to a long string; HorseCard renders the name with
//        `truncate` + `title` (HorseCard.tsx:135-141) — the capture documents
//        how the card handles overflow (ellipsis, not layout break).
//
// Envelope facts that drive the mocks (grounded, do NOT "simplify"):
//  - apiClient.get unwraps the outer `.data` key IFF present, else returns the
//    whole body (apiClient.ts:218). So:
//    · /api/v1/competition returns { success, data: [...], pagination, meta }
//      → client hands the page the inner ARRAY.
//    · /api/v1/horses returns { success, message, data: [...horse] } (FLAT
//      array; NO data.horses, NO pagination) → client hands back the array.
//      Rewrite body.data[0].name. Request carries a cache-bust ?t=… param, so
//      match on the path, not an exact URL.
//    · /api/v1/groom-marketplace returns { success, message, data: { grooms,
//      lastRefresh, nextFreeRefresh, refreshCost, canRefreshFree, refreshCount }
//      } → client hands back the MarketplaceData object.

/** A groom-marketplace envelope with one affordable groom (sessionRate 1 →
 *  hiring cost 7, so any funded account can click Hire). Shape = the real
 *  controller (groomMarketplaceController.mjs:83-94) + MarketplaceGroom
 *  (types.ts:529-540). */
const SLICE2_MARKETPLACE_BODY = {
  success: true,
  message: 'Marketplace retrieved successfully',
  data: {
    grooms: [
      {
        marketplaceId: 'slice2-mkt-1',
        firstName: 'Baseline',
        lastName: 'Groom',
        specialty: 'foalCare',
        skillLevel: 'expert',
        personality: 'gentle',
        experience: 5,
        sessionRate: 1,
        bio: 'Representative marketplace groom for baseline capture.',
        availability: true,
      },
    ],
    lastRefresh: '2026-01-01T00:00:00.000Z',
    nextFreeRefresh: '2026-01-02T00:00:00.000Z',
    refreshCost: 0,
    canRefreshFree: true,
    refreshCount: 1,
  },
} as const;

/** A competition list envelope with N shows, matching buildPaginatedResponse
 *  (paginationHelper.mjs:147-161): { success, data: [...], pagination, meta }. */
function slice2CompetitionBody(count: number) {
  const data = Array.from({ length: count }, (_, i) => ({
    id: 1000 + i,
    name: `Baseline Show ${i + 1}`,
    discipline: 'Dressage',
    status: 'open',
    entryFee: 100,
    prizePool: 1000,
    runDate: '2026-12-31T00:00:00.000Z',
  }));
  return {
    success: true,
    data,
    pagination: {
      currentPage: 1,
      pageSize: 20,
      totalRecords: count,
      totalPages: count === 0 ? 0 : 1,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: null,
      prevPage: null,
      startRecord: count === 0 ? 0 : 1,
      endRecord: count,
    },
    meta: { timestamp: new Date().toISOString() },
  };
}

/** Guard: an authed slice-2 route must not have bounced to /login. */
function assertNotLoginRedirect(page: Page, slug: string): void {
  expect(
    page.url(),
    `${slug}: redirected to login — auth bootstrap failed for this run`
  ).not.toMatch(/\/login/);
}

for (const viewport of viewports) {
  test.describe(`baseline states (slice 2) @ ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });

    // 1. LOADING — /competitions with a delayed list API. We screenshot WHILE
    //    the spinner is up, so we do NOT settle()/assertNotStuckLoading here:
    //    the spinner IS the subject. We wait for the real loading-spinner
    //    testid to be visible, then capture before the 4s delay resolves.
    test('slice 2 — loading (competitions)', async ({ page }) => {
      await page.route('**/api/v1/competition', async (route) => {
        await new Promise((r) => setTimeout(r, 4000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(slice2CompetitionBody(3)),
        });
      });

      await page.goto('/competitions', { waitUntil: 'commit' });
      assertNotLoginRedirect(page, 'competitions-loading');
      // The page short-circuits to the loading return while useCompetitions
      // isLoading — wait for the real spinner testid to be attached+visible.
      await page
        .locator('[data-testid="loading-spinner"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      // Let fonts/layout paint without waiting for networkidle (the list API
      // is deliberately still pending).
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      await page.screenshot({
        path: path.join(OUT_DIR, `workflow--competition-browser--loading--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // 2. EMPTY — /competitions with an empty list envelope → empty-state.
    test('slice 2 — empty (competitions)', async ({ page }) => {
      await page.route('**/api/v1/competition', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(slice2CompetitionBody(0)),
        })
      );

      await page.goto('/competitions');
      await settle(page);
      assertNotLoginRedirect(page, 'competitions-empty');
      await assertNotStuckLoading(page, 'competitions-empty');
      await page
        .locator('[data-testid="empty-state"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `workflow--competition-browser--empty--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // 3. ERROR — /competitions list API 500 → error-state.
    test('slice 2 — error (competitions)', async ({ page }) => {
      await page.route('**/api/v1/competition', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Failed to load competitions',
            error: 'Internal error',
          }),
        })
      );

      await page.goto('/competitions');
      await settle(page);
      assertNotLoginRedirect(page, 'competitions-error');
      await assertNotStuckLoading(page, 'competitions-error');
      await page
        .locator('[data-testid="error-state"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `workflow--competition-browser--error--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // 4. DIALOG-OPEN — /grooms Hire tab hire-confirm modal.
    test('slice 2 — dialog-open (grooms hire-confirm)', async ({ page }) => {
      // Mock the marketplace so exactly one affordable groom renders (the real
      // marketplace is randomized + affordability-gated; mocking makes the
      // Hire button deterministically clickable).
      await page.route('**/api/v1/groom-marketplace', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SLICE2_MARKETPLACE_BODY),
        })
      );

      await page.goto('/grooms');
      await settle(page);
      assertNotLoginRedirect(page, 'grooms-dialog');
      await assertNotStuckLoading(page, 'grooms-dialog');

      // Switch to the Hire tab (GroomsPage.tsx:60 — data-testid="hire-tab").
      await page.locator('[data-testid="hire-tab"]').click();
      // The mocked groom's Hire button (GroomList.tsx:393 —
      // aria-label="Hire {firstName} {lastName}").
      const hireBtn = page.locator('[aria-label="Hire Baseline Groom"]');
      await hireBtn.waitFor({ state: 'visible', timeout: 8000 });
      await hireBtn.click();
      // Confirm dialog (GroomList.tsx:439 — data-testid="hire-modal").
      await page.locator('[data-testid="hire-modal"]').waitFor({ state: 'visible', timeout: 8000 });
      await page.waitForTimeout(250); // dialog enter transition settle
      await page.screenshot({
        path: path.join(OUT_DIR, `world-services--grooms--dialog-open--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // 5. DESTRUCTIVE-CONFIRM — /settings delete-account confirmation.
    test('slice 2 — destructive-confirm (settings delete-account)', async ({ page }) => {
      await page.goto('/settings');
      await settle(page);
      assertNotLoginRedirect(page, 'settings-destructive');
      await assertNotStuckLoading(page, 'settings-destructive');

      // Account is the default section (SettingsPage.tsx:55) so the button is
      // present on load. Opening the dialog needs NO password/typing — the
      // username field only ENABLES the confirm button
      // (DeleteAccountModal.tsx:127), it is not required to display the dialog.
      const deleteBtn = page.locator('[data-testid="settings-delete-account"]');
      await deleteBtn.waitFor({ state: 'visible', timeout: 8000 });
      await deleteBtn.click();
      await page
        .locator('[data-testid="settings-delete-modal"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.waitForTimeout(250); // dialog enter transition settle
      await page.screenshot({
        path: path.join(
          OUT_DIR,
          `settings-profile--settings--destructive-confirm--${viewport.name}.png`
        ),
        fullPage: true,
      });
    });

    // 6. LONG-CONTENT — /stable with the first horse's name rewritten to a long
    //    string. We PASS THROUGH the real API and rewrite the response body so
    //    the roster is otherwise real (only the name is stretched).
    test('slice 2 — long-content (stable horse card overflow)', async ({ page }) => {
      const LONG_NAME =
        'Sir Reginald Bartholomew Wellington the Third of the Everlasting Meadowlands XI';
      // 78 chars — deliberately > any real name to exercise truncation/overflow.

      await page.route('**/api/v1/horses*', async (route) => {
        const response = await route.fetch();
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          // Non-JSON (shouldn't happen) — pass through unchanged.
          await route.fulfill({ response });
          return;
        }
        const b = body as { data?: Array<{ name?: string }> };
        if (Array.isArray(b?.data) && b.data.length > 0) {
          b.data[0].name = LONG_NAME;
        }
        await route.fulfill({
          response,
          contentType: 'application/json',
          body: JSON.stringify(b),
        });
      });

      await page.goto('/stable');
      await settle(page);
      assertNotLoginRedirect(page, 'stable-long-content');
      await assertNotStuckLoading(page, 'stable-long-content');
      // Loading here is a skeleton grid with only aria-label="Loading horses"
      // (StableView.tsx:99, no testid). Wait for a real card to be present so
      // we capture the loaded roster, not the skeleton.
      await page
        .locator('[data-testid="horse-card"]')
        .first()
        .waitFor({ state: 'visible', timeout: 12000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `stable-entity--stable--long-content--${viewport.name}.png`),
        fullPage: true,
      });
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Slice 2b — representative-state captures for the REMAINING families
// (Equoria-yt5tj, extends Equoria-o5hub.45)
// ────────────────────────────────────────────────────────────────────────────
//
// Slice 2 (above) covered the 6 state types for 4 families (workflow,
// world-services, settings-profile, stable-entity). Slice 2b extends the SAME
// page.route()-interception approach to the 4 REMAINING families: auth, hub,
// marketplace-economy, community-messaging.
//
// The o5hub.45 discovery holds: the app does NOT implement every state on every
// page. Each capture below is grounded in a state the target route ACTUALLY has
// a designed UI for (verified in-component). States the routes DON'T implement
// are NOT fabricated — they are reported as gaps in the bd notes, not captured.
//
// Every intercepted envelope is grounded in the REAL controller/hook shape
// (quoted inline). The apiClient unwraps the outer `.data` key when present
// (apiClient.ts:215-218), so mocks return the FULL backend envelope
// { success, data: ... } and the hook receives the inner value.
//
// State → route → grounding (per-test inline comments carry the file:line detail):
//   AUTH · error   /login — fill form + intercept POST /api/v1/auth/login → HTTP 400
//     { status:'error', message:'…' }. useLogin error → <AuthError> role="alert"
//     (AuthLayout.tsx:117-135; LoginPage.tsx:64). 400 not 401: a 401 hits apiClient's
//     refresh branch (apiClient.ts:153) and overwrites the message; 400 hits the generic
//     non-2xx handler (apiClient.ts:196-207) which surfaces errorData.message.
//   HUB · empty/error   / (dashboard) — intercept GET **/api/v1/horses* (useHorses →
//     GET /api/v1/horses?t=… cache-bust; match the path). Empty ([]) →
//     [data-testid="empty-state-first-use"] (Index.tsx:398; EmptyState.tsx:269). 500 →
//     <ErrorCard title="Unable to Load Horses"> role="alert" (Index.tsx:392; ErrorCard.tsx:51).
//     GAP: /world (WorldHubPage.tsx) is a STATIC location grid (no fetch) — the hub's
//     non-normal UI lives on / (dashboard), not /world.
//   MARKETPLACE-ECONOMY · empty/error   /inventory — intercept GET **/api/v1/inventory
//     ({ success, data:{ items, total } }, inventory.ts:22-25). Empty →
//     [data-testid="empty-inventory"] (InventoryPage.tsx:232); 500 →
//     [data-testid="inventory-error"] (InventoryPage.tsx:216). GAP: /marketplace/horses
//     and /messages have NO error state (500 → empty); /marketplace hub is a static grid.
//     /inventory is the economy route WITH a real error branch.
//   COMMUNITY-MESSAGING · empty/dialog   /messages — intercept GET **/api/v1/messages/inbox
//     ({ success, data:{ messages, total, page } }, messageController.mjs:40). Empty →
//     [data-testid="empty-messages"] (MessagesPage.tsx:111). Dialog: click
//     [data-testid="compose-button"] (MessagesPage.tsx:186) → <ComposeModal> GameDialog
//     "Compose Message" (ComposeModal.tsx:85) — no container testid, anchor role="dialog".

/** Inventory envelope: { success, data: { items, total } } (inventory.ts:22-25). */
function slice2bInventoryBody(count: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `slice2b-inv-${i + 1}`,
    itemId: 'dressage-saddle',
    category: 'saddle' as const,
    name: `Baseline Saddle ${i + 1}`,
    bonus: 'Representative inventory item for baseline capture.',
    quantity: 1,
    equippedToHorseId: null,
    equippedToHorseName: null,
  }));
  return { success: true, data: { items, total: count } };
}

/** Inbox envelope: { success, data: { messages, total, page } } (messageController.mjs:40). */
function slice2bInboxBody(count: number) {
  const messages = Array.from({ length: count }, (_, i) => ({
    id: 5000 + i,
    senderId: 'slice2b-sender',
    sender: { id: 'slice2b-sender', username: 'BaselineSender' },
    recipientId: 'slice2b-me',
    recipient: { id: 'slice2b-me', username: 'BaselineMe' },
    subject: `Baseline Message ${i + 1}`,
    content: 'Representative inbox message for baseline capture.',
    isRead: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
  return { success: true, data: { messages, total: count, page: 1 } };
}

for (const viewport of viewports) {
  test.describe(`baseline states (slice 2b) @ ${viewport.name}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      reducedMotion: 'reduce',
    });

    // AUTH · error — /login form-submit against an intercepted 400. Runs in a
    // CLEAN (unauthenticated) context, mirroring slice-1's !route.auth path, so
    // the login chrome renders instead of the authed shell redirecting away.
    test('slice 2b — error (login invalid credentials)', async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: 'reduce',
        storageState: undefined,
      });
      const cleanPage = await ctx.newPage();

      // 400 (not 401) so apiClient surfaces our message rather than the
      // refresh-branch "Session expired" (see the block comment above).
      await cleanPage.route('**/api/v1/auth/login', (route) =>
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'error', message: 'Invalid email or password' }),
        })
      );

      await cleanPage.goto('/login');
      await settle(cleanPage);
      // Fill valid-FORMAT fields so client-side Zod passes and the POST fires
      // (an invalid format would show inline field errors, not the API banner).
      await cleanPage.locator('input[name="email"]').fill('baseline@example.com');
      await cleanPage.locator('input[name="password"]').fill('BaselinePass123');
      await cleanPage.locator('button[type="submit"]').click();
      // AuthError renders role="alert" once the mutation rejects.
      await cleanPage
        .locator('[role="alert"]')
        .filter({ hasText: /invalid email or password/i })
        .waitFor({ state: 'visible', timeout: 8000 });
      await cleanPage.screenshot({
        path: path.join(OUT_DIR, `auth--login--error--${viewport.name}.png`),
        fullPage: true,
      });
      await ctx.close();
    });

    // HUB · empty — / dashboard with an empty horse list → empty-state.
    test('slice 2b — empty (hub dashboard)', async ({ page }) => {
      await page.route('**/api/v1/horses*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        })
      );

      await page.goto('/');
      await settle(page);
      assertNotLoginRedirect(page, 'hub-empty');
      await assertNotStuckLoading(page, 'hub-empty');
      await page
        .locator('[data-testid="empty-state-first-use"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `hub--dashboard--empty--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // HUB · error — / dashboard horse list 500 → ErrorCard (role="alert").
    test('slice 2b — error (hub dashboard)', async ({ page }) => {
      await page.route('**/api/v1/horses*', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Failed to fetch horses',
            error: 'Internal error',
          }),
        })
      );

      await page.goto('/');
      await settle(page);
      assertNotLoginRedirect(page, 'hub-error');
      await assertNotStuckLoading(page, 'hub-error');
      // ErrorCard has no testid — anchor on its role="alert" + heading text.
      await page
        .locator('[role="alert"]')
        .filter({ hasText: /unable to load horses/i })
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `hub--dashboard--error--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // MARKETPLACE-ECONOMY · empty — /inventory with an empty inventory.
    test('slice 2b — empty (inventory)', async ({ page }) => {
      await page.route('**/api/v1/inventory', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(slice2bInventoryBody(0)),
        })
      );

      await page.goto('/inventory');
      await settle(page);
      assertNotLoginRedirect(page, 'inventory-empty');
      await assertNotStuckLoading(page, 'inventory-empty');
      await page
        .locator('[data-testid="empty-inventory"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `marketplace-economy--inventory--empty--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // MARKETPLACE-ECONOMY · error — /inventory list API 500 → inventory-error.
    test('slice 2b — error (inventory)', async ({ page }) => {
      await page.route('**/api/v1/inventory', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Could not load inventory',
            error: 'Internal error',
          }),
        })
      );

      await page.goto('/inventory');
      await settle(page);
      assertNotLoginRedirect(page, 'inventory-error');
      await assertNotStuckLoading(page, 'inventory-error');
      await page
        .locator('[data-testid="inventory-error"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `marketplace-economy--inventory--error--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // COMMUNITY-MESSAGING · empty — /messages inbox empty → empty-messages.
    test('slice 2b — empty (messages inbox)', async ({ page }) => {
      await page.route('**/api/v1/messages/inbox', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(slice2bInboxBody(0)),
        })
      );

      await page.goto('/messages');
      await settle(page);
      assertNotLoginRedirect(page, 'messages-empty');
      await assertNotStuckLoading(page, 'messages-empty');
      await page
        .locator('[data-testid="empty-messages"]')
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `community-messaging--messages--empty--${viewport.name}.png`),
        fullPage: true,
      });
    });

    // COMMUNITY-MESSAGING · dialog-open — /messages Compose dialog. Inbox is
    // intercepted empty so the base list is deterministic before opening the dialog.
    test('slice 2b — dialog-open (messages compose)', async ({ page }) => {
      await page.route('**/api/v1/messages/inbox', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(slice2bInboxBody(0)),
        })
      );

      await page.goto('/messages');
      await settle(page);
      assertNotLoginRedirect(page, 'messages-dialog');
      await assertNotStuckLoading(page, 'messages-dialog');

      await page.locator('[data-testid="compose-button"]').click();
      // ComposeModal (GameDialog → Radix Dialog) has no container testid; anchor
      // on role="dialog" + the "Compose Message" title (ComposeModal.tsx:85).
      await page
        .locator('[role="dialog"]')
        .filter({ hasText: /compose message/i })
        .waitFor({ state: 'visible', timeout: 8000 });
      await page.waitForTimeout(250); // dialog enter transition settle
      await page.screenshot({
        path: path.join(
          OUT_DIR,
          `community-messaging--messages--dialog-open--${viewport.name}.png`
        ),
        fullPage: true,
      });
    });
  });
}
