/**
 * Celestial Night Feature Pages — E2E Tests
 *
 * Tests that each major Celestial Night feature page loads correctly
 * and renders its key elements. All tests use the authenticated session
 * from global setup (storageState).
 *
 * Pages tested:
 *  - Competition Browser (/competitions)
 *  - Training Dashboard (/training)
 *  - Breeding Hall (/breeding)
 *  - Community Hub (/community)
 *  - Messages (/messages)
 *  - Marketplace (/marketplace)
 *  - Leaderboards (/leaderboards)
 */
import { test, expect } from '@playwright/test';

test.describe('Celestial Night Feature Pages', () => {
  // ── Competition Browser ──────────────────────────────────────────────────
  test('Competition Browser loads and shows heading', async ({ page }) => {
    await page.goto('/competitions', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="competition-browser-page"]')).toBeVisible({
      timeout: 20000,
    });
    // CompetitionBrowserPage PageHero title is "Competition Arena"
    await expect(page.locator('h1')).toContainText('Competition Arena', { timeout: 10000 });
  });

  test('Competition Browser shows filter controls', async ({ page }) => {
    await page.goto('/competitions', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="competition-browser-page"]')).toBeVisible({
      timeout: 20000,
    });

    // CompetitionFilters renders filter select elements or buttons
    // At minimum, a discipline filter should be present
    const hasFilters = await page.locator('select, [role="combobox"]').count();
    const hasFilterText = await page.getByText(/discipline|filter/i).count();
    expect(hasFilters + hasFilterText).toBeGreaterThan(0);
  });

  // ── Training Grounds (formerly "Training Dashboard") ──────────────────
  // Equoria-kn1w: page is /training → TrainingPage.tsx wraps with
  // data-testid="training-page" and renders PageHero title="Training
  // Grounds". The previous spec used the non-existent testid
  // "training-dashboard-page" and asserted heading "Training Dashboard".
  test('Training Dashboard loads with heading', async ({ page }) => {
    await page.goto('/training', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="training-page"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('h1')).toContainText('Training Grounds', { timeout: 15000 });
  });

  test('Training Dashboard shows content area', async ({ page }) => {
    await page.goto('/training', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="training-page"]')).toBeVisible({
      timeout: 20000,
    });

    // Should show "Training Grounds" text within the page
    await expect(page.getByText('Training Grounds').first()).toBeVisible({ timeout: 10000 });
  });

  // ── Breeding Hall ────────────────────────────────────────────────────────
  test('Breeding Hall loads with heading', async ({ page }) => {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    // BreedingPage PageHero title is "Breeding Hall"
    await expect(page.locator('h1')).toContainText('Breeding Hall', { timeout: 15000 });
  });

  test('Breeding Hall shows breeding pair selection', async ({ page }) => {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Breeding Hall', { timeout: 15000 });

    // BreedingPairSelection renders mare/stallion selector cards. Equoria-th9a:
    // the previous assertion looked for tabs/selects from the legacy form-
    // based UI which no longer exists. The current cards picker exposes
    // 'Sire (Stallion)' and 'Dam (Mare)' section labels (BreedingPairSelection
    // .tsx:327, :338).
    const hasTabs = await page.getByText('Sire (Stallion)').count();
    const hasSelects = await page.getByText('Dam (Mare)').count();
    expect(hasTabs + hasSelects).toBeGreaterThan(0);
  });

  // ── Community Hub ────────────────────────────────────────────────────────
  test('Community Hub loads with heading', async ({ page }) => {
    await page.goto('/community', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Community', { timeout: 15000 });
  });

  test('Community Hub shows feature cards linking to sub-pages', async ({ page }) => {
    await page.goto('/community', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Community', { timeout: 15000 });

    // CommunityPage has links to /message-board, /clubs, /messages.
    // Equoria-qolo: previous shape used `.catch(() => false)` to silently
    // swallow visibility failures, so the test could not meaningfully fail
    // even if all three links broke. Wait for the heading first (already done
    // above) so the page has rendered, then synchronously check visibility.
    const messageBoardLink = page.getByRole('link', { name: /Message Board/i }).first();
    const clubsLink = page.getByRole('link', { name: /Clubs/i }).first();
    const messagesLink = page.getByRole('link', { name: /Messages|Inbox/i }).first();

    // Wait for at least one link to attach so the count below reflects
    // rendered state (rather than mid-render).
    await expect(messageBoardLink.or(clubsLink).or(messagesLink).first()).toBeVisible({
      timeout: 10000,
    });

    const visibilityStates = await Promise.all([
      messageBoardLink.isVisible(),
      clubsLink.isVisible(),
      messagesLink.isVisible(),
    ]);
    const visibleCount = visibilityStates.filter(Boolean).length;
    expect(visibleCount).toBeGreaterThanOrEqual(2);
  });

  // ── Messages ─────────────────────────────────────────────────────────────
  test('Messages page loads with heading', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Messages', { timeout: 15000 });
  });

  test('Messages page shows inbox/sent tabs', async ({ page }) => {
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Messages', { timeout: 15000 });

    // MessagesPage renders Inbox and Sent tab buttons.
    // Equoria-qolo: previous shape used `.catch(() => false)` to silently
    // swallow timeouts. Replaced with Locator.or() union which lets the
    // first matching tab pass, and fails loudly with a clear timeout
    // message naming both expected locators if neither is visible.
    const inboxTab = page.getByRole('button', { name: /Inbox/i }).first();
    const sentTab = page.getByRole('button', { name: /Sent/i }).first();

    await expect(inboxTab.or(sentTab).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Marketplace ──────────────────────────────────────────────────────────
  test('Marketplace page loads with heading', async ({ page }) => {
    await page.goto('/marketplace', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Marketplace', { timeout: 15000 });
  });

  // ── Leaderboards ─────────────────────────────────────────────────────────
  test('Leaderboards page loads with heading', async ({ page }) => {
    await page.goto('/leaderboards', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Leaderboards', { timeout: 15000 });
  });

  test('Leaderboards page shows category selector', async ({ page }) => {
    await page.goto('/leaderboards', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Leaderboards', { timeout: 15000 });

    // LeaderboardCategorySelector renders category buttons or tabs
    const hasSelector = await page.locator('select, [role="tablist"], [role="combobox"]').count();
    const hasCategoryText = await page
      .getByText(/top earners|category|all-time/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasSelector > 0 || hasCategoryText).toBeTruthy();
  });
});
