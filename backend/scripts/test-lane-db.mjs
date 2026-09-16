#!/usr/bin/env node
/**
 * Disposable test-lane databases (Equoria-bu9c4.1).
 *
 * A lane is one strictly-serial stream of backend Jest shards. Two lanes run
 * concurrently in the pre-push gate, and the reason strict serialism was ever
 * required — concurrent fixture access to ONE database produced FK/isolation
 * flakes (PRs #105-106) — disappears when each lane owns its own database.
 *
 * A lane database is built from scratch every run: CREATE DATABASE, the full
 * Prisma migration chain (`prisma migrate deploy`), then the canonical seed
 * (`seed/seedDatabase.mjs`, breeds). It never copies the live database. Names
 * carry a run id and lane index so two runs cannot collide and cleanup can
 * only ever drop what this script created.
 *
 * Safety rails (all fail closed):
 *   - the base DATABASE_URL must point at localhost; remote hosts are refused;
 *   - every lane name starts with LANE_DB_PREFIX and is validated before any
 *     CREATE/DROP; canonical names (equoria) are refused explicitly;
 *   - `destroy`/`reclaim` list pg_database and only touch prefixed names;
 *   - the connection URL is never printed — the CLI emits the lane NAME on
 *     stdout and callers rebuild the URL with laneUrlFor() from their own env.
 *
 * Usage (from backend/):
 *   node scripts/test-lane-db.mjs create  --run-id=<id> --lane=<n>   # prints name
 *   node scripts/test-lane-db.mjs destroy --name=<lane db name>
 *   node scripts/test-lane-db.mjs reclaim --run-id=<id>              # drops that run's lanes
 *   node scripts/test-lane-db.mjs list
 *
 * Programmatic use (run-suite-sharded.mjs): createLaneDatabase(), laneUrlFor(),
 * destroyLaneDatabase(), listLaneDatabases(). Side effects live in main().
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(BACKEND, '..');
const DB_PACKAGE = path.join(REPO_ROOT, 'packages', 'database');
const SCHEMA_PATH = path.join(DB_PACKAGE, 'prisma', 'schema.prisma');
const PRISMA_CLI = path.join(DB_PACKAGE, 'node_modules', 'prisma', 'build', 'index.js');
const SEED_SCRIPT = path.join(BACKEND, 'seed', 'seedDatabase.mjs');
const BREEDS_SCRIPT = path.join(BACKEND, 'seed', 'populateBreedsFromSql.mjs');

export const LANE_DB_PREFIX = 'equoria_lane_';
const LOCALHOST = new Set(['localhost', '127.0.0.1', '::1']);
const CANONICAL_DB_NAMES = new Set(['equoria', 'postgres', 'template0', 'template1']);
const NAME_PATTERN = /^equoria_lane_[a-z0-9]{6,32}_[0-9]{1,2}$/;

/**
 * Parse an env file if it is there. backend/.env.test is gitignored and only
 * ever exists on a developer machine: CI checks the repository out without it
 * and supplies DATABASE_URL through the job environment instead (Equoria-dwicn
 * — the unconditional read this replaces made every lane-backed case on the
 * GitHub runner fail with ENOENT, red since Equoria-bu9c4.1). Absence is
 * therefore normal and is reported once; any OTHER read failure still throws,
 * so a genuinely unreadable file is never silently ignored.
 */
const announcedMissing = new Set();
export function parseEnvFile(file) {
  try {
    return dotenv.parse(readFileSync(file));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    if (!announcedMissing.has(file)) {
      announcedMissing.add(file);
      // console.error appends the newline; the notice goes to stderr so the
      // `create` CLI's stdout stays exactly the lane name.
      console.error(`[lane] ${file} is absent (normal in CI); using the process environment`);
    }
    return {};
  }
}

export const DEFAULT_ENV_FILE = path.join(BACKEND, '.env.test');

/**
 * Resolve the base DATABASE_URL the suite itself would use: process env first
 * (CI and lane children set it), then backend/.env.test without override —
 * the same precedence as tests/setup.mjs and prismaClient.mjs. The env file is
 * consulted only when the environment did not already answer, so a runner that
 * has no such file never reads it at all. `envFile` exists for the sentinel.
 */
export function baseDatabaseUrl(env = process.env, envFile = DEFAULT_ENV_FILE) {
  if (env.EQUORIA_LANE_BASE_URL) {
    return env.EQUORIA_LANE_BASE_URL;
  }
  const url = env.DATABASE_URL || parseEnvFile(envFile).DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in the environment or backend/.env.test');
  }
  return url;
}

