/**
 * Equoria-iffbt — Sentinel-positive coverage for the ADR-010 beta-readiness
 * scan SINGLE-SOURCE invariant.
 *
 * Background: the four cheap static scans that gate beta readiness are now
 * defined ONCE in scripts/lib/beta-readiness-scans.sh and SOURCED by both
 * scripts/check-beta-readiness.sh and the beta-readiness-gate job in
 * .github/workflows/test.yml (Equoria-iffbt, replacing the former inline
 * duplication + byte-parity check). The four scans:
 *   1. HTTP cleanup-route scan      (marker: test/cleanup)
 *   2. integration-test DB-mock scan (marker: unstable_mockModule)
 *   3. frontend mock-data scan       (marker: allMockHorses)
 *   4. E2E/api-client bypass-header  (marker: x-test-skip-csrf)
 *
 * scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs now asserts the
 * single-source invariant: the library defines all four regexes, both
 * consumers source the library, and NO inline regex copy reappears in either
 * consumer. This test PROVES that assertion FIRES on each violation and PASSES
 * on the real (post-iffbt) tree — the OPTIMAL_FIX_DISCIPLINE §2 requirement.
 *
 * Pure unit test: imports the core checkSingleSource() function (no DB, no
 * child process).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkSingleSource,
  CANONICAL_SCANS,
} from '../../../scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-beta-readiness.sh');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'test.yml');
const LIBRARY = path.join(REPO_ROOT, 'scripts', 'lib', 'beta-readiness-scans.sh');

const scriptText = fs.readFileSync(SCRIPT, 'utf-8');
const workflowText = fs.readFileSync(WORKFLOW, 'utf-8');
const libraryText = fs.readFileSync(LIBRARY, 'utf-8');

describe('beta-readiness scan single-source invariant (Equoria-iffbt)', () => {
  test('passes today — single library, both consumers source it, no inline copies', () => {
    const failures = checkSingleSource(scriptText, workflowText, libraryText);
    expect(failures).toEqual([]);
  });

  test('CANONICAL_SCANS still lists all four scans', () => {
    expect(CANONICAL_SCANS).toHaveLength(4);
    for (const scan of CANONICAL_SCANS) {
      expect(scan.libVar).toMatch(/^EQUORIA_SCAN_RE_/);
    }
  });

  test('FIRES when the shared library drops a canonical regex variable', () => {
    // Remove the DB-mock regex variable definition from the library.
    const strippedLib = libraryText.replace(/EQUORIA_SCAN_RE_DB_MOCK=/, 'EQUORIA_SCAN_RE_DB_MOCK_RENAMED=');
    const failures = checkSingleSource(scriptText, workflowText, strippedLib);
    expect(failures.join('\n')).toMatch(/Shared library is missing the integration-test DB-mock regex variable/);
  });

  test('FIRES when a consumer stops sourcing the shared library (script side)', () => {
    const noSource = scriptText.replace(/lib\/beta-readiness-scans\.sh/g, 'lib/SOMETHING_ELSE.sh');
    const failures = checkSingleSource(noSource, workflowText, libraryText);
    expect(failures.join('\n')).toMatch(/check-beta-readiness\.sh does not source the shared library/);
  });

  test('FIRES when a consumer stops sourcing the shared library (workflow side)', () => {
    const noSource = workflowText.replace(/lib\/beta-readiness-scans\.sh/g, 'lib/SOMETHING_ELSE.sh');
    const failures = checkSingleSource(scriptText, noSource, libraryText);
    expect(failures.join('\n')).toMatch(/test\.yml does not source the shared library/);
  });

  test('FIRES when an inline scan-regex copy reappears in the script', () => {
    // Plant an inline grep copy of the bypass-header scan back into the script.
    const planted =
      scriptText +
      '\n# accidental reintroduction\nif grep -rn "x-test-skip-csrf\\|bypass-auth" tests/e2e/ ; then :; fi\n';
    const failures = checkSingleSource(planted, workflowText, libraryText);
    expect(failures.join('\n')).toMatch(/INLINE COPY — scripts\/check-beta-readiness\.sh reintroduced an inline bypass-header scan regex/);
  });

  test('FIRES when an inline scan-regex copy reappears in the workflow', () => {
    const planted =
      workflowText +
      '\n      # accidental reintroduction\n      - run: grep -rn "test/cleanup\\|testCleanup" backend/routes/\n';
    const failures = checkSingleSource(scriptText, planted, libraryText);
    expect(failures.join('\n')).toMatch(/INLINE COPY — \.github\/workflows\/test\.yml reintroduced an inline HTTP cleanup-route scan regex/);
  });
});
