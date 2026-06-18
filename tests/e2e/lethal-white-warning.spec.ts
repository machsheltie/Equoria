/**
 * Lethal White Warning E2E (Equoria-wrm5, Equoria-wodz follow-up)
 *
 * Verifies the LethalWhiteWarning banner on the BreedingPairSelection page:
 *   (1) Warning RENDERS when both parents are heterozygous frame-overo
 *       (O/n × O/n → 25% O/O lethal-white offspring).
 *   (2) Warning is ABSENT for a well-matched pair with no lethal risk.
 *   (3) Warning is ABSENT for legacy horses whose colorGenotype is null
 *       (backend returns `data: null`, hook surfaces null, banner hides).
 *
 * Implementation notes:
 *   - Uses the seedCoatGenotypeHorses() fixture from a0i6 (with the wrm5
 *     locus-key bug-fix — see fixtures/coatGenotypeHorses.ts).
 *   - No bypass headers. Uses createAuthedSession() to lift the
 *     global-setup user's auth cookies + a real CSRF token.
 *   - Navigates by visible text + role queries (matches the breeding.spec.ts
 *     pattern). Does NOT depend on testids on HorseSelector cards.
 *   - The fixture writes directly through Prisma so we get deterministic
 *     colorGenotype JSONB values that the public POST /horses endpoint
 *     refuses to accept.
 */

import { test as base, expect } from '@playwright/test';
import { createAuthedSession, type AuthedSession } from './helpers/api';
import { seedCoatGenotypeHorses, cleanupCoatGenotypeHorses } from './fixtures/coatGenotypeHorses';

const test = base.extend<{ browserConsole: void }>({
  browserConsole: [
    async ({ page }, use, testInfo) => {
      const consoleLines: string[] = [];
      const errorLines: string[] = [];

      page.on('console', (msg) => {
        consoleLines.push(`[${msg.type()}] ${msg.text()}`);
      });
      page.on('pageerror', (err) => {
        errorLines.push(err.stack ?? err.message);
      });

      await use();

      if (consoleLines.length > 0) {
        await testInfo.attach('browser-console', {
          body: consoleLines.join('\n'),
          contentType: 'text/plain',
        });
      }
      if (errorLines.length > 0) {
        await testInfo.attach('browser-pageerror', {
          body: errorLines.join('\n\n'),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});

type FixtureContext = {
  userId: string;
  breedId: number;
  lethalSireId: number;
  lethalDamId: number;
  safeSireId: number;
  safeDamId: number;
  legacySireId: number;
  legacyDamId: number;
};

test.describe('Lethal White Warning (wrm5)', () => {
  let session: AuthedSession;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    session = await createAuthedSession(browser);

    // ── 1. Resolve userId from /api/v1/auth/me ────────────────────────────────
    const meRes = await session.request.get('/api/v1/auth/me');
    expect(meRes.ok(), `GET /api/v1/auth/me returned ${meRes.status()}`).toBeTruthy();
    const meJson = (await meRes.json()) as Record<string, unknown>;
    // Auth profile responses use { success, data: { user: {...} } } shape.
    const meData = (meJson?.data ?? meJson) as Record<string, unknown>;
    const userObj = (meData?.user ?? meData) as Record<string, unknown>;
    const userId = userObj?.id as string | undefined;
    expect(userId, 'userId must be present in /api/v1/auth/me response').toBeTruthy();

    // ── 2. Resolve a real breedId ────────────────────────────────────────────
    const breedsRes = await session.request.get('/api/v1/breeds');
    expect(breedsRes.ok(), `GET /api/breeds returned ${breedsRes.status()}`).toBeTruthy();
    const breedsJson = await breedsRes.json();
    const breeds = (breedsJson?.data ?? breedsJson ?? []) as Array<{ id: number }>;
    expect(
      Array.isArray(breeds) && breeds.length > 0,
      'at least one breed must exist'
    ).toBeTruthy();
    const breedId = breeds[0].id;

    // ── 3. Seed all three scenarios (idempotent — safe under worker retries) ──
    const lethal = await seedCoatGenotypeHorses({
      userId: userId!,
      breedId,
      scenario: 'frame-overo',
    });
    const safe = await seedCoatGenotypeHorses({
      userId: userId!,
      breedId,
      scenario: 'homozygous-e',
    });
    const legacy = await seedCoatGenotypeHorses({
      userId: userId!,
      breedId,
      scenario: 'legacy-null',
    });

    // Store fixture context for test cases to reference the seeded horses.
    // (Currently unused but needed for future test variations.)
    void {
      userId: userId!,
      breedId,
      lethalSireId: lethal.sireId,
      lethalDamId: lethal.damId,
      safeSireId: safe.sireId,
      safeDamId: safe.damId,
      legacySireId: legacy.sireId,
      legacyDamId: legacy.damId,
    };
  });

  test.afterAll(async () => {
    // Scoped cleanup — only deletes horses with FIXTURE_NAME_PREFIX.
    await cleanupCoatGenotypeHorses();
    await session?.context.close();
  });

  // Helper: select sire + dam by their fixture names, then wait for the
  // CompatibilityPreview block (proves both selections registered).
  async function selectPair(
    page: import('@playwright/test').Page,
    sireName: string,
    damName: string
  ) {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Sire (Stallion)').first()).toBeVisible({ timeout: 20000 });

    const sireBtn = page.getByRole('button', { name: `Select ${sireName}` });
    await expect(sireBtn).toBeVisible({ timeout: 15000 });
    await sireBtn.click();
    await expect(sireBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    const damBtn = page.getByRole('button', { name: `Select ${damName}` });
    await expect(damBtn).toBeVisible({ timeout: 15000 });
    await damBtn.click();
    await expect(damBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  }

  test('AC1: warning banner renders for heterozygous frame-overo pair', async ({ page }) => {
    await selectPair(page, 'WrmFixture-frame-overo-sire', 'WrmFixture-frame-overo-dam');

    // The color-prediction POST fires once both parents are selected. Wait for
    // the actual network response so we don't race the React Query cache.
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/horses/breeding/color-prediction') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 20000 }
    );

    // Warning banner must appear. role="alert" + data-testid both work — we
    // assert via testid because LethalWhiteWarning was built with it.
    const warning = page.getByTestId('lethal-white-warning');
    await expect(warning).toBeVisible({ timeout: 10000 });
    await expect(warning).toContainText(/would not survive birth/i);
    await expect(warning).toContainText(/Lethal foal risk/i);
  });

  test('AC2: warning is absent for a well-matched (no-lethal) pair', async ({ page }) => {
    await selectPair(page, 'WrmFixture-homozygous-e-sire', 'WrmFixture-homozygous-e-dam');

    // Wait for the prediction response so the chart has settled.
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/horses/breeding/color-prediction') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 20000 }
    );

    // Banner must NOT be rendered. Use count() rather than not.toBeVisible()
    // because the component returns null when no lethal risk — there is no
    // node in the DOM at all.
    await expect(page.getByTestId('lethal-white-warning')).toHaveCount(0);
  });

  test('AC3: warning is absent for legacy horses (colorGenotype null)', async ({ page }) => {
    await selectPair(page, 'WrmFixture-legacy-null-sire', 'WrmFixture-legacy-null-dam');

    // Backend returns `{ success: true, data: null }` for legacy pairs.
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/horses/breeding/color-prediction') &&
        resp.request().method() === 'POST' &&
        resp.ok(),
      { timeout: 20000 }
    );

    // The hook surfaces data === null; LethalWhiteWarning returns null;
    // no DOM node should exist.
    await expect(page.getByTestId('lethal-white-warning')).toHaveCount(0);
  });
});
