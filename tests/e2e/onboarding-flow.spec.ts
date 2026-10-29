/**
 * Onboarding Flow — E2E Tests
 *
 * Tests the new-user onboarding wizard:
 *  - Fresh (unauthenticated) user gets redirected to /login (also for /onboarding itself:
 *    Equoria-bvddn.36, owner ruling 2026-10-19 "keep the onboarding login requirement")
 *  - Register a new user → OnboardingGuard sends her to /onboarding (never self-navigated)
 *  - A new player who tries any other route is sent back to the wizard
 *  - Onboarding step 1: Welcome message
 *  - Onboarding step 2: Horse selection (BreedSelector)
 *  - Onboarding step 3: Ready confirmation
 *  - Finishing the wizard is recorded by the server (step 1), customizes the
 *    registration starter horse with her choices, lands on /stable, and only
 *    then lets her leave /onboarding; the welcome note + tour skip finish it
 *
 * Uses a fresh session with a NEW user registration to avoid
 * storageState from the global-setup user (who already completed onboarding).
 */
import { test, expect, type Page } from '@playwright/test';
import { confirmEmailInBrowser } from './helpers/emailConfirmation';
import { skipGuidedTourAfterWizard } from './helpers/guidedTour';

interface OnboardingProfile {
  completedOnboarding: boolean;
  onboardingStep: number;
}

interface OwnedHorse {
  id: number;
  name: string;
  sex: string;
  breedId: number;
}

/** The signed-in player's onboarding state as the server records it. */
async function readOnboardingState(page: Page): Promise<OnboardingProfile> {
  const res = await page.request.get('/api/v1/auth/profile');
  expect(res.status(), `GET /api/v1/auth/profile: ${await res.text()}`).toBe(200);
  const user = (await res.json())?.data?.user;
  expect(typeof user?.completedOnboarding, 'profile must report completedOnboarding').toBe(
    'boolean'
  );
  expect(typeof user?.onboardingStep, 'profile must report onboardingStep').toBe('number');
  return { completedOnboarding: user.completedOnboarding, onboardingStep: user.onboardingStep };
}

/** The signed-in player's own horses as the server lists them. */
async function readOwnedHorses(page: Page): Promise<OwnedHorse[]> {
  const res = await page.request.get('/api/v1/horses');
  expect(res.status(), `GET /api/v1/horses: ${await res.text()}`).toBe(200);
  const horses = (await res.json())?.data;
  expect(Array.isArray(horses), 'GET /api/v1/horses must return a data array').toBe(true);
  return horses as OwnedHorse[];
}

