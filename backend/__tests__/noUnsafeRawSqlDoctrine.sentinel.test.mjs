/**
 * Equoria-jzu4l doctrine-check sentinel.
 *
 * Proves that `scripts/doctrine-checks/check-no-unsafe-raw-sql.mjs` actually
 * FIRES when a NEW `$executeRawUnsafe(` / `$queryRawUnsafe(` callsite is
 * planted in backend app code that is not on the narrow allowlist — and that
 * it PASSES against the current tree. Without this sentinel a future regex
 * narrowing, scope shrinkage, or an over-broad allowlist could silently let
 * new unsafe raw SQL slip past — the "test that doesn't really test" pattern
 * the constitution rejects (OPTIMAL_FIX_DISCIPLINE §2).
 *
 * Harness mirrors noPrismaInRoutesDoctrine.sentinel.test.mjs: plant a file
 * inside a scanned subtree, run the check via spawnSync, assert exit code +
 * stderr. Real scanner, real filesystem, no mocks.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-unsafe-raw-sql.mjs');

// Plant inside backend/modules/<x>/ so the scan picks it up via the
// `modules/**` walk. The sentinel module name is unmistakably synthetic so a
// stray file can never be mistaken for real domain code.
const PLANT_MODULE = path.join(REPO_ROOT, 'backend/modules/_jzu4l_doctrine_sentinel');
const PLANT_DIR = path.join(PLANT_MODULE, 'services');

afterEach(() => {
  // Best-effort cleanup so a test crash doesn't poison subsequent runs.
  try {
    fs.rmSync(PLANT_MODULE, { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best-effort
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

// Build the unsafe call token by interpolation so THIS test file does not
// itself contain the literal call token (the scanner skips __tests__ dirs, so
// this is belt-and-suspenders for greppability, not correctness). Template
// interpolation (not `'$' + '...'` concatenation) keeps the same split-token
// property while satisfying no-useless-concat/prefer-template.
const UNSAFE_QUERY = `${'$'}queryRawUnsafe`;
const UNSAFE_EXEC = `${'$'}executeRawUnsafe`;

describe('check-no-unsafe-raw-sql.mjs (Equoria-jzu4l)', () => {
  it('passes against the current tree (no unallowlisted unsafe raw SQL in app code)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-unsafe-raw-sql.*OK/);
  });

  it('SENTINEL: fails when a $queryRawUnsafe call is planted in an app-code service', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const plantedSource = `import prisma from '../../../../packages/database/prismaClient.mjs';
export async function leak(userId) {
  // dynamic string-spliced SQL — exactly the vector this gate bans
  const sql = \`SELECT * FROM "User" WHERE id = '\${userId}'\`;
  return prisma.${UNSAFE_QUERY}(sql);
}
`;
    fs.writeFileSync(path.join(PLANT_DIR, 'plantedQuery.mjs'), plantedSource);

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-unsafe-raw-sql.*FAIL/);
    expect(res.stderr).toMatch(/plantedQuery\.mjs/);
  });

  it('SENTINEL: fails when a $executeRawUnsafe call is planted in an app-code service', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const plantedSource = `import prisma from '../../../../packages/database/prismaClient.mjs';
export async function wipe(table) {
  return prisma.${UNSAFE_EXEC}(\`DELETE FROM \${table}\`);
}
`;
    fs.writeFileSync(path.join(PLANT_DIR, 'plantedExec.mjs'), plantedSource);

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-unsafe-raw-sql.*FAIL/);
    expect(res.stderr).toMatch(/plantedExec\.mjs/);
  });

  it('SENTINEL: does NOT fire on a commented-out mention of the unsafe token', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const plantedSource = `export function note() {
  // historical: this used prisma.${UNSAFE_QUERY}(sql) before the Equoria-jzu4l migration
  /* block: also mentioned prisma.${UNSAFE_EXEC}(x) in prose */
  return 1;
}
`;
    fs.writeFileSync(path.join(PLANT_DIR, 'plantedComment.mjs'), plantedSource);

    const res = runCheck();
    // The commented mentions must NOT trip the gate — only real call
    // expressions do. The tree is otherwise clean, so exit 0.
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-unsafe-raw-sql.*OK/);
  });
});
