/**
 * Sentinel for scripts/doctrine-checks/check-vitest-memory-budget.mjs
 * (Equoria-7br8i — frontend Vitest runs must never OOM-brick the laptop,
 * mirroring the 2026-08-18 jest memory-budget hardening).
 *
 * OPTIMAL_FIX_DISCIPLINE §2: a check without a positive test is a placebo.
 * This suite proves the doctrine check
 *   1. PASSES on the current tree (frontend/vitest.config.ts + all vitest
 *      scripts compliant),
 *   2. FIRES on a planted config that re-introduces each defect class
 *      (over-cap maxWorkers on a node-pool project, missing execArgv heap
 *      ceiling, browser project with no maxWorkers — the exact
 *      pre-Equoria-7br8i shape — plus a hardcoded hanging-process reporter),
 *   3. PASSES on a planted fully-compliant config (the detector is not
 *      vacuously red), including the sanctioned CI-headroom heap template,
 *   4. Ignores commented-out settings (comment stripping is real, so a
 *      commented `maxWorkers: 2` cannot satisfy the check).
 *
 * Cross-cutting doctrine sentinel — lives in backend/__tests__/ per the
 * house pattern (jestMemoryBudgetDoctrine.sentinel.test.mjs): the doctrine
 * suite is exercised from the backend jest run regardless of which stack
 * the guarded config belongs to.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-vitest-memory-budget.mjs');

function runCheck(args = []) {
  const result = spawnSync(process.execPath, [CHECK, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('vitest memory-budget doctrine check (sentinel)', () => {
  let scratchDir;

  beforeAll(() => {
    scratchDir = mkdtempSync(path.join(tmpdir(), 'vitest-budget-sentinel-'));
  });

  afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  test('PASSES on the current tree (live vitest config and scripts compliant)', () => {
    const { status, stdout, stderr } = runCheck();
    expect(stderr).toBe('');
    expect(stdout).toContain('[vitest-memory-budget] PASS');
    expect(status).toBe(0);
  });

  test('FIRES on a PLANTED-VIOLATION config re-introducing the defect classes', () => {
    const planted = path.join(scratchDir, 'vitest.config.planted-violation.ts');
    writeFileSync(
      planted,
      // PLANTED VIOLATION (sentinel-positive): the exact pre-Equoria-7br8i
      // shape — 4 unbounded-heap forks + an uncapped browser pool that
      // defaults to min(12, cpus - 1) chromium page-workers. Never copy
      // into a real config.
      [
        "import { defineConfig } from 'vite';",
        'export default defineConfig({',
        '  test: {',
        "    reporters: ['default', 'hanging-process'],", // hardcoded heavy diagnostic — forbidden
        '    projects: [',
        '      {',
        '        extends: true,',
        '        test: {',
        "          pool: 'forks',",
        '          maxWorkers: 4,', // over cap — forbidden
        '          isolate: true,',
        '          // no execArgv heap ceiling — forbidden',
        '        },',
        '      },',
        '      {',
        '        extends: true,',
        '        test: {',
        "          name: 'storybook',",
        '          browser: { enabled: true, headless: true },',
        '          // no maxWorkers — browser pool default applies, forbidden',
        '        },',
        '      },',
        '    ],',
        '  },',
        '});',
        '',
      ].join('\n'),
    );

    const { status, stderr } = runCheck([planted]);
    expect(status).toBe(1);
    expect(stderr).toContain('maxWorkers must be a literal integer <= 2');
    expect(stderr).toContain('missing execArgv --max-old-space-size= heap ceiling');
    expect(stderr).toContain("(project 'storybook'): missing maxWorkers");
    expect(stderr).toContain("'hanging-process' reporter must not be hardcoded");
  });

  test('PASSES on a planted fully-compliant config (detector is not vacuously red)', () => {
    const planted = path.join(scratchDir, 'vitest.config.planted-compliant.ts');
    writeFileSync(
      planted,
      [
        "import { defineConfig } from 'vite';",
        'export default defineConfig({',
        '  test: {',
        '    projects: [',
        '      {',
        '        extends: true,',
        '        test: {',
        "          pool: 'forks',",
        '          maxWorkers: 2,',
        // The sanctioned CI-headroom template — must be accepted.
        '          execArgv: [`--max-old-space-size=${process.env.CI ? 4096 : 1536}`],',
        '          isolate: true,',
        '        },',
        '      },',
        '      {',
        '        extends: true,',
        '        test: {',
        "          name: 'storybook',",
        '          browser: { enabled: true, headless: true },',
        '          maxWorkers: 2,',
        '        },',
        '      },',
        '    ],',
        '  },',
        '});',
        '',
      ].join('\n'),
    );

    const { status, stdout, stderr } = runCheck([planted]);
    expect(stderr).toBe('');
    expect(stdout).toContain('[vitest-memory-budget] PASS');
    expect(status).toBe(0);
  });

  test('a commented-out maxWorkers cannot satisfy the check (comment stripping is real)', () => {
    const planted = path.join(scratchDir, 'vitest.config.planted-commented.ts');
    writeFileSync(
      planted,
      [
        "import { defineConfig } from 'vite';",
        'export default defineConfig({',
        '  test: {',
        "    pool: 'forks',",
        '    // maxWorkers: 2,', // commented out — must NOT count
        '    /* execArgv: ["--max-old-space-size=1536"], */', // commented out — must NOT count
        '  },',
        '});',
        '',
      ].join('\n'),
    );

    const { status, stderr } = runCheck([planted]);
    expect(status).toBe(1);
    expect(stderr).toContain('missing maxWorkers');
    expect(stderr).toContain('missing execArgv --max-old-space-size= heap ceiling');
  });
});
