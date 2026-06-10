/**
 * audit-fk-drift.mjs (Equoria-wni4j) — READ-ONLY FK-drift audit.
 *
 * Compares every foreign key DECLARED in packages/database/prisma/schema.prisma
 * (`@relation(fields:[...], references:[...])`) against the foreign-key
 * constraints that ACTUALLY exist in the canonical Postgres DB, and reports:
 *   - DECLARED-BUT-ABSENT FKs (the email_verification_tokens / trait_history_logs
 *     drift class from the c3kb6 restore), with an orphan-row count for each so
 *     the blast radius of re-adding the constraint is known.
 *   - ON-DELETE MISMATCHES (constraint exists but its ON DELETE action differs
 *     from what the schema declares).
 *
 * STRICTLY READ-ONLY. Issues only SELECTs via prisma.$queryRaw against
 * pg_constraint / pg_class / pg_attribute. Performs NO DDL, NO migrate, NO
 * writes. Main-module-guarded per CONTRIBUTING.md so a bare import is a no-op.
 *
 * Usage:  node backend/scripts/audit-fk-drift.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMA_PATH = path.resolve(__dirname, '../../packages/database/prisma/schema.prisma');

// The isolated worktree has no node_modules. Allow an env override pointing at
// a checkout that DOES (the canonical checkout) so @prisma/client resolves and
// DATABASE_URL can be read. Defaults to this worktree (works once deps exist).
// EQUORIA_DEP_BASE should be a checkout ROOT (contains backend/.env + a
// node_modules tree that has @prisma/client).
const DEP_BASE = process.env.EQUORIA_DEP_BASE
  ? path.resolve(process.env.EQUORIA_DEP_BASE)
  : path.resolve(__dirname, '../../');

/**
 * Parse the schema into a list of declared FKs.
 * Returns: [{ model, table, column, refModel, refTable, refColumn, onDelete }]
 * onDelete defaults to Prisma's implicit behavior when not stated:
 *   - optional scalar FK  -> SetNull
 *   - required scalar FK   -> NoAction (DB stores required-relation default as
 *     NO ACTION; normalized as a "block" in the diff — see normalizeDelete()).
 */
function parseSchema() {
  const src = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const lines = src.split(/\r?\n/);

  // First pass: map model name -> table name (respect @@map; else model name as-is).
  // Also record each model's scalar field optionality so we can infer the
  // implicit onDelete when @relation omits it.
  const modelTable = {};
  const modelScalarOptional = {}; // model -> { fieldName: boolean isOptional }
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^model\s+(\w+)\s*\{/);
    if (m) {
      cur = m[1];
      modelTable[cur] = cur; // default: model name (e.g. User -> "User", no @@map)
      modelScalarOptional[cur] = {};
      continue;
    }
    if (cur && line === '}') {
      cur = null;
      continue;
    }
    if (!cur) {
      continue;
    }
    const mapM = line.match(/^@@map\(\s*"([^"]+)"\s*\)/);
    if (mapM) {
      modelTable[cur] = mapM[1];
      continue;
    }
    // scalar field: `name  Type?  ...`  (skip relation lines & attributes)
    const fld = line.match(/^(\w+)\s+(\w+)(\?)?/);
    if (fld && !line.includes('@relation')) {
      modelScalarOptional[cur][fld[1]] = Boolean(fld[3]);
    }
  }

  // Second pass: collect @relation declarations (the FKs).
  const fks = [];
  cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^model\s+(\w+)\s*\{/);
    if (m) {
      cur = m[1];
      continue;
    }
    if (cur && line === '}') {
      cur = null;
      continue;
    }
    if (!cur) {
      continue;
    }
    if (!line.includes('@relation') || !line.includes('fields:')) {
      continue;
    }

    // referenced model is the field TYPE: e.g. `dam  Horse?  @relation(...)`
    const typeM = line.match(/^\w+\s+(\w+)\??\s+@relation/);
    const refModel = typeM ? typeM[1] : null;

    const fieldsM = line.match(/fields:\s*\[([^\]]+)\]/);
    const refsM = line.match(/references:\s*\[([^\]]+)\]/);
    const onDelM = line.match(/onDelete:\s*(\w+)/);
    if (!fieldsM || !refsM || !refModel) {
      continue;
    }

    const column = fieldsM[1].split(',').map(s => s.trim());
    const refColumn = refsM[1].split(',').map(s => s.trim());

    let onDelete = onDelM ? onDelM[1] : null;
    if (!onDelete) {
      // implicit Prisma default
      const optional = (modelScalarOptional[cur] || {})[column[0]];
      onDelete = optional ? 'SetNull' : 'NoAction';
    }
    fks.push({
      model: cur,
      table: modelTable[cur],
      column,
      refModel,
      refTable: modelTable[refModel] || refModel,
      refColumn,
      onDelete,
    });
  }
  return fks;
}

// Postgres confdeltype codes -> name
const CONFDELTYPE = {
  a: 'NoAction',
  r: 'Restrict',
  c: 'Cascade',
  n: 'SetNull',
  d: 'SetDefault',
};

// Treat NoAction and Restrict as equivalent "block" semantics for mismatch
// purposes (both prevent the delete; the only difference is deferrability,
// which Prisma never sets). This avoids false positives on Prisma's default
// required-relation FKs that the DB stores as NO ACTION.
function normalizeDelete(d) {
  if (d === 'NoAction' || d === 'Restrict') {
    return 'BLOCK';
  }
  return d;
}

