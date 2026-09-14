#!/usr/bin/env node
/**
 * Live-schema drift check (Equoria-axyem.2).
 *
 * WHAT THIS REPLACES. `packages/database/migrations/verify_migration.js`
 * (deleted by fee265d07, its dead CI step removed by a22ac438f) queried
 * `information_schema.columns` and `pg_indexes` against a LIVE database and
 * exited 1 when an object was missing. Its coverage was ONE table plus two
 * `horses` columns. The justification for deleting it — "all declared in
 * schema.prisma and enforced by migrate deploy" — swapped what SHOULD exist
 * for what DOES exist. That substitution is the thing this file refuses to
 * make.
 *
 * WHAT IT ASSERTS. The assertion is about the live database and nothing else.
 * `schema.prisma` is never parsed here and never treated as evidence. The
 * expected catalog is produced by REPLAYING the migration chain into a
 * freshly created, disposable reference database and then reading THAT
 * database's catalog — so the declaration is itself a live Postgres catalog,
 * which is the only form in which a raw-SQL partial index, a CHECK constraint
 * or a column default can be compared honestly. Both sides come from
 * `information_schema.columns`, `information_schema.tables`, `pg_indexes` and
 * `pg_constraint`.
 *
 * BOTH DIRECTIONS FAIL. An object the migrations produce but the live
 * database lacks is drift. An object the live database carries but the
 * migrations do not produce is also drift. A definition that differs on
 * either side is drift. Every finding names the object.
 *
 * SCOPE, AND IT IS A FLOOR. Every table in `public`, not one. The floor the old
 * script covered — `horses.bondScore`, `horses.stressLevel`, the eight
 * `foal_training_history` columns and the five `foal_training_history` indexes
 * including `foal_training_history_pkey` — is a strict subset of what is
 * compared here.
 *
 * WHAT IS **NOT** COMPARED, so nobody reads a passing run as total schema
 * coverage: enum TYPES and their LABELS (columns record only `udt_name`, so
 * adding or dropping an enum value is invisible — six `enum` blocks exist in
 * schema.prisma); view BODIES (a view's presence shows in `tables`, its
 * definition does not); triggers; functions and procedures; sequence
 * parameters (only the `nextval(...)` default text is seen); extensions;
 * collations and domains; ownership, grants and RLS policies; column ORDINAL
 * POSITION (a reordered table compares equal); and every schema other than
 * `public`. Each of those is a real drift class this check would sit through.
 * Adding one means adding a section to CATALOG_SECTIONS — the diff and the
 * reporting need no change.
 *
 * THE ONE TOLERATED CLASS. Extra indexes are tolerated only when the name is on
 * the hardcoded RUNTIME_CREATED_INDEX_ALLOWLIST below — today, one name, with
 * its reason spelled out beside it. Tolerance applies to EXTRA indexes only:
 * missing and redefined objects are never tolerated, in any section, and an
 * index the reference database also has is compared normally, so the tolerance
 * can only ever excuse a name the migration chain does not produce at all.
 *
 * USAGE
 *   DATABASE_URL=... node scripts/preflight/schema-drift.mjs
 * Exit codes: 0 clean · 1 drift found · 2 DATABASE_URL missing · 3 error.
 *
 * DEPENDENCY RESOLUTION. The CI job that runs this (`db-preflight` in
 * .github/workflows/test.yml) installs ONLY packages/database, so the CLI
 * resolves `@prisma/client` through a `createRequire` anchored at
 * packages/database/package.json — never as a bare specifier, which Node
 * would resolve from this file's own directory tree. Same reasoning as the
 * sibling db-probe.mjs / db-health.mjs scripts, different anchor. Nothing at
 * module scope imports anything but Node builtins, so the pure functions
 * below are importable from the backend Jest sentinel
 * (backend/__tests__/scripts/liveSchemaDrift.sentinel.test.mjs) without
 * dragging a client in.
 */

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const DB_PACKAGE = path.join(REPO_ROOT, 'packages', 'database');
const SCHEMA_PATH = path.join(DB_PACKAGE, 'prisma', 'schema.prisma');
const PRISMA_CLI = path.join(DB_PACKAGE, 'node_modules', 'prisma', 'build', 'index.js');
const OPTIMIZATION_SERVICE = path.join(
  REPO_ROOT,
  'backend',
  'services',
  'databaseOptimizationService.mjs'
);

