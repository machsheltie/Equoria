/**
 * failLoudCleanup.mjs (Equoria-0y9f5)
 *
 * Fail-loud, scoped cleanup accumulator for real-DB integration suites.
 *
 * WHY THIS EXISTS — the defect class behind Equoria-0y9f5:
 *   Many backend integration suites do their afterAll cleanup like this:
 *
 *     afterAll(async () => {
 *       await prisma.user.deleteMany({ where: { id: { in: ids } } })
 *         .catch(err => console.warn(`[cleanup] ${err.message}`));
 *     });
 *
 *   The `.catch(... console.warn ...)` keeps the suite GREEN even when the
 *   delete failed — so fixtures leak into the CANONICAL database (.env.test
 *   points at the production DB per CLAUDE.md §2). A leaked row is exactly
 *   what later trips canonical sentinels (e.g. the NULL-phenotype sentinel
 *   Equoria-a429 / lfj5) and produces cross-suite flakes that look random.
 *   The warn is swallowed in CI logs and nobody notices until something
 *   downstream breaks.
 *
 *   The honest contract is: cleanup failure is a TEST FAILURE. If a suite
 *   could not delete its own fixtures, the suite must go red so the leak is
 *   fixed at the source — not papered over with a console.warn.
 *
 * WHAT THIS PROVIDES
 *   A tiny accumulator that:
 *     1. Lets a suite register one or more scoped cleanup callbacks during
 *        setup (each callback does its own `deleteMany({ where: { ... } })`).
 *     2. In afterAll, runs EVERY registered callback even if an earlier one
 *        throws (so partial cleanup still happens — a failure in step 1 does
 *        not strand the fixtures that step 2 would have removed).
 *     3. After running all of them, if ANY threw, throws a single aggregated
 *        error so afterAll fails LOUDLY. If none threw, resolves quietly.
 *
 *   Because it only throws inside `run()` (which the suite calls from
 *   afterAll), it never masks an earlier assertion failure in a test body —
 *   Jest reports the test failure first, then the afterAll cleanup failure.
 *
 * SCOPE DISCIPLINE (CLAUDE.md §2)
 *   This helper does NOT delete anything itself — it only sequences the
 *   callbacks you give it. Each callback MUST scope its own delete to the
 *   ids / name-prefix the suite created (`where: { id: { in: ids } }` or
 *   `where: { name: { startsWith: 'TestFixture-...' } }`). A bare
 *   `deleteMany()` inside a callback is still forbidden — this helper makes
 *   a real failure visible, it does not make a broad delete safe.
 *
 * USAGE
 *   import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
 *
 *   const cleanup = createCleanupTracker();
 *   const userIds = [];
 *
 *   beforeAll(async () => {
 *     const user = await prisma.user.create({ data: { ... } });
 *     userIds.push(user.id);
 *     // register a scoped cleanup; runs in afterAll, fails loud on error
 *     cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
 *   });
 *
 *   afterAll(() => cleanup.run());
 */

/**
 * Create a fail-loud cleanup tracker.
 *
 * @returns {{
 *   add: (fn: () => (void | Promise<void>), label?: string) => void,
 *   run: () => Promise<void>,
 *   size: () => number,
 * }}
 */
export function createCleanupTracker() {
  /** @type {{ fn: () => (void | Promise<void>), label: string }[]} */
  const tasks = [];

  return {
    /**
     * Register a scoped cleanup callback. Callbacks run in registration order
     * during `run()`. Each MUST scope its own delete (see module docs).
     *
     * @param {() => (void | Promise<void>)} fn Cleanup callback.
     * @param {string} [label] Optional human label used in aggregated errors.
     */
    add(fn, label) {
      if (typeof fn !== 'function') {
        throw new TypeError('createCleanupTracker().add: fn must be a function');
      }
      tasks.push({ fn, label: label ?? `cleanup#${tasks.length + 1}` });
    },

    /**
     * Run every registered cleanup callback. ALL callbacks run even if some
     * throw — so a failure in one does not strand the fixtures another would
     * have removed. After running them all, if any threw, throws ONE
     * aggregated error so afterAll fails loudly. Resolves quietly if all
     * succeeded.
     *
     * @returns {Promise<void>}
     */
    async run() {
      const failures = [];
      for (const { fn, label } of tasks) {
        try {
          // Await whether fn is sync or async.
          await fn();
        } catch (err) {
          failures.push({ label, err });
        }
      }
      // Empty the queue so a second run() (double afterAll) is a no-op.
      tasks.length = 0;

      if (failures.length > 0) {
        const detail = failures
          .map(({ label, err }) => `  - ${label}: ${err?.message ?? err}`)
          .join('\n');
        const aggregated = new Error(
          `Fail-loud cleanup: ${failures.length} cleanup task(s) failed — ` +
            'fixtures may have leaked into the canonical DB (CLAUDE.md §2). ' +
            `Fix the cleanup scope/ordering; do NOT swallow this.\n${detail}`,
        );
        // Attach the underlying errors for programmatic inspection / sentinels.
        aggregated.causes = failures.map(f => f.err);
        throw aggregated;
      }
    },

    /**
     * @returns {number} Number of cleanup callbacks currently registered.
     */
    size() {
      return tasks.length;
    },
  };
}

export default createCleanupTracker;
