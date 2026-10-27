/**
 * Trait Revelation Analytics Service (Equoria-yznve)
 *
 * Aggregates the queryable TraitHistoryLog (schema.prisma:840) into admin-facing
 * revelation statistics: counts by traitName, by definitional category
 * (positive / negative / unknown), by day, plus a grand total. This is the
 * aggregate surface originally requested by the now-archived daily trait
 * evaluation plan. The implementation and tests are the current authority.
 *
 * Data source: TraitHistoryLog rows. Each row stores the revealed trait *key*
 * (e.g. "confident", "fearful") in `traitName`, a
 * `sourceType` (the daily cron writes "daily_evaluation" — Equoria-bfo1t), and a
 * `timestamp`. There is NO stored category column.
 *
 * IMPORTANT DATA-REALITY NOTE (OPTIMAL_FIX §1):
 * The AC asks for counts "by category (positive/negative/hidden)". The stored
 * data does NOT preserve the runtime "revealed-as-hidden" flag: the trait
 * reveal engine may move a positive/negative
 * trait into the `hidden` bucket at reveal time, but only the trait *key* is
 * persisted to TraitHistoryLog — the hidden/visible distinction is lost. The only
 * category recoverable from the stored data is the trait's *definitional* category
 * from the 20-trait roster (utils/epigeneticTraits.mjs, owner ruling 2026-10-27,
 * q117): its polarity, positive | negative. This service therefore classifies by
 * definitional category. A trait key that is off the roster, or on it with no ruled
 * polarity yet, is bucketed as "unknown", so the category totals always reconcile
 * to the grand total.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getTraitDefinition } from '../../../utils/epigeneticTraits.mjs';
import { gameDateKey } from '../../../utils/gameTime.mjs';
import { withoutHiddenTraitHistory } from '../../../utils/publicTraitView.mjs';

/**
 * Classify a persisted traitName into its definitional category.
 * Falls back to 'unknown' for any trait off the roster, or on it with no ruled
 * polarity, so that the per-category counts always sum to the total.
 * @param {string} traitName
 * @returns {string} 'positive' | 'negative' | 'unknown'
 */
export function classifyTraitCategory(traitName) {
  if (typeof traitName !== 'string' || traitName.length === 0) {
    return 'unknown';
  }
  const type = getTraitDefinition(traitName)?.type;
  return type === 'positive' || type === 'negative' ? type : 'unknown';
}

/**
 * Aggregate trait-revelation statistics from TraitHistoryLog.
 *
 * @param {Object} [options]
 * @param {Date|string} [options.startDate] - inclusive lower bound on timestamp
 * @param {Date|string} [options.endDate]   - inclusive upper bound on timestamp
 * @param {string}      [options.sourceType] - filter to one sourceType (e.g.
 *                       'daily_evaluation' to scope to nightly-cron reveals only)
 * @param {boolean}     [options.includeHidden=false] - count rows naming a
 *                       trait still hidden on its horse. Only for a caller
 *                       holding `traits.hidden.view` (the owner, Equoria-4tleh);
 *                       otherwise those rows are left out entirely.
 * @returns {Promise<Object>} aggregate report:
 *   {
 *     total: number,
 *     byTraitName: { [traitName]: number },   // descending in insertion via sort below
 *     byCategory: { positive, negative, unknown },
 *     byDate: { 'YYYY-MM-DD': number },        // UTC calendar day
 *     dateRange: { startDate, endDate },
 *     sourceType: string | null
 *   }
 */
export async function getTraitRevelationAnalytics(options = {}) {
  const { startDate = null, endDate = null, sourceType = null, includeHidden = false } = options;

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
  const allRows = await prisma.traitHistoryLog.findMany({
    where,
    select: {
      traitName: true,
      timestamp: true,
      horse: { select: { epigeneticModifiers: true } },
    },
    orderBy: { timestamp: 'asc' },
  });
  const rows =
    includeHidden === true
      ? allRows
      : withoutHiddenTraitHistory(allRows, row => row.horse?.epigeneticModifiers);

  const byTraitNameRaw = {};
  const byCategory = { positive: 0, negative: 0, unknown: 0 };
  const byDate = {};

  for (const row of rows) {
    const name = row.traitName;

    // Count by traitName
    byTraitNameRaw[name] = (byTraitNameRaw[name] ?? 0) + 1;

    // Count by definitional category (data-reality: see file header note)
    const category = classifyTraitCategory(name);
    byCategory[category] += 1;

    // Count by Eastern game day (date-only bucket — over-time aggregation)
    const ts = row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp);
    const dayKey = gameDateKey(ts); // 'YYYY-MM-DD' on the game clock
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
