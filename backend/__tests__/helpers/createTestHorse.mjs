/**
 * createTestHorse.mjs (Equoria-dm1i)
 *
 * Canonical real-DB test-fixture helper for inserting a horse row.
 *
 * WHY THIS EXISTS — the structural defect class behind Equoria-lfj5 / g9sa:
 *   ~209 backend *.test.mjs files create fixture horses via raw
 *   `prisma.horse.create()`. The `createHorse()` model fn (Equoria-ennm)
 *   auto-generates colorGenotype + phenotype; a raw create does NOT, so the
 *   row is born with NULL phenotype. While each suite's scoped/cascade
 *   cleanup currently works (so the canonical `horseColorNullSentinel`
 *   stays green), ANY suite whose afterAll cleanup ever fails (silent
 *   `.catch(() => {})`, missing cascade, timeout) leaks a NULL-phenotype
 *   row and trips the sentinel — exactly the Equoria-lfj5 16-NULL
 *   regression.
 *
 *   This helper closes the class at the point of creation:
 *     1. It spreads the SAME CI-proven `fixtureColor()` generator the
 *        g9sa fix uses, so every fixture horse satisfies the
 *        phenotype-not-null invariant even transiently.
 *     2. It records the created id in a caller-supplied collector so
 *        cleanup is scoped to *exactly* the rows this suite made — never
 *        a broad `deleteMany()` (CLAUDE.md §2 forbids that against the
 *        canonical DB).
 *
 * It deliberately does NOT route through the full `createHorse()` pipeline
 * (breedId requirement, genotype/trait generation, conformation + gait
 * validation) — that changes test semantics. It reuses only the color
 * generator, mirroring `fixtureColor()`'s rationale.
 *
 * Convention (.claude/rules/CONTRIBUTING.md, test section): NEW backend
 * tests MUST use this helper (or spread `...fixtureColor()` into a raw
 * create) instead of a bare `prisma.horse.create()` with no color fields.
 *
 * Usage:
 *   import prisma from '../../../packages/database/prismaClient.mjs';
 *   import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';
 *
 *   const created = [];
 *   const horse = await createTestHorse(prisma, {
 *     name: `TestFixture-foo-${randHex()}`,
 *     sex: 'Mare',
 *     dateOfBirth: new Date(),
 *     userId: user.id,
 *   }, created);
 *   // ... assertions ...
 *   afterAll(() => cleanupTestHorses(prisma, created));
 */

import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';

/**
 * Insert a horse row with a valid colorGenotype + phenotype auto-generated.
 *
 * Caller-supplied `data` is passed straight through to
 * `prisma.horse.create()`. The color fields are injected ONLY when the
 * caller did not already supply them, so a suite that intentionally tests
 * a specific genotype/phenotype keeps full control.
 *
 * @param {import('@prisma/client').PrismaClient} prisma Active Prisma client.
 * @param {object} data Prisma `horse.create` data. `name`, `sex`,
 *   `dateOfBirth` are required by the schema; everything else is optional.
 * @param {number[]} [collector] Optional array; the created horse id is
 *   pushed onto it for later scoped cleanup via `cleanupTestHorses`.
 * @param {object|null} [breedGeneticProfile] Optional breed genetic
 *   profile forwarded to `fixtureColor()` (defaults to the generic/null
 *   profile — same as the backfill script).
 * @returns {Promise<object>} The created horse row (includes `id`).
 */
export async function createTestHorse(prisma, data, collector, breedGeneticProfile = null) {
  if (!prisma || typeof prisma.horse?.create !== 'function') {
    throw new TypeError('createTestHorse: first arg must be a Prisma client');
  }
  if (!data || typeof data !== 'object') {
    throw new TypeError('createTestHorse: second arg must be a horse data object');
  }

  const callerSuppliedColor =
    Object.prototype.hasOwnProperty.call(data, 'colorGenotype') ||
    Object.prototype.hasOwnProperty.call(data, 'phenotype');

  const finalData = callerSuppliedColor
    ? { ...data }
    : { ...fixtureColor(breedGeneticProfile), ...data };

  const horse = await prisma.horse.create({ data: finalData });

  if (Array.isArray(collector)) {
    collector.push(horse.id);
  }

  return horse;
}

/**
 * Scoped cleanup for ids collected by `createTestHorse`.
 *
 * Deletes ONLY the ids this suite created (`where: { id: { in: ids } }`) —
 * never a broad `deleteMany()`. Safe to call in afterAll even if some ids
 * were already cascade-deleted (the delete is a no-op for missing rows).
 *
 * @param {import('@prisma/client').PrismaClient} prisma Active Prisma client.
 * @param {number[]} collector The array populated by `createTestHorse`.
 * @returns {Promise<number>} Count of rows deleted.
 */
export async function cleanupTestHorses(prisma, collector) {
  if (!Array.isArray(collector) || collector.length === 0) {
    return 0;
  }
  const { count } = await prisma.horse.deleteMany({
    where: { id: { in: collector } },
  });
  // Empty the collector so a second afterAll call is idempotent.
  collector.length = 0;
  return count;
}

export default createTestHorse;
