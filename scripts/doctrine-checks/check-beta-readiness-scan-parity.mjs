#!/usr/bin/env node
// Doctrine: the four cheap beta-readiness static scans MUST have exactly ONE
// definition. Equoria-iffbt extracted them into the shared shell library
// scripts/lib/beta-readiness-scans.sh, sourced by BOTH:
//   - scripts/check-beta-readiness.sh        (the CLAUDE.md signoff script)
//   - .github/workflows/test.yml             (the beta-readiness-gate CI job)
//
// History: before iffbt the four regexes were copy-pasted inline into BOTH
// files and this check asserted byte-identity between the two copies
// (Equoria-862l/v9v14, ADR-010). With a single sourced library there is no
// second copy to compare, so this check was repurposed (iffbt): it now guards
// the SINGLE-SOURCE invariant instead of byte-parity. Specifically it asserts:
//   1. the shared library defines all four canonical scan regex variables;
//   2. both consumers `source` the shared library;
//   3. the inline scan regexes do NOT REAPPEAR in either consumer (an inline
//      copy would reintroduce the exact drift hazard the library removed).
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
const LIBRARY = path.join(REPO_ROOT, 'scripts', 'lib', 'beta-readiness-scans.sh');

// The four canonical scans. Each is keyed by a unique content marker that must
// appear verbatim inside its regex in the SHARED LIBRARY (and nowhere inline in
// the consumers). The library variable name is asserted present too.
export const CANONICAL_SCANS = [
  { name: 'HTTP cleanup-route', marker: 'test/cleanup', libVar: 'EQUORIA_SCAN_RE_HTTP_CLEANUP' },
  { name: 'integration-test DB-mock', marker: 'unstable_mockModule', libVar: 'EQUORIA_SCAN_RE_DB_MOCK' },
  { name: 'frontend-mock-data', marker: 'allMockHorses', libVar: 'EQUORIA_SCAN_RE_FRONTEND_MOCK' },
  { name: 'bypass-header', marker: 'x-test-skip-csrf', libVar: 'EQUORIA_SCAN_RE_BYPASS_HEADER' },
];

const LIBRARY_REL = 'lib/beta-readiness-scans.sh';

/**
 * Detect an INLINE scan regex copy: a `grep -rn "<...marker...>"` or
 * `grep -rEn "<...marker...>"` whose regex contains `marker`. Tolerates a shell
 * line-continuation between the flags and the opening quote. Returns the
 * matched regex string, or null when no inline copy is present.
 */
export function findInlineGrepRegex(text, marker) {
  const re = new RegExp(
    'grep\\s+-r[A-Za-z]*n[\\s\\\\]+"([^"]*' +
      marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '[^"]*)"'
  );
  const m = re.exec(text);
  return m ? m[1] : null;
}

/**
 * Core single-source assertion. Pure (no I/O) so it is directly unit-testable
 * with planted inputs. Returns an array of human-readable failure strings —
 * empty when the single-source invariant holds.
 */
export function checkSingleSource(scriptText, workflowText, libraryText) {
  const failures = [];

  // 1. The library must define every canonical scan regex variable, and that
  //    definition must contain the scan's marker.
  for (const { name, marker, libVar } of CANONICAL_SCANS) {
    const assign = new RegExp(`${libVar}=['"]([^'"]*)['"]`);
    const m = assign.exec(libraryText);
    if (!m) {
      failures.push(`Shared library is missing the ${name} regex variable ${libVar}=...`);
    } else if (!m[1].includes(marker)) {
      failures.push(
        `Shared library ${libVar} no longer contains the ${name} marker "${marker}":\n  ${libVar}=${m[1]}`
      );
    }
  }

  // 2. Both consumers must source the shared library.
  for (const [label, text] of [
    ['scripts/check-beta-readiness.sh', scriptText],
    ['.github/workflows/test.yml', workflowText],
  ]) {
    if (!text.includes(LIBRARY_REL)) {
      failures.push(`${label} does not source the shared library (${LIBRARY_REL}).`);
    }
  }

  // 3. Neither consumer may contain an INLINE copy of any scan regex — that
  //    would reintroduce the drift hazard the library removed.
  for (const { name, marker } of CANONICAL_SCANS) {
    const scriptInline = findInlineGrepRegex(scriptText, marker);
    const workflowInline = findInlineGrepRegex(workflowText, marker);
    if (scriptInline) {
      failures.push(
        `INLINE COPY — scripts/check-beta-readiness.sh reintroduced an inline ${name} scan regex:\n` +
          `  ${scriptInline}\n` +
          `  Use the shared library function instead (see ${LIBRARY_REL}, ADR-010 / Equoria-iffbt).`
      );
    }
    if (workflowInline) {
      failures.push(
        `INLINE COPY — .github/workflows/test.yml reintroduced an inline ${name} scan regex:\n` +
          `  ${workflowInline}\n` +
          `  Use the shared library function instead (see ${LIBRARY_REL}, ADR-010 / Equoria-iffbt).`
      );
    }
  }

  return failures;
}

function main() {
  const scriptText = fs.readFileSync(SCRIPT, 'utf-8');
  const workflowText = fs.readFileSync(WORKFLOW, 'utf-8');
  const libraryText = fs.readFileSync(LIBRARY, 'utf-8');
  const failures = checkSingleSource(scriptText, workflowText, libraryText);

  if (failures.length > 0) {
    console.error('\nBeta-readiness scan single-source check FAILED:\n');
    for (const f of failures) {
      console.error('  - ' + f.replace(/\n/g, '\n    '));
    }
    console.error(
      '\nThe four canonical beta-readiness static scans must be defined ONCE in' +
        '\nscripts/lib/beta-readiness-scans.sh and sourced by both' +
        '\nscripts/check-beta-readiness.sh and the beta-readiness-gate job in' +
        '\n.github/workflows/test.yml. See docs/architecture/adr-010-ci-inline-' +
        '\nbeta-readiness-scans.md (updated for Equoria-iffbt).'
    );
    process.exit(1);
  }
  process.exit(0);
}

// Run as a CLI only when invoked directly, not when imported by the sentinel test.
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
