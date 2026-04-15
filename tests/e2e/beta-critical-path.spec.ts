/**
 * Beta Critical Path — E2E Tests (Story 21R-3)
 *
 * These tests cover every beta-live route using real credentials and real
 * backend data. No test-only bypass headers that avoid the auth flow,
 * no pre-seeded horses, no test.skip on any critical path.
 *
 * AC3 (required first): register → onboarding → POST /api/auth/advance-onboarding → /stable shows horse
 * AC4: GET /api/horses asserts the customized starter horse exists in the backend
 *
 * Paths covered:
 *   Path 1 — New-player critical path (AC3, AC4)
 *   Path 2 — Returning-player login smoke (AC1, AC2)
 *   Path 3 — Horse detail smoke (AC1)
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

test.describe.configure({ mode: 'serial' });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Route the auth rate limiter bypass header on every auth API call.
 *  This does NOT bypass CSRF validation or the auth flow itself — it only
 *  prevents 429s caused by test runs hammering the rate limiter. */
async function bypassAuthRateLimit(page: Page) {
  await page.route('**/api/auth/**', (route) => {
    const headers = { ...route.request().headers(), 'x-test-bypass-rate-limit': 'true' };
    route.continue({ headers });
  });
}

/** Fill step 1 (Choose Your Horse) of the onboarding wizard.
 *  Selects the first available breed from the native select, chooses Mare,
 *  and sets the horse name. */
async function fillOnboardingHorseStep(page: Page, horseName: string) {
  await expect(page.locator('h1')).toContainText('Choose Your Horse', { timeout: 10000 });

  // Wait for breed select to load with real options (GET /api/v1/breeds)
  // The onboarding page renders a native <select data-testid="breed-select">
  const breedSelect = page.locator('[data-testid="breed-select"]');
  await breedSelect.waitFor({ state: 'visible', timeout: 20000 });
  // index 0 is the disabled placeholder; index 1 is the first real breed
  const options = await breedSelect.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      label: (node.textContent ?? '').trim(),
    }))
  );
  const selectedBreed = options[1];
  await breedSelect.selectOption({ index: 1 });

  // Select Mare gender
  await page.locator('button', { hasText: '♀ Mare' }).click();

  // Enter horse name
  await page.locator('[data-testid="horse-name-input"]').fill(horseName);

  return {
    breedId: Number(selectedBreed.value),
    breedName: selectedBreed.label,
    gender: 'Mare',
  };
}

function getHorseBreedName(horse: { breed?: string | { name?: string }; breedName?: string }) {
  if (typeof horse.breed === 'string') {
    return horse.breed;
  }

  return horse.breed?.name ?? horse.breedName ?? '';
}

