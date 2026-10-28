/**
 * traitEventSeen — localStorage hygiene left from the retired ultra-rare reveal.
 *
 * The horse page once showed a one-time ultra-rare trait reveal and remembered
 * which events a player had seen, first as one key per event id
 * (`urt-seen-<id>`), later as one bounded key (`urt-seen-ids`, Equoria-o7c0x
 * L7). The reveal was retired (a59333a0f) and its seen-set functions were
 * deleted with the invented exotic traits (Equoria-tpofm; owner ruling
 * 2026-10-19). Only the startup purge of the old per-id keys remains.
 */

/** localStorage key the retired consolidated seen-set used. */
export const URT_SEEN_KEY = 'urt-seen-ids';

/**
 * Regex matching ONLY the OLD per-event-id key format: `urt-seen-<digits>`.
 *
 * Critically, this does NOT match the current consolidated key `urt-seen-ids`
 * because `ids` is not a digit-only string (`\d+` requires [0-9]+).
 * Verified: `OLD_URT_SEEN_PATTERN.test('urt-seen-ids')` → false.
 * (Equoria-o7c0x C)
 */
const OLD_URT_SEEN_PATTERN = /^urt-seen-\d+$/;

/**
 * One-time idempotent cleanup: removes orphaned per-id localStorage keys left
 * by the pre-L7 implementation (keys of the form `urt-seen-<digits>`).
 *
 * The L7 fix consolidated all seen-ids into the single bounded key `urt-seen-ids`.
 * Existing users may have dozens of orphaned old-format keys that are never read
 * and grow unboundedly until cleared.
 *
 * Safety guarantees:
 * - Never removes `urt-seen-ids` (the current consolidated key) — the regex
 *   `^urt-seen-\d+$` requires a digit-only suffix; `ids` does not match.
 * - Never removes unrelated keys (matches only the `urt-seen-<digits>` prefix).
 * - Fully wrapped: any localStorage error (SecurityError, private mode) is
 *   silently swallowed — this must never throw or break the page.
 * - Idempotent: safe to call multiple times; a second call finds nothing to remove.
 *
 * Accepts an optional `storage` argument (defaults to `window.localStorage`) so
 * tests can inject a fake without touching the real browser storage.
 */
export function purgeOrphanedUrtSeenKeys(storage?: Storage): void {
  try {
    const store = storage ?? window.localStorage;
    const toDelete: string[] = [];

    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key !== null && OLD_URT_SEEN_PATTERN.test(key)) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      store.removeItem(key);
    }
  } catch {
    /* localStorage inaccessible (SecurityError in sandboxed iframe etc.) — silently skip */
  }
}
