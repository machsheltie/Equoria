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
 *   - No bypass headers. Runs as its OWN player (fixtures/seededPlayer.ts),
 *     registered and onboarded over the real API with no horse-list read, so
 *     the horses seeded below are in the first GET /api/v1/horses the
 *     breeding page makes. On the shared global-setup account that list was
 *     already cached server-side for 120s by earlier page loads, so the
 *     seeded pairs could be invisible to /breeding (Equoria-dz3jj).
 *   - Navigates by visible text + role queries (matches the breeding.spec.ts
 *     pattern). Does NOT depend on testids on HorseSelector cards.
 *   - The fixture writes directly through Prisma so we get deterministic
 *     colorGenotype JSONB values that the public POST /horses endpoint
 *     refuses to accept.
 */

import { test as base, expect } from '@playwright/test';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';
import { seedCoatGenotypeHorses, cleanupCoatGenotypeHorses } from './fixtures/coatGenotypeHorses';

const test = base.extend<{ browserConsole: void }, { seededPlayer: SeededPlayerSession }>({
  // Equoria-dz3jj: a dedicated player whose horse-list cache key is cold.
  // Worker-scoped, and `storageState` derives from it, so every test's `page`
  // is this player (see the usage notes in fixtures/seededPlayer.ts).
  seededPlayer: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
  storageState: async ({ seededPlayer }, use) => {
    await use(seededPlayer.storageStatePath);
  },
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

test.describe('Lethal White Warning (wrm5)', () => {
  let ownerId: string;

  // Seeds BEFORE any page opens as this player, so the breeding page's first
  // horse-list read is the cache miss that loads these rows from the database.
  test.beforeAll(async ({ seededPlayer }) => {
    test.setTimeout(120000);
    ownerId = seededPlayer.userId;

    // ── 1. Resolve a real breedId ────────────────────────────────────────────
    const breedsRes = await seededPlayer.request.get('/api/v1/breeds');
    expect(breedsRes.ok(), `GET /api/v1/breeds returned ${breedsRes.status()}`).toBeTruthy();
    const breedsJson = await breedsRes.json();
    const breeds = (breedsJson?.data ?? breedsJson ?? []) as Array<{ id: number }>;
    expect(
      Array.isArray(breeds) && breeds.length > 0,
      'at least one breed must exist'
    ).toBeTruthy();
    const breedId = breeds[0].id;

    // ── 2. Seed all three scenarios (idempotent — safe under worker retries) ──
    for (const scenario of ['frame-overo', 'homozygous-e', 'legacy-null'] as const) {
      await seedCoatGenotypeHorses({ userId: ownerId, breedId, scenario });
    }
  });

  test.afterAll(async () => {
    // Scoped cleanup — only this player's horses with FIXTURE_NAME_PREFIX.
    if (ownerId) {
      await cleanupCoatGenotypeHorses(ownerId);
    }
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
