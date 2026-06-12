/**
 * Sentinel test (Equoria-lq5li): utils/agent-skills/auditor.mjs must FAIL LOUD.
 *
 * Root cause this guards against: the prior auditor shelled out to ripgrep via
 * spawnSync and, on EPERM (rg missing / Windows perms) or any non-zero rg exit,
 * swallowed the failure and reported NOTHING while exiting 0 — a false-green
 * security scanner. A scanner that silently produces empty results is worse
 * than none (CLAUDE.md Sections 2/3, EDGE_CASE_FIX_DISCIPLINE Section 3 fail-closed).
 *
 * The rewrite is a deterministic Node-native fs walk (no shell-out). These
 * tests prove BOTH halves of the contract:
 *   1. A scan FAILURE (root missing, or a real read fault during the walk)
 *      makes the process exit NONZERO, never a "Clean" report. Proven
 *      end-to-end via a subprocess AND directly via runScan() throwing.
 *   2. A scan that SUCCEEDS still detects planted violations (secret, bypass
 *      flag, console.log) — the fail-loud rewrite did not blind the scanner.
 *      A failure-only test could pass against a scanner that flags everything;
 *      this positive proves real detection.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runScan, main } from '../../utils/agent-skills/auditor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const AUDITOR = join(PROJECT_ROOT, 'utils', 'agent-skills', 'auditor.mjs');
const MISSING_DIR = './this-directory-truly-does-not-exist-lq5li';

function runAuditorCli(arg) {
  return spawnSync(process.execPath, [AUDITOR, arg], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('auditor — fail-loud on scan failure (Equoria-lq5li)', () => {
  test('CLI exits nonzero (not silent-clean) when the scan target does not exist', () => {
    const result = runAuditorCli(MISSING_DIR);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('AUDITOR SCAN FAILED');
    // Must NOT have printed a clean/empty report — that is the false-green bug.
    expect(result.stdout).not.toContain('Clean: No instances');
    expect(result.stdout).not.toContain('CODEBASE AUDITOR REPORT');
  });

  test('CLI exits nonzero when the walk hits a real read fault (root is a file, ENOTDIR)', () => {
    // existsSync(file) is true, so this gets PAST the missing-root guard and
    // only fails inside the directory walk — proving a genuine mid-scan fault
    // is not swallowed into an empty "Clean" result.
    const result = runAuditorCli(AUDITOR);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('AUDITOR SCAN FAILED');
    expect(result.stdout).not.toContain('Clean: No instances');
  });

  test('runScan() throws on a missing root rather than returning empty results', () => {
    expect(() => runScan(MISSING_DIR)).toThrow(/does not exist/i);
  });

  test('main() sets a nonzero exit code on scan failure', () => {
    const prevExitCode = process.exitCode;
    try {
      const rc = main(['node', 'auditor.mjs', MISSING_DIR]);
      expect(rc).not.toBe(0);
      expect(process.exitCode).not.toBe(0);
    } finally {
      // Restore so a deliberate failure injection here does not fail the suite.
      process.exitCode = prevExitCode;
    }
  });
});

describe('auditor — positive detection on a clean (successful) scan', () => {
  let tmp;

  afterEach(() => {
    if (tmp) {
      rmSync(tmp, { recursive: true, force: true });
      tmp = undefined;
    }
  });

  test('detects a planted hardcoded secret, bypass flag, and console.log', () => {
    tmp = mkdtempSync(join(tmpdir(), 'auditor-positive-lq5li-'));
    writeFileSync(
      join(tmp, 'planted.mjs'),
      [
        'const API_KEY = "abc123hardcodedsecret";',
        'request.headers["x-test-bypass-auth"] = "1";',
        'console.log("debug noise left behind");',
        '',
      ].join('\n')
    );

    const results = runScan(tmp);

    const secrets = results.get('Potential hardcoded secrets');
    const bypass = results.get('Test-bypass / E2E-bypass flags');
    const consoleNoise = results.get('console.log (hygiene)');

    expect(secrets.length).toBeGreaterThan(0);
    expect(bypass.length).toBeGreaterThan(0);
    expect(consoleNoise.length).toBeGreaterThan(0);
    expect(secrets[0]).toContain('API_KEY');
    expect(bypass[0]).toContain('x-test-bypass-auth');
  });

  test('reports a genuinely clean directory as clean WITHOUT failing', () => {
    tmp = mkdtempSync(join(tmpdir(), 'auditor-clean-lq5li-'));
    writeFileSync(join(tmp, 'ok.mjs'), 'export const add = (a, b) => a + b;\n');

    const results = runScan(tmp);

    for (const hits of results.values()) {
      expect(hits).toEqual([]);
    }
  });
});
