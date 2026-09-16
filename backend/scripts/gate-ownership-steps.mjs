/**
 * Cleanup steps for a sharded-runner gate owner (Equoria-hqrqk).
 *
 * Extracted from run-suite-sharded.mjs so the runner stays under the 600-line
 * production threshold without a baseline exception. The steps run inside
 * createOwnershipLifecycle() (scripts/gate-lock.mjs), in this order:
 *
 *   1. owned-children  — stop and AWAIT every Jest shard AND every provisioning
 *                        subprocess (migrate/seed, registered by
 *                        test-lane-db.mjs). Nothing may still be writing to a
 *                        lane database when step 2 drops it.
 *   2. lane-databases  — wait for any in-flight provisioning, then drop every
 *                        registered lane database. Every drop is attempted even
 *                        after one fails; failed identities are preserved in
 *                        the thrown message.
 *
 * A thrown step makes the lifecycle RETAIN the gate lock and report the
 * failure; it never releases on an incomplete cleanup.
 */
import { stopOwnedChildren } from './gate-lock.mjs';

/**
 * @param {object} deps
 * @param {Set<import('node:child_process').ChildProcess>} deps.ownedChildren
 * @param {Set<import('node:child_process').ChildProcess>} deps.provisioningChildren
 * @param {Set<string>} deps.ownedLaneDbs  database names registered BEFORE creation
 * @param {() => Promise<unknown> | null} deps.getProvisioningInFlight
 * @param {(opts: { name: string, log: Function }) => Promise<void>} deps.destroyLaneDatabase
 * @param {Function} [deps.log]
 * @param {number} [deps.escalateAfterMs]
 */
export function buildOwnershipSteps({
  ownedChildren,
  provisioningChildren,
  ownedLaneDbs,
  getProvisioningInFlight,
  destroyLaneDatabase,
  log = () => {},
  escalateAfterMs = 15000,
}) {
  return [
    {
      name: 'owned-children',
      run: async () => {
        const { failed } = await stopOwnedChildren([...ownedChildren, ...provisioningChildren], {
          escalateAfterMs,
          log,
        });
        if (failed.length > 0) {
          throw new Error(`owned children still running: ${failed.join(', ')}`);
        }
      },
    },
    {
      name: 'lane-databases',
      run: async () => {
        // Wait for any in-flight provisioning FIRST, so destruction can never
        // race creation of the same database.
        const inFlight = getProvisioningInFlight();
        if (inFlight) {
          try {
            await inFlight;
          } catch (error) {
            // A failed creation may still have left the database behind; its
            // identity was registered before creation began, so it is dropped
            // below like any other owned resource.
            log(`[shard] provisioning had failed (${error.message}); dropping what it left`);
          }
        }

        const failures = [];
        for (const name of [...ownedLaneDbs]) {
          try {
            await destroyLaneDatabase({ name, log });
            ownedLaneDbs.delete(name);
          } catch (error) {
            failures.push(`${name} (${error.message})`);
          }
        }
        if (failures.length > 0) {
          throw new Error(`failed to drop lane database(s): ${failures.join('; ')}`);
        }
      },
    },
  ];
}
