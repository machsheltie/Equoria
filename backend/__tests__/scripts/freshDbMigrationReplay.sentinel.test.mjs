/**
 * Fresh-database migration-replay sentinel (Equoria-fefh2.14).
 *
 * Proves the COMPLETE Prisma migration chain applies from zero against a
 * brand-new, empty PostgreSQL database — the exact precondition CI's Quality
 * Gate DB preflight, HttpOnly cookie-auth backend job, and ZAP schema setup
 * all share. The 2026-06-10 incident class this guards: a drift-reconciliation
 * migration (v58ta horses FKs; email_verification_tokens userId FK) does a
 * bare ADD CONSTRAINT that succeeds on the drifted live DB but collides with
 * the constraint an earlier migration already created on a fresh replay,
 * aborting `prisma migrate deploy` for every fresh environment.
 *
 * Five guarantees:
 *  1. `prisma migrate deploy` against an empty database applies every
 *     migration with zero failures, and `prisma migrate status` reports the
 *     schema up to date.
 *  2. The post-replay schema has the three horse FKs and the email-token FK
 *     exactly once each, with the intended delete actions (RESTRICT for the
 *     horse FKs, CASCADE for email tokens) — verified from pg_constraint,
 *     not from Prisma's own bookkeeping.
 *  3. The post-replay schema carries the three ACTIVE-only PARTIAL unique
 *     indexes on the staff-assignment tables (Equoria-kccmt), each with its
 *     `WHERE "isActive"` predicate and over the right column pair, and the
 *     composite uniques they replaced are gone. These exist only in raw
 *     migration SQL — Prisma cannot express a partial index — so nothing else
 *     in the repository notices if a schema-reconciliation migration drops
 *     them. See ACTIVE_PARTIAL_INDEXES below.
 *  4. Sentinel-positive: a PLANTED migration with the literal defect class
 *     (bare duplicate ADD CONSTRAINT) makes the replay FAIL — proving the
 *     sentinel detects the regression rather than merely passing when
 *     nothing is wrong (OPTIMAL_FIX_DISCIPLINE §2).
 *  5. Sentinel-positive for guarantee 3: replacing one partial index with a
 *     PLAIN unique index of the same name, table, columns and uniqueness —
 *     losing only the predicate — makes the guard FAIL. A check that a plain
 *     unique index could satisfy would not be a guard at all.
 *
 * Safety: operates ONLY on freshly created `equoria_replay_sentinel_*`
 * databases; a hard guard refuses any other target. The canonical DB is
 * never written. The planted migration is created inside the test and
 * removed in `finally`; an afterAll assertion fails loudly if it survives.
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const DB_PACKAGE = path.join(REPO_ROOT, 'packages', 'database');
const SCHEMA_PATH = path.join(DB_PACKAGE, 'prisma', 'schema.prisma');
const MIGRATIONS_DIR = path.join(DB_PACKAGE, 'prisma', 'migrations');
const PRISMA_CLI = path.join(DB_PACKAGE, 'node_modules', 'prisma', 'build', 'index.js');

// Sorts after every real migration (14-digit timestamps start with "2").
const PLANTED_MIGRATION_NAME = '99991231235959_planted_duplicate_constraint_sentinel';
const PLANTED_DIR = path.join(MIGRATIONS_DIR, PLANTED_MIGRATION_NAME);

const REPLAY_DB_PREFIX = 'equoria_replay_sentinel_';
const replayDbName = `${REPLAY_DB_PREFIX}${randomBytes(6).toString('hex')}`;

/**
 * The three ACTIVE-only partial unique indexes on the staff-assignment tables
 * (Equoria-kccmt, migration
 * 20260907120000_kccmt_partial_unique_active_staff_assignments).
 *
 * WHY THEY NEED A SENTINEL. Prisma cannot express a partial index in
 * `@@unique`/`@@index`, so these three live ONLY in raw migration SQL and are
 * invisible to `schema.prisma`. That divergence is not merely cosmetic: a
 * future `prisma migrate dev` diffs the schema against the replayed history and
 * can propose a migration that DROPs them, and accepting that proposal would
 * silently delete the database's only defence against two concurrent writers
 * leaving two ACTIVE assignments on one (staff, horse) pair. Nothing else in
 * the repository fails if that happens. This does.
 *
 * Listed in `pg_class.relname` order so the catalog query's `ORDER BY` matches.
 */
const ACTIVE_PARTIAL_INDEXES = Object.freeze([
  Object.freeze({
    index: 'groom_assignments_active_foalId_groomId_key',
    table: 'groom_assignments',
    columns: Object.freeze(['foalId', 'groomId']),
  }),
  Object.freeze({
    index: 'rider_assignments_active_riderId_horseId_key',
    table: 'rider_assignments',
    columns: Object.freeze(['riderId', 'horseId']),
  }),
  Object.freeze({
    index: 'trainer_assignments_active_trainerId_horseId_key',
    table: 'trainer_assignments',
    columns: Object.freeze(['trainerId', 'horseId']),
  }),
]);

