/**
 * E2E fixture: a dedicated player whose horse-list cache key is COLD.
 *
 * WHY (Equoria-6p398.2 / Equoria-gf4kd).
 * `GET /api/v1/horses` caches its rows for 120s under
 * `horses_list:<userId>:all:200:0` — one key per user, identical for every read
 * the app makes (`horsesApi.list()` sends only `?t=`, which the route leaves out
 * of the key). The entry lives inside the backend process, and with the
 * horse-list invalidation defect present (Equoria-gf4kd) NO player-facing route
 * can evict it. So a horse seeded out-of-process is invisible to the page for
 * the rest of that entry's TTL.
 *
 * `tests/e2e/global-setup.ts` warms that key for the shared E2E account roughly
 * a second before any spec's `beforeAll` runs: the onboarding wizard lands on
 * `/stable` (MyStablePage → `useHorses()`) and setup then reads the list again
 * to resolve `E2E_TEST_HORSE_ID`. Retargeting the second read does not help —
 * the `/stable` landing is a real page load in the real onboarding flow and
 * warms the same key on its own. And even a cold key at the end of setup would
 * only help the FIRST seeding spec of a run: every later spec's page loads
 * re-warm the shared account's key before the next spec seeds.
 *
 * The cache key is per USER, so the fix is per user: a player registered and
 * onboarded entirely over the API — no page load, no list read — has never had
 * that key written. Seed its horses BEFORE the browser ever opens a page as
 * that player and the browser's first read is the cache MISS that populates the
 * key from the database, seeded horses included. Worst case in the common path
 * is one HTTP round trip; there is nothing to wait for.
 *
 * Everything here runs over real, player-facing routes:
 *   - `POST /api/v1/auth/register` — public router, no CSRF, sets the auth
 *     cookies and returns a bound CSRF token (authController.register).
 *   - `POST /api/v1/auth/advance-onboarding` with the starter-horse
 *     customization the wizard's final step sends, which takes the player to
 *     step 10 and sets `completedOnboarding: true` (onboardingController) so
 *     `OnboardingGuard` does not bounce every route to `/onboarding`.
 * No test-only route, no bypass header, no route interception, and — the point
 * of the exercise — no dependence on server-side cache invalidation.
 *
 * SCOPE: use this only for a spec whose UI actually reads the cached horse list
 * (today that is `breeding.spec.ts`, via `BreedingPairSelection`). Specs that
 * read a horse through an UNCACHED route — `GET /horses/:id`,
 * `GET /horses/trainable/:userId` — do not need their own player and should
 * stay on the shared global-setup account, whose accumulated setup state
 * (`E2E_TEST_HORSE_ID`, the vetted/fed starter horse, its groom assignment)
 * several other specs rely on.
 *
 * LIFETIME: the player is created per `beforeAll`, i.e. per spec file per
 * worker, and is left in the disposable test database exactly like the account
 * `global-setup.ts` registers. Its storage state is written to the OS temp
 * directory, never into the repository.
 *
 * Usage — the spec's `page` must be the same player that owns the seeded
 * horses. Make the player a WORKER-scoped fixture and derive `storageState`
 * from it; Playwright then builds it in dependency order. Do NOT try to create
 * the player in `beforeAll` and read it back from module state: Playwright
 * resolves `storageState` BEFORE `beforeAll` runs (an auto fixture that depends
 * on `page` pulls `context` → `storageState` in first), so the accessor would
 * fire against an unbuilt player.
 *
 *   const test = base.extend<{ … }, { seededPlayer: SeededPlayerSession }>({
 *     …,
 *     seededPlayer: [
 *       async ({ browser }, use) => {
 *         const player = await createSeededPlayerSession(browser);
 *         await use(player);
 *         await player.context.close();
 *       },
 *       { scope: 'worker' },
 *     ],
 *     storageState: async ({ seededPlayer }, use) => {
 *       await use(seededPlayer.storageStatePath);
 *     },
 *   });
 *
 *   test.beforeAll(async ({ seededPlayer }) => {
 *     await seedOwnedHorses(seededPlayer, [ … ]);   // key is cold: no wait
 *   });
 *
 * Creating the browser context early is harmless — a context issues no requests
 * until the test body navigates, which is always after `beforeAll` has seeded.
 */

import { expect, type Browser } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AuthedSession } from '../helpers/api';

export type SeededPlayerSession = AuthedSession & {
  userId: string;
  email: string;
  username: string;
  /** Path to the storage state the spec's `page` must be created from. */
  storageStatePath: string;
};

