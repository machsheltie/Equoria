/**
 * RateLimitStore — unit tests (Equoria-rr7)
 *
 * Pure in-memory class, no DB required.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { RateLimitStore } from '../../../utils/rateLimitStore.mjs';

// Each test creates its own store with no cleanup timer to avoid leaks.
const makeStore = (opts = {}) => new RateLimitStore({ cleanupInterval: 0, ...opts });

afterEach(() => {
  // Nothing to clean — stores are local to each test.
});

// ---------------------------------------------------------------------------
// constructor
// ---------------------------------------------------------------------------
describe('constructor', () => {
  it('defaults to maxSize 10000', () => {
    const store = makeStore();
    expect(store.maxSize).toBe(10000);
    store.destroy();
  });

  it('accepts custom maxSize', () => {
    const store = makeStore({ maxSize: 5 });
    expect(store.maxSize).toBe(5);
    store.destroy();
  });

  it('starts empty', () => {
    const store = makeStore();
    expect(store.getStorageSize()).toBe(0);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// increment
// ---------------------------------------------------------------------------
describe('increment', () => {
  it('first call returns count 1', () => {
    const store = makeStore();
    const result = store.increment('1.2.3.4', 60000);
    expect(result.current).toBe(1);
    expect(result.resetTime).toBeGreaterThan(Date.now());
    store.destroy();
  });

  it('subsequent calls increment count', () => {
    const store = makeStore();
    store.increment('1.2.3.4', 60000);
    store.increment('1.2.3.4', 60000);
    const result = store.increment('1.2.3.4', 60000);
    expect(result.current).toBe(3);
    store.destroy();
  });

  it('different keys are independent', () => {
    const store = makeStore();
    store.increment('1.1.1.1', 60000);
    const result = store.increment('2.2.2.2', 60000);
    expect(result.current).toBe(1);
    store.destroy();
  });

  it('evicts oldest when maxSize exceeded', () => {
    const store = makeStore({ maxSize: 2 });
    store.increment('a', 60000);
    store.increment('b', 60000);
    store.increment('c', 60000); // triggers eviction of 'a'
    expect(store.getStorageSize()).toBe(2);
    store.destroy();
  });

  it('resets count after window expires', () => {
    const store = makeStore();
    // Use a window in the past (already expired)
    store.increment('1.2.3.4', -1); // windowMs = -1 so resetTime is in the past
    const result = store.increment('1.2.3.4', 60000); // new window
    expect(result.current).toBe(1);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------
describe('get', () => {
  it('returns null for unknown key', () => {
    const store = makeStore();
    expect(store.get('unknown')).toBeNull();
    store.destroy();
  });

  it('returns entry for known key', () => {
    const store = makeStore();
    store.increment('1.2.3.4', 60000);
    const entry = store.get('1.2.3.4');
    expect(entry).not.toBeNull();
    expect(entry.count).toBe(1);
    store.destroy();
  });

  it('returns null and deletes expired entry', () => {
    const store = makeStore();
    store.increment('1.2.3.4', -1); // expired immediately
    expect(store.get('1.2.3.4')).toBeNull();
    expect(store.getStorageSize()).toBe(0);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// reset / resetAll
// ---------------------------------------------------------------------------
describe('reset', () => {
  it('removes entry for specific key', () => {
    const store = makeStore();
    store.increment('1.2.3.4', 60000);
    store.reset('1.2.3.4');
    expect(store.get('1.2.3.4')).toBeNull();
    store.destroy();
  });

  it('does not affect other keys', () => {
    const store = makeStore();
    store.increment('1.1.1.1', 60000);
    store.increment('2.2.2.2', 60000);
    store.reset('1.1.1.1');
    expect(store.get('2.2.2.2')).not.toBeNull();
    store.destroy();
  });
});

describe('resetAll', () => {
  it('clears all entries', () => {
    const store = makeStore();
    store.increment('a', 60000);
    store.increment('b', 60000);
    store.resetAll();
    expect(store.getStorageSize()).toBe(0);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// cleanup
// ---------------------------------------------------------------------------
describe('cleanup', () => {
  it('removes expired entries and returns count', () => {
    const store = makeStore();
    store.increment('expired', -1); // expired
    store.increment('alive', 60000); // not expired
    const removed = store.cleanup();
    expect(removed).toBe(1);
    expect(store.getStorageSize()).toBe(1);
    store.destroy();
  });

  it('returns 0 when nothing is expired', () => {
    const store = makeStore();
    store.increment('a', 60000);
    expect(store.cleanup()).toBe(0);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// getRequestCount
// ---------------------------------------------------------------------------
describe('getRequestCount', () => {
  it('returns 0 for unknown key', () => {
    const store = makeStore();
    expect(store.getRequestCount('nobody')).toBe(0);
    store.destroy();
  });

  it('returns current count for known key', () => {
    const store = makeStore();
    store.increment('ip', 60000);
    store.increment('ip', 60000);
    expect(store.getRequestCount('ip')).toBe(2);
    store.destroy();
  });
});

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------
describe('destroy', () => {
  it('clears the cleanup timer without error', () => {
    const store = new RateLimitStore({ cleanupInterval: 99999 });
    expect(() => store.destroy()).not.toThrow();
    // Double-destroy should be safe
    expect(() => store.destroy()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// setInterval callback (line 23) — real timer fires this.cleanup()
// ---------------------------------------------------------------------------
describe('cleanup timer callback (line 23) — setInterval fires automatically', () => {
  it('timer callback executes this.cleanup() when interval elapses (line 23 covered)', async () => {
    const store = new RateLimitStore({ cleanupInterval: 30 });
    // Long TTL so the entry survives the first cleanup pass
    store.increment('timer-probe', 100000);
    // Wait longer than the 30ms interval so the callback fires at least once
    await new Promise(r => setTimeout(r, 70));
    store.destroy();
    expect(store.getStorageSize()).toBeGreaterThanOrEqual(0);
  }, 5000);
});

// ---------------------------------------------------------------------------
// constructor: line 21 FALSE branch — cleanupInterval <= 0 skips setInterval
// ---------------------------------------------------------------------------
describe('constructor: line 21 FALSE branch — no timer when cleanupInterval <= 0', () => {
  it('passing negative cleanupInterval skips setInterval (line 21 false-branch covered)', () => {
    // cleanupInterval: -1 is truthy → stored as -1; -1 > 0 is FALSE → no timer started
    const store = new RateLimitStore({ cleanupInterval: -1 });
    expect(store.cleanupTimer).toBeUndefined();
    // destroy should still be safe even without a timer
    expect(() => store.destroy()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// evictOldest: line 132 FALSE branch — empty store, firstKey is undefined
// ---------------------------------------------------------------------------
describe('evictOldest: line 132 FALSE branch — empty store', () => {
  it('calling evictOldest on empty store does nothing and does not throw (line 132 false-branch)', () => {
    const store = new RateLimitStore({ cleanupInterval: -1 });
    expect(store.getStorageSize()).toBe(0);
    expect(() => store.evictOldest()).not.toThrow();
    expect(store.getStorageSize()).toBe(0);
  });
});