test.describe('Onboarding Flow', () => {
  // All tests in this group use a fresh session (no auth cookies)
  test.use({ storageState: { cookies: [], origins: [] } });

  // Extend timeout — registration + onboarding involves multiple API calls
  test.beforeEach(async ({ page: _page }) => {
    test.setTimeout(90000);

    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // Successful registrations are never counted, so no bypass needed.
  });

  /**
   * Equoria-bvddn.36 (owner ruling 2026-10-19): /onboarding requires a session.
   * The wizard tests used to visit it logged out. They now sign in the way a
   * real new player does: register, which sets the auth cookies, and confirm
   * the email.
   *
   * Equoria-vrt5o (ADV-14): this helper used to finish with
   * page.goto('/onboarding'), so every wizard test opened the wizard itself and
   * none of them could notice OnboardingGuard failing to send a new player
   * there. It now only WAITS: "Enter the Realm" goes to "/", and the guard must
   * redirect to /onboarding on its own (as global-setup.ts waits since
   * Equoria-cgx4h).
   */
  async function registerFreshPlayer(page: Page): Promise<void> {
    const timestamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const password = 'Password123!';
    const email = `e2e_wizard_${timestamp}@example.com`;

    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Join the Realm', { timeout: 15000 });
    await page.fill('input[name="firstName"]', 'Onboard');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', `e2e_wizard_${timestamp}`);
    await page.fill('input[name="email"]', email);
    // Equoria-iqzn / Equoria-9tlha: COPPA age gate requires a valid adult DOB.
    await page.fill('input[name="dateOfBirth"]', '1990-01-01');
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');
    // Equoria-voasj / -3juhn: held on /verify-email until the emailed link is opened.
    await confirmEmailInBrowser(page, email);

    await page.waitForURL(/\/onboarding$/, { timeout: 30000 });
  }

  test('unauthenticated user visiting /onboarding is sent to /login, not the wizard', async ({
    page,
  }) => {
    // Equoria-bvddn.36: /onboarding is a ProtectedRoute. A logged-out visitor
    // must not be able to walk the wizard and only fail on submit.
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page.locator('h1', { hasText: 'Welcome to Equoria' })).toHaveCount(0);
  });

  test('a newly registered player is sent straight to the welcome wizard', async ({ page }) => {
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

    // After registration the new player is held on /verify-email until she
    // opens the emailed link (Equoria-voasj, owner ruling q248); then
    // OnboardingGuard sends her to /onboarding (Equoria-3juhn).
    await confirmEmailInBrowser(page, email);

    // Equoria-vrt5o (ADV-14): this test used to accept "/" or "/onboarding" and
    // only checked the URL was not /register, so it passed with the guard gone.
    // The wizard is the ONLY correct destination for an account made seconds
    // ago: "Enter the Realm" goes to "/", and the guard must redirect from there.
    await page.waitForURL(/\/onboarding$/, { timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
    await expect(page.getByText('Step 1 of 3')).toBeVisible({ timeout: 5000 });

    // The server agrees she has not onboarded: wizard not done, tour not begun.
    expect(await readOnboardingState(page)).toEqual({
      completedOnboarding: false,
      onboardingStep: 0,
    });
  });

  test('a new player cannot leave the wizard for the game before finishing it', async ({
    page,
  }) => {
    await registerFreshPlayer(page);
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Equoria-vrt5o (ADV-14): typing a game address must not get past the
    // wizard. OnboardingGuard wraps every route, so each one lands back here.
    for (const path of ['/', '/stable', '/bank']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page, `${path} must send a new player to the wizard`).toHaveURL(
        /\/onboarding$/,
        { timeout: 15000 }
      );
      await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });
    }

    // Wandering off recorded nothing: she is still a player who has not onboarded.
    expect(await readOnboardingState(page)).toEqual({
      completedOnboarding: false,
      onboardingStep: 0,
    });
  });

  test('finishing the wizard is recorded by the server and makes her chosen starter horse', async ({
    page,
  }) => {
    await registerFreshPlayer(page);
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // Before the wizard: not onboarded, and the one horse she owns is the
    // registration stand-in (onboardingController.mjs: registration creates the
    // starter row; the wizard writes her chosen name, breed and sex into it).
    expect(await readOnboardingState(page)).toEqual({
      completedOnboarding: false,
      onboardingStep: 0,
    });
    const chosenName = `Stardust ${Date.now() % 100000}`;
    const horsesBefore = await readOwnedHorses(page);
    expect(horsesBefore, 'registration gives a new player exactly one horse').toHaveLength(1);
    const starterId = horsesBefore[0].id;
    expect(horsesBefore[0].name).not.toBe(chosenName);

    // Step 1 → 2
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

    // Step 2: breed, gender and name, remembering the breed she picked.
    const breedSelector = page.locator('[data-testid="breed-selector"]');
    await breedSelector.waitFor({ state: 'visible', timeout: 15000 });
    const firstBreedOption = breedSelector
      .locator('[role="radiogroup"][aria-label="Horse breeds"] [role="radio"][data-breed-option]')
      .first();
    await firstBreedOption.waitFor({ state: 'visible', timeout: 15000 });
    const chosenBreedId = Number(await firstBreedOption.getAttribute('data-breed-option'));
    expect(Number.isInteger(chosenBreedId) && chosenBreedId > 0).toBe(true);
    await firstBreedOption.click();
    await expect(firstBreedOption).toHaveAttribute('aria-checked', 'true');
    await breedSelector.getByRole('button', { name: /Mare/i }).click();
    await page.locator('[data-testid="horse-name-input"]').fill(chosenName);
    const next = page.locator('[data-testid="onboarding-next"]');
    await expect(next).toBeEnabled();
    await next.click();

    // Step 3 → "Let's Go!" posts the wizard to the server.
    await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });
    const advance = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/auth/advance-onboarding') && res.request().method() === 'POST',
      { timeout: 30000 }
    );
    await next.click();
    const advanceRes = await advance;
    expect(advanceRes.status(), `advance-onboarding: ${await advanceRes.text()}`).toBe(200);
    const advanceBody = (await advanceRes.json())?.data;
    expect(advanceBody).toMatchObject({
      step: 1,
      completed: false,
      horse: { id: starterId, name: chosenName, breedId: chosenBreedId, gender: 'Mare' },
    });
    await page.waitForURL(/\/stable$/, { timeout: 20000 });

    // After the wizard: the server holds her at the start of the guided tour
    // (owner ruling 2026-09-30, Equoria-bvddn.31) and her one horse carries
    // exactly what she chose in the wizard.
    expect(await readOnboardingState(page)).toEqual({
      completedOnboarding: false,
      onboardingStep: 1,
    });
    const horsesAfter = await readOwnedHorses(page);
    expect(horsesAfter).toHaveLength(1);
    expect(horsesAfter[0]).toMatchObject({
      id: starterId,
      name: chosenName,
      sex: 'Mare',
      breedId: chosenBreedId,
    });

    // The welcome note (owner ruling 2026-10-23) and the tour's Skip, as a
    // player answers them; the helper waits for complete-onboarding's 200.
    await skipGuidedTourAfterWizard(page);
    expect(await readOnboardingState(page)).toMatchObject({ completedOnboarding: true });

    // Only now does a game address stay where she asked to go.
    await page.goto('/bank', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/bank$/, { timeout: 15000 });
    await expect(page.locator('h1', { hasText: 'Welcome to Equoria' })).toHaveCount(0);
  });

  test('onboarding wizard step 1 shows Welcome to Equoria', async ({ page }) => {
    // Sign in as a brand-new player (the wizard requires a session), then open the wizard
    await registerFreshPlayer(page);

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
    await registerFreshPlayer(page);

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
    await registerFreshPlayer(page);

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
    await registerFreshPlayer(page);

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
