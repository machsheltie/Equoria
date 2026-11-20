/**
 * Test-database guard (Equoria-8w3ax).
 *
 * Every backend Jest run creates, changes and deletes rows. Until 2026-11-20
 * backend/.env.test and backend/.env both named the local `equoria` database,
 * so test runs wrote into the owner's game (a time-back test left two
 * time-backs applied to her horses). This guard refuses to start a test run
 * unless the database it would use is a test database:
 *
 *   - the host is local (localhost, 127.0.0.1, ::1). CI's Postgres service
 *     containers are reached as localhost too (.github/workflows), and the
 *     sharded gate's lane databases live on the same local server. Any remote
 *     host — Supabase, Railway, anything else — is refused;
 *   - the database name ends in `_test` (`equoria_test`, CI's name) or is a
 *     disposable lane database made by backend/scripts/test-lane-db.mjs
 *     (`equoria_lane_<runId>_<lane>`);
 *   - it is not the database backend/.env (the local game) points at.
 *
 * It runs before any test touches the database: in both Jest global setups
 * and in the test environment every backend config uses
 * (tests/config/PrismaCleanupEnvironment.mjs), so in-band runs, worker
 * processes, the sharded gate's lanes and CI all pass through it.
 *
 * The URL is never printed; refusals name only host, port and database.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const testEnvFile = path.join(backendDir, '.env.test');
export const gameEnvFile = path.join(backendDir, '.env');

const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const testNamePattern = /^[a-z0-9_]+_test$/;
// Same shape as namePattern in backend/scripts/test-lane-db.mjs (the guard's
// test checks a real laneName() result against it).
const laneNamePattern = /^equoria_lane_[a-z0-9]{6,32}_[0-9]{1,2}$/;
const defaultPort = '5432';

const setupHint =
  'Point DATABASE_URL in backend/.env.test at the local test database ' +
  '(postgresql://<user>:<password>@localhost:5432/equoria_test) and create it once with ' +
  '`npm run test:db:setup`. See docs/development-guide.md.';

/** Host, port and database name of a Postgres URL, or null when it does not parse. */
export function describeDatabaseTarget(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return null;
  }
  let database;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  return {
    host,
    port: parsed.port || defaultPort,
    database,
    isLocal: localHosts.has(host),
  };
}

function sameTarget(a, b) {
  const hostKey = target => (target.isLocal ? 'local' : target.host);
  return hostKey(a) === hostKey(b) && a.port === b.port && a.database === b.database;
}

function label(target) {
  return `${target.host}:${target.port}/${target.database}`;
}

/**
 * Why `url` is not an acceptable test database, or null when it is.
 * `gameUrls` are the local game's database URLs (backend/.env); a target equal
 * to any of them is refused even if its name looks like a test name.
 */
export function testDatabaseRefusal(url, { gameUrls = [] } = {}) {
  const target = describeDatabaseTarget(url);
  if (!target) {
    return 'DATABASE_URL is missing or is not a postgresql:// URL';
  }
  if (!target.isLocal) {
    return `host "${target.host}" is not local; tests only run against a Postgres on this machine (or CI's localhost service)`;
  }
  if (!testNamePattern.test(target.database) && !laneNamePattern.test(target.database)) {
    return `database "${target.database}" is not a test database; its name must end in _test or be a disposable equoria_lane_* database`;
  }
  for (const gameUrl of gameUrls) {
    const game = describeDatabaseTarget(gameUrl);
    if (game && sameTarget(target, game)) {
      return `database ${label(target)} is the one backend/.env (the local game) uses`;
    }
  }
  return null;
}

/** Throw a clear error unless `url` is an acceptable test database. */
export function assertTestDatabaseUrl(url, options) {
  const reason = testDatabaseRefusal(url, options);
  if (reason) {
    throw new Error(`[test-db-guard] Refusing to run tests: ${reason}.\n${setupHint}`);
  }
  return describeDatabaseTarget(url);
}

/** The game's DATABASE_URL from backend/.env, as a list; empty when the file is absent (CI). */
export function readGameDatabaseUrls(file = gameEnvFile) {
  let parsed;
  try {
    parsed = dotenv.parse(readFileSync(file));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return parsed.DATABASE_URL ? [parsed.DATABASE_URL] : [];
}

/**
 * Resolve the database this process's tests will use and refuse anything that
 * is not a test database. Loads backend/.env.test WITHOUT override first — the
 * same precedence as tests/setup.mjs and packages/database/prismaClient.mjs —
 * so a value CI or the sharded runner put in the environment wins, and a
 * missing DATABASE_URL can never fall through to backend/.env later.
 */
export function guardTestDatabase({ env = process.env, envFile = testEnvFile } = {}) {
  dotenv.config({ path: envFile, processEnv: env, quiet: true });
  return assertTestDatabaseUrl(env.DATABASE_URL, { gameUrls: readGameDatabaseUrls() });
}
