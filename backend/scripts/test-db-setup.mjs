#!/usr/bin/env node
/**
 * One-time (and safe to repeat) setup of the local test database
 * (Equoria-8w3ax).
 *
 * Usage, from the repository root:  npm run test:db:setup
 *
 * Reads the test DATABASE_URL (process environment first, then
 * backend/.env.test — the precedence the test run itself uses), refuses it
 * unless tests/config/testDatabaseGuard.mjs accepts it (local host, a `_test`
 * name, not the game database in backend/.env), then:
 *   1. creates the database if it does not exist (never drops anything);
 *   2. applies the migration chain with `prisma migrate deploy` (never reset,
 *      never generate);
 *   3. loads the canonical seed data the suite needs (breeds) and resyncs
 *      sequences — the same idempotent steps a sharded-gate lane gets.
 *
 * Run it again after pulling new migrations. The connection URL is never
 * printed.
 */
import { fileURLToPath } from 'node:url';
import { assertTestDatabaseUrl, readGameDatabaseUrls } from '../tests/config/testDatabaseGuard.mjs';
import { baseDatabaseUrl, provisionDatabase, withAdmin } from './test-lane-db.mjs';

const safeIdentifier = /^[a-z0-9_]+$/;

export async function setupTestDatabase({ env = process.env, log = () => {} } = {}) {
  // Never the sharded runner's lane override: this script is about the one
  // persistent test database.
  const url = baseDatabaseUrl({ ...env, EQUORIA_LANE_BASE_URL: '' });
  const { database } = assertTestDatabaseUrl(url, { gameUrls: readGameDatabaseUrls() });
  if (!safeIdentifier.test(database)) {
    throw new Error(`refusing to create a database named ${JSON.stringify(database)}`);
  }
  const adminEnv = { ...env, EQUORIA_LANE_BASE_URL: '', DATABASE_URL: url };
  const created = await withAdmin(adminEnv, async client => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      database,
    ]);
    if (rowCount > 0) {
      return false;
    }
    await client.query(`CREATE DATABASE "${database}"`);
    return true;
  });
  log(`[test-db] ${database}: ${created ? 'created' : 'already exists'}`);
  const { migrations } = await provisionDatabase({ name: database, url, log });
  return { database, created, migrations };
}

async function main() {
  const log = line => console.log(line.replace('[lane]', '[test-db]'));
  const { database, migrations } = await setupTestDatabase({ log });
  console.log(`[test-db] ${database} is ready (${migrations} migrations applied).`);
}

// Windows-safe main-module guard (CONTRIBUTING.md "CLI scripts").
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(`[test-db] setup failed: ${error.message}`);
    process.exit(1);
  });
}
