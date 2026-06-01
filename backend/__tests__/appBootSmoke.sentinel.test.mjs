/**
 * App-boot smoke sentinel (Equoria-zzod8).
 *
 * WHY THIS EXISTS
 * ---------------
 * The efonm/rdtcb module-move refactors relocated dozens of service files
 * from `backend/services/` and `backend/models/` into
 * `backend/modules/<domain>/services/`. Several relative imports in the
 * STATIC app.mjs boot graph were never updated, so they pointed at paths
 * that no longer exist:
 *   - groomHandlerService.mjs    -> './conformationShowService.mjs'
 *   - cronJobService.mjs         -> './groomSalaryService.mjs' (+2 more)
 *   - cronJobs.mjs               -> './traitHistoryService.mjs' (+4 more)
 *   - dynamicCompatibilityScoring.mjs, legacyScoreCalculator.mjs,
 *     environmentalTriggerSystem.mjs (intra-graph siblings)
 *
 * Because these are STATIC ESM imports, the first unresolved one threw
 * ERR_MODULE_NOT_FOUND at import time and `app.mjs` failed to load entirely.
 * That cascaded: ~202 test suites that import `app.mjs` (directly or
 * transitively) reported "Test suite failed to run" and ran 0 tests, and
 * the Express server could not boot. The failures were invisible at the
 * unit level — nothing asserted "app.mjs is importable" — so a broken
 * static import could (and did) ship.
 *
 * WHAT THIS GUARDS
 * ----------------
 * Importing `app.mjs` exercises the WHOLE static import graph. If ANY file
 * reachable from the boot graph has an unresolved relative import (the exact
 * defect class above), this test throws at import and fails loudly in CI —
 * which is the durable guard the zzod8 verification step 4 asked for. This
 * is a real boot test (no mocks): it loads the actual Express app against
 * the real config, the same way server.mjs does.
 */

import { describe, it, expect } from '@jest/globals';

describe('app.mjs boots — static import graph resolves (Equoria-zzod8 sentinel)', () => {
  it('imports app.mjs without ERR_MODULE_NOT_FOUND in the static graph', async () => {
    // A broken static relative import anywhere in the boot graph makes this
    // dynamic import() reject with ERR_MODULE_NOT_FOUND. A successful import
    // proves every static edge in the graph resolved.
    const mod = await import('../app.mjs');
    expect(mod).toBeDefined();
    // app.mjs default-exports the configured Express application.
    expect(mod.default).toBeDefined();
    // The Express app is a callable request handler with a .use() method.
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.default.use).toBe('function');
  });
});
