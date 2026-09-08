import { test as base, expect } from '@playwright/test';
import { csrfMutate } from './helpers/api';
import { seedOwnedHorses } from './fixtures/ownedHorses';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';

/**
 * Story 21-4 AC2/AC3/AC5 (Equoria-xxm3): browser console + pageerror
 * listeners are wired through a Playwright fixture so they (a) register
 * before any test code runs, (b) flow output into test.info() / attachments
 * instead of console.log noise, (c) survive test isolation cleanly.
 *
 * Debug console.log statements that used to live in beforeAll (printing
 * breedId, created horse names) are removed — Playwright's annotation API
 * (test.info().annotations) is the canonical channel for that information.
 */
const test = base.extend<{ browserConsole: void }, { seededPlayer: SeededPlayerSession }>({
  browserConsole: [
    async ({ page }, use, testInfo) => {
      const consoleLines: string[] = [];
      const errorLines: string[] = [];

      page.on('console', (msg) => {
        consoleLines.push(`[${msg.type()}] ${msg.text()}`);
      });
      page.on('pageerror', (err) => {
        errorLines.push(err.stack ?? err.message);
      });

      await use();

      if (consoleLines.length > 0) {
        await testInfo.attach('browser-console', {
          body: consoleLines.join('\n'),
          contentType: 'text/plain',
        });
      }
      if (errorLines.length > 0) {
        await testInfo.attach('browser-pageerror', {
          body: errorLines.join('\n\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
  // Equoria-gf4kd: BreedingPairSelection renders the CACHED horse list
  // (horsesApi.list -> GET /api/v1/horses, 120s per-user cache that nothing on
  // this branch can invalidate). The browser must therefore be the same
  // cold-key player the beforeAll seeds into, not the shared global-setup
  // account whose list key global-setup necessarily warms. See
  // tests/e2e/fixtures/seededPlayer.ts.
  //
  // WORKER-scoped, and `storageState` is derived from it, so Playwright builds
  // the player in dependency order. It cannot be created in beforeAll: the auto
  // `browserConsole` fixture above depends on `page`, which pulls
  // `context` -> `storageState` in BEFORE beforeAll runs.
  seededPlayer: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
  storageState: async ({ seededPlayer }, use) => {
    await use(seededPlayer.storageStatePath);
  },
});

test.describe('Breeding Loop', () => {
  let stallionName: string;
  let mareName: string;

  test.beforeEach(async () => {
    test.setTimeout(90000);
  });

  // Equoria-oua3: bare worker-scope `request` does NOT inherit project
  // storageState, so its POSTs land at the backend without auth and 401.
  // `seededPlayer` is a freshly registered and onboarded player created over
  // the real API with no page load, so the backend has never cached a horse
  // list for it, and its request context carries that player's cookies + CSRF
  // token. `storageState` above puts the browser on the SAME player, so the
  // pair seeded below is in the very first list the page reads.
  test.beforeAll(async ({ seededPlayer: session }) => {
    // Use a timestamp suffix so re-runs don't collide on duplicate horse names.
    const suffix = Date.now();
    stallionName = `E2E Stallion ${suffix}`;
    mareName = `E2E Mare ${suffix}`;

    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
    let breedId = 1;
    const breedsRes = await session.request.get('/api/v1/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Equoria-6p398.2 (audit Finding 2): these parents used to come from
    // POST /api/v1/horses, which handed any player a free horse and is now
    // closed (403). The pair needs EXACT names (the UI selects horses by name)
    // and a stallion/mare at or above the 3-game-year breeding minimum, which
    // no player-facing route provides — the Horse Trader names its own horses.
    // Seed from this process through the real createHorse model function.
    // Both in ONE call: the fixture waits once for the pair to become visible
    // in the browser's horse list (BreedingPairSelection reads that list), and
    // seeding sequentially would make the second call wait out the cache entry
    // the first one just wrote. See tests/e2e/fixtures/ownedHorses.ts.
    const [seededStallion, seededMare] = await seedOwnedHorses(session, [
      { breedId, name: stallionName, sex: 'stallion', age: 5 },
      { breedId, name: mareName, sex: 'mare', age: 5 },
    ]);

    // Feed both parents before breeding (Equoria-6w3ur).
    //
    // The critical-health gate in POST /horses/foals (Equoria-2e7e) uses
    // getDisplayedHealth() = worseOf(feedHealth, vetHealth), and a horse with
    // lastFedDate = null has feedHealth 'critical' no matter what healthStatus
    // says. Freshly seeded horses have never been fed, so this pair was ALWAYS
    // going to be refused — the old request-shape 400 just short-circuited the
    // request before the gate could speak. Fixing the payload made the gate
    // reachable, so the fixture now has to do what a real player does: buy
    // feed, equip it, feed each horse. Same sequence as
    // tests/e2e/feed-system-phase-b.spec.ts and the readiness spec; real routes
    // throughout, no fixture shortcut into the fed state.
    const purchase = await csrfMutate(session, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: 'basic',
      packs: 1,
    });
    if (!purchase.ok()) {
      throw new Error(`Feed purchase failed (${purchase.status()}): ${await purchase.text()}`);
    }
    for (const horseId of [seededStallion.id, seededMare.id]) {
      const equip = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/equip-feed`, {
        feedType: 'basic',
      });
      if (!equip.ok()) {
        throw new Error(
          `Equip-feed for horse ${horseId} failed (${equip.status()}): ${await equip.text()}`
        );
      }
      const feed = await csrfMutate(session, 'POST', `/api/v1/horses/${horseId}/feed`);
      if (!feed.ok()) {
        throw new Error(
          `Feed for horse ${horseId} failed (${feed.status()}): ${await feed.text()}`
        );
      }
    }
  });

  // No afterAll context close: the worker-scoped `seededPlayer` fixture owns
  // that context and closes it during worker teardown.

  // Equoria-scmq: rewritten against the cards-based BreedingPairSelection UI.
  // The previous test used select#damId / select#sireId which no longer exist.
  // Current UI: HorseSelector component with aria-label="Select {horse.name}"
  // on each horse card button; two panels — "Sire (Stallion)" and "Dam (Mare)".
  test('breeding page loads with sire and dam selectors', async ({ page }) => {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    // Wait for the two HorseSelector panels — BreedingPairSelection renders no h1
    await expect(page.getByText('Sire (Stallion)').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Dam (Mare)').first()).toBeVisible({ timeout: 10000 });

    // The E2E stallion created in beforeAll must appear in the sire panel
    await expect(page.getByRole('button', { name: `Select ${stallionName}` })).toBeVisible({
      timeout: 15000,
    });

    // The E2E mare must appear in the dam panel
    await expect(page.getByRole('button', { name: `Select ${mareName}` })).toBeVisible({
      timeout: 15000,
    });
  });

  // Equoria-6w3ur: this test previously ended with
  // `waitForURL(/\/foals\/\d+/)`, which asserted the PRE-Phase-B direct-foal
  // contract. Breeding has started a 7-day PREGNANCY since the feed-system
  // redesign (Equoria-q7no) — POST /horses/foals returns
  // { pregnancyStarted, damId, sireId, foalDueDate } and the surface
  // deliberately stays put so the player sees the in-foal confirmation; there
  // is no foal id to navigate to. The assertion is updated to the live
  // contract, not relaxed: it still requires a 2xx from the real route AND the
  // player-visible in-foal confirmation on the surface.
  test('select sire and dam, confirm breeding, mare becomes in foal', async ({ page }) => {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    // Wait for both HorseSelector panels
    await expect(page.getByText('Sire (Stallion)').first()).toBeVisible({ timeout: 20000 });

    // Select the E2E stallion as sire
    const sireBtn = page.getByRole('button', { name: `Select ${stallionName}` });
    await expect(sireBtn).toBeVisible({ timeout: 15000 });
    await sireBtn.click();
    await expect(sireBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Select the E2E mare as dam
    const damBtn = page.getByRole('button', { name: `Select ${mareName}` });
    await expect(damBtn).toBeVisible({ timeout: 15000 });
    await damBtn.click();
    await expect(damBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // "Initiate Breeding" becomes enabled once both sire and dam are selected
    const initiateBtn = page.getByRole('button', { name: 'Initiate Breeding' });
    await expect(initiateBtn).toBeEnabled({ timeout: 10000 });
    await initiateBtn.click();

    // Confirmation modal must open
    await expect(page.getByTestId('breeding-confirmation-modal')).toBeVisible({ timeout: 10000 });

    // Intercept the foal-creation POST before clicking Confirm
    const foalPost = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/horses/foals') && resp.request().method() === 'POST',
      { timeout: 30000 }
    );

    await page.getByRole('button', { name: 'Confirm Breeding' }).click();

    const foalResp = await foalPost;
    expect(foalResp.ok(), `POST /api/v1/horses/foals returned ${foalResp.status()}`).toBeTruthy();

    // The pregnancy confirmation is surface-owned (no toast layer): either the
    // success banner ("<Mare> is now in foal…") for a repeat breeder, or the
    // CinematicMoment headline ("Your Mare is in Foal!") on a lifetime first.
    // Both say "in foal", so one assertion covers the real player paths.
    await expect(page.getByText(/in foal/i).first()).toBeVisible({ timeout: 15000 });

    // And the surface must NOT have navigated to a foal that does not exist yet.
    expect(page.url()).not.toMatch(/\/foals\/\d+/);
  });
});
