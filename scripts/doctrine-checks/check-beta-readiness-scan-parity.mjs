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
// acceptance criterion: it extracts the two canonical scan regexes from
// BOTH files and asserts each pair is byte-identical. Any future edit to
// one side that is not mirrored on the other fails this gate.
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

const scriptText = fs.readFileSync(SCRIPT, 'utf-8');
const workflowText = fs.readFileSync(WORKFLOW, 'utf-8');

const failures = [];

/**
 * Pull the regex argument out of the first `grep -rEn "<re>"` or
 * `grep -rn "<re>"` whose regex contains `marker`. Returns the raw regex
 * string (without surrounding quotes), or null if not found.
 */
function extractGrepRegex(text, marker) {
  // Matches: grep -rEn "<...marker...>"  OR  grep -rn "<...marker...>"
  const re = new RegExp(
    'grep\\s+-r[A-Za-z]*n\\s+"([^"]*' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^"]*)"'
  );
  const m = re.exec(text);
  return m ? m[1] : null;
}

// --- Canonical scan 1: frontend mock-data (marker: allMockHorses) -----------
const scriptMock = extractGrepRegex(scriptText, 'allMockHorses');
const workflowMock = extractGrepRegex(workflowText, 'allMockHorses');

if (!scriptMock) {
  failures.push(
    'Could not locate the frontend-mock-data grep regex in scripts/check-beta-readiness.sh'
  );
}
if (!workflowMock) {
  failures.push('Could not locate the frontend-mock-data grep regex in .github/workflows/test.yml');
}
if (scriptMock && workflowMock && scriptMock !== workflowMock) {
  failures.push(
    'DRIFT — frontend-mock-data scan regex differs between the signoff script and the CI inline scan:\n' +
      `  script  : ${scriptMock}\n` +
      `  workflow: ${workflowMock}\n` +
      '  Resync both to be byte-identical (see ADR-010 / Equoria-862l).'
  );
}

// --- Canonical scan 2: bypass-header (marker: x-test-skip-csrf) -------------
const scriptBypass = extractGrepRegex(scriptText, 'x-test-skip-csrf');
const workflowBypass = extractGrepRegex(workflowText, 'x-test-skip-csrf');

if (!scriptBypass) {
  failures.push('Could not locate the bypass-header grep regex in scripts/check-beta-readiness.sh');
}
if (!workflowBypass) {
  failures.push('Could not locate the bypass-header grep regex in .github/workflows/test.yml');
}
if (scriptBypass && workflowBypass && scriptBypass !== workflowBypass) {
  failures.push(
    'DRIFT — bypass-header scan regex differs between the signoff script and the CI inline scan:\n' +
      `  script  : ${scriptBypass}\n` +
      `  workflow: ${workflowBypass}\n` +
      '  Resync both to be byte-identical (see ADR-010 / Equoria-862l).'
  );
}

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
