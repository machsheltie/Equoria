/**
 * Trait Revelation Analytics Service (Equoria-yznve)
 *
 * Aggregates the queryable TraitHistoryLog (schema.prisma:840) into admin-facing
 * revelation statistics: counts by traitName, by definitional category
 * (positive / negative / rare / unknown), by day, plus a grand total. This is the
 * aggregate surface that Future Enhancement #3 ("Track trait revelation
 * statistics") in docs/history/backend-docs/daily-trait-evaluation.md describes.
 *
 * Data source: TraitHistoryLog rows. Each row stores the revealed trait *key*
 * (e.g. "intelligent", "nervous", "legendaryBloodline") in `traitName`, a
 * `sourceType` (the daily cron writes "daily_evaluation" — Equoria-bfo1t), and a
 * `timestamp`. There is NO stored category column.
 *
 * IMPORTANT DATA-REALITY NOTE (OPTIMAL_FIX §1):
 * The AC asks for counts "by category (positive/negative/hidden)". The stored
 * data does NOT preserve the runtime "revealed-as-hidden" flag: the trait
 * evaluator (traitEvaluation.evaluateTraitRevelation) may push a positive/negative
 * trait into the `hidden` bucket at reveal time, but only the trait *key* is
 * persisted to TraitHistoryLog — the hidden/visible distinction is lost. The only
 * category recoverable from the stored data is the trait's *definitional* category
 * from TRAIT_DEFINITIONS (the top-level grouping: positive | negative | rare).
 * This service therefore classifies by definitional category. A trait key not
 * present in TRAIT_DEFINITIONS is bucketed as "unknown" (e.g. milestone/groom
 * traits that share the table but are not part of the foal reveal roster), so the
 * category totals always reconcile to the grand total.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { TRAIT_DEFINITIONS } from '../utils/traitEvaluation.mjs';

/**
 * Build a one-time map of traitKey -> definitional category from TRAIT_DEFINITIONS.
 * TRAIT_DEFINITIONS is shaped { positive: { key: {...} }, negative: {...}, rare: {...} }.
 * @returns {Map<string,string>} lowercase-trait-key -> category
 */
function buildCategoryMap() {
  const map = new Map();
  for (const [category, traits] of Object.entries(TRAIT_DEFINITIONS)) {
    // Guard: each category value must be a plain object of trait keys.
    if (traits === null || typeof traits !== 'object' || Array.isArray(traits)) {
      continue;
    }
    for (const traitKey of Object.keys(traits)) {
      map.set(traitKey.toLowerCase(), category);
    }
  }
  return map;
}

const CATEGORY_MAP = buildCategoryMap();

/**
 * Classify a persisted traitName into its definitional category.
 * Falls back to 'unknown' for any trait not in the foal-reveal roster so that
 * the per-category counts always sum to the total.
 * @param {string} traitName
 * @returns {string} 'positive' | 'negative' | 'rare' | 'unknown'
 */
export function classifyTraitCategory(traitName) {
  if (typeof traitName !== 'string' || traitName.length === 0) {
    return 'unknown';
  }
  return CATEGORY_MAP.get(traitName.toLowerCase()) ?? 'unknown';
}

/**
 * Aggregate trait-revelation statistics from TraitHistoryLog.
 *
 * @param {Object} [options]
 * @param {Date|string} [options.startDate] - inclusive lower bound on timestamp
 * @param {Date|string} [options.endDate]   - inclusive upper bound on timestamp
 * @param {string}      [options.sourceType] - filter to one sourceType (e.g.
 *                       'daily_evaluation' to scope to nightly-cron reveals only)
 * @returns {Promise<Object>} aggregate report:
 *   {
 *     total: number,
 *     byTraitName: { [traitName]: number },   // descending in insertion via sort below
 *     byCategory: { positive, negative, rare, unknown },
 *     byDate: { 'YYYY-MM-DD': number },        // UTC calendar day
 *     dateRange: { startDate, endDate },
 *     sourceType: string | null
 *   }
 */
export async function getTraitRevelationAnalytics(options = {}) {
  const { startDate = null, endDate = null, sourceType = null } = options;

  const where = {};

  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) {
      where.timestamp.gte = new Date(startDate);
    }
    if (endDate) {
      where.timestamp.lte = new Date(endDate);
    }
  }

  if (sourceType) {
    where.sourceType = sourceType;
  }

  // Pull only the columns the aggregation needs. No mocks — real DB read.
  const rows = await prisma.traitHistoryLog.findMany({
    where,
    select: { traitName: true, timestamp: true },
    orderBy: { timestamp: 'asc' },
  });

  const byTraitNameRaw = {};
  const byCategory = { positive: 0, negative: 0, rare: 0, unknown: 0 };
  const byDate = {};

  for (const row of rows) {
    const name = row.traitName;

    // Count by traitName
    byTraitNameRaw[name] = (byTraitNameRaw[name] ?? 0) + 1;

    // Count by definitional category (data-reality: see file header note)
    const category = classifyTraitCategory(name);
    // A new category appearing in TRAIT_DEFINITIONS would otherwise be dropped;
    // initialize defensively so totals always reconcile.
    byCategory[category] = (byCategory[category] ?? 0) + 1;

    // Count by UTC calendar day (date-only bucket — over-time aggregation)
    const ts = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
    const dayKey = ts.toISOString().slice(0, 10); // 'YYYY-MM-DD' in UTC
    byDate[dayKey] = (byDate[dayKey] ?? 0) + 1;
  }

  // Return byTraitName sorted by count desc, then name asc, for a stable,
  // most-common-first ordering (the AC's "most/least common revealed traits").
  const byTraitName = Object.fromEntries(
    Object.entries(byTraitNameRaw).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );

  return {
    total: rows.length,
    byTraitName,
    byCategory,
    byDate,
    dateRange: {
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    },
    sourceType: sourceType ?? null,
  };
}

export default { getTraitRevelationAnalytics, classifyTraitCategory };
