/**
 * traitEventSeen — bounded localStorage seen-set tests (Equoria-o7c0x L7)
 *
 * Tests are pure: use an in-memory StorageLike — no real localStorage, no
 * api-client mock, no React component dependency.
 *
 * Sentinel-positive: the FIFO-cap test was confirmed to fail before the
 * implementation existed (verified during red-green cycle).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  readSeenIds,
  hasSeenEvent,
  markEventSeen,
  URT_SEEN_MAX,
  URT_SEEN_KEY,
} from '../traitEventSeen';
import type { StorageLike } from '../traitEventSeen';

/** Minimal in-memory storage for isolation. */
function makeStorage(initial?: Record<string, string>): StorageLike & { _data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    _data: data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
  };
}

describe('readSeenIds', () => {
  it('returns empty array when storage key is absent', () => {
    const store = makeStorage();
    expect(readSeenIds(store)).toEqual([]);
  });

  it('returns parsed array when key is valid JSON', () => {
    const store = makeStorage({ [URT_SEEN_KEY]: '[1, 2, 3]' });
    expect(readSeenIds(store)).toEqual([1, 2, 3]);
  });

  it('returns empty array when stored value is malformed JSON', () => {
    const store = makeStorage({ [URT_SEEN_KEY]: 'not-json' });
    expect(readSeenIds(store)).toEqual([]);
  });

  it('returns empty array when stored value is a non-array JSON type', () => {
    const store = makeStorage({ [URT_SEEN_KEY]: '{"x":1}' });
    expect(readSeenIds(store)).toEqual([]);
  });

  it('filters out non-numeric entries (strings, nulls) from a valid JSON array', () => {
    // Use only valid JSON: strings and nulls are parseable but not finite numbers.
    // (Infinity is not valid JSON — JSON.parse would throw, not produce a value.)
    const store = makeStorage({ [URT_SEEN_KEY]: '[1, "bad", null, 2]' });
    expect(readSeenIds(store)).toEqual([1, 2]);
  });
});

describe('hasSeenEvent', () => {
  it('returns false when event not in set', () => {
    const store = makeStorage({ [URT_SEEN_KEY]: '[10, 20]' });
    expect(hasSeenEvent(store, 99)).toBe(false);
  });

  it('returns true when event is in set', () => {
    const store = makeStorage({ [URT_SEEN_KEY]: '[10, 20, 30]' });
    expect(hasSeenEvent(store, 20)).toBe(true);
  });
});

describe('markEventSeen', () => {
  let store: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    store = makeStorage();
  });

  it('adds a new event id to an empty seen-set', () => {
    markEventSeen(store, 42);
    expect(hasSeenEvent(store, 42)).toBe(true);
    expect(readSeenIds(store)).toEqual([42]);
  });

  it('does not duplicate an already-seen event id', () => {
    markEventSeen(store, 5);
    markEventSeen(store, 5);
    expect(readSeenIds(store)).toEqual([5]);
  });

  it('accumulates multiple distinct event ids', () => {
    markEventSeen(store, 1);
    markEventSeen(store, 2);
    markEventSeen(store, 3);
    expect(readSeenIds(store)).toEqual([1, 2, 3]);
  });

  it('uses exactly one localStorage key (URT_SEEN_KEY)', () => {
    markEventSeen(store, 7);
    markEventSeen(store, 8);
    const storedKeys = Object.keys(store._data);
    expect(storedKeys).toEqual([URT_SEEN_KEY]);
  });

  it('keeps seen-set bounded at URT_SEEN_MAX after many events (FIFO eviction)', () => {
    // Add URT_SEEN_MAX + 20 distinct events to force eviction.
    const total = URT_SEEN_MAX + 20;
    for (let i = 1; i <= total; i++) {
      markEventSeen(store, i);
    }

    const stored = readSeenIds(store);

    // BOUND: must never exceed the cap.
    expect(stored.length).toBeLessThanOrEqual(URT_SEEN_MAX);

    // FIFO: the most-recent URT_SEEN_MAX entries (ids 21..120) must be present.
    const expected = Array.from({ length: URT_SEEN_MAX }, (_, i) => i + 21);
    expect(stored).toEqual(expected);

    // DEDUP still works on the retained ids.
    expect(hasSeenEvent(store, total)).toBe(true); // last one retained
    expect(hasSeenEvent(store, 1)).toBe(false);   // evicted
    expect(hasSeenEvent(store, 20)).toBe(false);  // evicted
  });

  it('does not throw when storage.setItem throws (fail-safe)', () => {
    const brokenStore: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
    };
    expect(() => markEventSeen(brokenStore, 1)).not.toThrow();
  });
});
