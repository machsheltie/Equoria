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

    // Navigate away then back so useEquippable runs a fresh GET — page.reload()
    // sometimes hits the bfcache and skips the new request.
    await page.goto(`/horses/${testHorseId}`, { waitUntil: 'load' });
    // Pre-arm response listener so we don't miss the GET that fires on mount.
    const equippableResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/horses/${testHorseId}/equippable`) &&
        resp.request().method() === 'GET' &&
        resp.status() === 200,
      { timeout: 15_000 }
    );
    await page.goto(`/horses/${testHorseId}/equip`, { waitUntil: 'load' });
    await equippableResp;
    await expect(page.getByTestId('horse-equip-loading')).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByTestId('equipped-feed-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('equipped-feed-name')).toHaveText('Basic Feed', {
      timeout: 10_000,
    });

    // Step 3: navigate to horse detail, click Feed
    await page.goto(`/horses/${testHorseId}`, { waitUntil: 'load' });
    await expect(page.getByTestId('action-feed')).toBeEnabled();
    await page.getByTestId('action-feed').click();
    await expect(page.getByText(/Fed .+ with Basic Feed\. 99 units left/)).toBeVisible();

    // Step 4: clicking Feed again should be disabled (already fed today).
    // The button rerenders disabled after lastFedDate updates; allow up to 5s
    // for react-query cache invalidation + rerender.
    await expect(page.getByTestId('action-feed')).toBeDisabled({ timeout: 5000 });
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
