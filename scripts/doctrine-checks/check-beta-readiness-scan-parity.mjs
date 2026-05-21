#!/usr/bin/env node
// Doctrine: the canonical beta-readiness static scans MUST NOT drift
// between scripts/check-beta-readiness.sh (the CLAUDE.md-designated
// signoff script) and .github/workflows/test.yml (the CI
// beta-readiness-gate that re-implements them inline).
//
// Background (Equoria-862l): scripts/check-beta-readiness.sh is the
// required final signoff per CLAUDE.md, but it runs all 10 gates
// (including full backend suites + the Playwright beta-readiness run,
// ~tens of minutes) against an environment the CI beta-readiness-gate
// job does not fully provide. So test.yml deliberately re-implements
// only the cheap STATIC scans inline as fast pre-flight gates. That
// design is documented in
// docs/architecture/adr-010-ci-inline-beta-readiness-scans.md.
//
// The hazard the ADR accepts: the inline copies and the script copies
// can silently diverge (this is exactly what had happened — the script
// lagged the workflow's Equoria-veql regex tightening until 862l
// resynced it). This check closes the "no silent drift path remains"
// acceptance criterion: it extracts ALL FOUR canonical scan regexes from
// BOTH files and asserts each pair is byte-identical. Any future edit to
// one side that is not mirrored on the other fails this gate.
//
// The four deliberately-duplicated static scans (ADR-010 / Equoria-862l):
//   1. HTTP cleanup-route scan      (marker: test/cleanup)
//   2. integration-test DB-mock scan (marker: unstable_mockModule)
//   3. frontend mock-data scan       (marker: allMockHorses)
//   4. E2E/api-client bypass-header  (marker: x-test-skip-csrf)
// Scans 1 and 2 were NOT covered before Equoria-v9v14 — a silent-drift
// path remained for them. They are now asserted alongside 3 and 4.
//
// Wired into the beta-readiness gate via run-all.sh (GATE 1 of
// check-beta-readiness.sh) and doctrine-gate.yml CI.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-beta-readiness.sh');
const WORKFLOW = path.join(REPO_ROOT, '.github', 'workflows', 'test.yml');

/**
 * Pull the regex argument out of the first `grep -rEn "<re>"` or
 * `grep -rn "<re>"` whose regex contains `marker`. Returns the raw regex
 * string (without surrounding quotes), or null if not found.
 */
export function extractGrepRegex(text, marker) {
  // Matches: grep -rEn "<...marker...>"  OR  grep -rn "<...marker...>".
  // The separator between the flags and the opening quote may include a
  // shell line-continuation backslash + newline (the DB-mock scan in both
  // files writes `grep -rn \` then the regex on the next line), so allow
  // any run of whitespace and backslashes there.
  const re = new RegExp(
    'grep\\s+-r[A-Za-z]*n[\\s\\\\]+"([^"]*' +
      marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[^"]*)"'
  );
  const m = re.exec(text);
  return m ? m[1] : null;
}

// All four canonical scans, each keyed by a unique content marker that
// appears verbatim inside its grep regex on BOTH sides. Adding a scan
// here is the only edit needed to bring a new duplicated scan under the
// drift assertion.
export const CANONICAL_SCANS = [
  { name: 'HTTP cleanup-route', marker: 'test/cleanup' },
  { name: 'integration-test DB-mock', marker: 'unstable_mockModule' },
  { name: 'frontend-mock-data', marker: 'allMockHorses' },
  { name: 'bypass-header', marker: 'x-test-skip-csrf' },
];

/**
 * Core drift assertion. Given the two file contents, returns an array of
 * human-readable failure strings — empty when all four scan pairs are
 * located and byte-identical. Pure (no I/O, no process.exit) so it is
 * directly unit-testable with planted-drift inputs.
 */
export function checkScanParity(scriptText, workflowText) {
  const failures = [];
  for (const { name, marker } of CANONICAL_SCANS) {
    const scriptRegex = extractGrepRegex(scriptText, marker);
    const workflowRegex = extractGrepRegex(workflowText, marker);

    if (!scriptRegex) {
      failures.push(`Could not locate the ${name} grep regex in scripts/check-beta-readiness.sh`);
    }
    if (!workflowRegex) {
      failures.push(`Could not locate the ${name} grep regex in .github/workflows/test.yml`);
    }
    if (scriptRegex && workflowRegex && scriptRegex !== workflowRegex) {
      failures.push(
        `DRIFT — ${name} scan regex differs between the signoff script and the CI inline scan:\n` +
          `  script  : ${scriptRegex}\n` +
          `  workflow: ${workflowRegex}\n` +
          '  Resync both to be byte-identical (see ADR-010 / Equoria-862l).'
      );
    }
  }
  return failures;
}

function main() {
  const scriptText = fs.readFileSync(SCRIPT, 'utf-8');
  const workflowText = fs.readFileSync(WORKFLOW, 'utf-8');
  const failures = checkScanParity(scriptText, workflowText);

  if (failures.length > 0) {
    console.error('\nBeta-readiness scan parity check FAILED:\n');
    for (const f of failures) {
      console.error('  - ' + f.replace(/\n/g, '\n    '));
    }
    console.error(
      '\nThe canonical static scans in scripts/check-beta-readiness.sh and the' +
        '\nbeta-readiness-gate inline steps in .github/workflows/test.yml must' +
        '\nstay byte-identical. See docs/architecture/adr-010-ci-inline-beta-' +
        '\nreadiness-scans.md for why the scans are deliberately duplicated and' +
        '\nhow to keep them in sync.'
    );
    process.exit(1);
  }
  process.exit(0);
}

// Run as a CLI only when invoked directly (node check-...mjs), not when
// imported by the sentinel test. Compares the resolved entry path to this
// module's path.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
