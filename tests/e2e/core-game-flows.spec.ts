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
import { test, expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.resolve(__dirname, 'test-credentials.json');

/** Read saved credentials written by global-setup */
function readCredentials(): {
  email: string;
  password: string;
  username: string;
  testHorseId?: number;
} {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(
      `test-credentials.json not found — did global-setup run? (${CREDENTIALS_FILE})`
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
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
    await expect(page.locator('h1')).toContainText('My Stable', { timeout: 15000 });

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Should still be on /stable — not kicked to /login
    await expect(page).toHaveURL(/\/stable/);
    await expect(page.locator('h1')).toContainText('My Stable', { timeout: 15000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — Stable Page Loads
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC3: Stable Page', () => {
  test('stable page loads and shows horse list area', async ({ page }) => {
    await page.goto('/stable', { waitUntil: 'domcontentloaded' });

    // Heading is present
    await expect(page.locator('h1')).toContainText('My Stable', { timeout: 15000 });

    // No uncaught error state (the page renders something beyond a blank screen)
    // Either horses are listed OR an empty-state message appears
    const hasHorses = await page.locator('[data-testid="horse-card"]').count();
    const hasEmpty = await page.locator('text=No horses in this category').count();
    const hasStableSlots = await page.getByText(/Stable Slots/i).count();

    expect(hasHorses + hasEmpty + hasStableSlots).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — Training Session: initiate → result displayed
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC4: Training Session', () => {
  // Always create a fresh horse so it has no training cooldown.
  // Reusing the global-setup horse risks cooldown from previous test runs.
  let trainingHorseId: number | null = null;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    // Obtain a CSRF token — the request context retains the _csrf cookie for subsequent POSTs
    const csrfRes = await request.get('/api/auth/csrf-token');
    if (!csrfRes.ok()) {
      throw new Error(`CSRF token fetch failed: ${csrfRes.status()}`);
    }
    const csrfData = await csrfRes.json();
    const csrfToken = (csrfData as { csrfToken?: string }).csrfToken;
    if (!csrfToken) {
      throw new Error('CSRF token missing from /api/auth/csrf-token response');
    }

    // Fetch a valid breedId — IDs are auto-incremented and do NOT start at 1
    let breedId = 1;
    const breedsRes = await request.get('/api/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Create a fresh training horse with proper auth + CSRF (no bypass headers)
    const res = await request.post('/api/horses', {
      headers: { 'x-csrf-token': csrfToken },
      data: { name: `Training Horse ${Date.now()}`, breedId, age: 5, sex: 'stallion' },
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

  test('training dashboard loads with Training Dashboard heading', async ({ page }) => {
    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    // TrainingDashboardPage uses data-testid="training-dashboard-page"
    await expect(page.locator('[data-testid="training-dashboard-page"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText('Training Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('clicking train button opens TrainingSessionModal', async ({ page }) => {
    // trainingHorseId is guaranteed by beforeAll (throws if horse not created)
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-dashboard-page"]', { timeout: 20000 });

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
    await page.waitForSelector('[data-testid="training-dashboard-page"]', { timeout: 20000 });

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
    await expect(page.locator('[data-testid="competition-name"]')).toBeVisible({ timeout: 5000 });
  });

  test('competition entry flow: Enter Competition → horse selection → confirm', async ({
    page,
  }) => {
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

    // Enter Competition button must be enabled — a disabled button means the feature
    // is broken or the horse is ineligible, both of which are failures, not skip conditions
    const enterBtn = page.locator('[data-testid="enter-button"]');
    await expect(enterBtn).toBeEnabled({ timeout: 10000 });
    await enterBtn.click();

    // EntryConfirmationModal must open
    await expect(page.locator('[data-testid="entry-confirmation-modal"]')).toBeVisible({
      timeout: 10000,
    });

    // Select horse from the selector
    if (horseId) {
      const horseOption = page.locator(`[data-testid="horse-option-${horseId}"]`);
      if (await horseOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await horseOption.click();
      } else {
        const firstHorse = page.locator('[data-testid^="horse-option-"]').first();
        await expect(firstHorse).toBeVisible({ timeout: 5000 });
        await firstHorse.click();
      }
    } else {
      const firstHorse = page.locator('[data-testid^="horse-option-"]').first();
      await expect(firstHorse).toBeVisible({ timeout: 5000 });
      await firstHorse.click();
    }

    // Confirm Entry must be enabled — if not, horse eligibility or feature is broken
    const confirmBtn = page.locator('[data-testid="confirm-button"]');
    await expect(confirmBtn).toBeEnabled({ timeout: 5000 });
    await confirmBtn.click();

    // Success message must appear
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 15000 });
  });
});
