/**
 * Database speed-up and tidy-up migrations (owner rulings 2026-10-26, q64 and q65).
 *
 * Replays the whole migration chain into a brand-new disposable database (the same
 * safety posture as freshDbMigrationReplay.sentinel.test.mjs: only
 * `equoria_replay_sentinel_*` databases are ever touched) and proves, from the system
 * catalog, what the three migrations 20261026140000..140200 are meant to leave behind:
 *
 *   1. the speed-up indexes exist, the indexes they replace are gone, and the three
 *      assignment-table indexes that the tidy-up deliberately KEEPS are still there
 *      (their only longer sibling is a partial unique, which cannot serve them);
 *   2. the nine redundant strict-prefix indexes are gone;
 *   3. horses has lost finalDisplayColor, genotype, phenotypicMarkings and rider;
 *   4. groom_salary_payments.weekKey exists with a PARTIAL unique index (paid rows only);
 *   5. the database refuses a second PAID salary row for one groom and pay week, yet a
 *      missed row never conflicts and a later week still pays;
 *   6. the column-drop migration COPIES data before dropping: finalDisplayColor and
 *      phenotypicMarkings are folded into phenotype, never over a value already there;
 *   7. the weekKey migration backfills the Eastern Monday of each row's pay week, and when
 *      two paid rows already share a groom and week it STOPS with an error and changes
 *      nothing (no payroll row is deleted).
 *
 * Items 6 and 7 re-run the real migration SQL files against the replayed database after
 * putting back the columns/index the migration removed, so the exact shipped SQL is what is
 * tested. Foreign keys are switched off for the planted rows only
 * (`session_replication_role = replica`).
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(HERE, '..', '..', '..');
const dbPackage = path.join(repoRoot, 'packages', 'database');
const schemaPath = path.join(dbPackage, 'prisma', 'schema.prisma');
const migrationsDir = path.join(dbPackage, 'prisma', 'migrations');
const prismaCli = path.join(dbPackage, 'node_modules', 'prisma', 'build', 'index.js');

const dropColumnsSql = path.join(
  migrationsDir,
  '20261026140100_drop_dead_horse_columns_and_prefix_indexes',
  'migration.sql',
);
const weekKeySql = path.join(migrationsDir, '20261026140200_groom_salary_payment_week_key', 'migration.sql');

const replayDbPrefix = 'equoria_replay_sentinel_';
const replayDbName = `${replayDbPrefix}${randomBytes(6).toString('hex')}`;

const speedupIndexes = Object.freeze([
  'training_logs_horseId_discipline_trainedAt_idx',
  'training_logs_horseId_trainedAt_idx',
  'competition_results_horseId_runDate_idx',
  'competition_results_discipline_runDate_idx',
  'competition_results_placement_runDate_idx',
  'groom_assignments_userId_createdAt_idx',
  'groom_interactions_foalId_timestamp_idx',
  'riders_userId_retired_idx',
  'riders_retired_careerWeeks_idx',
  'trainers_userId_retired_idx',
  'trainers_retired_careerWeeks_idx',
  'shows_status_runDate_idx',
  'shows_runDate_idx',
  'horse_sales_sellerId_soldAt_idx',
  'horse_sales_buyerId_soldAt_idx',
  'ForumThread_authorId_idx',
  'ForumPost_authorId_idx',
  'DirectMessage_recipientId_createdAt_idx',
  'Club_leaderId_idx',
  'ClubElection_clubId_idx',
  'horses_inFoalSinceDate_idx',
  'User_username_trgm_idx',
  'groom_salary_payments_paid_week_key',
]);

/** Replaced by a wider index in the same migration. */
const replacedIndexes = Object.freeze([
  'groom_interactions_foalId_idx',
  'riders_userId_idx',
  'riders_retired_idx',
  'trainers_userId_idx',
  'trainers_retired_idx',
  'shows_status_idx',
  'horse_sales_sellerId_idx',
  'horse_sales_buyerId_idx',
]);

