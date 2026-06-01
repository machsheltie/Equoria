/**
 * Equoria-ur0y8 — proves the CANONICAL main-module-guard form fires at the
 * entrypoint on THIS platform, and that the legacy string-concat form is
 * broken on Windows (file://C:/... !== file:///C:/...).
 *
 * The CONTRIBUTING.md "CLI Scripts — main-module guard" canonical pattern was
 * documented as:
 *   import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
 * which never matches on Windows: process.argv[1] is `C:\path` (no leading
 * slash), so the template yields `file://C:/path` (TWO slashes), but Node
 * emits import.meta.url as `file:///C:/path` (THREE slashes). The guard never
 * fires → the script silently no-ops as a direct entrypoint.
 *
 * This test spawns a tiny synthetic script as a real child process (the only
 * faithful way to observe argv[1]/import.meta.url as Node populates them at a
 * true entrypoint) and asserts:
 *   - the canonical fileURLToPath(...) === process.argv[1] guard FIRES,
 *   - the legacy `file://${argv[1]}` string form does NOT match here when
 *     the platform yields a three-slash file URL for the absolute path.
 *
 * No DB, no mocks — pure Node runtime behavior.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let scriptDir;
let scriptPath;

beforeAll(() => {
  scriptDir = mkdtempSync(path.join(tmpdir(), 'equoria-guard-'));
  scriptPath = path.join(scriptDir, 'guardProbe.mjs');
  // The probe prints a JSON line describing how each guard form evaluates
  // when the file is the direct entrypoint.
  const probe = [
    "import { fileURLToPath } from 'node:url';",
    'const argv1 = process.argv[1];',
    '// Canonical, cross-platform-correct form:',
    'const canonical = Boolean(argv1) && fileURLToPath(import.meta.url) === argv1;',
    '// Legacy bare string-concat form:',
    'const legacyBare = import.meta.url === `file://${argv1}`;',
    '// Legacy Windows-"safe" replace form (still broken on Win32):',
    "const legacyReplace = import.meta.url === `file://${(argv1 || '').replace(/\\\\/g, '/')}`;",
    'process.stdout.write(JSON.stringify({',
    '  metaUrl: import.meta.url,',
    '  argv1,',
    '  canonical,',
    '  legacyBare,',
    '  legacyReplace,',
    '}));',
  ].join('\n');
  writeFileSync(scriptPath, probe, 'utf8');
});

afterAll(() => {
  if (scriptDir) {
    rmSync(scriptDir, { recursive: true, force: true });
  }
});

describe('Equoria-ur0y8 — main-module guard canonical form', () => {
  test('fileURLToPath(import.meta.url) === process.argv[1] FIRES at the entrypoint', () => {
    const out = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    const result = JSON.parse(out);
    // argv[1] is the absolute path Node was invoked with.
    expect(result.argv1).toBe(scriptPath);
    // The canonical guard must evaluate true when the file is the entrypoint.
    expect(result.canonical).toBe(true);
  });

  test('the legacy string-concat guard does NOT match when argv[1] is the entrypoint on this platform', () => {
    const out = execFileSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    const result = JSON.parse(out);

    if (process.platform === 'win32') {
      // file://C:/... (2 slashes) !== file:///C:/... (3 slashes): the bug.
      expect(result.legacyBare).toBe(false);
      expect(result.legacyReplace).toBe(false);
    } else {
      // On POSIX the bare form happens to work (/abs supplies the 3rd slash);
      // this branch documents that platform-dependence — the canonical form
      // is the only one that is correct EVERYWHERE.
      expect(result.legacyBare).toBe(true);
    }
    // Regardless of platform, the canonical form is correct.
    expect(result.canonical).toBe(true);
  });
});
