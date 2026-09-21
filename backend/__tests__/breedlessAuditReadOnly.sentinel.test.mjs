/**
 * breedlessAuditReadOnly.sentinel.test.mjs (Equoria-qsp1b.1 / Equoria-2wjp7)
 *
 * backend/scripts/audit-breedless-horses.mjs reports the breedless-horse
 * population so the OWNER can choose a remedy. CLAUDE.md forbids broad cleanup
 * against player data, and the real player's account is already known to carry
 * dangling horse references (Equoria-kszly) — so this script must stay a pure
 * report. The obvious next edit somebody makes to a report script is to bolt an
 * `--apply` onto it. That edit is exactly what this sentinel refuses.
 *
 * The audit's own output cannot prove it wrote nothing (a report that had
 * quietly deleted rows would print the same text), so the guard is on the
 * source: no Prisma mutation verb, no raw-SQL write, no apply flag.
 *
 * Deliberately a source check and not a behavioural one: the script runs
 * against whatever database the environment points at, and asserting "the row
 * count did not change" on the SHARED dev database would be a coin flip —
 * concurrent suites move that count by thousands (observed 30 → 2790 inside one
 * minute on 2026-09-14). A source sentinel has no such blind spot. What it
 * CANNOT see: a write reached indirectly through a helper the script imports.
 * It imports only the shared prisma client and one exported constant, so there
 * is no such helper today — but adding an import is not covered here.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AUDIT_SRC_PATH = join(dirname(fileURLToPath(import.meta.url)), '../scripts/audit-breedless-horses.mjs');
const SRC = readFileSync(AUDIT_SRC_PATH, 'utf8');

// Strip block and line comments — the file explains the destructive remedies it
// deliberately does NOT perform, and those sentences must not trip the guard.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('SENTINEL: the breedless-horse audit is read-only (Equoria-qsp1b.1)', () => {
  it('calls no Prisma mutation verb', () => {
    const mutators = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
    for (const verb of mutators) {
      expect(CODE).not.toMatch(new RegExp(`\\.\\s*${verb}\\s*\\(`));
    }
  });

  it('issues no raw-SQL write and no $executeRaw', () => {
    expect(CODE).not.toMatch(/\$executeRaw/);
    expect(CODE).not.toMatch(/\$executeRawUnsafe/);
    expect(CODE).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|TRUNCATE|ALTER\s+TABLE|DROP\s+TABLE)\b/i);
  });

  it('reads no mode-switching CLI flag other than --json', () => {
    // Guard the MECHANISM, not the prose. The script legitimately PRINTS the
    // string "--apply" when it points the owner at the separate backfill
    // script; what must never appear is this script acting on such a flag.
    // So: enumerate every flag it actually reads from argv and pin the set.
    const flagsRead = [...CODE.matchAll(/process\.argv\.includes\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
    expect(flagsRead.sort()).toEqual(['--json']);

    // And no other argv-driven branch smuggled in by a different spelling.
    expect(CODE).not.toMatch(/process\.argv\s*\.\s*(indexOf|find|some|filter)\b/);
    expect(CODE).not.toMatch(/\bprocess\.env\.(APPLY|FORCE|CONFIRM_DELETE)\b/);
  });

  it('still exists and still reads the breedless population (guard is not vacuous)', () => {
    // If the file were emptied or renamed the assertions above would pass
    // trivially. Prove the subject under guard is actually there.
    expect(CODE).toMatch(/breedId:\s*null/);
    expect(CODE).toMatch(/findMany/);
  });
});
