/**
 * Local gate lock (Equoria-hqrqk, systemconstraints.md §3).
 *
 * Two full backend gates ran at once from two worktrees on 2026-09-15 (four
 * Jest processes on a two-worker machine; one contention-sensitive test went
 * red and a whole run was repaid). Coordination is strictly local: one lock
 * file in the OS temp directory, shared by every worktree on the machine,
 * with no external service involved.
 *
 * CONTRACT — safe exclusion (owner ruling 2026-09-16, after Codex review).
 *
 * An earlier version reclaimed locks it judged stale, using a 500 ms grace for
 * unreadable metadata and a 10 s age check on a nested `.reclaim` file. Codex
 * reproduced TWO SIMULTANEOUS OWNERS against it. Neither an elapsed timeout nor
 * an unreachable pid proves a process is dead, and size+mtime is not proof of
 * ownership — so this gate no longer guesses:
 *
 *   - acquireGateLock() publishes the lock ATOMICALLY (metadata written to a
 *     temp file, then hard-linked into place), so exclusive creation and
 *     metadata publication are one step and there is no half-created lock.
 *   - Exactly one owner is admitted. A held, left-over, or unreadable lock
 *     causes BOUNDED WAITING and then a clear error naming the lock path.
 *   - There is NO automatic stale-lock reclamation. A leftover lock BLOCKS
 *     admission rather than risking overlapping owners.
 *   - The deadline is checked on every retry path, so acquisition can never
 *     spin unbounded.
 *   - The lock records owner pid, an acquisition token, start time, cwd and a
 *     run id. Release is bound to the TOKEN, not the pid: one process may
 *     acquire, release and acquire again, and a delayed release from the first
 *     handle must not free the second acquisition's gate.
 *
 * CRASH RECOVERY IS A SEPARATE, CONTROLLED MAINTENANCE STEP. If a gate is
 * SIGKILLed or the machine loses power, the lock file survives and every
 * subsequent gate will refuse to start, naming the path in its error. Confirm
 * no gate is running on this machine, then delete that file by hand. This is a
 * deliberate trade: automatic recovery is given up in exchange for never
 * admitting two owners.
 *
 * ADMISSION SCOPE — UNRESOLVED, do not overstate it (Codex review 2026-09-16,
 * item 5). This lock serializes ONE entry point. Inventory taken 2026-09-16:
 *
 *   PARTICIPATES:
 *     - backend `test:backend:full` -> scripts/run-suite-sharded.mjs, which is
 *       what .husky/pre-push:169 invokes. That is the whole list.
 *
 *   DOES NOT PARTICIPATE (each can run beside an admitted gate):
 *     - .husky/pre-push:80 doctrine checks, which run BEFORE the gate is taken;
 *     - `test:backend:targeted` — bare jest, and the command CLAUDE.md tells
 *       contributors to use for day-to-day work;
 *     - `test:backend`, `test:backend:ci`, `test:backend:diagnostic`,
 *       `test:integration`, `test:security`, `test:performance`, `test:auth*`,
 *       `test:changed`, `test:coverage`, `test:watch` and the root equivalents;
 *     - `test:frontend` (vitest) and `test:e2e*` (playwright);
 *     - dependency maintenance (`npm ci` / `npm install`), which mutates the
 *       single physical node_modules tree every worktree junctions onto.
 *
 * So this is LIMITED RUNNER SERIALIZATION, not workstation-wide protection and
 * not dependency ownership. Making the others cooperate is not a drop-in: the
 * pre-push hook would nest doctrine inside the gate it later acquires, and a
 * targeted run that acquired the gate would deadlock against the runner it
 * spawns (backend/__tests__/gateRunnerShutdown.sentinel.test.mjs does exactly
 * that, from inside a targeted run). Resolving it needs an explicit decision
 * about which outer operation owns the lock; until then, treat a green gate as
 * evidence about the runner only.
 *
 * It says nothing about databases: lanes are already per-run-id. It is about
 * CPU/RAM and push ordering.
 */
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const DEFAULT_LOCK_PATH = path.join(tmpdir(), 'equoria-backend-gate.lock');
const DEFAULT_WAIT_MS = 25 * 60 * 1000; // one full gate plus margin
const DEFAULT_POLL_MS = 5000;
const NOTICE_EVERY_MS = 60 * 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user — treat as alive.
    return error.code === 'EPERM';
  }
}

