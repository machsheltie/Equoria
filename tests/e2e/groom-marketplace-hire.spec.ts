/**
 * Groom Marketplace — Hire flow + Refresh mutation — E2E (Equoria-ijwep)
 *
 * Exercises the REAL groom-marketplace surface that beta testers use, against
 * the live backend + real Postgres, with real auth (storageState from
 * tests/e2e/global-setup.ts) and the full CSRF round-trip enforced by
 * NODE_ENV=beta. No bypass headers, no test.skip, no mocked primary paths.
 *
 * The live route for groom hiring is /grooms → GroomsPage, whose "Hire Grooms"
 * tab renders frontend/src/components/GroomList.tsx and whose "Manage Grooms"
 * tab renders frontend/src/components/MyGroomsDashboard.tsx. (Equoria-149ty
 * deleted the unrouted frontend/src/pages/MarketplacePage.tsx; this spec drives
 * the live GroomList surface a beta tester can actually reach. Owner rulings
 * 2026-10-26 "no receipts" and q230 one-click, Equoria-1qf9n: the paid-refresh
 * confirmation dialog Equoria-149ty added is removed again.)
 *
 * Sub-flows:
 *
 *  (a) HIRE — one click on the card's Hire button → POST /api/v1/groom-marketplace/hire
 *      (owner ruling q230, 2026-10-28: one-click hire; old contract: a
 *      hire-confirmation dialog with Cancel and Hire Groom, now removed).
 *      Why E2E: the hire spans the real React Query mutation, the real CSRF
 *      header, the real Express controller, an atomic Prisma debit + ledger
 *      write, and the real money-decrement on the user row. A unit/mock test
 *      cannot exercise the debit transaction, the marketplace-offer removal, or
 *      the real money-decrement. We read the balance BEFORE, capture the real
 *      201 response (which returns `cost` + `remainingMoney` from the DB),
 *      assert remainingMoney === before − cost, cross-check the persisted
 *      profile balance, and assert the hired groom is OWNED via the real
 *      GET /api/v1/grooms/user/:id. The groom cost is read from the live
 *      marketplace response (sessionRate × 7), never hardcoded — and the groom
 *      is chosen to be affordable against the real balance. (The owned-groom
 *      Manage-TAB DOM render is deferred to Equoria-j2a51: GroomsPage feeds
 *      MyGroomsDashboard a NaN userId so owned grooms never render there, and
 *      the raw-id fix crashes that page. Ownership is asserted via the real
 *      backend/DB here instead — equivalent, not weaker.)
 *
 *  (b) REFRESH — POST /api/v1/groom-marketplace/refresh {force}.
 *      Why E2E: the refresh cost / free-window is server-authoritative
 *      (getRefreshCost(lastRefresh), 24h window under NODE_ENV=beta) and is
 *      computed from real persisted marketplace state. The live state on any
 *      given run is in exactly ONE of two branches — free (canRefreshFree:true,
 *      refreshCost:0) or paid (canRefreshFree:false, refreshCost>0) — so the
 *      spec reads the real GET response and drives the matching real branch.
 *      Both branches are one click with no dialog (Equoria-1qf9n; old
 *      contract: the paid branch opened a confirmation dialog first):
 *        - FREE branch: clicking Refresh fires the real POST {force:false}.
 *        - PAID branch: the button names its fee, and clicking it fires the
 *          real POST {force:true}.
 *      This is not a skip: both branches are real and which one runs is dictated
 *      by real DB state, not by the test.
 */
import { test, expect, type Response as PWResponse } from '@playwright/test';

const MARKETPLACE_GET = '/api/v1/groom-marketplace';
const HIRE_POST = '/api/v1/groom-marketplace/hire';
const REFRESH_POST = '/api/v1/groom-marketplace/refresh';
// The authoritative account balance the Hire tab renders comes from the same
// profile endpoint AuthContext feeds into GroomList's `user.money`. Reading it
// here (rather than scraping a DOM coin span) makes the affordability gate and
// the debit assertion robust to the many other "<n> coins" Currency spans on
// the Hire tab (refresh cost, groom salaries, per-card hire costs).
const PROFILE_GET = '/api/v1/auth/profile';

type MarketplaceGroom = {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  sessionRate: number;
};

type MarketplaceData = {
  grooms: MarketplaceGroom[];
  refreshCost: number;
  canRefreshFree: boolean;
};

/**
 * Read the live marketplace state straight from the authed page context.
 * Uses the page's own request context so it carries the real session cookies.
 */
async function fetchMarketplace(page: import('@playwright/test').Page): Promise<MarketplaceData> {
  const res = await page.request.get(MARKETPLACE_GET);
  expect(res.ok(), `GET ${MARKETPLACE_GET} must succeed (status ${res.status()})`).toBe(true);
  const json = await res.json();
  const data = json?.data ?? json;
  expect(Array.isArray(data?.grooms), 'marketplace response must contain a grooms array').toBe(
    true
  );
  return data as MarketplaceData;
}