/** Reference databases are created and dropped by this check. Nothing else is. */
export const REFERENCE_DB_PREFIX = 'equoria_schema_ref_';

/**
 * The four catalog sections, each read from the LIVE connection it is handed.
 * `information_schema` / `pg_catalog` only — no Prisma bookkeeping, no
 * schema.prisma, no migration-directory listing.
 *
 * `_prisma_migrations` is excluded from `tables`/`columns` because its shape is
 * Prisma's own and its presence is already proven by `migrate deploy`; every
 * application table is in scope.
 */
export const CATALOG_SECTIONS = Object.freeze({
  tables: `
    SELECT table_name AS key, table_type AS definition
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name <> '_prisma_migrations'
  `,
  columns: `
    SELECT table_name || '.' || column_name AS key,
           data_type || ' | udt=' || udt_name
             || ' | nullable=' || is_nullable
             || ' | default=' || COALESCE(column_default, '<none>')
             || ' | maxlen=' || COALESCE(character_maximum_length::text, '<n/a>')
             || ' | precision=' || COALESCE(numeric_precision::text, '<n/a>')
             || ' | scale=' || COALESCE(numeric_scale::text, '<n/a>') AS definition
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name <> '_prisma_migrations'
  `,
  indexes: `
    SELECT indexname AS key, indexdef AS definition
      FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename <> '_prisma_migrations'
  `,
  constraints: `
    SELECT rel.relname || '.' || con.conname AS key,
           con.contype::text || ' | ' || pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND rel.relname <> '_prisma_migrations'
  `,
});

/**
 * Read every section from one live connection.
 *
 * @param {(sql: string) => Promise<Array<{key: string, definition: string}>>} query
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
export async function readCatalog(query) {
  const catalog = {};
  for (const [section, sql] of Object.entries(CATALOG_SECTIONS)) {
    const rows = await query(sql);
    const bucket = {};
    for (const row of rows) {
      bucket[row.key] = row.definition;
    }
    catalog[section] = bucket;
  }
  return catalog;
}

/**
 * THE ENTIRE TOLERANCE. One index name, spelled out, with its reason.
 *
 * An earlier revision derived this set by scanning
 * `databaseOptimizationService.mjs` for `CREATE INDEX`. That was wrong twice
 * over: the scan harvested prose from comments and fragments from template
 * literals (`against`, `statement`, `IF`, `idx_horses_`), and — worse — it made
 * the tolerance invisible to review. A comment in that service reading
 * "we used to CREATE INDEX idx_horses_orphan here" would have silently excused
 * a real stray `idx_horses_orphan`, with nothing in any diff to notice. A
 * hardcoded list widens only by an edit a reviewer can see, and its staleness
 * mode is loud and benign: if the service stops creating the index, the check
 * reports it and someone deletes one line here.
 *
 * `serviceCreateIndexNames()` below cross-checks this list against the service
 * source. It is a cross-check, not the source of truth.
 */
export const RUNTIME_CREATED_INDEX_ALLOWLIST = Object.freeze([
  Object.freeze({
    index: 'idx_horses_user_horse_lookup',
    // Created at RUNTIME by databaseOptimizationService.mjs
    // (`QUERY_PATTERN_INDEX.user_horse_lookup`, `CREATE INDEX IF NOT EXISTS`),
    // so it appears on any database where that service has run and in no
    // migration at all — see the note above `model Horse` in schema.prisma,
    // verified against the local `equoria` database on 2026-09-09 by
    // Equoria-69gip. Ending the runtime DDL is Equoria-9xa92 / Equoria-bebob,
    // not this check; delete this entry when they land.
    reason: 'runtime-created by databaseOptimizationService (Equoria-9xa92 / Equoria-bebob)',
  }),
]);

/**
 * The allow-listed names as a set, for `diffCatalog`.
 *
 * @returns {Set<string>}
 */
