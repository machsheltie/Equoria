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

import { existsSync, readdirSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '../../..'); // backend/
const repoRoot = resolve(backendRoot, '..'); // repo root (Equoria-dyt7y: root services/ too)

// Equoria-oey96.32: the permanent-stub flag evaluator `evaluateEpigeneticFlags`
// (formerly utils/epigeneticFlags.mjs) was wired into the LIVE milestone path and
// produced dead, always-empty output. It has been deleted; the milestone path now
// READS canonical flags from the weekly flagEvaluationEngine. This scanner forbids
// any production (non-test) .mjs file from re-importing / re-calling that stub —
// re-introducing a second flag-evaluation path is the exact drift this doctrine
// prevents.
const FORBIDDEN_STUB_TOKEN = /\bevaluateEpigeneticFlags\b/;

/**
 * Recursively collect production .mjs files under `rootDir` whose contents match
 * `pattern`. Skips node_modules, any `__tests__` directory, and *.test.mjs /
 * *.spec.mjs files (those are allowed to reference the token in prose/history).
 * @returns {string[]} matching file paths
 */
function scanProductionForPattern(rootDir, pattern) {
  const hits = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') {
          continue;
        }
        stack.push(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.mjs') &&
        !entry.name.endsWith('.test.mjs') &&
        !entry.name.endsWith('.spec.mjs')
      ) {
        if (pattern.test(readFileSync(full, 'utf8'))) {
          hits.push(full);
        }
      }
    }
  }
  return hits;
}

/**
 * File names (recursive, relative to `dir`) that look like a flag engine / care
 * pattern analyzer. A missing directory yields [].
 * @returns {string[]}
 */
function flagEngineFilesUnder(dir) {
  const found = [];
  const walk = (current, prefix) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          walk(join(current, entry.name), rel);
        }
      } else if (/flag|carePattern/i.test(entry.name)) {
        found.push(rel);
      }
    }
  };
  walk(dir, '');
  return found.sort();
}

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

  // Equoria-dyt7y: the retirement used to be checked only under backend/, so the
  // same three files survived at the repo-root services/ (retired with
  // Equoria-mgcyd, owner ruling 2026-10-22). Check the repo root too.
  test.each(DEAD_FILES)('dead flag file %s must NOT exist at the repo-root services/ either', rel => {
    expect(existsSync(resolve(repoRoot, rel))).toBe(false);
  });

  test('no flag-engine file lives anywhere under the repo-root services/', () => {
    expect(flagEngineFilesUnder(resolve(repoRoot, 'services'))).toEqual([]);
  });

  test('SENTINEL-POSITIVE: the repo-root scan FIRES on a planted flag-engine file', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'dyt7y-sentinel-'));
    try {
      writeFileSync(join(tmpRoot, 'flagAssignmentEngine.mjs'), 'export const x = 1;', 'utf8');
      writeFileSync(join(tmpRoot, 'unrelatedHelper.mjs'), 'export const y = 1;', 'utf8');
      expect(flagEngineFilesUnder(tmpRoot)).toEqual(['flagAssignmentEngine.mjs']);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
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

describe('Stub flag evaluator stays out of production (Equoria-oey96.32)', () => {
  test('no production .mjs re-imports or re-calls evaluateEpigeneticFlags', () => {
    const violations = scanProductionForPattern(backendRoot, FORBIDDEN_STUB_TOKEN);
    // Report the actual file paths on failure so a future regression is obvious.
    expect(violations).toEqual([]);
  });

  test('SENTINEL-POSITIVE: the scan FIRES on a planted production violation', () => {
    // Prove the check is not a placebo: plant a synthetic production-shaped .mjs
    // that re-imports the deleted stub, scan the temp tree, assert it is caught,
    // then remove it.
    const tmpRoot = mkdtempSync(join(tmpdir(), 'oey9632-sentinel-'));
    const plantedFile = join(tmpRoot, 'reintroducedFlagStub.mjs');
    try {
      writeFileSync(
        plantedFile,
        "import { evaluateEpigeneticFlags } from '../utils/epigeneticFlags.mjs';\n" +
          'export const flags = evaluateEpigeneticFlags({}, {}, {});\n',
        'utf8',
      );
      const hits = scanProductionForPattern(tmpRoot, FORBIDDEN_STUB_TOKEN);
      expect(hits).toContain(plantedFile);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('SENTINEL-NEGATIVE: the scan IGNORES a clean production file', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'oey9632-clean-'));
    const cleanFile = join(tmpRoot, 'cleanFlagReader.mjs');
    try {
      writeFileSync(
        cleanFile,
        "import { asFlagArray } from '../utils/jsonbArrayGuard.mjs';\n" +
          'export const read = (h) => asFlagArray(h.epigeneticFlags);\n',
        'utf8',
      );
      expect(scanProductionForPattern(tmpRoot, FORBIDDEN_STUB_TOKEN)).toEqual([]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
