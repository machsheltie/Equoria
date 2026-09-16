/**
 * Cancellation-lifecycle sentinel for the local gate lock (Equoria-hqrqk;
 * Codex review 2026-09-16, item 2).
 *
 * THE RACE THIS EXISTS TO PREVENT — previously real:
 *   1. cancellation stops the children;
 *   2. cancellation splices lane-database names out of the shared array and
 *      starts destroying them asynchronously;
 *   3. main()'s `finally` resumes, sees an EMPTY list, releases the lock and
 *      calls process.exit();
 *   4. database cleanup is interrupted, and the next runner is admitted while
 *      the previous run's resources are still alive.
 *
 * The fix is a lifecycle, not another signal-handler workaround: ONE
 * cancellation state, ONE memoized cleanup promise. Signals request
 * cancellation and then start-or-join that promise; normal completion,
 * failures and `finally` await the SAME promise. Ownership is released only
 * after the required cleanup has finished successfully — if it has not, the
 * lock is RETAINED and the failure reported, because an error message followed
 * by an unsafe release admits the next runner anyway.
 *
 * Real filesystem, real child processes, isolated temporary paths. No Jest
 * fixtures, no database, no mocks.
 */
import { afterEach, describe, expect, test } from '@jest/globals';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireGateLock, createOwnershipLifecycle, stopOwnedChildren } from '../scripts/gate-lock.mjs';

const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-gate-lifecycle-'));

let caseId = 0;
function freshLockPath() {
  caseId += 1;
  return path.join(scratch, `case-${caseId}.lock`);
}

/** Independent hard deadline for every child, well above any test timeout. */
const CHILD_DEADLINE_MS = 30000;

/** Every child spawned by the current case; drained unconditionally in afterEach. */
let owned = [];

/**
 * A real child that never exits on its own. It carries its own finite deadline
 * (spawn `timeout` + SIGKILL) and is registered for unconditional teardown, so
 * a failing assertion cannot leave it running (round 2, P1).
 */
function spawnSurvivor() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
    stdio: 'ignore',
    windowsHide: true,
    timeout: CHILD_DEADLINE_MS,
    killSignal: 'SIGKILL',
  });
  const exited = once(child, 'exit');
  owned.push({ child, exited });
  return child;
}

async function drainOwned() {
  const entries = owned;
  owned = [];
  for (const { child } of entries) {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone between the check and the kill.
      }
    }
  }
  await Promise.all(entries.map(e => e.exited));
}

