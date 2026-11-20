#!/usr/bin/env node
/**
 * Free-memory preflight for local backend test runs (Equoria-8w3ax).
 *
 * The dev laptop has 16 GB and often little of it free (Claude sessions, the
 * IDE and the browser hold most of it). Starting Jest on top of that drove the
 * machine out of memory on 2026-11-20 (git "Out of memory, malloc failed",
 * bash fork failures). So a run first checks free physical memory
 * (os.freemem(), which on Windows is the "Available" figure): when it is below
 * the profile's threshold it waits a short, bounded time for memory to come
 * back, then refuses with a clear message instead of starting.
 *
 * Profiles (minimum free MB):
 *   targeted  1536  — `npm run test:backend:targeted` (npm pre-script)
 *   full      3072  — the sharded gate, checked after it is admitted
 *
 * Environment overrides:
 *   EQUORIA_TEST_MIN_FREE_MB          minimum free MB for any profile
 *   EQUORIA_TEST_MEMORY_WAIT_SECONDS  how long to wait for memory (default 60)
 * Both must be whole numbers; 0 for the minimum disables the check.
 *
 * Worker caps and heap limits are unchanged; this only decides whether to
 * start.
 */
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const memoryProfiles = { targeted: 1536, full: 3072 };
const defaultWaitSeconds = 60;
const pollSeconds = 5;
const megabyte = 1024 * 1024;

function wholeNumber(name, raw) {
  if (!/^\d+$/.test(String(raw).trim())) {
    throw new Error(`${name} must be a whole number; received ${JSON.stringify(raw)}`);
  }
  return Number.parseInt(raw, 10);
}

/** The minimum free MB and wait for one profile, after environment overrides. */
export function readMemoryBudget(profile, env = process.env) {
  if (!Object.hasOwn(memoryProfiles, profile)) {
    throw new Error(
      `unknown memory profile ${JSON.stringify(profile)}; use one of ${Object.keys(memoryProfiles).join(', ')}`,
    );
  }
  const minRaw = env.EQUORIA_TEST_MIN_FREE_MB;
  const waitRaw = env.EQUORIA_TEST_MEMORY_WAIT_SECONDS;
  return {
    profile,
    minFreeMb:
      minRaw === undefined || minRaw === ''
        ? memoryProfiles[profile]
        : wholeNumber('EQUORIA_TEST_MIN_FREE_MB', minRaw),
    waitSeconds:
      waitRaw === undefined || waitRaw === ''
        ? defaultWaitSeconds
        : wholeNumber('EQUORIA_TEST_MEMORY_WAIT_SECONDS', waitRaw),
  };
}

const sleep = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

/**
 * Wait (bounded) until free memory reaches the budget. Resolves
 * { ok, freeMb, minFreeMb, waitedSeconds }. `freeBytes` and `pause` are
 * parameters so the decision can be exercised without the real clock.
 */
export async function waitForFreeMemory(
  budget,
  { freeBytes = os.freemem, pause = sleep, log = () => {} } = {},
) {
  const { minFreeMb, waitSeconds } = budget;
  let waited = 0;
  let freeMb = Math.floor(freeBytes() / megabyte);
  while (freeMb < minFreeMb && waited < waitSeconds) {
    if (waited === 0) {
      log(
        `[memory] ${freeMb} MB free, ${budget.profile} test runs need ${minFreeMb} MB; ` +
          `waiting up to ${waitSeconds}s for memory to free up...`,
      );
    }
    const step = Math.min(pollSeconds, waitSeconds - waited);
    await pause(step * 1000);
    waited += step;
    freeMb = Math.floor(freeBytes() / megabyte);
  }
  return { ok: freeMb >= minFreeMb, freeMb, minFreeMb, waitedSeconds: waited };
}

export function refusalMessage(budget, result) {
  return (
    `[memory] Refusing to start ${budget.profile} tests: only ${result.freeMb} MB of memory is free ` +
    `(need ${result.minFreeMb} MB; waited ${result.waitedSeconds}s). Close something heavy ` +
    '(another test run, a browser, an idle Claude session) and try again. ' +
    'EQUORIA_TEST_MIN_FREE_MB and EQUORIA_TEST_MEMORY_WAIT_SECONDS change the limits.'
  );
}

/** Throws the refusal when memory does not recover in time. */
export async function assertFreeMemory(profile, { env = process.env, log = console.log } = {}) {
  const budget = readMemoryBudget(profile, env);
  const result = await waitForFreeMemory(budget, { log });
  if (!result.ok) {
    throw new Error(refusalMessage(budget, result));
  }
  log(`[memory] ${result.freeMb} MB free (${profile} needs ${result.minFreeMb} MB); starting.`);
  return result;
}

async function main(argv = process.argv.slice(2)) {
  const profileArg = argv.find(arg => arg.startsWith('--profile='));
  await assertFreeMemory(profileArg ? profileArg.slice('--profile='.length) : 'targeted');
}

// Windows-safe main-module guard (CONTRIBUTING.md "CLI scripts").
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
