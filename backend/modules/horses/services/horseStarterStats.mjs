/**
 * Horse Starter Stats Service
 *
 * Single source of truth for breed-derived starter stats. Both the production
 * store-purchase path (modules/marketplace/controllers/marketplaceController.mjs
 * → buyStoreHorse) and the performance test seed
 * (seed/seedPerformanceData.mjs → seedPerformanceHorses) MUST go through this
 * module. Random stats — or any other ad-hoc generator — are forbidden.
 *
 * Contract:
 *   - Each of the 12 stats is sampled from a per-breed normal distribution
 *     (mean, stdDev) defined in `backend/data/breedStarterStats.json`.
 *   - Owner ruling 2026-10-16 (Equoria-7wqbs): "Store horses: each stat 1–20
 *     at purchase, totaling 200." Every stat is in [1, 20] and the TOTAL
 *     across all 12 stats is exactly 200 (12 × 20 = 240, so it always fits).
 *     Means in the JSON sum to ~195-200; Box-Muller variance moves a sample
 *     either side, so `clampStatsToTotalCap` scales an over-200 roll down
 *     proportionally and `topUpStatsToTotal` adds the shortfall of an
 *     under-200 roll one point at a time to randomly chosen stats below 20.
 *
 * Extracted from marketplaceController.mjs as a shared service so the perf
 * seed can call the SAME generator the store calls. Random-stat seeds give
 * false performance numbers because they don't exercise the same code paths
 * (and don't match real horse data shape).
 *
 * @module services/horseStarterStats
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import logger from '../../../utils/logger.mjs';

const __filename__ = fileURLToPath(import.meta.url);
const __dirname__ = dirname(__filename__);
// Equoria-rg7s4: canonical data file is backend/data/breedStarterStats.json.
// This loader lives at backend/modules/horses/services/, so reaching it is
// three levels up ('..','..','..') then 'data' — NOT one level ('..','data'),
// which resolved to the nonexistent backend/modules/horses/data/ after the
// horses-module move and made every store purchase + perf-seed run throw.
const BREED_STARTER_STATS_PATH = resolve(
  __dirname__,
  '..',
  '..',
  '..',
  'data',
  'breedStarterStats.json',
);

let BREED_STARTER_STATS_BY_NAME = {};
try {
  BREED_STARTER_STATS_BY_NAME = JSON.parse(readFileSync(BREED_STARTER_STATS_PATH, 'utf8'));
} catch (err) {
  // Loading this file is required for store purchases AND perf-seed runs.
  // Log loudly at boot so the failure is obvious in deployment logs rather
  // than silent until the first buy attempt or seed step.
  logger.error(
    `[horseStarterStats] FATAL: Failed to load breedStarterStats.json (${BREED_STARTER_STATS_PATH}): ${err.message}. ` +
      'Every store purchase and perf-seed run will throw until this file is readable.',
  );
}

/**
 * Canonical 12-stat ordering. Order matches the Prisma schema's Horse model
 * declaration. Any consumer that hardcodes a different order is a bug.
 */
export const STAT_KEYS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'strength',
  'endurance',
];

/**
 * Sample a single stat using Box-Muller for a true normal distribution.
 * Clamped to [1, 100] — no zeros, no over-100s. Each stat is independent.
 *
 * @param {{ mean: number, stdDev: number }} params
 * @param {() => number} [random] - uniform [0, 1) source (defaults to Math.random)
 * @returns {number} integer stat value in [1, 100]
 */
export function sampleStat({ mean, stdDev }, random = Math.random) {
  const u1 = random() || Number.EPSILON; // guard against log(0)
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.min(100, Math.round(mean + stdDev * z)));
}

/**
 * Cap a stat object's total at `cap`, preserving the [1, ∞) lower bound on
 * every individual stat. Game rule: total ≤ 200, no stat < 1.
 *
 * Algorithm:
 *   1. If total ≤ cap, return as-is.
 *   2. Proportionally scale every stat by `cap / total`, clamping each
 *      result to a minimum of 1.
 *   3. The clamp step may push the post-scale total back above `cap` (when
 *      some stats were rounded UP to 1). Iteratively decrement the highest
 *      stat by 1 until the total reaches `cap`. This terminates: in the
 *      worst case every stat is 1 and total = STAT_KEYS.length, well under
 *      any realistic cap.
 *
 * Why proportional + iterative trim instead of a single pass: pure
 * proportional scaling can violate the cap when low-end stats clamp to 1.
 * Iterative trim from the top redistributes the excess fairly without
 * touching the floor.
 *
 * @param {Record<string, number>} stats - Object keyed by stat name
 * @param {number} cap - Maximum allowed sum across all stats
 * @returns {Record<string, number>} new stats object with total ≤ cap
 */
