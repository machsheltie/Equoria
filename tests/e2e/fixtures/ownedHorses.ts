/**
 * E2E fixture: seed horses owned by the authenticated test user.
 *
 * WHY THIS EXISTS (Equoria-6p398.2, 2026-09-05 security audit Finding 2):
 * six specs used `POST /api/v1/horses` as their fixture factory. That endpoint
 * handed any authenticated player a free horse with no payment, entitlement or
 * cap, and is now closed (403). The specs still need horses with a SPECIFIC
 * name, sex and age (they select horses by name in the UI, and breeding needs a
 * stallion + mare at or above the 3-game-year minimum), which no legitimate
 * player-facing route provides: the Horse Trader always generates its own name
 * and a fixed age of 3, and foaling needs parents to already exist.
 *
 * So the fixtures are seeded from the spec's own Node process through
 * `createHorseFromRequest` — the exact server-owned creation pipeline the closed
 * route used to run (breed genetics → conformation + gait scores → temperament →
 * genotype/phenotype/markings → the `createHorse` model function). Calling the
 * SERVICE rather than the bare model function matters: the model function alone
 * leaves `conformationScores`, `gaitScores` and `temperament` NULL, so the
 * seeded horse would differ from the one these specs were written against. The
 * spec never touches a player-facing creation route.
 *
 * This mirrors the established pattern in `tests/e2e/fixtures/coatGenotypeHorses.ts`
 * and the Prisma seeding already used by the readiness specs.
 *
 * THE HORSE-LIST CACHE (why seeding alone is not enough).
 * `GET /api/v1/horses` is served through `getCachedQuery('horses:list:<user>:…',
 * …, 120s)`. Its cache key ignores the client's `?t=` cache-buster, and with no
 * Redis the entry lives in the BACKEND process's in-memory map — unreachable
 * from this process. `POST /api/v1/horses` used to call
 * `invalidateCachePattern(...)` in-process after each create; a Node-side seed
 * cannot reach the server's cache. Without an equivalent, a page that loaded
 * the list before the seed keeps serving a stale list for up to two minutes and
 * the new horse never appears in the UI (observed: breeding.spec.ts could not
 * find `Select E2E Stallion …`).
 *
 * The fix uses a REAL player-facing route rather than a test hook: after the
 * insert the fixture issues `PUT /api/v1/horses/:id` with the horse's own name
 * through the authenticated session and real CSRF. That route runs the genuine
 * ownership middleware (so it also proves the seeded horse belongs to the
 * session user) and ends by invalidating the horse-list cache inside the
 * backend process — the invalidation the closed create route used to perform.
 * (That invalidation was itself broken until Equoria-6p398.2: it used the
 * pattern `horses:list:*` while `generateCacheKey` writes `horses_list:…`. See
 * backend/modules/horses/__tests__/horseListCacheInvalidation.test.mjs.)
 *
 * NOT PERMITTED here and deliberately absent: production test-only routes,
 * `x-test-*` bypass headers, and Playwright route interception of a primary
 * API path. Those are not readiness evidence.
 *
 * LIFETIME: no delete helper is exposed, and the migration deliberately does
 * not change any spec's fixture lifecycle. These horses belong to the
 * throwaway per-run account that `tests/e2e/global-setup.ts` registers, every
 * caller already suffixes its names with `Date.now()`, and several of them
 * become a foal's sire/dam or accumulate training/feed history — so a blanket
 * teardown would trip `Horse.userId`/parentage FK restrictions rather than
 * tidy up. Callers that DO need teardown should delete by explicit id in FK
 * order from their own `afterAll`, never by name pattern and never with a bare
 * deleteMany.
 *
 * Specs whose subject IS an HTTP route family should buy from the Horse Trader
 * (`POST /api/v1/marketplace/store/buy`) instead of using this helper — see
 * `tests/e2e/readiness/route-families.spec.ts`.
 *
 * Usage:
 *
 *   import { seedOwnedHorse } from './fixtures/ownedHorses';
 *
 *   const stallion = await seedOwnedHorse(session, {
 *     breedId, name: `E2E Stallion ${suffix}`, sex: 'stallion', age: 5,
 *   });
 */

import { expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { csrfMutate, type AuthedSession } from '../helpers/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const createHorseServicePath = path.join(
  projectRoot,
  'backend',
  'modules',
  'horses',
  'services',
  'createHorseService.mjs'
);

export type SeededHorse = { id: number; name: string; sex: string };

export interface SeedOwnedHorseOptions {
  breedId: number;
  /** Exact name; specs select horses by name in the UI, so it is NOT rewritten. */
  name: string;
  sex: 'stallion' | 'mare' | 'Stallion' | 'Mare';
  /** Age in GAME years; the service derives dateOfBirth at 7 real days each. */
  age: number;
  healthStatus?: string;
}

type CreatedHorse = { id: number; name: string; sex: string };
type CreateHorseFromRequestFn = (
  _body: Record<string, unknown>,
  _userId: string
) => Promise<{ status: number; body: { success: boolean; message?: string; data?: CreatedHorse } }>;

// Dynamic import so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the coatGenotypeHorses pattern).
async function getCreateHorseFromRequest(): Promise<CreateHorseFromRequestFn> {
  const mod = await import(/* @vite-ignore */ createHorseServicePath);
  const fn = (mod as { createHorseFromRequest?: CreateHorseFromRequestFn }).createHorseFromRequest;
  if (typeof fn !== 'function') {
    throw new Error(
      `Could not resolve createHorseFromRequest from ${createHorseServicePath} — the E2E ` +
        'horse fixture must use the real creation pipeline, not a raw prisma.horse.create.'
    );
  }
  return fn;
}

/**
 * Resolve the authenticated session user's id via the real profile endpoint.
 * Fails loudly — a missing id means storageState is stale and every seeded
 * horse would land on the wrong owner.
 */
async function resolveSessionUserId(session: AuthedSession): Promise<string> {
  const response = await session.request.get('/api/v1/auth/profile');
  expect(
    response.ok(),
    `GET /api/v1/auth/profile returned ${response.status()} — is global-setup storageState valid?`
  ).toBe(true);
  const json = (await response.json()) as { data?: { user?: { id?: string } } };
  const userId = json?.data?.user?.id;
  expect(typeof userId, 'auth/profile must return data.user.id').toBe('string');
  return userId!;
}

/**
 * Create one horse owned by the session user through the real creation
 * pipeline, then publish it to the backend's horse list via a real
 * `PUT /api/v1/horses/:id` (see "THE HORSE-LIST CACHE" above). Returns the
 * persisted row.
 */
export async function seedOwnedHorse(
  session: AuthedSession,
  options: SeedOwnedHorseOptions
): Promise<SeededHorse> {
  const { breedId, name, sex, age, healthStatus = 'Excellent' } = options;
  const userId = await resolveSessionUserId(session);
  const createHorseFromRequest = await getCreateHorseFromRequest();

  // Same request shape the specs used to POST. The service derives dateOfBirth
  // from `age` at 7 real days per game year, so getHorseAgeYears() reads the
  // intended age back and the 3-game-year breeding gate behaves.
  const result = await createHorseFromRequest({ name, breedId, sex, age, healthStatus }, userId);

  const horse = result?.body?.data;
  if (result?.status !== 201 || !horse?.id) {
    throw new Error(
      `Horse fixture "${name}" was not created: status ${result?.status}, body ${JSON.stringify(result?.body)}`
    );
  }

  // Real route, real auth, real ownership middleware, real CSRF. A no-op rename
  // to the horse's own name; its purpose is the horse-list cache invalidation
  // the route performs INSIDE the backend process, so the freshly seeded horse
  // is visible to the very next GET /api/v1/horses instead of hiding behind the
  // 120s list cache (this fixture runs in a different process, so its own
  // invalidation cannot reach the server's cache). A non-2xx here means the
  // horse is not owned by / visible to the session user, which must fail loudly.
  const publish = await csrfMutate(session, 'PUT', `/api/v1/horses/${horse.id}`, { name });
  expect(
    publish.ok(),
    `PUT /api/v1/horses/${horse.id} (list-cache publish for "${name}") returned ${publish.status()}: ${await publish.text()}`
  ).toBe(true);

  return { id: horse.id, name: horse.name, sex: horse.sex };
}
