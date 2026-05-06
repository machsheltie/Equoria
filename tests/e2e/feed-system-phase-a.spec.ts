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
    // Equoria-916z: bump feed-section visibility timeout from default 5s to
    // 15s. Under CI Redis-reconnect contention the React Query settles
    // slower than 5s — same hydration-window root cause as iiiz nav-structure.
    await expect(page.getByTestId('horse-equip-loading')).toHaveCount(0, { timeout: 15_000 });
    // Bumped to 30s — first visit to /horses/{id}/equip in CI under Vite
    // dev-mode + Redis-reconnect contention takes 15s+ on cold mount; retries
    // pass in <2s. 30s makes the first attempt deterministically pass.
    await expect(page.getByTestId('feed-section')).toBeVisible({ timeout: 30_000 });
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

    // Step 3: navigate to horse detail and use the Feed button — the real UI
    // flow. Equoria-28cj fix: useEquipFeed.onSuccess now writes equippedFeedType
    // directly into the React Query cache so the detail page sees the correct
    // value on load without racing the Prisma commit window through Vite proxy.
    await page.goto(`/horses/${testHorseId}`, { waitUntil: 'load' });
    const feedButton = page.getByTestId('action-feed');
    // Wait for horse data to hydrate and button to become enabled.
    // equippedFeedType='basic' is in the RQ cache from the equip step above.
    await expect(feedButton).toBeEnabled({ timeout: 15_000 });
    await feedButton.click();
    // Success toast: "Fed [name] with Basic Feed. 99 units left."
    await expect(page.getByText(/99 units left/)).toBeVisible({ timeout: 10_000 });

    // Step 4: after feeding, the action-feed button must be disabled for the
    // rest of the UTC day. useFeedHorse.onSuccess (Equoria-28cj follow-up)
    // writes lastFedDate directly into ['horses', horseId] via setQueryData, so
    // the isAlreadyFedToday check in HorseDetailPage disables the button
    // immediately without a background-GET race.
    await expect(feedButton).toBeDisabled({ timeout: 5_000 });
  });

  test('inventory page shows the purchased feed under the feed category', async ({ page }) => {
    // Pre-condition: previous test bought 100 units of Basic Feed and consumed
    // 1 unit by feeding the test horse, so 99 units of basic feed should remain
    // in the pooled inventory and surface on the Inventory page.
    await page.goto('/inventory', { waitUntil: 'load' });

    // Switch to the feed category tab so other categories don't pollute the grid.
    // Inventory uses FantasyTabs which exposes Radix role="tab" — match by name.
    const feedTab = page.getByRole('tab', { name: /^feed$/i });
    await feedTab.click();
    await expect(feedTab).toHaveAttribute('data-state', 'active');

    // The grid should not be in its empty state for the feed category.
    await expect(page.getByTestId('empty-inventory')).toHaveCount(0);

    // The pooled feed inventory item card carries the testid
    // `inventory-item-{id}` (InventoryPage.tsx:164). Match by testid prefix
    // and assert at least one feed-category row is rendered. Bumped timeout
    // to 15s for CI Redis-reconnect contention.
    const feedItem = page.locator('[data-testid^="inventory-item-"]').first();
    await expect(feedItem).toBeVisible({ timeout: 15_000 });
    await expect(feedItem).toContainText(/Equipped via the horse[‘’]s Equip page\./);

    // The card itself must show the Basic Feed name and a quantity of ×99.
    const card = feedItem.locator(
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
