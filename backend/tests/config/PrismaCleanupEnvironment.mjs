/**
 * Jest environment that drains Prisma and releases sandbox-created host
 * timers after all suite-owned hooks complete.
 *
 * Timers (Equoria-k09r9, measured 2026-09-14): the sandbox's setTimeout /
 * setInterval / setImmediate are the HOST functions — jest-environment-node
 * exposes Node globals to the sandbox by getter. A timer created from inside a
 * test file holds its callback, the callback holds sandbox-compiled closures,
 * and those hold the file's entire VM context (module registry + app graph)
 * after teardown. `unref()` only detaches a timer from event-loop exit; it does
 * not release that reference. Measured on one app.mjs import: 11 unref'd
 * 15-minute intervals (express-rate-limit MemoryStore, one per limiter) and
 * one 5-second boot-race timeout, which kept every app-importing suite
 * resident (~134MB per file post-teardown on the 5-file probe). That
 * retention is what the serial gate shards around.
 *
 * Once every suite hook and the Prisma drain have finished, a timer that is
 * still pending is orphaned work by definition, so it is cleared here and the
 * context becomes collectable. Fired timeouts are not retained by the
 * tracker: handles are held through WeakRefs, so only timers Node itself still
 * holds (pending) survive to teardown.
 *
 * Known limitation: timers created through `import { setTimeout } from
 * 'node:timers'` or restored raw by fake-timer uninstall bypass the sandbox
 * global and are not tracked. The measured retainers use the globals.
 * Sentinel: backend/__tests__/testEnvironmentTimerRelease.sentinel.test.mjs.
 */
import v8 from 'node:v8';
import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';
import { cleanupPrismaInstances } from '../../../packages/database/prismaTestLifecycle.mjs';

// Second, independent retainer (Equoria-k09r9, heap-snapshot retainer path
// 2026-09-14): V8's compilation cache keeps each compiled script together with
// its host-defined options, and under --experimental-vm-modules that options
// symbol is the key of Node's vm `moduleRegistries` WeakMap entry, whose value
// holds the file's SourceTextModule and therefore its context. With the cache
// on, every finished file's context stayed alive in sequence even after all
// timers were released (4/4 previous globals alive, heap 783MB after five
// suites); with it off they collect (0/4 alive, 50MB). The cache only helps
// when identical source is compiled again in the same isolate, which Jest
// never benefits from across sandboxes; the measured wall time was unchanged.
// Set here, in the host realm, so every backend Jest process — in-band or
// worker — gets it through the one module they all load.
v8.setFlagsFromString('--no-compilation-cache');

const TIMER_GLOBALS = [
  ['setTimeout', 'clearTimeout'],
  ['setInterval', 'clearInterval'],
  ['setImmediate', 'clearImmediate'],
];
const PRUNE_THRESHOLD = 4096;

/**
 * Wrap the sandbox's timer globals so every handle created from inside the
 * sandbox can be released at teardown. Returns the tracker; exported so the
 * sentinel can exercise it against a bare environment.
 */
export function trackSandboxTimers(sandboxGlobal) {
  const pending = new Map(); // WeakRef<handle> -> clear function

  const prune = () => {
    if (pending.size < PRUNE_THRESHOLD) {
      return;
    }
    for (const ref of pending.keys()) {
      if (ref.deref() === undefined) {
        pending.delete(ref);
      }
    }
  };

  for (const [setName, clearName] of TIMER_GLOBALS) {
    const realSet = sandboxGlobal[setName];
    const realClear = sandboxGlobal[clearName];
    if (typeof realSet !== 'function' || typeof realClear !== 'function') {
      continue;
    }

    const trackedSet = function trackedSet(...args) {
      const handle = realSet.apply(this, args);
      if (handle !== null && typeof handle === 'object') {
        prune();
        pending.set(new WeakRef(handle), realClear);
      }
      return handle;
    };
    // Preserve util.promisify.custom and any other own properties so
    // `util.promisify(setTimeout)` keeps working inside the sandbox.
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(realSet))) {
      if (!['length', 'name', 'prototype'].includes(key)) {
        Object.defineProperty(trackedSet, key, descriptor);
      }
    }
    for (const symbol of Object.getOwnPropertySymbols(realSet)) {
      Object.defineProperty(trackedSet, symbol, Object.getOwnPropertyDescriptor(realSet, symbol));
    }

    sandboxGlobal[setName] = trackedSet;
  }

  return {
    get trackedCount() {
      return pending.size;
    },
    clearPending() {
      let cleared = 0;
      for (const [ref, clear] of pending) {
        const handle = ref.deref();
        if (handle !== undefined) {
          clear(handle);
          cleared += 1;
        }
      }
      pending.clear();
      return cleared;
    },
  };
}

export default class PrismaCleanupEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    this._sandboxTimers = trackSandboxTimers(this.global);
  }

  async teardown() {
    const failures = [];

    try {
      await cleanupPrismaInstances(this.global);
    } catch (error) {
      failures.push(error);
      try {
        await cleanupPrismaInstances(this.global);
      } catch (retryError) {
        failures.push(retryError);
      }
    }

    // Release host timers still pending after every suite hook and the Prisma
    // drain have completed (see header). Runs before the base teardown so the
    // context is unreferenced by the time Jest's leak detector inspects it.
    try {
      this._sandboxTimers?.clearPending();
      this._sandboxTimers = null;
    } catch (error) {
      failures.push(error);
    }

    try {
      await super.teardown();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Prisma and Jest environment teardown both failed');
    }
  }
}