export function clampStatsToTotalCap(stats, cap) {
  const entries = Object.entries(stats);
  let total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= cap) {
    return { ...stats };
  }

  const factor = cap / total;
  const result = Object.fromEntries(
    entries.map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]),
  );
  total = Object.values(result).reduce((s, v) => s + v, 0);

  while (total > cap) {
    // Trim 1 from the largest stat that's still above 1.
    const sorted = Object.entries(result).sort(([, a], [, b]) => b - a);
    const target = sorted.find(([, v]) => v > 1);
    if (!target) {
      break; // safety; mathematically unreachable when cap ≥ STAT_KEYS.length
    }
    result[target[0]] -= 1;
    total -= 1;
  }

  return result;
}

/**
 * Total stats game-rule cap. Exposed so callers can reference the same
 * constant the service enforces internally — and so a test can assert
 * `total <= TOTAL_STAT_CAP` against a sampled horse.
 */
export const TOTAL_STAT_CAP = 200;

/**
 * Owner ruling 2026-10-16 (Equoria-7wqbs): a store horse's stats are each
 * 1–20 at purchase and total exactly TOTAL_STAT_CAP.
 */
export const storeStatMinimum = 1;
export const storeStatMaximum = 20;
export const storeStatTotal = TOTAL_STAT_CAP;

/**
 * Raise a stat object's total to exactly `total`, one point at a time, each
 * point going to a randomly chosen stat still below `max`. Leaves a stat
 * object whose total is already ≥ `total` unchanged.
 *
 * @param {Record<string, number>} stats - Object keyed by stat name
 * @param {number} total - Target sum
 * @param {number} max - Highest value any stat may reach
 * @param {() => number} [random] - uniform [0, 1) source (defaults to Math.random)
 * @returns {Record<string, number>} new stats object
 */
export function topUpStatsToTotal(stats, total, max, random = Math.random) {
  const result = { ...stats };
  let sum = Object.values(result).reduce((s, v) => s + v, 0);
  while (sum < total) {
    const open = Object.keys(result).filter(k => result[k] < max);
    if (open.length === 0) {
      break; // every stat is at max: total is unreachable
    }
    const key = open[Math.min(open.length - 1, Math.floor(random() * open.length))];
    result[key] += 1;
    sum += 1;
  }
  return result;
}

/**
 * Generate a complete 12-stat object for a horse of the given breed.
 *
 * Every breed in the DB MUST have a matching profile in
 * `backend/data/breedStarterStats.json`. Lookup miss = data bug = throw with
 * statusCode 500 so the failure is visible at the API layer rather than
 * silently shipping a horse with random stats.
 *
 * @param {string} breedName - Breed display name (must match JSON key exactly)
 * @param {{ random?: () => number }} [options] - `random`: uniform [0, 1)
 *   source for every draw (defaults to Math.random; tests pass a seeded one)
 * @returns {Record<string, number>} object keyed by STAT_KEYS, each in
 *   [storeStatMinimum, storeStatMaximum], summing to exactly TOTAL_STAT_CAP
 * @throws {Error} (statusCode=500) on missing breed name, missing profile,
 *   or incomplete profile
 */
export function generateStoreStats(breedName, { random = Math.random } = {}) {
  if (!breedName) {
    throw Object.assign(new Error('Breed name is required to generate store horse stats'), {
      statusCode: 500,
    });
  }

  const profile = BREED_STARTER_STATS_BY_NAME[breedName];
  if (!profile) {
    throw Object.assign(
      new Error(
        `No starter-stats profile found for breed "${breedName}". ` +
          'Every breed must have an entry in backend/data/breedStarterStats.json — ' +
          'check that the DB breed name matches the JSON key exactly.',
      ),
      { statusCode: 500 },
    );
  }

  const missingKeys = STAT_KEYS.filter(k => {
    const s = profile[k];
    return !s || typeof s.mean !== 'number';
  });
  if (missingKeys.length > 0) {
    throw Object.assign(
      new Error(
        `breedStarterStats.json profile for "${breedName}" is incomplete ` +
          `(missing: ${missingKeys.join(', ')}). All 12 stats must be present.`,
      ),
      { statusCode: 500 },
    );
  }

  const sampled = Object.fromEntries(
    STAT_KEYS.map(k => {
      const s = profile[k];
      // JSON uses `std`; sampleStat uses `stdDev`. Accept either.
      const stdDev = typeof s.stdDev === 'number' ? s.stdDev : s.std;
      const value = sampleStat({ mean: s.mean, stdDev: stdDev ?? 3 }, random);
      return [k, Math.max(storeStatMinimum, Math.min(storeStatMaximum, value))];
    }),
  );
  // Owner ruling 2026-10-16: each stat 1–20, total exactly 200. Scaling an
  // over-200 roll down keeps every stat within [1, 20]; topping an under-200
  // roll up never lifts a stat past 20. Enforced at generation time in the
  // SAME path the store and the perf seed both use.
  const capped = clampStatsToTotalCap(sampled, storeStatTotal);
  return topUpStatsToTotal(capped, storeStatTotal, storeStatMaximum, random);
}
