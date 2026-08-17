/**
 * Equoria-z7t3l shadcn-semantic-colors doctrine sentinel.
 *
 * Proves scripts/doctrine-checks/check-no-shadcn-semantic-colors.mjs actually
 * fires (OPTIMAL_FIX_DISCIPLINE §2 — a check without a positive test is a
 * placebo):
 *   1. passes on the current tree (the 6mwia removal left zero occurrences);
 *   2. FAILS when a shadcn CSS var DEFINITION is planted (--primary: …);
 *   3. FAILS when bare shadcn UTILITIES are planted (bg-primary,
 *      text-foreground, border-border, …);
 *   4. FAILS when a shadcn theme color KEY is planted in tailwind.config.ts;
 *   5. NEGATIVE CONTROL: the Celestial forms — text-[var(--text-primary)],
 *      --text-secondary:, .text-role-primary, border-[var(--border-default)]
 *      — do NOT trip it. This is the 437-hit grep-artifact trap documented on
 *      Equoria-6mwia: a naive scan matches the Celestial token names 437
 *      times; this control pins the trap-proofing forever.
 *
 * Plants live in an os.tmpdir() scratch fixture tree passed via the check's
 * argv[2] scan-root hook — nothing is ever planted in the real frontend/src,
 * so concurrent doctrine runs cannot race this suite. Production callers
 * (run-all.sh, CI doctrine-gate) pass no argument and scan the repo.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-shadcn-semantic-colors.mjs');

let scratchRoot;

afterEach(() => {
  if (scratchRoot) {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    scratchRoot = undefined;
  }
});

/** Build a scratch repo-shaped fixture: { 'frontend/src/x.tsx': '…', … }. */
function makeFixture(files) {
  scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'z7t3l-shadcn-PLANTED-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(scratchRoot, ...rel.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  return scratchRoot;
}

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('check-no-shadcn-semantic-colors.mjs (Equoria-z7t3l)', () => {
  it('passes on the current tree — the shadcn semantic color layer is gone and stays gone', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-shadcn-semantic-colors.*OK/);
  });

  it('SENTINEL: FAILS on a planted shadcn CSS var DEFINITION', () => {
    const root = makeFixture({
      'frontend/src/planted.css': ':root {\n  --primary: 222 47% 11%;\n  --card-foreground: 210 40% 98%;\n}\n',
    });
    const res = runCheck([root]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-shadcn-semantic-colors.*FAIL/);
    expect(res.stderr).toContain('shadcn-var-definition');
    expect(res.stderr).toContain('planted.css');
  });

  it('SENTINEL: FAILS on planted bare shadcn UTILITIES (bg-primary / text-foreground / border-border)', () => {
    const root = makeFixture({
      'frontend/src/Planted.tsx':
        'export const P = () => <div className="bg-primary text-foreground border-border hover:bg-accent" />;\n',
    });
    const res = runCheck([root]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shadcn-utility');
    expect(res.stderr).toContain('Planted.tsx');
  });

  it('SENTINEL: FAILS on a planted shadcn var CONSUMPTION (hsl(var(--border)))', () => {
    const root = makeFixture({
      'frontend/src/planted.css': '.thing { color: hsl(var(--border)); background: var(--muted); }\n',
    });
    const res = runCheck([root]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shadcn-var-consumption');
  });

  it('SENTINEL: FAILS on a planted shadcn theme color KEY in tailwind.config.ts', () => {
    const root = makeFixture({
      'frontend/tailwind.config.ts':
        "export default { theme: { extend: { colors: { primary: 'hsl(210 40% 98%)' } } } };\n",
    });
    const res = runCheck([root]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shadcn-config-color-key');
  });

  it('NEGATIVE CONTROL (the 437-hit trap): Celestial forms do NOT trip the check', () => {
    const root = makeFixture({
      // Every documented trap form from Equoria-6mwia, in both tsx and css.
      'frontend/src/Celestial.tsx':
        'export const C = () => (\n' +
        '  <div className="text-[var(--text-primary)] bg-[var(--bg-card)] border-[var(--border-default)] text-role-primary ring-[var(--gold-bright)] focus-visible:ring-2">\n' +
        "    <span style={{ color: 'var(--celestial-primary)', background: 'var(--btn-primary-bg)' }} className=\"text-[var(--text-secondary)] text-[var(--text-muted)]\" />\n" +
        '  </div>\n' +
        ');\n',
      'frontend/src/celestial.css':
        ':root {\n' +
        '  --text-primary: #dcebff;\n' +
        '  --text-secondary: #94a3b8;\n' +
        '  --text-muted: #64748b;\n' +
        '  --border-default: var(--glass-border);\n' +
        '  --celestial-primary: var(--electric-blue-500);\n' +
        '  --btn-primary-bg: var(--gold-primary);\n' +
        '  --discipline-dressage-primary: #7c5cbf;\n' +
        '}\n' +
        '.text-role-primary { color: var(--text-primary); }\n',
      // A Celestial-only tailwind config (font vars, no color keys) passes too.
      'frontend/tailwind.config.ts':
        "export default { theme: { extend: { fontFamily: { body: ['var(--font-body)'] } } } };\n",
    });
    const res = runCheck([root]);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-shadcn-semantic-colors.*OK/);
  });

  it('control: the check module is import-safe (main-module guard holds)', async () => {
    // Importing must not run the scan or call process.exit — the pure
    // detector is importable on its own (CONTRIBUTING.md main-module guard).
    const mod = await import(
      new URL('../../scripts/doctrine-checks/check-no-shadcn-semantic-colors.mjs', import.meta.url)
    );
    expect(typeof mod.scanShadcnSemanticColors).toBe('function');
    // And the detector agrees with the spawned run on the real tree: zero findings.
    expect(mod.scanShadcnSemanticColors()).toEqual([]);
  });
});
