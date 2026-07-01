/**
 * backfill-crafting-materials.mjs (Equoria-msuh)
 *
 * One-shot, idempotent, scoped script + reusable function that grants the
 * server-authoritative starter crafting materials to any account whose
 * settings.craftingMaterials is ABSENT.
 *
 * Background: accounts created before the starter-material grant landed
 * (sprint-change-proposal-2026-04-15 §4.3) have no settings.craftingMaterials.
 * craftingController.getMaterials() defaults all material counts to 0, so NO
 * Tier 0 recipe is affordable for those existing beta testers — even though
 * crafting is beta-live and must work for real testers, not just newly
 * registered ones. This restores a real, persisted acquisition path for them.
 *
 * Idempotency / no-double-grant rule:
 *   We grant ONLY when settings.craftingMaterials is missing. If the key
 *   exists at all — even all-zero (the player legitimately spent everything) —
 *   we leave it alone. A second run of this backfill is therefore a no-op for
 *   every account it already touched, and it never tops a spent stockpile back
 *   up. This matches the AC: "idempotent and scoped (no double-grant)".
 *
 * Scope safety (CLAUDE.md Rule 2 — REAL DB ONLY):
 *   - Streams users in id-ordered batches; updates one user at a time.
 *   - Never uses an unscoped updateMany/deleteMany.
 *   - Accepts an optional { userIds } filter so tests and targeted reruns
 *     can operate on an explicit set without scanning the whole table.
 *
 * Single source of truth:
 *   STARTER_CRAFTING_MATERIALS is re-exported from the auth controller so the
 *   grant value can never drift from what new registrations receive.
 *
 * The accompanying Prisma migration
 *   20260518120000_backfill_crafting_materials
 * performs the same backfill in pure SQL so it runs automatically on every
 * Railway deploy (prisma migrate deploy). This script is the verifiable,
 * test-exercised mirror of that SQL and is also usable for ad-hoc reruns.
 *
 * Usage:
 *   node backend/scripts/backfill-crafting-materials.mjs --print-only
 *   node backend/scripts/backfill-crafting-materials.mjs
 *
 * Flags:
 *   --print-only / --dry-run   Report what WOULD change; no writes.
 *   --quiet                    Suppress per-user logs; only print summary.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { fileURLToPath } from 'node:url';
// Equoria-vhv3i: pulled from constants module instead of the auth controller
// so this one-shot backfill does NOT drag the full auth graph (bcrypt, jwt,
// mfa services, email service) into its runtime.
import { STARTER_CRAFTING_MATERIALS } from '../modules/auth/index.mjs';

export { STARTER_CRAFTING_MATERIALS };

/**
 * True when the settings object lacks a usable craftingMaterials object.
 * Absent / null / non-object → needs backfill. An existing object (even
 * all-zero) → already granted, skip (no double-grant).
 * @param {unknown} settings
 * @returns {boolean}
 */
export function needsCraftingBackfill(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return true;
  }
  const m = settings.craftingMaterials;
  return !m || typeof m !== 'object' || Array.isArray(m);
}

/**
 * Grant STARTER_CRAFTING_MATERIALS to accounts missing it.
 *
 * @param {object}   [opts]
 * @param {string[]} [opts.userIds]  Restrict to these user ids (test/targeted rerun).
 * @param {boolean}  [opts.dryRun]   Report only; perform no writes.
 * @param {boolean}  [opts.quiet]    Suppress per-user logging.
 * @returns {Promise<{ scanned: number, granted: number, skipped: number, failed: number }>}
 */
export async function backfillCraftingMaterials(opts = {}) {
  const { userIds = null, dryRun = false, quiet = false } = opts;

  let scanned = 0;
  let granted = 0;
  let skipped = 0;
  let failed = 0;

  const baseWhere = userIds ? { id: { in: userIds } } : {};
  const BATCH_SIZE = 500;
  let lastId = '';
  let hasMore = true;

  while (hasMore) {
    const batch = await prisma.user.findMany({
      where: { ...baseWhere, id: { ...(baseWhere.id ?? {}), gt: lastId } },
      select: { id: true, username: true, settings: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) {
      break;
    }

    for (const user of batch) {
      scanned += 1;
      if (!needsCraftingBackfill(user.settings)) {
        skipped += 1;
        continue;
      }

      const existing =
        user.settings && typeof user.settings === 'object' && !Array.isArray(user.settings)
          ? user.settings
          : {};
      const next = { ...existing, craftingMaterials: { ...STARTER_CRAFTING_MATERIALS } };

      if (dryRun) {
        granted += 1;
        if (!quiet) {
          console.log(
            `  [DRY] ${user.id} "${user.username}" → would grant starter craftingMaterials`,
          );
        }
        continue;
      }

      try {
        await prisma.user.update({ where: { id: user.id }, data: { settings: next } });
        granted += 1;
        if (!quiet) {
          console.log(`  [WET] ${user.id} "${user.username}" → granted starter craftingMaterials`);
        }
      } catch (err) {
        failed += 1;
        console.error(`  [ERR] ${user.id} "${user.username}": ${err.message}`);
      }
    }

    lastId = batch[batch.length - 1].id;
    if (batch.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  return { scanned, granted, skipped, failed };
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
// import.meta.url vs process.argv[1] guard: only run main() when invoked directly.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--print-only') || argv.includes('--dry-run');
  const quiet = argv.includes('--quiet');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  backfill-crafting-materials (Equoria-msuh)');
  console.log(`  Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);
  console.log('═══════════════════════════════════════════════════════════');

  backfillCraftingMaterials({ dryRun, quiet })
    .then(summary => {
      console.log();
      console.log('  Summary');
      console.log(`  scanned: ${summary.scanned}`);
      console.log(`  granted: ${summary.granted}${dryRun ? '  (dry-run, no writes)' : ''}`);
      console.log(`  skipped: ${summary.skipped}  (already had craftingMaterials)`);
      console.log(`  failed:  ${summary.failed}`);
      console.log('═══════════════════════════════════════════════════════════');
      return prisma.$disconnect().finally(() => process.exit(summary.failed > 0 ? 1 : 0));
    })
    .catch(err => {
      console.error('Fatal error:', err);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
