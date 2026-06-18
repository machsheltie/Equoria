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
    // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a valid adult DOB.
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');
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

    // Welcome content mentions horse breeding. Equoria-916z: 'horse breeding'
    // appears twice on the page (h2 'Welcome to the world of horse breeding'
    // and step subtitle 'Your horse breeding adventure begins'). Playwright
    // strict mode on getByText fails on multiple matches; use .first() to
    // assert at least one is visible.
    await expect(page.getByText(/horse breeding/i).first()).toBeVisible({ timeout: 5000 });

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

    // Equoria-zanq / Spec 11.3.4: BreedSelector is now a WAI-ARIA radiogroup
    // (data-testid="breed-selector"), not a native <select>. It should render
    // (may show a loading skeleton first, then breed radio cards).
    const breedSelector = page.locator('[data-testid="breed-selector"]');
    await breedSelector.waitFor({ state: 'visible', timeout: 15000 });
    const firstBreedOption = breedSelector
      .locator('[role="radiogroup"][aria-label="Horse breeds"] [role="radio"][data-breed-option]')
      .first();
    await expect(firstBreedOption).toBeVisible({ timeout: 15000 });
  });

  test('onboarding wizard step 3 shows Ready confirmation', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    // Wait for step 1
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Advance to step 2
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Step 2 requires breed, gender, and name before Continue is enabled.
    // Equoria-zanq / Spec 11.3.4: onboarding uses a WAI-ARIA radiogroup
    // (BreedSelector — button[role="radio"][data-breed-option] cards), not a
    // native <select> or a listbox.
    const breedSelector = page.locator('[data-testid="breed-selector"]');
    await breedSelector.waitFor({ state: 'visible', timeout: 15000 });
    const firstBreedOption = breedSelector
      .locator('[role="radiogroup"][aria-label="Horse breeds"] [role="radio"][data-breed-option]')
      .first();
    await firstBreedOption.waitFor({ state: 'visible', timeout: 15000 });
    await firstBreedOption.click();
    await expect(firstBreedOption).toHaveAttribute('aria-checked', 'true');
    await breedSelector.getByRole('button', { name: /Mare/i }).click();
    await page.locator('[data-testid="horse-name-input"]').fill('Stardust');

    // Advance to step 3 — wait for Next to enable (gated on breed+gender+name)
    const step1Next = page.locator('[data-testid="onboarding-next"]');
    await expect(step1Next).toBeEnabled();
    await step1Next.click();

    // Step 3 heading: "You're Ready!"
    await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });

    // Step indicator shows "Step 3 of 3"
    await expect(page.getByText('Step 3 of 3')).toBeVisible({ timeout: 5000 });

    // "Your stable awaits" text should be visible. Equoria-916z: this string
    // appears twice (step subtitle + ReadyStep content); use .first() to
    // bypass Playwright strict mode.
    await expect(page.getByText('Your stable awaits').first()).toBeVisible({ timeout: 5000 });

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

    // Progress is exposed as a progressbar (the stepper is NOT tabs — its dots
    // are non-interactive, so role=tab/aria-selected would be invalid ARIA).
    const progressbar = page.locator('[role="progressbar"]');
    await expect(progressbar).toBeVisible({ timeout: 5000 });

    // Step 1 of 3 active on load
    await expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    await expect(progressbar).toHaveAttribute('aria-valuemax', '3');
    await expect(progressbar).toHaveAttribute('aria-valuenow', '1');

    // Advance to step 2 — clicking Continue on Welcome step
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Progress now reflects step 2
    await expect(progressbar).toHaveAttribute('aria-valuenow', '2');
  });
});