/** Strict prefixes of a longer full index on the same table. */
const prefixIndexesDropped = Object.freeze([
  'trait_history_logs_horseId_idx',
  'milestone_trait_logs_horseId_idx',
  'ultra_rare_trait_events_horseId_idx',
  'groom_horse_synergies_groomId_idx',
  'groom_assignment_logs_groomId_idx',
  'groom_talent_selections_groomId_idx',
  'groom_metrics_groomId_idx',
  'show_entries_showId_idx',
  'staff_marketplace_state_userId_idx',
]);

/** Look like prefixes, are not: the longer sibling is an ACTIVE-only partial unique. */
const prefixIndexesKept = Object.freeze([
  'groom_assignments_foalId_idx',
  'rider_assignments_riderId_idx',
  'trainer_assignments_trainerId_idx',
  // Pinned single-column by foreignKeyIndexes.integration.test.mjs.
  'DirectMessage_recipientId_idx',
  'DirectMessage_senderId_idx',
]);

const droppedHorseColumns = Object.freeze(['finalDisplayColor', 'genotype', 'phenotypicMarkings', 'rider']);

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

function replayUrl() {
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = `/${replayDbName}`;
  u.search = '';
  return u.toString();
}

function assertIsReplayDb(name) {
  if (!name.startsWith(replayDbPrefix) || name === 'equoria') {
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

async function withReplay(fn) {
  assertIsReplayDb(replayDbName);
  const client = new Client({ connectionString: replayUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function runPrisma(args, databaseUrl) {
  return execFileSync(process.execPath, [prismaCli, ...args, `--schema=${schemaPath}`], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: dbPackage,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function indexNames(client) {
  const { rows } = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'");
  return new Set(rows.map(r => r.indexname));
}

describe('database speed-up and tidy-up migrations (owner rulings 2026-10-26)', () => {
  beforeAll(async () => {
    assertIsReplayDb(replayDbName);
    await withAdmin(client => client.query(`CREATE DATABASE "${replayDbName}"`));
    runPrisma(['migrate', 'deploy'], replayUrl());
  }, 300_000);

  afterAll(async () => {
    assertIsReplayDb(replayDbName);
    await withAdmin(client => client.query(`DROP DATABASE IF EXISTS "${replayDbName}" WITH (FORCE)`));
  }, 60_000);

  test('the speed-up indexes exist and the indexes they replace are gone', async () => {
    await withReplay(async client => {
      const names = await indexNames(client);
      for (const name of speedupIndexes) {
        expect({ name, present: names.has(name) }).toEqual({ name, present: true });
      }
      for (const name of replacedIndexes) {
        expect({ name, present: names.has(name) }).toEqual({ name, present: false });
      }
    });
  }, 60_000);

  test('the username index is a trigram index that serves a case-insensitive prefix search', async () => {
    await withReplay(async client => {
      const { rows } = await client.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'User_username_trgm_idx'");
      expect(rows).toHaveLength(1);
      expect(rows[0].indexdef).toMatch(/USING gin \(username gin_trgm_ops\)/);
    });
  }, 60_000);

  test('the nine redundant prefix indexes are gone and the look-alikes that are not redundant stay', async () => {
    await withReplay(async client => {
      const names = await indexNames(client);
      for (const name of prefixIndexesDropped) {
        expect({ name, present: names.has(name) }).toEqual({ name, present: false });
      }
      for (const name of prefixIndexesKept) {
        expect({ name, present: names.has(name) }).toEqual({ name, present: true });
      }
    });
  }, 60_000);

  test('horses has lost the four dead columns and kept phenotype', async () => {
    await withReplay(async client => {
      const { rows } = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'horses' AND table_schema = 'public'",
      );
      const columns = new Set(rows.map(r => r.column_name));
      for (const column of droppedHorseColumns) {
        expect({ column, present: columns.has(column) }).toEqual({ column, present: false });
      }
      expect(columns.has('phenotype')).toBe(true);
      expect(columns.has('colorGenotype')).toBe(true);
    });
  }, 60_000);

  test('weekKey exists and its unique index is partial: paid rows only', async () => {
    await withReplay(async client => {
      const col = await client.query(
        `SELECT data_type, is_nullable FROM information_schema.columns
          WHERE table_name = 'groom_salary_payments' AND column_name = 'weekKey'`,
      );
      expect(col.rows).toEqual([{ data_type: 'text', is_nullable: 'YES' }]);

      const idx = await client.query(
        `SELECT i.indisunique AS "isUnique", pg_get_expr(i.indpred, i.indrelid) AS predicate, c.relname
           FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
          WHERE c.relname = 'groom_salary_payments_paid_week_key'`,
      );
      expect(idx.rows).toHaveLength(1);
      expect(idx.rows[0].isUnique).toBe(true);
      expect(idx.rows[0].predicate).toMatch(/status/);
      expect(idx.rows[0].predicate).toMatch(/paid/);
    });
  }, 60_000);

  async function insertPayment(client, { weekKey, status, paymentDate = '2026-10-21 15:00:00' }) {
    await client.query(
      `INSERT INTO "groom_salary_payments"
         ("groomId", "userId", "amount", "paymentDate", "weekKey", "paymentType", "status", "updatedAt")
       VALUES (9001, 'sentinel-user', 70, $1, $2, 'weeklySalary', $3, now())`,
      [paymentDate, weekKey, status],
    );
  }

  test('the database refuses a second paid row for one groom and week; missed rows and later weeks are free', async () => {
    await withReplay(async client => {
      await client.query('SET session_replication_role = replica'); // planted rows only; no parent rows needed
      await client.query('DELETE FROM "groom_salary_payments"');

      await insertPayment(client, { weekKey: '2026-10-19', status: 'paid' });
      await expect(insertPayment(client, { weekKey: '2026-10-19', status: 'paid' })).rejects.toMatchObject({
        code: '23505',
        constraint: 'groom_salary_payments_paid_week_key',
      });

      // A later week still pays; a fee missed twice in one week, then paid, is fine.
      await insertPayment(client, { weekKey: '2026-10-26', status: 'paid' });
      await insertPayment(client, { weekKey: '2026-11-02', status: 'missedInsufficientFunds' });
      await insertPayment(client, { weekKey: '2026-11-02', status: 'missedGracePeriod' });
      await insertPayment(client, { weekKey: '2026-11-02', status: 'missedGracePeriod' });
      await insertPayment(client, { weekKey: '2026-11-02', status: 'paid' });

      const { rows } = await client.query('SELECT count(*)::int AS n FROM "groom_salary_payments"');
      expect(rows[0].n).toBe(6);
      await client.query('DELETE FROM "groom_salary_payments"');
    });
  }, 60_000);

  test('the column-drop migration copies colour and markings into phenotype and overwrites nothing', async () => {
    await withReplay(async client => {
      await client.query('SET session_replication_role = replica');
      await client.query('DELETE FROM "horses"');
      // Put back what the migration removed, so its real SQL can run again.
      await client.query(
        `ALTER TABLE "horses"
           ADD COLUMN "finalDisplayColor" TEXT, ADD COLUMN "genotype" JSONB,
           ADD COLUMN "phenotypicMarkings" JSONB, ADD COLUMN "rider" JSONB`,
      );
      const horse = (name, finalDisplayColor, phenotype, markings, rider = null) =>
        client.query(
          `INSERT INTO "horses" ("name", "sex", "dateOfBirth", "finalDisplayColor", "phenotype", "phenotypicMarkings", "rider")
           VALUES ($1, 'Mare', '2024-01-01', $2, $3::jsonb, $4::jsonb, $5::jsonb)`,
          [name, finalDisplayColor, phenotype, markings, rider],
        );
      // 1: colour only in the old column, no phenotype.
      await horse('colourOnly', 'Bay', null, null);
      // 2: phenotype already has a colour: the old column must NOT replace it.
      await horse('hasColour', 'Bay', '{"colorName":"Palomino","shade":"light"}', null);
      // 3: markings only, no phenotype.
      await horse('markingsOnly', null, null, '{"face":"Blaze","legs":["Sock"]}');
      // 4: phenotype and markings: phenotype's own keys win, missing keys are added.
      await horse('both', null, '{"colorName":"Black","face":"Star"}', '{"face":"Blaze","legs":["Sock"]}');
      // 5: nothing to copy; a rider copy is simply dropped.
      await horse('nothing', null, null, null, '{"id":1,"name":"Jenna Black"}');
      // 6: an empty markings object and a phenotype that is not an object are left alone.
      await horse('emptyMarkings', null, '["unexpected"]', '{}');

      await client.query(readFileSync(dropColumnsSql, 'utf8'));

      const { rows } = await client.query('SELECT "name", "phenotype" FROM "horses" ORDER BY "name"');
      const byName = Object.fromEntries(rows.map(r => [r.name, r.phenotype]));
      expect(byName.colourOnly).toEqual({ colorName: 'Bay' });
      expect(byName.hasColour).toEqual({ colorName: 'Palomino', shade: 'light' });
      expect(byName.markingsOnly).toEqual({ face: 'Blaze', legs: ['Sock'] });
      expect(byName.both).toEqual({ colorName: 'Black', face: 'Star', legs: ['Sock'] });
      expect(byName.nothing).toBeNull();
      expect(byName.emptyMarkings).toEqual(['unexpected']);

      const columns = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'horses' AND column_name = ANY($1)",
        [[...droppedHorseColumns]],
      );
      expect(columns.rows).toEqual([]);
      await client.query('DELETE FROM "horses"');
    });
  }, 60_000);

  test('the weekKey migration backfills the Eastern Monday, and stops without deleting when a week was paid twice', async () => {
    await withReplay(async client => {
      await client.query('SET session_replication_role = replica');
      await client.query('DELETE FROM "groom_salary_payments"');
      // Put back what the migration added, so its real SQL can run again.
      await client.query('DROP INDEX "groom_salary_payments_paid_week_key"');
      await client.query('ALTER TABLE "groom_salary_payments" DROP COLUMN "weekKey"');

      const plant = (groomId, paymentDate, status) =>
        client.query(
          `INSERT INTO "groom_salary_payments" ("groomId", "userId", "amount", "paymentDate", "paymentType", "status", "updatedAt")
           VALUES ($1, 'sentinel-user', 70, $2, 'weeklySalary', $3, now())`,
          [groomId, paymentDate, status],
        );

      // Groom 1: paid twice in the Eastern week that starts Monday 2026-10-19 (UTC dates differ).
      await plant(1, '2026-10-20 12:00:00', 'paid');
      await plant(1, '2026-10-25 12:00:00', 'paid');
      const sql = readFileSync(weekKeySql, 'utf8');

      await expect(client.query(sql)).rejects.toThrow(/more than one paid row/);
      // Nothing changed: both rows survive and the column was not added (the file is one transaction).
      const after = await client.query('SELECT count(*)::int AS n FROM "groom_salary_payments"');
      expect(after.rows[0].n).toBe(2);
      const col = await client.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'groom_salary_payments' AND column_name = 'weekKey'",
      );
      expect(col.rows).toEqual([]);

      // A person resolves the duplicate by hand; the migration then runs and backfills.
      await client.query('DELETE FROM "groom_salary_payments" WHERE "paymentDate" = \'2026-10-25 12:00:00\'');
      // 23:30 Eastern on Sunday 2026-10-25 is still the week of Monday 10-19 (EDT = UTC-4).
      await plant(2, '2026-10-26 03:30:00', 'paid');
      // 00:30 Eastern on Monday 2026-10-26 starts the next week.
      await plant(3, '2026-10-26 04:30:00', 'paid');
      // A missed row is dated with its pay week's Monday midnight Eastern (04:00 UTC).
      await plant(4, '2026-10-19 04:00:00', 'missedInsufficientFunds');
      // After the clocks go back (EST = UTC-5): 00:30 Eastern Monday 2026-11-02 is 05:30 UTC.
      await plant(5, '2026-11-02 05:30:00', 'paid');

      await client.query(sql);

      const { rows } = await client.query(
        'SELECT "groomId", "weekKey" FROM "groom_salary_payments" ORDER BY "groomId"',
      );
      expect(rows).toEqual([
        { groomId: 1, weekKey: '2026-10-19' },
        { groomId: 2, weekKey: '2026-10-19' },
        { groomId: 3, weekKey: '2026-10-26' },
        { groomId: 4, weekKey: '2026-10-19' },
        { groomId: 5, weekKey: '2026-11-02' },
      ]);
      await client.query('DELETE FROM "groom_salary_payments"');
    });
  }, 60_000);
});
