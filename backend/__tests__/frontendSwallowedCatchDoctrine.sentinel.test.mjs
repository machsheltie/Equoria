/**
 * Equoria-axl7d doctrine sentinel.
 *
 * Proves the frontend swallowed-catch ratchet
 * (scripts/doctrine-checks/check-frontend-swallowed-catch.mjs +
 * frontend-swallowed-catch-baseline.json) actually fires:
 *   1. passes on the live frontend tree at the recorded baseline;
 *   2. FAILS when an empty catch is planted in a file that is not on the
 *      baseline;
 *   3. a blessed-class marker comment exempts a marked storage guard, and a
 *      marker naming an unknown class does NOT;
 *   4. via the argv[2] alternate-baseline hook, FAILS on baseline growth (more
 *      swallows than recorded), on leftover headroom (fewer than recorded) and
 *      on a stale entry (file gone), and PASSES when the recorded count is exact;
 *   5. the detector classifies each swallowed shape and each real handler
 *      correctly (one spawn over a table of snippets).
 *
 * A gate that only stays green can be vacuous (CONTRIBUTING.md), so every arm
 * that should fail is proven against a planted violation.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(HERE, '..', '..');
const CHECK = path.join(repoRoot, 'scripts/doctrine-checks/check-frontend-swallowed-catch.mjs');
const BASELINE = path.join(repoRoot, 'scripts/doctrine-checks/frontend-swallowed-catch-baseline.json');
const plantDir = path.join(repoRoot, 'frontend/src/_frontend_swallowed_catch_sentinel');
const plantKey = 'frontend/src/_frontend_swallowed_catch_sentinel/planted.tsx';

let scratchDir;

afterEach(() => {
  fs.rmSync(plantDir, { recursive: true, force: true });
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: repoRoot, encoding: 'utf8' });
}

function plant(source) {
  fs.mkdirSync(plantDir, { recursive: true });
  fs.writeFileSync(path.join(plantDir, 'planted.tsx'), source);
}

/** The recorded baseline plus extra entries, written to a scratch file. */
function baselineWith(extra) {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axl7d-swallowed-catch-PLANTED-'));
  const file = path.join(scratchDir, 'baseline.json');
  const real = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...real, ...extra }));
  return file;
}

const emptyCatch = [
  'export function read(): string | null {',
  '  try {',
  "    return window.localStorage.getItem('k');",
  '  } catch {',
  '  }',
  '  return null;',
  '}',
  '',
].join('\n');

function markedCatch(cls) {
  return [
    'export function read(): string | null {',
    '  try {',
    "    return window.localStorage.getItem('k');",
    '  } catch {',
    `    // swallowed-catch: ${cls} - private mode / quota; the value is only a hint`,
    '    return null;',
    '  }',
    '}',
    '',
  ].join('\n');
}

