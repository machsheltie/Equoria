/**
 * userSummaryRouteRegistration.sentinel.test.mjs
 *
 * Sentinel for Equoria-z6eh: GET /api/leaderboards/user-summary/:userId was
 * registered TWICE (byte-identical) in leaderboardRoutes.mjs. Express keeps
 * the first match; the second was dead code and a maintenance hazard (an edit
 * to one handler/middleware silently does not take effect via the shadowed
 * duplicate).
 *
 * This sentinel reads the route source and asserts the route is registered
 * EXACTLY ONCE. It FAILS if the duplicate is reintroduced (positive test of
 * the dedup, not just "things work now").
 *
 * NO MOCKS — pure source-file read, no DB, no app boot.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROUTE_FILE = path.resolve(__dirname, '../routes/leaderboardRoutes.mjs');

describe('SENTINEL: leaderboardRoutes /user-summary/:userId single registration (Equoria-z6eh)', () => {
  const source = readFileSync(ROUTE_FILE, 'utf8');

  it('registers GET /user-summary/:userId exactly once', () => {
    const matches = source.match(/router\.get\(\s*['"]\/user-summary\/:userId['"]/g) || [];
    expect(matches).toHaveLength(1);
  });

  it('has no duplicated router.get path literal anywhere in the file', () => {
    // Catch the broader class: any path literal registered more than once via
    // router.get (the only duplicate found by the Equoria-z6eh audit was
    // /user-summary, but a regression elsewhere should also be caught).
    const getPathRe = /router\.get\(\s*(['"])([^'"]+)\1/g;
    const counts = new Map();
    let m;
    while ((m = getPathRe.exec(source)) !== null) {
      const p = m[2];
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    const duplicated = [...counts.entries()].filter(([, c]) => c > 1).map(([p]) => p);
    expect(duplicated).toEqual([]);
  });
});