export function toleratedExtraIndexNames() {
  return new Set(RUNTIME_CREATED_INDEX_ALLOWLIST.map((entry) => entry.index));
}

/**
 * CROSS-CHECK ONLY — never the source of truth for the allow-list.
 *
 * Static index names in `databaseOptimizationService.mjs`'s
 * `QUERY_PATTERN_INDEX` object literal. Anchored to that literal (so comments
 * elsewhere in the file cannot contribute) and to the full
 * `CREATE INDEX IF NOT EXISTS <name> ON` shape with a literal identifier (so a
 * `${...}` interpolation contributes nothing rather than a truncated prefix).
 * The sentinel uses it to prove every allow-listed name is one the service
 * really creates; it is not consulted at check time.
 *
 * @param {string} [servicePath]
 * @returns {Set<string>}
 */
export function serviceCreateIndexNames(servicePath = OPTIMIZATION_SERVICE) {
  let source;
  try {
    source = readFileSync(servicePath, 'utf8');
  } catch {
    return new Set();
  }
  const literal = /const\s+QUERY_PATTERN_INDEX\s*=\s*\{([\s\S]*?)\n\};/.exec(source);
  if (!literal) return new Set();
  const names = new Set();
  const pattern = /CREATE INDEX IF NOT EXISTS ([A-Za-z0-9_]+) ON /g;
  let match;
  while ((match = pattern.exec(literal[1])) !== null) {
    names.add(match[1]);
  }
  return names;
}

/**
 * Diff two live catalogs. Missing, extra and redefined all count, in every
 * section.
 *
 * @param {Record<string, Record<string, string>>} expected catalog of the migration-replayed reference DB
 * @param {Record<string, Record<string, string>>} actual catalog of the live DB under test
 * @param {{ toleratedExtraIndexes?: Set<string> }} [options]
 * @returns {Array<{section: string, kind: 'missing'|'extra'|'changed', name: string, expected?: string, actual?: string}>}
 */
export function diffCatalog(expected, actual, options = {}) {
  const tolerated = options.toleratedExtraIndexes ?? new Set();
  const findings = [];

  for (const section of Object.keys(CATALOG_SECTIONS)) {
    const want = expected[section] ?? {};
    const have = actual[section] ?? {};

    for (const name of Object.keys(want).sort()) {
      if (!Object.hasOwn(have, name)) {
        // Never tolerated: the migration chain produces it and the live
        // database does not have it.
        findings.push({ section, kind: 'missing', name, expected: want[name] });
      } else if (have[name] !== want[name]) {
        findings.push({ section, kind: 'changed', name, expected: want[name], actual: have[name] });
      }
    }

    for (const name of Object.keys(have).sort()) {
      if (Object.hasOwn(want, name)) continue;
      // The only tolerance in this file. Three constraints, all enforced here:
      // it applies to the `indexes` section only; it applies to EXTRA only
      // (this is the extra branch — `missing` and `changed` are emitted above
      // and never consult `tolerated`); and the redundant `!Object.hasOwn(want,
      // name)` re-states that a migration-produced name can never be excused,
      // so the invariant survives anyone reordering this loop.
      if (section === 'indexes' && tolerated.has(name) && !Object.hasOwn(want, name)) continue;
      findings.push({ section, kind: 'extra', name, actual: have[name] });
    }
  }

  return findings;
}

/**
 * @param {ReturnType<typeof diffCatalog>} findings
 * @returns {string}
 */
export function formatFindings(findings) {
  if (findings.length === 0)
    return 'No drift: the live database matches the migration-applied structure.';
  const lines = [`${findings.length} schema drift finding(s) against the live database:`];
  for (const finding of findings) {
    if (finding.kind === 'missing') {
      lines.push(
        `  MISSING  ${finding.section}: ${finding.name}  (migrations produce: ${finding.expected})`
      );
    } else if (finding.kind === 'extra') {
      lines.push(
        `  EXTRA    ${finding.section}: ${finding.name}  (live database has: ${finding.actual})`
      );
    } else {
      lines.push(
        `  CHANGED  ${finding.section}: ${finding.name}\n` +
          `           migrations produce: ${finding.expected}\n` +
          `           live database has:  ${finding.actual}`
      );
    }
  }
  return lines.join('\n');
}