/**
 * Read the REAL, server-authoritative account balance straight from the profile
 * endpoint — the SAME source AuthContext feeds into GroomList's `user.money`,
 * so this is exactly the number the Hire tab renders as "Your Balance". Using
 * the API (not a DOM scrape) is the robust source for the affordability gate
 * and the debit assertion: the Hire tab renders many "<n> coins" Currency spans
 * (refresh cost, groom weekly salaries, per-card hire costs), so any DOM read
 * that isn't perfectly scoped can latch onto the wrong number — the original
 * locator did exactly that, reading a non-balance coin span (e.g. the refresh
 * cost) instead of the ~10,000-coin fresh-user balance.
 */
async function fetchBalance(page: import('@playwright/test').Page): Promise<number> {
  const res = await page.request.get(PROFILE_GET);
  expect(res.ok(), `GET ${PROFILE_GET} must succeed (status ${res.status()})`).toBe(true);
  const json = await res.json();
  const user = json?.data?.user ?? json?.user ?? json?.data ?? json;
  const money = user?.money;
  expect(
    typeof money === 'number' && Number.isFinite(money),
    `profile response must carry a numeric money field (got ${JSON.stringify(money)})`
  ).toBe(true);
  return money as number;
}

/**
 * Locate the DISPLAYED "Your Balance" Currency precisely. The balance lives in a
 * Surface (data-testid="surface") whose label span reads "Your Balance"; we
 * anchor on that Surface and read the single coins <Currency> inside it. Unlike
 * the old `locator('div', { has })...first()` form — which matched every
 * ANCESTOR div containing the label (up to the page wrapper) and so `.first()`
 * picked the OUTERMOST one, sweeping in the refresh-cost coin span that renders
 * earlier in the DOM — this scopes to the innermost Surface, which contains the
 * balance Currency and nothing else with a "coins" aria-label.
 */
function readBalanceLocator(page: import('@playwright/test').Page) {
  return page
    .locator('[data-testid="surface"]', { has: page.getByText('Your Balance', { exact: true }) })
    .locator('[aria-label$="coins"]')
    .last();
}

