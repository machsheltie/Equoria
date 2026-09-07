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
 * ── HOW A SEEDED HORSE IS PROVEN, AND HOW IT REACHES THE PAGE ────────────────
 *
 * 1. OWNERSHIP AND PERSISTENCE — always. After the insert the fixture reads
 *    each horse back through `GET /api/v1/horses/:id`. That route is guarded by
 *    `requireOwnership('horse')` and is NOT cached, so one round trip proves the
 *    row exists AND belongs to the session user. It replaces the no-op
 *    `PUT /api/v1/horses/:id` this fixture used to issue: the PUT existed only
 *    to make the SERVER invalidate its horse-list cache, which is exactly the
 *    behaviour this fixture must no longer depend on (Equoria-gf4kd).
 *
 * 2. HORSE-LIST VISIBILITY — when the spec's UI reads the cached list.
 *    `GET /api/v1/horses` serves its rows through `getCachedQuery(...)` for 120s
 *    under `generateCacheKey('horses:list', userId, breedId, limit, offset)`.
 *    Three facts decide everything:
 *      a. the key is PER USER (`effectiveUserId` is always `req.user.id` for a
 *         non-admin, even when the client sends `?userId=`);
 *      b. it is CONSTANT for every read the app makes — `horsesApi.list()` sends
 *         only `?t=<Date.now()>` and the route leaves `t` out of the key, so
 *         MyStablePage, AsidePanel and BreedingPairSelection all land on
 *         `horses_list:<userId>:all:200:0`;
 *      c. the entry lives in the BACKEND process, so the in-process
 *         invalidation `createHorseFromRequest` performs after its insert never
 *         reaches it from this worker — and with Equoria-gf4kd present no
 *         player-facing route can evict it either.
 *    The only honest way to be immediately visible is therefore to seed while
 *    that key is COLD, and let the browser's first read be the miss that
 *    populates it from the database. A player registered and onboarded purely
 *    over the API has never had the key written — see
 *    `tests/e2e/fixtures/seededPlayer.ts`. The fixture asserts the cold-key
 *    invariant with ONE `GET /api/v1/horses` (the same request, and therefore
 *    the same cache key, the page will issue): it must already contain every
 *    seeded horse. That single read doubles as the cache fill, so the browser's
 *    first read is a hit that already has them. Worst case: one round trip.
 *    There is no polling and nothing to wait out — a list that comes back
 *    WITHOUT the seeded horses means the invariant was broken (something read
 *    this user's list before the seed), which is a real failure, not a slow
 *    pass, and is reported as such.
 *
 *    Pass `requireHorseListVisibility: false` when — and only when — the spec
 *    never renders a surface backed by that cached list. Those specs stay on the
 *    shared global-setup account, whose key `global-setup.ts` necessarily warms
 *    while completing the real onboarding wizard. State the reason at the call
 *    site. Uncached horse reads, which need no seeded player:
 *    `GET /horses/:id` (horse detail, equip) and
 *    `GET /horses/trainable/:userId` (the Training Grounds dashboard).
 *
 * NOT PERMITTED here and deliberately absent: production test-only routes,
 * `x-test-*` bypass headers, cache-disable env flags, Playwright route
 * interception of a primary API path, and any dependence on the server-side
 * list-cache invalidation working. Those are not readiness evidence.
 *
 * LIFETIME: no delete helper is exposed, and the migration deliberately does
 * not change any spec's fixture lifecycle. These horses belong to a throwaway
 * per-run account, every caller already suffixes its names with `Date.now()`,
 * and several of them become a foal's sire/dam or accumulate training/feed
 * history — so a blanket teardown would trip `Horse.userId`/parentage FK
 * restrictions rather than tidy up. Callers that DO need teardown should delete
 * by explicit id in FK order from their own `afterAll`, never by name pattern
 * and never with a bare deleteMany.
 *
 * Specs whose subject IS an HTTP route family should buy from the Horse Trader
 * (`POST /api/v1/marketplace/store/buy`) instead of using this helper — see
 * `tests/e2e/readiness/route-families.spec.ts`.
 *
 * Usage:
 *
 *   import { seedOwnedHorses } from './fixtures/ownedHorses';
 *
 *   const [stallion, mare] = await seedOwnedHorses(session, [
 *     { breedId, name: `E2E Stallion ${suffix}`, sex: 'stallion', age: 5 },
 *     { breedId, name: `E2E Mare ${suffix}`, sex: 'mare', age: 5 },
 *   ]);
 */

import { expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AuthedSession } from '../helpers/api';

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

/**
 * Attempts allowed for the horse-list read. Retries exist ONLY for a transport
 * or rate-limiter hiccup (a non-200). A 200 whose body lacks the seeded horses
 * is never retried — that is the cold-key invariant failing, and waiting would
 * turn a real defect into a slow pass.
 */
const LIST_READ_ATTEMPTS = 3;
const LIST_READ_RETRY_DELAY_MS = 500;

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

export interface SeedOwnedHorsesOptions {
  /**
   * Assert the seeded horses are in the session user's cached horse list —
   * required for any spec whose UI renders that list. Defaults to TRUE so the
   * safe behaviour is the default; opt out explicitly, with a reason, only when
   * the spec reads its horses exclusively through uncached routes. See the
   * "HORSE-LIST VISIBILITY" note above.
   */
  requireHorseListVisibility?: boolean;
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
 * Fails loudly — a missing id means the session is stale and every seeded
 * horse would land on the wrong owner.
 */
async function resolveSessionUserId(session: AuthedSession): Promise<string> {
  const response = await session.request.get('/api/v1/auth/profile');
  expect(
    response.ok(),
    `GET /api/v1/auth/profile returned ${response.status()} — is the session storageState valid?`
  ).toBe(true);
  const json = (await response.json()) as { data?: { user?: { id?: string } } };
  const userId = json?.data?.user?.id;
  expect(typeof userId, 'auth/profile must return data.user.id').toBe('string');
  return userId!;
}

/**
 * Read the seeded horse back through the real, UNCACHED, ownership-guarded
 * detail route. Proves both persistence and that the session user owns it.
 */
async function assertOwnedBySession(session: AuthedSession, horse: SeededHorse): Promise<void> {
  const response = await session.request.get(`/api/v1/horses/${horse.id}`);
  expect(
    response.ok(),
    `GET /api/v1/horses/${horse.id} ("${horse.name}") returned ${response.status()}: ` +
      `${await response.text()} — the seeded horse is not owned by, or not visible to, the ` +
      'session user. That route runs requireOwnership("horse") and is not cached, so a ' +
      'non-2xx here is an ownership or persistence failure, never a caching one.'
  ).toBe(true);
}

/**
 * Assert the seeded horses are already in the session user's horse list — the
 * exact request, and therefore the exact cache key, the browser will read.
 * See "HORSE-LIST VISIBILITY" above for why this must pass on the first 200.
 */
async function assertVisibleInHorseList(session: AuthedSession, names: string[]): Promise<void> {
  let lastStatus = 0;
  let lastBody = '';

  for (let attempt = 1; attempt <= LIST_READ_ATTEMPTS; attempt++) {
    // No query parameters: the route keys its cache on
    // (userId, breedId ?? 'all', limit=200, offset=0), so this resolves to the
    // same entry `horsesApi.list()` reads from the browser.
    const response = await session.request.get('/api/v1/horses');
    lastStatus = response.status();

    if (!response.ok()) {
      lastBody = await response.text();
      if (attempt < LIST_READ_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, LIST_READ_RETRY_DELAY_MS));
        continue;
      }
      break;
    }

    const json = (await response.json()) as
      | { data?: Array<{ name?: string }> }
      | Array<{ name?: string }>;
    const rows = Array.isArray(json) ? json : (json?.data ?? []);
    const present = new Set(rows.map((row) => row?.name));
    const missing = names.filter((name) => !present.has(name));

    // A 200 is authoritative: either the cold-key invariant held or it did not.
    expect(
      missing,
      `GET /api/v1/horses did not contain the seeded horses (list had ${rows.length} row(s)). ` +
        'That list is cached per user for 120s under horses_list:<userId>:all:200:0 and, with ' +
        'Equoria-gf4kd present, nothing can evict it — so this means something read this ' +
        "user's horse list BEFORE the seed and the browser will not see these horses either. " +
        'Seed into a player whose list has never been read (createSeededPlayerSession in ' +
        'tests/e2e/fixtures/seededPlayer.ts), or pass requireHorseListVisibility: false if ' +
        'this spec genuinely never renders the cached horse list.'
    ).toEqual([]);
    return;
  }

  throw new Error(
    `GET /api/v1/horses never answered 200 while verifying the seeded horses ` +
      `(${LIST_READ_ATTEMPTS} attempts, last status ${lastStatus}): ${lastBody}`
  );
}

