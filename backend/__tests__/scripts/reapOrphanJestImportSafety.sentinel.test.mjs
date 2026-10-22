/**
 * Equoria-r13ay / Equoria-try0h — behaviour sentinels for the orphan-jest
 * reaper (backend/scripts/reap-orphan-jest.mjs).
 *
 *  - Equoria-r13ay: importing the reaper (a parse-check) must NOT sweep. The
 *    sweep kills processes machine-wide, so it may run only as the entry point.
 *  - Equoria-try0h: with exactly one orphan the reaper must still print its
 *    "Killed N" line. PowerShell unrolled a single match to a scalar whose
 *    absent `.Count` read as $null, so the line was silently skipped although
 *    Stop-Process had fired. reapOrphanJest.sentinel.test.mjs (Equoria-fbk1q)
 *    documents that it cannot assert the line; this file does.
 *
 * Fixtures follow the fbk1q pattern: a detached node process whose command line
 * contains 'jest' and whose parent has exited. Every assertion targets the
 * exact PID this file spawned, and everything it spawned is killed in afterAll.
 * The reaper is win32-only by design, so the behaviour cases are gated on the
 * same platform check the script itself uses.
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, test, expect, afterAll } from '@jest/globals';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REAPER_PATH = path.join(BACKEND_DIR, 'scripts', 'reap-orphan-jest.mjs');

const MARKER_IMPORT = 'equoria-r13ay-jest-lookalike-orphan-import';
const MARKER_COUNT = 'equoria-try0h-jest-lookalike-orphan-count';
const LOOKALIKE_EVAL = 'setTimeout(() => {}, 120000)';

const spawnedPids = new Set();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

async function pollUntil(predicate, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await sleep(intervalMs);
  }
  return predicate();
}

/** An intermediate node process launches the lookalike detached and exits, orphaning it. */
function spawnOrphan(marker) {
  const intermediateSrc = `
import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', ${JSON.stringify(LOOKALIKE_EVAL)}, ${JSON.stringify(marker)}], {
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});
child.unref();
process.stdout.write(String(child.pid));
`;
  return new Promise((resolve, reject) => {
    const intermediate = spawn(process.execPath, ['--input-type=module', '-e', intermediateSrc], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let out = '';
    intermediate.stdout.on('data', chunk => {
      out += chunk;
    });
    intermediate.on('error', reject);
    intermediate.on('exit', code => {
      const pid = Number.parseInt(out.trim(), 10);
      if (code === 0 && Number.isInteger(pid) && pid > 0) {
        spawnedPids.add(pid);
        resolve(pid);
      } else {
        reject(new Error(`orphan intermediate failed: code=${code} stdout=${JSON.stringify(out)}`));
      }
    });
  });
}

afterAll(() => {
  for (const pid of spawnedPids) {
    try {
      process.kill(pid);
    } catch {
      // already dead: the desired end state
    }
  }
});

const describeWin32 = process.platform === 'win32' ? describe : describe.skip;

describeWin32('reap-orphan-jest behaviour (Equoria-r13ay, Equoria-try0h)', () => {
  test('a bare import does not sweep: the orphaned jest-lookalike survives', async () => {
    const orphanPid = await spawnOrphan(MARKER_IMPORT);
    expect(isAlive(orphanPid)).toBe(true);

    const res = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(REAPER_PATH).href)});`],
      { cwd: BACKEND_DIR, encoding: 'utf8', timeout: 90000, windowsHide: true },
    );
    expect(res.status).toBe(0);

    // The sweep, were it to run, completes inside the import child's lifetime.
    await sleep(2000);
    expect(isAlive(orphanPid)).toBe(true);
  }, 180000);

  test('run as the entry point it kills the orphan and reports the count, even for exactly one', async () => {
    const orphanPid = await spawnOrphan(MARKER_COUNT);
    expect(isAlive(orphanPid)).toBe(true);

    const res = spawnSync(process.execPath, [REAPER_PATH], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
      timeout: 90000,
      windowsHide: true,
    });
    expect(res.status).toBe(0);
    expect(res.stderr).not.toMatch(/Sweep failed/);

    expect(await pollUntil(() => !isAlive(orphanPid), 20000)).toBe(true);
    // Other genuine orphans on the machine may raise N above 1; the defect was
    // that a single match printed nothing at all.
    expect(res.stdout).toMatch(/\[reap-orphan-jest\] Killed [1-9]\d* orphaned jest worker process\(es\)\./);
  }, 180000);
});