function assertLocal(url) {
  const parsed = new URL(url);
  if (!LOCALHOST.has(parsed.hostname)) {
    throw new Error(
      `test lanes only run against a local PostgreSQL; refusing host ${parsed.hostname}`,
    );
  }
  return parsed;
}

export function assertLaneName(name) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    throw new Error(`not a lane database name: ${JSON.stringify(name)}`);
  }
  if (CANONICAL_DB_NAMES.has(name.toLowerCase())) {
    throw new Error(`refusing to touch canonical database ${name}`);
  }
  if (!name.startsWith(LANE_DB_PREFIX)) {
    throw new Error(`lane database names must start with ${LANE_DB_PREFIX}`);
  }
  return name;
}

export function laneName(runId, lane) {
  if (!/^[a-z0-9]{6,32}$/.test(runId)) {
    throw new Error('run id must be 6-32 lowercase alphanumerics');
  }
  const index = Number.parseInt(String(lane), 10);
  if (!Number.isInteger(index) || index < 1 || index > 99) {
    throw new Error('lane index must be an integer between 1 and 99');
  }
  return assertLaneName(`${LANE_DB_PREFIX}${runId}_${index}`);
}

export function newRunId() {
  return randomBytes(6).toString('hex');
}

/** URL of one lane database, derived from the base URL (same credentials/host). */
export function laneUrlFor(name, env = process.env) {
  assertLaneName(name);
  const url = assertLocal(baseDatabaseUrl(env));
  url.pathname = `/${name}`;
  return url.toString();
}

function adminUrl(env = process.env) {
  const url = assertLocal(baseDatabaseUrl(env));
  url.pathname = '/postgres';
  return url.toString();
}

async function withAdmin(env, fn) {
  const client = new Client({ connectionString: adminUrl(env), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Provisioning subprocesses currently running (migrate deploy, seeds). The
 * sharded runner stops and awaits these on cancellation BEFORE destroying any
 * lane database, so a drop can never run underneath a live migration.
 *
 * Round 2, P2 (Codex review 2026-09-16): these used to be execFileSync calls —
 * synchronous, untimed, and invisible to cancellation. A hung migration or
 * seed made the runner unable to handle a signal at all.
 */
export const activeProvisioningChildren = new Set();

/** Hard ceiling for any single provisioning step. A migration or seed that
 *  exceeds it is killed and provisioning fails loudly. Measured: ~1 s per lane. */
export const PROVISIONING_STEP_TIMEOUT_MS = 10 * 60 * 1000;

/** Keep only the tail of a stream, so a chatty child cannot grow memory. */
const OUTPUT_TAIL_BYTES = 64 * 1024;

/**
 * Cancellation propagated INTO provisioning (Codex round 3, P2). The runner's
 * cleanup snapshot can only stop children that already exist; if a signal
 * lands while createLaneDatabase() is awaiting the database, migration and
 * seeds would otherwise still launch afterwards and cleanup would wait on
 * them. So every boundary here checks the signal itself: after the async
 * database wait and before EVERY subprocess launch. A running subprocess is
 * killed through spawn()'s own `signal` option. No registry polling, no
 * larger timeouts.
 */
export const PROVISIONING_CANCELLED = 'PROVISIONING_CANCELLED';

function cancellationError(where, signal) {
  const why =
    signal?.reason instanceof Error ? signal.reason.message : String(signal?.reason ?? 'cancelled');
  const error = new Error(`[lane] provisioning cancelled ${where} (${why})`);
  error.code = PROVISIONING_CANCELLED;
  return error;
}

function throwIfCancelled(signal, where) {
  if (signal?.aborted) {
    throw cancellationError(where, signal);
  }
}

/**
 * Run one provisioning step as a SUPERVISED child: registered while alive,
 * bounded by its own deadline (SIGKILL on expiry), and resolved/rejected on
 * real exit — never on signal alone.
 */
export function runSupervisedStep({
  args,
  cwd,
  env,
  label,
  timeoutMs = PROVISIONING_STEP_TIMEOUT_MS,
  signal,
}) {
  return new Promise((resolve, reject) => {
    // Never launch after cancellation, even if the caller forgot to check.
    if (signal?.aborted) {
      reject(cancellationError(`before launching ${label}`, signal));
      return;
    }
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: timeoutMs,
      killSignal: 'SIGKILL',
      // Abort -> Node kills the child with killSignal; we settle on its exit.
      signal,
    });
    activeProvisioningChildren.add(child);

    let out = '';
    let err = '';
    child.stdout.on('data', chunk => {
      out = (out + chunk.toString()).slice(-OUTPUT_TAIL_BYTES);
    });
    child.stderr.on('data', chunk => {
      err = (err + chunk.toString()).slice(-OUTPUT_TAIL_BYTES);
    });

    // Settle exactly once, on the child's REAL exit. Deliberately NOT the
    // events `once` helper: it rejects as soon as the emitter emits 'error',
    // and on abort Node emits an AbortError BEFORE the exit — which let a raw
    // ABORT_ERR escape ahead of the cancellation report.
    let settled = false;
    const finish = fn => {
      if (settled) {
        return;
      }
      settled = true;
      activeProvisioningChildren.delete(child);
      fn();
    };

    child.on('exit', (code, exitSignal) => {
      finish(() => {
        if (code === 0) {
          resolve(out);
          return;
        }
        if (signal?.aborted) {
          reject(cancellationError(`while ${label} was running; it was terminated`, signal));
          return;
        }
        const how = exitSignal ? `was killed by ${exitSignal}` : `exited with code ${code}`;
        const why = exitSignal === 'SIGKILL' ? ` (deadline ${timeoutMs} ms, or cancellation)` : '';
        reject(
          new Error(`[lane] ${label} ${how}${why}: ${err.trim() || out.trim() || '(no output)'}`),
        );
      });
    });

    child.on('error', error => {
      // On abort, spawn() emits AbortError and then kills the child; the 'exit'
      // above reports that as a cancellation. Only a launch failure — a child
      // that never started, so no 'exit' will ever come — settles here.
      if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
        return;
      }
      finish(() => reject(error));
    });
  });
}

