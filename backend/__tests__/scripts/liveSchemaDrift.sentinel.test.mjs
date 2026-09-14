/**
 * Live-schema drift sentinel (Equoria-axyem.2).
 *
 * WHAT WAS LOST. `packages/database/migrations/verify_migration.js` (deleted
 * by fee265d07; its dead CI step removed by a22ac438f) read
 * `information_schema.columns` and `pg_indexes` from a LIVE database and
 * exited 1 on any absence. Its real inventory — a floor, not a total — was:
 * `horses.bondScore`, `horses.stressLevel`, the `foal_training_history` table,
 * eight of its columns (id, horseId, day, activity, outcome, bondChange,
 * stressChange, timestamp) and FIVE index names including
 * `foal_training_history_pkey`. The justification for deleting it counted 8
 * columns and 4 indexes and called them "declared in schema.prisma and
 * enforced by migrate deploy". That is a claim about source. The script made a
 * claim about a database.
 *
 * WHAT THIS ASSERTS INSTEAD. `scripts/preflight/schema-drift.mjs` compares two
 * live Postgres catalogs: the one a fresh replay of the migration chain
 * produces, and the one the database under test actually has. Both sides come
 * from `information_schema.tables`, `information_schema.columns`, `pg_indexes`
 * and `pg_constraint`. `schema.prisma` is never parsed. Every table in
 * `public` is in scope, not one.
 *
 * WHAT THIS FILE PROVES.
 *  1. GREEN — the real test database matches the migration-applied structure.
 *  2. SENTINEL-POSITIVE, ABSENCE — dropping `horses.bondScore`,
 *     `horses.stressLevel`, a `foal_training_history` index, or
 *     `foal_training_history_pkey` is reported, by name. These are the exact
 *     objects the deleted script covered, so the replacement demonstrably
 *     subsumes it.
 *  3. SENTINEL-POSITIVE, EXCESS — a column or index the migrations do not
 *     produce is reported too. Drift has two directions; a one-directional
 *     check is how an undeclared runtime index survives for months.
 *  4. The one tolerated class (extra indexes that
 *     `databaseOptimizationService.mjs` creates at runtime) is narrow: it
 *     cannot excuse an unrelated extra index, and it cannot excuse a MISSING
 *     index even when the name is in the tolerated set.
 *
 * SAFETY. The database named by DATABASE_URL is only ever READ. Every planted
 * defect is applied to a freshly created `equoria_schema_ref_*` database,
 * inside a transaction that is ALWAYS rolled back, and that database is
 * dropped in afterAll. Postgres DDL is transactional, so the catalog reads see
 * the defect and nothing survives the ROLLBACK.
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import pg from 'pg';

import {
  CATALOG_SECTIONS,
  REFERENCE_DB_PREFIX,
  adminUrlFrom,
  assertReferenceDbName,
  deployMigrations,
  diffCatalog,
  formatFindings,
  newReferenceDbName,
  readCatalog,
  runtimeCreatedIndexNames,
  siblingUrlFrom,
} from '../../../scripts/preflight/schema-drift.mjs';

const { Client } = pg;

const referenceDb = newReferenceDbName();

/** Catalog of the freshly replayed reference database, captured before any mutation. */
let pristine = null;

function liveUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set — this sentinel reads a live database');
  }
  return url;
}

const rowsOf = client => sql => client.query(sql).then(result => result.rows);

async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function withAdmin(fn) {
  return withClient(adminUrlFrom(liveUrl()), fn);
}

/**
 * Apply planted DDL to the DISPOSABLE reference database inside a transaction,
 * read the resulting catalog, then roll back unconditionally.
 *
 * @param {string[]} statements
 * @returns {Promise<Record<string, Record<string, string>>>}
 */
