import { test, expect, type APIRequestContext } from '@playwright/test';

test.describe('Breeding Loop', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
    let breedId = 1;
    const breedsRes = await request.get('/api/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
        console.log('Using breedId:', breedId);
      }
    }

    // Obtain a CSRF token via the public endpoint.
    // The request context automatically retains the _csrf cookie for subsequent POSTs.
    const csrfRes = await request.get('/api/auth/csrf-token');
    if (!csrfRes.ok()) {
      throw new Error(`CSRF token fetch failed with status ${csrfRes.status()}`);
    }
    const csrfData = await csrfRes.json();
    const csrfToken = (csrfData as { csrfToken?: string }).csrfToken;
    if (!csrfToken) {
      throw new Error('CSRF token missing from /api/auth/csrf-token response');
    }

    // 1. Create a Stallion
    const stallionResponse = await request.post('/api/horses', {
      headers: { 'x-csrf-token': csrfToken },
      data: {
        name: 'E2E Stallion',
        breedId,
        age: 5,
        sex: 'stallion',
      },
    });
    const stallion = await stallionResponse.json();
    if (!stallion.success) throw new Error(`Stallion creation failed: ${JSON.stringify(stallion)}`);

    // 2. Create a Mare
    const mareResponse = await request.post('/api/horses', {
      headers: { 'x-csrf-token': csrfToken },
      data: {
        name: 'E2E Mare',
        breedId,
        age: 5,
        sex: 'mare',
      },
    });
    const mare = await mareResponse.json();
    if (!mare.success) throw new Error(`Mare creation failed: ${JSON.stringify(mare)}`);
  });

  test('Should navigate to Breeding Center and see my mares', async ({ page }) => {
    console.log('Navigating to /breeding');
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    try {
      console.log('Waiting for Breeding Hall heading');
      await expect(page.getByRole('heading', { name: 'Breeding Hall' })).toBeVisible({
        timeout: 30000,
      });
    } catch (e) {
      console.log('Failed to find heading, taking screenshot');
      await page.screenshot({ path: 'failure-breeding-page.png' });
      const content = await page.content();
      console.log('PAGE CONTENT:', content);
      throw e;
    }

    console.log('Verifying My Mares tab');
    await expect(page.getByRole('tab', { name: 'My Mares' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    console.log('Waiting for horses to load in select');
    const damSelect = page.locator('select#damId');
    await expect(damSelect).toBeVisible({ timeout: 15000 });
    await expect(damSelect).toContainText('E2E Mare', { timeout: 15000 });
  });

  test('Should perform breeding and create a foal', async ({ page }) => {
    console.log('Navigating to /breeding for perform breeding');
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Breeding Hall' })).toBeVisible({
      timeout: 30000,
    });

    console.log('Selecting Mare');
    await page.selectOption('select#damId', { label: 'E2E Mare' });

    console.log('Selecting Stallion');
    await page.selectOption('select#sireId', { label: 'E2E Stallion' });

    console.log('Entering Foal Name');
    const foalName = `E2E Foal ${Date.now()}`;
    await page.getByPlaceholder('Enter foal name').fill(foalName);

    // Wait for the foal creation response — missing or non-201 means feature is broken, fail fast
    const foalPromise = page.waitForResponse(
      (response) => response.url().includes('/api/horses/foals'),
      { timeout: 30000 }
    );

    await page.click('button:has-text("Breed Now")');
    const foalResponse = await foalPromise;

    expect(foalResponse.status()).toBe(201);
    console.log(`Foal creation successful: ${foalName}`);

    // Verify Foal in Stable
    console.log('Navigating to Stable...');
    await page.goto('/stable', { waitUntil: 'networkidle' });

    console.log('Selecting "All" tab in stable');
    const allTab = page.getByRole('tab', { name: 'All', exact: true });
    await expect(allTab).toBeVisible({ timeout: 15000 });
    await allTab.click();

    await page.reload({ waitUntil: 'networkidle' });

    console.log(`Waiting for foal "${foalName}" to appear in stable`);
    try {
      await expect(page.getByText(foalName)).toBeVisible({ timeout: 30000 });
    } catch (e) {
      console.log('Stable page content on failure:');
      console.log(await page.content());
      await page.screenshot({ path: 'stable-failure.png' });
      throw e;
    }
  });
});