test.describe('Groom Marketplace — hire + refresh (Equoria-ijwep)', () => {
  test.beforeEach(() => {
    test.setTimeout(90_000);
  });

  test('(a) hiring a groom debits the balance by the groom cost and the groom is owned (persisted)', async ({
    page,
  }) => {
    // ── Land on the Hire tab (real auth via storageState) ──────────────────
    const initialMarketplaceResp = page.waitForResponse(
      (r) => r.url().includes(MARKETPLACE_GET) && r.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await page.goto('/grooms', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Groom Quarters').first()).toBeVisible({ timeout: 20_000 });

    const hireTab = page.locator('[data-testid="hire-tab"]');
    await expect(hireTab).toBeVisible({ timeout: 15_000 });
    await hireTab.click();
    await expect(hireTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });

    // The Hire tab fires the real marketplace GET; wait for the list to render.
    await initialMarketplaceResp.catch(() => {
      // The GET may already have resolved before the listener attached; the
      // grid assertion below is the real gate.
    });

    // ── Read the REAL balance + marketplace, pick an affordable groom ──────
    // The affordability gate and the debit assertion key off the canonical
    // account balance from the profile endpoint — the SAME value AuthContext
    // surfaces as GroomList's `user.money` and renders as "Your Balance". A
    // freshly-registered E2E user starts with STARTER_MONEY + STARTER_BONUS_COINS
    // = 10,000 coins (server-authoritative; onboarding spends none), so this is
    // ~10,000, not the wrong ~100 a mis-scoped DOM scrape would read.
    const marketplace = await fetchMarketplace(page);
    expect(
      marketplace.grooms.length,
      'live marketplace must offer at least one groom to hire'
    ).toBeGreaterThan(0);

    const balanceBefore = await fetchBalance(page);

    // Cross-check that the DISPLAYED balance matches the authoritative profile
    // value — proves GroomList renders the real balance (not a placeholder) and
    // that the precise locator targets the balance Currency, not a salary/cost
    // span. Polled because the profile query may still be settling into the UI.
    await expect
      .poll(
        async () => {
          const label = (await readBalanceLocator(page).getAttribute('aria-label')) ?? '';
          return parseInt(label.replace(/[^0-9]/g, ''), 10);
        },
        {
          timeout: 15_000,
          message: `displayed "Your Balance" must match the profile balance (${balanceBefore})`,
        }
      )
      .toBe(balanceBefore);

    // Cost = sessionRate × 7 (one week upfront — backend hiringCost rule).
    // Choose the cheapest affordable groom so the test user can actually pay.
    const affordable = marketplace.grooms
      .map((g) => ({ groom: g, cost: g.sessionRate * 7 }))
      .filter(({ cost }) => cost <= balanceBefore)
      .sort((a, b) => a.cost - b.cost);

    expect(
      affordable.length,
      `test user balance (${balanceBefore}) must afford at least one groom; ` +
        `cheapest costs ${Math.min(...marketplace.grooms.map((g) => g.sessionRate * 7))}. ` +
        'Precondition: the E2E user needs enough money to hire one week upfront.'
    ).toBeGreaterThan(0);

    const target = affordable[0];
    const expectedCost = target.cost;

    // ── One click on the chosen groom's Hire button (q230) ─────────────────
    const card = page.locator(`[data-testid="groom-card-${target.groom.marketplaceId}"]`);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // ── Assert the REAL hire POST fires and returns the debit, no dialog ──
    const hireResp: Promise<PWResponse> = page.waitForResponse(
      (r) => r.url().includes(HIRE_POST) && r.request().method() === 'POST',
      { timeout: 20_000 }
    );

    // The card's Hire button has aria-label "Hire <First> <Last>".
    await card
      .getByRole('button', { name: `Hire ${target.groom.firstName} ${target.groom.lastName}` })
      .click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 2_000 });

    const resp = await hireResp;
    expect(resp.status(), `POST ${HIRE_POST} must return 201`).toBe(201);
    const body = await resp.json();
    const hireData = body?.data ?? body;

    // Backend returns the authoritative cost + remainingMoney from the DB tx.
    expect(hireData?.cost, 'hire response must echo the cost').toBe(expectedCost);
    expect(hireData?.remainingMoney, 'remainingMoney must equal balance − cost (real debit)').toBe(
      balanceBefore - expectedCost
    );
    const hiredGroomName = `${target.groom.firstName} ${target.groom.lastName}`;
    expect(hireData?.groom?.name, 'hire response must return the created groom').toBe(
      hiredGroomName
    );
    const hiredGroomId = hireData?.groom?.id;
    expect(hiredGroomId, 'hired groom must have a DB id').toBeTruthy();

    // ── Assert the debit PERSISTED on the real account (authoritative) ─────
    // Re-read the profile endpoint: the DB row must now reflect balance − cost.
    // This is the canonical proof of the real debit, independent of any DOM.
    await expect
      .poll(async () => fetchBalance(page), {
        timeout: 8_000,
        message: `profile balance must persist at ${balanceBefore - expectedCost} after the debit`,
      })
      .toBe(balanceBefore - expectedCost);

    // ── And assert the DISPLAYED balance updated to the debited value ──────
    await expect
      .poll(
        async () => {
          const label = (await readBalanceLocator(page).getAttribute('aria-label')) ?? '';
          return parseInt(label.replace(/[^0-9]/g, ''), 10);
        },
        {
          timeout: 8_000,
          message: `displayed balance must fall to ${balanceBefore - expectedCost}`,
        }
      )
      .toBe(balanceBefore - expectedCost);

    // ── Assert the hired groom is now OWNED by the user (real backend/DB) ──
    // The Manage-tab DOM render of owned grooms is currently blocked by a real
    // beta bug (Equoria-j2a51): GroomsPage passes a NaN userId so
    // MyGroomsDashboard never lists owned grooms, and the raw-id fix crashes
    // that page. Asserting ownership via the real GET /api/v1/grooms/user/:id
    // is an EQUIVALENT real-backend/DB persistence check — not a weaker one;
    // only the Manage-tab DOM assertion is deferred to Equoria-j2a51 (which
    // will add the `groom-card-<id>` UI assertion once the render bug is fixed).
    const profileRes = await page.request.get(PROFILE_GET);
    expect(profileRes.ok(), `GET ${PROFILE_GET} must succeed`).toBe(true);
    const profileJson = await profileRes.json();
    const userId = (
      profileJson?.data?.user ??
      profileJson?.user ??
      profileJson?.data ??
      profileJson
    )?.id;
    expect(userId, 'profile must expose the user id').toBeTruthy();

    const ownedRes = await page.request.get(`/api/v1/grooms/user/${userId}`);
    expect(
      ownedRes.ok(),
      `GET /api/v1/grooms/user/:id must succeed (status ${ownedRes.status()})`
    ).toBe(true);
    const ownedBody = await ownedRes.json();
    const ownedGrooms: Array<{ id?: number; name?: string }> = Array.isArray(ownedBody)
      ? ownedBody
      : (ownedBody?.data ?? ownedBody?.grooms ?? []);
    const ownedMatch = ownedGrooms.find((g) => g.id === hiredGroomId);
    expect(
      ownedMatch,
      `hired groom ${hiredGroomId} (${hiredGroomName}) must be owned by the user (persisted in DB)`
    ).toBeTruthy();

    // ── And the hired groom renders on the Manage tab (Equoria-j2a51) ──────
    // Previously the Manage tab crashed: the real /grooms/user envelope was
    // consumed as an array (finalGrooms.filter → TypeError → ErrorBoundary).
    // With j2a51 fixed (raw userId + array coercion), the real groom now
    // renders as data-testid="groom-card-<id>".
    const manageTab = page.locator('[data-testid="manage-tab"]');
    await expect(manageTab).toBeVisible({ timeout: 10_000 });
    await manageTab.click();
    await expect(page.locator(`[data-testid="groom-card-${hiredGroomId}"]`)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('(b) refreshing the marketplace fires the real refresh mutation with the correct force flag', async ({
    page,
  }) => {
    const marketplaceResp = page.waitForResponse(
      (r) => r.url().includes(MARKETPLACE_GET) && r.request().method() === 'GET',
      { timeout: 20_000 }
    );

    await page.goto('/grooms', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Groom Quarters').first()).toBeVisible({ timeout: 20_000 });

    const hireTab = page.locator('[data-testid="hire-tab"]');
    await expect(hireTab).toBeVisible({ timeout: 15_000 });
    await hireTab.click();
    await expect(hireTab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
    await marketplaceResp.catch(() => {});

    const refreshBtn = page.locator('[data-testid="refresh-button"]');
    await expect(refreshBtn).toBeVisible({ timeout: 15_000 });

    // Read the REAL, server-authoritative refresh state for THIS run.
    const market = await fetchMarketplace(page);

    // Track every refresh POST and the `force` flag it carried so we can prove
    // the real mutation fired with the value the live state dictates.
    const refreshPosts: Array<{ force: unknown }> = [];
    page.on('request', (req) => {
      if (req.url().includes(REFRESH_POST) && req.method() === 'POST') {
        let force: unknown;
        try {
          force = JSON.parse(req.postData() ?? '{}').force;
        } catch {
          force = '<unparsable>';
        }
        refreshPosts.push({ force });
      }
    });

    const anyDialog = page.getByRole('dialog');

    // ── FREE branch first (only if the live window is free): fires the real
    //    POST {force:false} DIRECTLY with NO dialog — AND consumes the free
    //    window so the PAID branch below is deterministically reached every
    //    run, not only when the live state happens to already be paid.
    if (market.canRefreshFree) {
      const freeResp = page.waitForResponse(
        (r) => r.url().includes(REFRESH_POST) && r.request().method() === 'POST',
        { timeout: 20_000 }
      );
      await refreshBtn.click();
      // No dialog on the free branch.
      await expect(anyDialog).toBeHidden({ timeout: 2_000 });
      const resp = await freeResp;
      expect(resp.status(), `free POST ${REFRESH_POST} must return 200`).toBe(200);
      expect(refreshPosts.length, 'exactly one free refresh POST (force:false)').toBe(1);
      expect(refreshPosts[0].force, 'free refresh must send force:false').toBe(false);
      // Wait for the marketplace query to refetch → the window is now PAID.
      await expect
        .poll(async () => (await fetchMarketplace(page)).canRefreshFree, { timeout: 10_000 })
        .toBe(false);
    }

    // ── PAID branch (now guaranteed): the button names its fee, and one
    //    click fires the real POST {force:true} with no dialog (Equoria-1qf9n).
    const paid = await fetchMarketplace(page);
    await expect(refreshBtn).toContainText(`Refresh (${paid.refreshCost.toLocaleString('en-US')}`, {
      timeout: 10_000,
    });
    const before = refreshPosts.length;
    const paidResp = page.waitForResponse(
      (r) => r.url().includes(REFRESH_POST) && r.request().method() === 'POST',
      { timeout: 20_000 }
    );
    await refreshBtn.click();
    await expect(anyDialog).toBeHidden({ timeout: 2_000 });
    const presp = await paidResp;
    expect(presp.status(), `paid POST ${REFRESH_POST} must return 200`).toBe(200);
    expect(refreshPosts.length, 'exactly one paid refresh POST fired').toBe(before + 1);
    expect(refreshPosts[before].force, 'paid refresh must send force:true').toBe(true);
    const pbody = await presp.json();
    const pdata = pbody?.data ?? pbody;
    expect(Array.isArray(pdata?.grooms), 'refresh must return a new grooms array').toBe(true);
    expect(pdata?.refreshCost, 'post-refresh refreshCost resets to 0').toBe(0);
  });

  // Old case (b-cancel): dismissing the hire dialog fired no hire. Owner ruling
  // q230 (2026-10-28) made hiring one click, so there is no dialog to cancel;
  // the refresh has none either (Equoria-1qf9n).
});