export function readGateLock(lockPath = DEFAULT_LOCK_PATH) {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    // Unreadable/partial file. Reported as ambiguous ownership: the caller
    // waits and then fails closed. It is NEVER treated as evidence the owner
    // is gone, and never authorises deleting the lock.
    return { corrupt: true, error: error.message };
  }
}

/**
 * Publish a lock ATOMICALLY: write fully-formed metadata to a temp file in the
 * same directory, then hard-link it into place. link() fails with EEXIST if the
 * name is taken, so exclusive creation and metadata publication are ONE step.
 * There is therefore no window in which the lock exists but its owner is
 * unreadable — the state Codex used to produce two simultaneous owners.
 *
 * Returns true only if this caller now owns the gate.
 */
function publishAtomically(lockPath, owner) {
  const dir = path.dirname(lockPath);
  mkdirSync(dir, { recursive: true });
  const payload = JSON.stringify(owner, null, 2);
  const tmpPath = path.join(dir, `.${path.basename(lockPath)}.${owner.token}.tmp`);

  writeFileSync(tmpPath, payload);
  try {
    linkSync(tmpPath, lockPath);
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }
    if (error.code === 'EPERM' || error.code === 'ENOSYS' || error.code === 'EXDEV') {
      // Filesystem without hard links. Fall back to exclusive create + write.
      // That reintroduces a brief unreadable window, which the protocol below
      // treats as ambiguous and never reclaims.
      return legacyCreate(lockPath, payload);
    }
    throw error;
  } finally {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
      // The link (if made) keeps the content; a stray temp file is harmless.
    }
  }
}

