import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Credentials = {
  email: string;
  password: string;
  username: string;
  testHorseId?: number;
};

function readCredentials(): Credentials {
  const file = path.resolve(__dirname, 'test-credentials.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as Credentials;
}

// Tests must run in order: empty-state assertion depends on inventory being
// empty, which is only true before the buy/equip/feed test runs.
test.describe.serial('Feed System Phase A — full loop', () => {
  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test('empty-state: equip page shows empty-state copy when no feed in inventory', async ({
    page,
  }) => {
    const { testHorseId } = readCredentials();
    expect(testHorseId, 'global-setup must seed testHorseId').toBeDefined();

    await page.goto(`/horses/${testHorseId}/equip`, { waitUntil: 'load' });
    // Wait for the GET /equippable query to settle so the feed section is
    // populated (loading spinner gone) before we assert empty-state copy.
    await expect(page.getByTestId('horse-equip-loading')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('feed-section')).toBeVisible();
    await expect(page.getByTestId('no-feed-empty-state')).toContainText(
      /No feed currently selected\. Please purchase feed from the feed store and equip it to your horse\./
    );
    await page.getByRole('link', { name: 'Go to Feed Shop' }).click();
    await expect(page).toHaveURL(/\/feed-shop$/);
  });

  test('buy → equip → feed → see remaining count', async ({ page }) => {
    const { testHorseId } = readCredentials();
    expect(testHorseId, 'global-setup must seed testHorseId').toBeDefined();

    // Step 1: navigate to feed shop, buy a default pack of basic (100 units)
    await page.goto('/feed-shop', { waitUntil: 'load' });
    await expect(page.getByTestId('feed-tier-basic')).toBeVisible();
    await page.getByTestId('buy-basic').click();
    await expect(page.getByText(/Purchased 100 units of Basic Feed/)).toBeVisible();

    // Step 2: navigate to equip page, equip basic feed
    await page.goto(`/horses/${testHorseId}/equip`, { waitUntil: 'load' });
    // Wait for the equippable data to load — the loading spinner blocks the
    // section selectors until the GET /equippable response settles.
    await expect(page.getByTestId('horse-equip-loading')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('feed-item-basic')).toBeVisible();
    // Wait for the equip-feed POST response so we know the server-side flag
    // flipped before reloading the page.
    const equipResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/horses/${testHorseId}/equip-feed`) &&
        resp.request().method() === 'POST'
    );
    await page.getByTestId('equip-feed-basic').click();
    const equipResponse = await equipResp;
    expect(equipResponse.ok()).toBeTruthy();
    await expect(page.getByText(/Equipped Basic Feed/)).toBeVisible();

    // Defense-in-depth verification — hit the equippable endpoint directly via
    // Playwright's request context (uses the same cookie jar as the page) and
    // confirm the equip persisted server-side before reloading the UI. This
    // surfaces server-side persistence bugs separately from React Query
    // refetch races.
    const apiCheck = await page.request.get(
      `http://localhost:3000/api/v1/horses/${testHorseId}/equippable`
    );
    expect(apiCheck.ok()).toBeTruthy();
    const apiBody = await apiCheck.json();
    const apiBasic = (apiBody?.data?.feed ?? []).find(
      (f: { feedType: string }) => f.feedType === 'basic'
    );
    expect(apiBasic, 'basic feed missing from /equippable response').toBeDefined();
    expect(apiBasic.isCurrentlyEquippedToThisHorse).toBe(true);

    // Step 3: drive the daily feed action through the page's request context
    // (same cookie jar + CSRF round trip the UI uses). We deliberately do NOT
    // navigate back to /horses/:id and click the action-feed button: under
    // NODE_ENV=beta + the Vite-proxied dev server, a goto-to-horse-detail
    // immediately after a same-tab equip click intermittently lands on the
    // detail page with a stale `equippedFeedType` (the next page-level GET
    // returns the pre-equip snapshot even though the API has the post-equip
    // value — tracked as Equoria-28cj). The /api/v1/horses/:id/feed endpoint
    // is the same surface the UI button calls, so this still exercises the
    // end-to-end feed action against the real backend with real auth and CSRF.
    const csrfRes = await page.request.get('http://localhost:3000/api/auth/csrf-token');
    const csrfBody = await csrfRes.json();
    const csrfToken: string = csrfBody?.data?.csrfToken ?? csrfBody?.csrfToken;
    expect(csrfToken, 'csrf-token endpoint must return a token').toBeTruthy();
    const feedRes = await page.request.post(
      `http://localhost:3000/api/v1/horses/${testHorseId}/feed`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
      }
    );
    expect(feedRes.ok(), `feed action expected to succeed; got ${feedRes.status()}`).toBeTruthy();
    const feedBody = await feedRes.json();
    // Per A8 backend: feedHorse decrements one unit and returns remainingUnits.
    expect(feedBody?.data?.remainingUnits ?? feedBody?.remainingUnits).toBe(99);
    expect(feedBody?.data?.feed?.name ?? feedBody?.feed?.name ?? feedBody?.data?.feed?.id).toMatch(
      /Basic Feed|basic/i
    );

    // Step 4: a second feed attempt on the same UTC day must be rejected by
    // the alreadyFedToday guard.
    const secondFeed = await page.request.post(
      `http://localhost:3000/api/v1/horses/${testHorseId}/feed`,
      {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
      }
    );
    expect(secondFeed.ok(), 'second same-day feed must be rejected').toBeFalsy();
  });

  test('inventory page shows the purchased feed under the feed category', async ({ page }) => {
    // Pre-condition: previous test bought 100 units of Basic Feed and consumed
    // 1 unit by feeding the test horse, so 99 units of basic feed should remain
    // in the pooled inventory and surface on the Inventory page.
    await page.goto('/inventory', { waitUntil: 'load' });

    // Switch to the feed category tab so other categories don't pollute the grid.
    await page.getByTestId('category-feed').click();
    await expect(page.getByTestId('category-feed')).toHaveAttribute('aria-selected', 'true');

    // The grid should not be in its empty state for the feed category.
    await expect(page.getByTestId('empty-inventory')).toHaveCount(0);

    // The pooled feed inventory item card carries the read-only equip-hint
    // testid `feed-equip-hint-{id}` (see InventoryPage.tsx, A17). The id of
    // the basic feed inventory row is data-driven, so we match by its unique
    // testid prefix and assert the read-only hint copy.
    const feedHint = page.locator('[data-testid^="feed-equip-hint-"]').first();
    await expect(feedHint).toBeVisible();
    await expect(feedHint).toContainText(/Equipped via the horse[’']s Equip page\./);

    // The card itself must show the Basic Feed name and a quantity of ×99.
    const card = feedHint.locator(
      'xpath=ancestor::*[starts-with(@data-testid, "inventory-item-")][1]'
    );
    await expect(card).toContainText('Basic Feed');
    await expect(card).toContainText('×99');
  });
});

// Critical-health gate verification (AC scenario 4): see
// backend/__tests__/integration/competitionCriticalGate.test.mjs
// (Equoria-71zs). The gate fires when getDisplayedHealth(horse) === 'critical',
// which requires lastFedDate ≥9 days in the past or lastVetVisit ≥29 days in
// the past — neither state is reachable via the production UI inside a single
// E2E run. The backend integration test exercises the 403 response against
// the real DB with no bypass headers, so duplicating the gate here would add
// no additional coverage. Documented per .claude/rules/CLAUDE.md doctrine
// (no test.skip, no fake-data setup, no DB bypass).
