/**
 * backfill-audit-log-redaction.mjs (Equoria-uf987)
 *
 * One-shot, idempotent backfill that re-applies `sanitizeLogData()` to the
 * historical `audit_logs.metadata.params` and `audit_logs.metadata.query`
 * blobs. Pre-Equoria-wp0ib (closed 2026-05-28), only `metadata.body` was
 * sanitized at write time — `params` and `query` were persisted verbatim,
 * so any audit row written before wp0ib's middleware fix may contain a
 * raw `?token=...`, `?password=...`, or a sensitive path-parameter value.
 *
 * The A09 retention purge is 90 days, so a row from 2026-02-28 could
 * still leak a secret it captured pre-wp0ib for nearly three months
 * post-fix. This backfill closes that gap by redacting the historical
 * rows in place.
 *
 * What it does
 *   - Walks rows where metadata.params OR metadata.query is a non-empty
 *     object that, after fresh `sanitizeLogData()` application, would
 *     change (i.e. it has at least one key whose lowercase form contains
 *     a known-sensitive substring per the canonical redactor).
 *   - Rewrites the metadata blob with the redacted variant. All other
 *     metadata fields are preserved byte-for-byte.
 *   - Idempotent: a second run finds no rows that would change (because
 *     the canonical redactor is the same one the live write path uses
 *     post-wp0ib), so it writes nothing.
 *
 * Safety doctrine (CLAUDE.md §2)
 *   - Every UPDATE is scoped to a single AuditLog.id (no `updateMany`
 *     without `where`).
 *   - Reads run in id-ordered batches to bound memory.
 *   - The script is paranoid about its own input shape: a row whose
 *     metadata is null, a string, an array, or otherwise not the
 *     expected object shape is left untouched (and counted as
 *     'skipped-malformed' in the summary). The live write path always
 *     produces the canonical shape; legacy rows with drifted shape are
 *     not within the threat model this script addresses.
 *
 * Usage
 *   node backend/scripts/backfill-audit-log-redaction.mjs --print-only
 *   node backend/scripts/backfill-audit-log-redaction.mjs
 *
 * Flags
 *   --print-only / --dry-run   Counts only; no writes.
 *   --batch-size N             Rows per id-ordered scan page (default 1000).
 *   --limit N                  Stop after N rows processed (debugging).
 *   --quiet                    Suppress per-row logs; only print summary.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { fileURLToPath } from 'node:url';
import { sanitizeLogData } from '../middleware/auditLog.mjs';

function parseArgs(argv) {
  const args = { dryRun: false, batchSize: 1000, limit: null, quiet: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--print-only' || a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--quiet') {
      args.quiet = true;
    } else if (a === '--batch-size' && argv[i + 1]) {
      args.batchSize = Number(argv[++i]);
    } else if (a.startsWith('--batch-size=')) {
      args.batchSize = Number(a.slice('--batch-size='.length));
    } else if (a === '--limit' && argv[i + 1]) {
      args.limit = Number(argv[++i]);
    } else if (a.startsWith('--limit=')) {
      args.limit = Number(a.slice('--limit='.length));
    }
  }
  if (!Number.isInteger(args.batchSize) || args.batchSize < 1) {
    args.batchSize = 1000;
  }
  return args;
}

/**
 * Apply the canonical redactor to a nested params/query object. Returns
 * the redacted variant, OR the original reference if no key would
 * change (so the caller can short-circuit and skip the row).
 */
function redactNested(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    // Not the expected shape — never sanitized by the live path, never
    // sanitized here. Surface as 'skipped-malformed' upstream.
    return { changed: false, redacted: value, shape: 'non-object' };
  }
  const redacted = sanitizeLogData(value);
  // sanitizeLogData returns a shallow clone with `[REDACTED]` for matching
  // keys. Detect any actual key change by comparing post-clone values.
  let changed = false;
  for (const key of Object.keys(redacted)) {
    if (redacted[key] === '[REDACTED]' && value[key] !== '[REDACTED]') {
      changed = true;
      break;
    }
  }
  return { changed, redacted, shape: 'object' };
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  audit_logs metadata.params / metadata.query backfill (Equoria-uf987)');
  console.log(`  mode:       ${args.dryRun ? 'DRY-RUN (no writes)' : 'WET (UPDATE rows)'}`);
  console.log(`  batch-size: ${args.batchSize}`);
  if (args.limit) {
    console.log(`  limit:      ${args.limit}`);
  }
  console.log('═══════════════════════════════════════════════════════════');

  const total = await prisma.auditLog.count();
  console.log(`  total audit_logs rows: ${total}`);
  console.log();

  let processed = 0;
  let needsUpdate = 0;
  let updated = 0;
  let unchanged = 0;
  let skippedMalformed = 0;
  let failed = 0;
  let lastId = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.auditLog.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: 'asc' },
      take: args.batchSize,
      select: { id: true, metadata: true },
    });
    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      if (args.limit && processed >= args.limit) {
        break;
      }
      processed++;
      lastId = row.id;

      const meta = row.metadata;
      // metadata column is Json? — null is a legitimate state for very old
      // rows. Skip cleanly.
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
        skippedMalformed++;
        continue;
      }

      const paramsResult = meta.params !== undefined ? redactNested(meta.params) : null;
      const queryResult = meta.query !== undefined ? redactNested(meta.query) : null;

      const anyChanged =
        (paramsResult && paramsResult.changed) || (queryResult && queryResult.changed);

      if (!anyChanged) {
        unchanged++;
        continue;
      }
      needsUpdate++;

      if (!args.dryRun) {
        try {
          const newMeta = {
            ...meta,
            ...(paramsResult && paramsResult.changed ? { params: paramsResult.redacted } : {}),
            ...(queryResult && queryResult.changed ? { query: queryResult.redacted } : {}),
          };
          await prisma.auditLog.update({
            where: { id: row.id },
            data: { metadata: newMeta },
          });
          updated++;
          if (!args.quiet) {
            const fields = [];
            if (paramsResult && paramsResult.changed) {
              fields.push('params');
            }
            if (queryResult && queryResult.changed) {
              fields.push('query');
            }
            console.log(`  [REDACTED] audit_logs.id=${row.id} fields=${fields.join('+')}`);
          }
        } catch (err) {
          failed++;
          console.error(`  [ERR] audit_logs.id=${row.id}: ${err.message}`);
        }
      }
    }

    if (args.limit && processed >= args.limit) {
      break;
    }
  }

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log(`  processed:           ${processed}`);
  console.log(`  needs-update:        ${needsUpdate}`);
  console.log(`  updated:             ${updated}${args.dryRun ? '  (dry-run, no writes)' : ''}`);
  console.log(`  unchanged:           ${unchanged}`);
  console.log(`  skipped-malformed:   ${skippedMalformed}`);
  console.log(`  failed:              ${failed}`);
  console.log(`  duration:            ${duration}s`);
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  if (failed > 0) {
    process.exit(1);
  }
}

// Equoria-5z0if: main-module guard. main() runs scoped audit_logs UPDATEs
// — must NOT run on bare import (e.g. parse-check `node -e
// "import('./backfill-audit-log-redaction.mjs')"`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Fatal error:', err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
