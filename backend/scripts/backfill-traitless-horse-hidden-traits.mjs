/**
 * backfill-traitless-horse-hidden-traits.mjs (Equoria-q4uem.17)
 *
 * One-time backfill of hidden traits on horses that carry no trait at all.
 *
 * Owner ruling 2026-10-29 (q306): the owner's live horses carry zero traits; "Roll
 * them hidden traits the same way it would from the store. So they could each have
 * 1-5 hidden traits."
 *
 * How the traits are rolled and stored
 *   - The roll is generateStoreHorseTraitRoster(), the exact generator the Horse
 *     Trader purchase uses (marketplaceController.buyStoreHorse): each of the twenty
 *     roster traits rolls its rarity tier's chance (25/20/15/10/5%), conflicting
 *     traits are skipped, at most 5 and at least 1 (rulings 10-27 q117, 10-28 q241 /
 *     q246). Nothing here re-implements the odds.
 *   - The result is stored the way a store horse stores it: in
 *     `epigeneticModifiers` as { positive: [], negative: [], hidden: [...] }. Every
 *     trait is hidden, so it is inert until revealed (ruling 10-19). The store has no
 *     other lock or flag column; "hidden" is the whole storage. Any other key on the
 *     stored object (for example revealEvaluatedThroughDay) is kept as stored.
 *   - Age does not change the storage. The store only sells horses at age 3, and the
 *     birth path (foalingService) stores a foal's carried traits in the same `hidden`
 *     list, so a horse under 3 gets the same shape and its traits can still come out
 *     through the normal grooming reveal ladder. The summary lists each horse's age.
 *
 * Which horses
 *   - A horse is traitless when its epigeneticModifiers is NULL or an object whose
 *     positive, negative, hidden and dormant lists are all empty or absent. Any other
 *     stored value (a legacy array, a string) is not guessed at: the horse is skipped
 *     and listed under `unrecognised`.
 *   - A horse with any trait is never touched, so a second run does nothing.
 *
 * Safety
 *   - One transaction per horse. Inside it the row is locked (FOR UPDATE) and
 *     re-checked, so a horse that gained a trait meanwhile is left alone.
 *   - A dry run (the default) performs each horse's UPDATE and rolls that horse's
 *     transaction back, so it proves the write against real rows and writes nothing.
 *     Pass --apply to commit.
 *   - Prints only horse ids, names, ages and the rolled traits. Never prints the
 *     connection string or any secret.
 *
 * Usage (from backend/)
 *   node scripts/backfill-traitless-horse-hidden-traits.mjs                 # dry run
 *   node scripts/backfill-traitless-horse-hidden-traits.mjs --apply         # commit
 *   node scripts/backfill-traitless-horse-hidden-traits.mjs --horse-ids=1,2 # only these
 *   node scripts/backfill-traitless-horse-hidden-traits.mjs --user-id=<id>  # one owner
 *   (--horse-ids and --user-id may be combined; both must match.)
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateStoreHorseTraitRoster } from '../modules/traits/index.mjs';

const traitListKeys = Object.freeze(['positive', 'negative', 'hidden', 'dormant']);

/** Thrown inside a horse's transaction to roll a dry run back; carries its result out. */
class DryRunRollback extends Error {
  constructor(result) {
    super('dry run rolled back');
    this.result = result;
  }
}

/**
 * Classify a stored epigeneticModifiers value.
 * @param {unknown} modifiers
 * @returns {'traitless'|'hasTraits'|'unrecognised'}
 */
export function classifyTraitModifiers(modifiers) {
  if (modifiers === null || modifiers === undefined) {
    return 'traitless';
  }
  if (typeof modifiers !== 'object' || Array.isArray(modifiers)) {
    return 'unrecognised';
  }
  for (const key of traitListKeys) {
    const list = modifiers[key];
    if (list === undefined || list === null) {
      continue;
    }
    if (!Array.isArray(list)) {
      return 'unrecognised';
    }
    if (list.length > 0) {
      return 'hasTraits';
    }
  }
  return 'traitless';
}

/**
 * The value to store: the store roster's three lists over whatever else the row kept.
 * @param {unknown} current - the stored value (NULL or a traitless object)
 * @param {{ positive: string[], negative: string[], hidden: string[] }} roster
 */
function withRoster(current, roster) {
  const base = current && typeof current === 'object' ? { ...current } : {};
  return { ...base, ...roster };
}

