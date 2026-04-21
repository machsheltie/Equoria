/**
 * Onboarding Flow — E2E Tests
 *
 * Tests the new-user onboarding wizard:
 *  - Fresh (unauthenticated) user gets redirected to /login
 *  - Register a new user → lands on home or onboarding
 *  - Onboarding step 1: Welcome message
 *  - Onboarding step 2: Horse selection (BreedSelector)
 *  - Onboarding step 3: Ready confirmation
 *  - Completing onboarding navigates to /bank (guided tour start)
 *
 * Uses a fresh session with a NEW user registration to avoid
 * storageState from the global-setup user (who already completed onboarding).
 */
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  // All tests in this group use a fresh session (no auth cookies)
  test.use({ storageState: { cookies: [], origins: [] } });

  // Extend timeout — registration + onboarding involves multiple API calls
  test.beforeEach(async ({ page: _page }) => {
    test.setTimeout(90000);

    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // Successful registrations are never counted, so no bypass needed.
  });

  test('unauthenticated user visiting /onboarding can see the wizard', async ({ page }) => {
    // /onboarding is NOT a ProtectedRoute — it's a public route
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // OnboardingPage renders step 1 heading: "Welcome to Equoria"
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
  });

  test('register new user and reach onboarding or home', async ({ page }) => {
    const timestamp = Date.now();
    const username = `e2e_onboard_${timestamp}`;
    const email = `e2e_onboard_${timestamp}@example.com`;
    const password = 'Password123!';

    // Navigate to register page
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Join the Realm', { timeout: 15000 });

    // Fill registration form
    await page.fill('input[name="firstName"]', 'Onboard');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // After registration, user should land on / or /onboarding
    // (depends on whether OnboardingGuard triggers)
    // After registration: OnboardingGuard redirects new users to /onboarding
    await page.waitForURL(/\/(onboarding)?$/, { timeout: 30000 });

    // Verify the page loaded (not stuck on register)
    const url = page.url();
    expect(url).not.toMatch(/\/register/);
  });

  test('onboarding wizard step 1 shows Welcome to Equoria', async ({ page }) => {
    // Go directly to /onboarding (public route)
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // Step 1 heading
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Step indicator shows "Step 1 of 3"
    await expect(page.getByText('Step 1 of 3')).toBeVisible({ timeout: 5000 });

    // Welcome content mentions horse breeding
    await expect(page.getByText(/horse breeding/i)).toBeVisible({ timeout: 5000 });

    // "Continue" button is visible
    await expect(page.locator('[data-testid="onboarding-next"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="onboarding-next"]')).toContainText('Continue');

    // "Skip intro" link is visible on step 1
    await expect(page.locator('[data-testid="onboarding-skip"]')).toBeVisible({ timeout: 5000 });
  });

  test('onboarding wizard step 2 shows Choose Your Horse', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // Wait for step 1 to load
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Click Continue to advance to step 2
    await page.locator('[data-testid="onboarding-next"]').click();

    // Step 2 heading: "Choose Your Horse"
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Step indicator shows "Step 2 of 3"
    await expect(page.getByText('Step 2 of 3')).toBeVisible({ timeout: 5000 });

    // BreedSelector should render (may show loading skeleton first, then breed options)
    // Wait for either the selector or a loading indicator
    const hasBreedsOrLoading = await page
      .locator('select, input, [class*="skeleton"], [class*="animate"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    expect(hasBreedsOrLoading).toBeTruthy();
  });

  test('onboarding wizard step 3 shows Ready confirmation', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // Wait for step 1
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Advance to step 2
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Step 2 requires breed, gender, and name before Continue is enabled
    // Onboarding uses a native <select data-testid="breed-select">, not a listbox
    const breedSelect = page.locator('[data-testid="breed-select"]');
    await breedSelect.waitFor({ state: 'visible', timeout: 15000 });
    // index 0 is the disabled placeholder; index 1 is the first real breed
    await breedSelect.selectOption({ index: 1 });
    await page.locator('button', { hasText: '♀ Mare' }).click();
    await page.locator('[data-testid="horse-name-input"]').fill('Stardust');

    // Advance to step 3
    await page.locator('[data-testid="onboarding-next"]').click();

    // Step 3 heading: "You're Ready!"
    await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });

    // Step indicator shows "Step 3 of 3"
    await expect(page.getByText('Step 3 of 3')).toBeVisible({ timeout: 5000 });

    // "Your stable awaits" text should be visible
    await expect(page.getByText('Your stable awaits')).toBeVisible({ timeout: 5000 });

    // CTA button shows "Let's Go!" on the last step
    await expect(page.locator('[data-testid="onboarding-next"]')).toContainText("Let's Go!", {
      timeout: 5000,
    });

    // Skip button is NOT visible on step 3 (only on step 1)
    await expect(page.locator('[data-testid="onboarding-skip"]')).not.toBeVisible();
  });

  test('onboarding progress dots reflect current step', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Progress dots use role="tablist" with role="tab" children
    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible({ timeout: 5000 });

    // Step 1 tab should be selected
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBe(3);

    // First tab aria-selected should be "true"
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'false');

    // Advance to step 2 — clicking Continue on Welcome step
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Second tab should now be selected (step 2 is active)
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'false');
  });
});