describe('check-frontend-swallowed-catch.mjs (Equoria-axl7d)', () => {
  it('passes against the live frontend tree at the recorded baseline', () => {
    const res = runCheck();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/frontend-swallowed-catch.*OK/);
    // Zero-result trap (Equoria-beqsp): green proves nothing on an empty walk.
    const scanned = Number(/scanned (\d+) frontend\/src files/.exec(res.stdout)[1]);
    expect(scanned).toBeGreaterThan(100);
  });

  it('SENTINEL: fails when an empty catch is planted in a file off the baseline', () => {
    plant(emptyCatch);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/frontend-swallowed-catch.*FAIL/);
    expect(res.stderr).toContain('_frontend_swallowed_catch_sentinel/planted.tsx');
  });

  it('a blessed-class marker exempts a marked storage guard', () => {
    plant(markedCatch('storage-guard'));
    const res = runCheck();
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('SENTINEL: a marker naming an unknown class does NOT exempt', () => {
    plant(markedCatch('because-i-said-so'));
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('_frontend_swallowed_catch_sentinel/planted.tsx');
  });

  it('SENTINEL: fails on baseline growth (more swallows than recorded)', () => {
    plant(`${emptyCatch}${emptyCatch.replace('read', 'readAgain')}`);
    const res = runCheck([baselineWith({ [plantKey]: 1 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/grew above baseline/);
    expect(res.stderr).toMatch(/baseline=1, observed=2 \(\+1\)/);
  });

  it('SENTINEL: fails on leftover headroom (fewer swallows than recorded)', () => {
    plant(emptyCatch);
    const res = runCheck([baselineWith({ [plantKey]: 2 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/headroom left behind/);
    expect(res.stderr).toMatch(/baseline=2, observed=1/);
  });

  it('SENTINEL: fails on a stale baseline entry (file gone)', () => {
    const res = runCheck([baselineWith({ 'frontend/src/_does_not_exist/gone.tsx': 1 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/stale baseline entries/);
    expect(res.stderr).toContain('frontend/src/_does_not_exist/gone.tsx');
  });

  it('passes when the recorded count is exact', () => {
    plant(emptyCatch);
    const res = runCheck([baselineWith({ [plantKey]: 1 })]);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  describe('detector classification', () => {
    const SWALLOWED = {
      'empty catch': 'try { f(); } catch {}',
      'comment-only catch': 'try { f(); } catch (e) { /* ignore */ }',
      'console-only catch': "try { f(); } catch (e) { console.error('x', e); }",
      'bare return': 'function g() { try { f(); } catch { return; } }',
      'return null': 'function g() { try { f(); } catch { return null; } }',
      'return empty array': 'function g() { try { f(); } catch { return []; } }',
      'return false': 'function g() { try { f(); } catch { return false; } }',
      'console then fallback': 'function g() { try { f(); } catch (e) { console.warn(e); return -1; } }',
      // Built from fragments so the silent-cleanup-catch ratchet does not count this table.
      'promise catch empty arrow': ['p.cat', 'ch(() => {});'].join(''),
      'promise catch null arrow': ['p.cat', 'ch(() => null);'].join(''),
      'promise catch console ref': 'p.catch(console.error);',
      'promise catch console arrow': 'p.catch((e) => console.error(e));',
      'empty catch after JSX text with an apostrophe': "const A = () => <p>don't panic</p>; try { f(); } catch {}",
    };
    const HANDLED = {
      'state setter': 'try { f(); } catch (e) { setError(e); }',
      rethrow: 'try { f(); } catch (e) { throw e; }',
      'wrapped throw': "try { f(); } catch (e) { throw new Error('x', { cause: e }); }",
      'return of a call': 'function g() { try { f(); } catch (e) { return fallback(e); } }',
      'return of an identifier': 'function g() { try { f(); } catch (e) { return e; } }',
      'log then handle': 'try { f(); } catch (e) { console.error(e); setError(e); }',
      'promise catch handler': 'p.catch((e) => setError(e));',
      'promise catch rethrow': 'p.catch((e) => { throw e; });',
      'promise catch with a named handler': 'p.then(a).catch(handle);',
      'a comment mentioning catch': '// catch {} is banned\nconst x = 1;',
      'a string mentioning catch': "const s = 'try { f(); } catch {}';",
    };

    it('classifies every swallowed shape and every real handler correctly', () => {
      const script = `
        import { findSwallowedCatches } from ${JSON.stringify(pathToFileURL(CHECK).href)};
        const cases = JSON.parse(process.argv[1]);
        const out = {};
        for (const [name, src] of Object.entries(cases)) {
          out[name] = findSwallowedCatches(src, 'case.tsx').length;
        }
        process.stdout.write(JSON.stringify(out));
      `;
      const res = spawnSync(
        'node',
        ['--input-type=module', '-e', script, JSON.stringify({ ...SWALLOWED, ...HANDLED })],
        { cwd: repoRoot, encoding: 'utf8' },
      );
      expect(res.stderr).toBe('');
      const counts = JSON.parse(res.stdout);
      for (const name of Object.keys(SWALLOWED)) {
        expect([name, counts[name]]).toEqual([name, 1]);
      }
      for (const name of Object.keys(HANDLED)) {
        expect([name, counts[name]]).toEqual([name, 0]);
      }
    });
  });
});