function legacyCreate(lockPath, payload) {
  let fd;
  try {
    fd = openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
  try {
    writeSync(fd, payload);
  } finally {
    closeSync(fd);
  }
  return true;
}

/** How the current on-disk lock looks to a contender. */
function classifyHolder(holder) {
  if (holder === null) {
    return 'vanished';
  }
  if (holder.corrupt) {
    return 'unreadable';
  }
  return isPidAlive(holder.pid) ? 'held' : 'leftover';
}

function admissionError(state, holder, lockPath, waitMs) {
  const maintenance =
    'This gate never reclaims a lock automatically: neither an elapsed timeout nor an ' +
    'unreachable pid proves the owner is gone (pid reuse), and admitting a second owner ' +
    'risks two gates at once. If you have confirmed no gate is running on this machine, ' +
    `remove ${lockPath} and retry.`;

  switch (state) {
    case 'held':
      return new Error(
        `[gate-lock] another backend gate (pid ${holder.pid}, started ${holder.startedAt}, cwd ${holder.cwd}) still holds ${lockPath} after ${Math.round(waitMs / 60000)} min; refusing to run two gates at once`,
      );
    case 'leftover':
      return new Error(
        `[gate-lock] ${lockPath} is held by pid ${holder.pid} (runId ${holder.runId ?? 'unknown'}, started ${holder.startedAt}), which is not reachable, and it did not clear within ${waitMs} ms. ${maintenance}`,
      );
    case 'unreadable':
      return new Error(
        `[gate-lock] ${lockPath} holds ownership metadata that could not be read (${holder.error}) and it did not resolve within ${waitMs} ms; refusing to admit on an unproven lock. ${maintenance}`,
      );
    default:
      return new Error(
        `[gate-lock] could not acquire ${lockPath} within ${waitMs} ms; ownership kept changing under this run`,
      );
  }
}

/**
 * Acquire the gate lock, waiting (bounded) until it is free.
 *
 * Resolves to a handle { path, owner, token, release() }. Rejects — never
 * reclaims — when the lock is held, left over, or unreadable at the deadline.
 */
export async function acquireGateLock({
  lockPath = DEFAULT_LOCK_PATH,
  waitMs = DEFAULT_WAIT_MS,
  pollMs = DEFAULT_POLL_MS,
  runId = 'unknown',
  log = () => {},
  pid = process.pid,
  now = Date.now,
} = {}) {
  const token = randomUUID();
  const owner = {
    pid,
    token,
    startedAt: new Date(now()).toISOString(),
    cwd: process.cwd(),
    runId,
  };
  const deadline = now() + waitMs;
  let lastNotice = 0;

  const handleFor = () => ({
    path: lockPath,
    owner,
    token,
    release: () => releaseGateLock({ lockPath, pid, token }),
  });

  for (;;) {
    if (publishAtomically(lockPath, owner)) {
      return handleFor();
    }

    const holder = readGateLock(lockPath);
    const state = classifyHolder(holder);

    // The deadline is checked on EVERY retry path — held, leftover, unreadable
    // and vanished alike — so acquisition can never spin without a bound.
    if (now() >= deadline) {
      throw admissionError(state, holder, lockPath, waitMs);
    }

    if (state === 'held' && now() - lastNotice >= NOTICE_EVERY_MS) {
      lastNotice = now();
      log(
        `[gate-lock] waiting: another backend gate is running (pid ${holder.pid}, started ${holder.startedAt}, cwd ${holder.cwd}); this run starts when it finishes`,
      );
    }

    await sleep(pollMs);
  }
}

/**
 * Remove the lock only if this acquisition still owns it. Safe to call
 * repeatedly.
 *
 * Ownership is the acquisition token, not the pid: one process can legitimately
 * acquire, release and acquire again, and a delayed release from the first
 * handle must not free the gate the second acquisition is holding. The pid
 * comparison remains for callers that pass no token.
 */
export function releaseGateLock({ lockPath = DEFAULT_LOCK_PATH, pid = process.pid, token } = {}) {
  const holder = readGateLock(lockPath);
  if (!holder || holder.corrupt) {
    return false;
  }
  if (token !== undefined) {
    if (holder.token !== token) {
      return false;
    }
  } else if (holder.pid !== pid) {
    return false;
  }
  rmSync(lockPath, { force: true });
  return true;
}

/**
 * Terminate owned child processes and wait until they have actually exited.
 *
 * Signalling is not stopping: a cancelled runner that releases the gate while
 * its Jest children are still alive lets the next waiting runner start beside
 * the survivors, which is the contention the gate exists to prevent. Escalates
 * to SIGKILL on a finite deadline and reports anything that would not die.
 */
export async function stopOwnedChildren(
  children,
  { escalateAfterMs = 10000, log = () => {} } = {},
) {
  const live = (children ?? []).filter(
    child => child && child.pid && child.exitCode === null && child.signalCode === null,
  );
  const stopped = [];
  const failed = [];

  await Promise.all(
    live.map(async child => {
      // Register before signalling: a listener attached afterwards can miss the
      // exit entirely.
      const exited = once(child, 'exit').then(() => 'exited');
      const waitFor = ms => Promise.race([exited, sleep(ms).then(() => 'timeout')]);

      try {
        child.kill('SIGTERM');
      } catch {
        // Already gone between the liveness check and here.
      }

      if ((await waitFor(escalateAfterMs)) === 'timeout') {
        log(
          `[gate-lock] child pid ${child.pid} did not exit ${escalateAfterMs} ms after SIGTERM; escalating to SIGKILL`,
        );
        try {
          child.kill('SIGKILL');
        } catch {
          // Nothing further to escalate to.
        }
        if ((await waitFor(escalateAfterMs)) === 'timeout') {
          failed.push(child.pid);
          return;
        }
      }
      stopped.push(child.pid);
    }),
  );

  return { stopped, failed };
}

/**
 * ONE cancellation state and ONE memoized cleanup promise for a gate owner.
 *
 * Previously the signal handler and main()'s `finally` ran cleanup
 * independently. That produced a real race: cancellation spliced the lane
 * databases out of the shared array and began destroying them, `finally` then
 * saw an empty list, released the lock and exited, and the destruction was cut
 * off — admitting the next runner while the previous run's resources were still
 * alive.
 *
 * Here, every path goes through the same object:
 *   - `requestCancellation()` flips one flag, observable immediately by
 *     schedulers so no further batch or lane is started.
 *   - `cleanup()` is MEMOIZED. Signals start it; normal completion, failures
 *     and `finally` join the very same promise. It can never run twice, and a
 *     caller can never step past cleanup that is still in flight.
 *   - Every step is attempted even after one fails, so a failing resource drop
 *     cannot abandon the resources behind it. Failed identities are preserved
 *     in the report.
 *   - Ownership is released ONLY after every required step succeeded. If any
 *     failed — children that could not be confirmed stopped, above all — the
 *     lock is RETAINED and reported. An error message followed by an unsafe
 *     release admits the next runner anyway, which is the outcome the gate
 *     exists to prevent.
 *
 * Nothing here calls process.exit(); callers set an exit status after the
 * coordinated shutdown has finished.
 */
export function createOwnershipLifecycle({ handle, steps = [], log = () => {} } = {}) {
  let cancelled = false;
  let reason = null;
  let cleanupPromise = null;
  // Cancellation as a signal, so work that is ALREADY in flight when a signal
  // lands — provisioning awaiting database creation, a migration subprocess —
  // learns about it without polling a registry (Codex round 3, P2). Consumers
  // check `signal.aborted` at their own boundaries and pass the signal to
  // spawn(), which kills a running child on abort.
  const controller = new AbortController();

  function requestCancellation(why = 'cancellation requested') {
    if (!cancelled) {
      cancelled = true;
      reason = why;
      log(`[gate-lock] ${why}: stopping scheduling and starting coordinated cleanup`);
      controller.abort(new Error(why));
    }
    return reason;
  }

  function cleanup() {
    if (cleanupPromise) {
      return cleanupPromise;
    }
    cleanupPromise = (async () => {
      const report = { completed: [], failures: [], released: false, cancelled, reason };
      for (const step of steps) {
        try {
          await step.run();
          report.completed.push(step.name);
        } catch (error) {
          report.failures.push({ step: step.name, message: error.message });
          log(`[gate-lock] cleanup step "${step.name}" FAILED: ${error.message}`);
        }
      }

      if (report.failures.length > 0) {
        log(
          `[gate-lock] RETAINING ${handle?.path ?? 'the gate lock'}: cleanup did not complete ` +
            `(${report.failures.map(f => f.step).join(', ')}). Owned resources may still be alive, ` +
            'so the next gate must not be admitted. Resolve these, then remove the lock file by hand.',
        );
        report.released = false;
        return report;
      }

      try {
        report.released = handle ? handle.release() : false;
      } catch (error) {
        report.failures.push({ step: 'release', message: error.message });
        report.released = false;
      }
      return report;
    })();
    return cleanupPromise;
  }

  return {
    requestCancellation,
    cleanup,
    isCancelled: () => cancelled,
    cancellationReason: () => reason,
    /** True once cleanup has been started by anyone. */
    isCleanupStarted: () => cleanupPromise !== null,
    /** Aborted the moment cancellation is requested. */
    signal: controller.signal,
  };
}

/**
 * The ONE decision for a gate owner's final exit status (round 2, P2).
 *
 * Previously the signal handler set 130 and the runner's main() then overwrote
 * it from test results alone, so a signal that landed during final cleanup
 * after a green run finished with status 0. Both call sites now compute the
 * status through this function, so the order in which they run cannot change
 * the answer: cancellation is never reported as success.
 *
 *   cancelled, cleanup failed  -> 1
 *   cancelled, cleanup ok      -> 130
 *   not cancelled, cleanup bad -> 1
 *   not cancelled, run failed  -> 1
 *   otherwise                  -> 0
 */
export function resolveExitStatus({
  cancelled = false,
  cleanupFailed = false,
  runFailed = false,
} = {}) {
  if (cleanupFailed) {
    return 1;
  }
  if (cancelled) {
    return 130;
  }
  return runFailed ? 1 : 0;
}

/**
 * Wire signals to the lifecycle.
 *
 * Deliberately does NOT install an unconditional `process.on('exit')` release:
 * such a hook fires synchronously during teardown and can drop the lock while
 * the coordinated cleanup above is still in flight — exactly the ordering this
 * design removes. It also never calls process.exit() with cleanup pending; it
 * sets `process.exitCode` once the shutdown has settled and lets the runtime
 * drain.
 */
export function installCancellationHandlers(
  lifecycle,
  {
    signals = ['SIGINT', 'SIGTERM', 'SIGHUP'],
    log = () => {},
    // The final-status decision. A runner passes the same function it uses on
    // its own completion path, so there is exactly one owner of that decision.
    exitStatus = report =>
      resolveExitStatus({
        cancelled: lifecycle.isCancelled(),
        cleanupFailed: report.failures.length > 0,
      }),
  } = {},
) {
  const onSignal = signal => {
    lifecycle.requestCancellation(`signal ${signal}`);
    lifecycle
      .cleanup()
      .then(report => {
        if (report.failures.length > 0) {
          log(
            `[gate-lock] shutdown after ${signal} INCOMPLETE: ${report.failures
              .map(f => `${f.step} (${f.message})`)
              .join('; ')}`,
          );
        }
        process.exitCode = exitStatus(report, signal);
      })
      .catch(error => {
        log(`[gate-lock] shutdown after ${signal} threw: ${error.message}`);
        process.exitCode = 1;
      });
  };

  for (const signal of signals) {
    process.once(signal, () => onSignal(signal));
  }
  return onSignal;
}
