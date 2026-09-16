#!/usr/bin/env node
/**
 * Bounded real-runner admission harness (Equoria-hqrqk; Codex review
 * 2026-09-16 round 2, item 1).
 *
 * Proves, against the ACTUAL scripts/run-suite-sharded.mjs process:
 *   1. a runner started while another process holds the gate does NOT begin
 *      discovery (`jest --listTests`) until it is admitted, then completes
 *      and releases the gate;
 *   2. a completed run leaves no gate lock and prints no retention warning.
 *
 * WHY THIS IS A SCRIPT AND NOT A JEST SUITE: the earlier version lived in
 * backend/__tests__ and spawned a runner from inside a Jest process. During a
 * two-lane gate that meant a THIRD Jest process — 768 + 768 + 1536 MiB of
 * configured heap on a two-worker machine. An isolated lock path isolates the
 * lock; it does not isolate machine resources.
 *
 * RESOURCE COORDINATION, explicit: this harness first acquires the MACHINE
 * gate lock (DEFAULT_LOCK_PATH, bounded wait) and holds it for its whole run.
 * No cooperating gate can therefore start beside it, and the nested runner it
 * spawns is the only Jest process it owns. The nested runner's own lock lives
 * under an isolated TEMP so it never collides with the one this harness holds.
 *
 * Every child carries a finite deadline (spawn `timeout` + SIGKILL) and is
 * terminated and awaited in `finally`, whatever happened before.
 *
 * Usage:  node scripts/verify-gate-admission.mjs        (from backend/)
 *         npm run verify:gate-admission
 * Exit:   0 on both checks passing; 1 otherwise.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGateLock, DEFAULT_LOCK_PATH } from './gate-lock.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(BACKEND, 'scripts', 'run-suite-sharded.mjs');
const CHILD_DEADLINE_MS = 5 * 60 * 1000;
const PATTERN = 'gateLockOwnership';

function spawnBounded(args, env, owned) {
  const child = spawn(process.execPath, args, {
    cwd: BACKEND,
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

async function waitFor(read, needle, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (read().includes(needle)) {
      return true;
    }
    await new Promise(r => setTimeout(r, 25));
  }
  return false;
}

async function drain(owned) {
  for (const { child } of owned) {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }
  await Promise.all(owned.map(o => o.exited));
}

function check(condition, message, failures) {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    console.log(`  FAIL ${message}`);
    failures.push(message);
  }
}

async function admissionCheck(scratch, failures) {
  const owned = [];
  const tempDir = path.join(scratch, 'admission');
  mkdirSync(tempDir, { recursive: true });
  const isolatedLock = path.join(tempDir, 'equoria-backend-gate.lock');
  const env = { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir };

  console.log('[verify-gate-admission] check 1: discovery waits for admission');
  // This process is the holder of the ISOLATED lock the nested runner will see.
  const held = await acquireGateLock({
    lockPath: isolatedLock,
    waitMs: 10000,
    pollMs: 25,
    runId: 'verify-gate-admission-holder',
  });
  try {
    const runner = spawnBounded([RUNNER, '--lanes=1', PATTERN], env, owned);

    const discoveredEarly = await waitFor(runner.read, 'test files in', 4000);
    check(!discoveredEarly, 'runner did not begin discovery while the gate was held', failures);

    held.release();

    const discoveredLater = await waitFor(runner.read, 'test files in', 120000);
    check(discoveredLater, 'runner began discovery once admitted', failures);

    const result = await runner.done;
    check(result.code === 0, `runner exited 0 (got ${result.code})`, failures);
    check(!existsSync(isolatedLock), 'runner released the gate it was admitted to', failures);
  } finally {
    held.release();
    await drain(owned);
  }
}

async function completionCheck(scratch, failures) {
  const owned = [];
  const tempDir = path.join(scratch, 'completion');
  mkdirSync(tempDir, { recursive: true });
  const isolatedLock = path.join(tempDir, 'equoria-backend-gate.lock');
  const env = { TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir };

  console.log('[verify-gate-admission] check 2: a completed run leaves nothing behind');
  try {
    const runner = spawnBounded([RUNNER, '--lanes=1', PATTERN], env, owned);
    const result = await runner.done;
    check(result.code === 0, `runner exited 0 (got ${result.code})`, failures);
    check(/reconciled/.test(result.out), 'accounting reconciled', failures);
    check(!existsSync(isolatedLock), 'no gate lock left behind', failures);
    check(!/RETAINED/.test(result.out), 'no retention warning printed', failures);
  } finally {
    await drain(owned);
  }
}

export async function main() {
  const failures = [];
  const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-verify-gate-admission-'));

  // Explicit resource coordination: hold the MACHINE gate for the whole run so
  // the nested runner is the only Jest process this harness ever owns.
  console.log(`[verify-gate-admission] acquiring the machine gate lock at ${DEFAULT_LOCK_PATH}`);
  const machineGate = await acquireGateLock({
    waitMs: 5 * 60 * 1000,
    runId: 'verify-gate-admission',
    log: line => console.log(line),
  });
  try {
    await admissionCheck(scratch, failures);
    await completionCheck(scratch, failures);
  } finally {
    machineGate.release();
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
  }

  if (failures.length > 0) {
    console.error(`[verify-gate-admission] ${failures.length} check(s) FAILED`);
    for (const f of failures) {
      console.error(`  - ${f}`);
    }
    return 1;
  }
  console.log('[verify-gate-admission] all checks passed');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
