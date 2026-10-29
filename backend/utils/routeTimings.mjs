/**
 * How long each route takes to answer, kept in this server's memory only
 * (Equoria-brh8c, owner ruling q158: the owner's server memory and speed panel).
 *
 * Fed by the performanceMonitoring middleware (middleware/responseOptimization.mjs)
 * once per finished request. A route is its method and matched path pattern
 * (`GET /api/v1/horses/:id`), never the address a player typed, so no ids or
 * query strings are kept. Bounded: at most `maxRoutes` patterns; requests that
 * matched no route are counted under one entry. Nothing leaves the server and
 * nothing is stored; a restart starts the counts again.
 */

/** The most route patterns kept. Far above the number of routes the game has. */
export const maxRoutes = 500;

const unmatchedKey = '(no matching route)';

/** @type {Map<string, { count: number, totalMs: number, maxMs: number, slowCount: number }>} */
const timings = new Map();
const startedAt = new Date();

/** The pattern a finished request matched, or the shared unmatched key. */
export function routeKeyFor(req) {
  const routePath = req?.route?.path;
  if (typeof routePath !== 'string') {
    return unmatchedKey;
  }
  const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
  return `${req.method} ${base}${routePath}`;
}

/**
 * Count one finished request.
 * @param {string} key - from routeKeyFor
 * @param {number} durationMs
 * @param {number} slowThresholdMs
 */
export function recordRouteTiming(key, durationMs, slowThresholdMs = 1000) {
  let entry = timings.get(key);
  if (!entry) {
    if (timings.size >= maxRoutes) {
      entry = timings.get(unmatchedKey) ?? { count: 0, totalMs: 0, maxMs: 0, slowCount: 0 };
      timings.set(unmatchedKey, entry);
    } else {
      entry = { count: 0, totalMs: 0, maxMs: 0, slowCount: 0 };
      timings.set(key, entry);
    }
  }
  entry.count += 1;
  entry.totalMs += durationMs;
  entry.maxMs = Math.max(entry.maxMs, durationMs);
  if (durationMs > slowThresholdMs) {
    entry.slowCount += 1;
  }
}

/**
 * The routes by average answer time, slowest first.
 * @param {number} [limit]
 */
export function slowestRoutes(limit = 10) {
  return [...timings.entries()]
    .map(([route, t]) => ({
      route,
      requests: t.count,
      averageMs: Math.round(t.totalMs / t.count),
      slowestMs: t.maxMs,
      overOneSecond: t.slowCount,
    }))
    .sort((a, b) => b.averageMs - a.averageMs || b.slowestMs - a.slowestMs)
    .slice(0, limit);
}

/** Totals across every route since this server started. */
export function routeTimingTotals() {
  let requests = 0;
  let slow = 0;
  for (const t of timings.values()) {
    requests += t.count;
    slow += t.slowCount;
  }
  return { since: startedAt, requests, overOneSecond: slow };
}