async function catalogAfterPlantedDdl(statements) {
  const url = siblingUrlFrom(liveUrl(), referenceDb);
  // Belt and braces: never run planted DDL anywhere but the reference database.
  expect(new URL(url).pathname.slice(1).startsWith(REFERENCE_DB_PREFIX)).toBe(true);
  return withClient(url, async client => {
    await client.query('BEGIN');
    try {
      for (const statement of statements) {
        await client.query(statement);
      }
      return await readCatalog(rowsOf(client));
    } finally {
      await client.query('ROLLBACK');
    }
  });
}

function namesOf(findings, section, kind) {
  return findings
    .filter(f => f.section === section && f.kind === kind)
    .map(f => f.name)
    .sort();
}

describe('live-schema drift sentinel (Equoria-axyem.2)', () => {
  beforeAll(async () => {
    assertReferenceDbName(referenceDb);
    await withAdmin(client => client.query(`CREATE DATABASE "${referenceDb}"`));
    deployMigrations(siblingUrlFrom(liveUrl(), referenceDb));
    pristine = await withClient(siblingUrlFrom(liveUrl(), referenceDb), client => readCatalog(rowsOf(client)));
  }, 300_000);

  afterAll(async () => {
    assertReferenceDbName(referenceDb);
    await withAdmin(client => client.query(`DROP DATABASE IF EXISTS "${referenceDb}" WITH (FORCE)`));
  }, 60_000);

  test('the reference catalog is a real, non-trivial catalog read from a live database', () => {
    for (const section of Object.keys(CATALOG_SECTIONS)) {
      expect(Object.keys(pristine[section]).length).toBeGreaterThan(0);
    }
    // The floor the deleted script covered is present in the reference side.
    expect(pristine.columns['horses.bondScore']).toBeDefined();
    expect(pristine.columns['horses.stressLevel']).toBeDefined();
    for (const column of ['id', 'horseId', 'day', 'activity', 'outcome', 'bondChange', 'stressChange', 'timestamp']) {
      expect(pristine.columns[`foal_training_history.${column}`]).toBeDefined();
    }
    for (const index of [
      'foal_training_history_pkey',
      'foal_training_history_horseId_idx',
      'foal_training_history_day_idx',
      'foal_training_history_timestamp_idx',
      'foal_training_history_horseId_day_idx',
    ]) {
      expect(pristine.indexes[index]).toBeDefined();
    }
  });

  test('GREEN: the live database matches the migration-applied structure', async () => {
    const actual = await withClient(liveUrl(), client => readCatalog(rowsOf(client)));
    const findings = diffCatalog(pristine, actual, {
      toleratedExtraIndexes: runtimeCreatedIndexNames(),
    });
    // formatFindings in the message so a real drift names itself in the failure.
    expect(formatFindings(findings)).toBe('No drift: the live database matches the migration-applied structure.');
  }, 120_000);

  test('SENTINEL-POSITIVE: dropping horses.bondScore and horses.stressLevel is reported by name', async () => {
    const drifted = await catalogAfterPlantedDdl([
      'ALTER TABLE "horses" DROP COLUMN "bondScore"',
      'ALTER TABLE "horses" DROP COLUMN "stressLevel"',
    ]);
    const findings = diffCatalog(pristine, drifted, {
      toleratedExtraIndexes: runtimeCreatedIndexNames(),
    });
    expect(namesOf(findings, 'columns', 'missing')).toEqual(
      expect.arrayContaining(['horses.bondScore', 'horses.stressLevel']),
    );
    expect(formatFindings(findings)).toMatch(/MISSING\s+columns: horses\.bondScore/);
  }, 120_000);

  test('SENTINEL-POSITIVE: dropping foal_training_history indexes, pkey included, is reported', async () => {
    const drifted = await catalogAfterPlantedDdl([
      'DROP INDEX "foal_training_history_horseId_day_idx"',
      'ALTER TABLE "foal_training_history" DROP CONSTRAINT "foal_training_history_pkey" CASCADE',
    ]);
    const findings = diffCatalog(pristine, drifted, {
      toleratedExtraIndexes: runtimeCreatedIndexNames(),
    });
    expect(namesOf(findings, 'indexes', 'missing')).toEqual(
      expect.arrayContaining(['foal_training_history_horseId_day_idx', 'foal_training_history_pkey']),
    );
    expect(namesOf(findings, 'constraints', 'missing')).toEqual(
      expect.arrayContaining(['foal_training_history.foal_training_history_pkey']),
    );
  }, 120_000);

  test('SENTINEL-POSITIVE (other direction): an undeclared column and index are reported as EXTRA', async () => {
    const drifted = await catalogAfterPlantedDdl([
      'ALTER TABLE "horses" ADD COLUMN "axyemPlantedColumn" TEXT',
      'CREATE INDEX "idx_axyem_planted_undeclared" ON "horses" ("name")',
    ]);
    const findings = diffCatalog(pristine, drifted, {
      toleratedExtraIndexes: runtimeCreatedIndexNames(),
    });
    expect(namesOf(findings, 'columns', 'extra')).toEqual(expect.arrayContaining(['horses.axyemPlantedColumn']));
    expect(namesOf(findings, 'indexes', 'extra')).toEqual(expect.arrayContaining(['idx_axyem_planted_undeclared']));
    expect(formatFindings(findings)).toMatch(/EXTRA\s+indexes: idx_axyem_planted_undeclared/);
  }, 120_000);

  test('SENTINEL-POSITIVE: a redefined column is reported as CHANGED, not silently accepted', async () => {
    const drifted = await catalogAfterPlantedDdl(['ALTER TABLE "horses" ALTER COLUMN "bondScore" DROP NOT NULL']);
    const findings = diffCatalog(pristine, drifted, {
      toleratedExtraIndexes: runtimeCreatedIndexNames(),
    });
    const changed = findings.filter(f => f.kind === 'changed' && f.name === 'horses.bondScore');
    expect(changed).toHaveLength(1);
    expect(changed[0].expected).toMatch(/nullable=NO/);
    expect(changed[0].actual).toMatch(/nullable=YES/);
  }, 120_000);

  test('the runtime-index tolerance is derived from the service and is narrow', async () => {
    const tolerated = runtimeCreatedIndexNames();
    // Derived, not copied: this is the index schema.prisma documents as living
    // in no migration because databaseOptimizationService creates it at runtime.
    expect(tolerated.has('idx_horses_user_horse_lookup')).toBe(true);

    const drifted = await catalogAfterPlantedDdl([
      'CREATE INDEX "idx_horses_user_horse_lookup" ON "horses" ("userId")',
      'CREATE INDEX "idx_axyem_not_tolerated" ON "horses" ("userId")',
    ]);
    const findings = diffCatalog(pristine, drifted, { toleratedExtraIndexes: tolerated });
    const extras = namesOf(findings, 'indexes', 'extra');
    expect(extras).toContain('idx_axyem_not_tolerated');
    expect(extras).not.toContain('idx_horses_user_horse_lookup');
  }, 120_000);

  test('the tolerance cannot excuse a MISSING index even when the name is tolerated', async () => {
    const tolerated = runtimeCreatedIndexNames();
    // This one IS produced by the migration chain (Equoria-69gip declared it),
    // and its name is also in the runtime set — the exact overlap where a
    // name-based allowlist would quietly stop guarding.
    const victim = 'idx_horses_age_and_training_status';
    expect(tolerated.has(victim)).toBe(true);
    expect(pristine.indexes[victim]).toBeDefined();

    const drifted = await catalogAfterPlantedDdl([`DROP INDEX "${victim}"`]);
    const findings = diffCatalog(pristine, drifted, { toleratedExtraIndexes: tolerated });
    expect(namesOf(findings, 'indexes', 'missing')).toContain(victim);
  }, 120_000);
});
