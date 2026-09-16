/**
 * Local gate lock (Equoria-hqrqk, systemconstraints.md §3).
 *
 * Two full backend gates ran at once from two worktrees on 2026-09-15 (four
 * Jest processes on a two-worker machine; one contention-sensitive test went
 * red and a whole run was repaid). Coordination is strictly local: one lock
 * file in the OS temp directory, shared by every worktree on the machine,
 * with no external service involved.
 *
 * Contract:
 *   - acquireGateLock() creates the file atomically (O_EXCL). If it exists and
 *     its owner pid is alive, the caller WAITS (bounded, with a periodic notice)
 *     so the second gate runs after the first instead of beside it. If the
 *     owner pid is dead the lock is stale and is reclaimed.
 *   - The lock records owner pid, start time, cwd and a run id; release only
 *     removes the file when it still belongs to this owner.
 *   - releaseGateLock() is safe to call twice; installReleaseOnExit() releases
 *     on normal exit, SIGINT and SIGTERM (a SIGKILL leaves a stale file, which
 *     the pid check reclaims on the next acquire).
 *
 * Only coordinates cooperating local runners that use it; it cannot stop a
 * bare `jest` invocation. It says nothing about databases: lanes are already
 * per-run-id. It is about CPU/RAM and push ordering.
 */
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
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
    // Unreadable/partial file: report it as a lock with no live owner so the
    // stale path reclaims it rather than blocking forever.
    return { corrupt: true, error: error.message };
  }
}

function tryCreate(lockPath, owner) {
  mkdirSync(path.dirname(lockPath), { recursive: true });
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
    writeSync(fd, JSON.stringify(owner, null, 2));
  } finally {
    closeSync(fd);
  }
  return true;
}

/**
 * Acquire the gate lock, waiting (bounded) while a live owner holds it.
 * Resolves to a handle { path, owner, release() }.
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
  const owner = { pid, startedAt: new Date(now()).toISOString(), cwd: process.cwd(), runId };
  const deadline = now() + waitMs;
  let lastNotice = 0;

  for (;;) {
    if (tryCreate(lockPath, owner)) {
      return {
        path: lockPath,
        owner,
        release: () => releaseGateLock({ lockPath, pid }),
      };
    }

    const holder = readGateLock(lockPath);
    const holderAlive = holder && !holder.corrupt && isPidAlive(holder.pid);
    if (!holderAlive) {
      log(
        `[gate-lock] reclaiming stale lock at ${lockPath} (owner pid ${holder?.pid ?? 'unknown'} is not running)`,
      );
      try {
        rmSync(lockPath, { force: true });
      } catch {
        // Another waiter may have reclaimed it first; loop and retry the create.
      }
      continue;
    }

    if (now() >= deadline) {
      throw new Error(
        `[gate-lock] another backend gate (pid ${holder.pid}, started ${holder.startedAt}, cwd ${holder.cwd}) still holds ${lockPath} after ${Math.round(waitMs / 60000)} min; refusing to run two gates at once`,
      );
    }
    if (now() - lastNotice >= NOTICE_EVERY_MS) {
      lastNotice = now();
      log(
        `[gate-lock] waiting: another backend gate is running (pid ${holder.pid}, started ${holder.startedAt}, cwd ${holder.cwd}); this run starts when it finishes`,
      );
    }
    await sleep(pollMs);
  }
}

/** Remove the lock only if this pid still owns it. Safe to call repeatedly. */
export function releaseGateLock({ lockPath = DEFAULT_LOCK_PATH, pid = process.pid } = {}) {
  const holder = readGateLock(lockPath);
  if (!holder || holder.corrupt || holder.pid !== pid) {
    return false;
  }
  rmSync(lockPath, { force: true });
  return true;
}

/** Release on exit paths where a finally block would not run. */
export function installReleaseOnExit(handle) {
  const release = () => {
    try {
      handle.release();
    } catch {
      // Best effort on the way out; a stale file is reclaimed by the next acquire.
    }
  };
  process.once('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => {
      release();
      process.exit(130);
    });
  }
  return release;
}
