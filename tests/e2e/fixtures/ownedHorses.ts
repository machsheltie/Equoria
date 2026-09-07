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
 * So the fixtures are seeded from the spec's own Node process through the REAL
 * `createHorse` model function — the same function registration, the paid Horse
 * Trader purchase and foaling all call. That means the seeded horse goes
 * through the genuine pipeline (Equoria-ennm auto-generates `colorGenotype` +
 * `phenotype`, so no NULL-phenotype rows leak into the E2E database) and the
 * spec never touches a player-facing creation route.
 *
 * This mirrors the established pattern in `tests/e2e/fixtures/coatGenotypeHorses.ts`
 * and the Prisma seeding already used by the readiness specs.
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
 *   import { resolveSessionUserId, seedOwnedHorse } from './fixtures/ownedHorses';
 *
 *   const userId = await resolveSessionUserId(session);
 *   const stallion = await seedOwnedHorse({
 *     userId, breedId, name: `E2E Stallion ${suffix}`, sex: 'stallion', age: 5,
 *   });
 */

import { expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AuthedSession } from '../helpers/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const horseModelPath = path.join(
  projectRoot,
  'backend',
  'modules',
  'horses',
  'services',
  'horseModelService.mjs'
);

/** Equoria game-year cadence: 7 real days = 1 game year (backend/constants/time.mjs). */
const MS_PER_GAME_YEAR = 7 * 24 * 60 * 60 * 1000;

export type SeededHorse = { id: number; name: string; sex: string };

export interface SeedOwnedHorseOptions {
  /** Owner — the authenticated E2E user (see resolveSessionUserId). */
  userId: string;
  breedId: number;
  /** Exact name; specs select horses by name in the UI, so it is NOT rewritten. */
  name: string;
  sex: 'stallion' | 'mare' | 'Stallion' | 'Mare';
  /** Age in GAME years. dateOfBirth is derived at 7 real days per game year. */
  age: number;
  healthStatus?: string;
}

type CreateHorseFn = (_data: Record<string, unknown>) => Promise<{
  id: number;
  name: string;
  sex: string;
}>;

// Dynamic imports so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the coatGenotypeHorses pattern).
async function getCreateHorse(): Promise<CreateHorseFn> {
  const mod = await import(/* @vite-ignore */ horseModelPath);
  const createHorse = (mod as { createHorse?: CreateHorseFn }).createHorse;
  if (typeof createHorse !== 'function') {
    throw new Error(
      `Could not resolve createHorse from ${horseModelPath} — the E2E horse fixture ` +
        'must use the real model function, not a raw prisma.horse.create.'
    );
  }
  return createHorse;
}

/**
 * Resolve the authenticated session user's id via the real profile endpoint.
 * Fails loudly — a missing id means storageState is stale and every seeded
 * horse would land on the wrong owner.
 */
export async function resolveSessionUserId(session: AuthedSession): Promise<string> {
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
 * Create one horse owned by `userId` through the real createHorse model
 * function. Returns the persisted row.
 */
export async function seedOwnedHorse(options: SeedOwnedHorseOptions): Promise<SeededHorse> {
  const { userId, breedId, name, sex, age, healthStatus = 'Excellent' } = options;
  const createHorse = await getCreateHorse();

  // Derive dateOfBirth from the GAME age so getHorseAgeYears() reads it back
  // correctly (a calendar-years dateOfBirth would read as ~52 game-years per
  // real year and break the breeding age gate in the other direction).
  const dateOfBirth = new Date(Date.now() - age * MS_PER_GAME_YEAR).toISOString();

  const horse = await createHorse({
    name,
    breedId,
    userId,
    sex,
    age,
    dateOfBirth,
    healthStatus,
  });

  if (!horse?.id) {
    throw new Error(`Horse fixture "${name}" was not persisted: ${JSON.stringify(horse)}`);
  }
  return { id: horse.id, name: horse.name, sex: horse.sex };
}
