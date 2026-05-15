/**
 * Sentinel: GlassPanel has been retired in favor of FrostedPanel (Equoria-ds68)
 *
 * The Celestial-theme migration replaced components/ui/GlassPanel.tsx with
 * components/ui/game/FrostedPanel.tsx. This sentinel test fails if either:
 *
 *   (a) a `GlassPanel.tsx` (or `.ts` / `.jsx` / `.js`) file reappears under
 *       frontend/src, or
 *   (b) any source file under frontend/src imports a symbol named `GlassPanel`.
 *
 * Without this guard, a future PR could silently re-introduce the legacy
 * component name (which has no implementation backing it post-migration) and
 * break consumers at runtime.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC_ROOT = path.resolve(__dirname, '..', '..');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next']);
// We only scan frontend/src/**, so __tests__ for this rule are scanned too —
// excluding this file itself so it doesn't self-match.
const THIS_FILE = path.basename(__filename);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const ALL_SRC_FILES = walk(SRC_ROOT);

describe('GlassPanel retired — no live references (Equoria-ds68)', () => {
  it('no GlassPanel.{ts,tsx,js,jsx} file exists under frontend/src', () => {
    const offenders = ALL_SRC_FILES.filter((f) => /\bGlassPanel\.(tsx?|jsx?)$/.test(f));
    expect(offenders, `Found GlassPanel source file(s): ${offenders.join(', ')}`).toEqual([]);
  });

  it('no source file imports a GlassPanel symbol', () => {
    // Match: `import ... GlassPanel ...` or `from '...GlassPanel'`
    const importRe = /(?:^|\s)import\s[^;]*\bGlassPanel\b|from\s+['"][^'"]*GlassPanel['"]/m;
    const offenders: string[] = [];
    for (const file of ALL_SRC_FILES) {
      if (path.basename(file) === THIS_FILE) continue; // ignore this sentinel
      const content = fs.readFileSync(file, 'utf8');
      if (importRe.test(content)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }
    expect(
      offenders,
      `Found GlassPanel import(s): ${offenders.join(', ')}. ` +
        `GlassPanel was retired in favor of FrostedPanel — see Equoria-ds68.`
    ).toEqual([]);
  });
});
