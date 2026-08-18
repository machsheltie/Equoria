/**
 * Equoria-fbk1q — Sentinel-positive coverage for the orphan-jest reaper
 * (backend/scripts/reap-orphan-jest.mjs, posttest hygiene script, 2026-08-18).
 *
 * OPTIMAL_FIX §2: a check without a positive test is a placebo. This sentinel
 * proves the reaper actually FIRES on the thing it exists to kill — a node
 * process with 'jest' in its command line whose parent is dead — and that it
 * SPARES the things it must never touch:
 *
 *   1. a jest-lookalike whose parent (this test process) is alive, and
 *   2. an orphan whose command line does NOT contain 'jest'.
 *
 * The reaper's detection net (read from the script, matched exactly here):
 *   - win32 only (silent no-op elsewhere — mirrored by the platform gate below)
 *   - Win32_Process rows where Name='node.exe'
 *   - AND CommandLine -match 'jest'   (case-insensitive substring)
 *   - AND ParentProcessId is not among currently-live PIDs
 *   - AND ProcessId is not the reaper's own PID
 *
 * HOW THE FIXTURES ARE BUILT:
 *   - ORPHAN: an intermediate node process spawns the lookalike DETACHED,
 *     prints its PID, and exits — once the intermediate is gone the
 *     lookalike's ParentProcessId points at a dead process.
 *   - SURVIVOR: spawned directly by this test process, which stays alive for
 *     the duration — a live-parent jest-lookalike the reaper must not kill.
 *   - All lookalikes carry a unique Equoria-fbk1q marker in argv and every
 *     assertion targets an exact PID (verified against its CommandLine via
 *     CIM before the reaper runs) — never a sweep — so this test cannot
 *     misattribute some other process's fate to the reaper.
 *
 * SENTINEL-POSITIVITY (would-fail-if-noop): before invoking the reaper, the
 * test holds an observation window equal in spirit to the post-reaper death
 * budget and asserts the orphan is STILL ALIVE — nothing kills it passively.
 * Its death immediately after the reaper run is therefore attributable to the
 * reaper; were main() a no-op, the "orphan is dead" assertion would fail.
 *
 * CONCURRENCY: the reaper run inside this test kills ANY genuinely-orphaned
 * jest process on the machine — that is its documented job. Per the
 * CONTRIBUTING test-run budget, suite invocations never run concurrently, and
 * a live run's workers always have a live parent, so a concurrent healthy run
 * is structurally safe. Do not run this file while another EXTERNALLY-KILLED
 * jest run's corpse is mid-cleanup by some other tool.
 *
 * CLEANUP: every spawned PID is tracked and force-killed in afterAll,
 * unconditionally — this test must never leak the very disease the reaper
 * exists to cure. Lookalikes also self-expire after 120s as a backstop.
 *
 * NOTE ON IMPORT vs CHILD PROCESS: the reaper runs main() unconditionally at
 * module top level (no main-module guard, nothing exported), so importing it
 * would trigger a real sweep at import time. This test therefore executes it
 * the way posttest does: `node scripts/reap-orphan-jest.mjs` as a child
 * process.
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect, afterAll } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const BACKEND_DIR = path.resolve(path.dirname(__filename), '..', '..');
const REAPER_PATH = path.join(BACKEND_DIR, 'scripts', 'reap-orphan-jest.mjs');

// Unique markers (bd id embedded) so assertions can verify, by PID + command
// line, that they are looking at OUR fixtures and nothing else.
const MARKER_ORPHAN = 'equoria-fbk1q-jest-lookalike-orphan';
const MARKER_SURVIVOR = 'equoria-fbk1q-jest-lookalike-survivor';
// Deliberately contains NO 'jest' substring — falls outside the reaper's net.
const MARKER_PLAIN = 'equoria-fbk1q-plain-lookalike-orphan';

// Lookalike body: idle for 120s then exit on its own (leak backstop).
const LOOKALIKE_EVAL = 'setTimeout(() => {}, 120000)';

/** Every PID this file spawns, killed unconditionally in afterAll. */
const spawnedPids = new Set();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Liveness check by PID. On Windows, signal 0 probes existence; EPERM means
 * "exists but access denied" (still alive). PID-reuse within the seconds-wide
 * assertion windows is theoretically possible but vanishingly unlikely.
 */
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

/**
 * Reads a process's command line via the same CIM surface the reaper queries,
 * so the "this PID is inside/outside the reaper's net" preconditions are
 * checked against the exact data the reaper will see.
 */
function getCommandLine(pid) {
  const res = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
    { encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  return (res.stdout || '').trim();
}

/**
 * Spawns an ORPHANED lookalike: an intermediate node process launches the
 * lookalike detached, prints its PID, and exits — leaving the lookalike with
 * a dead parent. Resolves with the lookalike's PID after the intermediate has
 * fully exited (i.e., once the lookalike is genuinely an orphan).
 */
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
    let errOut = '';
    intermediate.stdout.on('data', d => {
      out += d;
    });
    intermediate.stderr.on('data', d => {
      errOut += d;
    });
    intermediate.on('error', reject);
    intermediate.on('exit', code => {
      const pid = Number.parseInt(out.trim(), 10);
      if (code === 0 && Number.isInteger(pid) && pid > 0) {
        spawnedPids.add(pid);
        resolve(pid);
      } else {
        reject(
          new Error(
            `orphan intermediate failed: code=${code} stdout=${JSON.stringify(out)} stderr=${JSON.stringify(errOut)}`,
          ),
        );
      }
    });
  });
}

