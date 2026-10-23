/**
 * Equoria-h1oi6 doctrine sentinel.
 *
 * Proves the rejected-UI-dependency ratchet (a) passes against the live
 * frontend tree at its recorded baseline, and (b) FIRES for EVERY banned
 * package — sonner, recharts, chart.js and react-chartjs-2 — when a fresh
 * import is planted in a file that is NOT on the baseline.
 *
 * Equoria-go70a adds the toast() call-site arms: the same baseline counts calls
 * to sonner's `toast` under "toast()", so a file that already imports sonner
 * cannot grow new call sites, and a removed call cannot bank headroom.
 *
 * (b) is per-package on purpose. A gate that catches sonner and silently
 * misses chart.js is the exact defect Equoria-h1oi6 reports; a single-package
 * proof would not have detected it.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-new-rejected-ui-deps.mjs');
const BASELINE = path.join(HERE, '..', '..', 'scripts/doctrine-checks/rejected-ui-deps-baseline.json');
const PLANT_DIR = path.join(REPO_ROOT, 'frontend/src/_no_new_rejected_ui_deps_sentinel');
const plantKey = 'frontend/src/_no_new_rejected_ui_deps_sentinel/planted.tsx';
const plantFolder = path.join(HERE, '..', '..', 'frontend/src/_no_new_rejected_ui_deps_sentinel');

let scratchDir;

afterEach(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

/** The recorded baseline plus an entry for the planted file, in a scratch file. */
function baselineWithPlant(entry) {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'go70a-rejected-ui-PLANTED-'));
  const file = path.join(scratchDir, 'baseline.json');
  const real = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...real, [plantKey]: entry }));
  return file;
}

function plantFile(lines) {
  fs.mkdirSync(plantFolder, { recursive: true });
  fs.writeFileSync(path.join(plantFolder, 'planted.tsx'), `${lines.join('\n')}\n`);
}

// Fragments keep a future scan of this file itself from matching.
const SONNER = ['son', 'ner'].join('');

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

describe('check-no-new-rejected-ui-deps.mjs toast() call sites (Equoria-go70a)', () => {
  const IMPORT = `import { toast } from '${SONNER}';`;

  it('SENTINEL: fails when a NEW toast() call is added to a file already on the baseline', () => {
    plantFile([IMPORT, "toast.success('a');", "toast.error('b');"]);
    const res = runCheck([baselineWithPlant({ [SONNER]: 1, 'toast()': 1 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/grew above baseline/);
    expect(res.stderr).toMatch(/calls sonner toast\(\)\s+baseline=1, observed=2 \(\+1\)/);
  });

  it('SENTINEL: a bare toast() call and an aliased import both count', () => {
    plantFile([`import { toast as notify } from '${SONNER}';`, "notify('a');", "notify.info('b');"]);
    const res = runCheck([baselineWithPlant({ [SONNER]: 1 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/calls sonner toast\(\)\s+baseline=0, observed=2 \(\+2\)/);
  });

  it('SENTINEL: a removed call cannot bank headroom (fewer calls than recorded fails)', () => {
    plantFile([IMPORT, "toast.success('a');"]);
    const res = runCheck([baselineWithPlant({ [SONNER]: 1, 'toast()': 3 })]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/headroom left behind/);
    expect(res.stderr).toMatch(/'toast\(\)'\s+baseline=3, observed=1/);
  });

  it('passes when the recorded call count is exact', () => {
    plantFile([IMPORT, "toast.success('a');", "toast.error('b');"]);
    const res = runCheck([baselineWithPlant({ [SONNER]: 1, 'toast()': 2 })]);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });

  it('does not count a local function that happens to be named toast', () => {
    plantFile([
      `import { Toaster } from '${SONNER}';`,
      'const toast = (m: string) => m;',
      "toast('a');",
      'export const el = Toaster;',
    ]);
    const res = runCheck([baselineWithPlant({ [SONNER]: 1 })]);
    expect(res.stderr).toBe('');
    expect(res.status).toBe(0);
  });
});
