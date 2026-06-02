/**
 * Sentinel: enhancedGroomRoutes static-definition GET handlers must NOT swallow
 * errors silently (Equoria-xp0vc).
 *
 * Defect class: the three static-definitions handlers (interactions/types,
 * relationship-levels, special-events) used a bare `} catch {` that returned a
 * 500 with NO error binding and NO log line. When the dynamic import or the
 * shape of ENHANCED_INTERACTIONS / RELATIONSHIP_LEVELS / SPECIAL_EVENTS breaks
 * during a refactor, the handler returns an opaque 500 and the real cause is
 * invisible to operators — exactly the "hidden failure" the constitution's
 * "real signals over green dashboards" principle exists to prevent.
 *
 * Contract enforced here (source-level, mirroring the project's
 * scripts/doctrine-checks/* style because the failure path cannot be triggered
 * over HTTP without mocking our own module — forbidden by CLAUDE.md §3):
 *   1. The file contains ZERO bare `catch {` blocks (every catch binds the error).
 *   2. Every `catch (error)` block in the file logs via `logger.error`.
 *
 * Sentinel-positive: the detector regex is proven to FIRE on a planted bare
 * catch and to NOT fire on the bound form — so this is a real check, not a
 * placebo (OPTIMAL_FIX_DISCIPLINE §2).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTE_FILE = join(__dirname, '..', 'routes', 'enhancedGroomRoutes.mjs');

// Matches a `catch` with no bound parameter: `catch {` or `catch  {`.
const BARE_CATCH = /\bcatch\s*\{/g;
// Matches a `catch (ident)` form.
const BOUND_CATCH = /\bcatch\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{/g;

describe('enhancedGroomRoutes — no silent catch (Equoria-xp0vc)', () => {
  const source = readFileSync(ROUTE_FILE, 'utf8');

  it('contains no bare `catch {` (every catch binds the error)', () => {
    const bare = source.match(BARE_CATCH) || [];
    expect(bare).toHaveLength(0);
  });

  it('logs via logger.error inside every catch block', () => {
    const boundCatches = source.match(BOUND_CATCH) || [];
    // There are at least the three static-definitions handlers.
    expect(boundCatches.length).toBeGreaterThanOrEqual(3);

    // Every catch block body must reference logger.error before its closing.
    // Walk each `catch (x) {` and assert a logger.error appears before the
    // next handler boundary (`});` at column 0 of a route or end-of-file).
    const catchPositions = [...source.matchAll(BOUND_CATCH)].map(m => m.index);
    for (const pos of catchPositions) {
      const slice = source.slice(pos, pos + 400);
      expect(slice).toMatch(/logger\.error/);
    }
  });

  it('sentinel-positive: detector fires on a planted bare catch, not on the bound form', () => {
    const planted = 'try { doThing(); } catch { res.status(500); }';
    const good = 'try { doThing(); } catch (error) { logger.error(error); }';
    expect(planted.match(BARE_CATCH)).toHaveLength(1);
    expect(good.match(BARE_CATCH)).toBeNull();
  });
});
