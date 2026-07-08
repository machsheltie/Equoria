/**
 * 🛡️ MFA Lockout — cross-node (Redis-backed) sentinel (Equoria-mwi6k)
 *
 * The dedicated 5-failures/5-min TOTP lockout used to be an in-memory
 * per-process Map. Across N nodes an attacker got 5×N guesses per window
 * before the (wide, 200/15min) shared authRateLimiter was the only bound.
 * The fix backs the counter with the SAME Redis store the rate limiters use,
 * keyed by userId, so the bound holds cluster-wide.
 *
 * This is a DI test: `createMfaLockoutStore({ getRedisClient, isRedisConnected })`
 * lets us stand up TWO independent store instances (simulating two nodes/
 * processes) and inject ONE shared Redis client. We mirror the injection
 * pattern of backend/__tests__/rateLimitFailClosed.test.mjs (which injects
 * connection predicates) — here we additionally inject a faithful in-memory
 * Redis simulation.
 *
 * Redis is a THIRD-PARTY boundary Equoria does not own, so a faithful fake of
 * the exact command surface used (GET / INCR / PEXPIRE / PTTL / DEL) is the
 * legitimate isolation the constitution permits — it is the ONLY way to
 * exercise the distributed path (a live Redis is intentionally disabled in the
 * jest env). The fake tests OUR store logic (INCR sequencing, lock-key TTL,
 * cross-instance sharing), not Redis itself.
 *
 * RED (pre-fix, per-process): with two instances each counting in their own
 * Map, 3 failures on node A + 2 on node B never reach the cap → neither locks.
 * GREEN (post-fix, Redis-backed): the combined 3+2 = 5 on the shared store
 * locks BOTH nodes.
 */

import { describe, it, expect } from '@jest/globals';
import { createMfaLockoutStore, _config } from '../services/mfaLockoutService.mjs';

/**
 * Faithful in-memory simulation of the subset of Redis commands the lockout
 * store issues via `client.sendCommand([...])`. Supports lazy TTL expiry.
 * INCR preserves an existing key's TTL (as real Redis does) and creates keys
 * without a TTL until PEXPIRE sets one.
 */
function createFakeRedis() {
  const store = new Map(); // key → { value: string, expireAt: number | undefined }

  const alive = entry => {
    if (!entry) {
      return false;
    }
    if (entry.expireAt !== undefined && entry.expireAt <= Date.now()) {
      return false;
    }
    return true;
  };
  const readAlive = key => {
    const e = store.get(key);
    if (!alive(e)) {
      store.delete(key);
      return null;
    }
    return e;
  };

  return {
    _store: store,
    async sendCommand(args) {
      const [rawCmd, key, ...rest] = args;
      const cmd = String(rawCmd).toUpperCase();
      switch (cmd) {
        case 'GET': {
          const e = readAlive(key);
          return e ? e.value : null;
        }
        case 'INCR': {
          const e = readAlive(key);
          const next = (e ? Number(e.value) : 0) + 1;
          // Preserve existing TTL; a freshly-created key has no TTL yet.
          store.set(key, { value: String(next), expireAt: e ? e.expireAt : undefined });
          return next;
        }
        case 'PEXPIRE': {
          const e = readAlive(key);
          if (!e) {
            return 0;
          }
          e.expireAt = Date.now() + Number(rest[0]);
          return 1;
        }
        case 'PTTL': {
          const e = readAlive(key);
          if (!e) {
            return -2;
          }
          if (e.expireAt === undefined) {
            return -1;
          }
          return Math.max(0, e.expireAt - Date.now());
        }
        case 'DEL': {
          let n = 0;
          for (const k of [key, ...rest]) {
            if (store.has(k)) {
              store.delete(k);
              n += 1;
            }
          }
          return n;
        }
        default:
          throw new Error(`FakeRedis: unsupported command ${cmd}`);
      }
    },
  };
}

const CONNECTED = shared => ({ getRedisClient: () => shared, isRedisConnected: () => true });
const DISCONNECTED = { getRedisClient: () => null, isRedisConnected: () => false };

