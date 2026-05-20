/**
 * traitEventSeen — bounded localStorage seen-set for ultra-rare trait events.
 *
 * Security / hygiene (Equoria-o7c0x L7 / CWE-400-ish):
 * The previous approach wrote one localStorage key per event id
 * (`urt-seen-<id>`). Because event ids are unique integers that grow
 * unboundedly (one per milestone reveal, per horse, over the life of an
 * account), this produced an unbounded number of localStorage keys.
 *
 * This module replaces that approach with a single key
 * (`urt-seen-ids`) that stores a bounded JSON array of the MAX_SEEN most
 * recently seen event ids. When the array exceeds MAX_SEEN the oldest
 * entries are evicted (FIFO). The effective behaviour is identical from
 * the player's perspective: a given event id is never shown twice —
 * ultra-rare events are rare enough that the cap (100) will never be
 * reached in practice, and even if it were, the oldest events would not
 * be displayed again (they no longer appear in the `recentEvents` API
 * response which is itself bounded on the backend).
 *
 * The functions are intentionally pure (accept a storage interface so
 * tests can inject a fake without touching window.localStorage) to enable
 * clean vitest coverage.
 */

/** Maximum number of event ids retained in the seen-set. */
export const URT_SEEN_MAX = 100;

/** localStorage key used for the consolidated seen-set. */
export const URT_SEEN_KEY = 'urt-seen-ids';

/**
 * Minimal localStorage-compatible interface so the functions can be
 * tested with a plain in-memory object.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Read the current seen-ids array from storage.
 * Returns an empty array on any parse or access error (fail-safe).
 */
export function readSeenIds(storage: StorageLike): number[] {
  try {
    const raw = storage.getItem(URT_SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate each element is a finite integer — reject any corrupted entry.
    return parsed.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  } catch {
    return [];
  }
}

/**
 * Returns true if the given event id is in the seen-set.
 */
export function hasSeenEvent(storage: StorageLike, eventId: number): boolean {
  return readSeenIds(storage).includes(eventId);
}

/**
 * Mark an event as seen.
 * Appends the id to the seen-set and evicts the oldest entries if the
 * array exceeds URT_SEEN_MAX.  Writes atomically (read-modify-write).
 * Does nothing on storage write error (fail-safe — same behaviour as
 * the previous catch block in dismissUltraRareReveal).
 */
export function markEventSeen(storage: StorageLike, eventId: number): void {
  try {
    const current = readSeenIds(storage);
    if (current.includes(eventId)) return; // already present, no-op

    // Append and evict from the front if over cap.
    const updated = [...current, eventId];
    const bounded = updated.length > URT_SEEN_MAX ? updated.slice(updated.length - URT_SEEN_MAX) : updated;

    storage.setItem(URT_SEEN_KEY, JSON.stringify(bounded));
  } catch {
    /* storage write failed (private mode quota etc.) — silently skip */
  }
}