async function main() {
  // Resolve @prisma/client from the dep base (handles isolated worktree).
  // The generated client lives under packages/database/node_modules in this
  // repo, so anchor the require there.
  const requireFromBase = createRequire(
    pathToFileURL(path.join(DEP_BASE, 'packages', 'database', 'package.json')).href,
  );
  const { PrismaClient } = requireFromBase('@prisma/client');

  // Read DATABASE_URL from the dep base's backend/.env if not already set.
  if (!process.env.DATABASE_URL) {
    const envPath = path.join(DEP_BASE, 'backend', '.env');
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
        if (m) {
          process.env.DATABASE_URL = m[1];
          break;
        }
      }
    }
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set and not found in <DEP_BASE>/backend/.env');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

  const declared = parseSchema();

  // Pull ALL actual FK constraints from the DB.
  const actual = await prisma.$queryRaw`
    SELECT
      con.conname        AS constraint_name,
      src.relname        AS table_name,
      srcatt.attname     AS column_name,
      tgt.relname        AS ref_table_name,
      tgtatt.attname     AS ref_column_name,
      con.confdeltype    AS on_delete_code
    FROM pg_constraint con
    JOIN pg_class src           ON src.oid = con.conrelid
    JOIN pg_namespace srcns     ON srcns.oid = src.relnamespace
    JOIN pg_class tgt           ON tgt.oid = con.confrelid
    JOIN unnest(con.conkey)  WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord) ON fk.ord = ck.ord
    JOIN pg_attribute srcatt    ON srcatt.attrelid = con.conrelid AND srcatt.attnum = ck.attnum
    JOIN pg_attribute tgtatt    ON tgtatt.attrelid = con.confrelid AND tgtatt.attnum = fk.attnum
    WHERE con.contype = 'f'
      AND srcns.nspname = 'public'
    ORDER BY src.relname, con.conname, ck.ord;
  `;

  // Index actual FKs by table.column -> [{ onDelete, refTable, refColumn, name }]
  const actualByCol = new Map();
  for (const row of actual) {
    const key = `${row.table_name}.${row.column_name}`;
    if (!actualByCol.has(key)) {
      actualByCol.set(key, []);
    }
    actualByCol.get(key).push({
      name: row.constraint_name,
      refTable: row.ref_table_name,
      refColumn: row.ref_column_name,
      onDelete: CONFDELTYPE[row.on_delete_code] || row.on_delete_code,
    });
  }

  const absent = [];
  const mismatch = [];

  for (const fk of declared) {
    const col = fk.column[0];
    const refCol = fk.refColumn[0];
    const key = `${fk.table}.${col}`;
    const candidates = actualByCol.get(key) || [];
    const match = candidates.find(c => c.refTable === fk.refTable && c.refColumn === refCol);
    if (!match) {
      absent.push(fk);
    } else if (normalizeDelete(match.onDelete) !== normalizeDelete(fk.onDelete)) {
      mismatch.push({ ...fk, actualOnDelete: match.onDelete, constraintName: match.name });
    }
  }

  // Orphan count: child rows whose FK value is non-null but has no parent.
  async function orphanCount(fk) {
    const col = fk.column[0];
    const refCol = fk.refColumn[0];
    const sql = `
      SELECT COUNT(*)::bigint AS n
      FROM "${fk.table}" c
      WHERE c."${col}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "${fk.refTable}" p WHERE p."${refCol}" = c."${col}"
        );
    `;
    const rows = await prisma.$queryRawUnsafe(sql);
    return Number(rows[0].n);
  }

  console.log('===============================================================');
  console.log('  FK-DRIFT AUDIT (Equoria-wni4j) - declared schema vs canonical DB');
  console.log('===============================================================');
  console.log(`Declared FKs in schema.prisma : ${declared.length}`);
  console.log(`Actual FK constraints in DB   : ${actual.length}`);
  console.log('');

  console.log('-- DECLARED-BUT-ABSENT FKs (with orphan-row blast radius) ------');
  if (absent.length === 0) {
    console.log('  (none)');
  } else {
    for (const fk of absent) {
      const n = await orphanCount(fk);
      console.log(
        `  X ${fk.table}.${fk.column[0]} -> ${fk.refTable}.${fk.refColumn[0]} ` +
          `| declared onDelete=${fk.onDelete} | orphan rows=${n} | model=${fk.model}`,
      );
    }
  }
  console.log('');

  console.log('-- ON-DELETE MISMATCHES (constraint exists, behavior differs) --');
  if (mismatch.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of mismatch) {
      console.log(
        `  ! ${m.table}.${m.column[0]} -> ${m.refTable}.${m.refColumn[0]} ` +
          `| declared=${m.onDelete} actual=${m.actualOnDelete} | constraint=${m.constraintName}`,
      );
    }
  }
  console.log('');
  console.log('-- SUMMARY -----------------------------------------------------');
  console.log(`  declared FKs  : ${declared.length}`);
  console.log(`  actual FKs    : ${actual.length}`);
  console.log(`  absent FKs    : ${absent.length}`);
  console.log(`  mismatches    : ${mismatch.length}`);
  console.log('===============================================================');

  await prisma.$disconnect();
}

// Main-module guard (CONTRIBUTING.md) - read-only, but still gate on direct
// invocation so a bare import / parse-check never opens a DB connection.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