function runPrisma(args, databaseUrl, signal) {
  return runSupervisedStep({
    args: [PRISMA_CLI, ...args, `--schema=${SCHEMA_PATH}`],
    cwd: DB_PACKAGE,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    label: `prisma ${args.join(' ')}`,
    signal,
  });
}

function runSeedScript(script, databaseUrl, signal) {
  return runSupervisedStep({
    args: [script],
    cwd: BACKEND,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl },
    label: `seed ${path.basename(script)}`,
    signal,
  });
}

/**
 * Canonical data a lane needs to satisfy the suite: the minimal seed (breeds
 * used by fixtures) plus the complete 312-breed roster with genetic profiles
 * from backend/data/breeds (breedCountSentinel, breedProfileLoader and the
 * renderable-profile suites assert against it). Measured: ~1s per lane.
 */
async function runSeed(databaseUrl, signal) {
  throwIfCancelled(signal, 'before the canonical seed');
  await runSeedScript(SEED_SCRIPT, databaseUrl, signal);
  throwIfCancelled(signal, 'before the breeds seed');
  await runSeedScript(BREEDS_SCRIPT, databaseUrl, signal);
}

/**
 * Move every serial sequence past its table max. Seeds and migrations that
 * insert explicit ids leave sequences behind on a fresh database, and the
 * next autoincrement insert then collides — a failure the live database
 * never shows because its sequences are far ahead.
 */
