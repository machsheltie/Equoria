/**
 * Equoria-h1oi6 doctrine sentinel.
 *
 * Proves the rejected-UI-dependency ratchet (a) passes against the live
 * frontend tree at its recorded baseline, and (b) FIRES for EVERY banned
 * package — sonner, recharts, chart.js and react-chartjs-2 — when a fresh
 * import is planted in a file that is NOT on the baseline.
 *
 * (b) is per-package on purpose. A gate that catches sonner and silently
 * misses chart.js is the exact defect Equoria-h1oi6 reports; a single-package
 * proof would not have detected it.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-new-rejected-ui-deps.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'frontend/src/_no_new_rejected_ui_deps_sentinel');

afterEach(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

// Specifiers are assembled from fragments so that a future scan of this
// sentinel's OWN file can never be what trips the gate — the planted file is.
const CASES = [
  { name: 'sonner', pkg: ['son', 'ner'].join(''), source: "import { toast } from '%s';" },
  { name: 'recharts', pkg: ['re', 'charts'].join(''), source: "import { LineChart } from '%s';" },
  {
    name: 'chart.js (subpath import)',
    pkg: ['chart', '.js/auto'].join(''),
    source: "import Chart from '%s';",
  },
  {
    name: 'react-chartjs-2 (dynamic import)',
    pkg: ['react-', 'chartjs-2'].join(''),
    source: "export const load = () => import('%s');",
  },
];

describe('check-no-new-rejected-ui-deps.mjs (Equoria-h1oi6)', () => {
  it('passes against the live frontend tree at the recorded baseline', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-new-rejected-ui-deps.*OK/);
    // Guard the zero-result trap (Equoria-beqsp): a green exit proves nothing
    // if the scan walked an empty file set.
    expect(res.stdout).toMatch(/scanned (\d+) frontend\/src files/);
    const scanned = Number(/scanned (\d+) frontend\/src files/.exec(res.stdout)[1]);
    expect(scanned).toBeGreaterThan(100);
  });

  for (const c of CASES) {
    it(`SENTINEL: fails when a NEW ${c.name} import is planted`, () => {
      fs.mkdirSync(PLANT_DIR, { recursive: true });
      const planted = path.join(PLANT_DIR, 'planted.tsx');
      fs.writeFileSync(
        planted,
        [
          '// PLANTED by noNewRejectedUiDepsDoctrine.sentinel.test.mjs (Equoria-h1oi6).',
          '// If this file lands on master you have a bigger problem than this test.',
          c.source.replace('%s', c.pkg),
          '',
        ].join('\n'),
      );

      const res = runCheck();
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/no-new-rejected-ui-deps.*FAIL/);
      expect(res.stderr).toContain('_no_new_rejected_ui_deps_sentinel/planted.tsx');
      // The failure must NAME the package, not just report "a banned import".
      expect(res.stderr).toContain(c.pkg.split('/')[0]);
    });
  }
});