/** Hard guard — this check creates and drops reference databases and nothing else. */
export function assertReferenceDbName(name) {
  if (!name.startsWith(REFERENCE_DB_PREFIX)) {
    throw new Error(`Refusing to CREATE/DROP non-reference database "${name}"`);
  }
}

/** Server-level URL (maintenance `postgres` database) derived from a DATABASE_URL. */
export function adminUrlFrom(databaseUrl) {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  url.search = '';
  return url.toString();
}

/** URL for a sibling database on the same server. */
export function siblingUrlFrom(databaseUrl, dbName) {
  const url = new URL(databaseUrl);
  url.pathname = `/${dbName}`;
  url.search = '';
  return url.toString();
}

export function newReferenceDbName() {
  return `${REFERENCE_DB_PREFIX}${randomBytes(6).toString('hex')}`;
}

/**
 * Replay the whole migration chain into `databaseUrl`. This is what makes the
 * expected side a real catalog rather than a source claim.
 *
 * @param {string} databaseUrl
 */
export function deployMigrations(databaseUrl) {
  return execFileSync(
    process.execPath,
    [PRISMA_CLI, 'migrate', 'deploy', `--schema=${SCHEMA_PATH}`],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      cwd: DB_PACKAGE,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // execFileSync blocks the event loop, so a Jest hook timeout cannot fire
      // while it runs and a hung `migrate deploy` would only be caught by the
      // 10-minute CI job timeout. Fail locally and legibly instead.
      timeout: 240_000,
    }
  );
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[schema-drift] DATABASE_URL is not set');
    process.exit(2);
  }

  const dbRequire = createRequire(path.join(DB_PACKAGE, 'package.json'));
  const { PrismaClient } = dbRequire('@prisma/client');

  const connect = (url) => new PrismaClient({ datasources: { db: { url } } });
  const queryWith = (client) => (sql) => client.$queryRawUnsafe(sql);

  const referenceDb = newReferenceDbName();
  assertReferenceDbName(referenceDb);

  const admin = connect(adminUrlFrom(databaseUrl));
  let findings;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${referenceDb}"`);
    try {
      const referenceUrl = siblingUrlFrom(databaseUrl, referenceDb);
      deployMigrations(referenceUrl);

      const referenceClient = connect(referenceUrl);
      const liveClient = connect(databaseUrl);
      try {
        const expected = await readCatalog(queryWith(referenceClient));
        const actual = await readCatalog(queryWith(liveClient));
        findings = diffCatalog(expected, actual, {
          toleratedExtraIndexes: toleratedExtraIndexNames(),
        });
        console.log(
          `[schema-drift] compared ${Object.values(expected).reduce((n, s) => n + Object.keys(s).length, 0)} ` +
            'reference objects against the live database ' +
            '(tables, columns, indexes, constraints in schema "public")'
        );
      } finally {
        await referenceClient.$disconnect();
        await liveClient.$disconnect();
      }
    } finally {
      assertReferenceDbName(referenceDb);
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${referenceDb}" WITH (FORCE)`);
    }
  } finally {
    await admin.$disconnect();
  }

  console.log(formatFindings(findings));
  process.exit(findings.length === 0 ? 0 : 1);
}

/**
 * True when this module is the process entry point.
 *
 * `realpathSync` on BOTH sides: a plain `path.resolve` comparison returns false
 * for an invocation through a symlink or a wrapper path, and this file would
 * then exit 0 having asserted nothing — a silent pass, in a file whose whole
 * contract is never to pass silently.
 */
function invokedAsScript() {
  if (!process.argv[1]) return false;
  const here = fileURLToPath(import.meta.url);
  try {
    return realpathSync(process.argv[1]) === realpathSync(here);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(here);
  }
}

if (invokedAsScript()) {
  main().catch((error) => {
    console.error('[schema-drift] failed:', error?.message ?? error);
    process.exit(3);
  });
}
