/**
 * db-reset-test.mjs — one-command local DB recreation for the test database.
 *
 * Usage: npm run db:reset:test
 *
 * Reads DATABASE_URL from backend/.env.test, validates it is a localhost
 * connection (refuses to run against remote/production hosts), then:
 *   1. Terminates all active connections to the database
 *   2. Drops the database
 *   3. Creates a fresh database
 *   4. Runs `prisma migrate deploy` from packages/database
 *
 * Idempotent: safe to run repeatedly. Run this when the local DB falls into
 * an inconsistent state (missing columns, schema drift vs migrations).
 *
 * Equoria-djb0
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
// Equoria-6gcvi: pg supports ESM named import directly — the prior
// `createRequire(import.meta.url) + require('pg')` bridge was a gratuitous
// CJS dependency and violated ES_MODULES_REQUIREMENTS.md.
import pg from 'pg';
const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Equoria-c3kb6: ALL side-effects (env read, URL parse, safety checks,
// resetDatabase) are deferred into main() and only executed when this file
// is invoked as the entry point (npm run db:reset:test). On bare import
// (e.g. parse/type-check smoke runs like `node -e "import('./db-reset-test.mjs')"`)
// the file produces NO side effects — no env read, no console output, no
// process.exit, and no DROP DATABASE. This is the structural fix that
// prevents the c3kb6 incident from recurring.
// ---------------------------------------------------------------------------
async function main() {
  const envPath = path.join(__dirname, '..', '.env.test');
  let envContent;
  try {
    envContent = readFileSync(envPath, 'utf8');
  } catch {
    console.error(`ERROR: cannot read ${envPath}`);
    process.exit(1);
  }

  function parseEnvLine(content, key) {
    const match = content.match(new RegExp(`^${key}="?([^"\n]+)"?`, 'm'));
    return match ? match[1].trim() : null;
  }

  const dbUrl = parseEnvLine(envContent, 'DATABASE_URL');
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not found in .env.test');
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Parse the URL
  // ---------------------------------------------------------------------------
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    console.error(`ERROR: DATABASE_URL is not a valid URL: ${dbUrl}`);
    process.exit(1);
  }

  const host = parsed.hostname;
  const port = parseInt(parsed.port || '5432', 10);
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const dbName = parsed.pathname.replace(/^\//, '');

  // ---------------------------------------------------------------------------
  // Safety guard #1: must be localhost
  // ---------------------------------------------------------------------------
  const LOCALHOST_PATTERNS = ['localhost', '127.0.0.1', '::1'];
  if (!LOCALHOST_PATTERNS.includes(host)) {
    console.error(
      `ERROR: db:reset:test refuses to run against a remote host (${host}).\n` +
        'This script is only for local development databases.\n' +
        'Cowardly refusing to drop a non-localhost database.',
    );
    process.exit(1);
  }

  // ---------------------------------------------------------------------------
  // Safety guard #2 (Equoria-c3kb6): hard-block the canonical DB name.
  // The Equoria project policy (CLAUDE.md Rule 2 "REAL DB ONLY. No test
  // database.") points .env.test at the CANONICAL local DB named "equoria".
  // The localhost check above is therefore NOT sufficient — the canonical DB IS
  // on localhost. This script must refuse to wipe the canonical "equoria"
  // database under any circumstance; running it would destroy live game data.
  // If you genuinely need to reset, rename the canonical DB or point
  // DATABASE_URL at a SEPARATE test DB first.
  // ---------------------------------------------------------------------------
  const CANONICAL_DB_NAMES = ['equoria'];
  if (CANONICAL_DB_NAMES.includes(dbName.toLowerCase())) {
    console.error(
      'ERROR: db:reset:test refuses to drop the canonical Equoria database ' +
        `("${dbName}").\n` +
        'CLAUDE.md Rule 2 ("REAL DB ONLY") points .env.test at this DB; ' +
        'dropping it would WIPE live user/horse/show/groom/transaction data.\n' +
        'See Equoria-c3kb6 incident report. If you need a fresh DB, point ' +
        'DATABASE_URL at a SEPARATE database first.',
    );
    process.exit(1);
  }

  console.log('\ndb:reset:test');
  console.log(`  host    : ${host}:${port}`);
  console.log(`  database: ${dbName}`);
  console.log('');

  // ---------------------------------------------------------------------------
  // Connect to the postgres system database to run DROP/CREATE
  // ---------------------------------------------------------------------------
  const sysClient = new Client({ host, port, user, password, database: 'postgres' });

  async function resetDatabase() {
    await sysClient.connect();

    // Terminate active connections so DROP DATABASE doesn't hang
    console.log(`  → terminating active connections to "${dbName}"...`);
    await sysClient.query(
      `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );

    // Drop
    console.log(`  → dropping database "${dbName}"...`);
    await sysClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);

    // Create
    console.log(`  → creating database "${dbName}"...`);
    await sysClient.query(`CREATE DATABASE "${dbName}"`);

    await sysClient.end();

    // Run prisma migrate deploy from packages/database
    const pkgDbPath = path.join(repoRoot, 'packages', 'database');
    console.log('  → running prisma migrate deploy...');
    try {
      const output = execSync('npx prisma migrate deploy', {
        cwd: pkgDbPath,
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
        encoding: 'utf8',
      });
      // Extract migration summary from output
      const lines = output.split('\n').filter(l => l.trim());
      const summaryLine = lines.find(l => /applied|already|No pending/i.test(l));
      console.log(`  → ${summaryLine || lines[lines.length - 1] || 'done'}`);
    } catch (err) {
      console.error('ERROR: prisma migrate deploy failed:');
      console.error(err.stderr || err.message);
      process.exit(1);
    }

    // Count migrations for confirmation
    const countClient = new Client({ host, port, user, password, database: dbName });
    await countClient.connect();
    const { rows } = await countClient.query(
      'SELECT COUNT(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    await countClient.end();

    console.log(`\n✅ "${dbName}" reset complete — ${rows[0].n} migrations applied.`);
  } // end resetDatabase

  await resetDatabase();
} // end main

// ---------------------------------------------------------------------------
// Safety guard #3 (Equoria-c3kb6): main-module check. main() reads env,
// validates safety guards #1/#2, and runs resetDatabase() which DROPs the
// database. It MUST NOT run when this file is merely imported (e.g. by a
// "smoke check" like `node -e "import('./scripts/db-reset-test.mjs')"`, which
// was the exact trigger of the c3kb6 incident). Only execute when invoked
// directly as the entry point (npm run db:reset:test).
// ---------------------------------------------------------------------------
const isMainModule =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch(err => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
