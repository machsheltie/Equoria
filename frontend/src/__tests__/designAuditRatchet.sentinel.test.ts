/**
 * Design-audit ratchet sentinel (Equoria-o5hub.23, OPTIMAL_FIX_DISCIPLINE §2).
 *
 * Proves the source audit FIRES on a real violation — not merely that it
 * passes when nothing is wrong. Plants a synthetic page file containing a
 * raw palette class + a window.confirm call, runs the audit, and asserts
 * the ratchet fails with both rules exceeded. The planted file is removed
 * in finally; a leaked plant would itself fail the audit everywhere, so
 * the cleanup is self-policing.
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const auditScript = path.join(repoRoot, 'scripts', 'design-audit', 'check-design-system.mjs');
const pagesDir = path.join(repoRoot, 'frontend', 'src', 'pages');

function runAudit(): { status: number; output: string } {
  try {
    const output = execFileSync(process.execPath, [auditScript], { encoding: 'utf8' });
    return { status: 0, output };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('design-system audit ratchet — sentinel', () => {
  it('passes against the current tree (baseline honest)', () => {
    const { status, output } = runAudit();
    expect(output).toContain('[design-audit]');
    expect(status).toBe(0);
  });

  it('FIRES when a planted violation exceeds the baseline', () => {
    const plant = path.join(pagesDir, `__sentinel-plant-${process.pid}.tsx`);
    try {
      // PLANTED-VIOLATION: raw palette class + window.confirm — two rules.
      // Repeated palette lines guarantee exceeding the baseline even if the
      // baseline carries slack for legitimate remaining matches.
      const paletteLines = Array.from(
        { length: 500 },
        (_, i) => `  <span className="text-emerald-400">${i}</span>,`
      ).join('\n');
      writeFileSync(
        plant,
        `export const Plant = () => {\n  if (window.confirm('x')) return null;\n  return [\n${paletteLines}\n  ];\n};\n`
      );

      const { status, output } = runAudit();
      expect(status, 'audit must FAIL with a planted violation').toBe(1);
      expect(output).toContain('RATCHET EXCEEDED');
      expect(output).toMatch(/palette-classes/);
      expect(output).toMatch(/window-confirm/);
    } finally {
      if (existsSync(plant)) rmSync(plant);
    }
  });

  it('expired exceptions fail the audit outright', () => {
    // Verified structurally: the script exits 1 listing expired rows before
    // the ratchet comparison. Plant an expired-exception scenario via a temp
    // registry copy is not possible (path is fixed), so assert the contract
    // at the source level — the expiry gate must precede --write-baseline
    // and the ratchet, and must exit 1.
    const src = execFileSync(
      process.execPath,
      [
        '-e',
        `process.stdout.write(require('node:fs').readFileSync(${JSON.stringify(auditScript)}, 'utf8'))`,
      ],
      { encoding: 'utf8' }
    );
    const expiredIdx = src.indexOf('EXPIRED exception');
    const baselineIdx = src.indexOf("--write-baseline')");
    expect(expiredIdx).toBeGreaterThan(-1);
    expect(src).toMatch(/expired\.length[\s\S]{0,200}process\.exit\(1\)/);
    expect(expiredIdx).toBeLessThan(baselineIdx === -1 ? Infinity : baselineIdx);
  });
});
