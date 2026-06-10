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
 * Three guarantees:
 *  1. `prisma migrate deploy` against an empty database applies every
 *     migration with zero failures, and `prisma migrate status` reports the
 *     schema up to date.
 *  2. The post-replay schema has the three horse FKs and the email-token FK
 *     exactly once each, with the intended delete actions (RESTRICT for the
 *     horse FKs, CASCADE for email tokens) — verified from pg_constraint,
 *     not from Prisma's own bookkeeping.
 *  3. Sentinel-positive: a PLANTED migration with the literal defect class
 *     (bare duplicate ADD CONSTRAINT) makes the replay FAIL — proving the
 *     sentinel detects the regression rather than merely passing when
 *     nothing is wrong (OPTIMAL_FIX_DISCIPLINE §2).
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
