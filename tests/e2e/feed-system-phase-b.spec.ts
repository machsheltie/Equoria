import { test, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';

// Tests must run in order: each test depends on state from the previous.
// beforeAll creates the test horses + starts the pregnancy so it is committed
// to the DB before any of the three tests run.
test.describe.serial('Feed System Phase B — pregnancy mechanic', () => {
  let session: AuthedSession;
  let stallionId: number;
  let mareId: number;
  let mareName: string;

  test.beforeEach(({ page }) => {
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    session = await createAuthedSession(browser);

    const suffix = Date.now();
    const stallionName = `PhaseB-Stallion-${suffix}`;
    mareName = `PhaseB-Mare-${suffix}`;

    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
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
        console.log('Using breedId:', breedId);
      }
    }

    // Create the Phase B stallion
    const stallionRes = await csrfMutate(session, 'POST', '/api/horses', {
      name: stallionName,
      breedId,
      age: 5,
      sex: 'stallion',
    });
    if (!stallionRes.ok()) {
      throw new Error(
        `Stallion creation failed: ${stallionRes.status()} ${await stallionRes.text()}`
      );
    }
    const stallionJson = (await stallionRes.json()) as { data: { id: number } };
    stallionId = stallionJson.data.id;
    console.log('Created stallion id:', stallionId);

    // Create the Phase B mare
    const mareRes = await csrfMutate(session, 'POST', '/api/horses', {
      name: mareName,
      breedId,
      age: 5,
      sex: 'mare',
    });
    if (!mareRes.ok()) {
      throw new Error(`Mare creation failed: ${mareRes.status()} ${await mareRes.text()}`);
    }
    const mareJson = (await mareRes.json()) as { data: { id: number } };
    mareId = mareJson.data.id;
    console.log('Created mare id:', mareId);

    // Buy 1 pack (100 units) of basic feed so the feeding test has inventory
    const buyRes = await csrfMutate(session, 'POST', '/api/v1/feed-shop/purchase', {
      feedTier: 'basic',
      packs: 1,
    });
    if (!buyRes.ok()) {
      console.warn(
        `Feed purchase returned ${buyRes.status()} — feeding test may fail if inventory is empty`
      );
    }

    // Initiate the 7-day pregnancy via API (bypasses the UI breeding flow which
    // is covered by breeding.spec.ts).
    const pregnancyRes = await csrfMutate(session, 'POST', '/api/v1/horses/foals', {
      sireId: stallionId,
      damId: mareId,
    });
    if (!pregnancyRes.ok()) {
      throw new Error(`Pregnancy failed: ${pregnancyRes.status()} ${await pregnancyRes.text()}`);
    }
    const pregnancyJson = (await pregnancyRes.json()) as {
      data?: { pregnancyStarted?: boolean };
    };
    console.log('Pregnancy response:', JSON.stringify(pregnancyJson));
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

  test('pregnancy-feeding-panel visible on mare detail page after breeding', async ({ page }) => {
    await page.goto(`/horses/${mareId}`, { waitUntil: 'load' });

    // Wait for the horse data to hydrate before asserting the panel.
    // Bump timeout to 30s — same cold-mount delay seen in Phase A on first visit.
    await expect(page.getByTestId('pregnancy-feeding-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('pregnancy-days-remaining')).toBeVisible();
  });

  test('feed pregnant mare — pregnancy-counter-basic increments to ≥1', async ({ page }) => {
    // Step 1: equip basic feed to the mare via the equip page
    await page.goto(`/horses/${mareId}/equip`, { waitUntil: 'load' });
    await expect(page.getByTestId('horse-equip-loading')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('feed-item-basic')).toBeVisible({ timeout: 15_000 });

    const equipResp = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/v1/horses/${mareId}/equip-feed`) &&
        resp.request().method() === 'POST'
    );
    await page.getByTestId('equip-feed-basic').click();
    const equipResponse = await equipResp;
    expect(equipResponse.ok()).toBeTruthy();
    await expect(page.getByText(/Equipped Basic Feed/)).toBeVisible();

    // Step 2: navigate to the mare's detail page and use the Feed button
    await page.goto(`/horses/${mareId}`, { waitUntil: 'load' });
    const feedButton = page.getByTestId('action-feed');
    await expect(feedButton).toBeEnabled({ timeout: 15_000 });
    await feedButton.click();
    // Success toast shows remaining units, e.g. "Fed [name] with Basic Feed. 99 units left."
    await expect(page.getByText(/units left/)).toBeVisible({ timeout: 10_000 });

    // Step 3: reload to flush React Query cache and pick up updated
    // pregnancyFeedingsByTier from the server.
    await page.reload({ waitUntil: 'load' });
    await expect(page.getByTestId('pregnancy-feeding-panel')).toBeVisible({ timeout: 15_000 });

    // The basic counter must now show at least 1 feed event
    await expect(page.getByTestId('pregnancy-counter-basic')).toContainText(/[1-9]/);
  });

  test('foal-now endpoint materialises foal — foal appears in horse list', async ({ page }) => {
    // Trigger immediate foaling for the test mare via the owner-scoped endpoint.
    // POST /api/v1/horses/:id/foal-now bypasses the 7-day gestation wait and
    // calls createFoalFromPregnancy directly, which applies the same epigenetic
    // pipeline as the production foaling cron job.

    // The horse routes live on the authRouter (has csrfProtection). Fetch a
    // fresh CSRF token first so the POST is accepted.
    const csrfRes = await page.request.get('http://localhost:3000/api/v1/auth/csrf-token');
    expect(csrfRes.ok(), `GET /api/v1/auth/csrf-token returned ${csrfRes.status()}`).toBeTruthy();
    const csrfJson = (await csrfRes.json()) as {
      data?: { csrfToken?: string };
      csrfToken?: string;
    };
    const csrfToken: string = csrfJson?.data?.csrfToken ?? csrfJson?.csrfToken ?? '';
    expect(csrfToken.length, 'CSRF token must be non-empty').toBeGreaterThan(20);

    const foalNowRes = await page.request.post(
      `http://localhost:3000/api/v1/horses/${mareId}/foal-now`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      }
    );
    expect(
      foalNowRes.ok(),
      `POST /api/v1/horses/${mareId}/foal-now returned ${foalNowRes.status()}`
    ).toBeTruthy();

    const body = (await foalNowRes.json()) as {
      data?: { foalId: number; foalName: string };
    };
    const foalName = body?.data?.foalName;
    expect(foalName, 'foal-now response must include foalName').toBeTruthy();
    // The foaling service names the foal "${dam.name} Foal" when pendingFoalName is absent
    expect(foalName).toBe(`${mareName} Foal`);

    // Verify the foal appears in the user's horse list via the API.
    const horsesRes = await page.request.get('http://localhost:3000/api/v1/horses');
    expect(horsesRes.ok()).toBeTruthy();
    const horsesJson = (await horsesRes.json()) as
      | { data?: Array<{ name: string }> }
      | Array<{ name: string }>;
    const horses = Array.isArray(horsesJson)
      ? horsesJson
      : ((horsesJson as { data?: Array<{ name: string }> })?.data ?? []);
    const foal = horses.find((h) => h.name === foalName);
    expect(foal, `Foal "${foalName}" not found in GET /api/v1/horses after foal-now`).toBeDefined();
  });
});

// Phase B foaling-job cron path (7-day gestation → runFoalingJob via scheduled
// cron + admin POST /api/v1/admin/foaling/trigger) is exercised by the backend
// integration test suite:
//   backend/__tests__/integration/foalingJob.test.mjs
// The admin endpoint requires the 'admin' role which the E2E test user does not
// hold. Duplicating cron-path coverage here would require either elevating the
// test user to admin (masking access-control bugs) or bypassing role checks
// (violating 21R-beta-doctrine). The foal-now endpoint above tests the same
// createFoalFromPregnancy pipeline via an owner-scoped route instead.
