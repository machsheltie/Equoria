/**
 * Feed stat-gain notifications E2E (Equoria-50pn AC-1)
 *
 * Beta-readiness path:
 *  1. Equip a performance+ feed on a test horse.
 *  2. Feed up to 20 times in a row (statRollPct is per-feed, so a stat boost
 *     fires on at least one of those attempts at performance/elite tiers).
 *  3. Assert that AT LEAST ONE feed response carries a non-null statBoost.
 *  4. Assert MainNavigation bell renders notification-dot.
 *  5. Open Messages page → click Notifications tab → row(s) render.
 *  6. Assert PATCH /api/v1/users/me/game-notifications/read-all fires AND
 *     bell dot clears.
 *
 * No bypass headers. No test.skip. Real backend, real DB.
 */

import { test, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';

test.describe.serial('Feed stat-gain notifications — end-to-end (Equoria-50pn)', () => {
  let session: AuthedSession;
  let horseId: number;
  let horseName: string;

  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    session = await createAuthedSession(browser);

    const suffix = Date.now();
    horseName = `StatGainNotif-${suffix}`;

    // Resolve a real breedId (auto-incremented; never assume 1).
    let breedId = 1;
    const breedsRes = await session.request.get('/api/breeds');
    if (breedsRes.ok()) {
      const json = (await breedsRes.json()) as
        | { data?: Array<{ id: number }> }
        | Array<{ id: number }>;
      const breeds = Array.isArray(json)
        ? json
        : ((json as { data?: Array<{ id: number }> })?.data ?? []);
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Create a 5yo test horse (adult; trainable; feedable).
    const horseRes = await csrfMutate(session, 'POST', '/api/horses', {
      name: horseName,
      breedId,
      age: 5,
      sex: 'mare',
    });
    if (!horseRes.ok()) {
      throw new Error(`Horse creation failed: ${horseRes.status()} ${await horseRes.text()}`);
    }
    const horseJson = (await horseRes.json()) as { data: { id: number } };
    horseId = horseJson.data.id;
    console.log(`Created test horse id=${horseId} name=${horseName}`);

    // Buy enough performance feed for ~20 feeds.
    // 1 pack = 100 units; one pack covers 20 feeds easily.
    const buyRes = await csrfMutate(session, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: 'performance',
      packs: 1,
    });
    if (!buyRes.ok()) {
      console.warn(
        `Feed purchase returned ${buyRes.status()} — test may fail if performance feed unavailable`
      );
    }

    // Equip performance feed.
    const equipRes = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/equip-feed`, {
      feedType: 'performance',
    });
    if (!equipRes.ok()) {
      throw new Error(`Equip feed failed: ${equipRes.status()} ${await equipRes.text()}`);
    }
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

  test('feed loop yields stat_gain notification + bell dot clears after mark-read', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Step 1 — feed up to 20 times via API, watching for any statBoost.
    // Each feed call sets lastFedDate=today; reset-last-fed lets us do back-to-back
    // feeds within one test run. statRollPct for performance is non-zero so at
    // least one of 20 attempts should fire a stat_gain notification.
    let statBoostFired = false;
    let attempts = 0;
    while (attempts < 20 && !statBoostFired) {
      // Rewind lastFedDate by 1 day so the next feed proceeds.
      if (attempts > 0) {
        const resetRes = await csrfMutate(
          session,
          'POST',
          `/api/v1/horses/${horseId}/reset-last-fed`,
          { days: 1 }
        );
        expect(resetRes.ok(), `reset-last-fed failed at attempt ${attempts}`).toBeTruthy();
      }

      const feedRes = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/feed`);
      expect(feedRes.ok(), `feed attempt ${attempts} failed: ${feedRes.status()}`).toBeTruthy();

      const feedJson = (await feedRes.json()) as {
        data?: { statBoost?: { stat: string; amount: number } | null };
        statBoost?: { stat: string; amount: number } | null;
      };
      const statBoost = feedJson?.data?.statBoost ?? feedJson?.statBoost;
      if (statBoost) {
        statBoostFired = true;
        console.log(`Stat boost fired on attempt ${attempts + 1}:`, statBoost);
      }
      attempts++;
    }

    expect(
      statBoostFired,
      `No stat_gain fired in ${attempts} performance feeds — statRollPct may have regressed`
    ).toBe(true);

    // Step 2 — visit any authed page so MainNavigation mounts and the bell
    // fetches /api/v1/users/me/game-notifications.
    await page.goto('/', { waitUntil: 'load' });

    // Step 3 — assert bell shows notification-dot.
    await expect(page.getByTestId('notification-indicator')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('notification-dot')).toBeVisible({ timeout: 15_000 });

    // Step 4 — navigate to Messages, switch to Notifications tab.
    await page.goto('/messages', { waitUntil: 'load' });
    await page.getByTestId('tab-notifications').click();
    await expect(page.getByTestId('tab-notifications')).toHaveAttribute('aria-selected', 'true');

    // Step 5 — at least one game-notif-* row must be present for this horse.
    // The row testid is `game-notif-<id>` so we use a regex on data-notif-type.
    const statGainRows = page.locator('[data-notif-type="stat_gain"]');
    await expect(statGainRows.first()).toBeVisible({ timeout: 15_000 });
    // The row must mention the horse we fed.
    const matching = page.locator('[data-notif-type="stat_gain"]', { hasText: horseName });
    await expect(matching.first()).toBeVisible({ timeout: 15_000 });

    // Step 6 — assert PATCH /game-notifications/read-all fired and bell clears.
    // The mark-read mutation fires inside the useEffect at MessagesPage.tsx:96-100
    // when the user activates the notifications tab with unreadCount > 0.
    // We wait for the network call AFTER the tab click — but we already clicked
    // above. So we listen for the response and re-trigger by clicking inbox
    // then notifications again. Easier: wait for the next read-all PATCH after
    // we re-trigger via a navigation back-and-forth.
    const markReadPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/me/game-notifications/read-all') &&
        resp.request().method() === 'PATCH',
      { timeout: 20_000 }
    );
    // Click inbox tab then notifications tab again to ensure the effect runs.
    await page.getByTestId('tab-inbox').click();
    await page.getByTestId('tab-notifications').click();
    const markReadResp = await markReadPromise;
    expect(markReadResp.ok()).toBeTruthy();

    // Step 7 — bell dot should clear after mark-read.
    // Re-navigate so MainNavigation re-fetches game-notifications.
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByTestId('notification-indicator')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('notification-dot')).toHaveCount(0, { timeout: 15_000 });
  });

  test('UI feed click renders sonner toast with "+1 [Stat]!" suffix on stat_gain (Equoria-ap38)', async ({
    page,
  }) => {
    // E2E coverage replacing deleted vi.mock unit test
    // (frontend/src/pages/__tests__/HorseDetailPage.feed-toast.test.tsx,
    // Equoria-ap38 sentinel). The unit test locked the merged-toast text format
    // 'Fed [Name] with [Feed]. [N] units left. +1 [Stat]!' at
    // HorseActionBar.tsx:60-66. This UI-driven path proves the production toast
    // string matches that format AND, on a non-stat-gain feed, has no suffix.
    test.setTimeout(180_000);

    // Make sure the test horse can be fed via the UI.
    const resetRes = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/reset-last-fed`, {
      days: 1,
    });
    expect(resetRes.ok(), 'reset-last-fed failed before UI feed').toBeTruthy();

    // Navigate to the horse detail page and wait for the action bar to mount.
    await page.goto(`/horses/${horseId}`, { waitUntil: 'load' });
    await expect(page.getByTestId('horse-action-bar')).toBeVisible({ timeout: 15_000 });
    const feedButton = page.getByTestId('action-feed');
    await expect(feedButton).toBeEnabled({ timeout: 15_000 });

    // sonner renders toasts as [data-sonner-toast] elements in a portal.
    // We loop UI feeds (resetting last-fed each round) up to 20 times until
    // we catch a stat-gain toast — same statRollPct assumption the API loop
    // above relies on.
    let statGainToastCaptured = false;
    let lastNonGainText: string | null = null;
    const toastLocator = page.locator('[data-sonner-toast]');

    for (let i = 0; i < 20 && !statGainToastCaptured; i++) {
      if (i > 0) {
        const r = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/reset-last-fed`, {
          days: 1,
        });
        expect(r.ok(), `reset-last-fed failed at UI attempt ${i}`).toBeTruthy();
        // Reload so the page picks up the reset lastFedDate and re-enables the button.
        await page.reload({ waitUntil: 'load' });
        await expect(page.getByTestId('action-feed')).toBeEnabled({ timeout: 15_000 });
      }

      await page.getByTestId('action-feed').click();

      // Wait for at least one toast to appear after the click.
      await expect(toastLocator.first()).toBeVisible({ timeout: 15_000 });
      // Grab the most recently rendered toast's text content.
      const count = await toastLocator.count();
      const latestText = (await toastLocator.nth(count - 1).innerText()).trim();

      // Production format from HorseActionBar.tsx:60-66:
      //   `Fed ${name} with ${feedName}. ${remaining} units left.${statSuffix}`
      // where statSuffix is ' +1 [Stat]!' when statBoost present, '' otherwise.
      expect(latestText).toContain(`Fed ${horseName}`);
      expect(latestText).toMatch(/\d+ units left\./);

      if (/\+1 [A-Z][a-z]+!/.test(latestText)) {
        // Stat-gain branch: capitalized stat name, full AC text.
        // e.g. "Fed StatGainNotif-... with Performance Feed. 12 units left. +1 Speed!"
        expect(latestText).toMatch(
          new RegExp(`Fed ${horseName} with .+\\. \\d+ units left\\. \\+1 [A-Z][a-z]+!$`)
        );
        statGainToastCaptured = true;
      } else {
        // No-stat-gain branch: must NOT contain any '+1' substring.
        expect(latestText).not.toMatch(/\+1/);
        // Must end exactly at "units left." with no trailing suffix.
        expect(latestText).toMatch(new RegExp(`Fed ${horseName} with .+\\. \\d+ units left\\.$`));
        lastNonGainText = latestText;
      }

      // Dismiss/wait for the toast to clear before the next iteration so we
      // don't read a stale toast in the next loop. Sonner auto-dismisses
      // (3000ms no-gain, 5000ms gain) — wait until the count drops back to 0.
      await expect(toastLocator).toHaveCount(0, { timeout: 10_000 });
    }

    expect(
      statGainToastCaptured,
      `No stat-gain toast captured in 20 UI feeds — statRollPct may have regressed ` +
        `(non-gain sample: ${lastNonGainText ?? 'none'})`
    ).toBe(true);
  });
});
