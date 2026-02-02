import { test, expect } from '@playwright/test';

test.describe('Breeding Loop', () => {
  let stallionId: number;
  let mareId: number;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`BROWSER ERROR: ${err.message}`));
  });

  test.beforeAll(async ({ request }) => {
    // 1. Create a Stallion
    const stallionResponse = await request.post('/api/horses', {
      headers: { 'x-test-skip-csrf': 'true' },
      data: {
        name: 'E2E Stallion',
        breedId: 946,
        age: 5,
        sex: 'stallion',
      },
    });
    const stallion = await stallionResponse.json();
    if (!stallion.success) throw new Error(`Stallion creation failed: ${JSON.stringify(stallion)}`);
    stallionId = stallion.data.id;

    // 2. Create a Mare
    const mareResponse = await request.post('/api/horses', {
      headers: { 'x-test-skip-csrf': 'true' },
      data: {
        name: 'E2E Mare',
        breedId: 946,
        age: 5,
        sex: 'mare',
      },
    });
    const mare = await mareResponse.json();
    if (!mare.success) throw new Error(`Mare creation failed: ${JSON.stringify(mare)}`);
    mareId = mare.data.id;
  });

  test('Should navigate to Breeding Center and see my mares', async ({ page }) => {
    console.log('Navigating to /breeding');
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    try {
      console.log('Waiting for Breeding Center heading');
      // Increased timeout and using role for better reliability
      await expect(page.getByRole('heading', { name: 'Breeding Center' })).toBeVisible({
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
    // Verify "My Mares" tab is active and shows the mare
    await expect(page.getByRole('tab', { name: 'My Mares' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    console.log('Waiting for horses to load in select');
    // Wait for horses to load in select
    const damSelect = page.locator('select#damId');
    await expect(damSelect).toBeVisible({ timeout: 15000 });
    // Check for text content instead of visibility if it's an option inside a closed select
    await expect(damSelect).toContainText('E2E Mare', { timeout: 15000 });
  });

  test('Should perform breeding and create a foal', async ({ page }) => {
    console.log('Navigating to /breeding for perform breeding');
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });

    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Breeding Center' })).toBeVisible({
      timeout: 30000,
    });

    console.log('Selecting Mare');
    // 1. Select Mare (Use string label instead of regex object)
    await page.selectOption('select#damId', { label: 'E2E Mare' });

    console.log('Selecting Stallion');
    // 2. Select Stallion
    await page.selectOption('select#sireId', { label: 'E2E Stallion' });

    console.log('Entering Foal Name');
    // 3. Enter Foal Name
    const foalName = `E2E Foal ${Date.now()}`;
    await page.getByPlaceholder('Foal Name').fill(foalName);

    // Wait for the foal creation response to ensure the backend operation is complete
    const foalPromise = page.waitForResponse(
      (response) => response.url().includes('/api/horses/foals') && response.status() === 201,
      { timeout: 30000 }
    );

    await page.click('button:has-text("Breed Now")');
    const foalResponse = await foalPromise;
    console.log(`Foal creation successful: ${foalName}`);

    // 5. Verify Foal in Stable
    console.log('Navigating to Stable...');
    await page.goto('/stable', { waitUntil: 'networkidle' });

    // Give it a moment to render
    await page.waitForTimeout(2000);

    // Select "All" tab to be sure
    console.log('Selecting "All" tab in stable');
    const allTab = page.getByRole('tab', { name: 'All', exact: true });
    await expect(allTab).toBeVisible({ timeout: 15000 });
    await allTab.click();

    // Reload just in case query was cached
    await page.reload({ waitUntil: 'networkidle' });

    // Explicitly wait for horse list to load
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