describe('MFA lockout — cross-node Redis-backed counter (Equoria-mwi6k)', () => {
  it('COMBINED failures across TWO instances sharing ONE Redis store enforce the 5/5-min cap (3 + 2 = locked)', async () => {
    const shared = createFakeRedis();
    const nodeA = createMfaLockoutStore(CONNECTED(shared));
    const nodeB = createMfaLockoutStore(CONNECTED(shared));
    const userId = 'user-mwi6k-combined';

    // Node A records 3 failures; Node B records 2. Neither alone hits the cap.
    await nodeA.recordFailure(userId);
    await nodeA.recordFailure(userId);
    await nodeA.recordFailure(userId);
    expect((await nodeA.isLocked(userId)).locked).toBe(false); // only 3 so far

    await nodeB.recordFailure(userId); // combined 4
    await nodeB.recordFailure(userId); // combined 5 → lock

    // BOTH nodes now see the lock — the counter is shared, not per-process.
    const lockA = await nodeA.isLocked(userId);
    const lockB = await nodeB.isLocked(userId);
    expect(lockA.locked).toBe(true);
    expect(lockB.locked).toBe(true);
    expect(lockA.retryAfterSec).toBeGreaterThan(0);
    expect(lockA.retryAfterSec).toBeLessThanOrEqual(_config.LOCKOUT_TTL_MS / 1000);
  });

  it('CONTROL — WITHOUT a shared store (in-memory per-process fallback) two instances count INDEPENDENTLY (the multi-node weakness this fix closes)', async () => {
    // This documents the exact pre-fix defect: with no shared backing, each
    // instance keeps its own Map. 3 + 2 across two "nodes" never locks.
    const nodeA = createMfaLockoutStore(DISCONNECTED);
    const nodeB = createMfaLockoutStore(DISCONNECTED);
    const userId = 'user-mwi6k-independent';

    await nodeA.recordFailure(userId);
    await nodeA.recordFailure(userId);
    await nodeA.recordFailure(userId);
    await nodeB.recordFailure(userId);
    await nodeB.recordFailure(userId);

    expect((await nodeA.isLocked(userId)).locked).toBe(false); // node A saw only 3
    expect((await nodeB.isLocked(userId)).locked).toBe(false); // node B saw only 2
  });

  it('locks on exactly the 5th combined failure, not the 4th', async () => {
    const shared = createFakeRedis();
    const nodeA = createMfaLockoutStore(CONNECTED(shared));
    const nodeB = createMfaLockoutStore(CONNECTED(shared));
    const userId = 'user-mwi6k-boundary';

    for (let i = 0; i < 4; i++) {
      await (i % 2 === 0 ? nodeA : nodeB).recordFailure(userId);
    }
    expect((await nodeA.isLocked(userId)).locked).toBe(false); // 4 → not yet

    await nodeB.recordFailure(userId); // 5 → lock
    expect((await nodeA.isLocked(userId)).locked).toBe(true);
  });

  it('recordSuccess clears the SHARED counter (a typo before success does not pre-load the cap)', async () => {
    const shared = createFakeRedis();
    const nodeA = createMfaLockoutStore(CONNECTED(shared));
    const nodeB = createMfaLockoutStore(CONNECTED(shared));
    const userId = 'user-mwi6k-reset';

    await nodeA.recordFailure(userId);
    await nodeA.recordFailure(userId);
    await nodeB.recordFailure(userId); // combined 3
    await nodeB.recordSuccess(userId); // reset on the OTHER node

    // After reset it takes a fresh 5 to lock — proving the counter was cleared.
    for (let i = 0; i < 4; i++) {
      await nodeA.recordFailure(userId);
    }
    expect((await nodeB.isLocked(userId)).locked).toBe(false); // only 4 since reset
    await nodeA.recordFailure(userId); // 5th since reset
    expect((await nodeB.isLocked(userId)).locked).toBe(true);
  });

  it('lockout is per-userId — locking User A does not affect User B on the shared store', async () => {
    const shared = createFakeRedis();
    const nodeA = createMfaLockoutStore(CONNECTED(shared));
    const nodeB = createMfaLockoutStore(CONNECTED(shared));
    const userA = 'user-mwi6k-A';
    const userB = 'user-mwi6k-B';

    for (let i = 0; i < 6; i++) {
      await nodeA.recordFailure(userA);
    }
    expect((await nodeA.isLocked(userA)).locked).toBe(true);
    expect((await nodeB.isLocked(userB)).locked).toBe(false); // B untouched
  });

  it('an empty/invalid userId is never locked (guard parity with the in-memory path)', async () => {
    const shared = createFakeRedis();
    const store = createMfaLockoutStore(CONNECTED(shared));
    expect((await store.isLocked('')).locked).toBe(false);
    expect(await store.recordFailure('')).toEqual({ count: 0, justLocked: false, lockedUntil: null });
    await expect(store.recordSuccess('')).resolves.toBeUndefined();
  });
});
