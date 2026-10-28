/**
 * traitEventSeen — startup purge of the retired ultra-rare seen keys
 * (Equoria-o7c0x C).
 *
 * Equoria-tpofm. OLD CONTRACT: the module also kept a bounded seen-set
 * (readSeenIds / hasSeenEvent / markEventSeen, URT_SEEN_MAX; Equoria-o7c0x L7)
 * for the horse page's one-time ultra-rare reveal. NEW: the reveal was retired
 * (a59333a0f) and the invented ultra-rare traits removed (owner ruling
 * 2026-10-19), so those functions and their tests were deleted. The purge
 * below is unchanged.
 */

import { describe, it, expect } from 'vitest';
import { purgeOrphanedUrtSeenKeys, URT_SEEN_KEY } from '../traitEventSeen';

/**
 * Minimal Storage implementation (exposes .length / .key() as required by
 * purgeOrphanedUrtSeenKeys).
 */
function makeFakeStorage(initial?: Record<string, string>): Storage {
  const data: Record<string, string> = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    // Expose raw data for assertions (not part of Storage interface but convenient)
    _data: data,
  } as unknown as Storage & { _data: Record<string, string> };
}

// ---------------------------------------------------------------------------
// purgeOrphanedUrtSeenKeys — orphaned key cleanup (Equoria-o7c0x C)
//
// Sentinel-positive: the "removes old-format keys" test was confirmed to fail
// before purgeOrphanedUrtSeenKeys existed (red phase verified manually).
// ---------------------------------------------------------------------------
describe('purgeOrphanedUrtSeenKeys', () => {
  it('removes old-format urt-seen-<digits> keys', () => {
    const store = makeFakeStorage({
      'urt-seen-146323': '1',
      'urt-seen-99': '1',
      'urt-seen-12345': '1',
    });

    purgeOrphanedUrtSeenKeys(store);

    const rawData = (store as unknown as { _data: Record<string, string> })._data;
    expect(Object.keys(rawData)).toHaveLength(0);
  });

  it('preserves the new consolidated key urt-seen-ids (CRITICAL)', () => {
    const seenIdsValue = JSON.stringify([1, 2, 3]);
    const store = makeFakeStorage({
      'urt-seen-146323': '1',
      'urt-seen-99': '1',
      [URT_SEEN_KEY]: seenIdsValue, // must NOT be removed
    });

    purgeOrphanedUrtSeenKeys(store);

    expect(store.getItem(URT_SEEN_KEY)).toBe(seenIdsValue);
    const rawData = (store as unknown as { _data: Record<string, string> })._data;
    expect('urt-seen-146323' in rawData).toBe(false);
    expect('urt-seen-99' in rawData).toBe(false);
  });

  it('leaves unrelated localStorage keys untouched', () => {
    const store = makeFakeStorage({
      'urt-seen-1': '1',
      'some-other-key': 'value',
      theme: 'dark',
    });

    purgeOrphanedUrtSeenKeys(store);

    expect(store.getItem('some-other-key')).toBe('value');
    expect(store.getItem('theme')).toBe('dark');
  });

  it('is idempotent — safe to call multiple times', () => {
    const store = makeFakeStorage({
      'urt-seen-1': '1',
      [URT_SEEN_KEY]: '[1]',
    });

    purgeOrphanedUrtSeenKeys(store);
    purgeOrphanedUrtSeenKeys(store); // second call must not throw

    expect(store.getItem(URT_SEEN_KEY)).toBe('[1]');
    const rawData = (store as unknown as { _data: Record<string, string> })._data;
    expect('urt-seen-1' in rawData).toBe(false);
  });

  it('handles empty storage without throwing', () => {
    const store = makeFakeStorage({});
    expect(() => purgeOrphanedUrtSeenKeys(store)).not.toThrow();
  });

  it('does not match urt-seen-ids via the regex (sanity check)', () => {
    // Verify our regex contract in isolation — if this fails the safety
    // assumption of the whole cleanup is broken.
    const OLD_PATTERN = /^urt-seen-\d+$/;
    expect(OLD_PATTERN.test('urt-seen-ids')).toBe(false);
    expect(OLD_PATTERN.test('urt-seen-146323')).toBe(true);
    expect(OLD_PATTERN.test('urt-seen-0')).toBe(true);
    expect(OLD_PATTERN.test('urt-seen-')).toBe(false); // no digits
  });
});
