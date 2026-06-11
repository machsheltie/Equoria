/**
 * Core Game Flows — E2E Tests (Story 9A-2)
 *
 * Acceptance Criteria:
 *  AC1: Login flow — valid credentials → dashboard redirect
 *  AC2: Session persistence — page refresh keeps user authenticated
 *  AC3: Stable page loads with horse list (or empty state)
 *  AC4: Training session — initiate to result displayed
 *  AC5: Competition entry — select horse → confirm → result displayed
 */
import { test, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';
import { readTestCredentials } from './helpers/credentials';

/** Read saved credentials persisted by global-setup into process.env. */
function readCredentials() {
  return readTestCredentials();
}

// ─────────────────────────────────────────────────────────────────────────────
// AC1 — Login Flow
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC1: Login Flow', () => {
  // Fresh session — no storageState for this group
  test.use({ storageState: { cookies: [], origins: [] } });

  test('valid credentials redirect to home dashboard', async ({ page }) => {
    const { email, password } = readCredentials();

    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // Successful logins are never counted, so no bypass needed.

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // LoginPage renders <h2> "Welcome Back"
    await expect(page.locator('h2')).toContainText('Welcome Back');

    // Fill credentials using name selectors
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // After successful login, frontend navigates to / (or /onboarding for new users)
    // The global-setup user has already completed onboarding, so they go to /
    await page.waitForURL('/', { timeout: 20000 });

    // Home dashboard should show the h1 heading ("My Stable")
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — Session Persistence
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC2: Session Persistence', () => {
  test('authenticated user stays logged in after page reload', async ({ page }) => {
    // storageState from globalSetup is used automatically (project default)
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });

    // Verify stable page loaded (not redirected to /login)
    await expect(page.locator('h1')).toContainText('Stable', { timeout: 15000 });

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Should still be on /stable — not kicked to /login
    await expect(page).toHaveURL(/\/stable/);
    await expect(page.locator('h1')).toContainText('Stable', { timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — Stable Page Loads
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC3: Stable Page', () => {
  test('stable page loads and shows horse list area', async ({ page }) => {
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });

    // Heading is present
    await expect(page.locator('h1')).toContainText('Stable', { timeout: 15000 });

    // Use expect.poll() so React Query hydration + Redis-reconnect contention
    // (same root cause as Equoria-916z feed-section flake) settles before
    // asserting. Bare .count() calls without polling race the first render.
    await expect
      .poll(
        async () => {
          const hasHorses = await page.locator('[data-testid="horse-card"]').count();
          const hasEmpty = await page.locator('text=No horses in this category').count();
          const hasStableSlots = await page.getByText(/Stable Slots/i).count();
          return hasHorses + hasEmpty + hasStableSlots;
        },
        { timeout: 15000 }
      )
      .toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — Training Session: initiate → result displayed
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC4: Training Session', () => {
  // Always create a fresh horse so it has no training cooldown.
  // Reusing the global-setup horse risks cooldown from previous test runs.
  let trainingHorseId: number | null = null;
  let session: AuthedSession;

  // Equoria-oua3: bare `request` does NOT inherit storageState. Use
  // createAuthedSession() so session.request carries the global-setup
  // user's auth cookies — otherwise POST /api/horses returns 401.
  test.beforeAll(async ({ browser }) => {
    session = await createAuthedSession(browser);

    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
    let breedId = 1;
    const breedsRes = await session.request.get('/api/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Create a fresh training horse with proper auth + CSRF (no bypass headers)
    const res = await csrfMutate(session, 'POST', '/api/horses', {
      name: `Training Horse ${Date.now()}`,
      breedId,
      age: 5,
      sex: 'stallion',
    });
    if (!res.ok()) {
      throw new Error(`Horse creation for training failed: ${res.status()} ${await res.text()}`);
    }
    const json = await res.json();
    trainingHorseId = json?.data?.id ?? json?.id ?? null;
    if (!trainingHorseId) {
      throw new Error(`Horse creation succeeded but returned no id: ${JSON.stringify(json)}`);
    }
    console.log('Created training horse id:', trainingHorseId);
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

  test('training dashboard loads with Training Dashboard heading', async ({ page }) => {
    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    // TrainingDashboardPage uses data-testid="training-page"
    await expect(page.locator('[data-testid="training-page"]')).toBeVisible({
      timeout: 20000,
    });
    // Heading is "Training Grounds" per Epic 13 product design.
    await expect(page.getByText('Training Grounds').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking train button opens TrainingSessionModal', async ({ page }) => {
    // trainingHorseId is guaranteed by beforeAll (throws if horse not created)
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-page"]', { timeout: 20000 });

    // Wait for the fresh horse's train button — fresh horse has no cooldown
    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
    await trainBtn.click();

    // Training modal must open — if it doesn't, the training flow is broken
    await expect(page.getByRole('button', { name: 'Start Training' })).toBeVisible({
      timeout: 10000,
    });
  });

  test('confirming training shows Training Results', async ({ page }) => {
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-page"]', { timeout: 20000 });

    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
    await trainBtn.click();

    // Modal opens — click Start Training
    const startBtn = page.getByRole('button', { name: 'Start Training' });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    // Training Results must appear — if not, the training execution is broken
    await expect(page.getByText('Training Results')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Next Training:')).toBeVisible({ timeout: 5000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — Competition Entry: select horse → confirm → result displayed
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC5: Competition Entry', () => {
  test('competition browser loads and shows Competition Arena heading', async ({ page }) => {
    await page.goto('/competitions', { waitUntil: 'domcontentloaded' });

    // CompetitionBrowserPage renders with data-testid="competition-browser-page"
    await expect(page.locator('[data-testid="competition-browser-page"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('h1')).toContainText('Competition Arena', { timeout: 10000 });
  });

  // global-setup.ts now seeds 3 Show rows (Equoria-kyrf) so competition
  // cards are present on every run.
  test('clicking a competition card opens the detail modal', async ({ page }) => {
    await page.goto('/competitions', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="competition-browser-page"]', { timeout: 20000 });

    // Competition cards must be present — if absent, the test DB has no shows seeded
    // and setup must be fixed, not the test skipped
    const cards = page.locator('[data-testid="competition-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    await cards.first().click();

    // CompetitionDetailModal must open
    await expect(page.locator('[data-testid="competition-detail-modal"]')).toBeVisible({
      timeout: 10000,
    });
    // Competition name appears in the modal's BaseModal title — assert by
    // dialog role instead of a testid that lives only in EntryConfirmation
    // Modal / PrizeNotificationModal (not CompetitionDetailModal).
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 5000 });
  });

  test('competition entry flow: select horse in modal → click Enter → API 200', async ({
    page,
  }) => {
    // The entry flow lives entirely inside CompetitionDetailModal:
    //   1. Click a competition card → modal opens
    //   2. Pick a horse via competition-entry-horse-select (native <select>)
    //   3. Click enter-competition-button
    //   4. POST /api/v1/competition/enter returns 200 (entry persisted)
    // There is no separate EntryConfirmationModal in the current UI.
    const creds = readCredentials();
    const horseId = creds.testHorseId;

    await page.goto('/competitions', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="competition-browser-page"]', { timeout: 20000 });

    // Competitions must exist — absent data is a setup failure, not a skip condition
    const cards = page.locator('[data-testid="competition-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });

    // Open detail modal
    await cards.first().click();
    await expect(page.locator('[data-testid="competition-detail-modal"]')).toBeVisible({
      timeout: 10000,
    });

    // Select horse from the inline horse-select inside the modal
    const horseSelect = page.locator('[data-testid="competition-entry-horse-select"]');
    await expect(horseSelect).toBeVisible({ timeout: 10000 });
    if (horseId) {
      // Pre-select the global-setup starter horse if available in the list
      const valueExists = await horseSelect
        .locator(`option[value="${horseId}"]`)
        .count()
        .then((c) => c > 0);
      if (valueExists) {
        await horseSelect.selectOption({ value: String(horseId) });
      } else {
        // Fall back to the first real option (index 1 skips the placeholder)
        const optionValues = await horseSelect
          .locator('option[value]')
          .evaluateAll((opts: HTMLOptionElement[]) =>
            opts.map((o) => o.value).filter((v) => v !== '')
          );
        if (optionValues.length > 0) {
          await horseSelect.selectOption({ value: optionValues[0] });
        }
      }
    }

    // Intercept entry POST before clicking — proves the real API was called
    const entryPost = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/competition/enter') && resp.request().method() === 'POST',
      { timeout: 15000 }
    );

    // Enter Competition button must be enabled (disabled = ineligible horse = real failure)
    const enterBtn = page.locator('[data-testid="enter-competition-button"]');
    await expect(enterBtn).toBeEnabled({ timeout: 10000 });
    await enterBtn.click();

    const entryResp = await entryPost;
    expect(
      entryResp.ok(),
      `POST /api/v1/competition/enter returned ${entryResp.status()}`
    ).toBeTruthy();
  });
});