function deferred() {
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(async () => {
  try {
    await drainOwned();
  } finally {
    for (const entry of readdirSync(scratch)) {
      rmSync(path.join(scratch, entry), { force: true, recursive: true, maxRetries: 3 });
    }
  }
});

describe('gate ownership lifecycle sentinel', () => {
  test('cancellation and normal completion share ONE cleanup run, and the lock outlives it', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'shared' });

    let dbRuns = 0;
    const heldDuringDb = [];
    const gate = deferred();

    const lifecycle = createOwnershipLifecycle({
      handle,
      steps: [
        {
          name: 'databases',
          run: async () => {
            dbRuns += 1;
            heldDuringDb.push(existsSync(lockPath));
            await gate.promise; // hold cleanup open at a barrier
          },
        },
      ],
    });

    // Cancellation starts cleanup; "normal completion" joins the same promise.
    lifecycle.requestCancellation('signal SIGTERM');
    const fromSignal = lifecycle.cleanup();
    const fromFinally = lifecycle.cleanup();
    expect(fromSignal).toBe(fromFinally); // memoized: literally the same promise

    // While cleanup is still held open, the gate must still be held.
    await new Promise(r => setTimeout(r, 50));
    expect(existsSync(lockPath)).toBe(true);

    gate.resolve();
    const report = await fromFinally;

    expect(dbRuns).toBe(1); // ran ONCE despite two callers
    expect(heldDuringDb).toEqual([true]); // lock still held during cleanup
    expect(report.completed).toEqual(['databases']);
    expect(report.released).toBe(true);
    expect(existsSync(lockPath)).toBe(false); // released only at the end
  }, 30000);

  test('owned children are stopped and awaited before the gate is released', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'children' });

    const survivor = spawnSurvivor();
    const survivorExited = once(survivor, 'exit');

    const observed = {};
    const lifecycle = createOwnershipLifecycle({
      handle,
      steps: [
        {
          name: 'owned-children',
          run: async () => {
            const { failed } = await stopOwnedChildren([survivor], { escalateAfterMs: 2000 });
            observed.childAlreadyDead = survivor.exitCode !== null || survivor.signalCode !== null;
            observed.lockStillHeld = existsSync(lockPath);
            if (failed.length > 0) {
              throw new Error(`children still running: ${failed.join(', ')}`);
            }
          },
        },
      ],
    });

    const report = await lifecycle.cleanup();
    await survivorExited;

    expect(observed.childAlreadyDead).toBe(true); // awaited, not merely signalled
    expect(observed.lockStillHeld).toBe(true); // released only afterwards
    expect(report.released).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  }, 30000);

  test('when a cleanup step fails the gate is RETAINED, not released', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'retain' });

    const lifecycle = createOwnershipLifecycle({
      handle,
      steps: [
        {
          name: 'owned-children',
          run: async () => {
            throw new Error('two Jest children could not be confirmed stopped');
          },
        },
      ],
    });

    const report = await lifecycle.cleanup();

    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].step).toBe('owned-children');
    expect(report.released).toBe(false);
    // The lock is deliberately left in place: admitting the next runner beside
    // surviving children is worse than blocking until a human intervenes.
    expect(existsSync(lockPath)).toBe(true);

    rmSync(lockPath, { force: true });
  }, 30000);

  test('a failing resource drop does not skip the remaining owned resources', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'drops' });

    const dropped = [];
    const owned = ['lane_db_1', 'lane_db_2', 'lane_db_3'];

    const lifecycle = createOwnershipLifecycle({
      handle,
      steps: [
        {
          name: 'lane-databases',
          run: async () => {
            const failures = [];
            for (const name of owned) {
              try {
                if (name === 'lane_db_2') {
                  throw new Error('drop refused: still connected');
                }
                dropped.push(name);
              } catch (error) {
                failures.push({ name, message: error.message });
              }
            }
            if (failures.length > 0) {
              throw new Error(`failed to drop: ${failures.map(f => `${f.name} (${f.message})`).join('; ')}`);
            }
          },
        },
      ],
    });

    const report = await lifecycle.cleanup();

    // The failure did not abandon lane_db_3.
    expect(dropped).toEqual(['lane_db_1', 'lane_db_3']);
    // The failed resource identity survives in the report.
    expect(report.failures[0].message).toMatch(/lane_db_2/);
    expect(report.failures[0].message).toMatch(/still connected/);
    expect(report.released).toBe(false);

    rmSync(lockPath, { force: true });
  }, 30000);

  /**
   * Codex item 3 — cancellation DURING provisioning.
   *
   * SCOPE NOTE, read this before trusting it: this models the runner's
   * provisioning control flow (register the intended identity BEFORE creation
   * starts; cleanup awaits the in-flight creation, then drops every registered
   * identity). It is NOT the runner itself — the real provisioning path needs
   * LANES>1 and therefore a live database, which these bounded demonstrations
   * deliberately avoid. The runner implements this exact ordering in main().
   */
  test('a database registered before creation is still cleaned up when cancellation lands mid-provisioning', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'provisioning' });

    const ownedLaneDbs = new Set();
    const dropped = [];
    const creationStarted = deferred();
    const finishCreation = deferred();
    let provisioningInFlight = null;

    // Register BEFORE creation begins. Registering afterwards is the defect:
    // creation can be cancelled, or fail, after the database already exists.
    const intendedName = 'equoria_lane_run1_1';
    ownedLaneDbs.add(intendedName);
    provisioningInFlight = (async () => {
      creationStarted.resolve();
      await finishCreation.promise;
      throw new Error('provisioning interrupted after the database was created');
    })();
    // This promise is EXPECTED to reject and is awaited inside the cleanup step
    // below. Attach a handler now so Node does not report an unhandled
    // rejection — but capture the reason rather than swallowing it, so the
    // assertion at the end proves the failure we planted is the one that
    // actually happened.
    let provisioningRejection = null;
    provisioningInFlight.catch(error => {
      provisioningRejection = error.message;
    });

    const lifecycle = createOwnershipLifecycle({
      handle,
      steps: [
        {
          name: 'lane-databases',
          run: async () => {
            if (provisioningInFlight) {
              try {
                await provisioningInFlight;
              } catch {
                // A failed creation may still have left the database behind.
              }
            }
            for (const name of [...ownedLaneDbs]) {
              dropped.push(name);
              ownedLaneDbs.delete(name);
            }
          },
        },
      ],
    });

    await creationStarted.promise;
    lifecycle.requestCancellation('signal SIGTERM');
    const cleanup = lifecycle.cleanup();

    // Cleanup must not race ahead of the in-flight creation.
    await new Promise(r => setTimeout(r, 50));
    expect(dropped).toEqual([]);
    expect(existsSync(lockPath)).toBe(true);

    finishCreation.resolve();
    const report = await cleanup;

    // The planted provisioning failure is the one that actually occurred.
    expect(provisioningRejection).toMatch(/provisioning interrupted/);
    // The database that creation left behind is still dropped.
    expect(dropped).toEqual([intendedName]);
    expect(report.released).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  }, 30000);

  test('cancellation is observable immediately so no further work is scheduled', async () => {
    const lockPath = freshLockPath();
    const handle = await acquireGateLock({ lockPath, waitMs: 2000, pollMs: 20, runId: 'stop' });

    const lifecycle = createOwnershipLifecycle({ handle, steps: [] });
    expect(lifecycle.isCancelled()).toBe(false);
    lifecycle.requestCancellation('signal SIGINT');
    expect(lifecycle.isCancelled()).toBe(true);
    expect(lifecycle.cancellationReason()).toMatch(/SIGINT/);

    await lifecycle.cleanup();
    expect(existsSync(lockPath)).toBe(false);
  }, 30000);
});
