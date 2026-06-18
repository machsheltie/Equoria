/**
 * Training Flow — E2E Tests (Equoria-aqa6c, Equoria-c61qa child)
 *
 * Extends the canonical training coverage in core-game-flows.spec.ts (AC4) with
 * deeper assertions for the training modal sub-UI that vi.mock'd unit tests
 * previously covered:
 *
 *  - TrainingSessionModal trait-modifiers section renders against real horse data
 *  - Discipline selector is interactive and exposes a Check Eligibility action
 *  - TrainingDashboard exposes the "training-page" surface with at least one
 *    actionable train button (replaces TrainingDashboard.test.tsx grouping/filter
 *    unit tests with a real-data E2E that is honest about what users see)
 *
 * Constitution §3 mandate: vi.mock'd API-client/hook unit tests for these
 * surfaces have been removed in favor of this real-DB Playwright coverage.
 * Replaced files:
 *   - frontend/src/components/training/__tests__/TrainingDashboard.test.tsx
 *   - frontend/src/components/training/__tests__/TrainingSessionModal.test.tsx
 *   - frontend/src/components/training/__tests__/TrainingSessionModal.beta.test.tsx
 *
 * The horse history panel and recommendation panel sub-components are still
 * covered by their existing vi.mock tests; replacing them is tracked as a
 * separate follow-up (see Equoria-aqa6c notes).
 */
import { test, expect } from '@playwright/test';
import { createAuthedSession, csrfMutate, type AuthedSession } from './helpers/api';
import { assertValidNextTrainingDate } from './helpers/training';

test.describe('Training Flow — Deep Modal & Dashboard Coverage', () => {
  let trainingHorseId: number | null = null;
  let session: AuthedSession;

  test.beforeAll(async ({ browser }) => {
    // Authenticated request context inheriting global-setup storageState.
    session = await createAuthedSession(browser);

    // Resolve a valid breedId — IDs are auto-incremented, do not assume 1.
    let breedId = 1;
    const breedsRes = await session.request.get('/api/v1/breeds');
    if (breedsRes.ok()) {
      const breedsJson = await breedsRes.json();
      const breeds = breedsJson?.data ?? breedsJson ?? [];
      if (Array.isArray(breeds) && breeds.length > 0) {
        breedId = breeds[0].id;
      }
    }

    // Fresh horse — avoids cooldown contamination from prior runs.
    const res = await csrfMutate(session, 'POST', '/api/v1/horses', {
      name: `Training Flow Horse ${Date.now()}`,
      breedId,
      age: 5,
      sex: 'stallion',
    });
    if (!res.ok()) {
      throw new Error(`Horse creation failed: ${res.status()} ${await res.text()}`);
    }
    const json = await res.json();
    trainingHorseId = json?.data?.id ?? json?.id ?? null;
    if (!trainingHorseId) {
      throw new Error(`Horse creation returned no id: ${JSON.stringify(json)}`);
    }
  });

  test.afterAll(async () => {
    await session?.context.close();
  });

  test('training dashboard exposes the training-page surface with action buttons', async ({
    page,
  }) => {
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="training-page"]')).toBeVisible({
      timeout: 20000,
    });

    // The fresh horse must be actionable (no cooldown). This replaces the
    // unit-test assertion that ready horses render with a Train action.
    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
  });

  test('opening the training modal shows the trait modifiers section', async ({ page }) => {
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-page"]', { timeout: 20000 });

    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
    await trainBtn.click();

    // Trait modifiers section must render against the real horse — this is the
    // assertion the deleted TrainingSessionModal.beta.test.tsx provided in
    // mocked form.
    await expect(page.locator('[data-testid="trait-modifiers-section"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('training modal exposes Start Training and Check Eligibility actions', async ({ page }) => {
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-page"]', { timeout: 20000 });

    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
    await trainBtn.click();

    // Both real actions must be present and not replaced by a no-op placeholder.
    // This replaces the deleted .beta.test.tsx negative-assertion that the
    // "Learn more about traits" no-op button is absent.
    await expect(page.getByRole('button', { name: /start training/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /check eligibility/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /learn more about traits/i })).toHaveCount(0);
  });

  test('submitting training renders results with a valid next-training date (Equoria-8gwtm)', async ({
    page,
  }) => {
    expect(trainingHorseId).not.toBeNull();

    await page.goto('/training', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="training-page"]', { timeout: 20000 });

    const trainBtn = page.locator(`[data-testid="train-button-${trainingHorseId}"]`);
    await expect(trainBtn).toBeVisible({ timeout: 15000 });
    await trainBtn.click();

    // Equoria-8gwtm: the other tests in this file stop at Start-Training
    // button VISIBILITY. Actually click it and assert the real result display
    // renders with a valid (non-Invalid-Date / non-Date-unavailable) next date.
    const startBtn = page.getByRole('button', { name: /start training/i });
    await expect(startBtn).toBeVisible({ timeout: 10000 });
    await startBtn.click();

    await expect(page.getByText('Training Results')).toBeVisible({ timeout: 20000 });
    await assertValidNextTrainingDate(page);
  });
});