async function resyncSequences(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
        FROM pg_class s
        JOIN pg_depend d ON d.objid = s.oid
        JOIN pg_class t ON d.refobjid = t.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       WHERE s.relkind = 'S' AND t.relkind = 'r'`);
    for (const { seq, tbl, col } of rows) {
      await client.query(
        `SELECT setval('"${seq}"', GREATEST((SELECT COALESCE(MAX("${col}"), 1) FROM "${tbl}"), 1))`,
      );
    }
    return rows.length;
  } finally {
    await client.end();
  }
}

export async function listLaneDatabases(env = process.env, runId = null) {
  const rows = await withAdmin(env, client =>
    client.query('SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname', [
      `${LANE_DB_PREFIX}%`,
    ]),
  );
  return rows.rows
    .map(row => row.datname)
    .filter(name => NAME_PATTERN.test(name))
    .filter(name => (runId ? name.startsWith(`${LANE_DB_PREFIX}${runId}_`) : true));
}

/**
 * Create, migrate and seed one lane database. Returns { name, migrations }.
 * On any failure after CREATE the database is dropped again before rethrow,
 * so a half-built lane never survives.
 */
/**
 * The Postgres admin boundary used by createLaneDatabase(). Injectable so a
 * bounded sentinel can model the database wait with a barrier and prove that
 * cancellation arriving DURING that wait launches no provisioning subprocess.
 * This is a genuine third-party network boundary with no safe DB-free sandbox;
 * production always uses the default.
 */
export const defaultDatabaseOps = {
  create: (name, env) => withAdmin(env, client => client.query(`CREATE DATABASE "${name}"`)),
  drop: (name, env, log) => destroyLaneDatabase({ name, env, log }),
};

export async function createLaneDatabase({
  runId,
  lane,
  env = process.env,
  log = () => {},
  signal,
  databaseOps = defaultDatabaseOps,
}) {
  const name = laneName(runId, lane);
  const url = laneUrlFor(name, env);
  throwIfCancelled(signal, `before creating ${name}`);
  log(`[lane] creating ${name}`);
  await databaseOps.create(name, env);
  try {
    // The database now EXISTS. If cancellation landed while we were waiting
    // for it, stop here: launching migration/seeds would be continued work
    // after cancellation. The catch below drops what was just created.
    throwIfCancelled(signal, `after creating ${name}`);
    log(`[lane] ${name}: prisma migrate deploy`);
    await runPrisma(['migrate', 'deploy'], url, signal);
    throwIfCancelled(signal, `before seeding ${name}`);
    log(`[lane] ${name}: seeding canonical data`);
    await runSeed(url, signal);
    throwIfCancelled(signal, `before resyncing ${name}`);
    const sequences = await resyncSequences(url);
    log(`[lane] ${name}: ${sequences} sequences resynced`);
    const client = new Client({ connectionString: url });
    await client.connect();
    let migrations;
    try {
      const { rows } = await client.query(
        'SELECT COUNT(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
      );
      migrations = rows[0].n;
    } finally {
      await client.end();
    }
    log(`[lane] ${name}: ready (${migrations} migrations applied)`);
    return { name, migrations };
  } catch (error) {
    log(
      error?.code === PROVISIONING_CANCELLED
        ? `[lane] ${name}: provisioning cancelled, dropping`
        : `[lane] ${name}: provisioning failed, dropping`,
    );
    await databaseOps.drop(name, env, log).catch(dropError => {
      log(`[lane] ${name}: cleanup after failure also failed: ${dropError.message}`);
    });
    throw error;
  }
}

/** Drop one lane database. Refuses anything that is not a lane name. */
export async function destroyLaneDatabase({ name, env = process.env, log = () => {} }) {
  assertLaneName(name);
  await withAdmin(env, async client => {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  });
  log(`[lane] dropped ${name}`);
}

/** Drop every lane database of one run id (interrupted-run reclaim). */
export async function reclaimRun({ runId, env = process.env, log = () => {} }) {
  const names = await listLaneDatabases(env, runId);
  for (const name of names) {
    await destroyLaneDatabase({ name, env, log });
  }
  return names;
}

function opt(args, name) {
  const found = args.find(arg => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : undefined;
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  const log = line => process.stderr.write(`${line}\n`);
  switch (command) {
    case 'create': {
      const runId = opt(args, 'run-id') || newRunId();
      const lane = opt(args, 'lane') || '1';
      const { name } = await createLaneDatabase({ runId, lane, log });
      process.stdout.write(`${name}\n`);
      return;
    }
    case 'destroy': {
      await destroyLaneDatabase({ name: opt(args, 'name'), log });
      return;
    }
    case 'reclaim': {
      const runId = opt(args, 'run-id');
      if (!runId) {
        throw new Error('reclaim requires --run-id=<id>');
      }
      const dropped = await reclaimRun({ runId, log });
      process.stdout.write(`${dropped.join('\n')}${dropped.length ? '\n' : ''}`);
      return;
    }
    case 'list': {
      const names = await listLaneDatabases();
      process.stdout.write(`${names.join('\n')}${names.length ? '\n' : ''}`);
      return;
    }
    default:
      throw new Error(
        'usage: test-lane-db.mjs <create|destroy|reclaim|list> [--run-id= --lane= --name=]',
      );
  }
}

// Windows-safe main-module guard (CONTRIBUTING.md "CLI scripts"): side effects
// only when executed directly, never on import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