/**
 * Origin the browser and this helper must share, mirroring `use.baseURL` in
 * `playwright.config.ts` (the Vite dev server, which proxies /api to the
 * backend). It has to be passed explicitly: `browser.newContext()` inherits the
 * config's context options only inside TEST scope, and this player is built by
 * a WORKER-scoped fixture, where the test-scoped `baseURL` option is not yet
 * resolved — relative URLs there fail with "Invalid URL". Registering through
 * this exact origin also matters for correctness: the auth cookies must be
 * scoped to the host the browser will use.
 */
const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

function storageStateDirectory(): string {
  const dir = path.join(os.tmpdir(), 'equoria-e2e-seeded-players');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Register and onboard a brand-new player over the real API, with no page load
 * and — critically — no read of `GET /api/v1/horses`, so the backend has never
 * cached a horse list for this user.
 *
 * Caller MUST `await session.context.close()` in afterAll to free the context.
 */
export async function createSeededPlayerSession(browser: Browser): Promise<SeededPlayerSession> {
  // No storageState: this context starts anonymous and becomes the new player.
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  const request = context.request;

  const stamp = `${Date.now()}_${randomUUID().slice(0, 8)}`;
  const username = `e2e_seed_${stamp}`.replace(/-/g, '_').slice(0, 30);
  const email = `e2e_seed_${stamp}@example.com`;
  // 12+ chars with all four character classes — the register policy floor
  // (authRoutes.mjs, Equoria-ie4wc). Same shape global-setup.ts uses.
  const password = 'Password123!';

  // ── 1. Register. Public router: no CSRF required, auth cookies come back on
  //       the response and land in this context. Equoria-iqzn: the COPPA gate
  //       is server-authoritative, so use a fixed adult date of birth.
  const registerResponse = await request.post('/api/v1/auth/register', {
    data: {
      firstName: 'E2E',
      lastName: 'Seeded',
      username,
      email,
      password,
      confirmPassword: password,
      dateOfBirth: '1990-01-01',
    },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(
    registerResponse.status(),
    `POST /api/v1/auth/register for the seeded player returned ${registerResponse.status()}: ` +
      `${await registerResponse.text()}`
  ).toBe(201);

  const registerJson = (await registerResponse.json()) as {
    data?: { user?: { id?: string }; csrfToken?: string };
  };
  const userId = registerJson?.data?.user?.id;
  // 21R-AUTH-3: register seeds the CSRF cookie and returns the bound token, so
  // the first mutation needs no /csrf-token round trip.
  const csrfToken = registerJson?.data?.csrfToken;
  expect(typeof userId, 'register must return data.user.id').toBe('string');
  expect(typeof csrfToken, 'register must return data.csrfToken').toBe('string');
  expect(csrfToken!.length, 'register csrfToken must be non-empty').toBeGreaterThan(20);

  // ── 2. Resolve a real breedId. IDs are auto-incremented and do NOT start at 1.
  const breedsResponse = await request.get('/api/v1/breeds');
  expect(
    breedsResponse.ok(),
    `GET /api/v1/breeds returned ${breedsResponse.status()} for the seeded player`
  ).toBe(true);
  const breedsJson = (await breedsResponse.json()) as
    | { data?: Array<{ id: number }> }
    | Array<{ id: number }>;
  const breeds = Array.isArray(breedsJson) ? breedsJson : (breedsJson?.data ?? []);
  expect(breeds.length, 'GET /api/v1/breeds must return at least one breed').toBeGreaterThan(0);

  // ── 3. Finish onboarding through the SAME call the wizard's final step makes.
  //       Sending the starter-horse customization jumps to step 10 and sets
  //       completedOnboarding: true, so OnboardingGuard stops redirecting.
  const onboardingResponse = await request.post('/api/v1/auth/advance-onboarding', {
    data: {
      horseName: `Seeded Starter ${stamp}`.slice(0, 40),
      breedId: breeds[0].id,
      gender: 'Mare',
    },
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken! },
  });
  expect(
    onboardingResponse.ok(),
    `POST /api/v1/auth/advance-onboarding returned ${onboardingResponse.status()}: ` +
      `${await onboardingResponse.text()} — the seeded player would be bounced to /onboarding`
  ).toBe(true);

  // ── 4. Persist the cookie jar for the spec's `page`. Deliberately the LAST
  //       step and deliberately not preceded by any GET /api/v1/horses: the
  //       whole point is that this player's horse-list cache key is still cold.
  const storageStatePath = path.join(storageStateDirectory(), `${username}.json`);
  await context.storageState({ path: storageStatePath });

  return {
    context,
    request,
    csrfToken: csrfToken!,
    userId: userId!,
    email,
    username,
    storageStatePath,
  };
}
