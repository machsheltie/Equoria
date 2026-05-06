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

import { createRequire } from 'module';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Load .env.test
// ---------------------------------------------------------------------------
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
// Safety guard: must be localhost
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

console.log(`\ndb:reset:test`);
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
  console.log(`  → running prisma migrate deploy...`);
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
    `SELECT COUNT(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
  );
  await countClient.end();

  console.log(`\n✅ "${dbName}" reset complete — ${rows[0].n} migrations applied.`);
}

resetDatabase().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
