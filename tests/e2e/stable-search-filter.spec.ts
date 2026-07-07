/**
 * Stable Search & Filter E2E (Equoria-oey96.3)
 *
 * Story 3-6 (Horse Search & Filter) shipped its components — HorseSearchBar,
 * HorseFilters, useHorseFilters — but NO ROUTE mounted them: they lived only
 * inside HorseListView, which is never rendered. The live roster page /stable
 * renders StableView, which (before this issue) had only category tabs + a
 * grid toggle + pagination. The tested feature was dead code.
 *
 * This spec drives the REAL /stable page against the REAL backend + DB (no
 * bypass headers, no route interception, no mocks). It MUST fail on the
 * pre-integration code (no search input exists on /stable) and pass once the
 * search/filter surface is wired into StableView.
 *
 * Fixtures: TestFixture-Stable-<runToken>- horses seeded for the logged-in
 * global-setup user via Prisma (the public POST /horses endpoint auto-assigns
 * genetics/age, so a direct write gives us deterministic names + breeds).
 * Cleanup is scoped to the run-token prefix (CLAUDE.md §3 — never a bare
 * deleteMany).
 */

import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import { createAuthedSession, type AuthedSession } from './helpers/api';

// ── Prisma client resolution (mirrors global-setup.ts / coatGenotypeHorses.ts) ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// This spec lives at tests/e2e/ → two levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..');
const prismaClientPath = path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs');

async function getPrisma(): Promise<Record<string, unknown>> {
  const mod = await import(/* @vite-ignore */ prismaClientPath);
  const client = mod.default;
  if (!client) {
    throw new Error('Could not resolve prisma client from packages/database/prismaClient.mjs');
  }
  return client as Record<string, unknown>;
}

// Per-worker unique token so parallel browser projects / retries never collide
// and so the scoped cleanup only ever removes THIS run's rows.
const RUN_TOKEN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const FIXTURE_PREFIX = `TestFixture-Stable-${RUN_TOKEN}-`;
const SOLO_NAME = `${FIXTURE_PREFIX}Solo`;
const A_COUNT = 12; // breedA fixtures (besides Solo)
const B_COUNT = 5; // breedB fixtures
// 18 fixtures + the starter horse ⇒ the All tab always spans >1 page
// (HORSES_PER_PAGE = 12), which the pagination-reset assertion relies on.

let session: AuthedSession;
let breedA: { id: number; name: string };
let breedB: { id: number; name: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
test.beforeAll(async ({ browser }) => {
  session = await createAuthedSession(browser);

  // Resolve the global-setup user's id from the authed profile.
  const profileRes = await session.request.get('/api/v1/auth/profile');
  expect(profileRes.ok(), `GET /api/v1/auth/profile → ${profileRes.status()}`).toBe(true);
  const profileJson = (await profileRes.json()) as any;
  const userId: string | undefined = profileJson?.data?.user?.id ?? profileJson?.data?.id;
  expect(userId, 'resolved E2E user id from profile').toBeTruthy();

  const prisma = (await getPrisma()) as any;

  // Two real breeds so the breed-filter checkboxes (populated from GET /breeds)
  // round-trip against the seeded horses' breed relation.
  const breeds = await prisma.breed.findMany({
    take: 2,
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
  expect(breeds.length, 'canonical DB must have >= 2 breeds').toBeGreaterThanOrEqual(2);
  [breedA, breedB] = breeds;
  expect(breedA.name, 'breedA and breedB must be distinct').not.toBe(breedB.name);

  // dob 35 real days ago ⇒ ~5 game years (7 real days = 1 game year); `age: 5`
  // is set explicitly too so the mare categorisation holds whether the API
  // serves the stored age column or an injected ageYears.
  const dob = new Date();
  dob.setDate(dob.getDate() - 35);

  // colorGenotype + phenotype set so the seed never leaves a NULL-phenotype row
  // (the canonical-DB invariant horseColorNullSentinel guards). All mares so
  // they land in both the All and Mares tabs.
  const base = {
    sex: 'Mare',
    age: 5,
    dateOfBirth: dob,
    userId,
    healthStatus: 'Good',
    colorGenotype: { E_Extension: 'E/e', A_Agouti: 'A/a' },
    phenotype: { colorName: 'Bay' },
  };

  const rows = [
    { ...base, name: SOLO_NAME, breedId: breedA.id },
    ...Array.from({ length: A_COUNT }, (_, i) => ({
      ...base,
      name: `${FIXTURE_PREFIX}A-${i + 1}`,
      breedId: breedA.id,
    })),
    ...Array.from({ length: B_COUNT }, (_, i) => ({
      ...base,
      name: `${FIXTURE_PREFIX}B-${i + 1}`,
      breedId: breedB.id,
    })),
  ];

  await prisma.horse.createMany({ data: rows });
});

test.afterAll(async () => {
  try {
    const prisma = (await getPrisma()) as any;
    // Scoped to this run's prefix only — never a bare deleteMany (CLAUDE.md §3).
    await prisma.horse.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX } } });
  } finally {
    await session?.context.close();
  }
});
/* eslint-enable @typescript-eslint/no-explicit-any */

