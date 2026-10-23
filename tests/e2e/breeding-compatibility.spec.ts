/**
 * Breeding compatibility renders the live payload — never 75/80/70/75
 * (Equoria-3jnsz, from Equoria-m54lr).
 *
 * m54lr removed a fabrication: the confirmation summary read fields the API
 * never sends and fell back to 75/80/70/75 plus three canned recommendation
 * lines on EVERY pair, right before the player commits to a breeding. The
 * summary now shows POST /api/v1/genetics/breeding-compatibility verbatim.
 * Component tests cover that with a mocked boundary; this spec proves it on the
 * real stack: the rendered score, verdict and sub-metrics are the values the
 * real backend returned for this pair, and the retired fabrications never
 * appear.
 *
 * The player is registered and onboarded over the real API with a cold
 * horse-list cache (fixtures/seededPlayer.ts); the pair is seeded through the
 * real createHorse model function (fixtures/ownedHorses.ts). No route
 * interception, no bypass headers, no skips.
 */
import { test as base, expect } from '@playwright/test';
import { seedOwnedHorses } from './fixtures/ownedHorses';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';

type Pair = { stallionName: string; mareName: string };

const test = base.extend<object, { seededPlayer: SeededPlayerSession; pair: Pair }>({
  seededPlayer: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
  pair: [
    async ({ seededPlayer }, use) => {
      const breedsRes = await seededPlayer.request.get('/api/v1/breeds');
      expect(breedsRes.ok(), `GET /api/v1/breeds returned ${breedsRes.status()}`).toBe(true);
      const breedsJson = await breedsRes.json();
      const breeds = (breedsJson?.data ?? breedsJson ?? []) as Array<{ id: number }>;
      expect(breeds.length, 'at least one breed must exist').toBeGreaterThan(0);
      const suffix = Date.now();
      const pair = {
        stallionName: `E2E Compat Stallion ${suffix}`,
        mareName: `E2E Compat Mare ${suffix}`,
      };
      // One call, before any page opens as this player, so the breeding page's
      // first horse-list read includes both (see fixtures/ownedHorses.ts).
      await seedOwnedHorses(seededPlayer, [
        { breedId: breeds[0].id, name: pair.stallionName, sex: 'stallion', age: 5 },
        { breedId: breeds[0].id, name: pair.mareName, sex: 'mare', age: 5 },
      ]);
      await use(pair);
    },
    { scope: 'worker' },
  ],
  storageState: async ({ seededPlayer, pair: _pair }, use) => {
    // Depends on `pair` so the horses exist before the page opens.
    await use(seededPlayer.storageStatePath);
  },
});

/** The three canned lines the retired fallback rendered on every pair. */
const retiredRecommendations = [
  'Compatible temperaments for stable offspring',
  'Good genetic diversity reduces inbreeding risk',
  'Strong trait synergy for athletic abilities',
];

type Compatibility = {
  overallScore: number;
  geneticCompatibility: number;
  diversityImpact: number;
  inbreedingRisk: number;
  recommendation: string;
};

test.describe('Breeding compatibility — live payload (Equoria-3jnsz)', () => {
  test('the confirmation summary shows the real compatibility payload and no fabrications', async ({
    page,
    pair,
  }) => {
    await page.goto('/breeding', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Sire (Stallion)').first()).toBeVisible({ timeout: 20000 });

    // The compatibility query starts once both parents are selected.
    const compatibilityRes = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/genetics/breeding-compatibility') &&
        resp.request().method() === 'POST',
      { timeout: 30000 }
    );

    const sireBtn = page.getByRole('button', { name: `Select ${pair.stallionName}` });
    await expect(sireBtn).toBeVisible({ timeout: 15000 });
    await sireBtn.click();
    await expect(sireBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
    const damBtn = page.getByRole('button', { name: `Select ${pair.mareName}` });
    await expect(damBtn).toBeVisible({ timeout: 15000 });
    await damBtn.click();
    await expect(damBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    const response = await compatibilityRes;
    expect(
      response.status(),
      `breeding-compatibility returned ${response.status()}: ${await response.text()}`
    ).toBe(200);
    const body = (await response.json()) as { data?: Compatibility };
    const live = body.data;
    expect(live, 'breeding-compatibility must return a payload').toBeTruthy();
    for (const field of [
      'overallScore',
      'geneticCompatibility',
      'diversityImpact',
      'inbreedingRisk',
    ] as const) {
      expect(typeof live![field], `${field} must be a number`).toBe('number');
    }

    const initiateBtn = page.getByRole('button', { name: 'Initiate Breeding' });
    await expect(initiateBtn).toBeEnabled({ timeout: 10000 });
    await initiateBtn.click();
    const modal = page.getByTestId('breeding-confirmation-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Rendered values are the live payload, verbatim.
    await expect(modal.getByText(`${live!.overallScore}/100`, { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(modal.getByText(live!.recommendation, { exact: true })).toBeVisible();
    const metric = (label: string) =>
      modal.getByText(label, { exact: true }).locator('xpath=following-sibling::p[1]');
    await expect(metric('Genetic Compatibility')).toHaveText(String(live!.geneticCompatibility));
    await expect(metric('Diversity Impact')).toHaveText(String(live!.diversityImpact));
    await expect(metric('Inbreeding Risk')).toHaveText(
      `${(live!.inbreedingRisk * 100).toFixed(1)}%`
    );

    // The retired fabrications never render. 75/100 is only legitimate when the
    // backend really scored this pair 75.
    if (live!.overallScore !== 75) {
      await expect(modal.getByText('75/100', { exact: true })).toHaveCount(0);
    }
    for (const line of retiredRecommendations) {
      await expect(page.getByText(line)).toHaveCount(0);
    }
    for (const retiredLabel of ['Temperament Match', 'Trait Synergy']) {
      await expect(modal.getByText(retiredLabel)).toHaveCount(0);
    }
  });
});