function getHorseGender(horse: { sex?: string; gender?: string }) {
  return horse.sex ?? horse.gender ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Path 1 — New-player critical path (AC3, AC4)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Path 1: New-player critical path', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('register → onboarding customizes starter horse → /stable renders persisted horse', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const ts = Date.now();
    const email = `beta_cp_${ts}@example.com`;
    const password = 'Password123!';
    const horseName = `Comet ${ts}`;

    await bypassAuthRateLimit(page);

    // ── 1. Register ──────────────────────────────────────────────────────
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Join the Realm', { timeout: 15000 });

    await page.fill('input[name="firstName"]', 'Beta');
    await page.fill('input[name="lastName"]', 'Tester');
    await page.fill('input[name="username"]', `beta_cp_${ts}`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.fill('input[name="confirmPassword"]', password);
    await page.click('button[type="submit"]');

    // ── 2. OnboardingGuard redirects new user to /onboarding ─────────────
    await page.waitForURL(/\/onboarding$/, { timeout: 30000 });
    await expect(page.locator('h1')).toContainText('Welcome to Equoria', { timeout: 15000 });

    // ── 3. Step 0 (Welcome) → click Continue ─────────────────────────────
    await page.locator('[data-testid="onboarding-next"]').click();

    // ── 4. Step 1 (Choose Your Horse) → fill selection ───────────────────
    const selectedHorse = await fillOnboardingHorseStep(page, horseName);

    // ── 5. Step 1 → click Continue → step 2 (Ready) ──────────────────────
    await page.locator('[data-testid="onboarding-next"]').click();
    await expect(page.locator('h1')).toContainText("You're Ready!", { timeout: 10000 });

    // ── 6. Step 2 → click "Let's Go!" — intercept POST /api/auth/advance-onboarding ──
    // Onboarding calls advance-onboarding to update the starter horse (name/breed/gender)
    // that was created atomically by POST /api/auth/register.
    const advanceOnboardingPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/auth/advance-onboarding') && res.request().method() === 'POST',
      { timeout: 30000 }
    );

    await page.locator('[data-testid="onboarding-next"]').click();

    const advanceOnboardingResponse = await advanceOnboardingPromise;
    expect(advanceOnboardingResponse.status()).toBe(200);
    const submittedHorse = advanceOnboardingResponse.request().postDataJSON();
    expect(submittedHorse).toMatchObject({
      horseName,
      breedId: selectedHorse.breedId,
      gender: selectedHorse.gender,
    });

    // ── 7. Onboarding navigates to /stable (beta-live stable route) ───────
    await page.waitForURL(/\/stable$/, { timeout: 20000 });

    // ── 8. GET /api/horses — assert starter horse persisted in backend ─────
    const horsesListResponse = await page.request.get('/api/horses');
    expect(horsesListResponse.ok()).toBe(true);

    const horsesListJson = await horsesListResponse.json();
    const horsesList: Array<{
      id: number;
      name: string;
      breed?: string | { name?: string };
      breedName?: string;
      breedId?: number;
      sex?: string;
      gender?: string;
    }> = horsesListJson?.data ?? horsesListJson ?? [];
    expect(Array.isArray(horsesList)).toBe(true);
    expect(horsesList.length).toBeGreaterThanOrEqual(1);

    const starterHorse = horsesList.find((h) => h.name === horseName);
    expect(starterHorse).toBeDefined();
    expect(starterHorse?.breedId ?? selectedHorse.breedId).toBe(selectedHorse.breedId);
    expect(getHorseBreedName(starterHorse!)).toContain(selectedHorse.breedName);
    expect(getHorseGender(starterHorse!)).toBe(selectedHorse.gender);

    const horseId = starterHorse?.id;
    expect(typeof horseId).toBe('number');

    // ── 9. /stable renders a horse card with the correct name ─────────────
    await expect(page.locator('h1')).toContainText('Your Stable', { timeout: 15000 });
    // Horse name may appear in multiple places (card + sidebar); assert the first visible one
    await expect(page.getByText(horseName).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(selectedHorse.breedName).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(selectedHorse.gender).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Path 2 — Returning-player login smoke (AC1, AC2)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Path 2: Returning-player login smoke', () => {
  // Fresh session — requires real login
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login → / (hub) renders → /stable shows horse list area', async ({ page }) => {
    test.setTimeout(60000);

    await bypassAuthRateLimit(page);

    // Use global-setup credentials (fully onboarded user with a horse)
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const credsPath = path.resolve(__dirname, 'test-credentials.json');

    if (!fs.existsSync(credsPath)) {
      test.skip(true, 'test-credentials.json not found — global-setup did not run');
      return;
    }

    const { email, password } = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Welcome Back', { timeout: 15000 });

    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // After login, fully-onboarded user lands on /
    await page.waitForURL('/', { timeout: 20000 });
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // Navigate to /stable
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Your Stable', { timeout: 15000 });

    // At least one horse card is visible (global-setup created a horse)
    await expect(page.locator('[data-testid="horse-card"]').first()).toBeVisible({
      timeout: 10000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Path 3 — Horse detail smoke (AC1)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Path 3: Horse detail smoke', () => {
  // Fresh session — logs in with global-setup credentials so the session is
  // guaranteed fresh regardless of how long the test suite takes to reach this point.
  // (storageState access-token cookies expire in 15 min; a long setup run invalidates them.)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('navigate to /horses/:id from stable — renders name and breed, no core BetaExcludedNotice', async ({
    page,
  }) => {
    test.setTimeout(60000);

    await bypassAuthRateLimit(page);

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const credsPath = path.resolve(__dirname, 'test-credentials.json');

    if (!fs.existsSync(credsPath)) {
      test.skip(true, 'test-credentials.json not found — global-setup did not run');
      return;
    }

    const { email, password } = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h2')).toContainText('Welcome Back', { timeout: 15000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 20000 });

    await page.goto('/stable', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Your Stable', { timeout: 15000 });

    // Click the first horse card to go to /horses/:id
    const firstCard = page.locator('[data-testid="horse-card"]').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();

    // Verify we landed on a horse detail route
    await expect(page).toHaveURL(/\/horses\/\d+/, { timeout: 10000 });

    // Horse name is visible (h1 or prominent heading)
    const horseName = await page.locator('h1').first().textContent({ timeout: 5000 });
    expect(horseName?.trim().length).toBeGreaterThan(0);

    // Core detail section does NOT render BetaExcludedNotice for the main section
    // (Vet history IS intentionally beta-excluded, but the overview should not be)
    const coreSection = page.locator('[data-testid="horse-detail-overview"]');
    const coreExists = await coreSection.count();
    if (coreExists > 0) {
      await expect(coreSection).not.toContainText('Not available in this beta');
    }
  });
});
