import { test as base, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';
import { seedOwnedHorses } from './fixtures/ownedHorses';
import { foalMareNow } from './fixtures/foaling';

/**
 * Foal Development Lifecycle — real-backend E2E (Equoria-fogeh).
 *
 * Replaces the deleted Vitest suite
 *   frontend/src/components/breeding/__tests__/FoalDevelopmentTracker.test.tsx
 * (39 vi.mock calls against @/hooks/api/useBreeding) per CLAUDE.md §3
 * (mocks aren't part of Equoria's toolkit). The container component
 * FoalDevelopmentTracker is wired into FoalDetailPage (route /foals/:id);
 * this spec drives it against the real backend through the real UI.
 *
 * Fixture strategy:
 *  - createAuthedSession() loads the global-setup user (CSRF + auth cookies).
 *  - We seed a stallion + mare through the real createHorse model function,
 *    breed them via /api/v1/horses/foals (which starts a 7-day pregnancy), then
 *    skip the wait by running the real foaling service from this process
 *    (fixtures/foaling.ts) to mint a real foal owned by the session user
 *    (Equoria-6w3ur, Equoria-6nl3j).
 *  - The newborn foal starts at currentDay 0 / maxDay 6 with no traits.
 *    We prove the retired develop endpoint cannot move the development day
 *    (Equoria-mwjst) and the retired reveal-traits endpoint is gone
 *    (Equoria-gu8jk; owner ruling 2026-10-20: players never reveal traits).
 *
 * Player-run enrichment, stage activities and graduation were removed
 * (Equoria-fr2kg; owner ruling 2026-10-14/15: foal enrichment is the groom's
 * job, and there is no graduation). We prove the page offers none of them
 * and the backend no longer serves their routes.
 */
const test = base.extend<{ browserConsole: void }>({
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
});

test.describe('Foal Development Lifecycle (FoalDevelopmentTracker on /foals/:id)', () => {
  let session: AuthedSession;
  let foalId: number;
  let foalName: string;

  test.beforeEach(async () => {
    test.setTimeout(120000);
  });

  // Mint a fresh foal via API so each spec run starts from a known
  // newborn state (currentDay 0 / maxDay 6, no traits, no activities).
  test.beforeAll(async ({ browser }) => {
    session = await createAuthedSession(browser);

    const suffix = Date.now();
    const stallionName = `E2E FoalDev Stallion ${suffix}`;
    const mareName = `E2E FoalDev Mare ${suffix}`;

    // Resolve a valid breedId — IDs are auto-incremented, not always 1
    let breedId = 1;
    const breedsRes = await session.request.get('/api/v1/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Equoria-6p398.2 (audit Finding 2): the parents used to come from
    // POST /api/v1/horses, which handed any player a free horse and is now
    // closed (403). Seed them from this process through the real createHorse
    // model function; the foal itself is still bred over the real HTTP
    // POST /api/v1/horses/foals route below, which is the point of this spec.
    // Seeded in ONE call so the fixture's horse-list visibility wait runs once
    // for the pair; sequential calls would make the second wait out the list
    // cache entry the first one just wrote (tests/e2e/fixtures/ownedHorses.ts).
    const [{ id: sireId }, { id: damId }] = await seedOwnedHorses(
      session,
      [
        {
          breedId,
          name: stallionName,
          sex: 'stallion',
          age: 5,
        },
        {
          breedId,
          name: mareName,
          sex: 'mare',
          age: 5,
        },
      ],
      // The parents are only ever used as sireId/damId on the real
      // POST /api/v1/horses/foals call; every assertion happens on /foals/:id.
      // This spec never renders the cached horse list.
      { requireHorseListVisibility: false }
    );

    expect.soft(sireId, 'sireId should be returned from the seeded sire').toBeTruthy();
    expect.soft(damId, 'damId should be returned from the seeded dam').toBeTruthy();

    // Feed both parents before breeding (Equoria-6w3ur).
    //
    // POST /horses/foals refuses a horse in critical health (Equoria-2e7e), and
    // getDisplayedHealth() = worseOf(feedHealth, vetHealth) makes a never-fed
    // horse 'critical' regardless of healthStatus. Freshly seeded parents have
    // never eaten, so this pair was always going to be refused; the old
    // request-shape 400 simply returned before the gate could say so. Do what a
    // real player does — buy feed, equip it, feed each horse — mirroring
    // tests/e2e/feed-system-phase-b.spec.ts. Real routes, no fixture shortcut.
    const purchase = await csrfMutate(session, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: 'basic',
      packs: 1,
    });
    if (!purchase.ok()) {
      throw new Error(`Feed purchase failed (${purchase.status()}): ${await purchase.text()}`);
    }
    for (const horseId of [sireId, damId]) {
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

    // Equoria-6w3ur: breeding starts a 7-day PREGNANCY (Phase-B feed-system
    // redesign, Equoria-q7no) — POST /horses/foals returns
    // { pregnancyStarted, damId, sireId, foalDueDate } and creates NO foal row.
    // Materialise the foal the way the product does: start the pregnancy over
    // the real route, then run the real foalingService (the nightly job's
    // createFoalFromPregnancy) from this process via fixtures/foaling.ts. The
    // POST /horses/:id/foal-now gestation bypass that used to do this inside the
    // backend is gone from the application (Equoria-6nl3j).
    foalName = `E2E Foal ${suffix}`;
    const pregnancyRes = await csrfMutate(session, 'POST', '/api/v1/horses/foals', {
      sireId,
      damId,
      name: foalName,
    });
    if (!pregnancyRes.ok()) {
      throw new Error(`Breeding failed (${pregnancyRes.status()}): ${await pregnancyRes.text()}`);
    }
    const pregnancyJson = await pregnancyRes.json();
    expect(
      pregnancyJson?.data?.pregnancyStarted,
      'breeding should start a pregnancy on the dam'
    ).toBe(true);

    const foal = await foalMareNow(damId);
    foalId = foal.id;
    expect(foalId, 'foalId should be returned from foaling').toBeTruthy();
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

  test('foal detail page loads with development panel and lifecycle actions', async ({ page }) => {
    await page.goto(`/foals/${foalId}`, { waitUntil: 'domcontentloaded' });

    // Foal name in the summary card
    await expect(page.getByRole('heading', { name: foalName })).toBeVisible({ timeout: 20000 });

    // Top-level Development panel header (rendered by FoalDetailPage)
    await expect(page.getByRole('heading', { name: 'Development' })).toBeVisible({
      timeout: 10000,
    });

    // FoalDevelopmentTracker renders the development timeline. There is NO
    // Advance Day (Equoria-mwjst, owner ruling 2026-10-05: foals wait out their
    // full development week) and NO Reveal Traits (Equoria-gu8jk).
    await expect(page.getByTestId('development-tracker')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: /Advance Day/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reveal Traits/i })).toHaveCount(0);
  });

  // Equoria-gu8jk. OLD CONTRACT: a "Reveal Traits" button POSTed
  // /reveal-traits and the server moved hidden traits into view on demand.
  // NEW RULING (owner, 2026-10-20): players must never write traits for
  // themselves — grooms will activate them — so the page offers no reveal
  // control and the endpoint is gone.
  test('the player cannot reveal traits: no control, and POST /reveal-traits is gone', async ({
    page,
  }) => {
    await page.goto(`/foals/${foalId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('development-tracker')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Reveal Traits/i })).toHaveCount(0);

    const res = await csrfMutate(session, 'POST', `/api/v1/foals/${foalId}/reveal-traits`, {});
    expect(res.status(), 'the retired reveal-traits endpoint must not exist').toBe(404);
  });

  // Equoria-mwjst. OLD CONTRACT (vulnerable): an "Advance Day" button sent
  // PUT /develop and the server stored the client's chosen day/bond.
  // CORRECTED CONTRACT (owner ruling 2026-10-05): no Advance Day anywhere; the
  // endpoint is gone and the development record does not move.
  test('the player cannot advance the development day: no control, and PUT /develop is refused', async ({
    page,
  }) => {
    await page.goto(`/foals/${foalId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('development-tracker')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Advance Day/i })).toHaveCount(0);

    const readDevelopment = async () => {
      const res = await session.request.get(`/api/v1/foals/${foalId}/development`);
      expect(res.ok(), `GET /development returned ${res.status()}`).toBeTruthy();
      const json = (await res.json()) as {
        data?: {
          development?: { currentDay?: number; bondingLevel?: number };
        };
      };
      return json.data?.development;
    };

    const before = await readDevelopment();
    const forged = await csrfMutate(session, 'PUT', `/api/v1/foals/${foalId}/develop`, {
      currentDay: 6,
      bondingLevel: 100,
    });
    expect(forged.status(), 'the retired develop endpoint must not exist').toBe(404);
    expect(await readDevelopment()).toEqual(before);
  });

  // Equoria-fr2kg. OLD CONTRACT: the page offered "Enrich" (POST /enrich), a
  // stage-activity picker (POST /activity) and, past 104 weeks, "Graduate to
  // Adult" (POST /graduate). NEW RULING (owner, 2026-10-14/15): foal
  // enrichment is the groom's job and there is no graduation, so the page
  // offers none of these and the backend no longer serves the routes.
  test('the player cannot enrich, run foal activities or graduate: no controls, and the routes are gone', async ({
    page,
  }) => {
    await page.goto(`/foals/${foalId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('development-tracker')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /Enrich/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Graduat/i })).toHaveCount(0);
    await expect(page.getByText(/Available activities/i)).toHaveCount(0);

    for (const [path, body] of [
      ['enrich', { activity: 'gentle_touch' }],
      ['enrichment', { activity: 'gentle_touch' }],
      ['activity', { activityType: 'gentle_touch' }],
      ['graduate', {}],
    ] as const) {
      const res = await csrfMutate(session, 'POST', `/api/v1/foals/${foalId}/${path}`, body);
      expect(res.status(), `POST /foals/:id/${path} must no longer exist`).toBe(404);
    }
  });
});
