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
import { seedOwnedHorse } from './fixtures/ownedHorses';
import { markHorseFedTwoDaysAgo } from './fixtures/feedHistory';

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
    const breedsRes = await session.request.get('/api/v1/breeds');
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

    // Seed a 5yo test horse (adult; trainable; feedable).
    // Equoria-6p398.2 (audit Finding 2): POST /api/v1/horses handed any player
    // a free horse and is now closed (403). Seed from this process through the
    // real createHorse model function; the equip/feed/notification behaviour
    // this spec asserts still runs over the real HTTP routes.
    const horse = await seedOwnedHorse(
      session,
      {
        breedId,
        name: horseName,
        sex: 'mare',
        age: 5,
      },
      // The horse is reached through the UNCACHED detail route
      // (GET /horses/:id); the other surfaces this spec asserts on are the
      // notification bell and /messages. It never renders the cached horse
      // list, so it stays on the shared global-setup account.
      { requireHorseListVisibility: false }
    );
    horseId = horse.id;
    console.log(`Seeded test horse id=${horseId} name=${horseName}`);

    // Buy enough performance feed for both loops below: up to
    // statGainApiFeedLimit (132) API feeds plus up to 20 UI feeds = 152 units.
    // 1 pack = 100 units, so two packs. Running out mid-loop would clear the
    // equipped feed and fail a feed for the wrong reason.
    const buyRes = await csrfMutate(session, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: 'performance',
      packs: 2,
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

  test('feed loop yields statGain notification + bell dot clears after mark-read', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Step 1 — feed via API until a statBoost fires, at most
    // statGainApiFeedLimit times. Each feed call sets lastFedDate=today; the
    // feedHistory fixture backdates it in the test database between feeds
    // (Equoria-mwjst — no production route may rewind it).
    //
    // Why 132 (Equoria-7i4cw, owner ruling 2026-10-23: flaky tests may be made
    // deterministic, never weaker): Performance Feed rolls a stat 10% of the
    // time and no deterministic seam reaches the HTTP route (feedHorse's rng
    // argument is in-process only). With 20 tries the loop missed every roll
    // 0.9^20 = 12% of the time; with 132 it misses 0.9^132 = 9.1e-7. The loop
    // still stops at the first gain (about 10 feeds on average), and a
    // statRollPct of 0 still fails every time.
    const statGainApiFeedLimit = 132;
    let statBoostFired = false;
    let attempts = 0;
    while (attempts < statGainApiFeedLimit && !statBoostFired) {
      // Give the horse earlier feeding history so the next feed proceeds.
      if (attempts > 0) {
        await markHorseFedTwoDaysAgo(horseId);
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
      `No statGain fired in ${attempts} performance feeds — statRollPct may have regressed`
    ).toBe(true);

    // Step 2 — visit any authed page so MainNavigation mounts and the bell
    // fetches /api/v1/users/me/game-notifications.
    await page.goto('/', { waitUntil: 'load' });

    // Step 3 — assert bell shows notification-dot.
    await expect(page.getByTestId('notification-indicator')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('notification-dot')).toBeVisible({ timeout: 15_000 });

    // Step 4 — navigate to Messages, switch to Notifications tab.
    // Equoria-c2erw: the mark-read PATCH is armed HERE, before the activation
    // that triggers it. MessagesPage.tsx:124-128 fires markGameReadMutate()
    // only while `gameUnreadCount > 0`, so the FIRST activation of the
    // notifications tab consumes the unread batch. The old step 6 listened for
    // a SECOND PATCH after toggling inbox -> notifications again; by then the
    // count was already 0 and no request was ever made, so the listener always
    // timed out. Same contract, same strength — a real read-all PATCH must fire
    // when the player opens the notifications tab with unread game news — only
    // now it is observed on the activation that actually causes it.
    const markReadPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/me/game-notifications/read-all') &&
        resp.request().method() === 'PATCH',
      { timeout: 20_000 }
    );
    await page.goto('/messages', { waitUntil: 'load' });
    await page.getByTestId('tab-notifications').click();
    await expect(page.getByTestId('tab-notifications')).toHaveAttribute('aria-selected', 'true');

    // Step 5 — at least one game-notif-* row must be present for this horse.
    // The row testid is `game-notif-<id>` so we use a regex on data-notif-type.
    const statGainRows = page.locator('[data-notif-type="statGain"]');
    await expect(statGainRows.first()).toBeVisible({ timeout: 15_000 });
    // The row must mention the horse we fed.
    const matching = page.locator('[data-notif-type="statGain"]', { hasText: horseName });
    await expect(matching.first()).toBeVisible({ timeout: 15_000 });

    // Step 6 — the PATCH /game-notifications/read-all armed in step 4 must have
    // fired (wired to the tab activation) and must have succeeded.
    const markReadResp = await markReadPromise;
    expect(markReadResp.ok()).toBeTruthy();

    // Step 7 — bell dot should clear after mark-read.
    // Re-navigate so MainNavigation re-fetches game-notifications.
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByTestId('notification-indicator')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('notification-dot')).toHaveCount(0, { timeout: 15_000 });
  });

  test('UI feed click shows a "+1 [Stat]" gain on the page and in a new notification (Equoria-ap38)', async ({
    page,
  }) => {
    // E2E coverage replacing deleted vi.mock unit test
    // (frontend/src/pages/__tests__/HorseDetailPage.feed-toast.test.tsx,
    // Equoria-ap38 sentinel). Old contract: a sonner toast reading
    // 'Fed [Name] with [Feed]. [N] units left. +1 [Stat]!'. Owner ruling q173
    // (Equoria-7i4cw) removed every pop-up: the page itself changes. So a UI
    // feed click must now (a) succeed for THIS horse with the equipped feed,
    // (b) on a stat gain raise exactly that stat's number on the horse page by
    // exactly 1 and leave the others alone, and (c) add a NEW stat-gain
    // notification for this horse reading '+1 [Stat] from [Feed]'. On a feed
    // without a gain, no stat number on the page may change.
    test.setTimeout(180_000);

    // Make sure the test horse can be fed via the UI (test-database fixture).
    await markHorseFedTwoDaysAgo(horseId);

    // Stat-gain notifications that already exist (the API loop above made at
    // least one for this horse) — the one this test finds must be new.
    const notifsBeforeRes = await session.request.get('/api/v1/users/me/game-notifications');
    expect(notifsBeforeRes.ok()).toBeTruthy();
    const notifsBefore = (
      (await notifsBeforeRes.json()) as {
        data: { notifications: Array<{ id: string | number; type: string }> };
      }
    ).data.notifications;
    const priorStatGainIds = notifsBefore.filter((n) => n.type === 'statGain').map((n) => n.id);

    // Navigate to the horse detail page and wait for the action bar to mount.
    await page.goto(`/horses/${horseId}`, { waitUntil: 'load' });
    await expect(page.getByTestId('horse-action-bar')).toBeVisible({ timeout: 15_000 });
    const feedButton = page.getByTestId('action-feed');
    await expect(feedButton).toBeEnabled({ timeout: 15_000 });

    // The twelve stat numbers in the horse page's quick-stats summary.
    const statValues = page.locator('[data-testid^="horse-quick-stat-"]');
    const readStats = async (): Promise<Record<string, number>> =>
      Object.fromEntries(
        await statValues.evaluateAll((els) =>
          els.map((el) => [
            (el.getAttribute('data-testid') ?? '').replace('horse-quick-stat-', ''),
            Number((el.textContent ?? '').trim()),
          ])
        )
      );

    // We loop UI feeds (resetting last-fed each round) up to 20 times until a
    // feed rolls a stat gain — same statRollPct assumption the API loop above
    // relies on.
    let gain: { stat: string; feedName: string } | null = null;
    let nonGainFeeds = 0;

    for (let i = 0; i < 20 && !gain; i++) {
      if (i > 0) {
        await markHorseFedTwoDaysAgo(horseId);
        // Reload so the page picks up the backdated lastFedDate and re-enables the button.
        await page.reload({ waitUntil: 'load' });
        await expect(page.getByTestId('action-feed')).toBeEnabled({ timeout: 15_000 });
      }

      await expect(statValues).toHaveCount(12, { timeout: 15_000 });
      const statsBefore = await readStats();
      for (const [name, value] of Object.entries(statsBefore)) {
        expect(Number.isInteger(value), `stat ${name} reads ${value}`).toBe(true);
      }

      const feedResp = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/v1/horses/${horseId}/feed`) &&
          resp.request().method() === 'POST'
      );
      await page.getByTestId('action-feed').click();
      const feedResponse = await feedResp;
      expect(feedResponse.ok()).toBeTruthy();
      const feedJson = (await feedResponse.json()) as {
        message: string;
        data: {
          feed: { name: string };
          remainingUnits: number;
          statBoost: { stat: string; amount: number } | null;
        };
      };
      // The feed ran for THIS horse with the equipped feed and reported stock.
      expect(feedJson.message).toBe(`Fed ${horseName} with ${feedJson.data.feed.name}.`);
      expect(Number.isInteger(feedJson.data.remainingUnits)).toBe(true);

      const boost = feedJson.data.statBoost;
      if (boost) {
        // Stat-gain branch: exactly +1, to one of the page's twelve stats.
        expect(boost.amount).toBe(1);
        expect(Object.keys(statsBefore)).toContain(boost.stat);
        // The page itself changes: that stat's number rises by exactly 1 ...
        await expect(page.getByTestId(`horse-quick-stat-${boost.stat}`)).toHaveText(
          String(statsBefore[boost.stat] + 1),
          { timeout: 15_000 }
        );
        // ... and no other stat moves.
        expect(await readStats()).toEqual({
          ...statsBefore,
          [boost.stat]: statsBefore[boost.stat] + 1,
        });
        gain = { stat: boost.stat, feedName: feedJson.data.feed.name };
      } else {
        // No-stat-gain branch: no stat number on the page changes.
        expect(await readStats()).toEqual(statsBefore);
        nonGainFeeds++;
      }
    }

    expect(
      gain,
      `No stat gain in 20 UI feeds (${nonGainFeeds} without a gain) — statRollPct may have regressed`
    ).not.toBeNull();

    // The "+1 [Stat]" words the old pop-up printed now arrive as a NEW
    // stat-gain notification for this horse: '+1 Speed from Performance Feed'.
    const statLabel = gain!.stat.charAt(0).toUpperCase() + gain!.stat.slice(1);
    const newRowSelector =
      '[data-notif-type="statGain"]' +
      priorStatGainIds.map((id) => `:not([data-testid="game-notif-${id}"])`).join('');
    await page.goto('/messages', { waitUntil: 'load' });
    await page.getByTestId('tab-notifications').click();
    await expect(page.getByTestId('tab-notifications')).toHaveAttribute('aria-selected', 'true');
    const newGainRow = page.locator(newRowSelector, { hasText: horseName });
    await expect(newGainRow).toHaveCount(1, { timeout: 15_000 });
    await expect(newGainRow).toContainText(`+1 ${statLabel} from ${gain!.feedName}`);
  });
});
