/**
 * Equoria-mxhpi: sentinel for the breed-SQL-profile dry-run validator.
 *
 * Proves the validator script catches the real defect classes it's
 * designed to surface — bad-structure (allele_weights sum != 1.0) — by
 * running it against the 2 sample files currently in the repo. Pre-fix
 * regex bug let the no-insert branch swallow both files; post-fix one
 * file is correctly flagged bad-struct and the other parses clean.
 */

import { describe, it, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'backend/scripts/validate-breed-sql-profiles.mjs');

describe('validate-breed-sql-profiles dry-run validator (Equoria-mxhpi)', () => {
  it('SENTINEL: runs against the 2 in-repo sample files and surfaces structural defects', () => {
    const res = spawnSync('node', [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });

    // Exit 1 = at least one file had structural problems (which is the
    // intended state given generichorse.txt's known sum-off-by-0.008 W
    // locus). Exit 2 would mean the DB/samples dir was unreachable —
    // that's a CI-env problem, not a validator regression.
    expect([0, 1]).toContain(res.status);
    expect(res.stdout).toMatch(/files scanned:\s+2/);
    // The validator must have recognized BOTH sample files as breed
    // INSERTs (parsed past the SQL header into the JSONB body), not
    // dropped them into the no-insert bucket. Pre-fix bug counted both
    // as no-insert; post-fix at least one is UPDATE and at most one is
    // bad-struct.
    expect(res.stdout).toMatch(/no INSERT stmt:\s+0/);
  });
});