async function selectHorses(client, { horseIds, userId }) {
  const ids = horseIds ?? null;
  const owner = userId ?? null;
  return client.$queryRaw`
    SELECT id, name, age, "epigeneticModifiers" FROM horses
    WHERE (${ids}::int[] IS NULL OR id = ANY(${ids}::int[]))
      AND (${owner}::text IS NULL OR "userId" = ${owner}::text)
    ORDER BY id`;
}

/**
 * Give one traitless horse a store roster, in its own transaction.
 * @returns {Promise<object|null>} the filled horse, or null when it was no longer traitless
 */
async function fillHorse(client, horseId, { dryRun, rng }) {
  try {
    return await client.$transaction(
      async tx => {
        const [row] = await tx.$queryRaw`
          SELECT id, name, age, "epigeneticModifiers" FROM horses
          WHERE id = ${horseId} FOR UPDATE`;
        if (!row || classifyTraitModifiers(row.epigeneticModifiers) !== 'traitless') {
          return null;
        }
        const roster = generateStoreHorseTraitRoster(rng);
        const next = withRoster(row.epigeneticModifiers, roster);
        const updated = await tx.$executeRaw`
          UPDATE horses SET "epigeneticModifiers" = ${JSON.stringify(next)}::jsonb
          WHERE id = ${horseId}`;
        if (updated !== 1) {
          throw new Error(`horse ${horseId}: expected 1 row updated, got ${updated}`);
        }
        const result = { id: row.id, name: row.name, age: row.age, hidden: roster.hidden };
        if (dryRun) {
          throw new DryRunRollback(result);
        }
        return result;
      },
      { timeout: 30000 },
    );
  } catch (err) {
    if (err instanceof DryRunRollback) {
      return err.result;
    }
    throw err;
  }
}

/**
 * Roll store hidden traits onto every traitless horse.
 *
 * @param {{ dryRun?: boolean, horseIds?: number[], userId?: string, rng?: () => number,
 *   client?: import('@prisma/client').PrismaClient }} [options]
 *   `dryRun` (default true) rolls each horse's transaction back;
 *   `horseIds` narrows the run to those horses (tests, or by hand);
 *   `userId` narrows it to one owner's horses.
 */
export async function runTraitlessHorseBackfill({
  dryRun = true,
  horseIds,
  userId,
  rng = Math.random,
  client = prisma,
} = {}) {
  const horses = await selectHorses(client, { horseIds, userId });
  const filled = [];
  const unrecognised = [];
  let alreadyHaveTraits = 0;
  for (const horse of horses) {
    const kind = classifyTraitModifiers(horse.epigeneticModifiers);
    if (kind === 'hasTraits') {
      alreadyHaveTraits++;
      continue;
    }
    if (kind === 'unrecognised') {
      unrecognised.push({ id: horse.id, name: horse.name });
      continue;
    }
    const result = await fillHorse(client, horse.id, { dryRun, rng });
    if (result) {
      filled.push(result);
    }
  }
  return {
    rolledBack: dryRun,
    horsesScanned: horses.length,
    alreadyHaveTraits,
    filled,
    unrecognised,
  };
}

function parseHorseIds(argv) {
  const arg = argv.find(a => a.startsWith('--horse-ids='));
  if (!arg) {
    return undefined;
  }
  const ids = arg
    .slice('--horse-ids='.length)
    .split(',')
    .map(s => Number.parseInt(s.trim(), 10));
  if (ids.length === 0 || ids.some(id => !Number.isInteger(id) || id <= 0)) {
    throw new Error('--horse-ids must be a comma-separated list of positive integers');
  }
  return ids;
}

function parseUserId(argv) {
  const arg = argv.find(a => a.startsWith('--user-id='));
  if (!arg) {
    return undefined;
  }
  const userId = arg.slice('--user-id='.length).trim();
  if (!userId) {
    throw new Error('--user-id needs a value');
  }
  return userId;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const horseIds = parseHorseIds(argv);
  const userId = parseUserId(argv);
  const result = await runTraitlessHorseBackfill({ dryRun: !apply, horseIds, userId });
  for (const h of result.filled) {
    console.log(`${apply ? 'FILLED' : 'WOULD FILL'} ${JSON.stringify(h)}`);
  }
  for (const u of result.unrecognised) {
    console.log(`UNRECOGNISED ${JSON.stringify(u)}`);
  }
  console.log(
    JSON.stringify({
      mode: apply ? 'APPLIED' : 'DRY RUN (rolled back, nothing written)',
      horsesScanned: result.horsesScanned,
      alreadyHaveTraits: result.alreadyHaveTraits,
      horsesFilled: result.filled.length,
      unrecognised: result.unrecognised.length,
    }),
  );
}

// Main-module guard: main() writes horses and must not run on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch(err => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
