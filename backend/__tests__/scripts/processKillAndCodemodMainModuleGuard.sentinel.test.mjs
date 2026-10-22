/**
 * Equoria-r13ay / Equoria-8hweb — scripts that kill processes or rewrite
 * source files in place must run only when they are the entry point.
 *
 * destructiveScriptsMainModuleGuard.sentinel.test.mjs (Equoria-5z0if) only
 * recognises Prisma writes, DDL and `prisma migrate`. Two other destructive
 * classes slipped past it, and each shipped unguarded:
 *
 *   1. Process killers. backend/scripts/reap-orphan-jest.mjs ran a
 *      `Stop-Process -Force` sweep at module top level, so a parse-check
 *      `node -e "import('./scripts/reap-orphan-jest.mjs')"` killed real
 *      processes (Equoria-r13ay).
 *   2. In-place source codemods. sweep-test-fixture-uuids.mjs,
 *      sweep-uuid-to-hex.mjs and fix-broken-imports.mjs read a test file and
 *      write it back at module top level, so a bare import rewrote the tests
 *      (Equoria-8hweb).
 *
 * This sentinel scans backend/scripts/*.mjs for those two classes and requires
 * the canonical Windows-safe guard
 * `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])`.
 * A library module (it has an `export`) is exempt: importing it is its job and
 * it performs no work at import time.
 *
 * It proves its own detectors fire on planted violations as well as pass on
 * compliant code. Pure static analysis: it never imports or runs a script,
 * since importing an unguarded one is exactly the incident.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const scriptsDir = path.join(repoRoot, 'backend', 'scripts');

const processKillPatterns = [/Stop-Process/, /taskkill/i, /process\.kill\s*\(/];

/** Strip comments so documentation that merely mentions an operation cannot fire. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function killsProcesses(source) {
  const code = stripComments(source);
  return processKillPatterns.some(pattern => pattern.test(code));
}

/**
 * True when the same identifier is read with readFileSync and written back with
 * writeFileSync: an in-place rewrite of whatever file that identifier names.
 */
function rewritesFilesInPlace(source) {
  const code = stripComments(source);
  for (const read of code.matchAll(/readFileSync\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
    const target = read[1].replace(/[$]/g, '\\$');
    if (new RegExp(`writeFileSync\\(\\s*${target}\\s*,`).test(code)) {
      return true;
    }
  }
  return false;
}

const mainGuardPatterns = [
  /fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*===\s*process\.argv\[1\]/,
  /fileURLToPath\s*\(\s*import\.meta\.url\s*\)\s*===\s*path\.resolve\s*\(\s*process\.argv\[1\]\s*\)/,
  /import\.meta\.url\s*===\s*pathToFileURL\s*\(\s*process\.argv\[1\]\s*\)\s*\.href/,
];

function hasMainModuleGuard(source) {
  return mainGuardPatterns.some(pattern => pattern.test(source));
}

function isLibraryModule(source) {
  return /^export\s/m.test(stripComments(source));
}

function needsGuard(source) {
  return !isLibraryModule(source) && (killsProcesses(source) || rewritesFilesInPlace(source));
}

describe('process-kill and in-place codemod scripts need a main-module guard (Equoria-r13ay, Equoria-8hweb)', () => {
  test('PLANTED VIOLATION: an unguarded process killer is detected', () => {
    const planted = `
      import { execFileSync } from 'node:child_process';
      execFileSync('powershell.exe', ['-Command', 'Stop-Process -Id 1 -Force']);
    `;
    expect(killsProcesses(planted)).toBe(true);
    expect(needsGuard(planted)).toBe(true);
    expect(hasMainModuleGuard(planted)).toBe(false);
  });

  test('PLANTED VIOLATION: an unguarded in-place codemod is detected', () => {
    const planted = `
      import { readFileSync, writeFileSync } from 'node:fs';
      for (const file of ['a.mjs']) {
        const text = readFileSync(file, 'utf8');
        writeFileSync(file, text.replace('x', 'y'), 'utf8');
      }
    `;
    expect(rewritesFilesInPlace(planted)).toBe(true);
    expect(needsGuard(planted)).toBe(true);
    expect(hasMainModuleGuard(planted)).toBe(false);
  });

  test('NEGATIVE CONTROL: the canonical guard satisfies the detector', () => {
    const guarded = `
      import { fileURLToPath } from 'node:url';
      function main() { process.kill(1); }
      if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
        main();
      }
    `;
    expect(needsGuard(guarded)).toBe(true);
    expect(hasMainModuleGuard(guarded)).toBe(true);
  });

  test('NEGATIVE CONTROL: reading one file and writing a different one is not an in-place rewrite', () => {
    const generator = `
      import { readFileSync, writeFileSync } from 'node:fs';
      const results = readFileSync(input, 'utf8');
      writeFileSync(output, results);
    `;
    expect(rewritesFilesInPlace(generator)).toBe(false);
  });

  test('NEGATIVE CONTROL: comment-only mentions do not fire, and library modules are exempt', () => {
    expect(killsProcesses('// Stop-Process is mentioned in a comment only\nexport const x = 1;')).toBe(false);
    expect(needsGuard('export function stop() { process.kill(1); }')).toBe(false);
  });

  test('every backend/scripts/*.mjs that kills processes or rewrites files in place has a main-module guard', () => {
    const scripts = fs.readdirSync(scriptsDir).filter(name => name.endsWith('.mjs') && !name.endsWith('.test.mjs'));
    expect(scripts.length).toBeGreaterThan(10);

    // The scripts that motivated this sentinel must still be in its scope, so
    // deleting a detector pattern cannot silently drop them.
    const covered = scripts.filter(name => needsGuard(fs.readFileSync(path.join(scriptsDir, name), 'utf8')));
    expect(covered).toEqual(
      expect.arrayContaining([
        'reap-orphan-jest.mjs',
        'sweep-test-fixture-uuids.mjs',
        'sweep-uuid-to-hex.mjs',
        'fix-broken-imports.mjs',
      ]),
    );

    const unguarded = covered.filter(name => !hasMainModuleGuard(fs.readFileSync(path.join(scriptsDir, name), 'utf8')));
    expect(unguarded).toEqual([]);
  });
});
