/**
 * Sentinel for scripts/doctrine-checks/check-jest-memory-budget.mjs
 * (user directive 2026-08-18 — jest runs must never OOM-brick the laptop).
 *
 * OPTIMAL_FIX_DISCIPLINE §2: a check without a positive test is a placebo.
 * This suite proves the doctrine check
 *   1. PASSES on the current tree (all live jest configs + scripts compliant),
 *   2. FIRES on a planted config that re-introduces each defect class
 *      (percentage maxWorkers, missing workerIdleMemoryLimit, missing
 *      forceExit, resetMocks/resetModules off, hardcoded detectOpenHandles),
 *   3. PASSES on a planted fully-compliant config (the detector is not
 *      vacuously red),
 *   4. (Equoria-5mtzl) FIRES on a planted jest SPAWNER script that launches
 *      jest over the 1536MB heap budget (or with no heap cap at all), and
 *      PASSES on one carrying the explicit allowlist marker
 *      `// doctrine-allow: jest-heap-exception Equoria-<id> <reason>`.
 *
 * Cross-cutting doctrine sentinel — lives in backend/__tests__/ per the
 * module-test co-location convention (no single module owns it).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-jest-memory-budget.mjs');

function runCheck(args = []) {
  const result = spawnSync(process.execPath, [CHECK, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    // The check itself deletes DETECT_OPEN_HANDLES before importing configs;
    // pass the env through unchanged so we exercise that path.
    env: { ...process.env },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

describe('jest memory-budget doctrine check (sentinel)', () => {
  let scratchDir;

  beforeAll(() => {
    scratchDir = mkdtempSync(path.join(tmpdir(), 'jest-budget-sentinel-'));
  });

  afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  test('PASSES on the current tree (all live configs and scripts compliant)', () => {
    const { status, stdout, stderr } = runCheck();
    expect(stderr).toBe('');
    expect(stdout).toContain('[jest-memory-budget] PASS');
    expect(status).toBe(0);
  });

  test('FIRES on a PLANTED-VIOLATION config re-introducing the defect classes', () => {
    const planted = path.join(scratchDir, 'jest.config.planted-violation.mjs');
    writeFileSync(
      planted,
      // PLANTED VIOLATION (sentinel-positive): the exact pre-2026-08-18
      // shape that OOM-bricked the laptop. Never copy into a real config.
      [
        'export default {',
        "  maxWorkers: '50%',", // percentage allocation — forbidden
        '  clearMocks: true,',
        '  resetMocks: false,', // hygiene off — forbidden
        '  restoreMocks: true,',
        '  resetModules: false,', // hygiene off — forbidden
        '  detectOpenHandles: true,', // hardcoded — forbidden (implies runInBand)
        '  // no workerIdleMemoryLimit, no forceExit',
        '};',
        '',
      ].join('\n'),
    );

    const { status, stderr } = runCheck([planted]);
    expect(status).toBe(1);
    expect(stderr).toContain('maxWorkers must be an integer <= 2');
    expect(stderr).toContain('workerIdleMemoryLimit must be set');
    expect(stderr).toContain('forceExit must be true');
    expect(stderr).toContain('resetMocks must be true');
    expect(stderr).toContain('resetModules must be true');
    expect(stderr).toContain('detectOpenHandles must not be hardcoded true');
  });

  test('PASSES on a planted fully-compliant config (detector is not vacuously red)', () => {
    const planted = path.join(scratchDir, 'jest.config.planted-compliant.mjs');
    writeFileSync(
      planted,
      [
        'export default {',
        '  maxWorkers: 2,',
        "  workerIdleMemoryLimit: '512MB',",
        '  forceExit: true,',
        '  clearMocks: true,',
        '  resetMocks: true,',
        '  restoreMocks: true,',
        '  resetModules: true,',
        "  detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true',",
        '};',
        '',
      ].join('\n'),
    );

    const { status, stdout, stderr } = runCheck([planted]);
    expect(stderr).toBe('');
    expect(stdout).toContain('[jest-memory-budget] PASS');
    expect(status).toBe(0);
  });

  // Equoria-5mtzl: spawner-script scan — .mjs files under scripts/ and
  // backend/scripts/ that launch the jest binary via child_process.
  describe('jest spawner scripts (Equoria-5mtzl)', () => {
    const spawnerLines = heapArg => [
      "import { spawn } from 'node:child_process';",
      "import path from 'node:path';",
      'const jestArgs = [',
      "  '--experimental-vm-modules',",
      ...(heapArg ? [`  '${heapArg}',`] : []),
      "  path.join('node_modules', 'jest', 'bin', 'jest.js'),",
      "  '--runInBand',",
      '];',
      'spawn(process.execPath, jestArgs);',
      '',
    ];

    test('FIRES on a PLANTED spawner launching jest above the 1536MB heap budget', () => {
      const planted = path.join(scratchDir, 'planted-overcap-spawner.mjs');
      // PLANTED VIOLATION (sentinel-positive): 8192MB spawn with NO
      // doctrine-allow marker. Never copy into a real script.
      writeFileSync(planted, spawnerLines('--max-old-space-size=8192').join('\n'));

      const { status, stderr } = runCheck(['--spawner', planted]);
      expect(status).toBe(1);
      expect(stderr).toContain('--max-old-space-size=8192, above the 1536MB budget');
    });

    test('FIRES on a PLANTED spawner launching jest with no heap cap at all', () => {
      const planted = path.join(scratchDir, 'planted-capless-spawner.mjs');
      // PLANTED VIOLATION (sentinel-positive): jest spawn with no
      // --max-old-space-size= anywhere in the file.
      writeFileSync(planted, spawnerLines(null).join('\n'));

      const { status, stderr } = runCheck(['--spawner', planted]);
      expect(status).toBe(1);
      expect(stderr).toContain('no --max-old-space-size= heap ceiling');
    });

    test('PASSES on a planted spawner carrying the doctrine-allow marker (the exception channel works)', () => {
      const planted = path.join(scratchDir, 'planted-allowlisted-spawner.mjs');
      writeFileSync(
        planted,
        [
          '// doctrine-allow: jest-heap-exception Equoria-5mtzl diagnostic headroom (sentinel fixture)',
          ...spawnerLines('--max-old-space-size=8192'),
        ].join('\n'),
      );

      const { status, stdout, stderr } = runCheck(['--spawner', planted]);
      expect(stderr).toBe('');
      expect(stdout).toContain('[jest-memory-budget] PASS');
      expect(status).toBe(0);
    });
  });
});
