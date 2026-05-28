/**
 * 🔒 Sentinel — _bmad-output/ docs do not assert that tests MUST use bypass
 *    headers (Equoria-sr00q, Constitution §2 + §4)
 *
 * Background: agent-emitted documentation under `_bmad-output/` is not
 * enforced doctrine — but agents READ it as context when starting work,
 * and stale assertions about test infrastructure poison every downstream
 * decision. The _bmad-output/project-context.md and
 * _bmad-output/implementation-artifacts/project-context.md historically
 * told agents:
 *
 *   - "Auth: JWT access + refresh tokens; x-test-bypass-rate-limit header for tests"
 *   - "Rate limiting active — tests must use bypass header"
 *   - "x-test-bypass-rate-limit header required on all test requests"
 *   - "Rate limiting on all endpoints — tests bypass with x-test-bypass-rate-limit header"
 *
 * All four are LIES post-21R. The header is FORBIDDEN. The middleware
 * doesn't implement it. Sentinel tests at
 * `backend/modules/services/__tests__/rate-limit-no-bypass.test.mjs` and
 * `backend/__tests__/middleware/bypassHeaderHardening.test.mjs` enforce
 * its absence. Constitution §2 forbids it. An agent reading the bmad doc
 * would write tests using a forbidden header, fail the sentinels, then
 * blame the wrong layer.
 *
 * This sentinel scans every markdown file under _bmad-output for the
 * OUTDATED ASSERTION phrases (the ones that command agents to USE the
 * bypass header, not the ones that note it is forbidden). Verified via
 * planted-violation: a new "tests must use bypass header" line in any
 * _bmad-output markdown file will trip this gate.
 *
 * Why a jest test rather than a shell doctrine-check:
 *   - No existing docs-freshness shell check to extend (only doctrine
 *     GATES, which are stricter and would break on the legitimate
 *     corrective text). A jest test sits next to similar grep-style
 *     sentinels (noVacuousFeatureWarn, etc.) and runs on every test pass.
 *   - The repo root contains the `_bmad-output/` dir, so the path is
 *     stable; this sentinel does not depend on shell tooling.
 */

import { describe, it, expect } from '@jest/globals';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Repo root is three levels up from backend/__tests__/ .
const REPO_ROOT = resolve(__dirname, '../..');
const BMAD_DIR = join(REPO_ROOT, '_bmad-output');

// Phrases that COMMAND agents to USE the bypass header (the lie shape).
// Each is a verbatim fragment from the pre-fix project-context.md files.
// Match-strings are LITERAL — corrective text using the word "FORBIDDEN"
// or "Constitution §2" is structurally different from these commands and
// will not false-positive.
const OUTDATED_ASSERTIONS = [
  /tests must use bypass header/i,
  /x-test-bypass-rate-limit['"`\s]+header (required on all test|for tests)/i,
  /tests bypass with .?x-test-bypass-rate-limit/i,
];

function walkMd(dir, acc = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkMd(full, acc);
    } else if (entry.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

describe('🔒 Sentinel — _bmad-output bypass-header doc freshness (Equoria-sr00q)', () => {
  const mdFiles = walkMd(BMAD_DIR);

  // Skip self, even though it lives outside _bmad-output — defensive against
  // a future repo restructure that nests this file under there.
  const filesToScan = mdFiles.filter(f => f !== __filename);

  it('discovers _bmad-output markdown files (or the directory is intentionally absent)', () => {
    // The directory may legitimately be empty / removed in a clean repo.
    // Guard the assertion ONLY if it exists — and surface zero-files-scanned
    // as a visible debug, not a silent pass.
    if (existsSync(BMAD_DIR)) {
      expect(filesToScan.length).toBeGreaterThan(0);
    } else {
      // Sentinel becomes a no-op when _bmad-output/ is removed. The other
      // 'it' block below also short-circuits. This is intentional: the
      // doctrine sentinel exists because the dir exists.
      expect(true).toBe(true);
    }
  });

  it('no _bmad-output md file commands agents to USE the x-test-bypass-rate-limit header', () => {
    if (!existsSync(BMAD_DIR)) {
      return;
    }
    const violations = [];
    for (const file of filesToScan) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const re of OUTDATED_ASSERTIONS) {
          if (re.test(line)) {
            const rel = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/');
            violations.push(`${rel}:${i + 1} — ${line.trim()}`);
            break;
          }
        }
      }
    }
    if (violations.length > 0) {
      console.error(
        '[sentinel sr00q] _bmad-output/ md files still command agents to USE ' +
          'a bypass header that is FORBIDDEN per Constitution §2 (rate-limit-no-bypass ' +
          'sentinel enforces its absence). Rewrite the line to describe ' +
          'CURRENT reality (resetAllAuthRateLimits() in beforeEach; bypass ' +
          'headers forbidden + sentinel-enforced). See Equoria-sr00q.\n' +
          violations.map(v => `  - ${v}`).join('\n'),
      );
    }
    expect(violations).toEqual([]);
  });
});
