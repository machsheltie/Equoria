/**
 * Sentinel for the sandbox-timer release contract (Equoria-k09r9).
 *
 * Measured 2026-09-14: a host timer created from inside a test file's sandbox
 * (express-rate-limit's unref'd MemoryStore sweep interval, one per limiter,
 * 11 per app.mjs import) kept the whole VM context alive after environment
 * teardown. The custom environment now clears whatever is still pending once
 * every suite hook has run. This sentinel proves both directions with Jest's
 * own post-teardown oracle (jest-leak-detector, the `--detectLeaks` engine):
 * the bare Node environment retains the context (the planted violation fires)
 * and the custom environment releases it.
 *
 * The oracle runs the detector over several forced collections (Equoria-dwicn):
 * jest-leak-detector forces one, which observes the release on Node 24 but not
 * on the Node 22 CI pins, where a released context needs a second cycle. Both
 * directions use the same oracle, so the planted violation — which no number
 * of collections can free — still fires.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import v8 from 'node:v8';
import vm from 'node:vm';
import LeakDetector from 'jest-leak-detector';
import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';
import PrismaCleanupEnvironment, { trackSandboxTimers } from '../tests/config/PrismaCleanupEnvironment.mjs';

const __filename = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(__filename), '..');

const projectConfig = {
  rootDir: backendRoot,
  testEnvironmentOptions: {},
  globals: {},
  injectGlobals: true,
  fakeTimers: { enableGlobally: false },
};
const environmentContext = { console, docblockPragmas: {}, testPath: __filename };
const NL = String.fromCharCode(10);

const LEAKY_SANDBOX_CODE = `
  globalThis.__payload = new Array(50000).fill('retained');
  globalThis.__sweep = setInterval(() => globalThis.__payload.length, 1e9);
  globalThis.__sweep.unref();
`;

const tick = promisify(setImmediate);

/**
 * Force one full garbage collection, the way jest-leak-detector does.
 */
function forceGarbageCollection() {
  const hidden = globalThis.gc === undefined || globalThis.gc === null;
  v8.setFlagsFromString('--expose-gc');
  vm.runInNewContext('gc')();
  if (hidden) {
    v8.setFlagsFromString('--no-expose-gc');
  }
}

// How many extra collections a released context is allowed to need before the
// oracle calls it retained. jest-leak-detector forces ONE collection plus one
// heap snapshot, which is enough on Node 24 but not on Node 22 — the version
// CI pins (NODE_VERSION 22.x in .github/workflows/test.yml) — where the
// released context needs a second cycle and the sentinel therefore failed on
// the runner while passing locally (Equoria-dwicn; measured 2026-09-15:
// released on the 1st extra round, planted violation still retained after 5).
// This does not soften the guard: a context something really holds survives
// every round, and the planted violation below proves that in the same run.
const GC_ROUNDS = 6;

async function environmentRetainedAfterTeardown(EnvironmentClass, sandboxCode) {
  let environment = new EnvironmentClass({ globalConfig: {}, projectConfig }, environmentContext);
  await environment.setup();
  vm.runInContext(sandboxCode, environment.getVmContext());
  // Watch the context's global object: that is what a pending timer retains.
  // (In a real run the sandbox's `jest` global links back to the runtime and
  // environment, which is why --detectLeaks sees the same retention.)
  const detector = new LeakDetector(environment.global);
  await environment.teardown();
  // Drop the last strong reference on purpose: the detector must see whether
  // anything else still holds the context.
  // eslint-disable-next-line no-useless-assignment
  environment = null;
  let retained = await detector.isLeaking();
  for (let round = 0; retained && round < GC_ROUNDS; round += 1) {
    forceGarbageCollection();
    for (let i = 0; i < 10; i += 1) {
      await tick();
    }
    retained = await detector.isLeaking();
  }
  return retained;
}

describe('sandbox timer release sentinel', () => {
  test('planted violation: the bare Node environment stays retained by an unref interval created in the sandbox', async () => {
    await expect(environmentRetainedAfterTeardown(NodeEnvironment, LEAKY_SANDBOX_CODE)).resolves.toBe(true);
  }, 60000);

  test('the custom environment releases the context by clearing the pending interval at teardown', async () => {
    await expect(environmentRetainedAfterTeardown(PrismaCleanupEnvironment, LEAKY_SANDBOX_CODE)).resolves.toBe(false);
  }, 60000);

  test('tracking clears only what is still pending and leaves ordinary timer semantics intact', async () => {
    const sandbox = { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate };
    const tracker = trackSandboxTimers(sandbox);
    let firedTimeout = 0;
    let firedInterval = 0;

    const fast = sandbox.setTimeout(() => {
      firedTimeout += 1;
    }, 5);
    const slow = sandbox.setInterval(() => {
      firedInterval += 1;
    }, 1e9);
    const cancelled = sandbox.setTimeout(() => {
      firedTimeout += 100;
    }, 5);
    sandbox.clearTimeout(cancelled);
    await promisify(setTimeout)(40);

    expect(firedTimeout).toBe(1);
    expect(fast.hasRef()).toBe(true);
    expect(tracker.trackedCount).toBe(3);

    const cleared = tracker.clearPending();
    await promisify(setTimeout)(10);

    expect(cleared).toBeGreaterThanOrEqual(1);
    expect(firedInterval).toBe(0);
    expect(tracker.trackedCount).toBe(0);
    expect(() => sandbox.clearInterval(slow)).not.toThrow();
  });

  test('the sandbox setTimeout keeps util.promisify support', async () => {
    const sandbox = { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate };
    trackSandboxTimers(sandbox);
    const started = Date.now();
    await promisify(sandbox.setTimeout)(5);
    expect(Date.now() - started).toBeGreaterThanOrEqual(4);
  });

  test('the custom environment disables the V8 compilation cache that pins vm module registries', () => {
    // Retainer path measured 2026-09-14: compilation cache -> script host-defined
    // options symbol -> Node vm moduleRegistries entry -> SourceTextModule ->
    // context. With the cache on, every finished file's context stayed alive.
    const source = readFileSync(path.join(backendRoot, 'tests/config/PrismaCleanupEnvironment.mjs'), 'utf8');
    expect(source).toContain(`${NL}v8.setFlagsFromString('--no-compilation-cache');${NL}`);
    expect(source.indexOf("v8.setFlagsFromString('--no-compilation-cache')")).toBeLessThan(
      source.indexOf('export default class PrismaCleanupEnvironment'),
    );
  });

  test('rateLimiting.mjs releases its Redis boot-race timer once the race settles', () => {
    const source = readFileSync(path.join(backendRoot, 'middleware/rateLimiting.mjs'), 'utf8');
    expect(source).toContain('redisBootTimeoutHandle = setTimeout(');
    expect(source).toContain(']).finally(() => clearTimeout(redisBootTimeoutHandle));');
  });
});
