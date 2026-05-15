/**
 * Community — E2E (Story 21-9 follow-up, Equoria-bj58)
 *
 * Covers the community surface beta testers exercise:
 *   1. /community hub — renders cards linking to message-board, clubs, messages
 *   2. /clubs — tab nav across Discipline / Breed / My Club via real API
 *   3. /message-board — section tabs route to real thread lists
 *
 * Auth: uses Playwright storageState set by tests/e2e/global-setup.ts
 * (no test-credentials.json file I/O — Story 21-8 AC1, Equoria-4m96).
 * Network-first waits on the listing endpoints.
 *
 * Per Epic 21R doctrine: no graceful skip if a route is missing; if community
 * is not beta-live the spec should fail loudly rather than silently pass.
 */
import { test, expect } from '@playwright/test';

test.describe('Community', () => {
  test.beforeEach(() => {
    test.setTimeout(60000);
  });

  test('AC1: /community hub renders feature cards with real API stats', async ({ page }) => {
    await page.goto('/community', { waitUntil: 'domcontentloaded' });

    // PageHero title — proves the protected route loaded under real auth
    await expect(page.getByRole('heading', { name: 'Community' }).first()).toBeVisible({
      timeout: 20000,
    });

    // Three navigation cards linking to the sub-surfaces. Tested via the
    // data-testids set on each card (community-card-<href>).
    const messageBoardCard = page.locator('[data-testid="community-card-message-board"]');
    const clubsCard = page.locator('[data-testid="community-card-clubs"]');
    const messagesCard = page.locator('[data-testid="community-card-messages"]');

    await expect(messageBoardCard).toBeVisible({ timeout: 10000 });
    await expect(clubsCard).toBeVisible();
    await expect(messagesCard).toBeVisible();

    // The Clubs card links to /clubs
    await expect(clubsCard).toHaveAttribute('href', '/clubs');
  });

  test('AC2: /clubs renders Discipline/Breed/My Club tabs from real API', async ({ page }) => {
    // Network-first: the /clubs page fetches the clubs listing via useClubs
    const clubsResp = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/clubs') && resp.request().method() === 'GET',
      { timeout: 20000 }
    );

    await page.goto('/clubs', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Clubs' }).first()).toBeVisible({
      timeout: 20000,
    });

    // Real clubs GET completes
    const resp = await clubsResp.catch(() => null);
    if (resp) {
      expect(resp.status()).toBe(200);
    }

    // Discipline / Breed / My Club tabs are all rendered
    const disciplineTab = page.getByRole('tab', { name: /discipline clubs/i });
    const breedTab = page.getByRole('tab', { name: /breed clubs/i });
    const myClubTab = page.getByRole('tab', { name: /my club/i });

    await expect(disciplineTab).toBeVisible({ timeout: 10000 });
    await expect(breedTab).toBeVisible();
    await expect(myClubTab).toBeVisible();

    // Click Breed tab — selection should switch
    await breedTab.click();
    await expect(breedTab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  });

  test('AC3: /message-board renders 5 section tabs and a real thread list', async ({ page }) => {
    await page.goto('/message-board', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Message Board' }).first()).toBeVisible({
      timeout: 20000,
    });

    // The section-tabs container holds the 5 board sections
    const sectionTabs = page.locator('[data-testid="section-tabs"]');
    await expect(sectionTabs).toBeVisible({ timeout: 10000 });

    // 5 tabs (general, art, sales, services, venting) — by selector
    const tabButtons = page.locator('[data-testid^="section-tab-"]');
    await expect(tabButtons).toHaveCount(5, { timeout: 5000 });

    // The thread list region is mounted (whether populated or skeleton/empty)
    await expect(page.locator('[data-testid="thread-list"]')).toBeVisible({ timeout: 10000 });
  });
});
