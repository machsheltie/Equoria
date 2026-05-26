/**
 * Forward-only DB backfill: snake_case → canonical camelCase epigenetic-trait
 * keys inside every horse's `epigeneticModifiers` {positive,negative,hidden}
 * arrays (Equoria-9o3n7.6, §C).
 *
 * ⚠️ NOT AUTO-EXECUTED. This script is intentionally NOT wired into any
 * migration runner, app boot, or CI step. Per the worktree mandate it must be
 * run manually under user oversight against the canonical DB at land-time. The
 * runtime read path tolerates legacy snake-case rows via
 * `normalizeTraitKey()` (see backend/utils/epigeneticTraitKeyMap.mjs), so the
 * application is correct whether or not this backfill has run yet — the
 * backfill exists to make the STORED data canonical so reads stop needing the
 * tolerance shim.
 *
 * SAFETY (CLAUDE.md §2 — real canonical DB, scoped ops only):
 *   - Reads only rows whose modifiers actually contain a remappable key
 *     (filtered in JS after a narrow select) — never a blanket table rewrite.
 *   - Each UPDATE is scoped to a single horse id (`where: { id }`). There is
 *     NO unscoped UPDATE / deleteMany anywhere in this script.
 *   - Idempotent: re-running maps already-canonical keys to themselves, so a
 *     second run changes nothing.
 *   - --dry-run (default) prints the planned changes and writes NOTHING.
 *     Pass --apply to actually persist. This guards against accidental writes.
 *
 * Usage (manual, land-time only):
 *   node packages/database/scripts/backfillEpigeneticTraitCasing.mjs            # dry-run
 *   node packages/database/scripts/backfillEpigeneticTraitCasing.mjs --apply    # persist
 */

import { PrismaClient } from '@prisma/client';
import {
  LEGACY_TRAIT_KEY_MAP,
  normalizeEpigeneticModifiers,
} from '../../../backend/utils/epigeneticTraitKeyMap.mjs';

const prisma = new PrismaClient();

/**
 * Does this modifiers object contain at least one key that normalization would
 * change? Used to skip rows that are already canonical (idempotency + avoids
 * pointless writes).
 */
function needsBackfill(modifiers) {
  if (!modifiers || typeof modifiers !== 'object' || Array.isArray(modifiers)) {
    return false;
  }
  const before = JSON.stringify({
    positive: modifiers.positive ?? [],
    negative: modifiers.negative ?? [],
    hidden: modifiers.hidden ?? [],
  });
  const after = JSON.stringify(normalizeEpigeneticModifiers(modifiers));
  return before !== after;
}

export async function backfillEpigeneticTraitCasing({ apply = false, prismaClient = prisma } = {}) {
  const knownLegacyKeys = Object.keys(LEGACY_TRAIT_KEY_MAP);

  console.log(
    `[backfillEpigeneticTraitCasing] mode=${apply ? 'APPLY' : 'DRY-RUN'} known legacy keys: ${knownLegacyKeys.join(', ')} (+ legacy discipline_affinity_* prefix)`
  );

  // Narrow select: only the id + the JSONB column we rewrite.
  const horses = await prismaClient.horse.findMany({
    select: { id: true, epigeneticModifiers: true },
  });

  let scanned = 0;
  let changed = 0;
  for (const horse of horses) {
    scanned += 1;
    if (!needsBackfill(horse.epigeneticModifiers)) {
      continue;
    }
    const normalized = normalizeEpigeneticModifiers(horse.epigeneticModifiers);
    changed += 1;

    console.log(
      `[backfillEpigeneticTraitCasing] horse ${horse.id}: ${JSON.stringify(horse.epigeneticModifiers)} -> ${JSON.stringify(normalized)}`
    );
    if (apply) {
      // SCOPED to a single id — never an unscoped UPDATE.
      await prismaClient.horse.update({
        where: { id: horse.id },
        data: { epigeneticModifiers: normalized },
      });
    }
  }

  console.log(
    `[backfillEpigeneticTraitCasing] done. scanned=${scanned} ${apply ? 'updated' : 'wouldUpdate'}=${changed}`
  );
  return { scanned, changed, applied: apply };
}

// Direct-invocation guard: only run when executed as a script, not on import.
const isMain = process.argv[1] && process.argv[1].endsWith('backfillEpigeneticTraitCasing.mjs');
if (isMain) {
  const apply = process.argv.includes('--apply');
  backfillEpigeneticTraitCasing({ apply })
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('[backfillEpigeneticTraitCasing] FAILED:', err);
      return prisma.$disconnect().finally(() => process.exit(1));
    });
}

export default backfillEpigeneticTraitCasing;
