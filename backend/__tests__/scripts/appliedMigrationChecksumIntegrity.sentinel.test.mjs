/**
 * Applied-migration checksum-integrity sentinel (Equoria-mxftz).
 *
 * THE INCIDENT THIS GUARDS. `packages/database/prisma/migrations/
 * 20260430055822_feed_phase_a/migration.sql` was edited on 2026-08-19 (commit
 * `fee265d07`, a 1846-file repo-consolidation commit) two days AFTER the local
 * development database had already applied it. Prisma stores a sha256 of each
 * migration file in `_prisma_migrations.checksum` at apply time and re-verifies
 * it on every `prisma migrate dev`; once the file no longer hashes to the
 * stored value, `migrate dev` refuses with
 *
 *   The migration `20260430055822_feed_phase_a` was modified after it was
 *   applied. We need to reset the "public" schema
 *
 * and offers exactly one remedy — `prisma migrate reset`, which destroys the
 * database. Nobody could add a migration through the normal development flow
 * for three weeks; Equoria-kccmt had to be applied with a forward-only
 * `prisma migrate deploy` instead.
 *
 * WHY A SENTINEL AND NOT A LINT RULE. The drift is invisible to everything the
 * repository already runs:
 *  - `prisma migrate status` reported "Database schema is up to date!" and
 *    exited 0 for the entire three weeks. It does not verify checksums.
 *  - `freshDbMigrationReplay.sentinel.test.mjs` replays the chain onto a
 *    brand-new database, which writes checksums from the files it is reading,
 *    so it matches by construction and can never see this class of defect.
 *  - No git-history rule works either: six migration files legitimately differ
 *    from their introducing commit because the local database was rebuilt after
 *    those edits. The applied checksum, not the commit, is the authority.
 *
 * So the only honest check is the one Prisma itself performs: hash every
 * migration file and compare it with the row that recorded its application.
 * This test does that against the real local database, read-only.
 *
 * ALGORITHM. Verified empirically against this repository's own
 * `_prisma_migrations` rows, not assumed: Prisma 6.8.2 stores the lowercase hex
 * sha256 of the migration file's raw bytes, with no normalization of line
 * endings, no trailing-newline trimming and no BOM handling. The
 * `reproduces the stored checksum` test below is that proof, and it is the
 * reason a future reader may trust `computeMigrationChecksum`.
 *
 * SAFETY. Read-only. One `SELECT` against `_prisma_migrations` on the
 * configured database. No DDL, no writes, no temporary database, no file is
 * modified.
 */

import { describe, test, expect } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'packages', 'database', 'prisma', 'migrations');

/**
 * Prisma's migration checksum: lowercase hex sha256 over the file's raw bytes.
 *
 * @param {Buffer} bytes raw contents of a `migration.sql`
 * @returns {string} lowercase hex sha256
 */
export function computeMigrationChecksum(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Every migration directory on disk that carries a `migration.sql`, mapped to
 * its checksum. Directory name is the Prisma migration name.
 *
 * @param {string} dir migrations directory
 * @returns {Map<string, string>} migration name -> checksum
 */
export function readMigrationChecksums(dir) {
  const out = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const file = path.join(dir, entry.name, 'migration.sql');
    if (!existsSync(file)) {
      continue;
    }
    out.set(entry.name, computeMigrationChecksum(readFileSync(file)));
  }
  return out;
}

/**
 * The guard, extracted so the sentinel-positive test can prove it FAILS on a
 * planted defect rather than only passing on a healthy repository.
 *
 * Two violation classes, and only two:
 *  - `modified`: the database applied this migration and the file no longer
 *    hashes to what was recorded. This is the defect above; `migrate dev`
 *    refuses and offers only a reset.
 *  - `applied-without-file`: a row exists for a migration whose directory or
 *    `migration.sql` is gone. Prisma refuses on this too, and it means history
 *    was deleted rather than rolled forward.
 *
 * A file with NO row is a PENDING migration — the normal state between
 * authoring and applying, and explicitly not a violation.
 *
 * @param {Map<string, string>} onDisk migration name -> file checksum
 * @param {Map<string, string>} applied migration name -> recorded checksum
 * @returns {Array<{migration: string, kind: 'modified' | 'applied-without-file', fileChecksum?: string, storedChecksum?: string}>}
 */
