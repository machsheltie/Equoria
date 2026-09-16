/**
 * Ownership sentinel for the local gate lock (Equoria-hqrqk; Codex review
 * 2026-09-16, items 1 and 6; round 2 item 2).
 *
 * CONTRACT UNDER TEST — safe exclusion, adopted by owner ruling 2026-09-16:
 *
 *   - Exclusive creation admits exactly one owner.
 *   - Incomplete, unreadable or otherwise ambiguous ownership causes BOUNDED
 *     WAITING followed by a clear error. It never authorises deleting a lock.
 *   - There is NO automatic stale-lock reclamation on the acquisition path. A
 *     leftover lock blocks admission; clearing it is a separate, controlled
 *     maintenance step (see the module docblock).
 *   - Release is bound to the acquisition token, not the pid.
 *   - The deadline is checked on every retry path.
 *
 * This deliberately trades automatic crash recovery for safe exclusion: an
 * elapsed timeout is not proof that a process is dead, and neither size+mtime
 * nor file age is proof of ownership.
 *
 * CHILD-PROCESS HYGIENE (round 2, P1): every spawned process carries a finite
 * deadline of its own (spawn `timeout` + SIGKILL), is registered the moment it
 * is spawned, and is terminated and AWAITED in afterEach regardless of how the
 * test ended. A failing assertion — the very regression these cases exist to
 * catch — must never leave a diagnostic child running behind it.
 *
 * Every case uses the real filesystem, real child processes and isolated
 * temporary paths. No Jest fixtures, no database, no mocks — a mocked
 * filesystem cannot demonstrate a filesystem race.
 */
import { afterEach, describe, expect, test } from '@jest/globals';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireGateLock, readGateLock } from '../scripts/gate-lock.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gateLockUrl = pathToFileURL(path.join(backendRoot, 'scripts', 'gate-lock.mjs')).href;
const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-gate-ownership-'));

/** Independent hard deadline for every child, well above any test timeout. */
const CHILD_DEADLINE_MS = 30000;

let caseId = 0;
function freshLockPath() {
  caseId += 1;
  return path.join(scratch, `case-${caseId}.lock`);
}

/** Every child spawned by the current case; drained unconditionally in afterEach. */
let owned = [];

function spawnOwned(args, { stdio = ['ignore', 'pipe', 'pipe'] } = {}) {
  const child = spawn(process.execPath, args, {
    stdio,
    windowsHide: true,
    // Finite deadline independent of the test: Node kills the child itself.
    timeout: CHILD_DEADLINE_MS,
    killSignal: 'SIGKILL',
  });
  // Register the exit promise NOW so a child that exits before anyone awaits
  // it is still observed.
  const exited = once(child, 'exit').then(([code, signal]) => ({ code, signal }));
  const entry = { child, exited };
  owned.push(entry);
  return entry;
}

function runNode(source, args = []) {
  const entry = spawnOwned(['--input-type=module', '-e', source, ...args]);
  let out = '';
  let err = '';
  entry.child.stdout.on('data', c => {
    out += c.toString();
  });
  entry.child.stderr.on('data', c => {
    err += c.toString();
  });
  const done = entry.exited.then(({ code }) => ({ code, out, err }));
  return { child: entry.child, done, waitFor: needle => waitForText(() => out, needle) };
}

async function waitForText(read, needle, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read().includes(needle)) {
      return;
    }
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`timed out waiting for ${JSON.stringify(needle)}; saw: ${read()}`);
}

/** Stop every owned child and wait for it to be gone. Runs even after a throw. */
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

