/**
 * Inbreeding Coefficient Utility
 *
 * Canonical, single-source-of-truth implementation of the inbreeding
 * coefficient math shared by the genetics services.
 *
 * Previously this shared-ancestor arithmetic was duplicated across two
 * services with divergent signatures (Equoria-n5wza):
 *   - enhancedGeneticProbabilityService.calculateInbreedingCoefficient
 *     (sync, takes in-memory stallion/mare/lineage objects), and
 *   - advancedLineageAnalysisService.calculateInbreedingCoefficient
 *     (async, fetches lineage from the DB).
 *
 * Both services genuinely differ in HOW they assemble the two ancestor
 * sets and what denominator they normalise against — those differences
 * are data-source-driven and intentional. The shared math is the final
 * step: intersect the two ancestor-ID sets and divide the shared count
 * by a denominator, clamped to [0, 1]. That step now lives here so the
 * two call sites cannot drift apart.
 */

/**
 * Compute the inbreeding coefficient from two ancestor-ID sets.
 *
 * This is the canonical shared core. Callers are responsible for building
 * the two ancestor sets and choosing the denominator that matches their
 * data shape; this function owns the intersection + normalisation only.
 *
 * @param {Iterable<number|string>} stallionAncestorIds - IDs in the stallion's ancestry.
 * @param {Iterable<number|string>} mareAncestorIds - IDs in the mare's ancestry.
 * @param {number} denominator - Value to divide the shared-ancestor count by.
 * @param {Object} [options]
 * @param {Iterable<number|string>} [options.excludeIds] - IDs to exclude from the
 *   shared set (e.g. the breeding pair's own IDs) before counting.
 * @returns {number} Inbreeding coefficient clamped to [0, 1].
 */
export function calculateInbreedingCoefficientCore(
  stallionAncestorIds,
  mareAncestorIds,
  denominator,
  options = {},
) {
  const stallionSet = stallionAncestorIds instanceof Set
    ? stallionAncestorIds
    : new Set(stallionAncestorIds || []);
  const mareSet = mareAncestorIds instanceof Set
    ? mareAncestorIds
    : new Set(mareAncestorIds || []);

  const excludeSet = options.excludeIds instanceof Set
    ? options.excludeIds
    : new Set(options.excludeIds || []);

  let sharedCount = 0;
  for (const id of stallionSet) {
    if (mareSet.has(id) && !excludeSet.has(id)) {
      sharedCount += 1;
    }
  }

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  const coefficient = sharedCount / denominator;

  // Clamp to [0, 1]. Floor guards against pathological negative inputs;
  // cap matches the documented 0-1 contract of both former call sites.
  if (coefficient < 0) {
    return 0;
  }
  return Math.min(1, coefficient);
}

export default calculateInbreedingCoefficientCore;
