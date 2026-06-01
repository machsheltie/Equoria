/**
 * Sentinel for failLoudCleanup.mjs (Equoria-0y9f5).
 *
 * Proves the fail-loud cleanup tracker actually fails loud — the exact
 * property that distinguishes it from the `.catch(() => console.warn(...))`
 * pattern it exists to replace. Without these assertions the helper could
 * silently regress into a no-op (swallowing cleanup failures) and nothing
 * would catch it.
 *
 * This is a pure unit test of the accumulator's control flow — no DB needed.
 * The DB-scoping discipline is the CALLER's responsibility (see module docs);
 * what we verify here is that a thrown cleanup is surfaced, not eaten.
 */

import { describe, it, expect } from '@jest/globals';
import { createCleanupTracker } from './failLoudCleanup.mjs';

describe('failLoudCleanup — createCleanupTracker (Equoria-0y9f5)', () => {
  it('resolves quietly when all cleanup callbacks succeed', async () => {
    const tracker = createCleanupTracker();
    const order = [];
    tracker.add(() => {
      order.push('a');
    });
    tracker.add(async () => {
      order.push('b');
    });

    await expect(tracker.run()).resolves.toBeUndefined();
    expect(order).toEqual(['a', 'b']); // both ran, in order
  });

  it('SENTINEL: throws loudly from run() when a cleanup callback fails', async () => {
    const tracker = createCleanupTracker();
    tracker.add(() => {
      throw new Error('delete failed: FK constraint');
    });

    // The whole point: a failing cleanup must make afterAll go RED, not warn.
    await expect(tracker.run()).rejects.toThrow(/Fail-loud cleanup/);
    await expect(
      (async () => {
        const t2 = createCleanupTracker();
        t2.add(() => Promise.reject(new Error('async delete failed')));
        await t2.run();
      })(),
    ).rejects.toThrow(/async delete failed/);
  });

  it('SENTINEL: runs EVERY callback even when an earlier one throws (no stranded cleanup)', async () => {
    const tracker = createCleanupTracker();
    const ran = [];
    tracker.add(() => {
      ran.push('first');
      throw new Error('first cleanup blew up');
    });
    tracker.add(() => {
      ran.push('second'); // must still run despite the first throwing
    });
    tracker.add(async () => {
      ran.push('third');
      throw new Error('third cleanup blew up');
    });

    let caught;
    try {
      await tracker.run();
    } catch (err) {
      caught = err;
    }

    expect(ran).toEqual(['first', 'second', 'third']); // all three executed
    expect(caught).toBeDefined();
    // Aggregated error reports BOTH failures (count of failed tasks).
    expect(caught.message).toMatch(/2 cleanup task\(s\) failed/);
    expect(Array.isArray(caught.causes)).toBe(true);
    expect(caught.causes).toHaveLength(2);
  });

  it('is idempotent: a second run() after success is a quiet no-op', async () => {
    const tracker = createCleanupTracker();
    let calls = 0;
    tracker.add(() => {
      calls += 1;
    });

    await tracker.run();
    await tracker.run(); // queue drained — must not re-run or throw
    expect(calls).toBe(1);
    expect(tracker.size()).toBe(0);
  });

  it('rejects a non-function cleanup at registration time', () => {
    const tracker = createCleanupTracker();
    expect(() => tracker.add(null)).toThrow(TypeError);
    expect(() => tracker.add('not a fn')).toThrow(TypeError);
  });
});
