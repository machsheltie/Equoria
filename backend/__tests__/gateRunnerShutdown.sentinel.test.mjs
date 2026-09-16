/**
 * Shutdown-ordering sentinel — HANDLER WIRING in a real child process
 * (Equoria-hqrqk; Codex review 2026-09-16, item 4; round 2 items 1-3).
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT — read before trusting any of it:
 *
 *   - Each case runs the real lifecycle inside a real child process and emits
 *     the signal event in-process (`process.emit('SIGTERM')`). That exercises
 *     the REGISTERED HANDLER and the ordering it drives. It does NOT prove
 *     Windows operating-system signal delivery: on Windows `child.kill('SIGTERM')`
 *     calls TerminateProcess and no handler runs at all.
 *
 *   - Nothing here launches Jest or the sharded runner. Round-2 P1: the earlier
 *     version spawned a real runner from inside this suite, which during a
 *     two-lane gate meant a THIRD Jest process (768 + 768 + 1536 MiB of
 *     configured heap) — an isolated lock path does not isolate machine
 *     resources. The real-runner admission and completion checks now live in
 *     `scripts/verify-gate-admission.mjs`, a separately scheduled harness that
 *     holds the machine gate lock while it runs so it can never overlap a gate.
 *
 *   - Every spawned child carries its own finite deadline (spawn `timeout` +
 *     SIGKILL), is registered on spawn, and is terminated and awaited in
 *     afterEach regardless of how the case ended (round 2, P1).
 *
 * No Jest fixtures and no database.
 */
import { afterEach, describe, expect, test } from '@jest/globals';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gateLockUrl = pathToFileURL(path.join(backendRoot, 'scripts', 'gate-lock.mjs')).href;
const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-runner-shutdown-'));

const CHILD_DEADLINE_MS = 30000;
let owned = [];

