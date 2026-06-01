/**
 * flagEngineSingleSource.sentinel.test.mjs (Equoria-yzqhj.3)
 *
 * Two competing flag-system generations used to coexist — a documented
 * A/B trust landmine (same failure class as the at-birth atBirthTraits A/B,
 * Equoria-313oc):
 *
 *   LIVE (wired to the mounted route): config/epigeneticFlagDefinitions.mjs,
 *     utils/carePatternAnalysis.mjs, utils/flagEvaluationEngine.mjs.
 *   DEAD (only self + own tests, zero live importers; had "Not implemented"
 *     trigger stubs): services/carePatternAnalyzer.mjs,
 *     services/flagAssignmentEngine.mjs, services/weeklyFlagEvaluationService.mjs.
 *
 * Decision (yzqhj.3): keep utils/ as canonical (it serves the 6 mounted
 * /flags endpoints), DELETE the three dead services/ files + their tests.
 *
 * This sentinel asserts the dead generation stays deleted (it would FAIL if
 * any of the three dead files were re-added) and the live generation's three
 * modules still exist + import cleanly. Sentinel-positive per
 * OPTIMAL_FIX_DISCIPLINE §2: it fires on the real regression (dead engine
 * resurrected), not merely passes on a clean tree.
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '../../..'); // backend/

describe('Epigenetic flag engine — single source of truth (Equoria-yzqhj.3)', () => {
  const DEAD_FILES = [
    'services/carePatternAnalyzer.mjs',
    'services/flagAssignmentEngine.mjs',
    'services/weeklyFlagEvaluationService.mjs',
  ];

  const LIVE_FILES = [
    'config/epigeneticFlagDefinitions.mjs',
    'utils/carePatternAnalysis.mjs',
    'utils/flagEvaluationEngine.mjs',
  ];

  test.each(DEAD_FILES)('dead services/ flag file %s must NOT exist', rel => {
    expect(existsSync(resolve(backendRoot, rel))).toBe(false);
  });

  test.each(LIVE_FILES)('live flag module %s must exist', rel => {
    expect(existsSync(resolve(backendRoot, rel))).toBe(true);
  });

  test('live flag generation imports cleanly and exposes its public API', async () => {
    const defs = await import('../../../config/epigeneticFlagDefinitions.mjs');
    const care = await import('../../../utils/carePatternAnalysis.mjs');
    const engine = await import('../../../utils/flagEvaluationEngine.mjs');

    expect(typeof defs.getAllFlagDefinitions).toBe('function');
    expect(typeof care.analyzeCarePatterns).toBe('function');
    expect(typeof engine.evaluateHorseFlags).toBe('function');
    expect(typeof engine.batchEvaluateFlags).toBe('function');
  });
});