export function findChecksumDrift(onDisk, applied) {
  const drift = [];
  for (const [migration, storedChecksum] of applied) {
    const fileChecksum = onDisk.get(migration);
    if (fileChecksum === undefined) {
      drift.push({ migration, kind: 'applied-without-file', storedChecksum });
      continue;
    }
    if (fileChecksum !== storedChecksum) {
      drift.push({ migration, kind: 'modified', fileChecksum, storedChecksum });
    }
  }
  return drift;
}

/** Read the applied-migration bookkeeping, read-only. */
async function readAppliedChecksums() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set — this sentinel compares migration files against the real _prisma_migrations rows and must not be skipped',
    );
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    // `rolled_back_at IS NULL` is load-bearing, not defensive noise: Prisma
    // leaves the row of a failed/rolled-back migration in place with that
    // column set, and such a row's checksum describes an application that did
    // NOT stick. Including those rows would report drift for a migration the
    // database never successfully applied. Do not "simplify" this filter away.
    const { rows } = await client.query(
      'SELECT migration_name, checksum FROM _prisma_migrations WHERE rolled_back_at IS NULL',
    );
    return new Map(rows.map(row => [row.migration_name, row.checksum]));
  } finally {
    await client.end();
  }
}

/**
 * The remedy, printed with the failure. The header of this file explains the
 * whole incident, but a developer staring at a red suite may never open it, and
 * the WRONG instinct — the one Prisma itself suggests — destroys the database.
 *
 * @param {Array<{migration: string, kind: string, fileChecksum?: string, storedChecksum?: string}>} drift
 * @returns {string}
 */
export function explainDrift(drift) {
  const lines = [
    'Applied migration files no longer match the checksums recorded when they were applied.',
    '',
    'DO NOT run `prisma migrate reset` or `prisma db push`. Both destroy the database,',
    'and neither is the fix.',
    '',
    'For each migration below, restore its migration.sql to the exact bytes that hash to',
    'the stored checksum, then re-run. Prisma hashes raw bytes, so comments and even the',
    'trailing newline are part of the checksum. To find the right version:',
    '',
    '  git log --all --oneline -- <path to that migration.sql>',
    '  # for each candidate commit: git show <commit>:<path> | sha256sum',
    '  git cat-file blob <matching blob> > <path>      # restore it verbatim',
    '',
    'An applied migration file is immutable, comments included. If you reached this by',
    'reformatting or a documentation sweep, exclude packages/database/prisma/migrations/**',
    'from it. See Equoria-mxftz.',
    '',
  ];
  for (const entry of drift) {
    if (entry.kind === 'applied-without-file') {
      lines.push(
        `  ${entry.migration}: APPLIED BUT THE FILE IS GONE (stored ${entry.storedChecksum}).` +
          ' Restore the directory from git; do not delete the row.',
      );
    } else {
      lines.push(`  ${entry.migration}: file hashes to ${entry.fileChecksum} but ${entry.storedChecksum} was applied.`);
    }
  }
  return lines.join('\n');
}

