/**
 * Sentinel for scripts/doctrine-checks/check-playwright-workers-budget.mjs
 * (Equoria-ya5wn — Playwright local workers must stay within the laptop
 * budget; user directive 2026-08-18).
 *
 * OPTIMAL_FIX_DISCIPLINE §2: a check without a positive test is a placebo.
 * This suite proves the doctrine check
 *   1. PASSES on the current tree (both live playwright configs pinned),
 *   2. FIRES on planted configs re-introducing each defect class
 *      (the exact `CI ? 1 : undefined` fall-through that shipped, a missing
 *      workers property, an over-cap literal, a percentage allocation),
 *   3. PASSES on a planted compliant config and on the doctrine-allow
 *      exception channel (the detector is not vacuously red).
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
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-playwright-workers-budget.mjs');

function runCheck(args = []) {
  const result = spawnSync(process.execPath, [CHECK, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function plantedConfig(workersLine) {
  return [
    "import { defineConfig } from '@playwright/test';",
    'export default defineConfig({',
    "  testDir: './tests/e2e',",
    '  fullyParallel: true,',
    ...(workersLine ? [`  ${workersLine}`] : ['  // no workers property at all']),
    '  retries: 0,',
    '});',
    '',
  ].join('\n');
}

describe('playwright workers-budget doctrine check (sentinel)', () => {
  let scratchDir;

  beforeAll(() => {
    scratchDir = mkdtempSync(path.join(tmpdir(), 'playwright-workers-sentinel-'));
  });

  afterAll(() => {
    rmSync(scratchDir, { recursive: true, force: true });
  });

  test('PASSES on the current tree (both live playwright configs pinned)', () => {
    const { status, stdout, stderr } = runCheck();
    expect(stderr).toBe('');
    expect(stdout).toContain('[playwright-workers-budget] PASS');
    expect(status).toBe(0);
  });

  test('FIRES on the PLANTED `CI ? 1 : undefined` fall-through that actually shipped', () => {
    const planted = path.join(scratchDir, 'playwright.planted-undefined.config.ts');
    // PLANTED VIOLATION (sentinel-positive): the exact pre-Equoria-ya5wn
    // shape — unbounded local workers. Never copy into a real config.
    writeFileSync(planted, plantedConfig('workers: process.env.CI ? 1 : undefined,'));

    const { status, stderr } = runCheck([planted]);
    expect(status).toBe(1);
    expect(stderr).toContain("contains 'undefined'");
  });

  test('FIRES on a PLANTED config with no workers property at all', () => {
    const planted = path.join(scratchDir, 'playwright.planted-missing.config.ts');
    writeFileSync(planted, plantedConfig(null));

    const { status, stderr } = runCheck([planted]);
    expect(status).toBe(1);
    expect(stderr).toContain("no 'workers:' setting");
  });

  test('FIRES on a PLANTED over-cap literal and a percentage allocation', () => {
    const overCap = path.join(scratchDir, 'playwright.planted-overcap.config.ts');
    writeFileSync(overCap, plantedConfig('workers: 8,'));
    const overCapRun = runCheck([overCap]);
    expect(overCapRun.status).toBe(1);
    expect(overCapRun.stderr).toContain('contains 8, above the laptop cap of 2');

    const percentage = path.join(scratchDir, 'playwright.planted-percentage.config.ts');
    writeFileSync(percentage, plantedConfig("workers: '50%',"));
    const percentageRun = runCheck([percentage]);
    expect(percentageRun.status).toBe(1);
    expect(percentageRun.stderr).toContain('percentage allocation');
  });

  test('PASSES on a planted compliant config (detector is not vacuously red)', () => {
    const planted = path.join(scratchDir, 'playwright.planted-compliant.config.ts');
    writeFileSync(planted, plantedConfig('workers: process.env.CI ? 1 : 2,'));

    const { status, stdout, stderr } = runCheck([planted]);
    expect(stderr).toBe('');
    expect(stdout).toContain('[playwright-workers-budget] PASS');
    expect(status).toBe(0);
  });

  test('PASSES on a planted config carrying the doctrine-allow marker (the exception channel works)', () => {
    const planted = path.join(scratchDir, 'playwright.planted-allowlisted.config.ts');
    writeFileSync(
      planted,
      [
        '// doctrine-allow: playwright-workers-exception Equoria-ya5wn sentinel fixture',
        plantedConfig('workers: process.env.CI ? 1 : undefined,'),
      ].join('\n'),
    );

    const { status, stdout, stderr } = runCheck([planted]);
    expect(stderr).toBe('');
    expect(stdout).toContain('[playwright-workers-budget] PASS');
    expect(status).toBe(0);
  });
});
