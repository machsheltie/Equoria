/**
 * betaRouteScopeSync — Docs/Config Drift Guard
 *
 * Story 21R-2 Task 15 (seventh-pass correction)
 *
 * Reads docs/beta-route-truth-table.md and asserts that every route classified
 * as `beta-live` in the markdown table is present in BETA_SCOPE as 'beta-live'.
 *
 * Purpose: Makes it impossible for the truth table and the runtime scope to
 * silently diverge. If a route is upgraded to beta-live in the truth table
 * without updating betaRouteScope.ts, this test fails immediately.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BETA_SCOPE } from '../betaRouteScope';

// Vitest runs from the frontend/ directory; docs/ is one level up at the project root
const TABLE_PATH = resolve(process.cwd(), '../docs/beta-route-truth-table.md');

// ── Parse beta-live routes from truth table ────────────────────────────────────

function parseBetaLiveRoutesFromTruthTable(): string[] {
  const tablePath = TABLE_PATH;
  const content = readFileSync(tablePath, 'utf-8');

  const routes: string[] = [];

  // Match table rows: | /some-path | ... | beta-live | ...
  // Handles both public routes and authenticated routes tables
  const rowRegex = /\|\s*(`[^`]+`|\/\S+)\s*\|[^|]+\|\s*[^|]+\|\s*[^|]+\|\s*beta-live\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(content)) !== null) {
    // Extract the route — strip backticks and whitespace
    const raw = match[1].replace(/`/g, '').trim();
    if (raw.startsWith('/')) {
      routes.push(raw);
    }
  }

  return [...new Set(routes)];
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('betaRouteScopeSync — truth table drift guard', () => {
  it('every beta-live route in docs/beta-route-truth-table.md is beta-live in BETA_SCOPE', () => {
    const truthTableLiveRoutes = parseBetaLiveRoutesFromTruthTable();

    // Sanity: parser should find at least the known minimum set
    expect(truthTableLiveRoutes.length).toBeGreaterThanOrEqual(5);

    const mismatches: string[] = [];

    for (const route of truthTableLiveRoutes) {
      const runtimeScope = BETA_SCOPE[route];
      if (runtimeScope !== 'beta-live') {
        mismatches.push(
          `  ${route}: truth table says 'beta-live', runtime says '${runtimeScope ?? 'undefined'}'`
        );
      }
    }

    if (mismatches.length > 0) {
      throw new Error(
        `Runtime betaRouteScope.ts disagrees with docs/beta-route-truth-table.md:\n${mismatches.join('\n')}\n\nUpdate betaRouteScope.ts to match the truth table.`
      );
    }
  });

  it('known minimum set (/login /register /onboarding / /stable) are all beta-live', () => {
    const minimumSet = ['/login', '/register', '/onboarding', '/', '/stable'];
    for (const route of minimumSet) {
      expect(BETA_SCOPE[route]).toBe('beta-live');
    }
  });
});