/**
 * Spawns a LIVE-PARENT lookalike: this test process is the parent and stays
 * alive throughout, so the reaper must spare it. unref() keeps the jest event
 * loop from being held open; the PID is tracked and killed in afterAll.
 */
function spawnSurvivor(marker) {
  const child = spawn(process.execPath, ['-e', LOOKALIKE_EVAL, marker], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  spawnedPids.add(child.pid);
  return child.pid;
}

/** Runs the reaper exactly the way the posttest lifecycle script does. */
function runReaper() {
  return spawnSync(process.execPath, [REAPER_PATH], {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    timeout: 90000,
    windowsHide: true,
  });
}

afterAll(() => {
  // Unconditional reap of everything WE spawned — this test must never leak a
  // process, whatever happened above.
  for (const pid of spawnedPids) {
    try {
      process.kill(pid);
    } catch {
      // already dead — that is the desired end state
    }
  }
});

// The reaper is win32-only BY DESIGN (documented silent no-op elsewhere; see
// its module header). This gate mirrors the script's own
// `process.platform !== 'win32'` early return — on non-Windows there is no
// behavior to assert beyond the unconditional fail-soft test below. This is a
// platform-contract mirror, not a readiness bypass (Constitution §2 concerns
// beta-live product paths; this is dev-machine test hygiene).
const describeWin32 = process.platform === 'win32' ? describe : describe.skip;

describeWin32('reap-orphan-jest sentinel (Equoria-fbk1q)', () => {
  test('kills the orphaned jest-lookalike, spares the live-parent lookalike and the non-jest orphan', async () => {
    // --- Arrange: one process inside the net, two outside it -------------
    const orphanPid = await spawnOrphan(MARKER_ORPHAN);
    const plainOrphanPid = await spawnOrphan(MARKER_PLAIN);
    const survivorPid = spawnSurvivor(MARKER_SURVIVOR);

    expect(isAlive(orphanPid)).toBe(true);
    expect(isAlive(plainOrphanPid)).toBe(true);
    expect(isAlive(survivorPid)).toBe(true);

    // Precondition: verify BY PID, against the same CIM data the reaper
    // reads, that each fixture genuinely falls inside/outside its net.
    const orphanCmd = getCommandLine(orphanPid);
    expect(orphanCmd).toContain(MARKER_ORPHAN);
    expect(orphanCmd).toMatch(/jest/i);

    const plainCmd = getCommandLine(plainOrphanPid);
    expect(plainCmd).toContain(MARKER_PLAIN);
    expect(plainCmd).not.toMatch(/jest/i);

    const survivorCmd = getCommandLine(survivorPid);
    expect(survivorCmd).toContain(MARKER_SURVIVOR);
    expect(survivorCmd).toMatch(/jest/i);

    // --- Sentinel-positivity: would-fail-if-noop -------------------------
    // Hold an observation window WITHOUT running the reaper and assert the
    // orphan does not die passively. Its death after the reaper run below
    // is therefore attributable to the reaper — if main() were a no-op,
    // the post-reaper death assertion would fail.
    await sleep(4000);
    expect(isAlive(orphanPid)).toBe(true);

    // --- Act: run the reaper the way posttest does -----------------------
    const res = runReaper();
    expect(res.status).toBe(0);
    // The reaper's internal PowerShell sweep must not have failed — its
    // fail-soft catch would print this warning while killing nothing.
    expect(res.stderr).not.toMatch(/Sweep failed/);
    // NOT asserted: the "[reap-orphan-jest] Killed N ..." stdout line.
    // Measured 2026-08-18 (Equoria-fbk1q): when EXACTLY ONE process matches,
    // PowerShell unrolls the pipeline to a scalar CimInstance and
    // `$orphans.Count` resolves against the CIM class's (absent) Count
    // property → $null → the reaper parses 0 and prints nothing, even
    // though Stop-Process DID fire. The kill itself (asserted below) is the
    // reaper's contract; the count line is a reporting defect in the script,
    // surfaced by this issue for a follow-up fix.

    // --- Assert: orphan dead, both spared processes still alive ----------
    const orphanDied = await pollUntil(() => !isAlive(orphanPid), 20000);
    expect(orphanDied).toBe(true);

    // Short confirm window so a delayed kill of a spared process would be
    // caught rather than racing the assertion.
    await sleep(2000);
    expect(isAlive(survivorPid)).toBe(true);
    expect(isAlive(plainOrphanPid)).toBe(true);
  }, 180000);
});

describe('reap-orphan-jest fail-soft contract (any platform)', () => {
  test('exits 0 when run standalone — a reaper failure must never fail the test run it trails', () => {
    // On non-win32 this exercises the documented silent no-op; on win32 it
    // runs a real sweep (its job — a live run’s workers all have live
    // parents, so nothing legitimate is at risk).
    const res = runReaper();
    expect(res.status).toBe(0);
  }, 120000);
});
