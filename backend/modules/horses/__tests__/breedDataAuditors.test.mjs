/**
 * breedDataAuditors.test.mjs (Equoria-26qjf.4 AC3)
 *
 * Wires the three sample-data auditors (samples/Breeds/_validate.mjs,
 * _audit_color_rules.mjs, _audit_base_color.mjs) into the jest test command / CI
 * as a DATA GUARD. These auditors are the editable source-of-truth's correctness
 * checks; running them here makes a future bad edit to a breed source file fail
 * the build, not just a manual run.
 *
 * No DB, no mocks — each auditor is spawned as a child process against the
 * samples/Breeds directory (the auditors are self-locating via import.meta.url,
 * overridable with BREED_DIR). The test parses each auditor's summary line and
 * asserts the clean counts the epic established:
 *   - _validate:          312 OK / 0 FAIL
 *   - _audit_color_rules: 0 hard errors
 *   - _audit_base_color:  0 implausible, 0 map-keys-not-found
 *
 * Story: Equoria-26qjf.4
 */

import { describe, test, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// backend/modules/horses/__tests__ → repo root is four levels up
// (__tests__ → horses → modules → backend → repo root).
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
// Equoria-dsd2a: c12c53c72 (Equoria-26qjf.3) relocated the 312 breed
// SQL profile files samples/Breeds/*.txt -> backend/data/breeds/*.txt.
// The auditor SCRIPTS still live in samples/Breeds/ (they are editing
// tools, not seed data), so we spawn them from there but point them at
// the canonical breed-data directory via BREED_DIR.
const AUDITOR_SCRIPTS_DIR = join(REPO_ROOT, 'samples', 'Breeds');
const BREEDS_DATA_DIR = join(REPO_ROOT, 'backend', 'data', 'breeds');

function runAuditor(scriptName) {
  const scriptPath = join(AUDITOR_SCRIPTS_DIR, scriptName);
  return execFileSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, BREED_DIR: BREEDS_DATA_DIR },
    maxBuffer: 10 * 1024 * 1024,
  });
}

describe('breed-data auditors (Equoria-26qjf.4 AC3 — data guard)', () => {
  test('_validate.mjs: every breed file passes (0 FAIL)', () => {
    const out = runAuditor('_validate.mjs');
    // Summary: "=== 312 OK / 0 FAIL / 312 total ==="
    const m = out.match(/===\s*(\d+)\s*OK\s*\/\s*(\d+)\s*FAIL\s*\/\s*(\d+)\s*total\s*===/);
    expect(m).not.toBeNull();
    const [, ok, fail, total] = m.map(Number);
    expect(fail).toBe(0);
    expect(ok).toBe(total);
    expect(total).toBeGreaterThanOrEqual(312);
  });

  test('_audit_color_rules.mjs: 0 hard errors', () => {
    const out = runAuditor('_audit_color_rules.mjs');
    // Summary: "=== AUDIT: 0 hard errors, N warnings, across 312 breeds ==="
    const m = out.match(/AUDIT:\s*(\d+)\s*hard errors/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(0);
  });

  test('_audit_base_color.mjs: 0 implausible, 0 map-keys-not-found', () => {
    const out = runAuditor('_audit_base_color.mjs');
    // Summary: "=== BASE-COLOR AUDIT: 43 plausible, 0 implausible, 0 map-keys-not-found (of 43 checked) ==="
    const m = out.match(/BASE-COLOR AUDIT:\s*(\d+)\s*plausible,\s*(\d+)\s*implausible,\s*(\d+)\s*map-keys-not-found/);
    expect(m).not.toBeNull();
    const [, plausible, implausible, missing] = m.map(Number);
    expect(implausible).toBe(0);
    expect(missing).toBe(0);
    expect(plausible).toBeGreaterThan(0);
  });
});