describe('gate lock ownership sentinel — safe exclusion', () => {
  /**
   * Codex item 1, steps 1-4. Owner A is a REAL process that takes the lock
   * exclusively and then stalls before publishing its metadata — the exact
   * interleaving Codex used to produce two simultaneous owners. A contender
   * must not interpret "not yet readable" as "free to take".
   */
  test('a contender fails closed against an owner stalled before publishing metadata, and the owner keeps the lock', async () => {
    const lockPath = freshLockPath();
    const publishBarrier = path.join(scratch, 'publish-barrier');

    // Owner A: exclusive create, announce, stall on a barrier (sleep-polling,
    // never a busy loop), then publish.
    const owner = runNode(
      `
      import { closeSync, existsSync, openSync, writeFileSync } from 'node:fs';
      const [lockPath, barrier] = process.argv.slice(1);
      closeSync(openSync(lockPath, 'wx'));          // exclusive create wins
      process.stdout.write('CREATED\\n');            // ...metadata NOT yet written
      while (!existsSync(barrier)) { await new Promise(r => setTimeout(r, 10)); }
      writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token: 'owner-A-token', startedAt: new Date().toISOString(), cwd: 'A', runId: 'owner-A' }));
      process.stdout.write('PUBLISHED\\n');
      `,
      [lockPath, publishBarrier],
    );

    await owner.waitFor('CREATED');
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, 'utf8')).toBe('');

    // Steps 2/3: wait well past the retired 500 ms grace. The contender must
    // time out WITHOUT entering and WITHOUT deleting the lock.
    const started = Date.now();
    await expect(acquireGateLock({ lockPath, waitMs: 900, pollMs: 25, runId: 'contender-B' })).rejects.toThrow(
      /gate-lock/,
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(880);
    expect(existsSync(lockPath)).toBe(true);

    // Step 4: resume A; it must still own the gate.
    writeFileSync(publishBarrier, 'go');
    await owner.waitFor('PUBLISHED');
    const holder = readGateLock(lockPath);
    expect(holder.runId).toBe('owner-A');
    expect(holder.token).toBe('owner-A-token');
    await owner.done;
  }, 40000);

  /**
   * Codex item 1, step 5. Two contenders meeting one abandoned lock must BOTH
   * fail closed. Under the retired contract one or both would have reclaimed
   * it; admitting even one risks overlapping owners, because an unreachable
   * pid is not proof the owner is gone (pid reuse).
   */
  test('two contenders facing an abandoned lock both fail closed', async () => {
    const lockPath = freshLockPath();
    const barrier = path.join(scratch, 'start-barrier');

    const dead = spawnOwned(['-e', 'process.exit(0)']);
    await dead.exited;
    writeFileSync(
      lockPath,
      JSON.stringify({
        pid: dead.child.pid,
        token: 'leftover-token',
        startedAt: new Date().toISOString(),
        cwd: 'gone',
        runId: 'leftover',
      }),
    );

    const contenderSource = `
      import { existsSync } from 'node:fs';
      const [lockPath, barrier, label] = process.argv.slice(1);
      const { acquireGateLock } = await import(${JSON.stringify(gateLockUrl)});
      while (!existsSync(barrier)) { await new Promise(r => setTimeout(r, 5)); }
      try {
        await acquireGateLock({ lockPath, waitMs: 600, pollMs: 20, runId: label });
        process.stdout.write('ENTERED ' + label + '\\n');
      } catch {
        process.stdout.write('FAILED_CLOSED ' + label + '\\n');
      }
    `;

    const a = runNode(contenderSource, [lockPath, barrier, 'A']);
    const b = runNode(contenderSource, [lockPath, barrier, 'B']);
    await new Promise(r => setTimeout(r, 150));
    writeFileSync(barrier, 'go');

    const [ra, rb] = await Promise.all([a.done, b.done]);
    const combined = ra.out + rb.out;

    expect(combined).not.toMatch(/ENTERED/);
    expect(combined).toMatch(/FAILED_CLOSED A/);
    expect(combined).toMatch(/FAILED_CLOSED B/);
    expect(readGateLock(lockPath).token).toBe('leftover-token');
  }, 40000);

  test('an unreadable lock is waited on and then reported, never deleted', async () => {
    const lockPath = freshLockPath();
    writeFileSync(lockPath, '{not json');

    const started = Date.now();
    await expect(acquireGateLock({ lockPath, waitMs: 250, pollMs: 25, runId: 'impatient' })).rejects.toThrow(
      /gate-lock/,
    );
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(240);
    expect(elapsed).toBeLessThan(6000);
    expect(existsSync(lockPath)).toBe(true);
    expect(readFileSync(lockPath, 'utf8')).toBe('{not json');
  }, 20000);

  test('the error names the lock path so the maintenance step is actionable', async () => {
    const lockPath = freshLockPath();
    writeFileSync(lockPath, '{not json');
    await expect(acquireGateLock({ lockPath, waitMs: 120, pollMs: 20, runId: 'x' })).rejects.toThrow(
      new RegExp(lockPath.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')),
    );
  }, 20000);

  /** Codex item 1, step 6. Same pid, two acquisitions: only the token can tell them apart. */
  test('an old handle does not release a later acquisition in the same process', async () => {
    const lockPath = freshLockPath();

    const first = await acquireGateLock({ lockPath, waitMs: 1000, pollMs: 25, runId: 'first' });
    expect(first.release()).toBe(true);

    const second = await acquireGateLock({ lockPath, waitMs: 1000, pollMs: 25, runId: 'second' });
    expect(first.release()).toBe(false);
    expect(existsSync(lockPath)).toBe(true);
    expect(readGateLock(lockPath).runId).toBe('second');

    expect(second.release()).toBe(true);
    expect(existsSync(lockPath)).toBe(false);
  }, 20000);

  test('a live holder is waited for and the wait ends the moment it releases', async () => {
    const lockPath = freshLockPath();
    const releaseBarrier = path.join(scratch, 'release-barrier');

    const holder = runNode(
      `
      import { existsSync } from 'node:fs';
      const [lockPath, barrier] = process.argv.slice(1);
      const { acquireGateLock } = await import(${JSON.stringify(gateLockUrl)});
      const handle = await acquireGateLock({ lockPath, waitMs: 5000, pollMs: 20, runId: 'holder' });
      process.stdout.write('HELD\\n');
      while (!existsSync(barrier)) { await new Promise(r => setTimeout(r, 5)); }
      handle.release();
      process.stdout.write('RELEASED\\n');
      `,
      [lockPath, releaseBarrier],
    );

    await holder.waitFor('HELD');
    expect(readGateLock(lockPath).runId).toBe('holder');

    const waiter = acquireGateLock({ lockPath, waitMs: 8000, pollMs: 20, runId: 'waiter' });
    await new Promise(r => setTimeout(r, 200));
    writeFileSync(releaseBarrier, 'go');

    const handle = await waiter;
    expect(readGateLock(lockPath).runId).toBe('waiter');
    handle.release();
    await holder.done;
  }, 40000);
});
