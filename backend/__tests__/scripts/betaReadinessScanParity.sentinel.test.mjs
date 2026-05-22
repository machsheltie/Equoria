/**
 * Equoria-v9v14 — Sentinel-positive coverage for the ADR-010 beta-readiness
 * scan-parity drift assertion.
 *
 * Background: scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs
 * asserts that the FOUR static scans deliberately duplicated between
 * scripts/check-beta-readiness.sh and the beta-readiness-gate job in
 * .github/workflows/test.yml stay byte-identical:
 *   1. HTTP cleanup-route scan      (marker: test/cleanup)
 *   2. integration-test DB-mock scan (marker: unstable_mockModule)
 *   3. frontend mock-data scan       (marker: allMockHorses)
 *   4. E2E/api-client bypass-header  (marker: x-test-skip-csrf)
 *
 * Before v9v14 only scans 3 and 4 were asserted; scans 1 and 2 had a
 * silent-drift path. This test PROVES the assertion now FIRES when scan 1
 * or scan 2 drifts on one side only, and PASSES when both sides agree —
 * the OPTIMAL_FIX_DISCIPLINE §2 sentinel-positive requirement.
 *
 * Pure unit test: imports the core checkScanParity() function (no DB, no
 * child process). The backend Jest globalSetup still runs, but this suite
 * touches no Prisma client.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkScanParity,
  CANONICAL_SCANS,
  extractGrepRegex,
} from '../../../scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-beta-readiness.sh');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'test.yml');

const scriptText = fs.readFileSync(SCRIPT, 'utf-8');
const workflowText = fs.readFileSync(WORKFLOW, 'utf-8');

/**
 * Mutate the FIRST grep regex containing `marker` in `text` by injecting a
 * harmless extra alternation token, simulating a one-sided edit that was
 * not mirrored on the other side. Returns the mutated text; throws if the
 * marker's grep can't be found (which would itself be a real defect).
 */
function plantDrift(text, marker) {
  const original = extractGrepRegex(text, marker);
  if (original === null) {
    throw new Error(`plantDrift: could not locate grep regex for marker "${marker}"`);
  }
  // Append a new alternation token. `\|` is the BRE alternation used by the
  // cleanup/DB-mock/bypass greps; the frontend-mock grep uses ERE `|`. Either
  // way, changing the string content is enough to break byte-identity — the
  // assertion compares raw strings, it does not interpret the regex.
  const mutated = `${original}\\|__DRIFT_SENTINEL__`;
  return text.replace(`"${original}"`, `"${mutated}"`);
}

describe('beta-readiness scan-parity drift assertion (Equoria-v9v14)', () => {
  test('passes today — all four duplicated scans are byte-identical', () => {
    const failures = checkScanParity(scriptText, workflowText);
    expect(failures).toEqual([]);
  });

  test('all four canonical scans are actually present in BOTH files', () => {
    // Guards against the markers becoming decorative (cross-ref Equoria-vygc2):
    // if either side stops containing the marker'd grep, extraction returns
    // null and the assertion would report a "could not locate" failure.
    for (const { marker } of CANONICAL_SCANS) {
      expect(extractGrepRegex(scriptText, marker)).not.toBeNull();
      expect(extractGrepRegex(workflowText, marker)).not.toBeNull();
    }
    expect(CANONICAL_SCANS).toHaveLength(4);
  });

  // The two scans that were UNCOVERED before this issue. Each must now make
  // the assertion fire when drifted on one side only.
  test('FIRES on drift in the HTTP cleanup-route scan (script side)', () => {
    const drifted = plantDrift(scriptText, 'test/cleanup');
    const failures = checkScanParity(drifted, workflowText);
    expect(failures.join('\n')).toMatch(/DRIFT — HTTP cleanup-route scan regex differs/);
  });

  test('FIRES on drift in the HTTP cleanup-route scan (workflow side)', () => {
    const drifted = plantDrift(workflowText, 'test/cleanup');
    const failures = checkScanParity(scriptText, drifted);
    expect(failures.join('\n')).toMatch(/DRIFT — HTTP cleanup-route scan regex differs/);
  });

  test('FIRES on drift in the integration-test DB-mock scan (script side)', () => {
    const drifted = plantDrift(scriptText, 'unstable_mockModule');
    const failures = checkScanParity(drifted, workflowText);
    expect(failures.join('\n')).toMatch(/DRIFT — integration-test DB-mock scan regex differs/);
  });

  test('FIRES on drift in the integration-test DB-mock scan (workflow side)', () => {
    const drifted = plantDrift(workflowText, 'unstable_mockModule');
    const failures = checkScanParity(scriptText, drifted);
    expect(failures.join('\n')).toMatch(/DRIFT — integration-test DB-mock scan regex differs/);
  });

  // The two scans that were already covered — confirm they still fire so the
  // refactor to a data-driven loop did not silently drop them.
  test('FIRES on drift in the frontend mock-data scan', () => {
    const drifted = plantDrift(scriptText, 'allMockHorses');
    const failures = checkScanParity(drifted, workflowText);
    expect(failures.join('\n')).toMatch(/DRIFT — frontend-mock-data scan regex differs/);
  });

  test('FIRES on drift in the bypass-header scan', () => {
    const drifted = plantDrift(scriptText, 'x-test-skip-csrf');
    const failures = checkScanParity(drifted, workflowText);
    expect(failures.join('\n')).toMatch(/DRIFT — bypass-header scan regex differs/);
  });

  test('reports "could not locate" when a scan marker disappears from one side', () => {
    // Remove the DB-mock grep from the script entirely → extraction null.
    const dbMock = extractGrepRegex(scriptText, 'unstable_mockModule');
    const stripped = scriptText.replace(`"${dbMock}"`, '"removed"');
    const failures = checkScanParity(stripped, workflowText);
    expect(failures.join('\n')).toMatch(/Could not locate the integration-test DB-mock grep regex/);
  });
});