function isolatedTemp(name) {
  const dir = path.join(scratch, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function spawnNode(args, { env = {}, cwd = backendRoot } = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: CHILD_DEADLINE_MS,
    killSignal: 'SIGKILL',
  });
  let out = '';
  child.stdout.on('data', c => {
    out += c.toString();
  });
  child.stderr.on('data', c => {
    out += c.toString();
  });
  const exited = once(child, 'exit').then(([code]) => ({ code, out }));
  owned.push({ child, exited });
  return { child, read: () => out, done: exited };
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

afterEach(async () => {
  try {
    await drainOwned();
  } finally {
    for (const entry of readdirSync(scratch)) {
      rmSync(path.join(scratch, entry), { force: true, recursive: true, maxRetries: 3 });
    }
  }
});

describe('shutdown ordering — handler wiring in a real child process', () => {
  /**
   * Cancellation while a child is running. The owned child must be stopped and
   * AWAITED, and the gate must still be held while that happens. The grandchild
   * the harness spawns is bounded by the harness's own deadline: the harness is
   * SIGKILLed at CHILD_DEADLINE_MS, and stopOwnedChildren escalates at 2 s.
   */
  test('a signal stops the owned child and releases the gate only afterwards', async () => {
    const tempDir = isolatedTemp('cancel-child');
    const lockPath = path.join(tempDir, 'cancel-child.lock');

    const harness = spawnNode(
      [
        '--input-type=module',
        '-e',
        `
        import { spawn } from 'node:child_process';
        import { existsSync } from 'node:fs';
        const { acquireGateLock, createOwnershipLifecycle, installCancellationHandlers, stopOwnedChildren } =
          await import(${JSON.stringify(gateLockUrl)});

        const lockPath = ${JSON.stringify(lockPath)};
        const handle = await acquireGateLock({ lockPath, waitMs: 5000, pollMs: 20, runId: 'harness' });

        // A real owned grandchild with its own finite deadline.
        const owned = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
          stdio: 'ignore', timeout: 20000, killSignal: 'SIGKILL',
        });

        const lifecycle = createOwnershipLifecycle({
          handle,
          log: line => process.stdout.write(line + '\\n'),
          steps: [{
            name: 'owned-children',
            run: async () => {
              const { failed } = await stopOwnedChildren([owned], { escalateAfterMs: 2000 });
              process.stdout.write('CHILD_DEAD=' + (owned.exitCode !== null || owned.signalCode !== null) + '\\n');
              process.stdout.write('LOCK_HELD_DURING_CLEANUP=' + existsSync(lockPath) + '\\n');
              if (failed.length) { throw new Error('children survived'); }
            },
          }],
        });
        installCancellationHandlers(lifecycle, { log: line => process.stdout.write(line + '\\n') });

        // Handler wiring: emit the signal event in-process. NOT OS delivery.
        process.emit('SIGTERM');
        setTimeout(() => {
          process.stdout.write('LOCK_AFTER=' + existsSync(lockPath) + '\\n');
          process.stdout.write('EXITCODE=' + process.exitCode + '\\n');
        }, 1500);
        `,
      ],
      { env: { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir } },
    );

    const result = await harness.done;

    expect(result.out).toMatch(/CHILD_DEAD=true/); // awaited, not merely signalled
    expect(result.out).toMatch(/LOCK_HELD_DURING_CLEANUP=true/); // released only after
    expect(result.out).toMatch(/LOCK_AFTER=false/);
    expect(result.out).toMatch(/EXITCODE=130/); // status set, not process.exit()
    expect(existsSync(lockPath)).toBe(false);
  }, 60000);

  /**
   * Cancellation while cleanup is deliberately held at a barrier: the original
   * defect was `finally` racing past in-flight destruction and releasing early.
   */
  test('the gate is still held while cleanup sits at a barrier, and normal completion joins the same cleanup', async () => {
    const tempDir = isolatedTemp('cancel-barrier');
    const lockPath = path.join(tempDir, 'cancel-barrier.lock');

    const harness = spawnNode(
      [
        '--input-type=module',
        '-e',
        `
        import { existsSync } from 'node:fs';
        const { acquireGateLock, createOwnershipLifecycle, installCancellationHandlers } =
          await import(${JSON.stringify(gateLockUrl)});

        const lockPath = ${JSON.stringify(lockPath)};
        const handle = await acquireGateLock({ lockPath, waitMs: 5000, pollMs: 20, runId: 'harness' });

        let runs = 0;
        let releaseBarrier;
        const barrier = new Promise(r => { releaseBarrier = r; });
        const lifecycle = createOwnershipLifecycle({
          handle,
          steps: [{ name: 'lane-databases', run: async () => { runs += 1; process.stdout.write('CLEANUP_STARTED\\n'); await barrier; } }],
        });
        installCancellationHandlers(lifecycle);

        process.emit('SIGINT');
        await new Promise(r => setTimeout(r, 200));
        process.stdout.write('LOCK_WHILE_BARRIER=' + existsSync(lockPath) + '\\n');

        const joined = lifecycle.cleanup();
        releaseBarrier();
        const report = await joined;
        process.stdout.write('RUNS=' + runs + '\\n');
        process.stdout.write('RELEASED=' + report.released + '\\n');
        process.stdout.write('LOCK_AFTER=' + existsSync(lockPath) + '\\n');
        `,
      ],
      { env: { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir } },
    );

    const result = await harness.done;

    expect(result.out).toMatch(/CLEANUP_STARTED/);
    expect(result.out).toMatch(/LOCK_WHILE_BARRIER=true/);
    expect(result.out).toMatch(/RUNS=1/);
    expect(result.out).toMatch(/RELEASED=true/);
    expect(result.out).toMatch(/LOCK_AFTER=false/);
  }, 60000);

  /** A failed cleanup step must retain the gate AND still attempt the resources behind it. */
  test('a failed step retains the gate while the remaining resources are still attempted', async () => {
    const tempDir = isolatedTemp('cancel-failure');
    const lockPath = path.join(tempDir, 'cancel-failure.lock');

    const harness = spawnNode(
      [
        '--input-type=module',
        '-e',
        `
        import { existsSync } from 'node:fs';
        const { acquireGateLock, createOwnershipLifecycle } = await import(${JSON.stringify(gateLockUrl)});

        const lockPath = ${JSON.stringify(lockPath)};
        const handle = await acquireGateLock({ lockPath, waitMs: 5000, pollMs: 20, runId: 'harness' });

        const dropped = [];
        const lifecycle = createOwnershipLifecycle({
          handle,
          log: line => process.stdout.write(line + '\\n'),
          steps: [
            { name: 'owned-children', run: async () => { throw new Error('a Jest child could not be confirmed stopped'); } },
            { name: 'lane-databases', run: async () => { for (const n of ['db_a','db_b']) { dropped.push(n); } } },
          ],
        });

        const report = await lifecycle.cleanup();
        process.stdout.write('DROPPED=' + dropped.join(',') + '\\n');
        process.stdout.write('RELEASED=' + report.released + '\\n');
        process.stdout.write('LOCK_AFTER=' + existsSync(lockPath) + '\\n');
        process.stdout.write('FAILURES=' + report.failures.map(f => f.step).join(',') + '\\n');
        `,
      ],
      { env: { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir } },
    );

    const result = await harness.done;

    expect(result.out).toMatch(/DROPPED=db_a,db_b/);
    expect(result.out).toMatch(/FAILURES=owned-children/);
    expect(result.out).toMatch(/RELEASED=false/);
    expect(result.out).toMatch(/LOCK_AFTER=true/); // retained deliberately
    expect(result.out).toMatch(/RETAINING/);
  }, 60000);

  /**
   * Round 2, P2: cancellation must not finish with exit status 0. Codex
   * reproduced HANDLER_STATUS 130 -> RUNNER_FINAL_STATUS 0 when a signal landed
   * during final cleanup after every suite had passed and main() then
   * overwrote the status from test results alone.
   *
   * SCOPE NOTE: the real lifecycle, the real handler and the real
   * resolveExitStatus decision are exercised; main()'s call site is modelled
   * by the "runner" block below, because the sharded runner cannot be imported
   * without its top-level side effects. The runner uses the same function.
   */
  test('a signal during final cleanup after a green run still yields a cancelled status, never 0', async () => {
    const tempDir = isolatedTemp('cancel-status');
    const lockPath = path.join(tempDir, 'cancel-status.lock');

    const harness = spawnNode(
      [
        '--input-type=module',
        '-e',
        `
        const { acquireGateLock, createOwnershipLifecycle, installCancellationHandlers, resolveExitStatus } =
          await import(${JSON.stringify(gateLockUrl)});

        const handle = await acquireGateLock({ lockPath: ${JSON.stringify(lockPath)}, waitMs: 5000, pollMs: 20, runId: 'harness' });

        let releaseBarrier;
        const barrier = new Promise(r => { releaseBarrier = r; });
        const lifecycle = createOwnershipLifecycle({
          handle,
          steps: [{ name: 'lane-databases', run: async () => { await barrier; } }],
        });

        // ONE decision function, shared by the handler and the runner's main().
        const runFailed = false; // every suite passed
        const decide = report => resolveExitStatus({
          cancelled: lifecycle.isCancelled(),
          cleanupFailed: report.failures.length > 0,
          runFailed,
        });
        installCancellationHandlers(lifecycle, { exitStatus: decide });

        // "main()" has finished its suites (all green) and enters final cleanup.
        const mainDone = lifecycle.cleanup().then(report => {
          process.exitCode = decide(report); // main()'s call site, modelled
          process.stdout.write('RUNNER_FINAL_STATUS=' + process.exitCode + '\\n');
        });

        // The signal lands DURING that final cleanup.
        await new Promise(r => setTimeout(r, 100));
        process.emit('SIGTERM');
        await new Promise(r => setTimeout(r, 100));
        releaseBarrier();
        await mainDone;
        await new Promise(r => setTimeout(r, 200));
        process.stdout.write('SETTLED_STATUS=' + process.exitCode + '\\n');
        `,
      ],
      { env: { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir } },
    );

    const result = await harness.done;

    expect(result.out).toMatch(/RUNNER_FINAL_STATUS=130/);
    expect(result.out).toMatch(/SETTLED_STATUS=130/);
    expect(result.out).not.toMatch(/STATUS=0\b/);
    // The child's own exit code is the settled status.
    expect(result.code).toBe(130);
  }, 60000);
});
