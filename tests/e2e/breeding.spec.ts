import { test, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';

test.describe('Breeding Loop', () => {
  let session: AuthedSession;
  let stallionName: string;
  let mareName: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  // Equoria-oua3: bare worker-scope `request` does NOT inherit project
  // storageState, so its POSTs land at the backend without auth and 401.
  // createAuthedSession() spawns a context loaded from storageState.json so
  // session.request carries the global-setup user's cookies + a CSRF token.
  test.beforeAll(async ({ browser }) => {
    session = await createAuthedSession(browser);

    // Use a timestamp suffix so re-runs don't collide on duplicate horse names.
    const suffix = Date.now();
    stallionName = `E2E Stallion ${suffix}`;
    mareName = `E2E Mare ${suffix}`;

    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
    let breedId = 1;
    const breedsRes = await session.request.get('/api/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
        console.log('Using breedId:', breedId);
      }
    }

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
    console.log('Created stallion:', stallionName);

    const mareRes = await csrfMutate(session, 'POST', '/api/horses', {
      name: mareName,
      breedId,
      age: 5,
      sex: 'mare',
    });
    if (!mareRes.ok()) {
      throw new Error(`Mare creation failed: ${mareRes.status()} ${await mareRes.text()}`);
    }
    console.log('Created mare:', mareName);
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

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

  test('select sire and dam, confirm breeding, navigate to foal page', async ({ page }) => {
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

    // After success the page navigates to /foals/{id} (2-3.5 s UI delay)
    await page.waitForURL(/\/foals\/\d+/, { timeout: 10000 });
  });
});