describe('applied-migration checksum integrity (Equoria-mxftz)', () => {
  test('every applied migration file still hashes to the checksum recorded when it was applied', async () => {
    const onDisk = readMigrationChecksums(MIGRATIONS_DIR);
    const applied = await readAppliedChecksums();

    // Guard against a vacuous pass: an empty directory or an unmigrated
    // database would make the comparison trivially true.
    expect(onDisk.size).toBeGreaterThan(0);
    expect(applied.size).toBeGreaterThan(0);

    const drift = findChecksumDrift(onDisk, applied);
    // Assert on the explained form so the remedy is in the failure output, not
    // only in this file's header. `toEqual([])` alone would print the drift
    // objects and leave the developer to guess — and Prisma's own suggestion,
    // `migrate reset`, is the destructive wrong answer.
    expect(drift.length === 0 ? '' : explainDrift(drift)).toBe('');
  }, 60_000);

  test("reproduces the stored checksum, proving the algorithm is Prisma's own", async () => {
    const onDisk = readMigrationChecksums(MIGRATIONS_DIR);
    const applied = await readAppliedChecksums();

    // Not a tautology of the test above: this asserts the two maps genuinely
    // OVERLAP, so `findChecksumDrift` had real pairs to compare. If the hash
    // algorithm were wrong, every overlapping pair would mismatch and the
    // previous test would fail loudly rather than silently comparing nothing.
    const shared = [...applied.keys()].filter(name => onDisk.has(name));
    expect(shared.length).toBe(applied.size);
    for (const name of shared) {
      expect(onDisk.get(name)).toBe(applied.get(name));
      expect(onDisk.get(name)).toMatch(/^[0-9a-f]{64}$/);
    }
  }, 60_000);

  test('SENTINEL-POSITIVE: the guard reports an applied migration whose file changed', () => {
    const applied = new Map([
      ['20260430055822_feed_phase_a', '01b3818ddc8414040ce6f0a89fd580b1a28ef22ff9d1cb4a405d2c7dfc9902b8'],
    ]);
    // The exact hash the file carried while the flow was broken: the
    // fee265d07 version, whose SQL was byte-identical and whose comments were
    // not. A check that compared SQL statements, or ignored comments, would
    // have stayed green through the outage. This one does not.
    const onDisk = new Map([
      ['20260430055822_feed_phase_a', '2886d20fd9242efca2bfd6a275a14700d474d263f71695e9c22ad3a318038327'],
    ]);

    expect(findChecksumDrift(onDisk, applied)).toEqual([
      {
        migration: '20260430055822_feed_phase_a',
        kind: 'modified',
        fileChecksum: '2886d20fd9242efca2bfd6a275a14700d474d263f71695e9c22ad3a318038327',
        storedChecksum: '01b3818ddc8414040ce6f0a89fd580b1a28ef22ff9d1cb4a405d2c7dfc9902b8',
      },
    ]);
  });

  test('SENTINEL-POSITIVE: the guard reports a migration whose file was deleted after it was applied', () => {
    const applied = new Map([['20260430055822_feed_phase_a', 'a'.repeat(64)]]);
    expect(findChecksumDrift(new Map(), applied)).toEqual([
      {
        migration: '20260430055822_feed_phase_a',
        kind: 'applied-without-file',
        storedChecksum: 'a'.repeat(64),
      },
    ]);
  });

  test('a pending migration — a file with no row yet — is not a violation', () => {
    const applied = new Map([['20260430055822_feed_phase_a', 'a'.repeat(64)]]);
    const onDisk = new Map([
      ['20260430055822_feed_phase_a', 'a'.repeat(64)],
      ['29991231235959_authored_but_not_yet_applied', 'b'.repeat(64)],
    ]);
    expect(findChecksumDrift(onDisk, applied)).toEqual([]);
  });

  test('the failure message carries the remedy and refuses the destructive one', () => {
    const message = explainDrift([
      {
        migration: '20260430055822_feed_phase_a',
        kind: 'modified',
        fileChecksum: '2886d20fd9242efca2bfd6a275a14700d474d263f71695e9c22ad3a318038327',
        storedChecksum: '01b3818ddc8414040ce6f0a89fd580b1a28ef22ff9d1cb4a405d2c7dfc9902b8',
      },
    ]);

    expect(message).toContain('DO NOT run `prisma migrate reset`');
    expect(message).toContain('git cat-file blob');
    expect(message).toContain('20260430055822_feed_phase_a');
    expect(message).toContain('2886d20fd9242efca2bfd6a275a14700d474d263f71695e9c22ad3a318038327');
    expect(message).toContain('01b3818ddc8414040ce6f0a89fd580b1a28ef22ff9d1cb4a405d2c7dfc9902b8');
    // The deleted-file case gets its own instruction, since restoring a file is
    // a different action from restoring a directory and the row must be left alone.
    expect(explainDrift([{ migration: 'x', kind: 'applied-without-file', storedChecksum: 'a'.repeat(64) }])).toContain(
      'do not delete the row',
    );
  });

  test('the hash is over raw bytes: a comment-only change and a line-ending change both move it', () => {
    const base = Buffer.from('-- intent\nALTER TABLE "horses" ADD COLUMN "x" TEXT;\n', 'utf8');
    const reworded = Buffer.from('-- reworded intent\nALTER TABLE "horses" ADD COLUMN "x" TEXT;\n', 'utf8');
    const crlf = Buffer.from('-- intent\r\nALTER TABLE "horses" ADD COLUMN "x" TEXT;\r\n', 'utf8');

    expect(computeMigrationChecksum(base)).not.toBe(computeMigrationChecksum(reworded));
    expect(computeMigrationChecksum(base)).not.toBe(computeMigrationChecksum(crlf));
  });
});
