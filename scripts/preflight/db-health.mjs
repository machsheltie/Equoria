#!/usr/bin/env node
/**
 * Pre-push DB-health check (Equoria-urld).
 *
 * Detects common test-DB inconsistency states BEFORE the full Jest suite
 * runs so developers don't wait ~10 minutes to discover a broken DB.
 *
 * Checks:
 *   1. Pending migrations — migration dirs in packages/database/prisma/migrations/
 *      that are not in `_prisma_migrations` (finished_at IS NOT NULL).
 *   2. Orphan horses — rows in `horses` whose `userId` is not in `"User"`.
 *   3. Orphan competition_results — rows in `competition_results` whose
 *      `horseId` is not in `horses`.
 *
 * Exit codes:
 *   0 — DB healthy.
 *   2 — DATABASE_URL missing in backend/.env.test.
 *   3 — DB unreachable or error during health queries.
 *   4 — DB inconsistency detected (issues printed + reset command shown).
 *
 * Budget: 5000ms total (connect + all queries). Fast-path exits if DB is
 * healthy; slow only when inconsistency exists (which is the failure case).
 *
 * Required cwd: backend/ (so dotenv resolves .env.test correctly).
 *
 * Dependency resolution (Equoria-fefh2.43 item 2): `dotenv` and `pg` are NOT
 * imported as bare ESM specifiers. A bare `import x from 'pg'` is resolved by
 * Node from THIS file's directory tree (scripts/preflight → scripts →
 * repo-root node_modules), NOT from cwd. The CI jobs that run this script
 * (backend-tests, security-gate) only `npm ci` inside backend/ and
 * packages/database/ — repo-root node_modules is absent — so a bare import
 * here threw `ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'`. These deps
 * live in backend/node_modules (this script already requires cwd=backend and
 * reads backend/.env.test), so we anchor a createRequire to backend's
 * package.json and resolve both from there, independent of where Node's
 * default ESM resolver would look. Guarded by
 * preflightScriptDepResolution.sentinel.test.mjs.
 */

import { createRequire } from 'node:module';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(repoRoot, 'packages', 'database', 'prisma', 'migrations');

const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const dotenv = backendRequire('dotenv');
const { Client } = backendRequire('pg');

dotenv.config({ path: '.env.test' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[db-health] DATABASE_URL not set in backend/.env.test');
  process.exit(2);
}

const BUDGET_MS = 5000;

const healthCheck = (async () => {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: BUDGET_MS });
  await client.connect();

  const issues = [];

  // 1. Pending migration check
  let migrationFolders = null;
  try {
    migrationFolders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    // migrations dir unreadable — skip this check, don't fail
  }

  if (migrationFolders) {
    const { rows: applied } = await client.query(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`
    );
    const appliedSet = new Set(applied.map((r) => r.migration_name));
    const pending = migrationFolders.filter((f) => !appliedSet.has(f));
    if (pending.length > 0) {
      issues.push(
        `  • ${pending.length} unapplied migration(s): ${pending.slice(0, 3).join(', ')}${pending.length > 3 ? ` … (+${pending.length - 3} more)` : ''}`
      );
    }
  }

  // 2. Orphan horse rows — userId IS NOT NULL but references a missing User.
  // Horses with userId = NULL are legitimately unowned; don't count those.
  const { rows: orphanHorseRows } = await client.query(`
    SELECT COUNT(*) AS n
    FROM horses h
    LEFT JOIN "User" u ON h."userId" = u.id
    WHERE h."userId" IS NOT NULL AND u.id IS NULL
  `);
  const orphanHorses = parseInt(orphanHorseRows[0].n, 10);
  if (orphanHorses > 0) {
    issues.push(`  • ${orphanHorses} orphan horse row(s) (userId not found in "User")`);
  }

  // 3. Orphan competition_result rows (horseId → horses.id missing)
  const { rows: orphanResultRows } = await client.query(`
    SELECT COUNT(*) AS n
    FROM competition_results cr
    LEFT JOIN horses h ON cr."horseId" = h.id
    WHERE h.id IS NULL
  `);
  const orphanResults = parseInt(orphanResultRows[0].n, 10);
  if (orphanResults > 0) {
    issues.push(
      `  • ${orphanResults} orphan competition_result row(s) (horseId not found in horses)`
    );
  }

  await client.end();

  if (issues.length > 0) {
    console.error('[db-health] Test DB inconsistency detected:');
    for (const issue of issues) {
      console.error(issue);
    }
    console.error('');
    console.error('[db-health] Reset the test DB with:');
    console.error('  cd backend && npm run db:reset:test');
    process.exit(4);
  }

  console.log('ok');
})();

// NOTE: capture the timer handle so we can clearTimeout() it after the race
// settles. Without this, the unreferenced setTimeout keeps Node's event loop
// alive for the FULL BUDGET_MS even when healthCheck resolves in ~150ms — the
// process then lingers ~5s on the healthy path, taxing every push. (Equoria-l052p)
let timeoutHandle;
const timeout = new Promise((_resolve, reject) => {
  timeoutHandle = setTimeout(
    () => reject(new Error(`db-health timed out after ${BUDGET_MS}ms`)),
    BUDGET_MS
  );
});

try {
  await Promise.race([healthCheck, timeout]);
} catch (err) {
  const msg = err?.code ? `${err.code}: ${err.message}` : (err?.message ?? String(err));
  console.error(`[db-health] Error: ${msg}`);
  process.exit(3);
} finally {
  clearTimeout(timeoutHandle);
}
