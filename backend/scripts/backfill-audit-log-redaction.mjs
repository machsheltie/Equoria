/**
 * backfill-audit-log-redaction.mjs (Equoria-uf987, Equoria-oierg)
 *
 * One-shot, idempotent backfill that re-applies the canonical, recursive
 * `sanitizeLogData()` redactor to historical `audit_logs.metadata` rows.
 *
 * Two generations of leak are covered:
 *   - Pre-Equoria-wp0ib rows stored `metadata.params` / `metadata.query`
 *     verbatim (a raw `?token=...` or sensitive path parameter).
 *   - Pre-Equoria-oierg rows were redacted at the top level only, so a nested
 *     secret (`body.profile.password`, `body.items[].token`) was stored as-is.
 *
 * The A09 retention purge is 90 days, so such a row can keep a secret for
 * nearly three months after the write-path fix. This backfill redacts the
 * historical rows in place.
 *
 * What it does
 *   - Walks every audit row in id-ordered batches.
 *   - For each top-level metadata entry: a sensitive key is redacted whole;
 *     an object/array value is passed through `sanitizeLogData()` from depth 0,
 *     exactly as the live write path sanitizes `body`, `params`, `query` and
 *     `errorResponse` individually (so the depth cap lands where it does for
 *     fresh rows). Scalars are kept.
 *   - A row is rewritten only when the redacted metadata differs from what is
 *     stored. Every other value is preserved.
 *   - Idempotent: the live write path uses the same redactor, so a second run
 *     finds nothing to change and writes nothing.
 *
 * Safety doctrine (CLAUDE.md §2)
 *   - Every UPDATE is scoped to a single AuditLog.id.
 *   - Reads run in id-ordered batches to bound memory.
 *   - A row whose metadata is null, a string, an array or otherwise not an
 *     object is left untouched (counted as 'skipped-malformed').
 *
 * Usage
 *   node backend/scripts/backfill-audit-log-redaction.mjs --dry-run
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

const redactedMarker = '[REDACTED]';

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

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Redact one stored metadata object with the canonical redactor. Returns the
 * redacted copy and the top-level fields whose value changed.
 */
export function redactAuditMetadata(meta) {
  // A one-entry wrapper reuses sanitizeLogData's key test for the top-level
  // key without adding a depth level to the value beneath it.
  const redacted = {};
  const changedFields = [];
  for (const [key, value] of Object.entries(meta)) {
    const keyIsSensitive = sanitizeLogData({ [key]: true })[key] === redactedMarker;
    const next = keyIsSensitive ? redactedMarker : sanitizeLogData(value);
    redacted[key] = next;
    if (JSON.stringify(next) !== JSON.stringify(value)) {
      changedFields.push(key);
    }
  }
  return { redacted, changedFields };
}

/**
 * Scan audit_logs and redact rows in place. `scope` narrows the rows (tests
 * pass their own fixture ids); the CLI scans the whole table.
 */
export async function runAuditLogRedactionBackfill({
  db = prisma,
  dryRun = false,
  batchSize = 1000,
  limit = null,
  scope = {},
  log = () => {},
} = {}) {
  const counts = {
    processed: 0,
    needsUpdate: 0,
    updated: 0,
    unchanged: 0,
    skippedMalformed: 0,
    failed: 0,
  };
  let lastId = 0;
  const limitReached = () => Boolean(limit) && counts.processed >= limit;

  while (!limitReached()) {
    const batch = await db.auditLog.findMany({
      where: { AND: [scope, { id: { gt: lastId } }] },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, metadata: true },
    });
    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      if (limitReached()) {
        break;
      }
      counts.processed++;
      lastId = row.id;

      if (!isPlainObject(row.metadata)) {
        counts.skippedMalformed++;
        continue;
      }

      const { redacted, changedFields } = redactAuditMetadata(row.metadata);
      if (changedFields.length === 0) {
        counts.unchanged++;
        continue;
      }
      counts.needsUpdate++;
      if (dryRun) {
        continue;
      }

      try {
        await db.auditLog.update({ where: { id: row.id }, data: { metadata: redacted } });
        counts.updated++;
        log(`  [REDACTED] audit_logs.id=${row.id} fields=${changedFields.join('+')}`);
      } catch (err) {
        counts.failed++;
        console.error(`  [ERR] audit_logs.id=${row.id}: ${err.message}`);
      }
    }
  }

  return counts;
}

async function main() {
  const args = parseArgs(process.argv);
  const startedAt = Date.now();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  audit_logs metadata redaction backfill (Equoria-uf987, Equoria-oierg)');
  console.log(`  mode:       ${args.dryRun ? 'DRY-RUN (no writes)' : 'WET (UPDATE rows)'}`);
  console.log(`  batch-size: ${args.batchSize}`);
  if (args.limit) {
    console.log(`  limit:      ${args.limit}`);
  }
  console.log('═══════════════════════════════════════════════════════════');

  const total = await prisma.auditLog.count();
  console.log(`  total audit_logs rows: ${total}`);
  console.log();

  const counts = await runAuditLogRedactionBackfill({
    dryRun: args.dryRun,
    batchSize: args.batchSize,
    limit: args.limit,
    log: args.quiet ? () => {} : console.log,
  });

  const duration = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log(`  processed:           ${counts.processed}`);
  console.log(`  needs-update:        ${counts.needsUpdate}`);
  console.log(
    `  updated:             ${counts.updated}${args.dryRun ? '  (dry-run, no writes)' : ''}`,
  );
  console.log(`  unchanged:           ${counts.unchanged}`);
  console.log(`  skipped-malformed:   ${counts.skippedMalformed}`);
  console.log(`  failed:              ${counts.failed}`);
  console.log(`  duration:            ${duration}s`);
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
  if (counts.failed > 0) {
    process.exit(1);
  }
}

// Equoria-5z0if: main-module guard. main() runs scoped audit_logs UPDATEs
// — must NOT run on bare import (e.g. parse-check `node -e
// "import('./backfill-audit-log-redaction.mjs')"`, or a test importing the
// exported functions).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Fatal error:', err);
    prisma.$disconnect().finally(() => process.exit(1));
  });
}
