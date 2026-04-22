/**
 * Env snapshot/restore helper — prevents cross-file env contamination.
 *
 * Use inside any test suite that mutates `process.env.*`. Snapshot in
 * beforeEach/beforeAll, restore in afterEach/afterAll. The implementation
 * replaces `process.env` wholesale, which correctly deletes keys that the
 * test ADDED (a plain `Object.assign(process.env, saved)` would leave
 * newly-added keys behind).
 *
 * Example:
 *   import { snapshotEnv, restoreEnv } from '../helpers/envSnapshot.mjs';
 *
 *   let envSnap;
 *   beforeEach(() => { envSnap = snapshotEnv(); });
 *   afterEach(() => { restoreEnv(envSnap); });
 *
 * @module tests/helpers/envSnapshot
 */

/**
 * Capture a shallow copy of `process.env` for later restoration.
 *
 * @returns {Record<string, string | undefined>}
 */
export function snapshotEnv() {
  return { ...process.env };
}

/**
 * Restore `process.env` to a previously-captured snapshot, dropping any
 * keys added since the snapshot was taken.
 *
 * @param {Record<string, string | undefined>} snapshot
 */
export function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