test.describe('Stable search & filter (/stable) — Story 3-6', () => {
  test('search input filters the roster to a matching horse, resets pagination, and persists in the URL', async ({
    page,
  }) => {
    await page.goto('/stable');

    // AC1/AC2: a search input is present on the live /stable page.
    const search = page.locator('#horse-search-input');
    await expect(search).toBeVisible();

    // Pagination-reset trap: with 18 fixtures + the starter horse the All tab
    // spans >1 page. Jump to page 2, then filter, and assert we return to page 1.
    const page2 = page.getByRole('button', { name: '2', exact: true });
    await expect(page2).toBeVisible();
    await page2.click();
    await expect(page.getByText(/Page 2 of/)).toBeVisible();

    // Typing a seeded horse's unique name narrows the grid to exactly that horse.
    await search.fill(SOLO_NAME);
    // AC3: the filter is reflected in the URL.
    await expect(page).toHaveURL(/[?&]search=/);
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(1);
    // A different fixture is filtered out (not merely paginated away).
    await expect(page.getByText(`${FIXTURE_PREFIX}A-1`, { exact: true })).toHaveCount(0);
    // Pagination reset to page 1 — the page-2 indicator is gone.
    await expect(page.getByText(/Page 2 of/)).toHaveCount(0);
  });

  test('breed filter narrows the roster and persists in the URL', async ({ page }) => {
    await page.goto('/stable');

    const search = page.locator('#horse-search-input');
    await expect(search).toBeVisible();

    // Scope to our fixtures so the counts are deterministic regardless of any
    // other horses on the shared account. Search matches name/breed/traits.
    await search.fill(FIXTURE_PREFIX);
    // The count line reflects the FULL filtered total (not the page slice):
    // Solo + 12 breedA + 5 breedB = 18. Word-boundaried so it can't match a
    // longer count (e.g. "118 horses").
    await expect(page.getByText(/\b18 horses\b/)).toBeVisible();

    // Apply the breedB checkbox → only our 5 breedB fixtures survive.
    const breedBCheckbox = page.getByRole('checkbox', { name: `Filter by ${breedB.name}` });
    await breedBCheckbox.check();

    await expect(page).toHaveURL(new RegExp(`[?&]breeds=${breedB.id}(?:&|$)`));
    // 5 breedB fixtures remain (all fit on page 1 after the filter-driven reset).
    await expect(page.getByText(/\b5 horses\b/)).toBeVisible();
    await expect(page.getByText(`${FIXTURE_PREFIX}B-1`, { exact: true })).toHaveCount(1);
    // Every breedA fixture (incl. Solo) is filtered out entirely.
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(0);
  });

  test('a filter that matches zero horses shows an honest no-results state (not the empty-stable copy)', async ({
    page,
  }) => {
    await page.goto('/stable');

    const search = page.locator('#horse-search-input');
    await expect(search).toBeVisible();

    await search.fill(`${FIXTURE_PREFIX}NoSuchHorse`);
    await expect(page).toHaveURL(/[?&]search=/);

    // Honest no-results state — never the first-use "Your stable is empty" copy
    // while the account actually has horses.
    const noResults = page.getByTestId('empty-state-filtered');
    await expect(noResults).toBeVisible();
    await expect(noResults).toContainText('No horses match your filters');
    await expect(page.getByText('Your stable is empty')).toHaveCount(0);
    // A one-click clear-filters affordance is offered.
    await expect(page.getByTestId('empty-state-primary-action')).toBeVisible();
  });

  test('category tabs still filter and compose with the search box', async ({ page }) => {
    await page.goto('/stable');

    const search = page.locator('#horse-search-input');
    await expect(search).toBeVisible();

    // Narrow to the single Solo mare so the tab assertions are page-independent.
    await search.fill(SOLO_NAME);
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(1);

    // Mares tab: the mare is still shown (search + tab compose).
    await page.getByRole('tab', { name: 'Mares' }).click();
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(1);

    // Foals tab: the mare is filtered out by the category tab (AC4).
    await page.getByRole('tab', { name: 'Foals' }).click();
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(0);

    // Back to Mares: the mare reappears — the tab is doing real filtering.
    await page.getByRole('tab', { name: 'Mares' }).click();
    await expect(page.getByText(SOLO_NAME, { exact: true })).toHaveCount(1);
  });
});