/**
 * Create one horse owned by the session user through the real creation
 * pipeline. Verification happens in `seedOwnedHorses`, once per group.
 */
async function createOwnedHorse(
  createHorseFromRequest: CreateHorseFromRequestFn,
  userId: string,
  options: SeedOwnedHorseOptions
): Promise<SeededHorse> {
  const { breedId, name, sex, age, healthStatus = 'Excellent' } = options;

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

  return { id: horse.id, name: horse.name, sex: horse.sex };
}

/**
 * Seed every horse a spec needs in ONE call, verify each one is owned by the
 * session user, and (unless opted out) verify they are already in the cached
 * horse list the browser reads. Returns the persisted rows in the order
 * requested.
 */
export async function seedOwnedHorses(
  session: AuthedSession,
  horses: SeedOwnedHorseOptions[],
  options: SeedOwnedHorsesOptions = {}
): Promise<SeededHorse[]> {
  expect(horses.length, 'seedOwnedHorses needs at least one horse to seed').toBeGreaterThan(0);
  const { requireHorseListVisibility = true } = options;

  const userId = await resolveSessionUserId(session);
  const createHorseFromRequest = await getCreateHorseFromRequest();

  const seeded: SeededHorse[] = [];
  for (const horse of horses) {
    seeded.push(await createOwnedHorse(createHorseFromRequest, userId, horse));
  }

  for (const horse of seeded) {
    await assertOwnedBySession(session, horse);
  }

  if (requireHorseListVisibility) {
    await assertVisibleInHorseList(
      session,
      seeded.map((horse) => horse.name)
    );
  }

  return seeded;
}

/**
 * Seed a single horse owned by the session user. Sugar over `seedOwnedHorses` —
 * when a spec needs more than one horse, seed them together so the list check
 * runs once for the whole group.
 */
export async function seedOwnedHorse(
  session: AuthedSession,
  horse: SeedOwnedHorseOptions,
  options: SeedOwnedHorsesOptions = {}
): Promise<SeededHorse> {
  const [seeded] = await seedOwnedHorses(session, [horse], options);
  return seeded;
}
