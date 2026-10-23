/**
 * E2E fixture: bring a pregnant mare's foal into the world (Equoria-6nl3j).
 *
 * WHY THIS EXISTS: specs need a real foal without waiting out the seven-day
 * gestation. They used `POST /api/v1/horses/:id/foal-now`, a gestation bypass
 * that sat in the PRODUCTION router behind a NODE_ENV allowlist (Equoria-bhf6n).
 * A permission check buried in a normal handler is the shape the Codex scan of
 * 2026-10-02 called not preferred, and an owner-callable route that skips
 * gestation is one environment mistake away from a free-foal faucet. The route
 * is gone from the application. The foal is materialised here instead, from the
 * spec's own Node process, by the same service the nightly foaling job runs —
 * `createFoalFromPregnancy` — straight into the test database. This follows
 * `feedHistory.ts` (Equoria-mwjst) and `ownedHorses.ts`.
 *
 * The pregnancy itself is still started over the real HTTP route
 * (`POST /api/v1/horses/foals`), so the mare's `inFoalSinceDate`, sire and
 * feeding counters are what the product wrote. Only the waiting is skipped.
 *
 * NOT PERMITTED here: production routes, `x-test-*` headers, or anything that
 * runs inside the backend process. A foal created from this process does not
 * invalidate the backend's horse-list cache (neither did the old route: the
 * foaling service performs no invalidation, Equoria-awod4), so a spec that reads
 * the cached list afterwards depends on that key being cold.
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// tests/e2e/fixtures/ -> three levels up is the worktree root.
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const foalingServicePath = path.join(
  projectRoot,
  'backend',
  'modules',
  'horses',
  'services',
  'foalingService.mjs'
);

export type MaterialisedFoal = { id: number; name: string };

type CreateFoalFromPregnancy = (_args: {
  damId: number;
}) => Promise<{ foal: { id: number; name: string } }>;

// Dynamic import so this stays a plain TypeScript module without ambient
// declarations for the backend's .mjs exports (the coatGenotypeHorses pattern).
async function getCreateFoalFromPregnancy(): Promise<CreateFoalFromPregnancy> {
  const mod = await import(/* @vite-ignore */ foalingServicePath);
  const fn = (mod as { createFoalFromPregnancy?: CreateFoalFromPregnancy }).createFoalFromPregnancy;
  if (typeof fn !== 'function') {
    throw new Error('Could not resolve createFoalFromPregnancy from foalingService.mjs');
  }
  return fn;
}

/**
 * Materialise the foal of an in-foal mare through the real foaling service.
 * Throws (the service's own error) when the mare is not in foal, so a spec that
 * forgot to start the pregnancy fails loudly rather than silently passing.
 */
export async function foalMareNow(damId: number): Promise<MaterialisedFoal> {
  const createFoalFromPregnancy = await getCreateFoalFromPregnancy();
  const { foal } = await createFoalFromPregnancy({ damId });
  if (!foal || typeof foal.id !== 'number' || typeof foal.name !== 'string') {
    throw new Error(`foaling fixture: createFoalFromPregnancy returned no foal for dam ${damId}`);
  }
  return { id: foal.id, name: foal.name };
}
