/**
 * Sentinel for the local gate lock (Equoria-hqrqk, systemconstraints.md §3).
 *
 * Proves, on the real filesystem with real child processes and no mocks:
 *   1. a second acquire WAITS while a live owner holds the lock and proceeds
 *      the moment the owner releases (planted collision resolves in order);
 *   2. a bounded wait that expires fails loudly, naming the live holder;
 *   3. release removes the file only for its owner, and is safe to repeat;
 *   4. the runner really uses the lock (source contract), so a bare
 *      `node scripts/run-suite-sharded.mjs` from two windows serializes.
 *
 * Two further cases were RETIRED on 2026-09-16 when automatic stale-lock
 * reclamation was removed from the acquisition path; see the inline notes
 * below for the old contract and the ruling. Their replacement coverage is in
 * gateLockOwnership.sentinel.test.mjs.
 */
import { afterEach, describe, expect, test } from '@jest/globals';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireGateLock, readGateLock, releaseGateLock } from '../scripts/gate-lock.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-gate-lock-sentinel-'));
const lockPath = path.join(scratch, 'gate.lock');

/** A real child process that holds the lock until told to release. */
function spawnHolder() {
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { acquireGateLock } from ${JSON.stringify(pathToFileURL(path.join(backendRoot, 'scripts', 'gate-lock.mjs')).href)};
       const handle = await acquireGateLock({ lockPath: ${JSON.stringify(lockPath)}, waitMs: 5000, pollMs: 50, runId: 'holder' });
       process.stdout.write('HELD\\n');
       process.stdin.once('data', () => { handle.release(); process.stdout.write('RELEASED\\n'); process.exit(0); });`,
    ],
    { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true },
  );
  const held = new Promise(resolve => {
    child.stdout.on('data', chunk => {
      if (chunk.toString().includes('HELD')) {
        resolve();
      }
    });
  });
  // Register the exit promise now: by the time a caller awaits it the child
  // may already have exited, and a listener attached after the fact never fires.
  const exited = once(child, 'exit');
  return { child, held, exited, release: () => child.stdin.write('go\n') };
}

afterEach(() => {
  rmSync(lockPath, { force: true });
});

describe('gate lock sentinel', () => {
  test('a second acquire waits for a live holder and proceeds in order once released', async () => {
    const holder = spawnHolder();
    await holder.held;
    expect(readGateLock(lockPath).pid).toBe(holder.child.pid);

    const notices = [];
    const started = Date.now();
    const waiter = acquireGateLock({
      lockPath,
      waitMs: 10000,
      pollMs: 50,
      runId: 'waiter',
      log: line => notices.push(line),
    });
    // Give the waiter time to observe the live holder, then release.
    await new Promise(resolve => setTimeout(resolve, 400));
    holder.release();
    const handle = await waiter;
    await holder.exited;

    expect(Date.now() - started).toBeGreaterThanOrEqual(350);
    expect(readGateLock(lockPath).pid).toBe(process.pid);
    expect(notices.join('\n')).toMatch(/waiting: another backend gate is running/);
    expect(handle.release()).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  }, 30000);

  test('planted collision: an expired bounded wait fails loudly naming the live holder', async () => {
    const holder = spawnHolder();
    await holder.held;
    try {
      await expect(acquireGateLock({ lockPath, waitMs: 300, pollMs: 50, runId: 'impatient' })).rejects.toThrow(
        new RegExp(`pid ${holder.child.pid}.*refusing to run two gates at once`),
      );
      // The holder still owns the lock; the failed waiter did not disturb it.
      expect(readGateLock(lockPath).pid).toBe(holder.child.pid);
    } finally {
      holder.release();
      await holder.exited;
    }
  }, 30000);

  // RETIRED 2026-09-16 by owner ruling, after Codex reproduced two simultaneous
  // owners against the reclamation protocol. The removed case was:
  //
  //   test('a lock left by a dead pid is reclaimed')
  //
  // OLD CONTRACT: a lock whose owner pid is not reachable is stale, and
  // acquireGateLock() reclaims it automatically and admits the caller.
  //
  // NEW RULING: an unreachable pid is NOT proof the owner is gone — pids are
  // reused — so reclaiming on that basis can admit a second owner beside a live
  // gate. Automatic reclamation is removed from the acquisition path entirely;
  // a leftover lock now BLOCKS admission and is cleared by a separate,
  // controlled maintenance step. The replacement coverage lives in
  // gateLockOwnership.sentinel.test.mjs ('two contenders facing an abandoned
  // lock both fail closed'), which asserts the opposite outcome deliberately.

  test('release only removes the lock for its owner and is idempotent', async () => {
    const handle = await acquireGateLock({ lockPath, waitMs: 1000, pollMs: 50 });
    expect(releaseGateLock({ lockPath, pid: process.pid + 1 })).toBe(false); // not the owner
    expect(existsSync(lockPath)).toBe(true);
    expect(handle.release()).toBe(true);
    expect(handle.release()).toBe(false);
    expect(existsSync(lockPath)).toBe(false);
  });

  // RETIRED 2026-09-16 by the same owner ruling. The removed case was:
  //
  //   test('a corrupt lock file is treated as stale rather than blocking forever')
  //
  // OLD CONTRACT: unreadable owner metadata is stale, so acquireGateLock()
  // deletes the file and admits the caller rather than blocking.
  //
  // NEW RULING: unreadable metadata is ambiguous ownership, not evidence of a
  // dead owner. Blocking is the safe outcome; deleting risks admitting a second
  // owner beside a gate that is merely mid-publication. Replacement coverage:
  // gateLockOwnership.sentinel.test.mjs ('an unreadable lock is waited on and
  // then reported, never deleted').

  test('the sharded runner acquires the gate lock before provisioning and releases it', () => {
    // Unchanged contract, updated symbol: on 2026-09-16 the cancellation API
    // became createOwnershipLifecycle + installCancellationHandlers (the old
    // installReleaseOnExit released the lock from an unconditional exit hook,
    // which could bypass cleanup ordering). The assertion below still says
    // exactly what it always said — the runner takes the gate, and takes it
    // BEFORE it provisions anything.
    //
    // This is a source-contract test and is weak by construction. The
    // behavioural evidence — a real runner process that cannot begin discovery
    // until it is admitted — lives in gateRunnerShutdown.sentinel.test.mjs.
    const source = readFileSync(path.join(backendRoot, 'scripts', 'run-suite-sharded.mjs'), 'utf8');
    expect(source).toContain("from './gate-lock.mjs'");
    expect(source).toMatch(/await acquireGateLock\(/);
    expect(source).toMatch(/installCancellationHandlers\(/);
    expect(source.indexOf('await acquireGateLock(')).toBeLessThan(source.indexOf('createLaneDatabase({'));
  });
});