/**
 * The composite uniques the migration replaced. `isActive` was part of the key,
 * so they capped assignment HISTORY at one inactive row per pair. If one of
 * these names comes back, the defect came back with it.
 */
const RETIRED_COMPOSITE_UNIQUES = Object.freeze([
  'rider_assignments_riderId_horseId_isActive_key',
  'trainer_assignments_trainerId_horseId_isActive_key',
  'groom_assignments_foalId_groomId_isActive_key',
]);

/**
 * Read the three indexes straight out of the system catalog.
 *
 * `pg_get_expr(indpred, indrelid)` is the index's PARTIAL predicate and is NULL
 * for an ordinary index — which is precisely the distinction a name-only or
 * uniqueness-only check would miss. Same posture as the FK test above: read
 * `pg_index`/`pg_class`, never Prisma's own bookkeeping.
 *
 * @param {import('pg').Client} client
 * @returns {Promise<Array<{index_name: string, is_unique: boolean, predicate: string | null}>>}
 */
async function readActiveUniqueIndexes(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS index_name,
            i.indisunique AS is_unique,
            pg_get_expr(i.indpred, i.indrelid) AS predicate
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = ANY($1::text[])
      ORDER BY c.relname`,
    [ACTIVE_PARTIAL_INDEXES.map(entry => entry.index)],
  );
  return rows;
}

/**
 * The guard itself, extracted so the sentinel-positive test can prove it FAILS
 * on a defective catalog rather than only passing on a healthy one.
 *
 * @param {Array<{index_name: string, is_unique: boolean, predicate: string | null}>} rows
 */
function assertActiveOnlyPartialUniques(rows) {
  expect(rows.map(row => row.index_name)).toEqual(ACTIVE_PARTIAL_INDEXES.map(entry => entry.index));
  for (const row of rows) {
    expect(row.is_unique).toBe(true);
    // Postgres renders `WHERE "isActive"` (a bare boolean column) as `"isActive"`.
    // A plain, non-partial unique index yields NULL here.
    expect(row.predicate).not.toBeNull();
    expect(row.predicate).toMatch(/"isActive"/);
  }
}

/** Admin URL (server-level, default `postgres` maintenance DB) derived from DATABASE_URL. */
function adminUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL is not set — the sentinel needs server credentials to create its temp database');
  }
  const u = new URL(base);
  u.pathname = '/postgres';
  u.search = '';
  return u.toString();
}

/** URL pointing at the temp replay database. */
function replayUrl() {
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = `/${replayDbName}`;
  u.search = '';
  return u.toString();
}

/** Hard guard: refuse to CREATE/DROP anything that is not our random temp DB. */
function assertIsReplayDb(name) {
  if (!name.startsWith(REPLAY_DB_PREFIX) || name === 'equoria') {
    throw new Error(`Refusing to operate on non-sentinel database "${name}"`);
  }
}

async function withAdmin(fn) {
  const client = new Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function runPrisma(args, databaseUrl) {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args, `--schema=${SCHEMA_PATH}`], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: DB_PACKAGE,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('fresh-database migration replay sentinel (Equoria-fefh2.14)', () => {
  beforeAll(async () => {
    assertIsReplayDb(replayDbName);
    await withAdmin(client => client.query(`CREATE DATABASE "${replayDbName}"`));
  }, 60_000);

  afterAll(async () => {
    // Planted migration must never outlive the test run — fail loudly if it does.
    expect(existsSync(PLANTED_DIR)).toBe(false);
    assertIsReplayDb(replayDbName);
    await withAdmin(client => client.query(`DROP DATABASE IF EXISTS "${replayDbName}" WITH (FORCE)`));
  }, 60_000);

  test('complete migration chain applies from zero and migrate status is clean', () => {
    const deployOut = runPrisma(['migrate', 'deploy'], replayUrl());
    expect(deployOut).not.toMatch(/failed|error/i);

    const statusOut = runPrisma(['migrate', 'status'], replayUrl());
    expect(statusOut).toMatch(/Database schema is up to date/i);
  }, 300_000);

  test('replayed schema has the horse FKs and email-token FK exactly once with intended delete actions', async () => {
    const client = new Client({ connectionString: replayUrl() });
    await client.connect();
    try {
      const horseFks = await client.query(
        `SELECT conname, confdeltype, count(*) AS occurrences
           FROM pg_constraint
          WHERE conname IN ('horses_userId_fkey', 'horses_sireId_fkey', 'horses_damId_fkey')
          GROUP BY conname, confdeltype
          ORDER BY conname`,
      );
      expect(horseFks.rows).toEqual([
        { conname: 'horses_damId_fkey', confdeltype: 'r', occurrences: '1' },
        { conname: 'horses_sireId_fkey', confdeltype: 'r', occurrences: '1' },
        { conname: 'horses_userId_fkey', confdeltype: 'r', occurrences: '1' },
      ]);

      const emailFk = await client.query(
        `SELECT conname, confdeltype, count(*) AS occurrences
           FROM pg_constraint
          WHERE conname = 'email_verification_tokens_userId_fkey'
          GROUP BY conname, confdeltype`,
      );
      expect(emailFk.rows).toEqual([
        { conname: 'email_verification_tokens_userId_fkey', confdeltype: 'c', occurrences: '1' },
      ]);
    } finally {
      await client.end();
    }
  }, 60_000);

  test('replayed schema carries the three ACTIVE-only partial unique indexes, predicate included', async () => {
    const client = new Client({ connectionString: replayUrl() });
    await client.connect();
    try {
      assertActiveOnlyPartialUniques(await readActiveUniqueIndexes(client));

      // Each one covers the right pair of columns, in order.
      for (const entry of ACTIVE_PARTIAL_INDEXES) {
        const { rows } = await client.query('SELECT indexdef FROM pg_indexes WHERE indexname = $1', [entry.index]);
        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toMatch(new RegExp(`\\("${entry.columns[0]}", "${entry.columns[1]}"\\)`));
      }

      // And the composite uniques they replaced are really gone from a fresh
      // replay — not merely dropped on the developer's own database.
      const retired = await client.query(
        `SELECT c.relname
           FROM pg_index i
           JOIN pg_class c ON c.oid = i.indexrelid
          WHERE c.relname = ANY($1::text[])`,
        [[...RETIRED_COMPOSITE_UNIQUES]],
      );
      expect(retired.rows).toEqual([]);
    } finally {
      await client.end();
    }
  }, 60_000);

  test('SENTINEL-POSITIVE: replacing one with a plain unique index (no predicate) fails the guard', async () => {
    // The regression this sentinel exists for is subtle: the index keeps its
    // NAME, its TABLE, its COLUMNS and its UNIQUENESS, and loses only the
    // `WHERE "isActive"` predicate — which is exactly what a Prisma-generated
    // "reconciliation" migration would produce if someone accepted a proposal to
    // bring these indexes back under `@@unique`. A guard that checked the name,
    // or even the name and uniqueness, would stay green through it. This proves
    // the guard does not.
    //
    // The mutation is applied to the disposable replay database only (the hard
    // guard above refuses any other target) and is undone before the test ends.
    const target = ACTIVE_PARTIAL_INDEXES[1]; // rider_assignments
    const client = new Client({ connectionString: replayUrl() });
    await client.connect();
    try {
      try {
        await client.query(`DROP INDEX "${target.index}"`);
        await client.query(
          `CREATE UNIQUE INDEX "${target.index}" ON "${target.table}" ("${target.columns[0]}", "${target.columns[1]}")`,
        );

        const rows = await readActiveUniqueIndexes(client);
        const planted = rows.find(row => row.index_name === target.index);

        // Everything a weaker check would look at is still intact ...
        expect(planted).toBeDefined();
        expect(planted.is_unique).toBe(true);
        // ... and the one thing that matters is missing.
        expect(planted.predicate).toBeNull();

        // The guard must reject this catalog.
        expect(() => assertActiveOnlyPartialUniques(rows)).toThrow();
      } finally {
        await client.query(`DROP INDEX IF EXISTS "${target.index}"`);
        await client.query(
          `CREATE UNIQUE INDEX "${target.index}" ON "${target.table}" ("${target.columns[0]}", "${target.columns[1]}") WHERE "isActive"`,
        );
      }

      // Restored: the guard passes again, so this test leaves the replay
      // database exactly as it found it.
      assertActiveOnlyPartialUniques(await readActiveUniqueIndexes(client));
    } finally {
      await client.end();
    }
  }, 60_000);

  test('SENTINEL-POSITIVE: a planted bare duplicate ADD CONSTRAINT migration fails the replay', () => {
    // The literal 2026-06-10 defect class: re-ADD a constraint an earlier
    // migration already created, with no DROP IF EXISTS guard.
    const plantedSql = [
      '-- PLANTED VIOLATION (sentinel-positive proof, created and removed by',
      '-- freshDbMigrationReplay.sentinel.test.mjs — must never be committed).',
      'ALTER TABLE "horses"',
      '  ADD CONSTRAINT "horses_userId_fkey"',
      '  FOREIGN KEY ("userId")',
      '  REFERENCES "User"("id")',
      '  ON DELETE RESTRICT',
      '  ON UPDATE CASCADE;',
      '',
    ].join('\n');

    mkdirSync(PLANTED_DIR, { recursive: true });
    try {
      writeFileSync(path.join(PLANTED_DIR, 'migration.sql'), plantedSql, 'utf8');

      let failure = null;
      try {
        // The replay DB is already fully migrated, so deploy applies ONLY the
        // planted migration — cheap, and exactly the fresh-collision failure.
        runPrisma(['migrate', 'deploy'], replayUrl());
      } catch (err) {
        failure = err;
      }
      expect(failure).not.toBeNull();
      const combined = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}\n${failure.message}`;
      expect(combined).toMatch(/already exists/i);
    } finally {
      rmSync(PLANTED_DIR, { recursive: true, force: true });
    }

    // The failed planted migration leaves a failed row in the replay DB's
    // _prisma_migrations; the DB is dropped in afterAll, so no residue.
    expect(existsSync(PLANTED_DIR)).toBe(false);
  }, 120_000);
});
